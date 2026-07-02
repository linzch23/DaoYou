from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.agent.contracts import MemoryCandidate
from app.agent.custom_preferences import parse_custom_preferences as parse_custom_preferences_text
from app.agent.memory import (
    extract_explicit_memory_candidates,
    extract_memory_candidates_with_llm,
)
from app.models.chat import ChatMessage
from app.models.photo import PhotoRecord
from app.models.preference import UserMemory, UserPreference
from app.schemas.preferences import (
    MemorySummaryRequest,
    UpdatePreferencesRequest,
)
from app.services.resource_service import require_owned_trip, require_user

DEFAULT_PREFERENCES = {
    "explanation_style": "fun",
    "travel_pace": "slow",
    "interests": ["history", "photo"],
    "special_needs": ["less_walking"],
    "custom_instructions": "",
    "custom_preferences": {},
    "custom_preferences_confirmed_at": None,
}
PROFILE_KEY = "profile"
MEMORY_SETTINGS_KEY = "memory_settings"


def get_preferences(user_id: int, *, db: Session) -> dict[str, dict[str, object]]:
    require_user(db, user_id)
    record = db.scalar(
        select(UserPreference).where(
            UserPreference.user_id == user_id,
            UserPreference.preference_key == PROFILE_KEY,
        )
    )
    if record is None:
        return {"preferences": dict(DEFAULT_PREFERENCES)}
    return {"preferences": {**DEFAULT_PREFERENCES, **record.preference_value}}


def update_preferences(payload: UpdatePreferencesRequest, *, db: Session) -> dict[str, bool]:
    require_user(db, payload.user_id)
    changes = dict(payload.preferences)
    if "custom_instructions" in changes or "custom_preferences" in changes:
        changes["custom_preferences_confirmed_at"] = datetime.now(timezone.utc).isoformat()
    record = db.scalar(
        select(UserPreference).where(
            UserPreference.user_id == payload.user_id,
            UserPreference.preference_key == PROFILE_KEY,
        )
    )
    if record is None:
        merged_preferences = {
            **DEFAULT_PREFERENCES,
            **changes,
        }
        db.add(
            UserPreference(
                user_id=payload.user_id,
                preference_key=PROFILE_KEY,
                preference_value=merged_preferences,
            )
        )
    else:
        record.preference_value = {
            **record.preference_value,
            **changes,
        }
        record.updated_at = datetime.utcnow()

    db.commit()
    return {"updated": True}


def parse_custom_preferences(
    user_id: int,
    text: str,
    current_preferences: dict[str, object],
    *,
    db: Session,
) -> dict[str, object]:
    require_user(db, user_id)
    stored_preferences = get_preferences(user_id=user_id, db=db)["preferences"]
    effective_preferences = {**stored_preferences, **current_preferences}
    return parse_custom_preferences_text(text, effective_preferences)


def get_memory_settings(user_id: int, *, db: Session) -> dict[str, bool]:
    require_user(db, user_id)
    record = db.scalar(
        select(UserPreference).where(
            UserPreference.user_id == user_id,
            UserPreference.preference_key == MEMORY_SETTINGS_KEY,
        )
    )
    enabled = True if record is None else bool(record.preference_value.get("enabled", True))
    return {"enabled": enabled}


def update_memory_settings(user_id: int, enabled: bool, *, db: Session) -> dict[str, bool]:
    require_user(db, user_id)
    record = db.scalar(
        select(UserPreference).where(
            UserPreference.user_id == user_id,
            UserPreference.preference_key == MEMORY_SETTINGS_KEY,
        )
    )
    if record is None:
        db.add(
            UserPreference(
                user_id=user_id,
                preference_key=MEMORY_SETTINGS_KEY,
                preference_value={"enabled": enabled},
            )
        )
    else:
        record.preference_value = {"enabled": enabled}
        record.updated_at = datetime.utcnow()
    db.commit()
    return {"updated": True, "enabled": enabled}


def delete_memory(
    user_id: int,
    memory_type: str,
    memory_key: str,
    *,
    db: Session,
) -> dict[str, bool]:
    require_user(db, user_id)
    result = db.execute(
        delete(UserMemory).where(
            UserMemory.user_id == user_id,
            UserMemory.memory_type == memory_type,
            UserMemory.memory_key == memory_key,
        )
    )
    db.commit()
    return {"deleted": bool(result.rowcount)}


def clear_memories(user_id: int, *, db: Session) -> dict[str, int]:
    require_user(db, user_id)
    result = db.execute(delete(UserMemory).where(UserMemory.user_id == user_id))
    db.commit()
    return {"deleted_count": result.rowcount or 0}


def summarize_memory(payload: MemorySummaryRequest, *, db: Session) -> dict[str, object]:
    require_user(db, payload.user_id)
    require_owned_trip(db, payload.user_id, payload.trip_id)
    if not get_memory_settings(user_id=payload.user_id, db=db)["enabled"]:
        return {"updated": False, "memories": []}
    source_messages = _memory_source_messages(payload.user_id, payload.trip_id, db=db)
    photo_behavior_count = db.scalar(
        select(func.count(PhotoRecord.id)).where(
            PhotoRecord.user_id == payload.user_id,
            PhotoRecord.trip_id == payload.trip_id,
        )
    ) or 0
    candidates = _build_memory_candidates(
        source_messages,
        photo_behavior_count=photo_behavior_count,
    )
    persist_memory_candidates(
        user_id=payload.user_id,
        trip_id=payload.trip_id,
        candidates=candidates,
        db=db,
        source="chat_photo_history",
    )
    db.commit()
    memories = get_relevant_memories(user_id=payload.user_id, db=db)
    return {"updated": bool(candidates), "memories": memories}


def get_relevant_memories(
    user_id: int,
    *,
    db: Session,
    min_confidence: float = 0.65,
    limit: int = 20,
) -> list[dict[str, object]]:
    require_user(db, user_id)
    records = db.scalars(
        select(UserMemory)
        .where(
            UserMemory.user_id == user_id,
            UserMemory.confidence >= Decimal(str(min_confidence)),
        )
        .order_by(UserMemory.confidence.desc(), UserMemory.updated_at.desc())
        .limit(limit)
    ).all()
    return [_serialize_memory(record) for record in records]


def persist_memory_candidates(
    *,
    user_id: int,
    trip_id: int,
    candidates: list[MemoryCandidate] | list[dict[str, object]],
    db: Session,
    evidence_message_id: int | None = None,
    source: str = "explicit_chat",
) -> list[dict[str, object]]:
    persisted: list[UserMemory] = []
    for raw_candidate in candidates:
        candidate = (
            raw_candidate
            if isinstance(raw_candidate, MemoryCandidate)
            else MemoryCandidate.model_validate(raw_candidate)
        )
        record = db.scalar(
            select(UserMemory).where(
                UserMemory.user_id == user_id,
                UserMemory.memory_type == candidate.memory_type,
                UserMemory.memory_key == candidate.memory_key,
            )
        )
        old_value = dict(record.memory_value) if record is not None else {}
        same_value = old_value.get("value") == candidate.value
        evidence_ids = [
            value
            for value in old_value.get("evidence_message_ids", [])
            if isinstance(value, int)
        ]
        if evidence_message_id is not None and evidence_message_id not in evidence_ids:
            evidence_ids.append(evidence_message_id)
        source_trip_ids = [
            value for value in old_value.get("source_trip_ids", []) if isinstance(value, int)
        ]
        if trip_id not in source_trip_ids:
            source_trip_ids.append(trip_id)
        previous_count = int(old_value.get("evidence_count") or 0) if same_value else 0
        memory_value = {
            "value": candidate.value,
            "description": candidate.description,
            "source": source,
            "evidence_kind": candidate.evidence_kind,
            "evidence_count": previous_count + 1,
            "evidence_message_ids": evidence_ids[-20:],
            "source_trip_ids": source_trip_ids[-20:],
        }
        confidence = Decimal(str(candidate.confidence))
        if record is None:
            record = UserMemory(
                user_id=user_id,
                memory_type=candidate.memory_type,
                memory_key=candidate.memory_key,
                memory_value=memory_value,
                confidence=confidence,
            )
            db.add(record)
        else:
            record.memory_value = memory_value
            record.confidence = _merged_confidence(record.confidence, confidence, same_value)
            record.updated_at = datetime.utcnow()
        persisted.append(record)
    db.flush()
    return [_serialize_memory(record) for record in persisted]


def _memory_source_messages(user_id: int, trip_id: int, *, db: Session) -> list[str]:
    chat_messages = db.scalars(
        select(ChatMessage)
        .where(
            ChatMessage.user_id == user_id,
            ChatMessage.trip_id == trip_id,
            ChatMessage.role == "user",
        )
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .limit(30)
    ).all()
    return [message.content for message in reversed(chat_messages)]


def _build_memory_candidates(
    source_messages: list[str],
    *,
    photo_behavior_count: int = 0,
) -> list[MemoryCandidate]:
    candidates: dict[tuple[str, str], MemoryCandidate] = {}
    for message in source_messages:
        for candidate in extract_explicit_memory_candidates(message):
            candidates[(candidate.memory_type, candidate.memory_key)] = candidate

    photo_message_count = sum(
        any(keyword in message for keyword in ["拍照", "出片", "机位", "照片"])
        for message in source_messages
    )
    if photo_message_count + photo_behavior_count >= 2:
        candidates.setdefault(
            ("interest", "photo"),
            MemoryCandidate(
                memory_type="interest",
                memory_key="photo",
                value=True,
                description="用户多次关注拍照角度、出片位置或旅行摄影",
                confidence=0.75,
                evidence_kind="behavior_signal",
            ),
        )
    pace_message_count = sum(
        any(keyword in message for keyword in ["轻松", "休息", "累", "少走", "慢节奏"])
        for message in source_messages
    )
    if pace_message_count >= 2:
        candidates.setdefault(
            ("preference", "slow_pace"),
            MemoryCandidate(
                memory_type="preference",
                memory_key="slow_pace",
                value=True,
                description="用户倾向轻松慢节奏安排，需要休息和交通缓冲",
                confidence=0.75,
                evidence_kind="behavior_signal",
            ),
        )
    for candidate in extract_memory_candidates_with_llm(source_messages):
        candidates.setdefault((candidate.memory_type, candidate.memory_key), candidate)
    return list(candidates.values())


def _merged_confidence(
    previous: Decimal,
    incoming: Decimal,
    same_value: bool,
) -> Decimal:
    if not same_value:
        return incoming
    previous_float = float(previous)
    incoming_float = float(incoming)
    merged = 1 - (1 - previous_float) * (1 - incoming_float * 0.35)
    return Decimal(str(round(min(0.999, merged), 3)))


def _serialize_memory(record: UserMemory) -> dict[str, object]:
    return {
        "memory_type": record.memory_type,
        "memory_key": record.memory_key,
        "memory_value": dict(record.memory_value),
        "confidence": float(record.confidence),
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
    }

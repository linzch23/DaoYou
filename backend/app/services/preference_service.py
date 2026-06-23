from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

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
}
PROFILE_KEY = "profile"


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
    return {"preferences": dict(record.preference_value)}


def update_preferences(payload: UpdatePreferencesRequest, *, db: Session) -> dict[str, bool]:
    require_user(db, payload.user_id)
    record = db.scalar(
        select(UserPreference).where(
            UserPreference.user_id == payload.user_id,
            UserPreference.preference_key == PROFILE_KEY,
        )
    )
    if record is None:
        db.add(
            UserPreference(
                user_id=payload.user_id,
                preference_key=PROFILE_KEY,
                preference_value=payload.preferences,
            )
        )
    else:
        record.preference_value = payload.preferences
        record.updated_at = datetime.utcnow()

    db.commit()
    return {"updated": True}


def summarize_memory(payload: MemorySummaryRequest, *, db: Session) -> dict[str, object]:
    require_user(db, payload.user_id)
    trip = require_owned_trip(db, payload.user_id, payload.trip_id)
    source_text = _memory_source_text(payload.user_id, payload.trip_id, db=db)
    memories = _build_memory_summaries(trip_title=trip.title, source_text=source_text)

    for memory in memories:
        record = db.scalar(
            select(UserMemory).where(
                UserMemory.user_id == payload.user_id,
                UserMemory.memory_type == memory["memory_type"],
                UserMemory.memory_key == memory["memory_key"],
            )
        )
        if record is None:
            db.add(
                UserMemory(
                    user_id=payload.user_id,
                    memory_type=memory["memory_type"],
                    memory_key=memory["memory_key"],
                    memory_value=memory["memory_value"],
                    confidence=Decimal(str(memory["confidence"])),
                )
            )
        else:
            record.memory_value = memory["memory_value"]
            record.confidence = Decimal(str(memory["confidence"]))

    db.commit()
    return {"updated": True, "memories": memories}


def _memory_source_text(user_id: int, trip_id: int, *, db: Session) -> str:
    chat_messages = db.scalars(
        select(ChatMessage)
        .where(ChatMessage.user_id == user_id, ChatMessage.trip_id == trip_id)
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .limit(20)
    ).all()
    photo_records = db.scalars(
        select(PhotoRecord)
        .where(PhotoRecord.user_id == user_id, PhotoRecord.trip_id == trip_id)
        .order_by(PhotoRecord.created_at.desc(), PhotoRecord.id.desc())
        .limit(10)
    ).all()

    chunks = [message.content for message in chat_messages]
    for record in photo_records:
        chunks.extend(
            text
            for text in [record.recognition_result, record.explanation]
            if text
        )
    return "\n".join(chunks)


def _build_memory_summaries(
    *,
    trip_title: str,
    source_text: str,
) -> list[dict[str, object]]:
    memories: list[dict[str, object]] = []
    if any(keyword in source_text for keyword in ["拍照", "出片", "机位", "照片"]):
        memories.append(
            {
                "memory_type": "interest",
                "memory_key": "photo",
                "memory_value": {
                    "description": "用户经常关注拍照角度、出片位置和适合记录的旅行场景",
                    "source": "chat_photo_history",
                },
                "confidence": 0.85,
            }
        )
    if any(keyword in source_text for keyword in ["轻松", "休息", "累", "少走", "慢节奏"]):
        memories.append(
            {
                "memory_type": "preference",
                "memory_key": "slow_pace",
                "memory_value": {
                    "description": "用户倾向轻松慢节奏安排，需要保留休息和交通缓冲",
                    "source": "chat_photo_history",
                },
                "confidence": 0.8,
            }
        )
    if not memories:
        description = (
            f"已为用户完成 {trip_title} 的阶段性记忆总结，"
            "暂未发现明确偏好信号"
        )
        memories.append(
            {
                "memory_type": "trip",
                "memory_key": f"trip_{trip_title}",
                "memory_value": {
                    "description": description,
                    "source": "trip_summary",
                },
                "confidence": 0.5,
            }
        )
    return memories

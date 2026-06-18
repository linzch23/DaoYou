from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.preference import UserPreference
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
    require_owned_trip(db, payload.user_id, payload.trip_id)
    return {"updated": True, "memories": []}

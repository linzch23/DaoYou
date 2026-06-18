from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.preference import UserPreference
from app.models.trip import Trip
from app.models.user import User
from app.schemas.preferences import MemorySummaryRequest, UpdatePreferencesRequest
from app.services.preference_service import get_preferences, summarize_memory, update_preferences


def test_get_preferences_returns_defaults_when_user_has_no_profile(db: Session) -> None:
    db.add(User(id=1, nickname="演示用户"))
    db.commit()

    result = get_preferences(user_id=1, db=db)

    assert result["preferences"]["travel_pace"] == "slow"
    assert result["preferences"]["interests"] == ["history", "photo"]


def test_update_preferences_upserts_profile_record(db: Session) -> None:
    db.add(User(id=1, nickname="演示用户"))
    db.commit()

    first = update_preferences(
        UpdatePreferencesRequest(
            user_id=1,
            preferences={
                "explanation_style": "children",
                "travel_pace": "normal",
                "interests": ["family"],
                "special_needs": ["less_queue"],
            },
        ),
        db=db,
    )
    second = update_preferences(
        UpdatePreferencesRequest(
            user_id=1,
            preferences={
                "explanation_style": "fun",
                "travel_pace": "slow",
                "interests": ["history", "photo"],
                "special_needs": ["less_walking"],
            },
        ),
        db=db,
    )

    records = db.scalars(select(UserPreference).where(UserPreference.user_id == 1)).all()
    assert first == {"updated": True}
    assert second == {"updated": True}
    assert len(records) == 1
    assert records[0].preference_key == "profile"
    assert get_preferences(user_id=1, db=db)["preferences"]["travel_pace"] == "slow"


def test_summarize_memory_requires_owned_trip(db: Session) -> None:
    db.add_all(
        [
            User(id=1, nickname="演示用户"),
            User(id=2, nickname="其他用户"),
        ]
    )
    db.flush()
    db.add(
        Trip(
            id=1,
            user_id=2,
            title="其他人的行程",
            start_date=date(2026, 7, 1),
            end_date=date(2026, 7, 3),
            status="active",
        )
    )
    db.commit()

    with pytest.raises(AppError):
        summarize_memory(MemorySummaryRequest(user_id=1, trip_id=1), db=db)

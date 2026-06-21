from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.chat import ChatMessage
from app.models.photo import PhotoRecord
from app.models.preference import UserMemory, UserPreference
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


def test_summarize_memory_persists_detected_user_memories(db: Session) -> None:
    db.add(User(id=1, nickname="演示用户"))
    db.flush()
    db.add(
        Trip(
            id=1,
            user_id=1,
            title="大连三日游",
            start_date=date(2026, 7, 1),
            end_date=date(2026, 7, 3),
            status="active",
        )
    )
    db.add_all(
        [
            ChatMessage(user_id=1, role="user", content="下午想轻松一点，我有点累，想少走路。"),
            ChatMessage(user_id=1, role="user", content="这里有没有适合拍照出片的位置？"),
            PhotoRecord(
                user_id=1,
                image_path="uploads/images/yurenmatou.jpg",
                recognition_result="图片可能是大连渔人码头。",
                explanation="这里适合慢节奏散步和拍照。",
            ),
        ]
    )
    db.commit()

    result = summarize_memory(MemorySummaryRequest(user_id=1, trip_id=1), db=db)

    records = db.scalars(select(UserMemory).where(UserMemory.user_id == 1)).all()
    memory_keys = {memory["memory_key"] for memory in result["memories"]}
    assert result["updated"] is True
    assert memory_keys == {"photo", "slow_pace"}
    assert {record.memory_key for record in records} == {"photo", "slow_pace"}
    assert records[0].memory_value["source"] == "chat_photo_history"


def test_summarize_memory_updates_existing_memory_without_duplicates(db: Session) -> None:
    db.add(User(id=1, nickname="演示用户"))
    db.flush()
    db.add(
        Trip(
            id=1,
            user_id=1,
            title="大连三日游",
            start_date=date(2026, 7, 1),
            end_date=date(2026, 7, 3),
            status="active",
        )
    )
    db.add(ChatMessage(user_id=1, role="user", content="想找适合拍照的海边机位。"))
    db.commit()

    summarize_memory(MemorySummaryRequest(user_id=1, trip_id=1), db=db)
    summarize_memory(MemorySummaryRequest(user_id=1, trip_id=1), db=db)

    records = db.scalars(select(UserMemory).where(UserMemory.user_id == 1)).all()
    assert len(records) == 1
    assert records[0].memory_type == "interest"
    assert records[0].memory_key == "photo"

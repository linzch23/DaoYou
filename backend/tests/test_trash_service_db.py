from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models.chat import ChatMessage
from app.models.photo import PhotoRecord
from app.models.trip import Trip, TripDay, TripItem
from app.models.user import User
from app.services.trash_service import (
    empty_trip_trash,
    list_trashed_trips,
    permanently_delete_trashed_trip,
    restore_trashed_trip,
)
from app.services.trip_service import delete_trip


def create_deleted_trip(db: Session, user_id: int, title: str) -> Trip:
    trip = Trip(
        user_id=user_id,
        title=title,
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 2),
        status="active",
    )
    db.add(trip)
    db.flush()
    day = TripDay(trip_id=trip.id, day_index=1, trip_date=date(2026, 7, 1))
    db.add(day)
    db.flush()
    db.add(TripItem(trip_day_id=day.id, city="大连", title="测试节点"))
    db.commit()
    delete_trip(user_id=user_id, trip_id=trip.id, db=db)
    return trip


def test_restore_and_permanent_delete_require_owned_trashed_trip(db: Session) -> None:
    db.add_all([User(id=1, nickname="用户一"), User(id=2, nickname="用户二")])
    db.commit()
    trip = create_deleted_trip(db, user_id=1, title="待恢复旅行")

    assert list_trashed_trips(user_id=1, db=db)["trips"][0]["id"] == trip.id
    assert restore_trashed_trip(user_id=1, trip_id=trip.id, db=db) == {"restored": True}
    assert db.get(Trip, trip.id).deleted_at is None

    with pytest.raises(AppError) as exc_info:
        permanently_delete_trashed_trip(user_id=1, trip_id=trip.id, db=db)
    assert exc_info.value.code == ErrorCode.NOT_FOUND

    delete_trip(user_id=1, trip_id=trip.id, db=db)
    assert permanently_delete_trashed_trip(user_id=1, trip_id=trip.id, db=db) == {
        "permanently_deleted": True
    }
    assert db.get(Trip, trip.id) is None


def test_empty_trash_only_deletes_current_users_trips(db: Session) -> None:
    db.add_all([User(id=1, nickname="用户一"), User(id=2, nickname="用户二")])
    db.commit()
    own_trip = create_deleted_trip(db, user_id=1, title="用户一回收站")
    other_trip = create_deleted_trip(db, user_id=2, title="用户二回收站")
    own_trip_id = own_trip.id
    other_trip_id = other_trip.id

    assert empty_trip_trash(user_id=1, db=db) == {
        "permanently_deleted_count": 1,
        "file_cleanup_failed_count": 0,
    }
    assert db.scalar(select(Trip).where(Trip.id == own_trip_id)) is None
    assert db.scalar(select(Trip).where(Trip.id == other_trip_id)) is not None


def test_permanent_trip_delete_cascades_trip_scoped_chat_and_photos(db: Session) -> None:
    db.add(User(id=1, nickname="用户一"))
    db.commit()
    trip = create_deleted_trip(db, user_id=1, title="待永久删除旅行")
    db.add_all(
        [
            ChatMessage(user_id=1, trip_id=trip.id, role="user", content="这里有什么故事？"),
            PhotoRecord(
                user_id=1,
                trip_id=trip.id,
                image_path="uploads/images/demo.jpg",
                recognition_result="演示识别结果",
                explanation="演示讲解",
            ),
        ]
    )
    db.commit()

    permanently_delete_trashed_trip(user_id=1, trip_id=trip.id, db=db)

    assert db.scalar(select(ChatMessage).where(ChatMessage.user_id == 1)) is None
    assert db.scalar(select(PhotoRecord).where(PhotoRecord.user_id == 1)) is None

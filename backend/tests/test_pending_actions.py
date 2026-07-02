from datetime import date, datetime, time, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.pending_action import PendingAction
from app.models.trip import Trip, TripDay, TripItem
from app.models.user import User
from app.schemas.trips import UpdateTripItemRequest
from app.services.action_service import (
    confirm_action,
    create_pending_actions,
    reject_action,
)
from app.services.trip_service import get_trip_detail, update_trip_item


def _seed_trip(db: Session) -> TripItem:
    db.add_all([User(id=1, nickname="用户一"), User(id=2, nickname="用户二")])
    db.flush()
    trip = Trip(
        id=1,
        user_id=1,
        title="大连三日游",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 3),
        status="active",
    )
    db.add(trip)
    db.flush()
    day = TripDay(id=10, trip_id=trip.id, day_index=1, trip_date=date(2026, 7, 1))
    db.add(day)
    db.flush()
    item = TripItem(
        id=20,
        trip_day_id=day.id,
        city="大连",
        title="贝壳博物馆",
        item_type="attraction",
        start_time=time(14, 30),
        end_time=time(16, 0),
        status="planned",
    )
    db.add(item)
    db.commit()
    return item


def _create_update_action(db: Session) -> dict[str, object]:
    current_trip = get_trip_detail(user_id=1, trip_id=1, db=db)
    return create_pending_actions(
        user_id=1,
        trip_id=1,
        current_trip=current_trip,
        action_options=[
            {
                "option_id": "option_001",
                "label": "改为附近咖啡馆休息",
                "description": "减少步行",
                "operation": "update_trip_item",
                "trip_id": 1,
                "item_id": 20,
                "payload": {
                    "title": "附近咖啡馆休息",
                    "item_type": "rest",
                    "status": "changed",
                },
            }
        ],
        db=db,
    )[0]


def test_pending_action_is_persisted_without_trusting_client_payload(db: Session) -> None:
    _seed_trip(db)

    option = _create_update_action(db)
    db.commit()
    record = db.scalar(select(PendingAction).where(PendingAction.action_id == option["action_id"]))

    assert record is not None
    assert record.status == "pending"
    assert record.payload["title"] == "附近咖啡馆休息"
    assert option["expires_at"]


def test_pending_action_rejects_unknown_payload_fields(db: Session) -> None:
    _seed_trip(db)
    current_trip = get_trip_detail(user_id=1, trip_id=1, db=db)

    with pytest.raises(AppError, match="非法字段"):
        create_pending_actions(
            user_id=1,
            trip_id=1,
            current_trip=current_trip,
            action_options=[
                {
                    "operation": "update_trip_item",
                    "trip_id": 1,
                    "item_id": 20,
                    "payload": {"title": "合法标题", "user_id": 2},
                }
            ],
            db=db,
        )


def test_confirm_action_executes_once_and_is_idempotent(db: Session) -> None:
    item = _seed_trip(db)
    option = _create_update_action(db)
    db.commit()

    first = confirm_action(str(option["action_id"]), user_id=1, db=db)
    second = confirm_action(str(option["action_id"]), user_id=1, db=db)
    db.refresh(item)

    assert first["status"] == "confirmed"
    assert first["idempotent"] is False
    assert second["idempotent"] is True
    assert item.title == "附近咖啡馆休息"
    assert item.status == "changed"


def test_action_cannot_be_confirmed_by_another_user(db: Session) -> None:
    _seed_trip(db)
    option = _create_update_action(db)
    db.commit()

    with pytest.raises(AppError, match="行程操作不存在"):
        confirm_action(str(option["action_id"]), user_id=2, db=db)


def test_action_becomes_stale_after_trip_changes(db: Session) -> None:
    item = _seed_trip(db)
    option = _create_update_action(db)
    db.commit()
    update_trip_item(
        item.id,
        UpdateTripItemRequest(user_id=1, notes="用户在另一页面修改了备注"),
        db=db,
    )

    with pytest.raises(AppError, match="行程已发生变化"):
        confirm_action(str(option["action_id"]), user_id=1, db=db)

    record = db.scalar(select(PendingAction).where(PendingAction.action_id == option["action_id"]))
    assert record is not None
    assert record.status == "stale"


def test_expired_action_is_rejected_and_recorded(db: Session) -> None:
    _seed_trip(db)
    option = _create_update_action(db)
    db.flush()
    record = db.scalar(select(PendingAction).where(PendingAction.action_id == option["action_id"]))
    assert record is not None
    record.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit()

    with pytest.raises(AppError, match="已过期"):
        confirm_action(str(option["action_id"]), user_id=1, db=db)

    assert record.status == "expired"


def test_reject_action_is_idempotent_and_cannot_later_execute(db: Session) -> None:
    _seed_trip(db)
    option = _create_update_action(db)
    db.commit()

    first = reject_action(str(option["action_id"]), user_id=1, db=db)
    second = reject_action(str(option["action_id"]), user_id=1, db=db)

    assert first["idempotent"] is False
    assert second["idempotent"] is True
    with pytest.raises(AppError, match="rejected"):
        confirm_action(str(option["action_id"]), user_id=1, db=db)


def test_create_action_can_atomically_create_missing_day_and_item(db: Session) -> None:
    _seed_trip(db)
    current_trip = get_trip_detail(user_id=1, trip_id=1, db=db)
    option = create_pending_actions(
        user_id=1,
        trip_id=1,
        current_trip=current_trip,
        action_options=[
            {
                "option_id": "option_001",
                "label": "第二天新增公园",
                "operation": "create_trip_item",
                "trip_id": 1,
                "target_date": "2026-07-02",
                "target_day_index": 2,
                "payload": {
                    "city": "大连",
                    "title": "劳动公园",
                    "item_type": "attraction",
                    "start_time": "10:00",
                    "end_time": "11:30",
                },
            }
        ],
        db=db,
    )[0]
    db.commit()

    result = confirm_action(str(option["action_id"]), user_id=1, db=db)
    created = db.scalar(select(TripItem).where(TripItem.title == "劳动公园"))

    assert result["status"] == "confirmed"
    assert created is not None
    assert created.trip_day_id != 10

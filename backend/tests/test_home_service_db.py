from datetime import date, time

import pytest
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models.trip import Trip, TripDay, TripItem
from app.models.user import User
from app.services.home_service import get_today_home


def test_today_home_returns_items_without_in_app_reminders(db: Session) -> None:
    db.add(User(id=1, nickname="演示用户"))
    db.flush()
    trip = Trip(
        user_id=1,
        title="大连三日游",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 3),
        status="active",
    )
    db.add(trip)
    db.flush()
    day = TripDay(trip_id=trip.id, day_index=1, trip_date=date(2026, 7, 1))
    db.add(day)
    db.flush()
    db.add_all(
        [
            TripItem(
                trip_day_id=day.id,
                city="大连",
                title="下午行程",
                start_time=time(14, 0),
            ),
            TripItem(
                trip_day_id=day.id,
                city="大连",
                title="上午行程",
                start_time=time(9, 0),
            ),
        ]
    )
    db.commit()

    result = get_today_home(user_id=1, target_date=date(2026, 7, 1), db=db)

    assert result["trip_id"] == trip.id
    assert result["trip_title"] == "大连三日游"
    assert result["date"] == "2026-07-01"
    assert [item["title"] for item in result["today_items"]] == ["上午行程", "下午行程"]
    assert "unread_reminders" not in result


def test_today_home_ignores_deleted_trip(db: Session) -> None:
    db.add(User(id=1, nickname="演示用户"))
    db.flush()
    db.add(
        Trip(
            user_id=1,
            title="已删除旅行",
            start_date=date(2026, 7, 1),
            end_date=date(2026, 7, 3),
            status="active",
            deleted_at=date(2026, 6, 10),
        )
    )
    db.commit()

    with pytest.raises(AppError) as exc_info:
        get_today_home(user_id=1, target_date=date(2026, 7, 1), db=db)

    assert exc_info.value.code == ErrorCode.NOT_FOUND


def test_today_home_selects_latest_active_trip(db: Session) -> None:
    db.add(User(id=1, nickname="演示用户"))
    db.flush()
    older = Trip(
        user_id=1,
        title="旧行程",
        start_date=date(2026, 7, 3),
        end_date=date(2026, 7, 3),
        status="active",
    )
    latest = Trip(
        user_id=1,
        title="新行程",
        start_date=date(2026, 7, 3),
        end_date=date(2026, 7, 3),
        status="active",
    )
    db.add_all([older, latest])
    db.flush()
    db.add_all([
        TripDay(trip_id=older.id, day_index=1, trip_date=date(2026, 7, 3)),
        TripDay(trip_id=latest.id, day_index=1, trip_date=date(2026, 7, 3)),
    ])
    db.commit()

    result = get_today_home(user_id=1, target_date=date(2026, 7, 3), db=db)

    assert result["trip_id"] == latest.id
    assert result["trip_title"] == "新行程"

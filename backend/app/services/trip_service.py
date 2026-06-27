from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models.trip import Trip, TripDay, TripItem
from app.schemas.trips import (
    CreateTripDayRequest,
    CreateTripItemRequest,
    CreateTripRequest,
    UpdateTripItemRequest,
    UpdateTripRequest,
)
from app.services.resource_service import (
    require_owned_trip,
    require_owned_trip_day,
    require_owned_trip_item,
    require_user,
)
from app.services.serializers import serialize_trip_day, serialize_trip_summary


def create_trip(payload: CreateTripRequest, db: Session) -> dict[str, int]:
    require_user(db, payload.user_id)
    trip = Trip(
        user_id=payload.user_id,
        title=payload.title,
        start_date=payload.start_date,
        end_date=payload.end_date,
        # v0.5.0(2026-06-26 per user-round3)草稿推上后端触发:接受 status 入参,
        # 透传到 Trip 模型(模型 default='draft',payload.status 缺省时 fallback 'draft')
        status=payload.status or "draft",
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return {"trip_id": trip.id}


def list_trips(
    user_id: int,
    status: str | None = None,
    *,
    db: Session,
) -> dict[str, list[dict[str, object]]]:
    require_user(db, user_id)
    statement = select(Trip).where(Trip.user_id == user_id, Trip.deleted_at.is_(None))
    if status is not None:
        statement = statement.where(Trip.status == status)
    trips = db.scalars(statement.order_by(Trip.start_date, Trip.id)).all()
    # v0.6.0(per user-round4-2026-06-26 19:46 bug 修复):传 db=db 触发 itinerary_count subquery
    #   - 前端 computeEffectiveStatus 派生「完整行程」用(per utils/tripStatus.js v0.6.0 rewrite)
    #   - 单次 subquery 避免 N+1(per serializers.py:serialize_trip_summary 注释)
    return {"trips": [serialize_trip_summary(trip, db=db) for trip in trips]}


def get_trip_detail(user_id: int, trip_id: int, *, db: Session) -> dict[str, object]:
    trip = require_owned_trip(db, user_id, trip_id)
    days = db.scalars(
        select(TripDay).where(TripDay.trip_id == trip.id).order_by(TripDay.day_index, TripDay.id)
    ).all()
    day_ids = [day.id for day in days]
    items = (
        db.scalars(
            select(TripItem)
            .where(TripItem.trip_day_id.in_(day_ids))
            .order_by(TripItem.start_time, TripItem.id)
        ).all()
        if day_ids
        else []
    )
    items_by_day: dict[int, list[TripItem]] = {day_id: [] for day_id in day_ids}
    for item in items:
        items_by_day[item.trip_day_id].append(item)

    return {
        "id": trip.id,
        "user_id": trip.user_id,
        "title": trip.title,
        "start_date": trip.start_date.isoformat(),
        "end_date": trip.end_date.isoformat(),
        "status": trip.status,
        "deleted_at": None,
        "days": [serialize_trip_day(day, items_by_day[day.id]) for day in days],
    }


def update_trip(
    trip_id: int,
    payload: UpdateTripRequest,
    *,
    db: Session,
) -> dict[str, bool]:
    trip = require_owned_trip(db, payload.user_id, trip_id)
    changes = payload.model_dump(exclude={"user_id"}, exclude_none=True)
    for field, value in changes.items():
        setattr(trip, field, value)
    trip.updated_at = datetime.utcnow()
    db.commit()
    return {"updated": True}


def delete_trip(user_id: int, trip_id: int, *, db: Session) -> dict[str, object]:
    trip = require_owned_trip(db, user_id, trip_id)
    trip.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return {"deleted": True, "deleted_at": trip.deleted_at.isoformat()}


def create_trip_day(
    trip_id: int,
    payload: CreateTripDayRequest,
    *,
    db: Session,
) -> dict[str, int]:
    trip = require_owned_trip(db, payload.user_id, trip_id)
    if not trip.start_date <= payload.trip_date <= trip.end_date:
        raise AppError(ErrorCode.INVALID_REQUEST, "行程日期不在旅行日期范围内")
    duplicate = db.scalar(
        select(TripDay).where(
            TripDay.trip_id == trip.id,
            (TripDay.day_index == payload.day_index) | (TripDay.trip_date == payload.trip_date),
        )
    )
    if duplicate is not None:
        raise AppError(ErrorCode.INVALID_REQUEST, "行程日序号或日期已存在")

    trip_day = TripDay(
        trip_id=trip.id,
        day_index=payload.day_index,
        trip_date=payload.trip_date,
        summary=payload.summary,
    )
    db.add(trip_day)
    db.commit()
    db.refresh(trip_day)
    return {"trip_day_id": trip_day.id}


def create_trip_item(payload: CreateTripItemRequest, *, db: Session) -> dict[str, int]:
    trip_day = require_owned_trip_day(db, payload.user_id, payload.trip_day_id)
    _validate_time_range(payload.start_time, payload.end_time)
    _ensure_no_time_overlap(
        db,
        trip_day_id=trip_day.id,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )
    values = payload.model_dump(exclude={"user_id"})
    item = TripItem(**values)
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"item_id": item.id}


def update_trip_item(
    item_id: int,
    payload: UpdateTripItemRequest,
    *,
    db: Session,
) -> dict[str, bool]:
    item = require_owned_trip_item(db, payload.user_id, item_id)
    changes = payload.model_dump(exclude={"user_id"}, exclude_none=True)
    start_time = changes.get("start_time", item.start_time)
    end_time = changes.get("end_time", item.end_time)
    _validate_time_range(start_time, end_time)
    _ensure_no_time_overlap(
        db,
        trip_day_id=item.trip_day_id,
        start_time=start_time,
        end_time=end_time,
        exclude_item_id=item.id,
    )
    for field, value in changes.items():
        setattr(item, field, value)
    db.commit()
    return {"updated": True}


def delete_trip_item(user_id: int, item_id: int, *, db: Session) -> dict[str, bool]:
    item = require_owned_trip_item(db, user_id, item_id)
    db.delete(item)
    db.commit()
    return {"deleted": True}


def _validate_time_range(start_time, end_time) -> None:
    if start_time is not None and end_time is not None and end_time <= start_time:
        raise AppError(ErrorCode.INVALID_REQUEST, "end_time 必须晚于 start_time")


def _ensure_no_time_overlap(
    db: Session,
    *,
    trip_day_id: int,
    start_time,
    end_time,
    exclude_item_id: int | None = None,
) -> None:
    if start_time is None or end_time is None:
        return
    statement = select(TripItem).where(
        TripItem.trip_day_id == trip_day_id,
        TripItem.start_time.is_not(None),
        TripItem.end_time.is_not(None),
        TripItem.start_time < end_time,
        TripItem.end_time > start_time,
    )
    if exclude_item_id is not None:
        statement = statement.where(TripItem.id != exclude_item_id)
    if db.scalar(statement) is not None:
        raise AppError(ErrorCode.INVALID_REQUEST, "该时间段已有行程")

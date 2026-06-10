from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models.trip import Trip, TripDay, TripItem
from app.models.user import User


def require_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise AppError(ErrorCode.NOT_FOUND, "资源不存在")
    return user


def require_owned_trip(
    db: Session,
    user_id: int,
    trip_id: int,
    *,
    trashed: bool = False,
) -> Trip:
    deleted_filter = Trip.deleted_at.is_not(None) if trashed else Trip.deleted_at.is_(None)
    trip = db.scalar(
        select(Trip).where(
            Trip.id == trip_id,
            Trip.user_id == user_id,
            deleted_filter,
        )
    )
    if trip is None:
        raise AppError(ErrorCode.NOT_FOUND, "资源不存在")
    return trip


def require_owned_trip_day(db: Session, user_id: int, trip_day_id: int) -> TripDay:
    trip_day = db.scalar(
        select(TripDay)
        .join(Trip, Trip.id == TripDay.trip_id)
        .where(
            TripDay.id == trip_day_id,
            Trip.user_id == user_id,
            Trip.deleted_at.is_(None),
        )
    )
    if trip_day is None:
        raise AppError(ErrorCode.NOT_FOUND, "资源不存在")
    return trip_day


def require_owned_trip_item(db: Session, user_id: int, item_id: int) -> TripItem:
    item = db.scalar(
        select(TripItem)
        .join(TripDay, TripDay.id == TripItem.trip_day_id)
        .join(Trip, Trip.id == TripDay.trip_id)
        .where(
            TripItem.id == item_id,
            Trip.user_id == user_id,
            Trip.deleted_at.is_(None),
        )
    )
    if item is None:
        raise AppError(ErrorCode.NOT_FOUND, "资源不存在")
    return item

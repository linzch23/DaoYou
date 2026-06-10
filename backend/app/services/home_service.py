from datetime import date

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models.notification import Notification
from app.models.trip import Trip, TripDay, TripItem
from app.services.resource_service import require_user
from app.services.serializers import serialize_trip_item


def get_today_home(
    user_id: int,
    target_date: date | None = None,
    *,
    db: Session,
) -> dict[str, object]:
    require_user(db, user_id)
    query_date = target_date or date.today()
    trip = db.scalar(
        select(Trip)
        .where(
            Trip.user_id == user_id,
            Trip.deleted_at.is_(None),
            Trip.status == "active",
            Trip.start_date <= query_date,
            Trip.end_date >= query_date,
        )
        .order_by(case((Trip.status == "active", 0), else_=1), Trip.id)
    )
    if trip is None:
        raise AppError(ErrorCode.NOT_FOUND, "当前日期没有可用旅行")

    trip_day = db.scalar(
        select(TripDay).where(
            TripDay.trip_id == trip.id,
            TripDay.trip_date == query_date,
        )
    )
    items = (
        db.scalars(
            select(TripItem)
            .where(TripItem.trip_day_id == trip_day.id)
            .order_by(TripItem.start_time, TripItem.id)
        ).all()
        if trip_day is not None
        else []
    )
    unread_reminders = db.scalar(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.trip_id == trip.id,
            Notification.status == "unread",
        )
    )
    return {
        "trip_id": trip.id,
        "trip_title": trip.title,
        "date": query_date.isoformat(),
        "today_items": [serialize_trip_item(item) for item in items],
        "unread_reminders": int(unread_reminders or 0),
    }

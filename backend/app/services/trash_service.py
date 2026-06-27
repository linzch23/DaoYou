from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.trip import Trip
from app.services.resource_service import require_owned_trip, require_user
from app.services.serializers import serialize_trip_summary


def list_trashed_trips(user_id: int, *, db: Session) -> dict[str, list[dict[str, object]]]:
    require_user(db, user_id)
    trips = db.scalars(
        select(Trip)
        .where(Trip.user_id == user_id, Trip.deleted_at.is_not(None))
        .order_by(Trip.deleted_at.desc(), Trip.id.desc())
    ).all()
    # v0.6.0(per user-round4-2026-06-26 19:46 bug 修复):传 db=db 触发 itinerary_count subquery
    #   - 回收站列表虽然 deleted,但 itinerary_count 仍展示给 user(避免误删判断)
    #   - 与 list_trips 同步(per serializers.py:serialize_trip_summary 注释)
    return {"trips": [serialize_trip_summary(trip, db=db) for trip in trips]}


def restore_trashed_trip(user_id: int, trip_id: int, *, db: Session) -> dict[str, bool]:
    trip = require_owned_trip(db, user_id, trip_id, trashed=True)
    trip.deleted_at = None
    db.commit()
    return {"restored": True}


def permanently_delete_trashed_trip(
    user_id: int,
    trip_id: int,
    *,
    db: Session,
) -> dict[str, bool]:
    trip = require_owned_trip(db, user_id, trip_id, trashed=True)
    db.delete(trip)
    db.commit()
    return {"permanently_deleted": True}


def empty_trip_trash(user_id: int, *, db: Session) -> dict[str, int]:
    require_user(db, user_id)
    count = db.scalar(
        select(func.count(Trip.id)).where(
            Trip.user_id == user_id,
            Trip.deleted_at.is_not(None),
        )
    )
    db.execute(
        delete(Trip).where(
            Trip.user_id == user_id,
            Trip.deleted_at.is_not(None),
        )
    )
    db.commit()
    return {
        "permanently_deleted_count": int(count or 0),
        "file_cleanup_failed_count": 0,
    }

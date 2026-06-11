from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.graph import run_agent
from app.core.errors import AppError, ErrorCode
from app.models.trip import Trip
from app.schemas.reminders import ReminderCheckRequest
from app.services.resource_service import require_owned_trip, require_user
from app.services.trip_service import get_trip_detail

LOCATION_MAX_AGE = timedelta(minutes=30)


def check_reminders(payload: ReminderCheckRequest, *, db: Session) -> dict[str, object]:
    current_time = _as_utc(payload.current_time)
    trip_id = _resolve_trip_id(payload, target_date=payload.current_time.date(), db=db)
    current_location = _resolve_current_location(payload, current_time=current_time, db=db)
    agent_result = run_agent(
        {
            "user_id": payload.user_id,
            "trip_id": trip_id,
            "intent_hint": "reminder",
            "current_time": payload.current_time.isoformat(),
            "current_location": current_location,
            "current_trip": get_trip_detail(
                user_id=payload.user_id,
                trip_id=trip_id,
                db=db,
            ),
        }
    )
    structured_data = dict(agent_result.get("structured_data") or {})
    return {
        "has_risk": bool(structured_data.get("has_risk")),
        "reminder": structured_data.get("reminder"),
    }


def _resolve_trip_id(
    payload: ReminderCheckRequest,
    *,
    target_date: date,
    db: Session,
) -> int:
    if payload.trip_id is not None:
        return require_owned_trip(db, payload.user_id, payload.trip_id).id

    require_user(db, payload.user_id)
    trip = db.scalar(
        select(Trip)
        .where(
            Trip.user_id == payload.user_id,
            Trip.status == "active",
            Trip.deleted_at.is_(None),
            Trip.start_date <= target_date,
            Trip.end_date >= target_date,
        )
        .order_by(Trip.start_date, Trip.id)
    )
    if trip is None:
        raise AppError(ErrorCode.NOT_FOUND, "资源不存在")
    return trip.id


def _resolve_current_location(
    payload: ReminderCheckRequest,
    *,
    current_time: datetime,
    db: Session,
) -> dict[str, float]:
    if payload.current_location is not None:
        return payload.current_location.model_dump()

    user = require_user(db, payload.user_id)
    updated_at = _as_utc(user.location_updated_at) if user.location_updated_at else None
    if updated_at is None:
        return {}
    age = current_time - updated_at
    if age < -timedelta(minutes=5) or age > LOCATION_MAX_AGE:
        return {}
    return {
        "latitude": float(user.latitude),
        "longitude": float(user.longitude),
    }


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def list_reminders(
    user_id: int,
    trip_id: int,
    status: str | None = None,
    *,
    db: Session,
) -> dict[str, list[dict[str, object]]]:
    del db
    return {"reminders": []}

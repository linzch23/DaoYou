from datetime import datetime, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models.user import User
from app.schemas.locations import UpdateLocationRequest

MAX_FUTURE_SKEW = timedelta(minutes=5)
DISPLAY_TIMEZONE = ZoneInfo("Asia/Shanghai")


def update_user_location(
    payload: UpdateLocationRequest,
    *,
    db: Session,
) -> dict[str, object]:
    user = db.scalar(select(User).where(User.id == payload.user_id).with_for_update())
    if user is None:
        raise AppError(ErrorCode.NOT_FOUND, "资源不存在")

    try:
        sampled_at = datetime.fromtimestamp(payload.timestamp, tz=timezone.utc)
    except (OverflowError, OSError, ValueError) as exc:
        raise AppError(ErrorCode.INVALID_REQUEST, "位置采集时间无效") from exc
    if sampled_at > datetime.now(timezone.utc) + MAX_FUTURE_SKEW:
        raise AppError(ErrorCode.INVALID_REQUEST, "位置采集时间不能晚于服务器时间")

    current_sample = _as_utc(user.location_updated_at)
    current_timestamp = int(current_sample.timestamp()) if current_sample else None
    if current_timestamp is not None and payload.timestamp < current_timestamp:
        result = _location_response(user, updated=False, reason="stale_timestamp")
        db.commit()
        return result

    latitude = Decimal(str(payload.latitude))
    longitude = Decimal(str(payload.longitude))
    if current_timestamp == payload.timestamp:
        if user.latitude == latitude and user.longitude == longitude:
            result = _location_response(user, updated=False, reason="unchanged")
        else:
            result = _location_response(user, updated=False, reason="stale_timestamp")
        db.commit()
        return result

    user.latitude = latitude
    user.longitude = longitude
    user.location_updated_at = sampled_at
    db.commit()
    db.refresh(user)
    return _location_response(user, updated=True)


def _location_response(
    user: User,
    *,
    updated: bool,
    reason: str | None = None,
) -> dict[str, object]:
    result: dict[str, object] = {
        "updated": updated,
        "location": {
            "latitude": float(user.latitude),
            "longitude": float(user.longitude),
            "location_updated_at": _serialize_location_time(user.location_updated_at),
        },
    }
    if reason is not None:
        result["reason"] = reason
    return result


def _serialize_location_time(value: datetime | None) -> str | None:
    normalized = _as_utc(value)
    return normalized.astimezone(DISPLAY_TIMEZONE).isoformat() if normalized else None


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)

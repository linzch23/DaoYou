from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models.push_device import DevicePushToken
from app.schemas.push_devices import RegisterPushDeviceRequest
from app.services.resource_service import require_user


def register_push_device(
    payload: RegisterPushDeviceRequest,
    *,
    db: Session,
) -> dict[str, object]:
    require_user(db, payload.user_id)
    now = datetime.now(timezone.utc)
    device = db.scalar(
        select(DevicePushToken)
        .where(
            DevicePushToken.provider == "vivo",
            DevicePushToken.reg_id == payload.reg_id,
        )
        .with_for_update()
    )
    created = device is None
    if device is None:
        device = DevicePushToken(
            user_id=payload.user_id,
            provider="vivo",
            reg_id=payload.reg_id,
        )
        db.add(device)

    device.user_id = payload.user_id
    device.device_name = payload.device_name
    device.app_version = payload.app_version
    device.enabled = True
    device.invalidated_at = None
    device.last_seen_at = now
    device.updated_at = now
    db.commit()
    db.refresh(device)
    return {
        "device_id": device.id,
        "created": created,
        "enabled": device.enabled,
    }


def disable_push_device(
    *,
    user_id: int,
    reg_id: str,
    db: Session,
) -> dict[str, bool]:
    require_user(db, user_id)
    device = db.scalar(
        select(DevicePushToken)
        .where(
            DevicePushToken.user_id == user_id,
            DevicePushToken.provider == "vivo",
            DevicePushToken.reg_id == reg_id,
        )
        .with_for_update()
    )
    if device is None:
        raise AppError(ErrorCode.NOT_FOUND, "推送设备不存在")
    device.enabled = False
    device.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"disabled": True}

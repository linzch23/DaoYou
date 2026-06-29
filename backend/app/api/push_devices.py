from fastapi import APIRouter

from app.core.response import success
from app.db.session import DbSession
from app.schemas.push_devices import RegisterPushDeviceRequest
from app.services.push_device_service import disable_push_device, register_push_device

router = APIRouter()


@router.post("/devices")
def register_device(
    payload: RegisterPushDeviceRequest,
    db: DbSession,
) -> dict[str, object]:
    return success(register_push_device(payload, db=db))


@router.delete("/devices/{reg_id}")
def disable_device(
    reg_id: str,
    user_id: int,
    db: DbSession,
) -> dict[str, object]:
    return success(disable_push_device(user_id=user_id, reg_id=reg_id, db=db))

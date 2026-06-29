from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.push_device import DevicePushToken
from app.models.user import User
from app.schemas.push_devices import RegisterPushDeviceRequest
from app.services.push_device_service import disable_push_device, register_push_device


def test_register_push_device_is_idempotent(db: Session) -> None:
    db.add(User(id=1, nickname="演示用户"))
    db.commit()
    payload = RegisterPushDeviceRequest(
        user_id=1,
        reg_id="reg-1234567890",
        device_name="vivo X100",
        app_version="1.0.0",
    )

    first = register_push_device(payload, db=db)
    second = register_push_device(payload, db=db)

    devices = db.scalars(select(DevicePushToken)).all()
    assert len(devices) == 1
    assert first["device_id"] == second["device_id"]
    assert devices[0].enabled is True


def test_register_push_device_reenables_disabled_device(db: Session) -> None:
    db.add(User(id=1, nickname="演示用户"))
    db.commit()
    payload = RegisterPushDeviceRequest(user_id=1, reg_id="reg-1234567890")
    result = register_push_device(payload, db=db)
    disable_push_device(user_id=1, reg_id=payload.reg_id, db=db)

    register_push_device(payload, db=db)

    device = db.get(DevicePushToken, result["device_id"])
    assert device is not None
    assert device.enabled is True
    assert device.invalidated_at is None


def test_disable_push_device_preserves_record(db: Session) -> None:
    db.add(User(id=1, nickname="演示用户"))
    db.commit()
    payload = RegisterPushDeviceRequest(user_id=1, reg_id="reg-1234567890")
    result = register_push_device(payload, db=db)

    response = disable_push_device(user_id=1, reg_id=payload.reg_id, db=db)

    device = db.get(DevicePushToken, result["device_id"])
    assert response == {"disabled": True}
    assert device is not None
    assert device.enabled is False

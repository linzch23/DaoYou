from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models.user import User
from app.schemas.locations import UpdateLocationRequest
from app.services.location_service import update_user_location


def test_update_location_persists_latest_device_sample(db: Session) -> None:
    db.add(User(id=1, nickname="演示用户"))
    db.commit()
    sampled_at = datetime.now(timezone.utc) - timedelta(minutes=1)

    result = update_user_location(
        UpdateLocationRequest(
            user_id=1,
            latitude=31.2304,
            longitude=121.4737,
            timestamp=int(sampled_at.timestamp()),
        ),
        db=db,
    )

    user = db.get(User, 1)
    assert result["updated"] is True
    assert float(user.latitude) == pytest.approx(31.2304)
    assert float(user.longitude) == pytest.approx(121.4737)
    assert user.location_updated_at is not None
    assert result["location"]["location_updated_at"]


def test_stale_location_does_not_overwrite_newer_sample(db: Session) -> None:
    latest = datetime.now(timezone.utc) - timedelta(minutes=1)
    user = User(
        id=1,
        nickname="演示用户",
        latitude=Decimal("31.2305000"),
        longitude=Decimal("121.4738000"),
        location_updated_at=latest,
    )
    db.add(user)
    db.commit()

    result = update_user_location(
        UpdateLocationRequest(
            user_id=1,
            latitude=30.0,
            longitude=120.0,
            timestamp=int((latest - timedelta(minutes=5)).timestamp()),
        ),
        db=db,
    )

    db.refresh(user)
    assert result["updated"] is False
    assert result["reason"] == "stale_timestamp"
    assert float(user.latitude) == pytest.approx(31.2305)
    assert float(user.longitude) == pytest.approx(121.4738)


def test_duplicate_location_update_is_idempotent(db: Session) -> None:
    sampled_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    user = User(
        id=1,
        nickname="演示用户",
        latitude=Decimal("31.2304000"),
        longitude=Decimal("121.4737000"),
        location_updated_at=sampled_at,
    )
    db.add(user)
    db.commit()

    result = update_user_location(
        UpdateLocationRequest(
            user_id=1,
            latitude=31.2304,
            longitude=121.4737,
            timestamp=int(sampled_at.timestamp()),
        ),
        db=db,
    )

    assert result["updated"] is False
    assert result["reason"] == "unchanged"


def test_location_update_rejects_unknown_user_and_future_timestamp(db: Session) -> None:
    now = datetime.now(timezone.utc)

    with pytest.raises(AppError) as missing_user:
        update_user_location(
            UpdateLocationRequest(
                user_id=999,
                latitude=31.2304,
                longitude=121.4737,
                timestamp=int(now.timestamp()),
            ),
            db=db,
        )
    assert missing_user.value.code == ErrorCode.NOT_FOUND

    db.add(User(id=1, nickname="演示用户"))
    db.commit()
    with pytest.raises(AppError) as future_sample:
        update_user_location(
            UpdateLocationRequest(
                user_id=1,
                latitude=31.2304,
                longitude=121.4737,
                timestamp=int((now + timedelta(minutes=6)).timestamp()),
            ),
            db=db,
        )
    assert future_sample.value.code == ErrorCode.INVALID_REQUEST


def test_location_update_rejects_unrepresentable_timestamp(db: Session) -> None:
    db.add(User(id=1, nickname="演示用户"))
    db.commit()

    with pytest.raises(AppError) as invalid_sample:
        update_user_location(
            UpdateLocationRequest(
                user_id=1,
                latitude=31.2304,
                longitude=121.4737,
                timestamp=10**30,
            ),
            db=db,
        )

    assert invalid_sample.value.code == ErrorCode.INVALID_REQUEST

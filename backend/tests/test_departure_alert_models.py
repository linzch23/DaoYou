from app.models.departure_alert import DepartureAlert
from app.models.push_device import DevicePushToken
from app.models.trip import TripItem


def test_trip_item_has_arrival_tracking_columns() -> None:
    assert "arrived_at" in TripItem.__table__.c
    assert "arrival_distance_meters" in TripItem.__table__.c


def test_device_push_token_enforces_unique_provider_reg_id() -> None:
    unique_columns = {
        tuple(column.name for column in constraint.columns)
        for constraint in DevicePushToken.__table__.constraints
        if constraint.__class__.__name__ == "UniqueConstraint"
    }

    assert ("provider", "reg_id") in unique_columns


def test_departure_alert_enforces_one_level_per_trip_item() -> None:
    unique_columns = {
        tuple(column.name for column in constraint.columns)
        for constraint in DepartureAlert.__table__.constraints
        if constraint.__class__.__name__ == "UniqueConstraint"
    }

    assert ("trip_item_id", "level") in unique_columns
    assert ("request_id",) in unique_columns

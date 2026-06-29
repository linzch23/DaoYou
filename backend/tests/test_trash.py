import pytest
from pydantic import ValidationError

from app.main import app
from app.models.departure_alert import DepartureAlert
from app.models.trip import Trip, TripDay, TripItem
from app.schemas.trips import UpdateTripRequest


def test_trip_model_has_deleted_at_column() -> None:
    assert "deleted_at" in Trip.__table__.columns
    assert Trip.__table__.c.deleted_at.type.timezone is True


def test_trash_routes_are_registered() -> None:
    route_methods = {
        (getattr(route, "path", None), method)
        for route in app.routes
        for method in getattr(route, "methods", set())
    }

    assert ("/api/trash/trips", "GET") in route_methods
    assert ("/api/trash/trips/{trip_id}/restore", "POST") in route_methods
    assert ("/api/trash/trips/{trip_id}", "DELETE") in route_methods
    assert ("/api/trash/trips", "DELETE") in route_methods


def test_update_trip_request_rejects_deleted_status() -> None:
    with pytest.raises(ValidationError):
        UpdateTripRequest(user_id=1, status="deleted")


def test_trip_related_foreign_keys_use_delete_cascade() -> None:
    foreign_key_columns = [
        TripDay.__table__.c.trip_id,
        TripItem.__table__.c.trip_day_id,
        DepartureAlert.__table__.c.trip_id,
    ]

    for column in foreign_key_columns:
        foreign_key = next(iter(column.foreign_keys))
        assert foreign_key.ondelete == "CASCADE"


def test_departure_alert_model_uses_delivery_state_table() -> None:
    assert DepartureAlert.__tablename__ == "departure_alerts"

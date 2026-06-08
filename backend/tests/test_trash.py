import pytest
from pydantic import ValidationError

from app.api.trips import delete_trip_endpoint
from app.main import app
from app.models.chat import ChatMessage
from app.models.notification import Notification
from app.models.photo import PhotoRecord
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


def test_trash_service_skeleton_responses() -> None:
    from app.services.trash_service import (
        empty_trip_trash,
        list_trashed_trips,
        permanently_delete_trashed_trip,
        restore_trashed_trip,
    )

    assert list_trashed_trips(user_id=1) == {"trips": []}
    assert restore_trashed_trip(user_id=1, trip_id=1) == {"restored": True}
    assert permanently_delete_trashed_trip(user_id=1, trip_id=1) == {
        "permanently_deleted": True
    }
    assert empty_trip_trash(user_id=1) == {
        "permanently_deleted_count": 0,
        "file_cleanup_failed_count": 0,
    }


def test_delete_trip_endpoint_returns_deleted_at() -> None:
    response = delete_trip_endpoint(trip_id=1, user_id=1)

    assert response["data"]["deleted"] is True
    assert response["data"]["deleted_at"] == "2026-06-04T10:00:00+08:00"


def test_update_trip_request_rejects_deleted_status() -> None:
    with pytest.raises(ValidationError):
        UpdateTripRequest(user_id=1, status="deleted")


def test_trip_related_foreign_keys_use_delete_cascade() -> None:
    foreign_key_columns = [
        TripDay.__table__.c.trip_id,
        TripItem.__table__.c.trip_day_id,
        ChatMessage.__table__.c.trip_id,
        PhotoRecord.__table__.c.trip_id,
        Notification.__table__.c.trip_id,
    ]

    for column in foreign_key_columns:
        foreign_key = next(iter(column.foreign_keys))
        assert foreign_key.ondelete == "CASCADE"

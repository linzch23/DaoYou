from datetime import date, time

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.photos import parse_location_form
from app.main import app
from app.models.trip import Trip, TripDay, TripItem
from app.models.user import User
from app.schemas.chat import ChatRequest
from app.schemas.common import Location
from app.schemas.reminders import ReminderCheckRequest
from app.schemas.trips import CreateTripItemRequest, CreateTripRequest, UpdateTripItemRequest
from app.services.chat_service import send_chat_message


def test_trip_city_is_owned_by_trip_item() -> None:
    assert "city" not in Trip.__table__.columns
    assert "city" in TripItem.__table__.columns
    assert "city" not in CreateTripRequest.model_fields
    assert CreateTripItemRequest.model_fields["city"].is_required()
    assert UpdateTripItemRequest.model_fields["city"].default is None


def test_create_trip_item_requires_city() -> None:
    with pytest.raises(ValidationError):
        CreateTripItemRequest(
            user_id=1,
            trip_day_id=1,
            title="渔人码头",
        )


def test_independent_replan_routes_are_not_registered() -> None:
    paths = {getattr(route, "path", None) for route in app.routes}

    assert "/api/trips/{trip_id}/replan" not in paths
    assert "/api/trips/{trip_id}/apply-plan" not in paths


def test_location_route_and_user_columns_are_registered() -> None:
    route_methods = {
        (getattr(route, "path", None), method)
        for route in app.routes
        for method in getattr(route, "methods", set())
    }

    assert ("/api/location", "PUT") in route_methods
    assert "latitude" in User.__table__.columns
    assert "longitude" in User.__table__.columns
    assert "location_updated_at" in User.__table__.columns


def test_reminder_current_time_requires_timezone() -> None:
    with pytest.raises(ValidationError):
        ReminderCheckRequest(
            user_id=1,
            current_time="2026-06-11T09:20:00",
        )


def test_chat_replan_returns_action_options(db: Session) -> None:
    db.add(User(id=1, nickname="演示用户"))
    db.flush()
    trip = Trip(
        user_id=1,
        title="大连三日游",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 3),
        status="active",
    )
    db.add(trip)
    db.flush()
    day = TripDay(
        trip_id=trip.id,
        day_index=1,
        trip_date=date(2026, 7, 1),
    )
    db.add(day)
    db.flush()
    item = TripItem(
        trip_day_id=day.id,
        city="大连",
        title="贝壳博物馆",
        start_time=time(14, 30),
        end_time=time(16, 0),
        status="planned",
    )
    db.add(item)
    db.commit()
    response = send_chat_message(
        ChatRequest(
            user_id=1,
            trip_id=trip.id,
            message="我累了，不想去下一个景点，帮我换一个轻松点的安排。",
            current_location=Location(latitude=38.92, longitude=121.64),
        ),
        db=db,
    )

    assert response["intent"] == "replan"
    assert response["action_options"]
    assert response["action_options"][0]["operation"] == "update_trip_item"
    assert response["action_options"][0]["item_id"] == item.id


def test_photo_location_uses_shared_location_shape() -> None:
    location = parse_location_form('{"latitude":38.92,"longitude":121.64}')

    assert location == Location(latitude=38.92, longitude=121.64)

    with pytest.raises(HTTPException) as exc_info:
        parse_location_form('{"latitude":"invalid","longitude":121.64}')

    assert exc_info.value.status_code == 422

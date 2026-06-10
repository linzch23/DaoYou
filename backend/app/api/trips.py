from typing import Literal

from fastapi import APIRouter

from app.core.response import success
from app.db.session import DbSession
from app.schemas.trips import (
    CreateTripDayRequest,
    CreateTripItemRequest,
    CreateTripRequest,
    UpdateTripItemRequest,
    UpdateTripRequest,
)
from app.services.trip_service import (
    create_trip,
    create_trip_day,
    create_trip_item,
    delete_trip,
    delete_trip_item,
    get_trip_detail,
    list_trips,
    update_trip,
    update_trip_item,
)

router = APIRouter()


@router.post("/trips")
def create_trip_endpoint(
    payload: CreateTripRequest,
    db: DbSession,
) -> dict[str, object]:
    return success(create_trip(payload, db=db))


@router.get("/trips")
def list_trips_endpoint(
    user_id: int,
    db: DbSession,
    status: Literal["draft", "active", "finished"] | None = None,
) -> dict[str, object]:
    return success(list_trips(user_id=user_id, status=status, db=db))


@router.get("/trips/{trip_id}")
def get_trip_endpoint(
    trip_id: int,
    user_id: int,
    db: DbSession,
) -> dict[str, object]:
    return success(get_trip_detail(user_id=user_id, trip_id=trip_id, db=db))


@router.put("/trips/{trip_id}")
def update_trip_endpoint(
    trip_id: int,
    payload: UpdateTripRequest,
    db: DbSession,
) -> dict[str, object]:
    return success(update_trip(trip_id=trip_id, payload=payload, db=db))


@router.delete("/trips/{trip_id}")
def delete_trip_endpoint(
    trip_id: int,
    user_id: int,
    db: DbSession,
) -> dict[str, object]:
    return success(delete_trip(user_id=user_id, trip_id=trip_id, db=db))


@router.post("/trips/{trip_id}/days")
def create_trip_day_endpoint(
    trip_id: int,
    payload: CreateTripDayRequest,
    db: DbSession,
) -> dict[str, object]:
    return success(create_trip_day(trip_id=trip_id, payload=payload, db=db))


@router.post("/trip-items")
def create_trip_item_endpoint(
    payload: CreateTripItemRequest,
    db: DbSession,
) -> dict[str, object]:
    return success(create_trip_item(payload, db=db))


@router.put("/trip-items/{item_id}")
def update_trip_item_endpoint(
    item_id: int,
    payload: UpdateTripItemRequest,
    db: DbSession,
) -> dict[str, object]:
    return success(update_trip_item(item_id=item_id, payload=payload, db=db))


@router.delete("/trip-items/{item_id}")
def delete_trip_item_endpoint(
    item_id: int,
    user_id: int,
    db: DbSession,
) -> dict[str, object]:
    return success(delete_trip_item(user_id=user_id, item_id=item_id, db=db))

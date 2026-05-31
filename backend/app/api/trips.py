from fastapi import APIRouter

from app.core.response import success
from app.schemas.trips import (
    ApplyPlanRequest,
    CreateTripDayRequest,
    CreateTripItemRequest,
    CreateTripRequest,
    ReplanRequest,
    UpdateTripItemRequest,
    UpdateTripRequest,
)
from app.services.replan_service import apply_replan_draft, create_replan_draft
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
def create_trip_endpoint(payload: CreateTripRequest) -> dict[str, object]:
    return success(create_trip(payload))


@router.get("/trips")
def list_trips_endpoint(user_id: int, status: str | None = None) -> dict[str, object]:
    return success(list_trips(user_id=user_id, status=status))


@router.get("/trips/{trip_id}")
def get_trip_endpoint(trip_id: int, user_id: int) -> dict[str, object]:
    return success(get_trip_detail(user_id=user_id, trip_id=trip_id))


@router.put("/trips/{trip_id}")
def update_trip_endpoint(trip_id: int, payload: UpdateTripRequest) -> dict[str, object]:
    return success(update_trip(trip_id=trip_id, payload=payload))


@router.delete("/trips/{trip_id}")
def delete_trip_endpoint(trip_id: int, user_id: int) -> dict[str, object]:
    return success(delete_trip(user_id=user_id, trip_id=trip_id))


@router.post("/trips/{trip_id}/days")
def create_trip_day_endpoint(trip_id: int, payload: CreateTripDayRequest) -> dict[str, object]:
    return success(create_trip_day(trip_id=trip_id, payload=payload))


@router.post("/trip-items")
def create_trip_item_endpoint(payload: CreateTripItemRequest) -> dict[str, object]:
    return success(create_trip_item(payload))


@router.put("/trip-items/{item_id}")
def update_trip_item_endpoint(item_id: int, payload: UpdateTripItemRequest) -> dict[str, object]:
    return success(update_trip_item(item_id=item_id, payload=payload))


@router.delete("/trip-items/{item_id}")
def delete_trip_item_endpoint(item_id: int, user_id: int) -> dict[str, object]:
    return success(delete_trip_item(user_id=user_id, item_id=item_id))


@router.post("/trips/{trip_id}/replan")
def create_replan_endpoint(trip_id: int, payload: ReplanRequest) -> dict[str, object]:
    return success(create_replan_draft(trip_id=trip_id, payload=payload))


@router.post("/trips/{trip_id}/apply-plan")
def apply_plan_endpoint(trip_id: int, payload: ApplyPlanRequest) -> dict[str, object]:
    return success(apply_replan_draft(trip_id=trip_id, payload=payload))


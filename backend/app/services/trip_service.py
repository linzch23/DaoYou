from app.schemas.trips import (
    CreateTripDayRequest,
    CreateTripItemRequest,
    CreateTripRequest,
    UpdateTripItemRequest,
    UpdateTripRequest,
)


def create_trip(payload: CreateTripRequest) -> dict[str, int]:
    return {"trip_id": 1}


def list_trips(user_id: int, status: str | None = None) -> dict[str, list[dict[str, object]]]:
    return {"trips": []}


def get_trip_detail(user_id: int, trip_id: int) -> dict[str, object]:
    return {
        "id": trip_id,
        "title": "大连三日游",
        "city": "大连",
        "start_date": "2026-07-01",
        "end_date": "2026-07-03",
        "status": "active",
        "days": [],
    }


def update_trip(trip_id: int, payload: UpdateTripRequest) -> dict[str, bool]:
    return {"updated": True}


def delete_trip(user_id: int, trip_id: int) -> dict[str, bool]:
    return {"deleted": True}


def create_trip_day(trip_id: int, payload: CreateTripDayRequest) -> dict[str, int]:
    return {"trip_day_id": 1}


def create_trip_item(payload: CreateTripItemRequest) -> dict[str, int]:
    return {"item_id": 1}


def update_trip_item(item_id: int, payload: UpdateTripItemRequest) -> dict[str, bool]:
    return {"updated": True}


def delete_trip_item(user_id: int, item_id: int) -> dict[str, bool]:
    return {"deleted": True}


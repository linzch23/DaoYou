from fastapi import APIRouter

from app.core.response import success
from app.db.session import DbSession
from app.schemas.trash import RestoreTrashTripRequest
from app.services.trash_service import (
    empty_trip_trash,
    list_trashed_trips,
    permanently_delete_trashed_trip,
    restore_trashed_trip,
)

router = APIRouter()


@router.get("/trips")
def list_trashed_trips_endpoint(
    user_id: int,
    db: DbSession,
) -> dict[str, object]:
    return success(list_trashed_trips(user_id=user_id, db=db))


@router.post("/trips/{trip_id}/restore")
def restore_trashed_trip_endpoint(
    trip_id: int,
    payload: RestoreTrashTripRequest,
    db: DbSession,
) -> dict[str, object]:
    return success(restore_trashed_trip(user_id=payload.user_id, trip_id=trip_id, db=db))


@router.delete("/trips/{trip_id}")
def permanently_delete_trashed_trip_endpoint(
    trip_id: int,
    user_id: int,
    db: DbSession,
) -> dict[str, object]:
    return success(permanently_delete_trashed_trip(user_id=user_id, trip_id=trip_id, db=db))


@router.delete("/trips")
def empty_trip_trash_endpoint(
    user_id: int,
    db: DbSession,
) -> dict[str, object]:
    return success(empty_trip_trash(user_id=user_id, db=db))

from fastapi import APIRouter

from app.core.response import success
from app.db.session import DbSession
from app.schemas.locations import UpdateLocationRequest
from app.services.location_service import update_user_location

router = APIRouter()


@router.put("")
def update_location(payload: UpdateLocationRequest, db: DbSession) -> dict[str, object]:
    return success(update_user_location(payload, db=db))

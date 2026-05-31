from fastapi import APIRouter

from app.core.response import success
from app.services.home_service import get_today_home

router = APIRouter()


@router.get("/today")
def read_today_home(user_id: int, trip_id: int, date: str | None = None) -> dict[str, object]:
    return success(get_today_home(user_id=user_id, trip_id=trip_id, date=date))


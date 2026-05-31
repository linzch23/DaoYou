from fastapi import APIRouter

from app.core.response import success
from app.schemas.reminders import ReminderCheckRequest
from app.services.reminder_service import check_reminders, list_reminders

router = APIRouter()


@router.post("/check")
def check(payload: ReminderCheckRequest) -> dict[str, object]:
    return success(check_reminders(payload))


@router.get("")
def list_endpoint(user_id: int, trip_id: int, status: str | None = None) -> dict[str, object]:
    return success(list_reminders(user_id=user_id, trip_id=trip_id, status=status))


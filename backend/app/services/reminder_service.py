from app.schemas.reminders import ReminderCheckRequest


def check_reminders(payload: ReminderCheckRequest) -> dict[str, object]:
    return {"has_risk": False, "reminder": None}


def list_reminders(
    user_id: int,
    trip_id: int,
    status: str | None = None,
) -> dict[str, list[dict[str, object]]]:
    return {"reminders": []}


from pydantic import BaseModel


class ReminderCheckRequest(BaseModel):
    user_id: int
    trip_id: int
    current_time: str
    current_location: dict[str, float] | None = None


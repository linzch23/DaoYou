from pydantic import BaseModel

from app.schemas.common import Location


class ReminderCheckRequest(BaseModel):
    user_id: int
    trip_id: int
    current_time: str
    current_location: Location | None = None

from datetime import datetime

from pydantic import BaseModel, field_validator

from app.schemas.common import Location


class ReminderCheckRequest(BaseModel):
    user_id: int
    trip_id: int | None = None
    current_time: datetime
    current_location: Location | None = None

    @field_validator("current_time")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("current_time must include timezone information")
        return value

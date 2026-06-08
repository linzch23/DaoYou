from pydantic import BaseModel

from app.schemas.common import Location


class ChatRequest(BaseModel):
    user_id: int
    trip_id: int
    message: str
    current_location: Location | None = None

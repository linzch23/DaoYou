from pydantic import BaseModel


class ChatRequest(BaseModel):
    user_id: int
    trip_id: int
    message: str
    current_location: dict[str, float] | None = None


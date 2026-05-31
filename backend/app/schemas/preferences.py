from pydantic import BaseModel


class UpdatePreferencesRequest(BaseModel):
    user_id: int
    preferences: dict[str, object]


class MemorySummaryRequest(BaseModel):
    user_id: int
    trip_id: int


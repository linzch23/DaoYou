from pydantic import BaseModel, Field


class UpdateLocationRequest(BaseModel):
    user_id: int
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    timestamp: int = Field(gt=0)

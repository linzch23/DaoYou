from pydantic import BaseModel


class CreateTripRequest(BaseModel):
    user_id: int
    title: str
    city: str
    start_date: str
    end_date: str


class UpdateTripRequest(BaseModel):
    user_id: int
    title: str | None = None
    status: str | None = None


class CreateTripDayRequest(BaseModel):
    user_id: int
    day_index: int
    trip_date: str
    summary: str | None = None


class CreateTripItemRequest(BaseModel):
    user_id: int
    trip_day_id: int
    title: str
    item_type: str = "attraction"
    start_time: str | None = None
    end_time: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None


class UpdateTripItemRequest(BaseModel):
    user_id: int
    title: str | None = None
    item_type: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    status: str | None = None
    notes: str | None = None


class ReplanRequest(BaseModel):
    user_id: int
    message: str
    current_location: dict[str, float] | None = None


class ApplyPlanRequest(BaseModel):
    user_id: int
    draft_id: str


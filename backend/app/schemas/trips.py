from typing import Literal

from pydantic import BaseModel


class CreateTripRequest(BaseModel):
    user_id: int
    title: str
    start_date: str
    end_date: str


class UpdateTripRequest(BaseModel):
    user_id: int
    title: str | None = None
    status: Literal["draft", "active", "finished"] | None = None


class CreateTripDayRequest(BaseModel):
    user_id: int
    day_index: int
    trip_date: str
    summary: str | None = None


class CreateTripItemRequest(BaseModel):
    user_id: int
    trip_day_id: int
    city: str
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
    city: str | None = None
    title: str | None = None
    item_type: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    status: str | None = None
    notes: str | None = None

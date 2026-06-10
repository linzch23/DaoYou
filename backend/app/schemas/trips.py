from datetime import date, time
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class CreateTripRequest(BaseModel):
    user_id: int
    title: str = Field(min_length=1, max_length=200)
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def validate_date_range(self) -> "CreateTripRequest":
        if self.end_date < self.start_date:
            raise ValueError("end_date cannot be earlier than start_date")
        return self


class UpdateTripRequest(BaseModel):
    user_id: int
    title: str | None = None
    status: Literal["draft", "active", "finished"] | None = None


class CreateTripDayRequest(BaseModel):
    user_id: int
    day_index: int = Field(ge=1)
    trip_date: date
    summary: str | None = None


class CreateTripItemRequest(BaseModel):
    user_id: int
    trip_day_id: int
    city: str
    title: str
    item_type: str = "attraction"
    start_time: time | None = None
    end_time: time | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None


class UpdateTripItemRequest(BaseModel):
    user_id: int
    city: str | None = None
    title: str | None = None
    item_type: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    status: Literal["planned", "done", "skipped", "changed"] | None = None
    notes: str | None = None

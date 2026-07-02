from datetime import date, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class CreateTripRequest(BaseModel):
    user_id: int
    title: str = Field(min_length=1, max_length=200)
    start_date: date
    end_date: date
    # v0.5.0(2026-06-26 per user-round3「首页不显示草稿」修复)草稿推上后端触发:
    # NewTripPage.onDialogSave 调 createTrip({...status: 'draft'});
    # 默认 'draft' 兼容老调用方;MVP 简化,**不**额外触发 Trip.status default 行为
    # (Trip 模型 status 字段已 default='draft',沿用 backend/app/models/trip.py:18)
    status: Literal["draft", "active", "finished"] | None = "draft"

    @model_validator(mode="after")
    def validate_date_range(self) -> "CreateTripRequest":
        if self.end_date < self.start_date:
            raise ValueError("end_date cannot be earlier than start_date")
        return self


class UpdateTripRequest(BaseModel):
    user_id: int
    title: str | None = None
    status: Literal["draft", "active", "finished"] | None = None
    # v0.5.0(per user-round3-2026-06-26)草稿支持改时间:加 2 字段
    # MVP 简化:不 cascade 改 day.trip_date,接受数据不一致(后续 IssueManager 提议补 day 重新分配)
    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode="after")
    def validate_date_range(self) -> "UpdateTripRequest":
        if self.start_date is not None and self.end_date is not None:
            if self.end_date < self.start_date:
                raise ValueError("end_date cannot be earlier than start_date")
        return self


class CreateTripDayRequest(BaseModel):
    user_id: int
    day_index: int = Field(ge=1)
    trip_date: date
    summary: str | None = None


class CreateTripItemRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: int
    trip_day_id: int
    city: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=200)
    item_type: str = "attraction"
    start_time: time | None = None
    end_time: time | None = None
    address: str | None = None
    notes: str | None = None

    @field_validator("city", "title")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("address")
    @classmethod
    def strip_optional_address(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class UpdateTripItemRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: int
    city: str | None = Field(default=None, min_length=1, max_length=100)
    title: str | None = Field(default=None, min_length=1, max_length=200)
    item_type: str | None = None
    start_time: time | None = None
    end_time: time | None = None
    address: str | None = None
    status: Literal["planned", "done", "skipped", "changed"] | None = None
    notes: str | None = None

    @field_validator("city", "title")
    @classmethod
    def strip_optional_required_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("address")
    @classmethod
    def strip_update_address(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class ParseTripRequest(BaseModel):
    user_id: int
    text: str = Field(min_length=1, max_length=2000)
    current_date: date
    timezone: str = Field(default="Asia/Shanghai", max_length=100)


class ParsedTripItem(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    city: str | None = Field(default=None, max_length=100)
    item_type: str | None = Field(default=None, max_length=50)
    trip_date: date | None = None
    time_period: Literal[
        "early_morning", "morning", "noon", "afternoon", "evening", "night"
    ] | None = None
    start_time: time | None = None
    end_time: time | None = None
    address: str | None = Field(default=None, max_length=300)
    notes: str | None = None
    source_quote: str | None = Field(default=None, max_length=300)


class ParsedTripDraft(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    start_date: date | None = None
    end_date: date | None = None
    items: list[ParsedTripItem] = Field(default_factory=list, max_length=100)
    warnings: list[str] = Field(default_factory=list, max_length=20)


class CreateTripDraftItemRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    city: str = Field(min_length=1, max_length=100)
    item_type: str = Field(default="attraction", max_length=50)
    start_time: time | None = None
    end_time: time | None = None
    address: str | None = Field(default=None, max_length=300)
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None


class CreateTripDraftDayRequest(BaseModel):
    day_index: int = Field(ge=1)
    trip_date: date
    summary: str | None = Field(default=None, max_length=300)
    items: list[CreateTripDraftItemRequest] = Field(default_factory=list, max_length=100)


class CreateTripFromDraftRequest(CreateTripRequest):
    idempotency_key: str = Field(min_length=8, max_length=100)
    days: list[CreateTripDraftDayRequest] = Field(default_factory=list, max_length=100)

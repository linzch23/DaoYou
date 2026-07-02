from typing import Literal

from pydantic import BaseModel, Field, field_validator


class DietaryPreferences(BaseModel):
    likes: list[str] = Field(default_factory=list, max_length=20)
    avoid: list[str] = Field(default_factory=list, max_length=20)
    allergies: list[str] = Field(default_factory=list, max_length=20)


class BudgetPreferences(BaseModel):
    daily_amount: float | None = Field(default=None, gt=0, le=1_000_000)
    currency: Literal["CNY", "USD", "EUR", "JPY", "GBP"] = "CNY"


class SchedulePreferences(BaseModel):
    earliest_start_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    latest_end_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    needs_nap: bool = False


class TransportPreferences(BaseModel):
    preferred: list[Literal["walking", "public_transit", "taxi", "driving", "cycling"]] = (
        Field(default_factory=list, max_length=5)
    )
    avoid: list[Literal["walking", "public_transit", "taxi", "driving", "cycling"]] = Field(
        default_factory=list,
        max_length=5,
    )


class CompanionPreferences(BaseModel):
    children: bool = False
    elderly: bool = False
    wheelchair_user: bool = False
    pet: bool = False


class CustomPreferences(BaseModel):
    dietary: DietaryPreferences = Field(default_factory=DietaryPreferences)
    budget: BudgetPreferences = Field(default_factory=BudgetPreferences)
    schedule: SchedulePreferences = Field(default_factory=SchedulePreferences)
    transport: TransportPreferences = Field(default_factory=TransportPreferences)
    companions: CompanionPreferences = Field(default_factory=CompanionPreferences)
    must_visit: list[str] = Field(default_factory=list, max_length=20)
    avoid_places: list[str] = Field(default_factory=list, max_length=20)


class UpdatePreferencesRequest(BaseModel):
    user_id: int
    preferences: dict[str, object]

    @field_validator("preferences")
    @classmethod
    def validate_preferences(cls, value: dict[str, object]) -> dict[str, object]:
        allowed = {
            "explanation_style",
            "travel_pace",
            "interests",
            "special_needs",
            "custom_instructions",
            "custom_preferences",
        }
        if unknown := set(value) - allowed:
            raise ValueError(f"unsupported preference fields: {sorted(unknown)}")
        text = value.get("custom_instructions")
        if text is not None:
            if not isinstance(text, str) or len(text.strip()) > 500:
                raise ValueError("custom_instructions must be a string of at most 500 characters")
            value["custom_instructions"] = text.strip()
        if "custom_preferences" in value:
            value["custom_preferences"] = CustomPreferences.model_validate(
                value["custom_preferences"] or {}
            ).model_dump(mode="json")
        if value.get("custom_instructions") and "custom_preferences" not in value:
            raise ValueError("custom preferences must be parsed and confirmed before saving")
        return value


class MemorySummaryRequest(BaseModel):
    user_id: int
    trip_id: int


class UpdateMemorySettingsRequest(BaseModel):
    user_id: int
    enabled: bool


class ParseCustomPreferencesRequest(BaseModel):
    user_id: int = Field(gt=0)
    text: str = Field(min_length=1, max_length=500)
    current_preferences: dict[str, object] = Field(default_factory=dict)


from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AgentIntent(str, Enum):
    CHAT = "chat"
    PHOTO_EXPLAIN = "photo_explain"
    REMINDER = "reminder"
    REPLAN = "replan"


class AgentInput(BaseModel):
    """Validated boundary input while keeping LangGraph's extensible internal state."""

    model_config = ConfigDict(extra="allow")

    user_id: int | None = Field(default=None, gt=0)
    trip_id: int | None = Field(default=None, gt=0)
    user_message: str = ""
    intent_hint: str = ""
    current_time: str = ""
    current_trip: dict[str, Any] = Field(default_factory=dict)
    current_location: dict[str, float] = Field(default_factory=dict)
    user_preferences: dict[str, Any] = Field(default_factory=dict)
    long_term_memories: list[dict[str, Any]] = Field(default_factory=list)
    chat_history: list[dict[str, Any]] = Field(default_factory=list)
    image_info: dict[str, Any] = Field(default_factory=dict)


class ClarificationOption(BaseModel):
    option_id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    message: str = Field(min_length=1)


class IntentClassification(BaseModel):
    intent: AgentIntent
    confidence: float = Field(ge=0, le=1)
    reason: str = ""
    source: str = "rules"
    matched_features: list[str] = Field(default_factory=list)


class MemoryCandidate(BaseModel):
    memory_type: str = Field(min_length=1, max_length=50)
    memory_key: str = Field(min_length=1, max_length=100)
    value: str | bool
    description: str = Field(min_length=1, max_length=500)
    confidence: float = Field(ge=0, le=1)
    evidence_kind: str = "explicit_statement"


class AgentResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    intent: AgentIntent = AgentIntent.CHAT
    reply: str
    action_options: list[dict[str, Any]] = Field(default_factory=list)
    structured_data: dict[str, Any] = Field(default_factory=dict)
    follow_up_questions: list[str] = Field(default_factory=list, max_length=5)
    clarification_options: list[ClarificationOption] = Field(default_factory=list, max_length=5)
    memory_candidates: list[MemoryCandidate] = Field(default_factory=list)
    error: str | None = None

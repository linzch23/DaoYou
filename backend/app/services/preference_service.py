from app.schemas.preferences import (
    MemorySummaryRequest,
    UpdatePreferencesRequest,
)

DEFAULT_PREFERENCES = {
    "explanation_style": "fun",
    "travel_pace": "slow",
    "interests": ["history", "photo"],
    "special_needs": ["less_walking"],
}


def get_preferences(user_id: int) -> dict[str, dict[str, object]]:
    return {"preferences": DEFAULT_PREFERENCES}


def update_preferences(payload: UpdatePreferencesRequest) -> dict[str, bool]:
    return {"updated": True}


def summarize_memory(payload: MemorySummaryRequest) -> dict[str, object]:
    return {"updated": True, "memories": []}

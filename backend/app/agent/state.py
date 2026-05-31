from typing import TypedDict


class AgentState(TypedDict, total=False):
    user_id: int
    trip_id: int
    user_message: str
    intent_hint: str
    current_trip: dict[str, object]
    current_location: dict[str, float]
    user_preferences: dict[str, object]
    chat_history: list[dict[str, object]]
    image_info: dict[str, object]
    intent: str
    final_response: dict[str, object]


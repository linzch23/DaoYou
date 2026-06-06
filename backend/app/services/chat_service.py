from app.agent.graph import run_agent
from app.schemas.chat import ChatRequest
from app.services.preference_service import DEFAULT_PREFERENCES
from app.services.trip_service import get_trip_detail


def send_chat_message(payload: ChatRequest) -> dict[str, object]:
    # 成员 C 接入点：把聊天请求组装成 AgentState，具体推理统一交给 run_agent。
    agent_result = run_agent(
        {
            "user_id": payload.user_id,
            "trip_id": payload.trip_id,
            "user_message": payload.message,
            "intent_hint": "chat",
            "current_location": payload.current_location or {},
            "current_trip": get_trip_detail(user_id=payload.user_id, trip_id=payload.trip_id),
            "user_preferences": DEFAULT_PREFERENCES,
            "chat_history": [],
        }
    )
    return {
        "reply": agent_result["reply"],
        "intent": agent_result["intent"],
        "follow_up_questions": agent_result["follow_up_questions"],
    }


def get_chat_history(
    user_id: int,
    trip_id: int,
    limit: int = 20,
) -> dict[str, list[dict[str, object]]]:
    return {"messages": []}

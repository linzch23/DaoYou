from sqlalchemy.orm import Session

from app.agent.graph import run_agent
from app.schemas.chat import ChatRequest
from app.services.preference_service import DEFAULT_PREFERENCES
from app.services.trip_service import get_trip_detail


def send_chat_message(payload: ChatRequest, *, db: Session) -> dict[str, object]:
    # 成员 C 接入点：把聊天请求组装成 AgentState，具体推理统一交给 run_agent。
    agent_result = run_agent(
        {
            "user_id": payload.user_id,
            "trip_id": payload.trip_id,
            "user_message": payload.message,
            "current_location": (
                payload.current_location.model_dump() if payload.current_location else {}
            ),
            "current_trip": get_trip_detail(
                user_id=payload.user_id,
                trip_id=payload.trip_id,
                db=db,
            ),
            "user_preferences": DEFAULT_PREFERENCES,
            "chat_history": [],
        }
    )
    return {
        "reply": agent_result["reply"],
        "intent": agent_result["intent"],
        "action_options": agent_result["action_options"],
        "follow_up_questions": agent_result["follow_up_questions"],
    }


def get_chat_history(
    user_id: int,
    trip_id: int,
    limit: int = 20,
    *,
    db: Session,
) -> dict[str, list[dict[str, object]]]:
    del db
    return {"messages": []}

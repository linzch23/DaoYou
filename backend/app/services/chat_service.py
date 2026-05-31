from app.schemas.chat import ChatRequest


def send_chat_message(payload: ChatRequest) -> dict[str, object]:
    return {
        "reply": "后端骨架已接收消息，Agent 接入后会返回结合行程和偏好的回复。",
        "intent": "chat",
        "follow_up_questions": [],
    }


def get_chat_history(
    user_id: int,
    trip_id: int,
    limit: int = 20,
) -> dict[str, list[dict[str, object]]]:
    return {"messages": []}

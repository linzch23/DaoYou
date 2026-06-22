from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.graph import run_agent
from app.models.chat import ChatMessage
from app.schemas.chat import ChatRequest
from app.services.preference_service import get_preferences
from app.services.resource_service import require_user
from app.services.trip_service import get_trip_detail


def _serialize_message(message: ChatMessage) -> dict[str, object]:
    return {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "created_at": message.created_at.isoformat(),
    }


def _load_recent_messages(
    *,
    user_id: int,
    limit: int,
    db: Session,
) -> list[ChatMessage]:
    messages = list(
        db.scalars(
            select(ChatMessage)
            .where(
                ChatMessage.user_id == user_id,
            )
            .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
            .limit(limit)
        )
    )
    return list(reversed(messages))


def send_chat_message(payload: ChatRequest, *, db: Session) -> dict[str, object]:
    require_user(db, payload.user_id)
    user_message = ChatMessage(
        user_id=payload.user_id,
        role="user",
        content=payload.message,
    )
    db.add(user_message)
    db.flush()

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
            "user_preferences": get_preferences(user_id=payload.user_id, db=db)["preferences"],
            "chat_history": [
                _serialize_message(message)
                for message in _load_recent_messages(
                    user_id=payload.user_id,
                    limit=20,
                    db=db,
                )
            ],
        }
    )
    db.add(
        ChatMessage(
            user_id=payload.user_id,
            role="assistant",
            content=agent_result["reply"],
        )
    )
    db.commit()
    return {
        "reply": agent_result["reply"],
        "intent": agent_result["intent"],
        "action_options": agent_result["action_options"],
        "follow_up_questions": agent_result["follow_up_questions"],
    }


def get_chat_history(
    user_id: int,
    limit: int = 20,
    *,
    db: Session,
) -> dict[str, list[dict[str, object]]]:
    require_user(db, user_id)
    messages = _load_recent_messages(user_id=user_id, limit=limit, db=db)
    return {"messages": [_serialize_message(message) for message in messages]}

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.graph import run_agent
from app.agent.intent import is_pending_plan_confirmation
from app.models.chat import ChatMessage
from app.schemas.chat import ChatRequest
from app.services.action_service import create_pending_actions, get_reusable_pending_action
from app.services.preference_service import (
    get_memory_settings,
    get_preferences,
    get_relevant_memories,
    persist_memory_candidates,
)
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
    trip_id: int,
    limit: int,
    db: Session,
) -> list[ChatMessage]:
    messages = list(
        db.scalars(
            select(ChatMessage)
            .where(
                ChatMessage.user_id == user_id,
                ChatMessage.trip_id == trip_id,
            )
            .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
            .limit(limit)
        )
    )
    return list(reversed(messages))


def send_chat_message(payload: ChatRequest, *, db: Session) -> dict[str, object]:
    require_user(db, payload.user_id)
    current_trip = get_trip_detail(user_id=payload.user_id, trip_id=payload.trip_id, db=db)
    user_message = ChatMessage(
        user_id=payload.user_id,
        trip_id=payload.trip_id,
        role="user",
        content=payload.message,
    )
    db.add(user_message)
    db.flush()
    reusable_action = get_reusable_pending_action(
        user_id=payload.user_id,
        trip_id=payload.trip_id,
        current_trip=current_trip,
        db=db,
    )
    if reusable_action is not None and is_pending_plan_confirmation(payload.message):
        reply = "待确认的行程方案仍未写入，请点击确认按钮后应用。"
        db.add(ChatMessage(
            user_id=payload.user_id,
            trip_id=payload.trip_id,
            role="assistant",
            content=reply,
        ))
        db.commit()
        return {
            "reply": reply,
            "intent": "replan",
            "action_options": [reusable_action],
            "follow_up_questions": [],
            "clarification_options": [],
        }
    memory_enabled = get_memory_settings(user_id=payload.user_id, db=db)["enabled"]

    # 成员 C 接入点：把聊天请求组装成 AgentState，具体推理统一交给 run_agent。
    agent_result = run_agent(
        {
            "user_id": payload.user_id,
            "trip_id": payload.trip_id,
            "user_message": payload.message,
            "current_location": (
                payload.current_location.model_dump() if payload.current_location else {}
            ),
            "current_trip": current_trip,
            "user_preferences": get_preferences(user_id=payload.user_id, db=db)["preferences"],
            "long_term_memories": (
                get_relevant_memories(user_id=payload.user_id, db=db)
                if memory_enabled
                else []
            ),
            "chat_history": [
                _serialize_message(message)
                for message in _load_recent_messages(
                    user_id=payload.user_id,
                    trip_id=payload.trip_id,
                    limit=20,
                    db=db,
                )
            ],
        }
    )
    action_options = create_pending_actions(
        user_id=payload.user_id,
        trip_id=payload.trip_id,
        current_trip=current_trip,
        action_options=agent_result["action_options"],
        db=db,
    )
    reply = _guard_unverified_write_claim(
        reply=agent_result["reply"],
        action_options=action_options,
    )
    if memory_enabled:
        persist_memory_candidates(
            user_id=payload.user_id,
            trip_id=payload.trip_id,
            candidates=agent_result.get("memory_candidates", []),
            evidence_message_id=user_message.id,
            db=db,
        )
    db.add(
        ChatMessage(
            user_id=payload.user_id,
            trip_id=payload.trip_id,
            role="assistant",
            content=reply,
        )
    )
    db.commit()
    return {
        "reply": reply,
        "intent": agent_result["intent"],
        "action_options": action_options,
        "follow_up_questions": agent_result["follow_up_questions"],
        "clarification_options": agent_result.get("clarification_options", []),
    }


def _guard_unverified_write_claim(
    *,
    reply: str,
    action_options: list[dict[str, object]],
) -> str:
    if action_options:
        return reply
    if not re.search(
        r"(?:已|已经|成功|正式).{0,8}"
        r"(?:写入|写进|写进去|添加|新增|更新|修改|删除|安排|记下|记录)"
        r"|(?:写入|写进|写进去|添加|新增|更新|修改|删除|安排|记下|记录)"
        r".{0,8}(?:成功|完成|好了|啦|了)",
        reply,
    ):
        return reply
    return "当前没有生成可确认的行程操作，因此尚未写入。请明确要修改的日期和安排。"


def get_chat_history(
    user_id: int,
    trip_id: int,
    limit: int = 20,
    *,
    db: Session,
) -> dict[str, list[dict[str, object]]]:
    require_user(db, user_id)
    get_trip_detail(user_id=user_id, trip_id=trip_id, db=db)
    messages = _load_recent_messages(user_id=user_id, trip_id=trip_id, limit=limit, db=db)
    return {"messages": [_serialize_message(message) for message in messages]}

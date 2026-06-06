from app.agent.graph import run_agent
from app.schemas.reminders import ReminderCheckRequest
from app.services.trip_service import get_trip_detail


def check_reminders(payload: ReminderCheckRequest) -> dict[str, object]:
    # 成员 C 接入点：提醒检查只负责准备当前时间、位置和行程上下文。
    agent_result = run_agent(
        {
            "user_id": payload.user_id,
            "trip_id": payload.trip_id,
            "intent_hint": "reminder",
            "current_time": payload.current_time,
            "current_location": payload.current_location or {},
            "current_trip": get_trip_detail(user_id=payload.user_id, trip_id=payload.trip_id),
        }
    )
    structured_data = dict(agent_result.get("structured_data") or {})
    return {
        "has_risk": bool(structured_data.get("has_risk")),
        "reminder": structured_data.get("reminder"),
    }


def list_reminders(
    user_id: int,
    trip_id: int,
    status: str | None = None,
) -> dict[str, list[dict[str, object]]]:
    return {"reminders": []}

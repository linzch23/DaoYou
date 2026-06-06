from app.agent.graph import run_agent
from app.schemas.trips import ApplyPlanRequest, ReplanRequest
from app.services.preference_service import DEFAULT_PREFERENCES
from app.services.trip_service import get_trip_detail


def create_replan_draft(trip_id: int, payload: ReplanRequest) -> dict[str, object]:
    # 成员 C 接入点：改线草案由 Agent 的 structured_data 统一返回给 API 层。
    agent_result = run_agent(
        {
            "user_id": payload.user_id,
            "trip_id": trip_id,
            "user_message": payload.message,
            "intent_hint": "replan",
            "current_location": payload.current_location or {},
            "current_trip": get_trip_detail(user_id=payload.user_id, trip_id=trip_id),
            "user_preferences": DEFAULT_PREFERENCES,
        }
    )
    structured_data = dict(agent_result.get("structured_data") or {})
    return {
        "draft_id": structured_data.get("draft_id", "draft_001"),
        "summary": structured_data.get("summary", agent_result["reply"]),
        "reason": structured_data.get("reason", ""),
        "new_items": structured_data.get("new_items", []),
        "removed_item_ids": structured_data.get("removed_item_ids", []),
    }


def apply_replan_draft(trip_id: int, payload: ApplyPlanRequest) -> dict[str, object]:
    return {"applied": True, "updated_item_ids": [], "created_item_ids": []}

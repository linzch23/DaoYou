from app.schemas.trips import ApplyPlanRequest, ReplanRequest


def create_replan_draft(trip_id: int, payload: ReplanRequest) -> dict[str, object]:
    return {
        "draft_id": "draft_001",
        "summary": "动态改线 Agent 待接入，当前返回演示草案。",
        "reason": "骨架阶段固定响应。",
        "new_items": [],
        "removed_item_ids": [],
    }


def apply_replan_draft(trip_id: int, payload: ApplyPlanRequest) -> dict[str, object]:
    return {"applied": True, "updated_item_ids": [], "created_item_ids": []}


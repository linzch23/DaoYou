from fastapi import UploadFile

from app.agent.graph import run_agent
from app.schemas.common import Location
from app.services.preference_service import DEFAULT_PREFERENCES
from app.services.trip_service import get_trip_detail


def explain_photo(
    user_id: int,
    trip_id: int,
    image: UploadFile,
    current_location: Location | None = None,
) -> dict[str, object]:
    image_path = f"uploads/images/{image.filename or 'demo.jpg'}"
    # 成员 C 接入点：图片路径、文件名和定位信息会进入 Agent 的拍照讲解链路。
    agent_result = run_agent(
        {
            "user_id": user_id,
            "trip_id": trip_id,
            "intent_hint": "photo_explain",
            "current_location": current_location.model_dump() if current_location else {},
            "current_trip": get_trip_detail(user_id=user_id, trip_id=trip_id),
            "user_preferences": DEFAULT_PREFERENCES,
            "image_info": {
                "image_path": image_path,
                "filename": image.filename or "demo.jpg",
                "content_type": image.content_type,
            },
        }
    )
    structured_data = dict(agent_result.get("structured_data") or {})
    return {
        "photo_id": 1,
        "image_path": image_path,
        "recognition_result": structured_data.get("recognition_result", ""),
        "explanation": structured_data.get("explanation", agent_result["reply"]),
        "follow_up_questions": agent_result["follow_up_questions"],
    }

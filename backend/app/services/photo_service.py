from fastapi import UploadFile


def explain_photo(
    user_id: int,
    trip_id: int,
    image: UploadFile,
    current_location: str | None = None,
) -> dict[str, object]:
    return {
        "photo_id": 1,
        "image_path": f"uploads/images/{image.filename or 'demo.jpg'}",
        "recognition_result": "图片识别服务待接入。",
        "explanation": "拍照讲解 Agent 待接入，当前为骨架响应。",
        "follow_up_questions": [],
    }


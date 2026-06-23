from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.agent.graph import run_agent
from app.core.config import settings
from app.core.errors import AppError, ErrorCode
from app.models.photo import PhotoRecord
from app.schemas.common import Location
from app.services.preference_service import get_preferences
from app.services.resource_service import require_user
from app.services.trip_service import get_trip_detail

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
ALLOWED_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def _validate_image_upload(image: UploadFile) -> str:
    filename = image.filename or ""
    suffix = Path(filename).suffix.lower()
    content_type = image.content_type or ""
    if content_type not in ALLOWED_IMAGE_TYPES and suffix not in ALLOWED_IMAGE_SUFFIXES:
        raise AppError(ErrorCode.UPLOAD_FAILED, "文件类型不支持")

    effective_suffix = ALLOWED_IMAGE_TYPES.get(content_type) or suffix or ".jpg"
    max_size = settings.max_upload_size_mb * 1024 * 1024
    image.file.seek(0, 2)
    size = image.file.tell()
    image.file.seek(0)
    if size <= 0:
        raise AppError(ErrorCode.UPLOAD_FAILED, "上传图片为空")
    if size > max_size:
        raise AppError(ErrorCode.UPLOAD_FAILED, "上传图片超过大小限制")
    return effective_suffix


def _save_image(image: UploadFile, suffix: str) -> tuple[Path, str]:
    upload_root = Path(settings.upload_dir)
    image_dir = upload_root / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    saved_name = f"{uuid4().hex}{suffix}"
    saved_path = image_dir / saved_name
    with saved_path.open("wb") as target:
        target.write(image.file.read())
    image.file.seek(0)
    return saved_path, f"uploads/images/{saved_name}"


def explain_photo(
    user_id: int,
    trip_id: int,
    image: UploadFile,
    current_location: Location | None = None,
    *,
    db: Session,
) -> dict[str, object]:
    require_user(db, user_id)
    suffix = _validate_image_upload(image)
    saved_path, image_path = _save_image(image, suffix)
    # 成员 C 接入点：图片路径、文件名和定位信息会进入 Agent 的拍照讲解链路。
    try:
        current_trip = get_trip_detail(user_id=user_id, trip_id=trip_id, db=db)
        agent_result = run_agent(
            {
                "user_id": user_id,
                "trip_id": trip_id,
                "intent_hint": "photo_explain",
                "current_location": current_location.model_dump() if current_location else {},
                "current_trip": current_trip,
                "user_preferences": get_preferences(user_id=user_id, db=db)["preferences"],
                "image_info": {
                    "image_path": image_path,
                    "saved_path": str(saved_path),
                    "filename": image.filename or saved_path.name,
                    "content_type": image.content_type,
                },
            }
        )
    except Exception:
        saved_path.unlink(missing_ok=True)
        raise

    structured_data = dict(agent_result.get("structured_data") or {})
    record = PhotoRecord(
        user_id=user_id,
        trip_id=trip_id,
        image_path=image_path,
        recognition_result=structured_data.get("recognition_result", ""),
        explanation=structured_data.get("explanation", agent_result["reply"]),
    )
    try:
        db.add(record)
        db.commit()
        db.refresh(record)
    except Exception:
        db.rollback()
        saved_path.unlink(missing_ok=True)
        raise
    return {
        "photo_id": record.id,
        "image_path": image_path,
        "recognition_result": record.recognition_result,
        "explanation": record.explanation,
        "follow_up_questions": agent_result["follow_up_questions"],
    }

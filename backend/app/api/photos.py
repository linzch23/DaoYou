from fastapi import APIRouter, File, Form, UploadFile

from app.core.response import success
from app.services.photo_service import explain_photo

router = APIRouter()
USER_ID_FORM = Form(...)
TRIP_ID_FORM = Form(...)
IMAGE_FILE = File(...)
CURRENT_LOCATION_FORM = Form(default=None)


@router.post("/explain")
def explain(
    user_id: int = USER_ID_FORM,
    trip_id: int = TRIP_ID_FORM,
    image: UploadFile = IMAGE_FILE,
    current_location: str | None = CURRENT_LOCATION_FORM,
) -> dict[str, object]:
    return success(
        explain_photo(
            user_id=user_id,
            trip_id=trip_id,
            image=image,
            current_location=current_location,
        )
    )

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import ValidationError

from app.core.response import success
from app.db.session import DbSession
from app.schemas.common import Location
from app.services.photo_service import explain_photo

router = APIRouter()
USER_ID_FORM = Form(...)
IMAGE_FILE = File(...)
CURRENT_LOCATION_FORM = Form(default=None)
TRIP_ID_FORM = Form(default=None)


def parse_location_form(raw_location: str | None) -> Location | None:
    if raw_location is None:
        return None
    try:
        return Location.model_validate_json(raw_location)
    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail="current_location must be a valid Location",
        ) from exc


@router.post("/explain")
def explain(
    db: DbSession,
    user_id: int = USER_ID_FORM,
    trip_id: int | None = TRIP_ID_FORM,
    image: UploadFile = IMAGE_FILE,
    current_location: str | None = CURRENT_LOCATION_FORM,
) -> dict[str, object]:
    return success(
        explain_photo(
            user_id=user_id,
            trip_id=trip_id,
            image=image,
            current_location=parse_location_form(current_location),
            db=db,
        )
    )

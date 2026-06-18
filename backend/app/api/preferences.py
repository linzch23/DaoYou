from fastapi import APIRouter

from app.core.response import success
from app.db.session import DbSession
from app.schemas.preferences import MemorySummaryRequest, UpdatePreferencesRequest
from app.services.preference_service import get_preferences, summarize_memory, update_preferences

router = APIRouter()


@router.get("/preferences")
def get_preferences_endpoint(user_id: int, db: DbSession) -> dict[str, object]:
    return success(get_preferences(user_id=user_id, db=db))


@router.put("/preferences")
def update_preferences_endpoint(
    payload: UpdatePreferencesRequest,
    db: DbSession,
) -> dict[str, object]:
    return success(update_preferences(payload, db=db))


@router.post("/memory/summary")
def summarize_memory_endpoint(payload: MemorySummaryRequest, db: DbSession) -> dict[str, object]:
    return success(summarize_memory(payload, db=db))

from fastapi import APIRouter

from app.core.response import success
from app.db.session import DbSession
from app.schemas.preferences import (
    MemorySummaryRequest,
    UpdateMemorySettingsRequest,
    UpdatePreferencesRequest,
)
from app.services.preference_service import (
    clear_memories,
    delete_memory,
    get_memory_settings,
    get_preferences,
    get_relevant_memories,
    summarize_memory,
    update_memory_settings,
    update_preferences,
)

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


@router.get("/memory")
def get_memories_endpoint(user_id: int, db: DbSession) -> dict[str, object]:
    return success({"memories": get_relevant_memories(user_id=user_id, db=db)})


@router.delete("/memory")
def clear_memories_endpoint(user_id: int, db: DbSession) -> dict[str, object]:
    return success(clear_memories(user_id=user_id, db=db))


@router.delete("/memory/{memory_type}/{memory_key}")
def delete_memory_endpoint(
    memory_type: str,
    memory_key: str,
    user_id: int,
    db: DbSession,
) -> dict[str, object]:
    return success(
        delete_memory(
            user_id=user_id,
            memory_type=memory_type,
            memory_key=memory_key,
            db=db,
        )
    )


@router.get("/memory/settings")
def get_memory_settings_endpoint(user_id: int, db: DbSession) -> dict[str, object]:
    return success(get_memory_settings(user_id=user_id, db=db))


@router.put("/memory/settings")
def update_memory_settings_endpoint(
    payload: UpdateMemorySettingsRequest,
    db: DbSession,
) -> dict[str, object]:
    return success(
        update_memory_settings(user_id=payload.user_id, enabled=payload.enabled, db=db)
    )

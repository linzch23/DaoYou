from fastapi import APIRouter

from app.core.response import success
from app.db.session import DbSession
from app.schemas.chat import ChatRequest
from app.services.chat_service import get_chat_history, send_chat_message

router = APIRouter()


@router.post("")
def chat(payload: ChatRequest, db: DbSession) -> dict[str, object]:
    return success(send_chat_message(payload, db=db))


@router.get("/history")
def history(
    user_id: int,
    db: DbSession,
    limit: int = 20,
) -> dict[str, object]:
    return success(get_chat_history(user_id=user_id, limit=limit, db=db))

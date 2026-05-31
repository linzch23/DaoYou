from fastapi import APIRouter

from app.core.response import success
from app.schemas.chat import ChatRequest
from app.services.chat_service import get_chat_history, send_chat_message

router = APIRouter()


@router.post("")
def chat(payload: ChatRequest) -> dict[str, object]:
    return success(send_chat_message(payload))


@router.get("/history")
def history(user_id: int, trip_id: int, limit: int = 20) -> dict[str, object]:
    return success(get_chat_history(user_id=user_id, trip_id=trip_id, limit=limit))


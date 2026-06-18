from sqlalchemy.orm import Session

from app.models.chat import ChatMessage
from app.models.user import User
from app.schemas.chat import ChatRequest
from app.services.chat_service import get_chat_history, send_chat_message


def seed_user(db: Session) -> None:
    db.add(User(id=1, nickname="演示用户"))
    db.commit()


def test_chat_request_and_model_are_user_scoped() -> None:
    assert "trip_id" not in ChatRequest.model_fields
    assert "trip_id" not in ChatMessage.__table__.columns


def test_send_chat_message_saves_user_and_assistant_messages(db: Session) -> None:
    seed_user(db)

    result = send_chat_message(
        ChatRequest(user_id=1, message="下午想轻松一点，怎么安排？"),
        db=db,
    )

    messages = db.query(ChatMessage).order_by(ChatMessage.id).all()
    assert result["intent"] == "chat"
    assert result["reply"]
    assert [message.role for message in messages] == ["user", "assistant"]
    assert messages[0].content == "下午想轻松一点，怎么安排？"
    assert messages[1].content == result["reply"]


def test_get_chat_history_returns_recent_messages_in_chronological_order(db: Session) -> None:
    seed_user(db)
    for index in range(3):
        db.add(ChatMessage(user_id=1, role="user", content=f"问题{index}"))
    db.commit()

    result = get_chat_history(user_id=1, limit=2, db=db)

    assert [message["content"] for message in result["messages"]] == ["问题1", "问题2"]

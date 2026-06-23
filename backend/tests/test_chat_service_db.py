from datetime import date, time

from sqlalchemy.orm import Session

from app.models.chat import ChatMessage
from app.models.trip import Trip, TripDay, TripItem
from app.models.user import User
from app.schemas.chat import ChatRequest
from app.services.chat_service import get_chat_history, send_chat_message


def seed_user(db: Session) -> int:
    db.add(User(id=1, nickname="演示用户"))
    db.flush()
    trip = Trip(
        user_id=1,
        title="大连三日游",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 3),
        status="active",
    )
    db.add(trip)
    db.flush()
    day = TripDay(
        trip_id=trip.id,
        day_index=1,
        trip_date=date(2026, 7, 1),
    )
    db.add(day)
    db.flush()
    db.add(
        TripItem(
            trip_day_id=day.id,
            city="大连",
            title="贝壳博物馆",
            start_time=time(14, 30),
            end_time=time(16, 0),
            status="planned",
        )
    )
    db.commit()
    return trip.id


def test_chat_request_and_model_are_trip_scoped() -> None:
    assert "trip_id" in ChatRequest.model_fields
    assert "trip_id" in ChatMessage.__table__.columns


def test_send_chat_message_saves_user_and_assistant_messages(db: Session) -> None:
    trip_id = seed_user(db)

    result = send_chat_message(
        ChatRequest(user_id=1, trip_id=trip_id, message="下午想轻松一点，怎么安排？"),
        db=db,
    )

    messages = db.query(ChatMessage).order_by(ChatMessage.id).all()
    assert result["intent"] == "chat"
    assert result["reply"]
    assert [message.role for message in messages] == ["user", "assistant"]
    assert [message.trip_id for message in messages] == [trip_id, trip_id]
    assert messages[0].content == "下午想轻松一点，怎么安排？"
    assert messages[1].content == result["reply"]


def test_get_chat_history_returns_recent_messages_in_chronological_order(db: Session) -> None:
    trip_id = seed_user(db)
    other_trip = Trip(
        user_id=1,
        title="北京两日游",
        start_date=date(2026, 8, 1),
        end_date=date(2026, 8, 2),
        status="active",
    )
    db.add(other_trip)
    db.flush()
    for index in range(3):
        db.add(
            ChatMessage(
                user_id=1,
                trip_id=trip_id,
                role="user",
                content=f"问题{index}",
            )
        )
    db.add(
        ChatMessage(
            user_id=1,
            trip_id=other_trip.id,
            role="user",
            content="其他旅行问题",
        )
    )
    db.commit()

    result = get_chat_history(user_id=1, trip_id=trip_id, limit=2, db=db)

    assert [message["content"] for message in result["messages"]] == ["问题1", "问题2"]

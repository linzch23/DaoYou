from datetime import date, time

from sqlalchemy.orm import Session

from app.models.chat import ChatMessage
from app.models.pending_action import PendingAction
from app.models.trip import Trip, TripDay, TripItem
from app.models.user import User
from app.schemas.chat import ChatRequest
from app.services.action_service import create_pending_actions
from app.services.chat_service import get_chat_history, send_chat_message
from app.services.trip_service import get_trip_detail


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
    assert "clarification_options" in result
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


def test_repeated_confirmation_reuses_existing_pending_batch(db: Session) -> None:
    trip_id = seed_user(db)
    current_trip = get_trip_detail(user_id=1, trip_id=trip_id, db=db)
    original = create_pending_actions(
        user_id=1,
        trip_id=trip_id,
        current_trip=current_trip,
        action_options=[
            {
                "operation": "create_trip_item", "trip_id": trip_id,
                "trip_day_id": current_trip["days"][0]["id"],
                "payload": {"city": "大连", "title": "星海广场"},
            },
            {
                "operation": "create_trip_item", "trip_id": trip_id,
                "trip_day_id": current_trip["days"][0]["id"],
                "payload": {"city": "大连", "title": "东港"},
            },
        ],
        db=db,
    )[0]
    db.commit()

    result = send_chat_message(
        ChatRequest(user_id=1, trip_id=trip_id, message="确认写入，不做修改。"),
        db=db,
    )

    assert result["action_options"][0]["action_id"] == original["action_id"]
    assert "仍未写入" in result["reply"]
    assert db.query(PendingAction).count() == 1


def test_alternative_confirmation_reuses_existing_single_action(db: Session) -> None:
    trip_id = seed_user(db)
    current_trip = get_trip_detail(user_id=1, trip_id=trip_id, db=db)
    original = create_pending_actions(
        user_id=1,
        trip_id=trip_id,
        current_trip=current_trip,
        action_options=[{
            "operation": "create_trip_item",
            "trip_id": trip_id,
            "trip_day_id": current_trip["days"][0]["id"],
            "payload": {"city": "大连", "title": "星海广场"},
        }],
        db=db,
    )[0]
    db.commit()

    result = send_chat_message(
        ChatRequest(user_id=1, trip_id=trip_id, message="照你说的办"),
        db=db,
    )

    assert result["intent"] == "replan"
    assert result["action_options"][0]["action_id"] == original["action_id"]
    assert "仍未写入" in result["reply"]
    assert db.query(PendingAction).count() == 1


def test_chat_without_pending_action_cannot_report_write_success(
    db: Session,
    monkeypatch,
) -> None:
    trip_id = seed_user(db)
    monkeypatch.setattr(
        "app.services.chat_service.run_agent",
        lambda state: {
            "reply": "行程已更新成功！",
            "intent": "chat",
            "action_options": [],
            "follow_up_questions": [],
            "clarification_options": [],
            "memory_candidates": [],
        },
    )

    result = send_chat_message(
        ChatRequest(user_id=1, trip_id=trip_id, message="帮我写入行程"),
        db=db,
    )

    assert "更新成功" not in result["reply"]
    assert "尚未写入" in result["reply"]
    assert result["action_options"] == []
    assert db.query(ChatMessage).order_by(ChatMessage.id.desc()).first().content == result["reply"]


def test_chat_without_pending_action_cannot_say_it_was_written_in(
    db: Session,
    monkeypatch,
) -> None:
    trip_id = seed_user(db)
    monkeypatch.setattr(
        "app.services.chat_service.run_agent",
        lambda state: {
            "reply": "好嘞，正式记下了！行程已经写进去啦。",
            "intent": "chat",
            "action_options": [],
            "follow_up_questions": [],
            "clarification_options": [],
            "memory_candidates": [],
        },
    )

    result = send_chat_message(
        ChatRequest(user_id=1, trip_id=trip_id, message="确认，就按这个安排吧"),
        db=db,
    )

    assert "写进去" not in result["reply"]
    assert "尚未写入" in result["reply"]

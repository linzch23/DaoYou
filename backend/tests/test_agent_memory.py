from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agent.memory import (
    extract_explicit_memory_candidates,
    extract_memory_candidates_with_llm,
)
from app.models.preference import UserMemory
from app.models.trip import Trip
from app.models.user import User
from app.schemas.chat import ChatRequest
from app.services.chat_service import send_chat_message
from app.services.preference_service import (
    clear_memories,
    delete_memory,
    get_memory_settings,
    get_relevant_memories,
    update_memory_settings,
)


def _add_user_and_trip(db: Session) -> None:
    db.add(User(id=1, nickname="画像测试用户"))
    db.flush()
    db.add(
        Trip(
            id=1,
            user_id=1,
            title="广州三日游",
            start_date=date(2026, 7, 1),
            end_date=date(2026, 7, 3),
            status="active",
        )
    )
    db.commit()


def test_explicit_memory_extractor_only_accepts_direct_preferences() -> None:
    explicit = extract_explicit_memory_candidates(
        "我喜欢拍照，也不喜欢走太多路，以后讲解有趣一点。"
    )
    incidental = extract_explicit_memory_candidates("今天拍了一张照片，然后走到了公园。")

    assert {(item.memory_type, item.memory_key) for item in explicit} == {
        ("interest", "photo"),
        ("special_need", "less_walking"),
        ("preference", "explanation_style"),
    }
    assert incidental == []


def test_llm_memory_candidate_requires_repeated_source_evidence(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.agent.memory.call_llm",
        lambda messages: (
            '{"memories":[{"memory_type":"interest","memory_key":"photo",'
            '"value":true,"description":"用户喜欢旅行摄影","confidence":0.8,'
            '"evidence_kind":"repeated_behavior"}]}'
        ),
    )

    single = extract_memory_candidates_with_llm(["想问拍照机位", "天气如何", "几点出发"])
    repeated = extract_memory_candidates_with_llm(
        ["想问拍照机位", "哪里适合摄影", "几点出发"]
    )

    assert single == []
    assert [candidate.memory_key for candidate in repeated] == ["photo"]


def test_chat_automatically_persists_explicit_memory_with_evidence(
    db: Session,
    monkeypatch,
) -> None:
    _add_user_and_trip(db)
    monkeypatch.setattr(
        "app.agent.nodes.call_llm",
        lambda messages: (
            '{"reply":"知道了，之后会优先考虑拍照和少步行。",'
            '"suggested_questions":[],"clarification_options":[]}'
        ),
    )
    monkeypatch.setattr("app.agent.intent.call_llm", lambda messages: None)

    send_chat_message(
        ChatRequest(user_id=1, trip_id=1, message="我喜欢拍照，而且不喜欢走太多路。"),
        db=db,
    )

    records = db.scalars(
        select(UserMemory).where(UserMemory.user_id == 1).order_by(UserMemory.memory_key)
    ).all()
    assert [record.memory_key for record in records] == ["less_walking", "photo"]
    assert all(record.memory_value["evidence_count"] == 1 for record in records)
    assert all(record.memory_value["evidence_message_ids"] for record in records)
    assert all(record.memory_value["source_trip_ids"] == [1] for record in records)


def test_existing_memory_is_injected_into_next_chat_context(
    db: Session,
    monkeypatch,
) -> None:
    _add_user_and_trip(db)
    monkeypatch.setattr("app.agent.intent.call_llm", lambda messages: None)
    captured_payloads: list[str] = []

    def fake_llm(messages: list[dict[str, str]]) -> str:
        captured_payloads.append(messages[-1]["content"])
        return '{"reply":"好的。","suggested_questions":[],"clarification_options":[]}'

    monkeypatch.setattr("app.agent.nodes.call_llm", fake_llm)
    send_chat_message(
        ChatRequest(user_id=1, trip_id=1, message="我喜欢拍照。"),
        db=db,
    )
    send_chat_message(
        ChatRequest(user_id=1, trip_id=1, message="今天适合去哪里？"),
        db=db,
    )

    assert '"memory_key": "photo"' in captured_payloads[-1]
    assert '"evidence_message_ids"' in captured_payloads[-1]


def test_repeated_explicit_memory_updates_one_record(db: Session, monkeypatch) -> None:
    _add_user_and_trip(db)
    monkeypatch.setattr("app.agent.intent.call_llm", lambda messages: None)
    monkeypatch.setattr(
        "app.agent.nodes.call_llm",
        lambda messages: '{"reply":"好的。","suggested_questions":[]}',
    )

    send_chat_message(
        ChatRequest(user_id=1, trip_id=1, message="我喜欢拍照。"),
        db=db,
    )
    send_chat_message(
        ChatRequest(user_id=1, trip_id=1, message="我还是很喜欢摄影。"),
        db=db,
    )

    records = db.scalars(select(UserMemory).where(UserMemory.user_id == 1)).all()
    assert len(records) == 1
    assert records[0].memory_key == "photo"
    assert records[0].memory_value["evidence_count"] == 2
    assert len(records[0].memory_value["evidence_message_ids"]) == 2


def test_disabling_automatic_memory_stops_reading_and_writing(
    db: Session,
    monkeypatch,
) -> None:
    _add_user_and_trip(db)
    update_memory_settings(user_id=1, enabled=False, db=db)
    monkeypatch.setattr("app.agent.intent.call_llm", lambda messages: None)
    payloads: list[str] = []

    def fake_llm(messages: list[dict[str, str]]) -> str:
        payloads.append(messages[-1]["content"])
        return '{"reply":"好的。","suggested_questions":[],"clarification_options":[]}'

    monkeypatch.setattr("app.agent.nodes.call_llm", fake_llm)
    send_chat_message(
        ChatRequest(user_id=1, trip_id=1, message="我喜欢历史，也喜欢拍照。"),
        db=db,
    )

    assert get_relevant_memories(user_id=1, db=db) == []
    assert '"long_term_memories": []' in payloads[-1]
    assert get_memory_settings(user_id=1, db=db) == {"enabled": False}


def test_user_can_delete_one_or_all_memories(db: Session, monkeypatch) -> None:
    _add_user_and_trip(db)
    monkeypatch.setattr("app.agent.intent.call_llm", lambda messages: None)
    monkeypatch.setattr(
        "app.agent.nodes.call_llm",
        lambda messages: '{"reply":"好的。","suggested_questions":[]}',
    )
    send_chat_message(
        ChatRequest(user_id=1, trip_id=1, message="我喜欢拍照，也喜欢历史。"),
        db=db,
    )

    result = delete_memory(user_id=1, memory_type="interest", memory_key="photo", db=db)
    remaining = get_relevant_memories(user_id=1, db=db)
    cleared = clear_memories(user_id=1, db=db)

    assert result == {"deleted": True}
    assert [memory["memory_key"] for memory in remaining] == ["history"]
    assert cleared == {"deleted_count": 1}
    assert get_relevant_memories(user_id=1, db=db) == []

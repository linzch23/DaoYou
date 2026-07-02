import json
from datetime import date

import pytest
from sqlalchemy import func, select

from app.agent import trip_parser
from app.models.trip import Trip, TripDay, TripItem
from app.models.user import User
from app.schemas.trips import CreateTripFromDraftRequest
from app.services.trip_service import create_trip_from_draft
from app.core.errors import AppError


def test_parser_keeps_unmentioned_fields_empty(monkeypatch) -> None:
    monkeypatch.setattr(trip_parser, "call_llm", lambda messages: json.dumps({
        "title": None,
        "start_date": "2026-08-12",
        "end_date": None,
        "items": [{
            "title": "西湖",
            "city": "杭州",
            "trip_date": "2026-08-12",
            "time_period": "morning",
            "start_time": None,
        }],
        "warnings": [],
    }, ensure_ascii=False))

    result = trip_parser.parse_trip_text("8月12日上午去杭州西湖", date(2026, 7, 2), "Asia/Shanghai")

    assert result["title"] is None
    assert result["end_date"] is None
    assert result["items"][0]["time_period"] == "morning"
    assert result["items"][0]["start_time"] is None
    assert result["missing_required_fields"] == ["title", "end_date"]


def test_parser_rule_fallback_extracts_dates(monkeypatch) -> None:
    monkeypatch.setattr(trip_parser, "call_llm", lambda messages: None)
    result = trip_parser.parse_trip_text(
        "2026年8月12日到2026年8月15日去杭州", date(2026, 7, 2), "Asia/Shanghai"
    )
    assert result["start_date"] == "2026-08-12"
    assert result["end_date"] == "2026-08-15"


def test_atomic_creation_and_idempotency(db) -> None:
    db.add(User(id=1, nickname="test"))
    db.commit()
    payload = CreateTripFromDraftRequest.model_validate({
        "user_id": 1,
        "title": "杭州旅行",
        "start_date": "2026-08-12",
        "end_date": "2026-08-13",
        "status": "active",
        "idempotency_key": "trip-create-test-1",
        "days": [{
            "day_index": 1,
            "trip_date": "2026-08-12",
            "items": [{"title": "西湖", "city": "杭州"}],
        }],
    })

    first = create_trip_from_draft(payload, db)
    second = create_trip_from_draft(payload, db)

    assert first["created"] is True
    assert second == {"trip_id": first["trip_id"], "created": False}
    assert db.scalar(select(func.count()).select_from(Trip)) == 1
    assert db.scalar(select(func.count()).select_from(TripDay)) == 1
    assert db.scalar(select(func.count()).select_from(TripItem)) == 1


def test_atomic_creation_rejects_invalid_day_without_partial_trip(db) -> None:
    db.add(User(id=1, nickname="test"))
    db.commit()
    payload = CreateTripFromDraftRequest.model_validate({
        "user_id": 1,
        "title": "杭州旅行",
        "start_date": "2026-08-12",
        "end_date": "2026-08-13",
        "idempotency_key": "trip-create-invalid-1",
        "days": [{"day_index": 1, "trip_date": "2026-08-20", "items": []}],
    })

    with pytest.raises(AppError):
        create_trip_from_draft(payload, db)

    assert db.scalar(select(func.count()).select_from(Trip)) == 0

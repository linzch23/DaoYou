from datetime import date
from io import BytesIO

import pytest
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.photo import PhotoRecord
from app.models.trip import Trip, TripDay, TripItem
from app.models.user import User
from app.services.photo_service import explain_photo


def seed_user(db: Session) -> None:
    db.add(User(id=1, nickname="演示用户"))
    db.commit()


def seed_trip(db: Session) -> int:
    trip = Trip(
        user_id=1,
        title="大连轻松游",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 1),
        status="active",
    )
    db.add(trip)
    db.flush()
    day = TripDay(trip_id=trip.id, day_index=1, trip_date=date(2026, 7, 1))
    db.add(day)
    db.flush()
    db.add(
        TripItem(
            trip_day_id=day.id,
            city="大连",
            title="渔人码头",
            item_type="attraction",
            status="planned",
        )
    )
    db.commit()
    return trip.id


def test_photo_record_is_user_scoped() -> None:
    assert "trip_id" not in PhotoRecord.__table__.columns


@pytest.mark.parametrize("content_type", ["image/jpeg", "image/png"])
def test_explain_photo_saves_upload_and_photo_record(
    db: Session,
    tmp_path,
    monkeypatch,
    content_type: str,
) -> None:
    seed_user(db)
    monkeypatch.setattr("app.services.photo_service.settings.upload_dir", str(tmp_path))
    upload = UploadFile(
        filename="yurenmatou.jpg",
        file=BytesIO(b"fake image bytes"),
        headers={"content-type": content_type},
    )

    result = explain_photo(user_id=1, image=upload, db=db)

    record = db.query(PhotoRecord).one()
    saved_path = tmp_path / "images" / result["image_path"].split("/")[-1]
    assert result["photo_id"] == record.id
    assert result["image_path"] == record.image_path
    assert saved_path.read_bytes() == b"fake image bytes"
    assert record.recognition_result
    assert record.explanation


def test_explain_photo_passes_optional_trip_context(
    db: Session,
    tmp_path,
    monkeypatch,
) -> None:
    seed_user(db)
    trip_id = seed_trip(db)
    captured: dict[str, object] = {}

    def fake_run_agent(state):
        captured.update(state)
        return {
            "reply": "讲解内容",
            "structured_data": {
                "recognition_result": "识别结果",
                "explanation": "讲解内容",
            },
            "follow_up_questions": [],
        }

    monkeypatch.setattr("app.services.photo_service.settings.upload_dir", str(tmp_path))
    monkeypatch.setattr("app.services.photo_service.run_agent", fake_run_agent)
    upload = UploadFile(
        filename="yurenmatou.jpg",
        file=BytesIO(b"fake image bytes"),
        headers={"content-type": "image/jpeg"},
    )

    explain_photo(user_id=1, trip_id=trip_id, image=upload, db=db)

    assert captured["trip_id"] == trip_id
    assert captured["current_trip"]["id"] == trip_id
    assert captured["current_trip"]["days"][0]["items"][0]["title"] == "渔人码头"
    assert "trip_id" not in PhotoRecord.__table__.columns


def test_explain_photo_rejects_non_image_upload(db: Session, tmp_path, monkeypatch) -> None:
    seed_user(db)
    monkeypatch.setattr("app.services.photo_service.settings.upload_dir", str(tmp_path))
    upload = UploadFile(
        filename="note.txt",
        file=BytesIO(b"text"),
        headers={"content-type": "text/plain"},
    )

    with pytest.raises(AppError):
        explain_photo(user_id=1, image=upload, db=db)

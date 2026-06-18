from io import BytesIO

import pytest
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.photo import PhotoRecord
from app.models.user import User
from app.services.photo_service import explain_photo


def seed_user(db: Session) -> None:
    db.add(User(id=1, nickname="演示用户"))
    db.commit()


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

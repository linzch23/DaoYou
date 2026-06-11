from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.trip import Trip
from app.models.user import User
from app.schemas.common import Location
from app.schemas.reminders import ReminderCheckRequest
from app.services import reminder_service


def seed_active_trip(db: Session, *, location_updated_at: datetime | None) -> None:
    db.add(
        User(
            id=1,
            nickname="演示用户",
            latitude=Decimal("31.2304000"),
            longitude=Decimal("121.4737000"),
            location_updated_at=location_updated_at,
        )
    )
    db.flush()
    db.add(
        Trip(
            id=1,
            user_id=1,
            title="上海一日游",
            start_date=date(2026, 6, 11),
            end_date=date(2026, 6, 11),
            status="active",
        )
    )
    db.commit()


def capture_agent_state(monkeypatch) -> dict[str, object]:
    captured: dict[str, object] = {}

    def fake_run_agent(state):
        captured.update(state)
        return {
            "structured_data": {"has_risk": False, "reminder": None},
        }

    monkeypatch.setattr(reminder_service, "run_agent", fake_run_agent)
    return captured


def test_reminder_prefers_request_location_without_updating_user(db: Session, monkeypatch) -> None:
    now = datetime.now(timezone.utc)
    seed_active_trip(db, location_updated_at=now - timedelta(minutes=5))
    captured = capture_agent_state(monkeypatch)

    reminder_service.check_reminders(
        ReminderCheckRequest(
            user_id=1,
            trip_id=1,
            current_time=now,
            current_location=Location(latitude=30.0, longitude=120.0),
        ),
        db=db,
    )

    assert captured["current_location"] == {"latitude": 30.0, "longitude": 120.0}
    user = db.get(User, 1)
    assert float(user.latitude) == 31.2304


def test_reminder_uses_recent_stored_location(db: Session, monkeypatch) -> None:
    now = datetime.now(timezone.utc)
    seed_active_trip(db, location_updated_at=now - timedelta(minutes=29))
    captured = capture_agent_state(monkeypatch)

    reminder_service.check_reminders(
        ReminderCheckRequest(user_id=1, trip_id=1, current_time=now),
        db=db,
    )

    assert captured["current_location"] == {
        "latitude": 31.2304,
        "longitude": 121.4737,
    }


def test_reminder_ignores_stale_stored_location(db: Session, monkeypatch) -> None:
    now = datetime.now(timezone.utc)
    seed_active_trip(db, location_updated_at=now - timedelta(minutes=31))
    captured = capture_agent_state(monkeypatch)

    reminder_service.check_reminders(
        ReminderCheckRequest(user_id=1, trip_id=1, current_time=now),
        db=db,
    )

    assert captured["current_location"] == {}


def test_reminder_resolves_active_trip_when_trip_id_is_omitted(db: Session, monkeypatch) -> None:
    current_time = datetime(2026, 6, 11, 9, 20, tzinfo=timezone.utc)
    seed_active_trip(db, location_updated_at=current_time - timedelta(minutes=5))
    captured = capture_agent_state(monkeypatch)

    reminder_service.check_reminders(
        ReminderCheckRequest(user_id=1, current_time=current_time),
        db=db,
    )

    assert captured["trip_id"] == 1


def test_reminder_matches_trip_using_request_local_date(db: Session, monkeypatch) -> None:
    china_timezone = timezone(timedelta(hours=8))
    current_time = datetime(2026, 6, 11, 0, 30, tzinfo=china_timezone)
    seed_active_trip(
        db,
        location_updated_at=current_time.astimezone(timezone.utc) - timedelta(minutes=5),
    )
    captured = capture_agent_state(monkeypatch)

    reminder_service.check_reminders(
        ReminderCheckRequest(user_id=1, current_time=current_time),
        db=db,
    )

    assert captured["trip_id"] == 1

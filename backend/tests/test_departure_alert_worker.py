from datetime import datetime, timezone

from app.jobs.departure_alerts_worker import seconds_until_next_quarter


def test_seconds_until_next_quarter_aligns_to_wall_clock() -> None:
    now = datetime(2026, 6, 28, 2, 7, 30, tzinfo=timezone.utc)

    assert seconds_until_next_quarter(now) == 7 * 60 + 30


def test_seconds_until_next_quarter_never_returns_zero() -> None:
    now = datetime(2026, 6, 28, 2, 15, 0, tzinfo=timezone.utc)

    assert seconds_until_next_quarter(now) == 15 * 60

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.departure_alert import DepartureAlert
from app.models.push_device import DevicePushToken
from app.models.trip import Trip, TripDay, TripItem
from app.models.user import User
from app.services.amap_driving_provider import DrivingRoute
from app.services.departure_alert_job import run_departure_alert_scan
from app.services.vivo_push_provider import PushSendResult


class FakeRouteProvider:
    def __init__(self, eta_seconds: int = 30 * 60) -> None:
        self.eta_seconds = eta_seconds
        self.calls = 0

    def get_route(self, **kwargs) -> DrivingRoute:
        del kwargs
        self.calls += 1
        return DrivingRoute(eta_seconds=self.eta_seconds, distance_meters=10_000)


class FakePushProvider:
    def __init__(self) -> None:
        self.requests: list[dict[str, object]] = []

    def send(self, **kwargs) -> PushSendResult:
        self.requests.append(kwargs)
        return PushSendResult(success=True, provider_task_id="task-001")


def seed_trip(
    db: Session,
    *,
    now: datetime,
    user_latitude: Decimal = Decimal("31.2304000"),
    user_longitude: Decimal = Decimal("121.4737000"),
) -> tuple[Trip, TripDay]:
    user = User(
        id=1,
        nickname="演示用户",
        latitude=user_latitude,
        longitude=user_longitude,
        location_updated_at=now,
    )
    db.add(user)
    db.flush()
    trip = Trip(
        id=1,
        user_id=1,
        title="上海一日游",
        start_date=date(2026, 6, 28),
        end_date=date(2026, 6, 28),
        status="draft",
    )
    db.add(trip)
    db.flush()
    day = TripDay(id=1, trip_id=trip.id, day_index=1, trip_date=date(2026, 6, 28))
    db.add(day)
    db.add(
        DevicePushToken(
            id=1,
            user_id=1,
            provider="vivo",
            reg_id="reg-1234567890",
            enabled=True,
        )
    )
    db.commit()
    return trip, day


def test_scan_creates_and_sends_warning_once(db: Session) -> None:
    now = datetime(2026, 6, 28, 2, 0, tzinfo=timezone.utc)
    _, day = seed_trip(db, now=now)
    db.add(
        TripItem(
            id=1,
            trip_day_id=day.id,
            city="上海",
            title="目的地",
            start_time=time(10, 40),
            latitude=Decimal("31.3304000"),
            longitude=Decimal("121.5737000"),
        )
    )
    db.commit()
    route_provider = FakeRouteProvider()
    push_provider = FakePushProvider()

    first = run_departure_alert_scan(
        db=db,
        now=now,
        route_provider=route_provider,
        push_provider=push_provider,
    )
    second = run_departure_alert_scan(
        db=db,
        now=now,
        route_provider=route_provider,
        push_provider=push_provider,
    )

    alerts = db.scalars(select(DepartureAlert)).all()
    assert first.sent_count == 1
    assert second.sent_count == 0
    assert len(alerts) == 1
    assert alerts[0].level == "warning"
    assert alerts[0].push_status == "sent"
    assert len(push_provider.requests) == 1


def test_scan_marks_one_arrival_then_evaluates_next_item(db: Session) -> None:
    now = datetime(2026, 6, 28, 2, 0, tzinfo=timezone.utc)
    _, day = seed_trip(db, now=now)
    db.add_all(
        [
            TripItem(
                id=1,
                trip_day_id=day.id,
                city="上海",
                title="已到达地点",
                start_time=time(10, 0),
                latitude=Decimal("31.2305000"),
                longitude=Decimal("121.4738000"),
            ),
            TripItem(
                id=2,
                trip_day_id=day.id,
                city="上海",
                title="下一地点",
                start_time=time(10, 40),
                latitude=Decimal("31.3304000"),
                longitude=Decimal("121.5737000"),
            ),
        ]
    )
    db.commit()
    route_provider = FakeRouteProvider()

    result = run_departure_alert_scan(
        db=db,
        now=now,
        route_provider=route_provider,
        push_provider=FakePushProvider(),
    )

    first_item = db.get(TripItem, 1)
    assert result.arrived_count == 1
    assert first_item is not None
    assert first_item.arrived_at is not None
    assert route_provider.calls == 1
    assert db.scalar(select(DepartureAlert.trip_item_id)) == 2


def test_scan_skips_stale_location(db: Session) -> None:
    now = datetime(2026, 6, 28, 2, 0, tzinfo=timezone.utc)
    _, day = seed_trip(db, now=now - timedelta(minutes=31))
    db.add(
        TripItem(
            id=1,
            trip_day_id=day.id,
            city="上海",
            title="目的地",
            start_time=time(10, 40),
            latitude=Decimal("31.3304000"),
            longitude=Decimal("121.5737000"),
        )
    )
    db.commit()
    route_provider = FakeRouteProvider()

    result = run_departure_alert_scan(
        db=db,
        now=now,
        route_provider=route_provider,
        push_provider=FakePushProvider(),
    )

    assert result.skipped_count == 1
    assert route_provider.calls == 0
    assert db.scalar(select(DepartureAlert.id)) is None

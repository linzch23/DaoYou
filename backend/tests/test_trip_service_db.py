from datetime import date, datetime, time, timezone

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError, ErrorCode
from app.models.trip import Trip, TripDay, TripItem
from app.models.user import User
from app.schemas.trips import (
    CreateTripDayRequest,
    CreateTripItemRequest,
    CreateTripRequest,
    UpdateTripItemRequest,
    UpdateTripRequest,
)
from app.services.trip_service import (
    create_trip,
    create_trip_day,
    create_trip_item,
    delete_trip,
    delete_trip_item,
    get_trip_detail,
    list_trips,
    update_trip,
    update_trip_item,
)


class FakeGeocoder:
    def __init__(
        self,
        *,
        latitude: float = 38.910000,
        longitude: float = 121.610000,
    ) -> None:
        self.latitude = latitude
        self.longitude = longitude
        self.calls: list[tuple[str, str]] = []

    def geocode(self, *, city: str, address: str):
        from app.services.amap_geocoding_provider import GeocodedLocation

        self.calls.append((city, address))
        return GeocodedLocation(
            latitude=self.latitude,
            longitude=self.longitude,
        )


def seed_users(db: Session) -> None:
    db.add_all([User(id=1, nickname="用户一"), User(id=2, nickname="用户二")])
    db.commit()


def create_trip_tree(db: Session, user_id: int = 1) -> tuple[Trip, TripDay, TripItem]:
    trip = Trip(
        user_id=user_id,
        title="测试旅行",
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
        summary="第一天",
    )
    db.add(day)
    db.flush()
    item = TripItem(
        trip_day_id=day.id,
        city="大连",
        title="渔人码头",
        start_time=time(10, 0),
        end_time=time(11, 30),
    )
    db.add(item)
    db.commit()
    return trip, day, item


def test_trip_crud_persists_and_returns_nested_detail(db: Session) -> None:
    seed_users(db)

    trip_id = create_trip(
        CreateTripRequest(
            user_id=1,
            title="大连三日游",
            start_date=date(2026, 7, 1),
            end_date=date(2026, 7, 3),
        ),
        db=db,
    )["trip_id"]
    day_id = create_trip_day(
        trip_id,
        CreateTripDayRequest(
            user_id=1,
            day_index=1,
            trip_date=date(2026, 7, 1),
            summary="海边城市漫游",
        ),
        db=db,
    )["trip_day_id"]
    item_id = create_trip_item(
        CreateTripItemRequest(
            user_id=1,
            trip_day_id=day_id,
            city="大连",
            title="渔人码头",
            start_time=time(10, 0),
            end_time=time(11, 30),
        ),
        db=db,
        geocoder=FakeGeocoder(),
    )["item_id"]

    assert update_trip(
        trip_id,
        UpdateTripRequest(user_id=1, title="大连轻松三日游", status="active"),
        db=db,
    ) == {"updated": True}
    assert update_trip_item(
        item_id,
        UpdateTripItemRequest(user_id=1, status="changed", notes="顺延半小时"),
        db=db,
    ) == {"updated": True}

    detail = get_trip_detail(user_id=1, trip_id=trip_id, db=db)
    assert detail["title"] == "大连轻松三日游"
    assert detail["days"][0]["items"][0]["status"] == "changed"
    assert detail["days"][0]["items"][0]["start_time"] == "10:00"
    assert list_trips(user_id=1, db=db)["trips"][0]["deleted_at"] is None


def test_resource_checks_hide_other_users_resources(db: Session) -> None:
    seed_users(db)
    trip, day, item = create_trip_tree(db, user_id=1)

    operations = [
        lambda: get_trip_detail(user_id=2, trip_id=trip.id, db=db),
        lambda: create_trip_day(
            trip.id,
            CreateTripDayRequest(user_id=2, day_index=2, trip_date=date(2026, 7, 2)),
            db=db,
        ),
        lambda: create_trip_item(
            CreateTripItemRequest(
                user_id=2,
                trip_day_id=day.id,
                city="大连",
                title="越权节点",
            ),
            db=db,
        ),
        lambda: update_trip_item(
            item.id,
            UpdateTripItemRequest(user_id=2, title="越权修改"),
            db=db,
        ),
    ]

    for operation in operations:
        with pytest.raises(AppError) as exc_info:
            operation()
        assert exc_info.value.code == ErrorCode.NOT_FOUND


def test_soft_deleted_trip_is_hidden_from_normal_operations(db: Session) -> None:
    seed_users(db)
    trip, _, _ = create_trip_tree(db)

    result = delete_trip(user_id=1, trip_id=trip.id, db=db)

    assert result["deleted"] is True
    assert result["deleted_at"]
    assert list_trips(user_id=1, db=db) == {"trips": []}
    with pytest.raises(AppError) as exc_info:
        get_trip_detail(user_id=1, trip_id=trip.id, db=db)
    assert exc_info.value.code == ErrorCode.NOT_FOUND


def test_trip_item_time_overlap_is_rejected(db: Session) -> None:
    seed_users(db)
    _, day, _ = create_trip_tree(db)

    with pytest.raises(AppError) as exc_info:
        create_trip_item(
            CreateTripItemRequest(
                user_id=1,
                trip_day_id=day.id,
                city="大连",
                title="重叠景点",
                start_time=time(11, 0),
                end_time=time(12, 0),
            ),
            db=db,
        )

    assert exc_info.value.code == ErrorCode.INVALID_REQUEST


def test_create_trip_day_returns_existing_id_for_exact_retry(db: Session) -> None:
    seed_users(db)
    trip, day, _ = create_trip_tree(db)

    result = create_trip_day(
        trip.id,
        CreateTripDayRequest(
            user_id=1,
            day_index=day.day_index,
            trip_date=day.trip_date,
            summary="重试不应覆盖原摘要",
        ),
        db=db,
    )

    assert result == {"trip_day_id": day.id}
    db.refresh(day)
    assert day.summary == "第一天"


@pytest.mark.parametrize(
    ("day_index", "trip_date"),
    [
        (1, date(2026, 7, 2)),
        (2, date(2026, 7, 1)),
    ],
)
def test_create_trip_day_rejects_partial_duplicate(
    db: Session,
    day_index: int,
    trip_date: date,
) -> None:
    seed_users(db)
    trip, _, _ = create_trip_tree(db)

    with pytest.raises(AppError) as exc_info:
        create_trip_day(
            trip.id,
            CreateTripDayRequest(
                user_id=1,
                day_index=day_index,
                trip_date=trip_date,
            ),
            db=db,
        )

    assert exc_info.value.code == ErrorCode.INVALID_REQUEST


def test_delete_trip_item_removes_owned_item(db: Session) -> None:
    seed_users(db)
    _, _, item = create_trip_tree(db)

    assert delete_trip_item(user_id=1, item_id=item.id, db=db) == {"deleted": True}
    assert db.scalar(select(TripItem).where(TripItem.id == item.id)) is None


def test_trip_item_request_rejects_client_coordinates() -> None:
    with pytest.raises(ValidationError):
        CreateTripItemRequest(
            user_id=1,
            trip_day_id=1,
            city="大连",
            title="渔人码头",
            latitude=38.9,
            longitude=121.6,
        )


def test_create_trip_item_geocodes_address_and_persists_coordinates(
    db: Session,
) -> None:
    seed_users(db)
    _, day, _ = create_trip_tree(db)
    geocoder = FakeGeocoder()

    item_id = create_trip_item(
        CreateTripItemRequest(
            user_id=1,
            trip_day_id=day.id,
            city=" 大连 ",
            title=" 渔人码头 ",
            address=" 滨海东路66号 ",
        ),
        db=db,
        geocoder=geocoder,
    )["item_id"]

    item = db.get(TripItem, item_id)
    assert item is not None
    assert geocoder.calls == [("大连", "滨海东路66号")]
    assert item.city == "大连"
    assert item.title == "渔人码头"
    assert item.address == "滨海东路66号"
    assert float(item.latitude) == 38.91
    assert float(item.longitude) == 121.61


def test_update_trip_item_regeocodes_location_fields_and_clears_arrival(
    db: Session,
) -> None:
    seed_users(db)
    _, _, item = create_trip_tree(db)
    item.latitude = 38.9
    item.longitude = 121.6
    item.arrived_at = datetime.now(timezone.utc)
    item.arrival_distance_meters = 50
    db.commit()
    geocoder = FakeGeocoder(latitude=39.9, longitude=116.4)

    result = update_trip_item(
        item.id,
        UpdateTripItemRequest(user_id=1, city="北京", title="故宫博物院"),
        db=db,
        geocoder=geocoder,
    )

    db.refresh(item)
    assert result == {"updated": True}
    assert geocoder.calls == [("北京", "故宫博物院")]
    assert float(item.latitude) == 39.9
    assert float(item.longitude) == 116.4
    assert item.arrived_at is None
    assert item.arrival_distance_meters is None


def test_update_trip_item_does_not_geocode_time_only_change(db: Session) -> None:
    seed_users(db)
    _, _, item = create_trip_tree(db)
    geocoder = FakeGeocoder()

    update_trip_item(
        item.id,
        UpdateTripItemRequest(user_id=1, notes="提前入场"),
        db=db,
        geocoder=geocoder,
    )

    assert geocoder.calls == []

from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.preference import UserPreference
from app.models.trip import Trip, TripDay, TripItem
from app.models.user import User

DEFAULT_USER_ID = 1
DEMO_TRIP_TITLE = "大连三日游"


@dataclass(frozen=True)
class SeedUser:
    id: int
    nickname: str
    latitude: Decimal
    longitude: Decimal
    location_updated_at: datetime | None


@dataclass(frozen=True)
class SeedTrip:
    user_id: int
    title: str
    start_date: date
    end_date: date
    status: str


@dataclass(frozen=True)
class SeedTripDay:
    day_index: int
    trip_date: date
    summary: str


@dataclass(frozen=True)
class SeedTripItem:
    day_index: int
    city: str
    title: str
    item_type: str
    start_time: time
    end_time: time
    address: str
    latitude: Decimal
    longitude: Decimal
    notes: str


@dataclass(frozen=True)
class DemoSeed:
    user: SeedUser
    trip: SeedTrip
    days: tuple[SeedTripDay, ...]
    items: tuple[SeedTripItem, ...]


def build_demo_seed() -> DemoSeed:
    return DemoSeed(
        user=SeedUser(
            id=DEFAULT_USER_ID,
            nickname="导友演示用户",
            latitude=Decimal("31.2304000"),
            longitude=Decimal("121.4737000"),
            location_updated_at=None,
        ),
        trip=SeedTrip(
            user_id=DEFAULT_USER_ID,
            title=DEMO_TRIP_TITLE,
            start_date=date(2026, 7, 1),
            end_date=date(2026, 7, 3),
            status="active",
        ),
        days=(
            SeedTripDay(1, date(2026, 7, 1), "海边城市漫游"),
            SeedTripDay(2, date(2026, 7, 2), "城市文化与历史"),
            SeedTripDay(3, date(2026, 7, 3), "轻松收尾与返程"),
        ),
        items=(
            SeedTripItem(
                1,
                "大连",
                "渔人码头",
                "attraction",
                time(10, 0),
                time(11, 30),
                "大连市中山区滨海东路66号",
                Decimal("38.8809800"),
                Decimal("121.6806400"),
                "海边散步、拍照和现场讲解。",
            ),
            SeedTripItem(
                1,
                "大连",
                "老虎滩海洋公园",
                "attraction",
                time(14, 0),
                time(17, 0),
                "大连市中山区滨海中路9号",
                Decimal("38.8766100"),
                Decimal("121.6761200"),
                "预留充足游览时间，避免行程过紧。",
            ),
            SeedTripItem(
                2,
                "大连",
                "大连博物馆",
                "attraction",
                time(9, 30),
                time(11, 30),
                "大连市沙河口区会展路10号",
                Decimal("38.9045200"),
                Decimal("121.5902200"),
                "用于演示文化类个性化讲解。",
            ),
            SeedTripItem(
                2,
                "大连",
                "星海广场",
                "attraction",
                time(15, 30),
                time(17, 30),
                "大连市沙河口区中山路572号",
                Decimal("38.8817000"),
                Decimal("121.5831300"),
                "适合傍晚散步和拍照。",
            ),
            SeedTripItem(
                3,
                "大连",
                "东港商务区",
                "attraction",
                time(10, 0),
                time(12, 0),
                "大连市中山区港浦路",
                Decimal("38.9235200"),
                Decimal("121.6801200"),
                "轻松步行，作为返程日前的收尾安排。",
            ),
        ),
    )


def seed_database(session: Session) -> dict[str, int | bool]:
    seed = build_demo_seed()
    user = session.get(User, seed.user.id)
    created_user = user is None
    if user is None:
        user = User(
            id=seed.user.id,
            nickname=seed.user.nickname,
            latitude=seed.user.latitude,
            longitude=seed.user.longitude,
            location_updated_at=seed.user.location_updated_at,
        )
        session.add(user)
        session.flush()

    trip = session.scalar(
        select(Trip).where(
            Trip.user_id == seed.trip.user_id,
            Trip.title == seed.trip.title,
        )
    )
    if trip is not None:
        return {
            "created": False,
            "user_id": user.id,
            "trip_id": trip.id,
            "trip_days": 0,
            "trip_items": 0,
        }

    trip = Trip(
        user_id=seed.trip.user_id,
        title=seed.trip.title,
        start_date=seed.trip.start_date,
        end_date=seed.trip.end_date,
        status=seed.trip.status,
    )
    session.add(trip)
    session.flush()

    days_by_index: dict[int, TripDay] = {}
    for day_data in seed.days:
        trip_day = TripDay(
            trip_id=trip.id,
            day_index=day_data.day_index,
            trip_date=day_data.trip_date,
            summary=day_data.summary,
        )
        session.add(trip_day)
        session.flush()
        days_by_index[day_data.day_index] = trip_day

    for item_data in seed.items:
        session.add(
            TripItem(
                trip_day_id=days_by_index[item_data.day_index].id,
                city=item_data.city,
                title=item_data.title,
                item_type=item_data.item_type,
                start_time=item_data.start_time,
                end_time=item_data.end_time,
                address=item_data.address,
                latitude=item_data.latitude,
                longitude=item_data.longitude,
                notes=item_data.notes,
            )
        )

    session.add(
        UserPreference(
            user_id=user.id,
            preference_key="profile",
            preference_value={
                "explanation_style": "fun",
                "travel_pace": "slow",
                "interests": ["history", "photo"],
                "special_needs": ["less_walking"],
            },
        )
    )
    session.commit()

    return {
        "created": True,
        "created_user": created_user,
        "user_id": user.id,
        "trip_id": trip.id,
        "trip_days": len(seed.days),
        "trip_items": len(seed.items),
    }


def main() -> None:
    with SessionLocal() as session:
        result = seed_database(session)
    print(result)


if __name__ == "__main__":
    main()

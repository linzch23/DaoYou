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


@dataclass(frozen=True)
class SeedUser:
    id: int
    nickname: str
    latitude: Decimal
    longitude: Decimal
    location_updated_at: datetime | None


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
class SeedTripSpec:
    """一条行程的种子规格。days / items 默认空。"""
    title: str
    start_date: date
    end_date: date
    status: str
    deleted_at: datetime | None = None
    days: tuple[SeedTripDay, ...] = ()
    items: tuple[SeedTripItem, ...] = ()


@dataclass(frozen=True)
class DemoSeed:
    user: SeedUser
    trips: tuple[SeedTripSpec, ...]
    preferences: dict[str, object]


def build_demo_seed() -> DemoSeed:
    """Demo 数据规格。

    数据来源:`frontend/api/mock/_seed.ts` 的 seedTrip / seedTrip2-5。
    trip 1 的 5 个 item 与 mock item1-6 不完全一致(后端 seed 之前是独立维护的),
    本函数保留后端既有的 5 item,新增 3 item(午餐日式拉面 / 滨海路骑行 / 返程休整)
    让总数到 8,与 mock 8 item 对齐。
    """
    return DemoSeed(
        user=SeedUser(
            id=DEFAULT_USER_ID,
            nickname="导友演示用户",
            latitude=Decimal("31.2304000"),
            longitude=Decimal("121.4737000"),
            location_updated_at=None,
        ),
        trips=(
            # ───── Trip 1 ───── 大连三日游(active,3 days,8 items)
            SeedTripSpec(
                title="大连三日游",
                start_date=date(2026, 7, 1),
                end_date=date(2026, 7, 3),
                status="active",
                days=(
                    SeedTripDay(1, date(2026, 7, 1), "海边城市漫游"),
                    SeedTripDay(2, date(2026, 7, 2), "城市文化与历史"),
                    SeedTripDay(3, date(2026, 7, 3), "轻松收尾与返程"),
                ),
                items=(
                    # ─── Day 1 ─── 后端既有 2 + 新增「午餐:日式拉面」
                    SeedTripItem(
                        day_index=1,
                        city="大连",
                        title="渔人码头",
                        item_type="attraction",
                        start_time=time(10, 0),
                        end_time=time(11, 30),
                        address="大连市中山区滨海东路66号",
                        latitude=Decimal("38.8809800"),
                        longitude=Decimal("121.6806400"),
                        notes="海边散步、拍照和现场讲解。",
                    ),
                    SeedTripItem(
                        day_index=1,
                        city="大连",
                        title="老虎滩海洋公园",
                        item_type="attraction",
                        start_time=time(14, 0),
                        end_time=time(17, 0),
                        address="大连市中山区滨海中路9号",
                        latitude=Decimal("38.8766100"),
                        longitude=Decimal("121.6761200"),
                        notes="预留充足游览时间,避免行程过紧。",
                    ),
                    SeedTripItem(
                        day_index=1,
                        city="大连",
                        title="午餐:日式拉面",
                        item_type="food",
                        start_time=time(12, 0),
                        end_time=time(13, 0),
                        address="大连市沙河口区黑石礁街",
                        latitude=Decimal("38.8801000"),
                        longitude=Decimal("121.5612000"),
                        notes="",
                    ),
                    # ─── Day 2 ─── 后端既有 2(不新增)
                    SeedTripItem(
                        day_index=2,
                        city="大连",
                        title="大连博物馆",
                        item_type="attraction",
                        start_time=time(9, 30),
                        end_time=time(11, 30),
                        address="大连市沙河口区会展路10号",
                        latitude=Decimal("38.9045200"),
                        longitude=Decimal("121.5902200"),
                        notes="用于演示文化类个性化讲解。",
                    ),
                    SeedTripItem(
                        day_index=2,
                        city="大连",
                        title="星海广场",
                        item_type="attraction",
                        start_time=time(15, 30),
                        end_time=time(17, 30),
                        address="大连市沙河口区中山路572号",
                        latitude=Decimal("38.8817000"),
                        longitude=Decimal("121.5831300"),
                        notes="适合傍晚散步和拍照。",
                    ),
                    # ─── Day 3 ─── 后端既有 1 + 新增「滨海路骑行」+「返程休整」
                    SeedTripItem(
                        day_index=3,
                        city="大连",
                        title="东港商务区",
                        item_type="attraction",
                        start_time=time(10, 0),
                        end_time=time(12, 0),
                        address="大连市中山区港浦路",
                        latitude=Decimal("38.9235200"),
                        longitude=Decimal("121.6801200"),
                        notes="轻松步行,作为返程日前的收尾安排。",
                    ),
                    SeedTripItem(
                        day_index=3,
                        city="大连",
                        title="滨海路骑行",
                        item_type="traffic",
                        start_time=time(8, 30),
                        end_time=time(11, 0),
                        address="大连市滨海路",
                        latitude=Decimal("38.8920000"),
                        longitude=Decimal("121.6055000"),
                        notes="建议租车,提前查看天气。",
                    ),
                    SeedTripItem(
                        day_index=3,
                        city="大连",
                        title="返程休整",
                        item_type="rest",
                        start_time=time(15, 0),
                        end_time=time(17, 0),
                        address="酒店休息",
                        latitude=Decimal("38.9188000"),
                        longitude=Decimal("121.6311000"),
                        notes="",
                    ),
                ),
            ),
            # ───── Trip 2 ───── 青岛两日周末(draft,1 day,0 item)
            SeedTripSpec(
                title="青岛两日周末",
                start_date=date(2026, 8, 15),
                end_date=date(2026, 8, 16),
                status="draft",
                days=(
                    SeedTripDay(1, date(2026, 8, 15), "栈桥 + 八大关"),
                ),
            ),
            # ───── Trip 3 ───── 西安四日文化行(finished,未删除,0 day)
            SeedTripSpec(
                title="西安四日文化行",
                start_date=date(2026, 5, 1),
                end_date=date(2026, 5, 4),
                status="finished",
            ),
            # ───── Trip 4 ───── 西藏自驾游(软删除,演示 TrashPage loaded 态)
            SeedTripSpec(
                title="西藏自驾游",
                start_date=date(2026, 6, 1),
                end_date=date(2026, 6, 3),
                status="finished",
                deleted_at=datetime.fromisoformat("2026-06-04T10:00:00+08:00"),
            ),
            # ───── Trip 5 ───── 上海周末(软删除)
            SeedTripSpec(
                title="上海周末",
                start_date=date(2026, 4, 15),
                end_date=date(2026, 4, 16),
                status="finished",
                deleted_at=datetime.fromisoformat("2026-06-02T15:30:00+08:00"),
            ),
        ),
        preferences={
            "explanation_style": "fun",
            "travel_pace": "slow",
            "interests": ["history", "photo"],
            "special_needs": ["less_walking"],
        },
    )


def _get_or_create_user(session: Session, seed_user: SeedUser) -> tuple[User, bool]:
    """幂等获取/创建用户。返回 (User, created)。"""
    user = session.get(User, seed_user.id)
    created = user is None
    if user is None:
        user = User(
            id=seed_user.id,
            nickname=seed_user.nickname,
            latitude=seed_user.latitude,
            longitude=seed_user.longitude,
            location_updated_at=seed_user.location_updated_at,
        )
        session.add(user)
        session.flush()
    return user, created


def _get_or_create_trip(
    session: Session, user_id: int, spec: SeedTripSpec
) -> tuple[Trip, bool]:
    """幂等获取/创建行程。联合唯一键:(user_id, title)。"""
    trip = session.scalar(
        select(Trip).where(Trip.user_id == user_id, Trip.title == spec.title)
    )
    created = trip is None
    if trip is None:
        trip = Trip(
            user_id=user_id,
            title=spec.title,
            start_date=spec.start_date,
            end_date=spec.end_date,
            status=spec.status,
            deleted_at=spec.deleted_at,
        )
        session.add(trip)
        session.flush()
    return trip, created


def _get_or_create_day(
    session: Session, trip_id: int, spec: SeedTripDay
) -> tuple[TripDay, bool]:
    """幂等获取/创建行程日。联合唯一键:(trip_id, day_index)。"""
    day = session.scalar(
        select(TripDay).where(
            TripDay.trip_id == trip_id, TripDay.day_index == spec.day_index
        )
    )
    created = day is None
    if day is None:
        day = TripDay(
            trip_id=trip_id,
            day_index=spec.day_index,
            trip_date=spec.trip_date,
            summary=spec.summary,
        )
        session.add(day)
        session.flush()
    return day, created


def _get_or_create_item(
    session: Session, trip_day_id: int, spec: SeedTripItem
) -> tuple[TripItem, bool]:
    """幂等获取/创建行程项。联合唯一键:(trip_day_id, title)。"""
    item = session.scalar(
        select(TripItem).where(
            TripItem.trip_day_id == trip_day_id, TripItem.title == spec.title
        )
    )
    created = item is None
    if item is None:
        item = TripItem(
            trip_day_id=trip_day_id,
            city=spec.city,
            title=spec.title,
            item_type=spec.item_type,
            start_time=spec.start_time,
            end_time=spec.end_time,
            address=spec.address,
            latitude=spec.latitude,
            longitude=spec.longitude,
            notes=spec.notes,
        )
        session.add(item)
        session.flush()
    return item, created


def seed_database(session: Session) -> dict[str, object]:
    """把 build_demo_seed() 灌进 db。多次执行是幂等的:
    - 已存在的 trip(user_id+title):跳过
    - 已存在的 day(trip_id+day_index):跳过
    - 已存在的 item(trip_day_id+title):跳过
    - 已存在的 user:update 而不是 insert(避免 created_user 标志位错乱)
    - UserPreference 仅在首次创建用户时插入(bootstrap 语义)
    """
    seed = build_demo_seed()

    user, created_user = _get_or_create_user(session, seed.user)

    trips_total = len(seed.trips)
    days_total = sum(len(trip.days) for trip in seed.trips)
    items_total = sum(len(trip.items) for trip in seed.trips)

    trips_created = 0
    days_created = 0
    items_created = 0
    trip_ids: list[int] = []

    for trip_spec in seed.trips:
        trip, trip_created = _get_or_create_trip(session, user.id, trip_spec)
        if trip_created:
            trips_created += 1
        trip_ids.append(trip.id)

        days_by_index: dict[int, TripDay] = {}
        for day_spec in trip_spec.days:
            day, day_created = _get_or_create_day(session, trip.id, day_spec)
            if day_created:
                days_created += 1
            days_by_index[day_spec.day_index] = day

        for item_spec in trip_spec.items:
            if item_spec.day_index not in days_by_index:
                raise ValueError(
                    f"行程项 '{item_spec.title}' 引用了 day_index={item_spec.day_index},"
                    f"但行程 '{trip_spec.title}' 没有该 day。"
                )
            _, item_created = _get_or_create_item(
                session, days_by_index[item_spec.day_index].id, item_spec
            )
            if item_created:
                items_created += 1

    # UserPreference 仅 bootstrap 时插入;已存在用户不重写
    if created_user:
        session.add(
            UserPreference(
                user_id=user.id,
                preference_key="profile",
                preference_value=seed.preferences,
            )
        )

    session.commit()

    return {
        "created_user": created_user,
        "trips_total": trips_total,
        "trips_created": trips_created,
        "trip_days_total": days_total,
        "trip_days_created": days_created,
        "trip_items_total": items_total,
        "trip_items_created": items_created,
        "trip_ids": trip_ids,
    }


def main() -> None:
    with SessionLocal() as session:
        result = seed_database(session)
    print(result)


if __name__ == "__main__":
    main()
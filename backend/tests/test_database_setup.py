from datetime import date

from app.db.seed import DEFAULT_USER_ID, build_demo_seed


def test_demo_seed_contains_default_user_and_five_trips() -> None:
    seed = build_demo_seed()

    # User
    assert seed.user.id == DEFAULT_USER_ID
    assert seed.user.nickname == "导友演示用户"
    assert seed.user.latitude is not None
    assert seed.user.longitude is not None
    assert seed.user.location_updated_at is None

    # Trips 总览
    assert len(seed.trips) == 5
    titles = [t.title for t in seed.trips]
    assert titles == [
        "大连三日游",
        "青岛两日周末",
        "西安四日文化行",
        "西藏自驾游",
        "上海周末",
    ]

    # Trip 1 详情(主行程)
    trip1 = seed.trips[0]
    assert trip1.title == "大连三日游"
    assert trip1.start_date == date(2026, 7, 1)
    assert trip1.end_date == date(2026, 7, 3)
    assert trip1.status == "active"
    assert trip1.deleted_at is None
    assert [d.day_index for d in trip1.days] == [1, 2, 3]
    assert [d.trip_date for d in trip1.days] == [
        date(2026, 7, 1),
        date(2026, 7, 2),
        date(2026, 7, 3),
    ]


def test_demo_seed_trip1_has_eight_items_across_three_days() -> None:
    seed = build_demo_seed()

    trip1 = seed.trips[0]
    item_day_indexes = {item.day_index for item in trip1.items}

    assert item_day_indexes == {1, 2, 3}
    assert len(trip1.items) == 8
    assert any(item.title == "渔人码头" for item in trip1.items)
    assert all(item.city == "大连" for item in trip1.items)
    # 新增 3 item 来自 mock _seed.ts
    assert any(item.title == "午餐:日式拉面" for item in trip1.items)
    assert any(item.title == "滨海路骑行" for item in trip1.items)
    assert any(item.title == "返程休整" for item in trip1.items)


def test_demo_seed_trip2_is_draft_with_one_day() -> None:
    seed = build_demo_seed()

    trip2 = seed.trips[1]
    assert trip2.title == "青岛两日周末"
    assert trip2.status == "draft"
    assert trip2.deleted_at is None
    assert len(trip2.days) == 1
    assert trip2.days[0].summary == "栈桥 + 八大关"
    assert len(trip2.items) == 0


def test_demo_seed_trips_4_and_5_are_soft_deleted() -> None:
    seed = build_demo_seed()

    # Trip 3 finished 不软删除
    trip3 = seed.trips[2]
    assert trip3.title == "西安四日文化行"
    assert trip3.status == "finished"
    assert trip3.deleted_at is None

    # Trip 4 / 5 软删除,演示 TrashPage loaded 态
    trip4 = seed.trips[3]
    assert trip4.title == "西藏自驾游"
    assert trip4.status == "finished"
    assert trip4.deleted_at is not None
    assert trip4.deleted_at.isoformat() == "2026-06-04T10:00:00+08:00"

    trip5 = seed.trips[4]
    assert trip5.title == "上海周末"
    assert trip5.status == "finished"
    assert trip5.deleted_at is not None
    assert trip5.deleted_at.isoformat() == "2026-06-02T15:30:00+08:00"


def test_demo_seed_preferences_match_existing_profile() -> None:
    seed = build_demo_seed()

    assert seed.preferences["explanation_style"] == "fun"
    assert seed.preferences["travel_pace"] == "slow"
    assert seed.preferences["interests"] == ["history", "photo"]
    assert seed.preferences["special_needs"] == ["less_walking"]
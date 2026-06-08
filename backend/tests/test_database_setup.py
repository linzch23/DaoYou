from datetime import date

from app.db.seed import DEFAULT_USER_ID, build_demo_seed


def test_demo_seed_contains_default_user_and_three_day_trip() -> None:
    seed = build_demo_seed()

    assert seed.user.id == DEFAULT_USER_ID
    assert seed.user.nickname == "导友演示用户"
    assert seed.trip.user_id == DEFAULT_USER_ID
    assert seed.trip.title == "大连三日游"
    assert seed.trip.start_date == date(2026, 7, 1)
    assert seed.trip.end_date == date(2026, 7, 3)
    assert [trip_day.day_index for trip_day in seed.days] == [1, 2, 3]
    assert [trip_day.trip_date for trip_day in seed.days] == [
        date(2026, 7, 1),
        date(2026, 7, 2),
        date(2026, 7, 3),
    ]


def test_demo_seed_contains_items_for_each_trip_day() -> None:
    seed = build_demo_seed()

    item_day_indexes = {item.day_index for item in seed.items}

    assert item_day_indexes == {1, 2, 3}
    assert any(item.title == "渔人码头" for item in seed.items)
    assert all(item.city == "大连" for item in seed.items)


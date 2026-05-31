def get_today_home(user_id: int, trip_id: int, date: str | None = None) -> dict[str, object]:
    return {
        "trip_id": trip_id,
        "trip_title": "大连三日游",
        "city": "大连",
        "date": date or "2026-07-01",
        "today_items": [],
        "unread_reminders": 0,
    }


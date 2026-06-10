from decimal import Decimal

from app.models.trip import Trip, TripDay, TripItem


def serialize_trip_summary(trip: Trip) -> dict[str, object]:
    return {
        "id": trip.id,
        "title": trip.title,
        "start_date": trip.start_date.isoformat(),
        "end_date": trip.end_date.isoformat(),
        "status": trip.status,
        "deleted_at": trip.deleted_at.isoformat() if trip.deleted_at else None,
    }


def serialize_trip_item(item: TripItem) -> dict[str, object]:
    return {
        "id": item.id,
        "trip_day_id": item.trip_day_id,
        "city": item.city,
        "title": item.title,
        "item_type": item.item_type,
        "start_time": item.start_time.strftime("%H:%M") if item.start_time else None,
        "end_time": item.end_time.strftime("%H:%M") if item.end_time else None,
        "address": item.address,
        "latitude": _decimal_to_float(item.latitude),
        "longitude": _decimal_to_float(item.longitude),
        "status": item.status,
        "notes": item.notes,
    }


def serialize_trip_day(day: TripDay, items: list[TripItem]) -> dict[str, object]:
    return {
        "id": day.id,
        "trip_id": day.trip_id,
        "day_index": day.day_index,
        "trip_date": day.trip_date.isoformat(),
        "summary": day.summary,
        "items": [serialize_trip_item(item) for item in items],
    }


def _decimal_to_float(value: Decimal | None) -> float | None:
    return float(value) if value is not None else None

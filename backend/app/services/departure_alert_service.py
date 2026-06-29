import math
from collections.abc import Mapping, Sequence
from enum import Enum

EARTH_RADIUS_METERS = 6_371_000
WARNING_SLACK_SECONDS = 15 * 60
INELIGIBLE_ITEM_STATUSES = frozenset({"done", "completed", "skipped", "cancelled"})


class AlertLevel(str, Enum):
    WARNING = "warning"
    CRITICAL = "critical"


def haversine_distance_meters(
    *,
    origin_latitude: float,
    origin_longitude: float,
    destination_latitude: float,
    destination_longitude: float,
) -> float:
    origin_latitude_radians = math.radians(origin_latitude)
    destination_latitude_radians = math.radians(destination_latitude)
    latitude_delta = math.radians(destination_latitude - origin_latitude)
    longitude_delta = math.radians(destination_longitude - origin_longitude)
    haversine = (
        math.sin(latitude_delta / 2) ** 2
        + math.cos(origin_latitude_radians)
        * math.cos(destination_latitude_radians)
        * math.sin(longitude_delta / 2) ** 2
    )
    return 2 * EARTH_RADIUS_METERS * math.asin(math.sqrt(haversine))


def classify_departure_alert(
    *,
    remaining_seconds: int,
    eta_seconds: int,
) -> AlertLevel | None:
    slack_seconds = remaining_seconds - eta_seconds
    if slack_seconds <= 0:
        return AlertLevel.CRITICAL
    if slack_seconds <= WARNING_SLACK_SECONDS:
        return AlertLevel.WARNING
    return None


def select_next_destination(
    items: Sequence[Mapping[str, object]],
) -> Mapping[str, object] | None:
    eligible_items = [
        item
        for item in items
        if str(item.get("status") or "planned").lower() not in INELIGIBLE_ITEM_STATUSES
        and item.get("arrived_at") is None
        and item.get("start_time") is not None
        and item.get("latitude") is not None
        and item.get("longitude") is not None
    ]
    if not eligible_items:
        return None
    return min(
        eligible_items,
        key=lambda item: (item["start_time"], int(item["id"])),
    )

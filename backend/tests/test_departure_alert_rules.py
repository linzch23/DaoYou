from datetime import time

import pytest

from app.services.departure_alert_service import (
    AlertLevel,
    classify_departure_alert,
    haversine_distance_meters,
    select_next_destination,
)


def test_haversine_distance_treats_199_9_meters_as_arrived() -> None:
    distance = haversine_distance_meters(
        origin_latitude=0.0,
        origin_longitude=0.0,
        destination_latitude=0.00179775,
        destination_longitude=0.0,
    )

    assert distance == pytest.approx(199.9, abs=0.2)
    assert distance < 200


def test_haversine_distance_treats_200_meters_as_not_arrived() -> None:
    distance = haversine_distance_meters(
        origin_latitude=0.0,
        origin_longitude=0.0,
        destination_latitude=0.00179865,
        destination_longitude=0.0,
    )

    assert distance == pytest.approx(200.0, abs=0.2)
    assert distance >= 200


@pytest.mark.parametrize(
    ("slack_seconds", "expected"),
    [
        (16 * 60, None),
        (15 * 60, AlertLevel.WARNING),
        (60, AlertLevel.WARNING),
        (0, AlertLevel.CRITICAL),
        (-60, AlertLevel.CRITICAL),
    ],
)
def test_classify_departure_alert_boundaries(
    slack_seconds: int,
    expected: AlertLevel | None,
) -> None:
    eta_seconds = 30 * 60
    remaining_seconds = eta_seconds + slack_seconds

    assert classify_departure_alert(
        remaining_seconds=remaining_seconds,
        eta_seconds=eta_seconds,
    ) == expected


def test_select_next_destination_skips_ineligible_items() -> None:
    items = [
        {
            "id": 1,
            "start_time": time(9, 0),
            "latitude": 31.1,
            "longitude": 121.1,
            "status": "done",
            "arrived_at": None,
        },
        {
            "id": 2,
            "start_time": time(10, 0),
            "latitude": 31.2,
            "longitude": 121.2,
            "status": "planned",
            "arrived_at": "2026-06-28T02:00:00+00:00",
        },
        {
            "id": 3,
            "start_time": time(11, 0),
            "latitude": None,
            "longitude": 121.3,
            "status": "planned",
            "arrived_at": None,
        },
        {
            "id": 4,
            "start_time": time(12, 0),
            "latitude": 31.4,
            "longitude": 121.4,
            "status": "planned",
            "arrived_at": None,
        },
    ]

    assert select_next_destination(items)["id"] == 4


def test_select_next_destination_orders_by_start_time_then_id() -> None:
    items = [
        {
            "id": 8,
            "start_time": time(10, 0),
            "latitude": 31.8,
            "longitude": 121.8,
            "status": "planned",
            "arrived_at": None,
        },
        {
            "id": 7,
            "start_time": time(10, 0),
            "latitude": 31.7,
            "longitude": 121.7,
            "status": "planned",
            "arrived_at": None,
        },
    ]

    assert select_next_destination(items)["id"] == 7

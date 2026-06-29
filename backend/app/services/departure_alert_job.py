from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Protocol
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.departure_alert import DepartureAlert
from app.models.push_device import DevicePushToken
from app.models.trip import Trip, TripDay, TripItem
from app.models.user import User
from app.services.amap_driving_provider import (
    AmapDrivingError,
    DrivingRoute,
)
from app.services.departure_alert_service import (
    AlertLevel,
    classify_departure_alert,
    haversine_distance_meters,
    select_next_destination,
)
from app.services.vivo_push_provider import PushSendResult, VivoPushError

BUSINESS_TIMEZONE = ZoneInfo("Asia/Shanghai")
LOCATION_MAX_AGE = timedelta(minutes=30)
ARRIVAL_DISTANCE_METERS = 200


class RouteProvider(Protocol):
    def get_route(self, **kwargs: float) -> DrivingRoute: ...


class PushProvider(Protocol):
    def send(self, **kwargs: object) -> PushSendResult: ...


@dataclass
class DepartureAlertScanResult:
    evaluated_count: int = 0
    skipped_count: int = 0
    arrived_count: int = 0
    alert_created_count: int = 0
    sent_count: int = 0
    failed_count: int = 0


def run_departure_alert_scan(
    *,
    db: Session,
    now: datetime,
    route_provider: RouteProvider,
    push_provider: PushProvider,
) -> DepartureAlertScanResult:
    current_time = _as_utc(now)
    local_date = current_time.astimezone(BUSINESS_TIMEZONE).date()
    result = DepartureAlertScanResult()
    users = db.scalars(
        select(User).where(User.location_updated_at.is_not(None)).order_by(User.id)
    ).all()

    for user in users:
        updated_at = _as_utc(user.location_updated_at)
        if current_time - updated_at > LOCATION_MAX_AGE or updated_at > current_time:
            result.skipped_count += 1
            continue

        trip = db.scalar(
            select(Trip)
            .where(
                Trip.user_id == user.id,
                Trip.deleted_at.is_(None),
                Trip.title != "",
                Trip.start_date <= local_date,
                Trip.end_date >= local_date,
            )
            .order_by(Trip.start_date, Trip.id)
        )
        if trip is None:
            result.skipped_count += 1
            continue
        day = db.scalar(
            select(TripDay).where(
                TripDay.trip_id == trip.id,
                TripDay.trip_date == local_date,
            )
        )
        if day is None:
            result.skipped_count += 1
            continue

        items = db.scalars(
            select(TripItem)
            .where(TripItem.trip_day_id == day.id)
            .order_by(TripItem.start_time, TripItem.id)
        ).all()
        item = _select_item(items)
        if item is None:
            result.skipped_count += 1
            continue

        distance = haversine_distance_meters(
            origin_latitude=float(user.latitude),
            origin_longitude=float(user.longitude),
            destination_latitude=float(item.latitude),
            destination_longitude=float(item.longitude),
        )
        if distance < ARRIVAL_DISTANCE_METERS:
            item.arrived_at = current_time
            item.arrival_distance_meters = round(distance)
            db.commit()
            result.arrived_count += 1
            item = _select_item(items, excluded_item_id=item.id)
            if item is None:
                continue
            distance = haversine_distance_meters(
                origin_latitude=float(user.latitude),
                origin_longitude=float(user.longitude),
                destination_latitude=float(item.latitude),
                destination_longitude=float(item.longitude),
            )

        result.evaluated_count += 1
        try:
            route = route_provider.get_route(
                origin_latitude=float(user.latitude),
                origin_longitude=float(user.longitude),
                destination_latitude=float(item.latitude),
                destination_longitude=float(item.longitude),
            )
        except AmapDrivingError:
            result.skipped_count += 1
            continue

        scheduled_at = datetime.combine(
            day.trip_date,
            item.start_time,
            tzinfo=BUSINESS_TIMEZONE,
        ).astimezone(timezone.utc)
        remaining_seconds = int((scheduled_at - current_time).total_seconds())
        level = classify_departure_alert(
            remaining_seconds=remaining_seconds,
            eta_seconds=route.eta_seconds,
        )
        if level is None:
            continue

        alert = db.scalar(
            select(DepartureAlert).where(
                DepartureAlert.trip_item_id == item.id,
                DepartureAlert.level == level.value,
            )
        )
        if alert is not None and (
            alert.push_status == "sent" or alert.retry_count > 1
        ):
            continue
        if alert is None:
            alert = DepartureAlert(
                user_id=user.id,
                trip_id=trip.id,
                trip_item_id=item.id,
                level=level.value,
                scheduled_at=scheduled_at,
                evaluated_at=current_time,
                distance_meters=round(distance),
                eta_seconds=route.eta_seconds,
                remaining_seconds=remaining_seconds,
                push_status="pending",
            )
            db.add(alert)
            db.commit()
            db.refresh(alert)
            result.alert_created_count += 1

        device = db.scalar(
            select(DevicePushToken)
            .where(
                DevicePushToken.user_id == user.id,
                DevicePushToken.provider == "vivo",
                DevicePushToken.enabled.is_(True),
            )
            .order_by(DevicePushToken.last_seen_at.desc(), DevicePushToken.id.desc())
        )
        if device is None:
            result.skipped_count += 1
            continue

        try:
            push_result = push_provider.send(
                reg_id=device.reg_id,
                title=_title(level),
                content=_content(level, item.title, route.eta_seconds),
                payload={
                    "type": "departure_alert",
                    "trip_id": trip.id,
                    "trip_item_id": item.id,
                    "level": level.value,
                },
                request_id=str(alert.request_id),
            )
        except VivoPushError as exc:
            alert.push_status = "failed"
            alert.retry_count += 1
            alert.last_error_code = exc.code
            alert.last_error_message = str(exc)
            alert.updated_at = datetime.now(timezone.utc)
            db.commit()
            result.failed_count += 1
            continue

        alert.push_status = "sent"
        alert.provider_task_id = push_result.provider_task_id
        alert.pushed_at = datetime.now(timezone.utc)
        alert.updated_at = alert.pushed_at
        db.commit()
        result.sent_count += 1

    return result


def _select_item(
    items: list[TripItem],
    *,
    excluded_item_id: int | None = None,
) -> TripItem | None:
    item_by_id = {item.id: item for item in items}
    selected = select_next_destination(
        [
            {
                "id": item.id,
                "start_time": item.start_time,
                "latitude": item.latitude,
                "longitude": item.longitude,
                "status": item.status,
                "arrived_at": item.arrived_at,
            }
            for item in items
            if item.id != excluded_item_id
        ]
    )
    return item_by_id[int(selected["id"])] if selected is not None else None


def _title(level: AlertLevel) -> str:
    return "行程时间紧迫" if level is AlertLevel.CRITICAL else "行程时间提醒"


def _content(level: AlertLevel, title: str, eta_seconds: int) -> str:
    eta_minutes = max(1, round(eta_seconds / 60))
    if level is AlertLevel.CRITICAL:
        return f"前往{title}预计驾车需{eta_minutes}分钟，请立即出发。"
    return f"前往{title}预计驾车需{eta_minutes}分钟，请准备出发。"


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)

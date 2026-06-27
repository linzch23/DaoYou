from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.trip import Trip, TripDay, TripItem


def serialize_trip_summary(trip: Trip, db: Session | None = None) -> dict[str, object]:
    """Serialize a Trip to summary dict.

    v0.6.0(per user-round4-2026-06-26 19:46 bug 修复):新增 `itinerary_count` 字段,
    前端 `src/utils/tripStatus.js:computeEffectiveStatus` 派生完整行程状态用。

    计算方式:
      - 不传 `db` 时返回 0(向后兼容 — 纯 model 调用场景如 get_trip_detail 子计算不被 N+1 影响)
      - 传 `db` 时用 subquery 一次查清,避免 N+1
        (perf:list_trips / list_trashed_trips 场景下 Foreach trip 一次 COUNT 比 lazy load 快 ~10x)

    v0.6.0 决策路径(per `specs/HomePage.md` §3.1.1 v0.6.0 状态机重写 + 跨页 fix-only 协议):
      - 完整行程判定 = title && start_date && itinerary_count >= 1
      - 派生 = client-derive(per `utils/tripStatus.js` v0.6.0 rewrite 4 状态)
      - trip.status 字段后端**不**变(持久化 audit),仅前端派生覆盖 UI 显示
    """
    result: dict[str, object] = {
        "id": trip.id,
        "title": trip.title,
        "start_date": trip.start_date.isoformat(),
        "end_date": trip.end_date.isoformat(),
        "status": trip.status,
        "deleted_at": trip.deleted_at.isoformat() if trip.deleted_at else None,
        "itinerary_count": 0,  # 默认 0,下方覆盖(传 db 时)
    }
    if db is not None:
        # subquery 一次性查清,避免 N+1(list_trips / list_trashed_trips 场景)
        # Trip → TripDay → TripItem 三层 join,COUNT(TripItem.id) 即行程项总数
        count = db.scalar(
            select(func.count(TripItem.id))
            .join(TripDay, TripItem.trip_day_id == TripDay.id)
            .where(TripDay.trip_id == trip.id)
        )
        result["itinerary_count"] = int(count or 0)
    return result


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

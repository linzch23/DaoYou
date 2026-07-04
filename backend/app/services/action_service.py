import hashlib
import json
import uuid
from datetime import date, datetime, timedelta, timezone

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError, ErrorCode
from app.models.chat import ChatMessage
from app.models.pending_action import PendingAction
from app.schemas.trips import CreateTripDayRequest, CreateTripItemRequest, UpdateTripItemRequest
from app.services.resource_service import require_owned_trip
from app.services.trip_service import (
    DestinationGeocoder,
    create_trip_day,
    create_trip_item,
    delete_trip_item,
    get_trip_detail,
    update_trip_item,
)

SUPPORTED_OPERATIONS = {"create_trip_item", "update_trip_item", "delete_trip_item"}
MAX_BATCH_OPERATIONS = 20
CREATE_FIELDS = {
    "city",
    "title",
    "item_type",
    "start_time",
    "end_time",
    "address",
    "notes",
}
UPDATE_FIELDS = CREATE_FIELDS | {"status"}
OPTIONAL_TEXT_FIELDS = {"start_time", "end_time", "address", "notes"}


def create_pending_actions(
    *,
    user_id: int,
    trip_id: int,
    current_trip: dict[str, object],
    action_options: list[dict[str, object]],
    db: Session,
) -> list[dict[str, object]]:
    if not action_options:
        return []
    if current_trip.get("id") != trip_id:
        raise AppError(ErrorCode.INVALID_REQUEST, "当前旅行上下文不一致")

    if len(action_options) > MAX_BATCH_OPERATIONS:
        raise AppError(ErrorCode.INVALID_REQUEST, "一次最多处理 20 项行程操作，请拆分方案")

    if len(action_options) > 1:
        return _create_pending_batch(
            user_id=user_id,
            trip_id=trip_id,
            current_trip=current_trip,
            action_options=action_options,
            db=db,
        )

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.pending_action_ttl_minutes)
    fingerprint = trip_fingerprint(current_trip)
    persisted_options: list[dict[str, object]] = []

    for option in action_options:
        operation = str(option.get("operation") or "")
        if operation not in SUPPORTED_OPERATIONS:
            raise AppError(ErrorCode.AGENT_OUTPUT_INVALID, "Agent 返回了不支持的行程操作")
        if option.get("trip_id") != trip_id:
            raise AppError(ErrorCode.AGENT_OUTPUT_INVALID, "Agent 行程操作归属不一致")
        payload = option.get("payload")
        if not isinstance(payload, dict):
            raise AppError(ErrorCode.AGENT_OUTPUT_INVALID, "Agent 行程操作缺少 payload")
        _validate_option_target(operation, option, payload, current_trip)

        action_id = str(uuid.uuid4())
        target_date = _parse_date(option.get("target_date"))
        record = PendingAction(
            action_id=action_id,
            user_id=user_id,
            trip_id=trip_id,
            operation=operation,
            target_item_id=_optional_positive_int(option.get("item_id")),
            target_trip_day_id=_optional_positive_int(option.get("trip_day_id")),
            target_date=target_date,
            target_day_index=_optional_positive_int(option.get("target_day_index")),
            payload=payload,
            option_snapshot={**option, "payload": payload},
            trip_fingerprint=fingerprint,
            status="pending",
            result=None,
            expires_at=expires_at,
            created_at=now,
            updated_at=now,
        )
        db.add(record)
        persisted_options.append(
            {
                **option,
                "action_id": action_id,
                "status": "pending",
                "expires_at": expires_at.isoformat(),
            }
        )
    db.flush()
    return persisted_options


def get_reusable_pending_batch(
    *,
    user_id: int,
    trip_id: int,
    current_trip: dict[str, object],
    db: Session,
) -> dict[str, object] | None:
    now = datetime.now(timezone.utc)
    record = db.scalar(
        select(PendingAction)
        .where(
            PendingAction.user_id == user_id,
            PendingAction.trip_id == trip_id,
            PendingAction.operation == "batch",
            PendingAction.status == "pending",
            PendingAction.expires_at > now,
            PendingAction.trip_fingerprint == trip_fingerprint(current_trip),
        )
        .order_by(PendingAction.created_at.desc(), PendingAction.id.desc())
    )
    if record is None:
        return None
    operations = record.payload.get("operations")
    if not isinstance(operations, list):
        return None
    return _batch_public_option(record, operations)


def get_reusable_pending_action(
    *,
    user_id: int,
    trip_id: int,
    current_trip: dict[str, object],
    db: Session,
) -> dict[str, object] | None:
    now = datetime.now(timezone.utc)
    record = db.scalar(
        select(PendingAction)
        .where(
            PendingAction.user_id == user_id,
            PendingAction.trip_id == trip_id,
            PendingAction.status == "pending",
            PendingAction.expires_at > now,
            PendingAction.trip_fingerprint == trip_fingerprint(current_trip),
        )
        .order_by(PendingAction.created_at.desc(), PendingAction.id.desc())
    )
    if record is None:
        return None
    if record.operation == "batch":
        operations = record.payload.get("operations")
        return (
            _batch_public_option(record, operations)
            if isinstance(operations, list)
            else None
        )
    return {
        **dict(record.option_snapshot),
        "action_id": record.action_id,
        "status": record.status,
        "expires_at": record.expires_at.isoformat(),
    }


def _create_pending_batch(
    *,
    user_id: int,
    trip_id: int,
    current_trip: dict[str, object],
    action_options: list[dict[str, object]],
    db: Session,
) -> list[dict[str, object]]:
    normalized: list[dict[str, object]] = []
    targeted_item_ids: set[int] = set()
    for index, option in enumerate(action_options, start=1):
        operation = str(option.get("operation") or "")
        if operation not in SUPPORTED_OPERATIONS:
            raise AppError(ErrorCode.AGENT_OUTPUT_INVALID, "Agent 返回了不支持的行程操作")
        if option.get("trip_id") != trip_id:
            raise AppError(ErrorCode.AGENT_OUTPUT_INVALID, "Agent 行程操作归属不一致")
        payload = option.get("payload")
        if not isinstance(payload, dict):
            raise AppError(ErrorCode.AGENT_OUTPUT_INVALID, "Agent 行程操作缺少 payload")
        payload = _normalize_action_payload(payload)
        _validate_option_target(operation, option, payload, current_trip)
        if operation in {"update_trip_item", "delete_trip_item"}:
            item_id = _optional_positive_int(option.get("item_id"))
            if item_id in targeted_item_ids:
                raise AppError(
                    ErrorCode.INVALID_REQUEST,
                    "同一行程项不能在一个批次中重复修改或删除",
                )
            targeted_item_ids.add(item_id)
        normalized.append({
            **option,
            "operation_id": f"operation_{index:03d}",
            "payload": payload,
        })

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.pending_action_ttl_minutes)
    fingerprint = trip_fingerprint(current_trip)
    canonical_payload = {"operations": normalized}
    existing_records = list(db.scalars(
        select(PendingAction).where(
            PendingAction.user_id == user_id,
            PendingAction.trip_id == trip_id,
            PendingAction.operation == "batch",
            PendingAction.status == "pending",
            PendingAction.expires_at > now,
            PendingAction.trip_fingerprint == fingerprint,
        )
    ))
    signature = _batch_execution_signature(normalized)
    existing = next(
        (
            record for record in existing_records
            if _batch_execution_signature(record.payload.get("operations")) == signature
        ),
        None,
    )
    if existing is not None:
        return [_batch_public_option(existing, normalized)]

    action_id = str(uuid.uuid4())
    label = _batch_label(normalized)
    snapshot = {
        "option_id": "batch_001",
        "label": label,
        "description": f"共 {len(normalized)} 项安排",
        "operation": "batch",
        "trip_id": trip_id,
        "operation_count": len(normalized),
    }
    record = PendingAction(
        action_id=action_id,
        user_id=user_id,
        trip_id=trip_id,
        operation="batch",
        target_item_id=None,
        target_trip_day_id=None,
        target_date=None,
        target_day_index=None,
        payload=canonical_payload,
        option_snapshot=snapshot,
        trip_fingerprint=fingerprint,
        status="pending",
        result=None,
        expires_at=expires_at,
        created_at=now,
        updated_at=now,
    )
    db.add(record)
    db.flush()
    return [_batch_public_option(record, normalized)]


def confirm_action(
    action_id: str,
    user_id: int,
    *,
    selected_operation_ids: list[str] | None = None,
    db: Session,
    geocoder: DestinationGeocoder | None = None,
) -> dict[str, object]:
    action = _require_owned_action(action_id, user_id, db=db, for_update=True)
    if action.operation != "batch" and selected_operation_ids is not None:
        raise AppError(ErrorCode.INVALID_REQUEST, "单项操作不能提交批次选择")
    if action.status == "confirmed":
        return _action_result(action, idempotent=True)
    if action.status != "pending":
        raise AppError(ErrorCode.INVALID_REQUEST, f"该操作当前状态为 {action.status}")

    now = datetime.now(timezone.utc)
    if _as_utc(action.expires_at) <= now:
        action.status = "expired"
        action.updated_at = now
        db.commit()
        raise AppError(ErrorCode.INVALID_REQUEST, "该行程操作已过期，请重新生成方案")

    require_owned_trip(db, user_id, action.trip_id)
    current_trip = get_trip_detail(user_id=user_id, trip_id=action.trip_id, db=db)
    if trip_fingerprint(current_trip) != action.trip_fingerprint:
        action.status = "stale"
        action.updated_at = now
        db.commit()
        raise AppError(ErrorCode.INVALID_REQUEST, "行程已发生变化，请重新生成方案")

    try:
        result = _execute_action(
            action,
            current_trip=current_trip,
            selected_operation_ids=selected_operation_ids,
            db=db,
            geocoder=geocoder,
        )
    except ValidationError as exc:
        db.rollback()
        raise AppError(ErrorCode.AGENT_OUTPUT_INVALID, "行程操作参数无效") from exc
    except Exception:
        db.rollback()
        raise
    action.status = "confirmed"
    action.result = result
    action.executed_at = now
    action.updated_at = now
    if action.operation == "batch":
        total = int(result.get("total") or 0)
        db.add(ChatMessage(
            user_id=action.user_id,
            trip_id=action.trip_id,
            role="assistant",
            content=f"已成功写入 {total} 项行程安排。",
        ))
    db.commit()
    return _action_result(action, idempotent=False)


def reject_action(action_id: str, user_id: int, *, db: Session) -> dict[str, object]:
    action = _require_owned_action(action_id, user_id, db=db, for_update=True)
    if action.status == "rejected":
        return {"action_id": action.action_id, "status": "rejected", "idempotent": True}
    if action.status != "pending":
        raise AppError(ErrorCode.INVALID_REQUEST, f"该操作当前状态为 {action.status}")
    action.status = "rejected"
    action.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"action_id": action.action_id, "status": "rejected", "idempotent": False}


def _execute_action(
    action: PendingAction,
    *,
    current_trip: dict[str, object],
    selected_operation_ids: list[str] | None = None,
    db: Session,
    geocoder: DestinationGeocoder | None = None,
) -> dict[str, object]:
    if action.operation == "batch":
        return _execute_batch(
            action,
            current_trip=current_trip,
            selected_operation_ids=selected_operation_ids,
            db=db,
            geocoder=geocoder,
        )
    if action.operation == "create_trip_item":
        payload = _normalize_action_payload(action.payload)
        trip_day_id = action.target_trip_day_id
        if trip_day_id is None:
            if action.target_date is None or action.target_day_index is None:
                raise AppError(ErrorCode.INVALID_REQUEST, "新增操作缺少目标旅行日")
            day_result = create_trip_day(
                action.trip_id,
                CreateTripDayRequest(
                    user_id=action.user_id,
                    day_index=action.target_day_index,
                    trip_date=action.target_date,
                ),
                db=db,
                commit=False,
            )
            trip_day_id = day_result["trip_day_id"]
        return create_trip_item(
            CreateTripItemRequest(
                user_id=action.user_id,
                trip_day_id=trip_day_id,
                **payload,
            ),
            db=db,
            geocoder=geocoder,
            commit=False,
        )
    if action.operation == "update_trip_item":
        if action.target_item_id is None:
            raise AppError(ErrorCode.INVALID_REQUEST, "修改操作缺少目标行程项")
        return update_trip_item(
            action.target_item_id,
            UpdateTripItemRequest(
                user_id=action.user_id,
                **_normalize_action_payload(action.payload),
            ),
            db=db,
            commit=False,
        )
    if action.operation == "delete_trip_item":
        if action.target_item_id is None:
            raise AppError(ErrorCode.INVALID_REQUEST, "删除操作缺少目标行程项")
        return delete_trip_item(
            user_id=action.user_id,
            item_id=action.target_item_id,
            db=db,
            commit=False,
        )
    raise AppError(ErrorCode.INVALID_REQUEST, "不支持的行程操作")


def _execute_batch(
    action: PendingAction,
    *,
    current_trip: dict[str, object],
    selected_operation_ids: list[str] | None,
    db: Session,
    geocoder: DestinationGeocoder | None = None,
) -> dict[str, object]:
    stored_operations = action.payload.get("operations")
    if (
        not isinstance(stored_operations, list)
        or not 1 < len(stored_operations) <= MAX_BATCH_OPERATIONS
    ):
        raise AppError(ErrorCode.AGENT_OUTPUT_INVALID, "批量行程操作格式无效")
    operations, selected_ids = _select_batch_operations(
        stored_operations,
        selected_operation_ids,
    )

    day_cache: dict[tuple[str, object], int] = {}
    for day in current_trip.get("days", []):
        if not isinstance(day, dict):
            continue
        day_id = _optional_positive_int(day.get("id"))
        if day_id is None:
            continue
        if day.get("trip_date"):
            day_cache[("date", str(day["trip_date"]))] = day_id
        if _optional_positive_int(day.get("day_index")) is not None:
            day_cache[("index", int(day["day_index"]))] = day_id

    results: list[dict[str, object]] = []
    counts = {"created": 0, "updated": 0, "deleted": 0}
    for index, option in enumerate(operations, start=1):
        if not isinstance(option, dict):
            raise AppError(ErrorCode.AGENT_OUTPUT_INVALID, "批量行程操作包含无效项目")
        operation = str(option.get("operation") or "")
        payload = option.get("payload")
        if operation not in SUPPORTED_OPERATIONS or not isinstance(payload, dict):
            raise AppError(ErrorCode.AGENT_OUTPUT_INVALID, "批量行程操作包含无效项目")
        payload = _normalize_action_payload(payload)

        if operation == "create_trip_item":
            trip_day_id = _optional_positive_int(option.get("trip_day_id"))
            target_date = str(option.get("target_date") or "")
            target_day_index = _optional_positive_int(option.get("target_day_index"))
            if trip_day_id is None:
                trip_day_id = day_cache.get(("date", target_date))
            if trip_day_id is None and target_day_index is not None:
                trip_day_id = day_cache.get(("index", target_day_index))
            if trip_day_id is None:
                if not target_date or target_day_index is None:
                    raise AppError(ErrorCode.INVALID_REQUEST, "新增操作缺少目标旅行日")
                day_result = create_trip_day(
                    action.trip_id,
                    CreateTripDayRequest(
                        user_id=action.user_id,
                        day_index=target_day_index,
                        trip_date=_parse_date(target_date),
                    ),
                    db=db,
                    commit=False,
                )
                trip_day_id = day_result["trip_day_id"]
                day_cache[("date", target_date)] = trip_day_id
                day_cache[("index", target_day_index)] = trip_day_id
            operation_result = create_trip_item(
                CreateTripItemRequest(
                    user_id=action.user_id,
                    trip_day_id=trip_day_id,
                    **payload,
                ),
                db=db,
                geocoder=geocoder,
                commit=False,
            )
            counts["created"] += 1
        elif operation == "update_trip_item":
            item_id = _optional_positive_int(option.get("item_id"))
            if item_id is None:
                raise AppError(ErrorCode.INVALID_REQUEST, "修改操作缺少目标行程项")
            operation_result = update_trip_item(
                item_id,
                UpdateTripItemRequest(user_id=action.user_id, **payload),
                db=db,
                commit=False,
            )
            counts["updated"] += 1
        else:
            item_id = _optional_positive_int(option.get("item_id"))
            if item_id is None:
                raise AppError(ErrorCode.INVALID_REQUEST, "删除操作缺少目标行程项")
            operation_result = delete_trip_item(
                user_id=action.user_id,
                item_id=item_id,
                db=db,
                commit=False,
            )
            counts["deleted"] += 1
        results.append({
            "index": index,
            "operation": operation,
            "label": str(option.get("label") or ""),
            "result": operation_result,
        })

    return {
        "total": len(results),
        **counts,
        "selected_operation_ids": selected_ids,
        "operations": results,
    }


def _batch_label(operations: list[dict[str, object]]) -> str:
    day_indexes = sorted({
        value
        for option in operations
        if (value := _optional_positive_int(option.get("target_day_index"))) is not None
    })
    if day_indexes:
        days = "和".join(f"第{index}天" for index in day_indexes)
        return f"写入{days}行程"
    return f"应用 {len(operations)} 项行程调整"


def _batch_public_option(
    record: PendingAction,
    operations: list[dict[str, object]],
) -> dict[str, object]:
    return {
        **dict(record.option_snapshot),
        "action_id": record.action_id,
        "operations": [
            {
                key: option.get(key)
                for key in (
                    "operation_id", "operation", "target_day_index", "target_date",
                    "label", "description",
                )
                if option.get(key) is not None
            }
            for option in _operations_with_ids(operations)
        ],
        "status": record.status,
        "expires_at": record.expires_at.isoformat(),
    }


def _batch_execution_signature(operations: object) -> str:
    if not isinstance(operations, list):
        return ""
    execution_fields = (
        "operation", "trip_id", "item_id", "trip_day_id", "target_date",
        "target_day_index", "payload",
    )
    canonical = [
        {key: option.get(key) for key in execution_fields if option.get(key) is not None}
        for option in operations
        if isinstance(option, dict)
    ]
    return json.dumps(canonical, ensure_ascii=False, sort_keys=True, default=str)


def _operations_with_ids(operations: list[object]) -> list[dict[str, object]]:
    return [
        {
            **operation,
            "operation_id": str(operation.get("operation_id") or f"operation_{index:03d}"),
        }
        for index, operation in enumerate(operations, start=1)
        if isinstance(operation, dict)
    ]


def _select_batch_operations(
    operations: list[object],
    selected_operation_ids: list[str] | None,
) -> tuple[list[dict[str, object]], list[str]]:
    normalized = _operations_with_ids(operations)
    available_ids = [str(operation["operation_id"]) for operation in normalized]
    if selected_operation_ids is None:
        return normalized, available_ids
    if not selected_operation_ids:
        raise AppError(ErrorCode.INVALID_REQUEST, "请至少选择一个行程项")
    if len(selected_operation_ids) != len(set(selected_operation_ids)):
        raise AppError(ErrorCode.INVALID_REQUEST, "选择的行程项不能重复")
    unknown_ids = set(selected_operation_ids) - set(available_ids)
    if unknown_ids:
        raise AppError(ErrorCode.INVALID_REQUEST, "选择中包含不属于该方案的行程项")
    selected = set(selected_operation_ids)
    filtered = [
        operation for operation in normalized
        if operation["operation_id"] in selected
    ]
    return filtered, [str(operation["operation_id"]) for operation in filtered]


def _validate_option_target(
    operation: str,
    option: dict[str, object],
    payload: dict[str, object],
    current_trip: dict[str, object],
) -> None:
    days = [day for day in current_trip.get("days", []) if isinstance(day, dict)]
    day_ids = {
        day_id
        for day in days
        if (day_id := _optional_positive_int(day.get("id"))) is not None
    }
    item_ids = {
        item_id
        for day in days
        for item in day.get("items", [])
        if isinstance(item, dict)
        if (item_id := _optional_positive_int(item.get("id"))) is not None
    }
    unexpected_fields = set(payload) - (
        UPDATE_FIELDS if operation == "update_trip_item" else CREATE_FIELDS
    )
    if operation == "delete_trip_item" and payload:
        raise AppError(ErrorCode.AGENT_OUTPUT_INVALID, "删除操作 payload 必须为空")
    if unexpected_fields:
        raise AppError(ErrorCode.AGENT_OUTPUT_INVALID, "Agent 行程操作包含非法字段")

    if operation in {"update_trip_item", "delete_trip_item"}:
        item_id = _optional_positive_int(option.get("item_id"))
        if item_id is None or item_id not in item_ids:
            raise AppError(ErrorCode.AGENT_OUTPUT_INVALID, "目标行程项不属于当前旅行")
        return

    trip_day_id = _optional_positive_int(option.get("trip_day_id"))
    if trip_day_id is not None and trip_day_id not in day_ids:
        raise AppError(ErrorCode.AGENT_OUTPUT_INVALID, "目标旅行日不属于当前旅行")
    if trip_day_id is None and (
        _parse_date(option.get("target_date")) is None
        or _optional_positive_int(option.get("target_day_index")) is None
    ):
        raise AppError(ErrorCode.AGENT_OUTPUT_INVALID, "新增操作缺少目标旅行日")


def _require_owned_action(
    action_id: str,
    user_id: int,
    *,
    db: Session,
    for_update: bool = False,
) -> PendingAction:
    statement = select(PendingAction).where(
        PendingAction.action_id == action_id,
        PendingAction.user_id == user_id,
    )
    if for_update:
        statement = statement.with_for_update()
    action = db.scalar(statement)
    if action is None:
        raise AppError(ErrorCode.NOT_FOUND, "行程操作不存在")
    return action


def trip_fingerprint(trip: dict[str, object]) -> str:
    canonical = json.dumps(trip, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _action_result(action: PendingAction, *, idempotent: bool) -> dict[str, object]:
    return {
        "action_id": action.action_id,
        "status": action.status,
        "operation": action.operation,
        "result": dict(action.result or {}),
        "idempotent": idempotent,
    }


def _parse_date(value: object) -> date | None:
    if value in (None, ""):
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError as exc:
        raise AppError(ErrorCode.AGENT_OUTPUT_INVALID, "Agent 返回了非法目标日期") from exc


def _optional_positive_int(value: object) -> int | None:
    if value in (None, "") or isinstance(value, bool):
        return None
    try:
        parsed = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _normalize_action_payload(payload: dict[str, object]) -> dict[str, object]:
    return {
        key: None if key in OPTIONAL_TEXT_FIELDS and value == "" else value
        for key, value in payload.items()
    }


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)

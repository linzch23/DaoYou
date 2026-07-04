from datetime import date, datetime, time, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.chat import ChatMessage
from app.models.pending_action import PendingAction
from app.models.trip import Trip, TripDay, TripItem
from app.models.user import User
from app.schemas.trips import UpdateTripItemRequest
from app.services.action_service import (
    confirm_action,
    create_pending_actions,
    get_reusable_pending_action,
    reject_action,
)
from app.services.amap_geocoding_provider import GeocodedLocation
from app.services.trip_service import get_trip_detail, update_trip_item


class _FakeGeocoder:
    def geocode(self, *, city: str, address: str) -> GeocodedLocation:
        return GeocodedLocation(
            longitude=121.62,
            latitude=38.91,
        )


def _seed_trip(db: Session) -> TripItem:
    db.add_all([User(id=1, nickname="用户一"), User(id=2, nickname="用户二")])
    db.flush()
    trip = Trip(
        id=1,
        user_id=1,
        title="大连三日游",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 3),
        status="active",
    )
    db.add(trip)
    db.flush()
    day = TripDay(id=10, trip_id=trip.id, day_index=1, trip_date=date(2026, 7, 1))
    db.add(day)
    db.flush()
    item = TripItem(
        id=20,
        trip_day_id=day.id,
        city="大连",
        title="贝壳博物馆",
        item_type="attraction",
        start_time=time(14, 30),
        end_time=time(16, 0),
        status="planned",
    )
    db.add(item)
    db.commit()
    return item


def _create_update_action(db: Session) -> dict[str, object]:
    current_trip = get_trip_detail(user_id=1, trip_id=1, db=db)
    return create_pending_actions(
        user_id=1,
        trip_id=1,
        current_trip=current_trip,
        action_options=[
            {
                "option_id": "option_001",
                "label": "改为附近咖啡馆休息",
                "description": "减少步行",
                "operation": "update_trip_item",
                "trip_id": 1,
                "item_id": 20,
                "payload": {
                    "title": "附近咖啡馆休息",
                    "item_type": "rest",
                    "status": "changed",
                },
            }
        ],
        db=db,
    )[0]


def test_pending_action_is_persisted_without_trusting_client_payload(db: Session) -> None:
    _seed_trip(db)

    option = _create_update_action(db)
    db.commit()
    record = db.scalar(select(PendingAction).where(PendingAction.action_id == option["action_id"]))

    assert record is not None
    assert record.status == "pending"
    assert record.payload["title"] == "附近咖啡馆休息"
    assert option["expires_at"]


def test_pending_action_rejects_unknown_payload_fields(db: Session) -> None:
    _seed_trip(db)
    current_trip = get_trip_detail(user_id=1, trip_id=1, db=db)

    with pytest.raises(AppError, match="非法字段"):
        create_pending_actions(
            user_id=1,
            trip_id=1,
            current_trip=current_trip,
            action_options=[
                {
                    "operation": "update_trip_item",
                    "trip_id": 1,
                    "item_id": 20,
                    "payload": {"title": "合法标题", "user_id": 2},
                }
            ],
            db=db,
        )


def test_confirm_action_executes_once_and_is_idempotent(db: Session) -> None:
    item = _seed_trip(db)
    option = _create_update_action(db)
    db.commit()

    first = confirm_action(str(option["action_id"]), user_id=1, db=db)
    second = confirm_action(str(option["action_id"]), user_id=1, db=db)
    db.refresh(item)

    assert first["status"] == "confirmed"
    assert first["idempotent"] is False
    assert second["idempotent"] is True
    assert item.title == "附近咖啡馆休息"
    assert item.status == "changed"


def test_action_cannot_be_confirmed_by_another_user(db: Session) -> None:
    _seed_trip(db)
    option = _create_update_action(db)
    db.commit()

    with pytest.raises(AppError, match="行程操作不存在"):
        confirm_action(str(option["action_id"]), user_id=2, db=db)


def test_action_becomes_stale_after_trip_changes(db: Session) -> None:
    item = _seed_trip(db)
    option = _create_update_action(db)
    db.commit()
    update_trip_item(
        item.id,
        UpdateTripItemRequest(user_id=1, notes="用户在另一页面修改了备注"),
        db=db,
    )

    with pytest.raises(AppError, match="行程已发生变化"):
        confirm_action(str(option["action_id"]), user_id=1, db=db)

    record = db.scalar(select(PendingAction).where(PendingAction.action_id == option["action_id"]))
    assert record is not None
    assert record.status == "stale"


def test_expired_action_is_rejected_and_recorded(db: Session) -> None:
    _seed_trip(db)
    option = _create_update_action(db)
    db.flush()
    record = db.scalar(select(PendingAction).where(PendingAction.action_id == option["action_id"]))
    assert record is not None
    record.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit()

    with pytest.raises(AppError, match="已过期"):
        confirm_action(str(option["action_id"]), user_id=1, db=db)

    assert record.status == "expired"


def test_reject_action_is_idempotent_and_cannot_later_execute(db: Session) -> None:
    _seed_trip(db)
    option = _create_update_action(db)
    db.commit()

    first = reject_action(str(option["action_id"]), user_id=1, db=db)
    second = reject_action(str(option["action_id"]), user_id=1, db=db)

    assert first["idempotent"] is False
    assert second["idempotent"] is True
    with pytest.raises(AppError, match="rejected"):
        confirm_action(str(option["action_id"]), user_id=1, db=db)


def test_create_action_can_atomically_create_missing_day_and_item(db: Session) -> None:
    _seed_trip(db)
    current_trip = get_trip_detail(user_id=1, trip_id=1, db=db)
    option = create_pending_actions(
        user_id=1,
        trip_id=1,
        current_trip=current_trip,
        action_options=[
            {
                "option_id": "option_001",
                "label": "第二天新增公园",
                "operation": "create_trip_item",
                "trip_id": 1,
                "target_date": "2026-07-02",
                "target_day_index": 2,
                "payload": {
                    "city": "大连",
                    "title": "劳动公园",
                    "item_type": "attraction",
                    "start_time": "10:00",
                    "end_time": "11:30",
                },
            }
        ],
        db=db,
    )[0]
    db.commit()

    result = confirm_action(str(option["action_id"]), user_id=1, db=db)
    created = db.scalar(select(TripItem).where(TripItem.title == "劳动公园"))

    assert result["status"] == "confirmed"
    assert created is not None
    assert created.trip_day_id != 10


def _create_batch_action(db: Session, action_options: list[dict[str, object]]) -> dict[str, object]:
    current_trip = get_trip_detail(user_id=1, trip_id=1, db=db)
    options = create_pending_actions(
        user_id=1,
        trip_id=1,
        current_trip=current_trip,
        action_options=action_options,
        db=db,
    )
    assert len(options) == 1
    assert options[0]["operation"] == "batch"
    return options[0]


def test_batch_confirm_creates_multiple_days_and_items_once(db: Session) -> None:
    _seed_trip(db)
    option = _create_batch_action(db, [
        {
            "operation": "create_trip_item", "trip_id": 1,
            "target_date": "2026-07-02", "target_day_index": 2,
            "label": "第二天新增星海广场",
            "payload": {"city": "大连", "title": "星海广场", "start_time": "09:00"},
        },
        {
            "operation": "create_trip_item", "trip_id": 1,
            "target_date": "2026-07-02", "target_day_index": 2,
            "label": "第二天新增贝壳博物馆",
            "payload": {"city": "大连", "title": "大连贝壳博物馆", "start_time": "14:00"},
        },
        {
            "operation": "create_trip_item", "trip_id": 1,
            "target_date": "2026-07-03", "target_day_index": 3,
            "label": "第三天新增东港",
            "payload": {"city": "大连", "title": "东港", "start_time": "10:00"},
        },
    ])
    db.commit()

    first = confirm_action(
        str(option["action_id"]), user_id=1, db=db, geocoder=_FakeGeocoder()
    )
    second = confirm_action(
        str(option["action_id"]), user_id=1, db=db, geocoder=_FakeGeocoder()
    )
    days = list(db.scalars(select(TripDay).where(TripDay.trip_id == 1)))
    titles = set(db.scalars(select(TripItem.title)).all())
    success_messages = list(db.scalars(
        select(ChatMessage).where(ChatMessage.content == "已成功写入 3 项行程安排。")
    ))

    assert first["result"]["total"] == 3
    assert first["result"]["created"] == 3
    assert first["result"]["updated"] == 0
    assert second["idempotent"] is True
    assert len(days) == 3
    assert {"星海广场", "大连贝壳博物馆", "东港"} <= titles
    assert len(success_messages) == 1
    assert [
        operation["operation_id"] for operation in option["operations"]
    ] == ["operation_001", "operation_002", "operation_003"]
    assert first["result"]["selected_operation_ids"] == [
        "operation_001", "operation_002", "operation_003",
    ]


def test_batch_confirm_executes_only_selected_operations(db: Session) -> None:
    _seed_trip(db)
    option = _create_batch_action(db, [
        {
            "operation": "create_trip_item", "trip_id": 1,
            "target_date": "2026-07-02", "target_day_index": 2,
            "payload": {"city": "大连", "title": "第一项", "start_time": "09:00"},
        },
        {
            "operation": "create_trip_item", "trip_id": 1,
            "target_date": "2026-07-02", "target_day_index": 2,
            "payload": {"city": "大连", "title": "第二项", "start_time": "11:00"},
        },
        {
            "operation": "create_trip_item", "trip_id": 1,
            "target_date": "2026-07-02", "target_day_index": 2,
            "payload": {"city": "大连", "title": "第三项", "start_time": "14:00"},
        },
    ])
    db.commit()

    first = confirm_action(
        str(option["action_id"]),
        user_id=1,
        selected_operation_ids=["operation_001", "operation_003"],
        db=db,
        geocoder=_FakeGeocoder(),
    )
    second = confirm_action(
        str(option["action_id"]),
        user_id=1,
        selected_operation_ids=["operation_002"],
        db=db,
        geocoder=_FakeGeocoder(),
    )
    titles = set(db.scalars(select(TripItem.title)).all())

    assert first["result"]["total"] == 2
    assert first["result"]["selected_operation_ids"] == [
        "operation_001", "operation_003",
    ]
    assert second["idempotent"] is True
    assert second["result"] == first["result"]
    assert {"第一项", "第三项"} <= titles
    assert "第二项" not in titles


@pytest.mark.parametrize(
    ("selected_ids", "message"),
    [
        ([], "至少选择一个"),
        (["operation_001", "operation_001"], "不能重复"),
        (["operation_999"], "不属于该方案"),
    ],
)
def test_batch_confirm_rejects_invalid_selection(
    db: Session,
    selected_ids: list[str],
    message: str,
) -> None:
    _seed_trip(db)
    option = _create_batch_action(db, [
        {
            "operation": "create_trip_item", "trip_id": 1, "trip_day_id": 10,
            "payload": {"city": "大连", "title": "第一项"},
        },
        {
            "operation": "create_trip_item", "trip_id": 1, "trip_day_id": 10,
            "payload": {"city": "大连", "title": "第二项"},
        },
    ])
    db.commit()

    with pytest.raises(AppError, match=message):
        confirm_action(
            str(option["action_id"]),
            user_id=1,
            selected_operation_ids=selected_ids,
            db=db,
            geocoder=_FakeGeocoder(),
        )

    assert db.scalar(select(TripItem).where(TripItem.title == "第一项")) is None


def test_legacy_batch_without_operation_ids_supports_partial_selection(db: Session) -> None:
    _seed_trip(db)
    option = _create_batch_action(db, [
        {
            "operation": "create_trip_item", "trip_id": 1, "trip_day_id": 10,
            "payload": {"city": "大连", "title": "旧方案第一项"},
        },
        {
            "operation": "create_trip_item", "trip_id": 1, "trip_day_id": 10,
            "payload": {"city": "大连", "title": "旧方案第二项"},
        },
    ])
    record = db.scalar(select(PendingAction).where(
        PendingAction.action_id == option["action_id"]
    ))
    record.payload = {
        "operations": [
            {key: value for key, value in operation.items() if key != "operation_id"}
            for operation in record.payload["operations"]
        ]
    }
    db.commit()

    public_option = get_reusable_pending_action(
        user_id=1,
        trip_id=1,
        current_trip=get_trip_detail(user_id=1, trip_id=1, db=db),
        db=db,
    )
    result = confirm_action(
        str(option["action_id"]),
        user_id=1,
        selected_operation_ids=["operation_002"],
        db=db,
        geocoder=_FakeGeocoder(),
    )

    assert [operation["operation_id"] for operation in public_option["operations"]] == [
        "operation_001", "operation_002",
    ]
    assert result["result"]["selected_operation_ids"] == ["operation_002"]
    assert db.scalar(select(TripItem).where(TripItem.title == "旧方案第一项")) is None
    assert db.scalar(select(TripItem).where(TripItem.title == "旧方案第二项")) is not None


def test_single_action_rejects_batch_selection(db: Session) -> None:
    _seed_trip(db)
    current_trip = get_trip_detail(user_id=1, trip_id=1, db=db)
    option = create_pending_actions(
        user_id=1,
        trip_id=1,
        current_trip=current_trip,
        action_options=[{
            "operation": "create_trip_item", "trip_id": 1, "trip_day_id": 10,
            "payload": {"city": "大连", "title": "单项操作"},
        }],
        db=db,
    )[0]
    db.commit()

    with pytest.raises(AppError, match="单项操作不能提交批次选择"):
        confirm_action(
            str(option["action_id"]),
            user_id=1,
            selected_operation_ids=["operation_001"],
            db=db,
        )


def test_batch_confirm_normalizes_blank_optional_item_fields(db: Session) -> None:
    _seed_trip(db)
    option = _create_batch_action(db, [
        {
            "operation": "create_trip_item", "trip_id": 1,
            "target_date": "2026-07-02", "target_day_index": 2,
            "payload": {
                "city": "大连", "title": "陈家祠", "start_time": "09:00",
                "end_time": "", "address": "", "notes": "室内景点",
            },
        },
        {
            "operation": "create_trip_item", "trip_id": 1,
            "target_date": "2026-07-02", "target_day_index": 2,
            "payload": {
                "city": "大连", "title": "沙面岛", "start_time": "14:00",
                "end_time": "", "address": "",
            },
        },
    ])
    db.commit()

    result = confirm_action(
        str(option["action_id"]), user_id=1, db=db, geocoder=_FakeGeocoder()
    )
    chen_clan = db.scalar(select(TripItem).where(TripItem.title == "陈家祠"))

    assert result["result"]["created"] == 2
    assert chen_clan is not None
    assert chen_clan.end_time is None
    assert chen_clan.address is None


def test_batch_failure_rolls_back_every_operation(db: Session) -> None:
    _seed_trip(db)
    option = _create_batch_action(db, [
        {
            "operation": "create_trip_item", "trip_id": 1,
            "target_date": "2026-07-02", "target_day_index": 2,
            "payload": {
                "city": "大连", "title": "第一项", "start_time": "09:00", "end_time": "11:00"
            },
        },
        {
            "operation": "create_trip_item", "trip_id": 1,
            "target_date": "2026-07-02", "target_day_index": 2,
            "payload": {
                "city": "大连", "title": "冲突项", "start_time": "10:00", "end_time": "12:00"
            },
        },
    ])
    db.commit()

    with pytest.raises(AppError, match="已有行程"):
        confirm_action(
            str(option["action_id"]), user_id=1, db=db, geocoder=_FakeGeocoder()
        )

    assert db.scalar(select(TripDay).where(TripDay.day_index == 2)) is None
    assert db.scalar(select(TripItem).where(TripItem.title == "第一项")) is None


def test_batch_rejects_duplicate_existing_item_targets(db: Session) -> None:
    _seed_trip(db)
    current_trip = get_trip_detail(user_id=1, trip_id=1, db=db)

    with pytest.raises(AppError, match="重复修改或删除"):
        create_pending_actions(
            user_id=1,
            trip_id=1,
            current_trip=current_trip,
            action_options=[
                {
                    "operation": "update_trip_item",
                    "trip_id": 1,
                    "item_id": 20,
                    "payload": {"title": "A"},
                },
                {"operation": "delete_trip_item", "trip_id": 1, "item_id": 20, "payload": {}},
            ],
            db=db,
        )


def test_batch_supports_mixed_create_update_and_delete(db: Session) -> None:
    _seed_trip(db)
    db.add(TripItem(
        id=21,
        trip_day_id=10,
        city="大连",
        title="待删除节点",
        status="planned",
    ))
    db.commit()
    option = _create_batch_action(db, [
        {
            "operation": "update_trip_item", "trip_id": 1, "item_id": 20,
            "label": "调整贝壳博物馆",
            "payload": {"notes": "改为轻松游览"},
        },
        {
            "operation": "delete_trip_item", "trip_id": 1, "item_id": 21,
            "label": "删除原节点", "payload": {},
        },
        {
            "operation": "create_trip_item", "trip_id": 1, "trip_day_id": 10,
            "label": "新增星海广场",
            "payload": {"city": "大连", "title": "星海广场"},
        },
    ])
    db.commit()

    result = confirm_action(
        str(option["action_id"]), user_id=1, db=db, geocoder=_FakeGeocoder()
    )

    assert result["result"]["created"] == 1
    assert result["result"]["updated"] == 1
    assert result["result"]["deleted"] == 1
    assert db.get(TripItem, 20).notes == "改为轻松游览"
    db.expire_all()
    assert db.scalar(select(TripItem).where(TripItem.title == "待删除节点")) is None
    assert db.scalar(select(TripItem).where(TripItem.title == "星海广场")) is not None

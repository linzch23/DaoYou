import base64
import mimetypes
import re
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

import httpx

from app.agent.state import AgentState
from app.core.config import settings

DEFAULT_TRIP = {
    "id": 1,
    "title": "大连三日游",
    "days": [
        {
            "id": 1,
            "day_index": 1,
            "trip_date": "2026-07-01",
            "items": [
                {
                    "id": 1,
                    "city": "大连",
                    "title": "渔人码头",
                    "item_type": "attraction",
                    "start_time": "10:00",
                    "end_time": "11:30",
                    "address": "大连市中山区滨海路",
                    "status": "planned",
                },
                {
                    "id": 3,
                    "city": "大连",
                    "title": "贝壳博物馆",
                    "item_type": "attraction",
                    "start_time": "14:30",
                    "end_time": "16:00",
                    "address": "星海广场附近",
                    "status": "planned",
                },
            ],
        }
    ],
}

DEFAULT_PREFERENCES = {
    "explanation_style": "fun",
    "travel_pace": "slow",
    "interests": ["history", "photo"],
    "special_needs": ["less_walking"],
}

CREATE_TRIP_ITEM_FIELDS = {
    "city",
    "title",
    "item_type",
    "start_time",
    "end_time",
    "address",
    "notes",
}
UPDATE_TRIP_ITEM_FIELDS = CREATE_TRIP_ITEM_FIELDS | {"status"}


# 行程工具：当前读取传入上下文或演示默认行程，后续可接 trips 相关数据库查询。
def trip_tool(state: AgentState) -> dict[str, object]:
    return dict(state.get("current_trip") or DEFAULT_TRIP)


# 记忆工具：当前读取传入偏好或默认画像，后续可接 user_memory/user_preferences。
def memory_tool(state: AgentState) -> dict[str, object]:
    return dict(state.get("user_preferences") or DEFAULT_PREFERENCES)


# 行程项工具：只校验并生成待确认操作，不在 Agent 推理阶段写数据库。
def trip_item_tool(
    state: AgentState,
    operation: dict[str, object],
) -> dict[str, object]:
    trip = trip_tool(state)
    trip_id = _positive_int(trip.get("id"))
    state_trip_id = _positive_int(state.get("trip_id"))
    if trip_id is None or state_trip_id is None or trip_id != state_trip_id:
        return {"error": "当前聊天绑定的旅行与行程上下文不一致"}

    operation_name = str(operation.get("operation") or "")
    if operation_name == "delete_trip_item":
        return _build_delete_trip_item_action(state, trip_id, trip, operation)

    payload_source = operation.get("payload")
    if not isinstance(payload_source, dict):
        return {"error": "行程项方案缺少 payload"}

    if operation_name == "create_trip_item":
        return _build_create_trip_item_action(trip_id, trip, operation, payload_source)
    if operation_name == "update_trip_item":
        return _build_update_trip_item_action(state, trip_id, trip, operation, payload_source)
    return {"error": "不支持的行程项操作"}


def _build_create_trip_item_action(
    trip_id: int,
    trip: dict[str, object],
    operation: dict[str, object],
    payload_source: dict[str, object],
) -> dict[str, object]:
    target_day = _resolve_trip_day(trip, operation)
    if target_day is None:
        return {"error": "请明确要添加到旅行中的哪一天"}

    payload = _filter_trip_item_payload(payload_source, CREATE_TRIP_ITEM_FIELDS)
    if not payload.get("city"):
        city = _trip_day_city(target_day)
        if city:
            payload["city"] = city
    if not payload.get("title"):
        return {"error": "请说明要新增的景点、餐饮或休息安排"}
    if not payload.get("city"):
        return {"error": "请说明新增安排所在的城市"}

    title = str(payload["title"])
    action_option = {
        "option_id": str(operation.get("option_id") or "option_001"),
        "label": str(operation.get("label") or f"新增{title}"),
        "description": str(operation.get("description") or "添加到当前旅行安排"),
        "operation": "create_trip_item",
        "trip_id": trip_id,
        "payload": payload,
    }
    trip_day_id = _positive_int(target_day.get("id"))
    if trip_day_id is not None:
        action_option["trip_day_id"] = trip_day_id
    else:
        action_option["target_date"] = str(target_day["trip_date"])
        action_option["target_day_index"] = int(target_day["day_index"])
    return {"action_option": action_option}


def _build_update_trip_item_action(
    state: AgentState,
    trip_id: int,
    trip: dict[str, object],
    operation: dict[str, object],
    payload_source: dict[str, object],
) -> dict[str, object]:
    target_item = _resolve_trip_item(state, trip, operation)
    if target_item is None:
        return {"error": "请明确要修改当前旅行中的哪一项安排"}

    payload = _filter_trip_item_payload(payload_source, UPDATE_TRIP_ITEM_FIELDS)
    if not payload:
        return {"error": "请说明要修改的内容"}

    item_id = _positive_int(target_item.get("id"))
    if item_id is None:
        return {"error": "目标行程项缺少有效 ID"}

    title = str(target_item.get("title") or "当前安排")
    return {
        "action_option": {
            "option_id": str(operation.get("option_id") or "option_001"),
            "label": str(operation.get("label") or f"修改{title}"),
            "description": str(operation.get("description") or "更新当前旅行安排"),
            "operation": "update_trip_item",
            "trip_id": trip_id,
            "item_id": item_id,
            "payload": payload,
        }
    }


def _build_delete_trip_item_action(
    state: AgentState,
    trip_id: int,
    trip: dict[str, object],
    operation: dict[str, object],
) -> dict[str, object]:
    target_item = _resolve_trip_item(state, trip, operation)
    if target_item is None:
        return {"error": "请明确要删除当前旅行中的哪一项安排"}

    item_id = _positive_int(target_item.get("id"))
    if item_id is None:
        return {"error": "目标行程项缺少有效 ID"}
    title = str(target_item.get("title") or "当前安排")
    return {
        "action_option": {
            "option_id": str(operation.get("option_id") or "option_001"),
            "label": str(operation.get("label") or f"删除{title}"),
            "description": str(operation.get("description") or "永久删除该行程项"),
            "operation": "delete_trip_item",
            "trip_id": trip_id,
            "item_id": item_id,
            "payload": {},
        }
    }


def _resolve_trip_day(
    trip: dict[str, object],
    operation: dict[str, object],
) -> dict[str, object] | None:
    days = [day for day in trip.get("days", []) if isinstance(day, dict)]
    target_date = str(operation.get("target_date") or "")
    target_day_index = _positive_int(operation.get("target_day_index"))

    matches = [
        day
        for day in days
        if (target_date and str(day.get("trip_date") or "") == target_date)
        or (target_day_index is not None and day.get("day_index") == target_day_index)
    ]
    if len(matches) == 1:
        return matches[0]
    if not target_date and target_day_index is None and len(days) == 1:
        return days[0]
    return _build_missing_trip_day(trip, target_date, target_day_index)


def _build_missing_trip_day(
    trip: dict[str, object],
    target_date: str,
    target_day_index: int | None,
) -> dict[str, object] | None:
    try:
        start_date = date.fromisoformat(str(trip.get("start_date") or ""))
        end_date = date.fromisoformat(str(trip.get("end_date") or ""))
    except ValueError:
        return None

    resolved_date: date | None = None
    resolved_index = target_day_index
    if target_date:
        try:
            resolved_date = date.fromisoformat(target_date)
        except ValueError:
            return None
        expected_index = (resolved_date - start_date).days + 1
        if resolved_index is not None and resolved_index != expected_index:
            return None
        resolved_index = expected_index
    elif resolved_index is not None:
        resolved_date = start_date + timedelta(days=resolved_index - 1)
    elif start_date == end_date:
        resolved_date = start_date
        resolved_index = 1

    if (
        resolved_date is None
        or resolved_index is None
        or not start_date <= resolved_date <= end_date
    ):
        return None
    return {
        "id": None,
        "day_index": resolved_index,
        "trip_date": resolved_date.isoformat(),
        "items": [],
    }


def _resolve_trip_item(
    state: AgentState,
    trip: dict[str, object],
    operation: dict[str, object],
) -> dict[str, object] | None:
    items = [
        {
            **item,
            "_day_index": day.get("day_index"),
            "_trip_date": day.get("trip_date"),
        }
        for day in trip.get("days", [])
        if isinstance(day, dict)
        for item in day.get("items", [])
        if isinstance(item, dict)
    ]
    target_item_id = _positive_int(operation.get("target_item_id"))
    if target_item_id is not None:
        return next(
            (item for item in items if _positive_int(item.get("id")) == target_item_id),
            None,
        )

    target_title = str(operation.get("target_item_title") or "").strip()
    hinted_items = _filter_trip_items_by_hints(state, items, operation)
    search_items = hinted_items or items
    if target_title:
        exact_matches = [
            item
            for item in search_items
            if _normalize_item_title(item.get("title")) == _normalize_item_title(target_title)
        ]
        if len(exact_matches) == 1:
            return exact_matches[0]
        contains_matches = _items_mentioned_in_text(search_items, target_title)
        return contains_matches[0] if len(contains_matches) == 1 else None

    message = str(state.get("user_message") or "")
    message_matches = _items_mentioned_in_text(search_items, message)
    if len(message_matches) == 1:
        return message_matches[0]
    if len(message_matches) > 1:
        return None

    if len(hinted_items) == 1:
        return hinted_items[0]

    history = state.get("chat_history")
    if isinstance(history, list):
        for history_message in reversed(history[-12:]):
            if not isinstance(history_message, dict):
                continue
            matches = _items_mentioned_in_text(
                search_items,
                str(history_message.get("content") or ""),
            )
            if len(matches) == 1:
                return matches[0]
            if len(matches) > 1:
                return None

    return search_items[0] if len(search_items) == 1 else None


def _filter_trip_items_by_hints(
    state: AgentState,
    items: list[dict[str, object]],
    operation: dict[str, object],
) -> list[dict[str, object]]:
    message = str(state.get("user_message") or "")
    target_date = str(operation.get("target_date") or "")
    target_day_index = _positive_int(operation.get("target_day_index"))
    if target_day_index is None:
        target_day_index = _extract_day_index(message)
    target_start_time = str(operation.get("target_start_time") or "")
    if not target_start_time:
        target_start_time = _extract_start_time(message)

    has_hint = bool(target_date or target_day_index is not None or target_start_time)
    if not has_hint:
        return []
    return [
        item
        for item in items
        if (not target_date or str(item.get("_trip_date") or "") == target_date)
        and (target_day_index is None or item.get("_day_index") == target_day_index)
        and (
            not target_start_time
            or str(item.get("start_time") or "")[:5] == target_start_time
        )
    ]


def _items_mentioned_in_text(
    items: list[dict[str, object]],
    text: str,
) -> list[dict[str, object]]:
    normalized_text = _normalize_item_title(text)
    if not normalized_text:
        return []
    return [
        item
        for item in items
        if any(
            len(alias) >= 2 and alias in normalized_text
            for alias in _item_title_aliases(item.get("title"))
        )
        or (
            len(normalized_text) >= 2
            and normalized_text in _normalize_item_title(item.get("title"))
        )
    ]


def _item_title_aliases(value: object) -> set[str]:
    title = _normalize_item_title(value)
    aliases = {title} if title else set()
    for suffix in ["游览", "参观", "景点", "行程", "活动"]:
        if title.endswith(suffix) and len(title) > len(suffix):
            aliases.add(title[: -len(suffix)])
    return aliases


def _normalize_item_title(value: object) -> str:
    return re.sub(r"[\s，。！？、,.!?：:（）()\-]", "", str(value or "")).lower()


def _extract_day_index(message: str) -> int | None:
    match = re.search(r"第([一二三四五六七八九十\d]+)天", message)
    if match is None:
        return None
    value = match.group(1)
    chinese_numbers = {
        "一": 1,
        "二": 2,
        "三": 3,
        "四": 4,
        "五": 5,
        "六": 6,
        "七": 7,
        "八": 8,
        "九": 9,
        "十": 10,
    }
    return chinese_numbers.get(value) or _positive_int(value)


def _extract_start_time(message: str) -> str:
    match = re.search(r"(?:上午|下午|晚上|早上)?\s*(\d{1,2})\s*[点时](?:(\d{1,2})分?)?", message)
    if match is None:
        return ""
    hour = int(match.group(1))
    prefix = message[max(0, match.start() - 2) : match.start() + 2]
    if any(period in prefix for period in ["下午", "晚上"]) and hour < 12:
        hour += 12
    minute = int(match.group(2) or 0)
    if hour > 23 or minute > 59:
        return ""
    return f"{hour:02d}:{minute:02d}"


def _filter_trip_item_payload(
    payload: dict[str, object],
    allowed_fields: set[str],
) -> dict[str, object]:
    return {
        key: value
        for key, value in payload.items()
        if key in allowed_fields and value is not None
    }


def _trip_day_city(day: dict[str, object]) -> str:
    for item in day.get("items", []):
        if isinstance(item, dict) and item.get("city"):
            return str(item["city"])
    return ""


def _positive_int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    try:
        parsed = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


# 图片理解工具：当前是 mock fallback，保证无真实视觉 API Key 时拍照讲解仍可演示。
def vision_tool(image_info: dict[str, object] | None = None) -> dict[str, object]:
    if settings.vision_provider.lower() == "qwen" and settings.qwen_api_key:
        qwen_result = _qwen_vision_tool(image_info)
        if qwen_result is not None:
            return qwen_result
    return _mock_vision_tool(image_info)


def _mock_vision_tool(image_info: dict[str, object] | None = None) -> dict[str, object]:
    image_info = image_info or {}
    image_path = str(image_info.get("image_path") or image_info.get("filename") or "")
    lowered = image_path.lower()

    if "xinghai" in lowered or "星海" in image_path:
        name = "星海广场"
        description = "图片可能是大连星海广场，包含开阔广场和海滨城市空间。"
    else:
        name = "大连渔人码头"
        description = "图片可能是大连渔人码头，包含港湾、欧式建筑和海边步道。"

    return {
        "name": name,
        "confidence": 0.86,
        "recognition_result": description,
    }


def _qwen_vision_tool(image_info: dict[str, object] | None = None) -> dict[str, object] | None:
    image_info = image_info or {}
    image_data_url = _image_data_url(image_info)
    if image_data_url is None:
        return None

    try:
        response = httpx.post(
            _qwen_chat_completions_url(),
            headers={
                "Authorization": f"Bearer {settings.qwen_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.qwen_vision_model,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {"url": image_data_url},
                            },
                            {
                                "type": "text",
                                "text": (
                                    "请识别这张旅行照片中的景点、建筑、展品或文字信息。"
                                    "用一句中文说明识别结果和不确定性。"
                                ),
                            },
                        ],
                    }
                ],
            },
            timeout=settings.qwen_timeout_seconds,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        return None

    if not isinstance(content, str) or not content.strip():
        return None
    return {
        "name": _guess_spot_name(content),
        "confidence": 0.72,
        "recognition_result": content.strip(),
    }


# OCR 工具：优先调用配置的真实 OCR；失败时返回空文本 fallback。
def ocr_tool(image_info: dict[str, object] | None = None) -> dict[str, object]:
    if (
        settings.ocr_provider.lower() == "vivo"
        and settings.vivo_app_id
        and settings.vivo_app_key
        and settings.vivo_ocr_uri
    ):
        vivo_result = _vivo_ocr_tool(image_info)
        if vivo_result is not None:
            return vivo_result
    return _mock_ocr_tool()


def _mock_ocr_tool() -> dict[str, object]:
    return {
        "text": "",
        "confidence": 0.0,
    }


def _vivo_ocr_tool(image_info: dict[str, object] | None = None) -> dict[str, object] | None:
    image_info = image_info or {}
    image_base64 = _image_base64(image_info)
    if image_base64 is None:
        return None

    request_id = str(uuid.uuid4())
    try:
        response = httpx.post(
            _vivo_ocr_url(),
            params={"requestId": request_id},
            headers={
                "Authorization": f"Bearer {settings.vivo_app_key}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "image": image_base64,
                "pos": 2,
                "businessid": f"aigc{settings.vivo_app_id}",
            },
            timeout=settings.vivo_ocr_timeout_seconds,
        )
        response.raise_for_status()
        data = response.json()
    except (httpx.HTTPError, TypeError, ValueError):
        return None

    text = _extract_ocr_text(data)
    if not text:
        return None
    return {
        "text": text,
        "confidence": 0.8,
    }


def map_tool(
    origin: dict[str, float] | None = None,
    destination: dict[str, object] | None = None,
    keyword: str | None = None,
) -> dict[str, object]:
    # 地图工具：优先用高德 Web 服务；失败时返回固定演示休息点。
    if settings.amap_api_key:
        amap_result = _amap_map_tool(origin=origin, destination=destination, keyword=keyword)
        if amap_result is not None:
            return amap_result
    return _mock_map_tool(origin=origin, destination=destination, keyword=keyword)


def _mock_map_tool(
    origin: dict[str, float] | None = None,
    destination: dict[str, object] | None = None,
    keyword: str | None = None,
) -> dict[str, object]:
    return {
        "distance_minutes": 40,
        "distance_text": "距离下一个景点约 40 分钟路程",
        "keyword": keyword or "附近咖啡馆",
        "recommended_place": {
            "city": "大连",
            "title": "附近咖啡馆休息",
            "item_type": "rest",
            "start_time": "14:30",
            "end_time": "15:30",
            "address": "渔人码头附近",
            "latitude": 38.92,
            "longitude": 121.64,
            "status": "changed",
            "notes": "减少步行，适合恢复体力",
        },
        "origin": origin or {},
        "destination": destination or {},
    }


def _amap_map_tool(
    origin: dict[str, float] | None = None,
    destination: dict[str, object] | None = None,
    keyword: str | None = None,
) -> dict[str, object] | None:
    origin = origin or {}
    destination = destination or {}
    recommended_place = _amap_search_place(origin=origin, keyword=keyword or "附近咖啡馆")
    if recommended_place is None:
        return None

    distance_minutes = _amap_distance_minutes(origin=origin, destination=destination)
    if distance_minutes is None:
        distance_minutes = 40

    return {
        "distance_minutes": distance_minutes,
        "distance_text": f"距离下一个景点约 {distance_minutes} 分钟路程",
        "keyword": keyword or "附近咖啡馆",
        "recommended_place": recommended_place,
        "origin": origin,
        "destination": destination,
    }


# 天气工具：当前返回演示天气，后续可接天气 API 用于提醒和改线判断。
def weather_tool(city: str | None = None, date: str | None = None) -> dict[str, object]:
    if settings.amap_api_key:
        amap_result = _amap_weather_tool(city=city, date=date)
        if amap_result is not None:
            return amap_result
    return _mock_weather_tool(city=city, date=date)


def _mock_weather_tool(city: str | None = None, date: str | None = None) -> dict[str, object]:
    return {
        "city": city or "大连",
        "date": date,
        "weather": "多云",
        "summary": "天气适合出行，注意海边风大。",
    }


def _amap_weather_tool(
    city: str | None = None,
    date: str | None = None,
) -> dict[str, object] | None:
    try:
        response = httpx.get(
            f"{settings.amap_base_url.rstrip('/')}/v3/weather/weatherInfo",
            params={
                "key": settings.amap_api_key,
                "city": city or "大连",
                "extensions": "base",
                "output": "JSON",
            },
            timeout=settings.amap_timeout_seconds,
        )
        response.raise_for_status()
        data = response.json()
        live = data["lives"][0]
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        return None

    weather = str(live.get("weather") or "未知")
    report_city = str(live.get("city") or city or "大连")
    temperature = live.get("temperature")
    wind = live.get("winddirection")
    summary = f"{report_city}当前天气{weather}"
    if temperature not in (None, ""):
        summary += f"，气温{temperature}℃"
    if wind not in (None, ""):
        summary += f"，{wind}风"
    summary += "。"
    return {
        "city": report_city,
        "date": date,
        "weather": weather,
        "summary": summary,
    }


# 提醒工具：当前用时间和下一段行程生成 mock 风险，后续可扩展闭馆、路况、天气规则。
def reminder_tool(state: AgentState) -> dict[str, object]:
    current_time = str(state.get("current_time") or "")
    trip = trip_tool(state)
    next_item = _find_next_item(trip)
    map_result = map_tool(origin=state.get("current_location"), destination=next_item)

    reminder_type = "departure"
    content = (
        f"{map_result['distance_text']}，建议现在出发，"
        f"这样能比较从容地赶上 {next_item.get('start_time', '下一段')} 的安排。"
    )

    if current_time:
        try:
            parsed = datetime.fromisoformat(current_time.replace("Z", "+00:00"))
            if parsed.hour >= 13:
                reminder_type = "conflict"
                content = "下午行程节奏偏紧，建议减少一个远距离景点，给休息和交通留出缓冲。"
        except ValueError:
            pass

    return {
        "has_risk": True,
        "reminder": {
            "id": 1,
            "type": reminder_type,
            "content": content,
            "status": "unread",
        },
    }


# 在当前行程里找到下一段 planned 项，用于提醒和动态改线的目标判断。
def _find_next_item(trip: dict[str, object]) -> dict[str, object]:
    days = trip.get("days")
    if isinstance(days, list):
        for day in days:
            if not isinstance(day, dict):
                continue
            items = day.get("items")
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict) and item.get("status", "planned") == "planned":
                        return item
    return {
        "id": 1,
        "city": "大连",
        "title": "渔人码头",
        "start_time": "10:00",
        "address": "大连市中山区滨海路",
    }


def find_replan_target(trip: dict[str, object]) -> dict[str, object]:
    days = trip.get("days")
    if isinstance(days, list):
        planned_items = [
            item
            for day in days
            if isinstance(day, dict)
            for item in day.get("items", [])
            if isinstance(item, dict) and item.get("status", "planned") == "planned"
        ]
        if planned_items:
            return planned_items[-1]
    return {
        "id": 3,
        "city": "大连",
        "title": "贝壳博物馆",
        "status": "planned",
    }


def _qwen_chat_completions_url() -> str:
    base_url = settings.qwen_base_url.rstrip("/")
    if base_url.endswith("/compatible-mode/v1"):
        return f"{base_url}/chat/completions"
    return f"{base_url}/compatible-mode/v1/chat/completions"


def _vivo_ocr_url() -> str:
    return f"{settings.vivo_base_url.rstrip('/')}{settings.vivo_ocr_uri}"


def _image_data_url(image_info: dict[str, object]) -> str | None:
    path = _resolve_image_path(image_info)
    if path is None:
        return None

    mime_type = mimetypes.guess_type(path.name)[0] or "image/jpeg"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def _image_base64(image_info: dict[str, object]) -> str | None:
    path = _resolve_image_path(image_info)
    if path is None:
        return None
    return base64.b64encode(path.read_bytes()).decode("ascii")


def _resolve_image_path(image_info: dict[str, object]) -> Path | None:
    path_text = str(
        image_info.get("saved_path")
        or image_info.get("local_path")
        or image_info.get("image_path")
        or ""
    )
    if not path_text:
        return None

    path = Path(path_text)
    if not path.is_file() and not path.is_absolute():
        candidates = [
            Path.cwd() / path,
            Path.cwd() / settings.upload_dir / path.name,
            Path.cwd().parent / path,
            Path.cwd().parent / settings.upload_dir / path.name,
        ]
        path = next((candidate for candidate in candidates if candidate.is_file()), path)
    return path if path.is_file() else None


def _extract_ocr_text(data: object) -> str:
    texts: list[str] = []
    _collect_ocr_text(data, texts)
    return "\n".join(dict.fromkeys(text.strip() for text in texts if text.strip()))


def _collect_ocr_text(data: object, texts: list[str]) -> None:
    if isinstance(data, dict):
        for key, value in data.items():
            lowered = str(key).lower()
            if lowered in {"text", "word", "words", "content", "value"} and isinstance(
                value,
                str,
            ):
                texts.append(value)
            else:
                _collect_ocr_text(value, texts)
    elif isinstance(data, list):
        for item in data:
            _collect_ocr_text(item, texts)


def _guess_spot_name(text: str) -> str:
    if "星海" in text:
        return "星海广场"
    if "渔人码头" in text:
        return "大连渔人码头"
    if "说明牌" in text:
        return "说明牌"
    return "图片识别结果"


def _amap_search_place(
    origin: dict[str, float],
    keyword: str,
) -> dict[str, object] | None:
    params: dict[str, object] = {
        "key": settings.amap_api_key,
        "keywords": keyword,
        "output": "JSON",
    }
    location = _amap_location(origin)
    endpoint = "around" if location else "text"
    if location:
        params["location"] = location
        params["radius"] = 3000
    else:
        params["city"] = "大连"

    try:
        response = httpx.get(
            f"{settings.amap_base_url.rstrip('/')}/v5/place/{endpoint}",
            params=params,
            timeout=settings.amap_timeout_seconds,
        )
        response.raise_for_status()
        poi = response.json()["pois"][0]
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        return None

    longitude, latitude = _split_amap_location(str(poi.get("location") or ""))
    return {
        "city": str(poi.get("cityname") or "大连"),
        "title": str(poi.get("name") or "附近休息点"),
        "item_type": "rest",
        "start_time": "14:30",
        "end_time": "15:30",
        "address": str(poi.get("address") or "当前位置附近"),
        "latitude": latitude,
        "longitude": longitude,
        "status": "changed",
        "notes": "根据当前位置和高德 POI 推荐，适合作为临时休息点",
    }


def _amap_distance_minutes(
    origin: dict[str, float],
    destination: dict[str, object],
) -> int | None:
    origin_location = _amap_location(origin)
    destination_location = _amap_location(destination)
    if not origin_location or not destination_location:
        return None

    try:
        response = httpx.get(
            f"{settings.amap_base_url.rstrip('/')}/v3/direction/walking",
            params={
                "key": settings.amap_api_key,
                "origin": origin_location,
                "destination": destination_location,
                "output": "JSON",
            },
            timeout=settings.amap_timeout_seconds,
        )
        response.raise_for_status()
        duration_seconds = int(response.json()["route"]["paths"][0]["duration"])
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        return None
    return max(1, round(duration_seconds / 60))


def _amap_location(data: dict[str, object]) -> str:
    latitude = data.get("latitude")
    longitude = data.get("longitude")
    if latitude is None or longitude is None:
        return ""
    return f"{longitude},{latitude}"


def _split_amap_location(location: str) -> tuple[float | None, float | None]:
    try:
        longitude_text, latitude_text = location.split(",", maxsplit=1)
        return float(longitude_text), float(latitude_text)
    except ValueError:
        return None, None

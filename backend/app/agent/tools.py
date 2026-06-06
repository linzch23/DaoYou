from datetime import datetime

from app.agent.state import AgentState

DEFAULT_TRIP = {
    "id": 1,
    "title": "大连三日游",
    "city": "大连",
    "days": [
        {
            "day_index": 1,
            "trip_date": "2026-07-01",
            "items": [
                {
                    "id": 1,
                    "title": "渔人码头",
                    "item_type": "attraction",
                    "start_time": "10:00",
                    "end_time": "11:30",
                    "address": "大连市中山区滨海路",
                    "status": "planned",
                },
                {
                    "id": 3,
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


# 行程工具：当前读取传入上下文或演示默认行程，后续可接 trips 相关数据库查询。
def trip_tool(state: AgentState) -> dict[str, object]:
    return dict(state.get("current_trip") or DEFAULT_TRIP)


# 记忆工具：当前读取传入偏好或默认画像，后续可接 user_memory/user_preferences。
def memory_tool(state: AgentState) -> dict[str, object]:
    return dict(state.get("user_preferences") or DEFAULT_PREFERENCES)


# 图片理解工具：当前是 mock fallback，保证无真实视觉 API Key 时拍照讲解仍可演示。
def vision_tool(image_info: dict[str, object] | None = None) -> dict[str, object]:
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


# OCR 工具：当前固定返回空文本，后续可接第三方 OCR 或多模态模型。
def ocr_tool(image_info: dict[str, object] | None = None) -> dict[str, object]:
    return {
        "text": "",
        "confidence": 0.0,
    }


def map_tool(
    origin: dict[str, float] | None = None,
    destination: dict[str, object] | None = None,
    keyword: str | None = None,
) -> dict[str, object]:
    # 地图工具：当前固定返回附近休息点，后续可接高德/百度地图路线与 POI 检索。
    return {
        "distance_minutes": 40,
        "distance_text": "距离下一个景点约 40 分钟路程",
        "keyword": keyword or "附近咖啡馆",
        "recommended_place": {
            "title": "附近咖啡馆休息",
            "item_type": "rest",
            "start_time": "14:30",
            "end_time": "15:30",
            "address": "渔人码头附近",
            "notes": "减少步行，适合恢复体力",
        },
        "origin": origin or {},
        "destination": destination or {},
    }


# 天气工具：当前返回演示天气，后续可接天气 API 用于提醒和改线判断。
def weather_tool(city: str | None = None, date: str | None = None) -> dict[str, object]:
    return {
        "city": city or "大连",
        "date": date,
        "weather": "多云",
        "summary": "天气适合出行，注意海边风大。",
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
        "title": "渔人码头",
        "start_time": "10:00",
        "address": "大连市中山区滨海路",
    }

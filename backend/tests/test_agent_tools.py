from app.agent import tools
from app.agent.tools import (
    find_replan_target,
    map_tool,
    memory_tool,
    ocr_tool,
    reminder_tool,
    trip_tool,
    vision_tool,
    weather_tool,
)


def test_trip_and_memory_tools_prefer_injected_context() -> None:
    trip = {"id": 99, "title": "真实行程", "days": []}
    preferences = {"travel_pace": "normal", "interests": ["food"]}

    assert trip_tool({"current_trip": trip}) == trip
    assert memory_tool({"user_preferences": preferences}) == preferences


def test_vision_and_ocr_tools_keep_demo_fallback_shape(monkeypatch) -> None:
    monkeypatch.setattr(tools.settings, "vision_provider", "mock")
    monkeypatch.setattr(tools.settings, "qwen_api_key", "")
    monkeypatch.setattr(tools.settings, "ocr_provider", "mock")

    yurenmatou = vision_tool({"filename": "yurenmatou.jpg"})
    xinghai = vision_tool({"filename": "xinghai.jpg"})
    ocr = ocr_tool({"filename": "sign.jpg"})

    assert yurenmatou["name"] == "大连渔人码头"
    assert xinghai["name"] == "星海广场"
    assert isinstance(yurenmatou["recognition_result"], str)
    assert isinstance(yurenmatou["confidence"], float)
    assert ocr == {"text": "", "confidence": 0.0}


def test_vivo_ocr_tool_uses_text_response(tmp_path, monkeypatch) -> None:
    image_path = tmp_path / "sign.jpg"
    image_path.write_bytes(b"fake image bytes")

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {
                "data": {
                    "words_result": [
                        {"words": "大连渔人码头"},
                        {"words": "欢迎参观"},
                    ]
                }
            }

    captured: dict[str, object] = {}

    def fake_post(*args, **kwargs) -> FakeResponse:
        captured.update(kwargs)
        return FakeResponse()

    monkeypatch.setattr(tools.settings, "ocr_provider", "vivo")
    monkeypatch.setattr(tools.settings, "vivo_app_id", "fake-app-id")
    monkeypatch.setattr(tools.settings, "vivo_app_key", "fake-key")
    monkeypatch.setattr(tools.settings, "vivo_base_url", "https://api-ai.vivo.com.cn")
    monkeypatch.setattr(tools.settings, "vivo_ocr_uri", "/ocr/general_recognition")
    monkeypatch.setattr(tools.httpx, "post", fake_post)

    result = ocr_tool({"saved_path": str(image_path)})

    assert result["text"] == "大连渔人码头\n欢迎参观"
    assert result["confidence"] == 0.8
    assert captured["params"]["requestId"]
    assert captured["headers"]["Content-Type"] == "application/x-www-form-urlencoded"
    assert captured["data"]["pos"] == 2
    assert captured["data"]["businessid"] == "aigcfake-app-id"


def test_qwen_vision_tool_uses_multimodal_response(tmp_path, monkeypatch) -> None:
    image_path = tmp_path / "spot.jpg"
    image_path.write_bytes(b"fake image bytes")

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {
                "choices": [
                    {
                        "message": {
                            "content": "这张图片可能是大连渔人码头，包含港湾和欧式建筑。"
                        }
                    }
                ]
            }

    def fake_post(*args, **kwargs) -> FakeResponse:
        return FakeResponse()

    monkeypatch.setattr(tools.settings, "vision_provider", "qwen")
    monkeypatch.setattr(tools.settings, "qwen_api_key", "fake-key")
    monkeypatch.setattr(tools.settings, "qwen_base_url", "https://dashscope.aliyuncs.com")
    monkeypatch.setattr(tools.httpx, "post", fake_post)

    result = vision_tool({"saved_path": str(image_path)})

    assert result["name"] == "大连渔人码头"
    assert "渔人码头" in result["recognition_result"]
    assert result["confidence"] == 0.72


def test_map_and_weather_tools_keep_demo_fallback_shape(monkeypatch) -> None:
    monkeypatch.setattr(tools.settings, "amap_api_key", "")

    origin = {"latitude": 38.92, "longitude": 121.64}
    destination = {"title": "贝壳博物馆"}

    map_result = map_tool(origin=origin, destination=destination, keyword="附近咖啡馆")
    weather_result = weather_tool(city="大连", date="2026-07-01")

    assert map_result["distance_minutes"] == 40
    assert map_result["origin"] == origin
    assert map_result["destination"] == destination
    assert map_result["recommended_place"]["title"] == "附近咖啡馆休息"
    assert weather_result["city"] == "大连"
    assert weather_result["date"] == "2026-07-01"
    assert weather_result["summary"]


def test_amap_map_tool_uses_poi_and_route_response(monkeypatch) -> None:
    class FakeResponse:
        def __init__(self, payload: dict[str, object]) -> None:
            self.payload = payload

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return self.payload

    def fake_get(url, *args, **kwargs) -> FakeResponse:
        if "place/around" in url:
            return FakeResponse(
                {
                    "pois": [
                        {
                            "name": "海边咖啡",
                            "cityname": "大连市",
                            "address": "渔人码头附近",
                            "location": "121.640000,38.920000",
                        }
                    ]
                }
            )
        return FakeResponse({"route": {"paths": [{"duration": "900"}]}})

    monkeypatch.setattr(tools.settings, "amap_api_key", "fake-key")
    monkeypatch.setattr(tools.httpx, "get", fake_get)

    result = map_tool(
        origin={"latitude": 38.91, "longitude": 121.63},
        destination={"latitude": 38.92, "longitude": 121.64},
        keyword="附近咖啡馆",
    )

    assert result["distance_minutes"] == 15
    assert result["recommended_place"]["title"] == "海边咖啡"
    assert result["recommended_place"]["latitude"] == 38.92
    assert result["recommended_place"]["longitude"] == 121.64


def test_amap_weather_tool_uses_live_weather_response(monkeypatch) -> None:
    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {
                "lives": [
                    {
                        "city": "大连市",
                        "weather": "晴",
                        "temperature": "24",
                        "winddirection": "东南",
                    }
                ]
            }

    def fake_get(*args, **kwargs) -> FakeResponse:
        return FakeResponse()

    monkeypatch.setattr(tools.settings, "amap_api_key", "fake-key")
    monkeypatch.setattr(tools.httpx, "get", fake_get)

    result = weather_tool(city="大连", date="2026-07-01")

    assert result["city"] == "大连市"
    assert result["weather"] == "晴"
    assert "24℃" in result["summary"]


def test_reminder_tool_handles_bad_time_with_departure_fallback(monkeypatch) -> None:
    monkeypatch.setattr(tools.settings, "amap_api_key", "")

    result = reminder_tool({"current_time": "not-a-date"})

    assert result["has_risk"] is True
    assert result["reminder"]["type"] == "departure"
    assert "建议现在出发" in result["reminder"]["content"]


def test_find_replan_target_uses_last_planned_item_or_demo_target() -> None:
    trip = {
        "days": [
            {
                "items": [
                    {"id": 1, "title": "已完成", "status": "done"},
                    {"id": 2, "title": "第一站", "status": "planned"},
                    {"id": 5, "title": "第二站", "status": "planned"},
                ]
            }
        ]
    }

    assert find_replan_target(trip)["id"] == 5
    assert find_replan_target({"days": []})["id"] == 3

import pytest

from app.agent.graph import run_agent
from app.agent.tools import map_tool, vision_tool, weather_tool


@pytest.fixture(autouse=True)
def production_without_external_credentials(monkeypatch) -> None:
    monkeypatch.setattr("app.core.config.settings.app_env", "production")
    monkeypatch.setattr("app.core.config.settings.allow_demo_fallbacks", True)
    monkeypatch.setattr("app.core.config.settings.llm_api_key", "")
    monkeypatch.setattr("app.core.config.settings.amap_api_key", "")
    monkeypatch.setattr("app.core.config.settings.qwen_api_key", "")
    monkeypatch.setattr("app.core.config.settings.vision_provider", "mock")
    monkeypatch.setattr("app.core.config.settings.ocr_provider", "mock")


def test_production_tools_never_return_demo_facts() -> None:
    vision = vision_tool({"image_path": "unknown.jpg"})
    route = map_tool(origin={"latitude": 1.0, "longitude": 2.0}, keyword="咖啡馆")
    weather = weather_tool(city="广州")

    assert vision["available"] is False
    assert "渔人码头" not in str(vision)
    assert route["available"] is False
    assert route["recommended_place"] is None
    assert weather["available"] is False
    assert weather["weather"] is None


def test_production_chat_reports_unavailable_instead_of_demo_advice(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.nodes.call_llm", lambda messages: None)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "intent_hint": "chat",
            "user_message": "下午怎么安排？",
        }
    )

    assert result["intent"] == "chat"
    assert "暂时不可用" in result["reply"]
    assert "慢节奏" not in result["reply"]


def test_production_photo_does_not_guess_a_landmark(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.nodes.call_llm", lambda messages: None)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "image_info": {"image_path": "unknown.jpg"},
        }
    )

    assert "无法" in result["structured_data"]["recognition_result"]
    assert "凭猜测" in result["reply"]
    assert "渔人码头" not in str(result)


def test_production_reminder_does_not_invent_eta(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.nodes.call_llm", lambda messages: None)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "intent_hint": "reminder",
            "current_time": "2026-07-01T09:00:00+08:00",
        }
    )

    assert result["structured_data"]["has_risk"] is False
    assert result["structured_data"]["evaluation_status"] == "unavailable"
    assert "40 分钟" not in result["reply"]


def test_production_replan_does_not_emit_mock_cafe_action(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.nodes.call_llm", lambda messages: None)
    trip = {
        "id": 1,
        "title": "广州旅行",
        "start_date": "2026-07-01",
        "end_date": "2026-07-03",
        "days": [
            {
                "id": 10,
                "day_index": 1,
                "trip_date": "2026-07-01",
                "items": [{"id": 20, "title": "广州塔", "status": "planned"}],
            }
        ],
    }

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "intent_hint": "replan",
            "user_message": "把广州塔换成轻松一点的安排",
            "current_trip": trip,
        }
    )

    assert result["action_options"] == []
    assert result["structured_data"]["needs_clarification"] is True
    assert "咖啡馆" not in str(result)


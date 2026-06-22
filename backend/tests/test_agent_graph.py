import pytest

from app.agent import llm
from app.agent.graph import run_agent


@pytest.fixture(autouse=True)
def disable_external_agent_tools(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.tools.settings.amap_api_key", "")
    monkeypatch.setattr("app.agent.tools.settings.vision_provider", "mock")
    monkeypatch.setattr("app.agent.tools.settings.qwen_api_key", "")


def test_chat_agent_returns_reply(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.nodes.call_llm", lambda messages: None)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "user_message": "下午想轻松一点，怎么安排？",
            "current_trip": {},
            "user_preferences": {"travel_pace": "slow"},
        }
    )

    assert result["intent"] == "chat"
    assert result["reply"]
    assert result["action_options"] == []
    assert isinstance(result["follow_up_questions"], list)


def test_chat_agent_uses_llm_when_available(monkeypatch) -> None:
    def fake_call_llm(messages: list[dict[str, str]]) -> str:
        return '{"reply": "这是模型生成的旅行建议。", "follow_up_questions": ["要继续优化吗？"]}'

    monkeypatch.setattr("app.agent.nodes.call_llm", fake_call_llm)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "user_message": "今天下午怎么安排？",
            "intent_hint": "chat",
        }
    )

    assert result["intent"] == "chat"
    assert result["reply"] == "这是模型生成的旅行建议。"
    assert result["follow_up_questions"] == ["要继续优化吗？"]


def test_chat_agent_parses_markdown_json_payload(monkeypatch) -> None:
    def fake_call_llm(messages: list[dict[str, str]]) -> str:
        return (
            '```json\n{"reply":"模型建议下午放慢节奏。",'
            '"follow_up_questions":["要调整下一站吗？"]}\n```'
        )

    monkeypatch.setattr("app.agent.nodes.call_llm", fake_call_llm)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "user_message": "下午想轻松一点",
            "intent_hint": "chat",
        }
    )

    assert result["reply"] == "模型建议下午放慢节奏。"
    assert result["follow_up_questions"] == ["要调整下一站吗？"]


def test_chat_agent_extracts_json_from_text_payload(monkeypatch) -> None:
    def fake_call_llm(messages: list[dict[str, str]]) -> str:
        return (
            '好的：{"reply":"模型建议先休息再去海边。",'
            '"follow_up_questions":["要找附近咖啡馆吗？"]}'
        )

    monkeypatch.setattr("app.agent.nodes.call_llm", fake_call_llm)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "user_message": "下午想轻松一点",
            "intent_hint": "chat",
        }
    )

    assert result["reply"] == "模型建议先休息再去海边。"
    assert result["follow_up_questions"] == ["要找附近咖啡馆吗？"]


def test_vivo_auth_headers_include_required_fields() -> None:
    headers = llm._build_vivo_auth_headers(
        method="POST",
        uri="/vivogpt/completions",
        query={"requestId": "req_001"},
        app_id="demo_app_id",
        app_key="demo_app_key",
        timestamp="1710000000",
        nonce="12345678",
    )

    assert headers["X-AI-GATEWAY-APP-ID"] == "demo_app_id"
    assert headers["X-AI-GATEWAY-TIMESTAMP"] == "1710000000"
    assert headers["X-AI-GATEWAY-NONCE"] == "12345678"
    assert headers["X-AI-GATEWAY-SIGNATURE"]


def test_vivo_llm_returns_content(monkeypatch) -> None:
    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {"code": 0, "data": {"content": "蓝心模型生成的旅行建议。"}}

    def fake_post(*args, **kwargs) -> FakeResponse:
        return FakeResponse()

    monkeypatch.setattr(llm.settings, "llm_provider", "vivo")
    monkeypatch.setattr(llm.settings, "vivo_app_id", "demo_app_id")
    monkeypatch.setattr(llm.settings, "vivo_app_key", "demo_app_key")
    monkeypatch.setattr(llm.httpx, "post", fake_post)

    result = llm.call_llm([{"role": "user", "content": "下午怎么安排？"}])

    assert result == "蓝心模型生成的旅行建议。"


def test_vivo_llm_returns_none_without_credentials(monkeypatch) -> None:
    monkeypatch.setattr(llm.settings, "llm_provider", "vivo")
    monkeypatch.setattr(llm.settings, "vivo_app_id", "")
    monkeypatch.setattr(llm.settings, "vivo_app_key", "")

    assert llm.call_llm([{"role": "user", "content": "下午怎么安排？"}]) is None


def test_photo_agent_returns_explanation(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.nodes.call_llm", lambda messages: None)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "image_info": {"image_path": "uploads/images/yurenmatou.jpg"},
        }
    )

    assert result["intent"] == "photo_explain"
    assert result["structured_data"]["recognition_result"]
    assert result["structured_data"]["explanation"]
    assert result["follow_up_questions"]


def test_photo_agent_uses_llm_payload_when_valid(monkeypatch) -> None:
    def fake_call_llm(messages: list[dict[str, str]]) -> str:
        return (
            '{"recognition_result":"模型识别为大连渔人码头。",'
            '"explanation":"模型生成的个性化拍照讲解。",'
            '"follow_up_questions":["要儿童版吗？"]}'
        )

    monkeypatch.setattr("app.agent.nodes.call_llm", fake_call_llm)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "image_info": {"image_path": "uploads/images/yurenmatou.jpg"},
        }
    )

    assert result["intent"] == "photo_explain"
    assert result["reply"] == "模型生成的个性化拍照讲解。"
    assert result["structured_data"]["recognition_result"] == "模型识别为大连渔人码头。"
    assert result["follow_up_questions"] == ["要儿童版吗？"]


def test_photo_agent_parses_markdown_json_payload(monkeypatch) -> None:
    def fake_call_llm(messages: list[dict[str, str]]) -> str:
        return (
            '```json\n{"recognition_result":"模型识别为海边建筑。",'
            '"explanation":"模型讲解海边建筑的空间层次。",'
            '"follow_up_questions":["附近还有什么？"]}\n```'
        )

    monkeypatch.setattr("app.agent.nodes.call_llm", fake_call_llm)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "image_info": {"image_path": "uploads/images/yurenmatou.jpg"},
        }
    )

    assert result["structured_data"]["recognition_result"] == "模型识别为海边建筑。"
    assert result["reply"] == "模型讲解海边建筑的空间层次。"


def test_photo_agent_falls_back_when_llm_payload_invalid(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.nodes.call_llm", lambda messages: "这不是 JSON")

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "image_info": {"image_path": "uploads/images/yurenmatou.jpg"},
        }
    )

    assert result["intent"] == "photo_explain"
    assert "大连渔人码头" in result["reply"]
    assert result["structured_data"]["recognition_result"]
    assert result["follow_up_questions"]


def test_reminder_agent_returns_risk_payload(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.nodes.call_llm", lambda messages: None)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "intent_hint": "reminder",
            "current_time": "2026-07-01T09:20:00+08:00",
            "current_location": {"latitude": 38.92, "longitude": 121.64},
        }
    )

    assert result["intent"] == "reminder"
    assert result["structured_data"]["has_risk"] is True
    assert result["structured_data"]["reminder"]["type"] in {"departure", "conflict"}


def test_reminder_agent_uses_llm_payload_when_valid(monkeypatch) -> None:
    def fake_call_llm(messages: list[dict[str, str]]) -> str:
        return (
            '{"has_risk":true,'
            '"reminder":{"id":2,"type":"departure","content":"模型提醒你现在出发更从容。","status":"unread"}}'
        )

    monkeypatch.setattr("app.agent.nodes.call_llm", fake_call_llm)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "intent_hint": "reminder",
            "current_time": "2026-07-01T09:20:00+08:00",
            "current_location": {"latitude": 38.92, "longitude": 121.64},
        }
    )

    assert result["intent"] == "reminder"
    assert result["reply"] == "模型提醒你现在出发更从容。"
    assert result["structured_data"]["has_risk"] is True
    assert result["structured_data"]["reminder"]["id"] == 2


def test_reminder_agent_parses_markdown_json_payload(monkeypatch) -> None:
    def fake_call_llm(messages: list[dict[str, str]]) -> str:
        return (
            '```json\n{"has_risk":true,'
            '"reminder":{"id":3,"type":"conflict","content":"模型提醒下午节奏偏紧。","status":"unread"}}\n```'
        )

    monkeypatch.setattr("app.agent.nodes.call_llm", fake_call_llm)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "intent_hint": "reminder",
            "current_time": "2026-07-01T14:20:00+08:00",
        }
    )

    assert result["structured_data"]["reminder"]["type"] == "conflict"
    assert result["reply"] == "模型提醒下午节奏偏紧。"


def test_reminder_agent_falls_back_when_llm_payload_invalid(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.nodes.call_llm", lambda messages: "这不是 JSON")

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "intent_hint": "reminder",
            "current_time": "2026-07-01T09:20:00+08:00",
            "current_location": {"latitude": 38.92, "longitude": 121.64},
        }
    )

    assert result["intent"] == "reminder"
    assert result["structured_data"]["has_risk"] is True
    assert result["structured_data"]["reminder"]["type"] in {"departure", "conflict"}


def test_replan_agent_returns_draft_items(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.nodes.call_llm", lambda messages: None)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "user_message": "我累了不想去下一个景点，帮我换一个轻松点的安排。",
            "current_location": {"latitude": 38.92, "longitude": 121.64},
        }
    )

    assert result["intent"] == "replan"
    assert result["structured_data"]["draft_id"] == "draft_001"
    assert result["structured_data"]["new_items"]
    assert result["action_options"]
    assert result["action_options"][0]["operation"] == "update_trip_item"


def test_replan_agent_uses_llm_payload_when_valid(monkeypatch) -> None:
    def fake_call_llm(messages: list[dict[str, str]]) -> str:
        return (
            '{"draft_id":"draft_llm_001","summary":"模型建议改去室内展馆。",'
            '"reason":"用户表达疲惫，室内路线更轻松。",'
            '"new_items":[{"title":"室内展馆","item_type":"attraction"}],'
            '"removed_item_ids":[3]}'
        )

    monkeypatch.setattr("app.agent.nodes.call_llm", fake_call_llm)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "user_message": "我累了，帮我换一个轻松点的安排。",
            "intent_hint": "replan",
        }
    )

    assert result["intent"] == "replan"
    assert result["structured_data"]["draft_id"] == "draft_llm_001"
    assert result["structured_data"]["new_items"][0]["title"] == "室内展馆"
    assert result["action_options"]
    assert result["action_options"][0]["operation"] == "update_trip_item"


def test_replan_agent_parses_markdown_json_payload(monkeypatch) -> None:
    def fake_call_llm(messages: list[dict[str, str]]) -> str:
        return (
            '```json\n{"draft_id":"draft_markdown_001","summary":"模型建议改去书店休息。",'
            '"reason":"用户疲惫，书店更安静。",'
            '"new_items":[{"title":"安静书店","item_type":"rest"}],'
            '"removed_item_ids":[3]}\n```'
        )

    monkeypatch.setattr("app.agent.nodes.call_llm", fake_call_llm)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "user_message": "我累了，帮我换一个轻松点的安排。",
            "intent_hint": "replan",
        }
    )

    assert result["structured_data"]["draft_id"] == "draft_markdown_001"
    assert result["structured_data"]["new_items"][0]["title"] == "安静书店"


def test_replan_agent_extracts_json_from_text_payload(monkeypatch) -> None:
    def fake_call_llm(messages: list[dict[str, str]]) -> str:
        return (
            '好的，方案如下：{"draft_id":"draft_text_001","summary":"模型建议改去茶馆。",'
            '"reason":"茶馆适合坐下休息。",'
            '"new_items":[{"title":"附近茶馆","item_type":"rest"}],'
            '"removed_item_ids":[3]}'
        )

    monkeypatch.setattr("app.agent.nodes.call_llm", fake_call_llm)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "user_message": "我累了，帮我换一个轻松点的安排。",
            "intent_hint": "replan",
        }
    )

    assert result["structured_data"]["draft_id"] == "draft_text_001"
    assert result["structured_data"]["new_items"][0]["title"] == "附近茶馆"


def test_replan_agent_falls_back_when_llm_payload_invalid(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.nodes.call_llm", lambda messages: "这不是 JSON")

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "user_message": "我累了，帮我换一个轻松点的安排。",
            "intent_hint": "replan",
        }
    )

    assert result["intent"] == "replan"
    assert result["structured_data"]["draft_id"] == "draft_001"
    assert result["structured_data"]["new_items"][0]["title"] == "附近咖啡馆休息"

import pytest

from app.agent import llm
from app.agent.graph import run_agent


@pytest.fixture(autouse=True)
def disable_external_agent_tools(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.tools.settings.amap_api_key", "")
    monkeypatch.setattr("app.agent.tools.settings.vision_provider", "mock")
    monkeypatch.setattr("app.agent.tools.settings.qwen_api_key", "")


def _trip_context() -> dict[str, object]:
    return {
        "id": 1,
        "title": "大连三日游",
        "start_date": "2026-07-01",
        "end_date": "2026-07-03",
        "days": [
            {
                "id": 10,
                "day_index": 1,
                "trip_date": "2026-07-01",
                "items": [
                    {
                        "id": 3,
                        "city": "大连",
                        "title": "贝壳博物馆",
                        "status": "planned",
                    }
                ],
            },
            {
                "id": 11,
                "day_index": 2,
                "trip_date": "2026-07-02",
                "items": [],
            },
        ],
    }


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
    assert result["follow_up_questions"] == [
        "帮我把下午安排得轻松一点",
        "推荐附近适合休息的地方",
    ]
    assert result["clarification_options"] == []


def test_chat_agent_uses_llm_when_available(monkeypatch) -> None:
    def fake_call_llm(messages: list[dict[str, str]]) -> str:
        return '{"reply": "这是模型生成的旅行建议。", "suggested_questions": ["帮我继续优化行程"]}'

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
    assert result["follow_up_questions"] == ["帮我继续优化行程"]
    assert result["clarification_options"] == []


def test_chat_agent_parses_markdown_json_payload(monkeypatch) -> None:
    def fake_call_llm(messages: list[dict[str, str]]) -> str:
        return (
            '```json\n{"reply":"模型建议下午放慢节奏。",'
            '"suggested_questions":["帮我调整下一站"],"clarification_options":[]}\n```'
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
    assert result["follow_up_questions"] == ["帮我调整下一站"]


def test_chat_agent_extracts_json_from_text_payload(monkeypatch) -> None:
    def fake_call_llm(messages: list[dict[str, str]]) -> str:
        return (
            '好的：{"reply":"模型建议先休息再去海边。",'
            '"suggested_questions":["帮我找附近的咖啡馆"],"clarification_options":[]}'
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
    assert result["follow_up_questions"] == ["帮我找附近的咖啡馆"]


def test_chat_agent_returns_structured_clarification_options(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.agent.nodes.call_llm",
        lambda messages: (
            '{"reply":"第二天你想怎么安排？",'
            '"suggested_questions":[],"clarification_options":['
            '{"option_id":"clarify_001","label":"完全空着",'
            '"message":"我想让第二天完全空着。"},'
            '{"option_id":"clarify_002","label":"轻松拍照",'
            '"message":"我希望第二天安排一个轻松、适合拍照的地点。"}]}'
        ),
    )

    result = run_agent({"user_id": 1, "user_message": "帮我安排第二天"})

    assert result["follow_up_questions"] == []
    assert result["clarification_options"][0] == {
        "option_id": "clarify_001",
        "label": "完全空着",
        "message": "我想让第二天完全空着。",
    }


def test_chat_agent_prefers_valid_clarification_options_and_filters_invalid_items(
    monkeypatch,
) -> None:
    monkeypatch.setattr(
        "app.agent.nodes.call_llm",
        lambda messages: (
            '{"reply":"请选择第二天的节奏。",'
            '"suggested_questions":["帮我推荐第二天的景点"],'
            '"clarification_options":['
            '{"option_id":"clarify_001","label":"慢节奏",'
            '"message":"我希望第二天按慢节奏安排。"},'
            '{"option_id":"clarify_002","label":"缺少消息"},"invalid"]}'
        ),
    )

    result = run_agent({"user_id": 1, "user_message": "第二天怎么安排"})

    assert result["follow_up_questions"] == []
    assert result["clarification_options"] == [
        {
            "option_id": "clarify_001",
            "label": "慢节奏",
            "message": "我希望第二天按慢节奏安排。",
        }
    ]


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


def test_replan_agent_does_not_invent_action_when_llm_unavailable(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.nodes.call_llm", lambda messages: None)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "user_message": "我累了不想去下一个景点，帮我换一个轻松点的安排。",
            "current_trip": _trip_context(),
            "current_location": {"latitude": 38.92, "longitude": 121.64},
        }
    )

    assert result["intent"] == "replan"
    assert result["structured_data"]["needs_clarification"] is True
    assert result["structured_data"]["operations"] == []
    assert result["action_options"] == []
    assert "暂时不可用" in result["reply"]


def test_replan_agent_uses_llm_payload_when_valid(monkeypatch) -> None:
    def fake_call_llm(messages: list[dict[str, str]]) -> str:
        return (
            '{"needs_clarification":false,"clarifying_question":"",'
            '"summary":"模型建议改去室内展馆。",'
            '"reason":"用户表达疲惫，室内路线更轻松。",'
            '"operations":[{"operation":"update_trip_item","target_item_id":3,'
            '"label":"改为室内展馆","payload":{"title":"室内展馆",'
            '"item_type":"attraction"}}]}'
        )

    monkeypatch.setattr("app.agent.nodes.call_llm", fake_call_llm)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "user_message": "我累了，帮我换一个轻松点的安排。",
            "intent_hint": "replan",
            "current_trip": _trip_context(),
        }
    )

    assert result["intent"] == "replan"
    assert result["structured_data"]["operations"][0]["payload"]["title"] == "室内展馆"
    assert result["action_options"]
    assert result["action_options"][0]["operation"] == "update_trip_item"


def test_replan_agent_parses_markdown_json_payload(monkeypatch) -> None:
    def fake_call_llm(messages: list[dict[str, str]]) -> str:
        return (
            '```json\n{"needs_clarification":false,"clarifying_question":"",'
            '"summary":"模型建议改去书店休息。",'
            '"reason":"用户疲惫，书店更安静。",'
            '"operations":[{"operation":"update_trip_item","target_item_id":3,'
            '"payload":{"title":"安静书店","item_type":"rest"}}]}\n```'
        )

    monkeypatch.setattr("app.agent.nodes.call_llm", fake_call_llm)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "user_message": "我累了，帮我换一个轻松点的安排。",
            "intent_hint": "replan",
            "current_trip": _trip_context(),
        }
    )

    assert result["structured_data"]["operations"][0]["payload"]["title"] == "安静书店"


def test_replan_agent_extracts_json_from_text_payload(monkeypatch) -> None:
    def fake_call_llm(messages: list[dict[str, str]]) -> str:
        return (
            '好的，方案如下：{"needs_clarification":false,"clarifying_question":"",'
            '"summary":"模型建议改去茶馆。",'
            '"reason":"茶馆适合坐下休息。",'
            '"operations":[{"operation":"update_trip_item","target_item_id":3,'
            '"payload":{"title":"附近茶馆","item_type":"rest"}}]}'
        )

    monkeypatch.setattr("app.agent.nodes.call_llm", fake_call_llm)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "user_message": "我累了，帮我换一个轻松点的安排。",
            "intent_hint": "replan",
            "current_trip": _trip_context(),
        }
    )

    assert result["structured_data"]["operations"][0]["payload"]["title"] == "附近茶馆"


def test_replan_agent_does_not_invent_action_when_llm_payload_invalid(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.nodes.call_llm", lambda messages: "这不是 JSON")

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "user_message": "我累了，帮我换一个轻松点的安排。",
            "intent_hint": "replan",
            "current_trip": _trip_context(),
        }
    )

    assert result["intent"] == "replan"
    assert result["structured_data"]["needs_clarification"] is True
    assert result["structured_data"]["operations"] == []
    assert result["action_options"] == []


def test_replan_agent_builds_create_trip_item_option(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.agent.nodes.call_llm",
        lambda messages: (
            '{"needs_clarification":false,"clarifying_question":"",'
            '"summary":"建议在第二天下午新增咖啡馆休息。",'
            '"reason":"用户希望安排轻松一些。",'
            '"operations":[{"operation":"create_trip_item",'
            '"target_date":"2026-07-02","label":"7月2日下午新增咖啡馆休息",'
            '"payload":{"city":"大连","title":"咖啡馆休息","item_type":"rest",'
            '"start_time":"14:30","end_time":"15:30","user_id":999,'
            '"trip_day_id":999}}]}'
        ),
    )

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "user_message": "7月2日下午加一个咖啡馆休息。",
            "current_trip": _trip_context(),
        }
    )

    option = result["action_options"][0]
    assert option["operation"] == "create_trip_item"
    assert option["trip_id"] == 1
    assert option["trip_day_id"] == 11
    assert "user_id" not in option["payload"]
    assert "trip_day_id" not in option["payload"]


@pytest.mark.parametrize(
    "message",
    ["把陈家祠添加为第一个行程项", "把陈家祠添加到旅行第一天"],
)
def test_replan_agent_can_target_missing_first_trip_day(monkeypatch, message: str) -> None:
    monkeypatch.setattr("app.agent.nodes.call_llm", lambda messages: None)
    trip = {
        "id": 8,
        "title": "广州",
        "start_date": "2026-07-01",
        "end_date": "2026-07-03",
        "days": [],
    }

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 8,
            "user_message": message,
            "current_trip": trip,
        }
    )

    option = result["action_options"][0]
    assert option["operation"] == "create_trip_item"
    assert option["trip_id"] == 8
    assert option["target_date"] == "2026-07-01"
    assert option["target_day_index"] == 1
    assert "trip_day_id" not in option


def test_replan_clarification_reply_keeps_trip_item_intent(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.agent.nodes.call_llm",
        lambda messages: (
            '{"needs_clarification":false,"clarifying_question":"",'
            '"summary":"已准备把陈家祠安排到第一天早上九点。",'
            '"reason":"用户补充了开始时间。",'
            '"operations":[{"operation":"create_trip_item",'
            '"target_date":"2026-07-01","target_day_index":1,'
            '"label":"第一天九点新增陈家祠",'
            '"payload":{"city":"广州","title":"陈家祠",'
            '"item_type":"attraction","start_time":"09:00"}}]}'
        ),
    )
    trip = {
        "id": 8,
        "title": "广州",
        "start_date": "2026-07-01",
        "end_date": "2026-07-03",
        "days": [],
    }

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 8,
            "user_message": "早上九点",
            "current_trip": trip,
            "chat_history": [
                {"role": "user", "content": "把陈家祠添加到旅行第一天"},
                {"role": "assistant", "content": "请问第一天什么时间去陈家祠？"},
                {"role": "user", "content": "早上九点"},
            ],
        }
    )

    assert result["intent"] == "replan"
    assert result["action_options"][0]["operation"] == "create_trip_item"
    assert result["action_options"][0]["payload"]["start_time"] == "09:00"


def _guangzhou_trip_context() -> dict[str, object]:
    return {
        "id": 9,
        "title": "广州三日游",
        "start_date": "2026-07-01",
        "end_date": "2026-07-03",
        "days": [
            {
                "id": 20,
                "day_index": 2,
                "trip_date": "2026-07-02",
                "items": [
                    {
                        "id": 10,
                        "city": "广州",
                        "title": "广州塔游览",
                        "start_time": "10:00",
                        "status": "planned",
                    },
                    {
                        "id": 11,
                        "city": "广州",
                        "title": "咖啡馆休息",
                        "start_time": "15:00",
                        "status": "planned",
                    },
                ],
            }
        ],
    }

def test_replan_agent_asks_for_missing_create_target(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.nodes.call_llm", lambda messages: None)

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "user_message": "帮我新增一个轻松的安排。",
            "current_trip": _trip_context(),
        }
    )

    assert result["intent"] == "replan"
    assert result["structured_data"]["needs_clarification"] is True
    assert result["action_options"] == []
    assert "哪一天" in result["reply"]


def test_replan_agent_rejects_item_from_another_trip(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.agent.nodes.call_llm",
        lambda messages: (
            '{"needs_clarification":false,"clarifying_question":"",'
            '"summary":"修改其他节点。","reason":"测试越权 ID。",'
            '"operations":[{"operation":"update_trip_item","target_item_id":999,'
            '"payload":{"start_time":"15:00"}}]}'
        ),
    )

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "user_message": "把博物馆改到下午三点。",
            "current_trip": _trip_context(),
        }
    )

    assert result["action_options"] == []
    assert result["structured_data"]["needs_clarification"] is True


def test_replan_agent_builds_generic_delete_option(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.agent.nodes.call_llm",
        lambda messages: (
            '{"needs_clarification":false,"clarifying_question":"",'
            '"summary":"已准备删除咖啡馆休息。","reason":"用户明确取消该节点。",'
            '"operations":[{"operation":"delete_trip_item",'
            '"target_item_title":"咖啡馆","target_day_index":2,'
            '"label":"删除咖啡馆休息","payload":{}}]}'
        ),
    )

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 9,
            "user_message": "第二天下午的咖啡馆不去了，删掉吧",
            "current_trip": _guangzhou_trip_context(),
        }
    )

    option = result["action_options"][0]
    assert option["operation"] == "delete_trip_item"
    assert option["item_id"] == 11
    assert option["trip_id"] == 9
    assert option["payload"] == {}


def test_replan_agent_resolves_update_from_recent_context(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.agent.nodes.call_llm",
        lambda messages: (
            '{"needs_clarification":false,"clarifying_question":"",'
            '"summary":"建议改为越秀公园。","reason":"用户改变计划。",'
            '"operations":[{"operation":"update_trip_item",'
            '"label":"改为越秀公园",'
            '"payload":{"city":"广州","title":"越秀公园"}}]}'
        ),
    )

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 9,
            "user_message": "算了，改成越秀公园",
            "current_trip": _guangzhou_trip_context(),
            "chat_history": [
                {"role": "assistant", "content": "已为你准备第二天上午的广州塔游览。"},
                {"role": "user", "content": "算了，改成越秀公园"},
            ],
        }
    )

    option = result["action_options"][0]
    assert option["operation"] == "update_trip_item"
    assert option["item_id"] == 10
    assert option["payload"]["title"] == "越秀公园"


def test_replan_agent_asks_when_title_match_is_ambiguous(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.agent.nodes.call_llm",
        lambda messages: (
            '{"needs_clarification":false,"clarifying_question":"",'
            '"summary":"准备修改广州塔安排。","reason":"用户提出修改。",'
            '"operations":[{"operation":"update_trip_item",'
            '"target_item_title":"广州塔","payload":{"start_time":"11:00"}}]}'
        ),
    )
    trip = _guangzhou_trip_context()
    trip["days"][0]["items"] = [
        {"id": 10, "city": "广州", "title": "广州塔东门游览", "status": "planned"},
        {"id": 12, "city": "广州", "title": "广州塔西门游览", "status": "planned"},
    ]

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 9,
            "user_message": "把广州塔改到十一点",
            "current_trip": trip,
        }
    )

    assert result["action_options"] == []
    assert result["structured_data"]["needs_clarification"] is True


def test_replan_agent_rejects_delete_item_from_another_trip(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.agent.nodes.call_llm",
        lambda messages: (
            '{"needs_clarification":false,"clarifying_question":"",'
            '"summary":"准备删除目标。","reason":"测试越权。",'
            '"operations":[{"operation":"delete_trip_item",'
            '"target_item_id":999,"payload":{}}]}'
        ),
    )

    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 9,
            "user_message": "删除那个景点",
            "current_trip": _guangzhou_trip_context(),
        }
    )

    assert result["action_options"] == []
    assert result["structured_data"]["needs_clarification"] is True


def test_replan_multiple_operations_are_pending_not_reported_as_written(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.agent.nodes.call_llm",
        lambda messages: (
            '{"needs_clarification":false,"clarifying_question":"",'
            '"summary":"第一天和第二天已经写入成功。","reason":"用户确认计划。",'
            '"operations":['
            '{"operation":"create_trip_item","target_date":"2026-07-01",'
            '"target_day_index":1,"label":"第一天新增星海广场",'
            '"payload":{"city":"大连","title":"星海广场"}},'
            '{"operation":"create_trip_item","target_date":"2026-07-02",'
            '"target_day_index":2,"label":"第二天新增贝壳博物馆",'
            '"payload":{"city":"大连","title":"大连贝壳博物馆"}}]}'
        ),
    )

    result = run_agent({
        "user_id": 1,
        "trip_id": 1,
        "intent_hint": "replan",
        "user_message": "确认把两天计划一起写入",
        "current_trip": _trip_context(),
    })

    assert len(result["action_options"]) == 2
    assert "当前尚未写入" in result["reply"]
    assert "写入成功" not in result["reply"]

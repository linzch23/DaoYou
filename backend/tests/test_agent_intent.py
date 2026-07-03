import pytest
from pydantic import ValidationError

from app.agent.contracts import AgentInput, AgentIntent, AgentResponse
from app.agent.graph import run_agent
from app.agent.intent import classify_intent


def _trip() -> dict[str, object]:
    return {
        "id": 1,
        "days": [
            {
                "day_index": 1,
                "items": [{"id": 3, "title": "贝壳博物馆", "status": "planned"}],
            }
        ],
    }


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        ("把贝壳博物馆改到下午三点", AgentIntent.REPLAN),
        ("我不想去下一个景点了", AgentIntent.REPLAN),
        ("提醒我九点出发", AgentIntent.REMINDER),
        ("这个景点以前改过名字吗？", AgentIntent.CHAT),
        ("我有点累，但不想改行程", AgentIntent.CHAT),
        ("附近有能坐下休息的地方吗？", AgentIntent.CHAT),
    ],
)
def test_hybrid_intent_rules_avoid_single_keyword_false_positives(
    monkeypatch,
    message: str,
    expected: AgentIntent,
) -> None:
    monkeypatch.setattr("app.agent.intent.call_llm", lambda messages: None)

    result = classify_intent({"user_message": message, "current_trip": _trip()})

    assert result.intent is expected


@pytest.mark.parametrize(
    "message",
    [
        "请正式帮我写入：第一天上午沙面岛，下午陈家祠。",
        "把刚才规划的两天一起写进行程",
        "按这个方案保存到行程里",
    ],
)
def test_explicit_trip_write_requests_are_replan(monkeypatch, message: str) -> None:
    monkeypatch.setattr("app.agent.intent.call_llm", lambda messages: None)

    result = classify_intent({"user_message": message, "current_trip": _trip()})

    assert result.intent is AgentIntent.REPLAN
    assert result.source == "rules"


def test_confirmation_after_assistant_write_invitation_is_replan(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.intent.call_llm", lambda messages: None)

    result = classify_intent({
        "user_message": "确认，就按上午陈家祠、下午北京路来安排吧。",
        "current_trip": _trip(),
        "chat_history": [
            {
                "role": "assistant",
                "content": "要不先记下这个方案？你确认后我就帮你写进行程。",
            },
            {
                "role": "user",
                "content": "确认，就按上午陈家祠、下午北京路来安排吧。",
            },
        ],
    })

    assert result.intent is AgentIntent.REPLAN
    assert result.source == "conversation_state"


@pytest.mark.parametrize("message", ["就这么定", "照你说的办", "这个方案可以，采纳"])
def test_common_confirmation_phrases_do_not_need_llm(monkeypatch, message: str) -> None:
    def fail_if_called(messages):
        raise AssertionError("common confirmation should not call the LLM classifier")

    monkeypatch.setattr("app.agent.intent.call_llm", fail_if_called)

    result = classify_intent({
        "user_message": message,
        "current_trip": _trip(),
        "chat_history": [
            {
                "role": "assistant",
                "content": "你确认后我就帮你把这个方案写进行程。",
            },
        ],
    })

    assert result.intent is AgentIntent.REPLAN
    assert result.source == "conversation_state"


def test_plain_confirmation_without_write_invitation_stays_chat(monkeypatch) -> None:
    monkeypatch.setattr("app.agent.intent.call_llm", lambda messages: None)

    result = classify_intent({
        "user_message": "确认",
        "current_trip": _trip(),
        "chat_history": [{"role": "assistant", "content": "请确认你看到了消息。"}],
    })

    assert result.intent is AgentIntent.CHAT


def test_unfamiliar_confirmation_wording_uses_semantic_fallback(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.agent.intent.call_llm",
        lambda messages: (
            '{"decision":"confirm","confidence":0.93,'
            '"reason":"用户同意应用上一轮待确认方案"}'
        ),
    )

    result = classify_intent({
        "user_message": "那就依你吧",
        "current_trip": _trip(),
        "chat_history": [
            {
                "role": "assistant",
                "content": "你确认后我就帮你把这个方案写进行程。",
            },
        ],
    })

    assert result.intent is AgentIntent.REPLAN
    assert result.source == "llm_confirmation"


def test_semantic_fallback_can_decline_pending_plan(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.agent.intent.call_llm",
        lambda messages: (
            '{"decision":"not_confirm","confidence":0.96,"reason":"用户还未同意方案"}'
        ),
    )

    result = classify_intent({
        "user_message": "我再考虑一下",
        "current_trip": _trip(),
        "chat_history": [
            {
                "role": "assistant",
                "content": "你确认后我就帮你把这个方案写进行程。",
            },
        ],
    })

    assert result.intent is AgentIntent.CHAT


def test_ambiguous_intent_uses_llm_classifier(monkeypatch) -> None:
    monkeypatch.setattr(
        "app.agent.intent.call_llm",
        lambda messages: (
            '{"intent":"reminder","confidence":0.87,'
            '"reason":"用户询问下午是否来得及到达"}'
        ),
    )

    result = classify_intent({"user_message": "下午还来得及吗？"})

    assert result.intent is AgentIntent.REMINDER
    assert result.source == "llm"
    assert result.confidence == 0.87


@pytest.mark.parametrize(
    "payload",
    [
        "not-json",
        '{"intent":"unknown","confidence":0.9,"reason":"invalid"}',
        '{"intent":"replan","confidence":2,"reason":"invalid"}',
        '{"reply":"这不是分类结果"}',
    ],
)
def test_ambiguous_intent_safely_falls_back_when_classifier_is_invalid(
    monkeypatch,
    payload: str,
) -> None:
    monkeypatch.setattr("app.agent.intent.call_llm", lambda messages: payload)

    result = classify_intent({"user_message": "下午还来得及吗？"})

    assert result.intent is AgentIntent.CHAT
    assert result.source == "safe_fallback"


def test_trusted_intent_hint_must_be_known() -> None:
    known = classify_intent({"intent_hint": "reminder", "user_message": "随便聊聊"})
    unknown = classify_intent({"intent_hint": "delete_database", "user_message": "随便聊聊"})

    assert known.intent is AgentIntent.REMINDER
    assert known.source == "intent_hint"
    assert unknown.intent is AgentIntent.CHAT


def test_agent_contract_rejects_invalid_user_id() -> None:
    with pytest.raises(ValidationError):
        AgentInput.model_validate({"user_id": 0})


def test_agent_response_contract_requires_reply() -> None:
    with pytest.raises(ValidationError):
        AgentResponse.model_validate({"intent": "chat"})


def test_run_agent_returns_stable_fallback_for_invalid_input() -> None:
    result = run_agent({"user_id": -1, "user_message": "你好"})

    assert result["intent"] == "chat"
    assert result["reply"]
    assert result["action_options"] == []
    assert result["error"]


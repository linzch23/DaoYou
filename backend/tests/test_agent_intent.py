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


import json
import re

from app.agent.contracts import AgentIntent, IntentClassification
from app.agent.llm import call_llm
from app.agent.prompts import INTENT_CLASSIFY_PROMPT
from app.agent.state import AgentState

HIGH_CONFIDENCE_SCORE = 4
LOW_CONFIDENCE_SCORE = 1


def classify_intent(state: AgentState) -> IntentClassification:
    hint = str(state.get("intent_hint") or "").strip()
    try:
        hinted_intent = AgentIntent(hint)
    except ValueError:
        hinted_intent = None
    if hinted_intent is not None:
        return IntentClassification(
            intent=hinted_intent,
            confidence=1,
            reason="调用方提供了受信任的意图提示",
            source="intent_hint",
        )

    if state.get("image_info"):
        return IntentClassification(
            intent=AgentIntent.PHOTO_EXPLAIN,
            confidence=1,
            reason="请求包含待讲解图片",
            source="request_shape",
        )

    if _is_trip_item_clarification_reply(state):
        return IntentClassification(
            intent=AgentIntent.REPLAN,
            confidence=0.98,
            reason="用户正在补充上一轮行程编辑所缺信息",
            source="conversation_state",
        )

    message = str(state.get("user_message") or "").strip()
    scores, features = _score_intents(message, state)
    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    top_intent, top_score = ranked[0]
    second_score = ranked[1][1]

    if top_score >= HIGH_CONFIDENCE_SCORE and top_score - second_score >= 2:
        return IntentClassification(
            intent=top_intent,
            confidence=min(0.98, 0.72 + top_score * 0.05),
            reason="命中高置信度意图规则",
            source="rules",
            matched_features=features[top_intent],
        )

    if top_score <= LOW_CONFIDENCE_SCORE:
        return IntentClassification(
            intent=AgentIntent.CHAT,
            confidence=0.9 if top_score == 0 else 0.72,
            reason="没有足够证据触发专用工作流",
            source="rules",
            matched_features=features[top_intent],
        )

    llm_result = _classify_with_llm(state, scores)
    if llm_result is not None and llm_result.confidence >= 0.65:
        return llm_result

    return IntentClassification(
        intent=AgentIntent.CHAT,
        confidence=0.55,
        reason="规则存在歧义且模型未给出可靠分类，安全回退普通对话",
        source="safe_fallback",
        matched_features=features[top_intent],
    )


def _score_intents(
    message: str,
    state: AgentState,
) -> tuple[dict[AgentIntent, int], dict[AgentIntent, list[str]]]:
    scores = {intent: 0 for intent in AgentIntent}
    features = {intent: [] for intent in AgentIntent}

    def add(intent: AgentIntent, score: int, feature: str) -> None:
        scores[intent] += score
        features[intent].append(feature)

    if re.search(r"(?:帮我|请|我要|我想|把).*(?:新增|添加|加入|插入)", message):
        add(AgentIntent.REPLAN, 4, "imperative_create")
    create_pattern = (
        r"(?:新增|添加|加一个|加个|插入|安排一个)"
        r".*(?:行程|景点|餐|咖啡|休息|安排|活动|项目)"
    )
    if re.search(create_pattern, message):
        add(AgentIntent.REPLAN, 3, "create_trip_item")
    if re.search(r"(?:把|将).+?(?:改成|换成|改到|调整到|删除|删掉|移除|取消)", message):
        add(AgentIntent.REPLAN, 4, "explicit_target_edit")
    if re.search(r"(?:删除|删掉|移除|取消).*(?:景点|行程|安排|活动|项目)", message):
        add(AgentIntent.REPLAN, 4, "explicit_delete")
    if re.search(r"(?:不想去|不去了|不要了|跳过).*(?:景点|下一站|行程|安排)?", message):
        add(AgentIntent.REPLAN, 4, "cancel_plan")
    if re.search(r"(?:算了|还是|帮我|我想).*(?:改成|换成|换一个)", message):
        add(AgentIntent.REPLAN, 4, "explicit_replacement")
    if re.search(r"第[一二三四五六七八九十\d]+天|上午|下午|晚上|\d{1,2}[点时]", message):
        add(AgentIntent.REPLAN, 1, "trip_time_reference")

    trip_titles = _trip_item_titles(state)
    if any(title and title in message for title in trip_titles):
        add(AgentIntent.REPLAN, 2, "existing_trip_item")

    if re.search(r"(?:提醒我|给我提醒|设置提醒|取消提醒|什么时候出发)", message):
        add(AgentIntent.REMINDER, 4, "explicit_reminder_request")
    if re.search(r"(?:还来得及|会不会迟到|赶得上|最晚几点出发)", message):
        add(AgentIntent.REMINDER, 3, "schedule_risk_question")
    if "风险" in message and re.search(r"行程|出发|迟到|天气", message):
        add(AgentIntent.REMINDER, 3, "travel_risk")

    return scores, features


def _classify_with_llm(
    state: AgentState,
    scores: dict[AgentIntent, int],
) -> IntentClassification | None:
    recent_history = [
        message
        for message in (state.get("chat_history") or [])[-6:]
        if isinstance(message, dict)
    ]
    llm_text = call_llm(
        [
            {"role": "system", "content": INTENT_CLASSIFY_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "user_message": state.get("user_message") or "",
                        "recent_history": recent_history,
                        "current_trip": state.get("current_trip") or {},
                        "rule_scores": {intent.value: score for intent, score in scores.items()},
                    },
                    ensure_ascii=False,
                ),
            },
        ]
    )
    if not llm_text:
        return None

    try:
        data = json.loads(llm_text)
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(data, dict):
        return None

    try:
        intent = AgentIntent(data.get("intent"))
        confidence = float(data.get("confidence"))
    except (TypeError, ValueError):
        return None
    if not 0 <= confidence <= 1:
        return None
    reason = data.get("reason")
    return IntentClassification(
        intent=intent,
        confidence=confidence,
        reason=reason if isinstance(reason, str) else "",
        source="llm",
    )


def _trip_item_titles(state: AgentState) -> list[str]:
    trip = state.get("current_trip")
    if not isinstance(trip, dict):
        return []
    return [
        str(item.get("title") or "")
        for day in trip.get("days", [])
        if isinstance(day, dict)
        for item in day.get("items", [])
        if isinstance(item, dict)
    ]


def _is_trip_item_create_request(message: str) -> bool:
    if re.search(r"(?:不想去|不去了|不要了|换|取消|修改|删除|删掉|移除)", message):
        return False
    return bool(
        re.search(r"(?:新增|添加|加一个|加个|安排一个|插入)", message)
        or (
            "安排" in message
            and re.search(r"(?:景点|餐|咖啡|休息|活动|项目)", message)
        )
    )


def _is_trip_item_clarification_reply(state: AgentState) -> bool:
    history = state.get("chat_history")
    if not isinstance(history, list):
        return False
    recent_messages = [message for message in history[-8:] if isinstance(message, dict)]
    has_create_request = any(
        message.get("role") == "user"
        and _is_trip_item_create_request(str(message.get("content") or ""))
        for message in recent_messages
    )
    has_clarification = any(
        message.get("role") == "assistant"
        and re.search(
            r"请问|哪一天|什么时间|几点|确认日期",
            str(message.get("content") or ""),
        )
        for message in recent_messages
    )
    return has_create_request and has_clarification

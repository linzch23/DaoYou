import json
import re

from app.agent.llm import call_llm
from app.agent.prompts import (
    CHAT_PROMPT,
    PHOTO_EXPLAIN_PROMPT,
    REMINDER_PROMPT,
    REPLAN_PROMPT,
)
from app.agent.state import AgentState
from app.agent.tools import (
    find_replan_target,
    map_tool,
    memory_tool,
    ocr_tool,
    reminder_tool,
    trip_item_tool,
    trip_tool,
    vision_tool,
    weather_tool,
)


# 当前是 mock 意图识别：优先使用 service 传入的 intent_hint，
# 后续可以替换为 LLM intent classifier 或更完整的规则分类器。
def intent_detect_node(state: AgentState) -> AgentState:
    if state.get("intent_hint"):
        return {**state, "intent": str(state["intent_hint"])}

    if state.get("image_info"):
        return {**state, "intent": "photo_explain"}

    message = str(state.get("user_message") or "")
    if any(
        keyword in message
        for keyword in [
            "不想去",
            "累",
            "换",
            "取消",
            "改",
            "新增",
            "添加",
            "加一个",
            "加个",
            "安排一个",
            "插入",
            "删除",
            "删掉",
            "移除",
            "不去了",
            "不要了",
        ]
    ) or (
        "安排" in message
        and any(keyword in message for keyword in ["景点", "餐", "咖啡", "休息", "活动", "项目"])
    ):
        return {**state, "intent": "replan"}
    if _is_trip_item_clarification_reply(state):
        return {**state, "intent": "replan"}
    if any(keyword in message for keyword in ["提醒", "来得及", "出发", "风险"]):
        return {**state, "intent": "reminder"}
    return {**state, "intent": "chat"}


# AI 对话节点：负责结合用户偏好和当前消息生成自然语言回复。
def chat_response_node(state: AgentState) -> AgentState:
    preferences = memory_tool(state)
    message = str(state.get("user_message") or "")
    llm_result = _generate_chat_with_llm(state, preferences, message)
    reply = llm_result["reply"] or _mock_chat_reply(message, preferences)
    clarification_options = llm_result["clarification_options"]
    follow_up_questions = [] if clarification_options else (
        llm_result["follow_up_questions"]
        or [
            "帮我把下午安排得轻松一点",
            "推荐附近适合休息的地方",
        ]
    )

    final_response = {
        "intent": "chat",
        "reply": reply,
        "action_options": [],
        "structured_data": {},
        "follow_up_questions": follow_up_questions,
        "clarification_options": clarification_options,
    }
    return {**state, "final_response": final_response}


# 拍照讲解节点：汇总 Vision/OCR mock 工具结果，生成识别结果和个性化讲解。
def photo_explain_node(state: AgentState) -> AgentState:
    image_info = state.get("image_info") or {}
    vision_result = vision_tool(image_info)
    ocr_result = ocr_tool(image_info)
    preferences = memory_tool(state)
    llm_result = _generate_photo_explanation_with_llm(
        state=state,
        vision_result=vision_result,
        ocr_result=ocr_result,
        preferences=preferences,
    )
    payload = llm_result or _mock_photo_payload(vision_result, ocr_result, preferences)
    explanation = str(payload["explanation"])

    structured_data = {
        "recognition_result": payload["recognition_result"],
        "explanation": explanation,
        "ocr_text": ocr_result["text"],
    }
    final_response = {
        "intent": "photo_explain",
        "reply": explanation,
        "structured_data": structured_data,
        "follow_up_questions": payload["follow_up_questions"],
        "clarification_options": [],
    }
    return {
        **state,
        "tool_results": {"vision": vision_result, "ocr": ocr_result},
        "final_response": final_response,
    }


# 智能提醒节点：根据当前行程、位置和时间生成主动提醒结果。
def reminder_node(state: AgentState) -> AgentState:
    tool_result = reminder_tool(state)
    llm_result = _generate_reminder_with_llm(state, tool_result)
    reminder_result = llm_result or tool_result
    reminder = reminder_result.get("reminder") or {}
    reply = str(reminder.get("content") or "当前行程暂时没有明显风险，可以按计划继续。")
    final_response = {
        "intent": "reminder",
        "reply": reply,
        "structured_data": reminder_result,
        "follow_up_questions": [],
        "clarification_options": [],
    }
    return {
        **state,
        "tool_results": {"reminder": reminder_result},
        "final_response": final_response,
    }


# 动态改线节点：根据用户临时需求、地图和天气工具结果生成改线草案。
def replan_node(state: AgentState) -> AgentState:
    trip = trip_tool(state)
    preferences = memory_tool(state)
    location = state.get("current_location") or {}
    map_result = map_tool(origin=location, keyword="附近咖啡馆")
    weather_result = weather_tool(city=str(trip.get("city") or "大连"))
    explicit_first_item = _explicit_first_trip_item_payload(state, trip)
    llm_result = None
    if explicit_first_item is None:
        llm_result = _generate_replan_with_llm(
            state=state,
            trip=trip,
            preferences=preferences,
            map_result=map_result,
            weather_result=weather_result,
        )
    if explicit_first_item is not None:
        structured_data = explicit_first_item
    elif llm_result is not None:
        structured_data = llm_result
    elif _is_trip_item_create_request(str(state.get("user_message") or "")):
        structured_data = _clarification_payload("请告诉我想添加到旅行中的哪一天，以及具体安排。")
    else:
        structured_data = _mock_replan_payload(trip, map_result, preferences)

    action_options, action_error = _build_replan_action_options(state, structured_data)
    if action_error and not action_options:
        structured_data = {
            **structured_data,
            "needs_clarification": True,
            "clarifying_question": action_error,
            "operations": [],
        }
    reply = str(
        structured_data.get("clarifying_question")
        if structured_data.get("needs_clarification")
        else structured_data.get("summary")
        or "我已经整理好行程调整方案，请确认后应用。"
    )
    final_response = {
        "intent": "replan",
        "reply": reply,
        "action_options": action_options,
        "structured_data": structured_data,
        "follow_up_questions": [],
        "clarification_options": [],
    }
    return {
        **state,
        "tool_results": {"map": map_result, "weather": weather_result},
        "final_response": final_response,
    }


# 长期记忆更新节点：当前是占位，后续在这里做用户偏好总结与写入。
def memory_update_node(state: AgentState) -> AgentState:
    return state


def _generate_chat_with_llm(
    state: AgentState,
    preferences: dict[str, object],
    message: str,
) -> dict[str, object]:
    # 未配置 API Key、模型超时或模型返回格式异常时，call_llm 会返回 None，节点继续走 mock。
    llm_text = call_llm(
        [
            {"role": "system", "content": CHAT_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "current_trip": state.get("current_trip") or {},
                        "user_preferences": preferences,
                        "chat_history": state.get("chat_history") or [],
                        "user_message": message,
                    },
                    ensure_ascii=False,
                ),
            },
        ]
    )
    if not llm_text:
        return {"reply": "", "follow_up_questions": [], "clarification_options": []}

    data = _parse_json_object(llm_text)
    if data is None:
        return {"reply": llm_text, "follow_up_questions": [], "clarification_options": []}

    reply = data.get("reply")
    questions = _sanitize_suggested_questions(data.get("suggested_questions"))
    clarification_options = _sanitize_clarification_options(data.get("clarification_options"))
    if clarification_options:
        questions = []
    return {
        "reply": reply if isinstance(reply, str) else "",
        "follow_up_questions": questions,
        "clarification_options": clarification_options,
    }


def _sanitize_suggested_questions(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()][:5]


def _sanitize_clarification_options(value: object) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    options: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        option_id = item.get("option_id")
        label = item.get("label")
        message = item.get("message")
        if not all(
            isinstance(field, str) and field.strip()
            for field in (option_id, label, message)
        ):
            continue
        options.append(
            {
                "option_id": option_id.strip(),
                "label": label.strip(),
                "message": message.strip(),
            }
        )
    return options[:5]


def _mock_chat_reply(message: str, preferences: dict[str, object]) -> str:
    pace = str(preferences.get("travel_pace") or "normal")
    if "拍照" in message:
        return "如果你想拍照，我建议优先找海边开阔位置，把建筑和水面一起放进画面。"
    if pace == "slow":
        return "这次旅行我建议按慢节奏走。下午不要排太满，可以保留一个重点景点，再安排一段休息。"
    return "当前行程可以按计划推进。我会帮你留意时间和下一站路程。"


def _generate_photo_explanation_with_llm(
    state: AgentState,
    vision_result: dict[str, object],
    ocr_result: dict[str, object],
    preferences: dict[str, object],
) -> dict[str, object] | None:
    llm_text = call_llm(
        [
            {"role": "system", "content": PHOTO_EXPLAIN_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "current_trip": state.get("current_trip") or {},
                        "current_location": state.get("current_location") or {},
                        "image_info": state.get("image_info") or {},
                        "user_preferences": preferences,
                        "vision_result": vision_result,
                        "ocr_result": ocr_result,
                    },
                    ensure_ascii=False,
                ),
            },
        ]
    )
    if not llm_text:
        return None

    data = _parse_json_object(llm_text)
    if data is None or not _is_valid_photo_payload(data):
        return None
    return data


def _is_valid_photo_payload(data: object) -> bool:
    if not isinstance(data, dict):
        return False
    return (
        isinstance(data.get("recognition_result"), str)
        and isinstance(data.get("explanation"), str)
        and isinstance(data.get("follow_up_questions"), list)
        and all(
            isinstance(question, str)
            for question in data.get("follow_up_questions", [])
        )
    )


def _mock_photo_payload(
    vision_result: dict[str, object],
    ocr_result: dict[str, object],
    preferences: dict[str, object],
) -> dict[str, object]:
    style = str(preferences.get("explanation_style") or "fun")
    name = str(vision_result.get("name") or "当前景点")

    if style == "children":
        explanation = (
            f"这张图可能是{name}。你可以把它想象成一个靠海的小舞台，"
            "建筑、海风和步道一起组成了适合散步的地方。"
        )
    else:
        explanation = (
            f"你上传的图片可能是{name}。这里适合慢节奏散步和拍照，"
            "可以重点观察海港空间、建筑立面和步道之间的层次。"
        )

    return {
        "recognition_result": str(
            vision_result.get("recognition_result") or f"可能是{name}"
        ),
        "explanation": explanation,
        "ocr_text": str(ocr_result.get("text") or ""),
        "follow_up_questions": [
            "这里怎么拍照好看？",
            "附近适合休息的地方有哪些？",
            "可以讲一个儿童版介绍吗？",
        ],
    }


def _generate_reminder_with_llm(
    state: AgentState,
    tool_result: dict[str, object],
) -> dict[str, object] | None:
    llm_text = call_llm(
        [
            {"role": "system", "content": REMINDER_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "current_trip": state.get("current_trip") or {},
                        "current_time": state.get("current_time") or "",
                        "current_location": state.get("current_location") or {},
                        "risk_result": tool_result,
                    },
                    ensure_ascii=False,
                ),
            },
        ]
    )
    if not llm_text:
        return None

    data = _parse_json_object(llm_text)
    if data is None or not _is_valid_reminder_payload(data):
        return None
    return data


def _is_valid_reminder_payload(data: object) -> bool:
    if not isinstance(data, dict) or not isinstance(data.get("has_risk"), bool):
        return False

    reminder = data.get("reminder")
    if reminder is None:
        return data["has_risk"] is False
    if not isinstance(reminder, dict):
        return False
    required_keys = {
        "id": int,
        "type": str,
        "content": str,
        "status": str,
    }
    return all(
        isinstance(reminder.get(key), expected_type)
        for key, expected_type in required_keys.items()
    )


def _generate_replan_with_llm(
    state: AgentState,
    trip: dict[str, object],
    preferences: dict[str, object],
    map_result: dict[str, object],
    weather_result: dict[str, object],
) -> dict[str, object] | None:
    # 成员 C 维护：动态改线的 LLM 入口。模型必须返回固定 JSON，否则回退 mock 草案。
    llm_text = call_llm(
        [
            {"role": "system", "content": REPLAN_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {
                        "user_message": state.get("user_message") or "",
                        "chat_history": state.get("chat_history") or [],
                        "current_trip": trip,
                        "current_location": state.get("current_location") or {},
                        "user_preferences": preferences,
                        "map_result": map_result,
                        "weather_result": weather_result,
                    },
                    ensure_ascii=False,
                ),
            },
        ]
    )
    if not llm_text:
        return None

    data = _parse_json_object(llm_text)
    if data is None:
        return None

    if not _is_valid_replan_payload(data):
        return None
    return data


def _parse_json_object(text: str) -> dict[str, object] | None:
    # 兼容模型返回 ```json 代码块或“方案如下：{...}”这类非纯 JSON 文本。
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        data = None
    if isinstance(data, dict):
        return data

    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```json").removeprefix("```").strip()
        cleaned = cleaned.removesuffix("```").strip()
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError:
            data = None
        if isinstance(data, dict):
            return data

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None

    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _is_valid_replan_payload(data: object) -> bool:
    if not isinstance(data, dict):
        return False
    required_keys = {
        "needs_clarification": bool,
        "clarifying_question": str,
        "summary": str,
        "reason": str,
        "operations": list,
    }
    if not all(
        isinstance(data.get(key), expected_type)
        for key, expected_type in required_keys.items()
    ):
        return False
    if data["needs_clarification"]:
        return not data["operations"] and bool(data["clarifying_question"].strip())
    return bool(data["operations"]) and all(
        isinstance(operation, dict) for operation in data["operations"]
    )


def _build_replan_action_options(
    state: AgentState,
    structured_data: dict[str, object],
) -> tuple[list[dict[str, object]], str | None]:
    if structured_data.get("needs_clarification"):
        return [], None

    operations = structured_data.get("operations")
    if not isinstance(operations, list):
        return [], "行程修改方案格式不完整，请重新说明需求"

    action_options: list[dict[str, object]] = []
    for index, operation in enumerate(operations, start=1):
        if not isinstance(operation, dict):
            return [], "行程修改方案格式不完整，请重新说明需求"
        candidate = {
            **operation,
            "option_id": f"option_{index:03d}",
            "description": operation.get("description") or structured_data.get("reason") or "",
        }
        result = trip_item_tool(state, candidate)
        action_option = result.get("action_option")
        if not isinstance(action_option, dict):
            return [], str(result.get("error") or "无法确认目标行程项，请补充信息")
        action_options.append(action_option)
    return action_options, None


def _mock_replan_payload(
    trip: dict[str, object],
    map_result: dict[str, object],
    preferences: dict[str, object],
) -> dict[str, object]:
    reason = "用户当前偏好慢节奏和少步行，原计划下午路线较远。"
    if "less_walking" not in preferences.get("special_needs", []):
        reason = "当前请求表达了降低强度的需求，因此建议减少远距离移动。"

    target_item = find_replan_target(trip)
    recommended_place = map_result.get("recommended_place")
    payload = dict(recommended_place) if isinstance(recommended_place, dict) else {}
    return {
        "needs_clarification": False,
        "clarifying_question": "",
        "summary": "建议取消较远的户外景点，改为附近咖啡馆休息。",
        "reason": reason,
        "operations": [
            {
                "operation": "update_trip_item",
                "target_item_id": target_item.get("id"),
                "label": f"改为{payload.get('title') or '附近咖啡馆休息'}",
                "payload": payload,
            },
            {
                "operation": "update_trip_item",
                "target_item_id": target_item.get("id"),
                "label": "跳过下一站",
                "description": "直接将下一站标记为跳过。",
                "payload": {
                    "status": "skipped",
                    "notes": "用户临时取消该安排",
                },
            },
        ],
    }


def _clarification_payload(question: str) -> dict[str, object]:
    return {
        "needs_clarification": True,
        "clarifying_question": question,
        "summary": "需要补充行程项信息。",
        "reason": "当前信息不足以安全生成可执行操作。",
        "operations": [],
    }


def _explicit_first_trip_item_payload(
    state: AgentState,
    trip: dict[str, object],
) -> dict[str, object] | None:
    message = str(state.get("user_message") or "").strip()
    patterns = [
        r"把(?P<title>.+?)(?:添加|加入|安排)(?:为|到)?第一个行程项",
        r"把(?P<title>.+?)(?:添加|加入|安排)(?:到|进)(?:本次)?旅行(?:的)?第一天",
        r"把(?P<title>.+?)(?:添加|加入|安排)(?:到|进)第一天",
    ]
    match = next((match for pattern in patterns if (match := re.search(pattern, message))), None)
    start_date = str(trip.get("start_date") or "")
    if match is None or not start_date:
        return None

    title = match.group("title").strip(" ，,。")
    if not title:
        return None
    city = str(trip.get("title") or "").strip() or "当前城市"
    return {
        "needs_clarification": False,
        "clarifying_question": "",
        "summary": f"已准备把{title}添加到旅行第一天，请确认后应用。",
        "reason": "用户明确指定将该地点作为第一个行程项。",
        "operations": [
            {
                "operation": "create_trip_item",
                "target_date": start_date,
                "target_day_index": 1,
                "label": f"第一天新增{title}",
                "description": "作为当前旅行的第一个行程项",
                "payload": {
                    "city": city,
                    "title": title,
                    "item_type": "attraction",
                    "notes": "用户通过聊天确认新增",
                },
            }
        ],
    }


def _is_trip_item_create_request(message: str) -> bool:
    if any(
        keyword in message
        for keyword in ["不想去", "不去了", "不要了", "换", "取消", "改", "删除", "删掉", "移除"]
    ):
        return False
    return any(
        keyword in message
        for keyword in ["新增", "添加", "加一个", "加个", "安排一个", "插入"]
    ) or (
        "安排" in message
        and any(keyword in message for keyword in ["景点", "餐", "咖啡", "休息", "活动", "项目"])
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
        and any(
            keyword in str(message.get("content") or "")
            for keyword in ["请问", "哪一天", "什么时间", "几点", "确认日期"]
        )
        for message in recent_messages
    )
    return has_create_request and has_clarification

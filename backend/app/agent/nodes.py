import json

from app.agent.llm import call_llm
from app.agent.prompts import CHAT_PROMPT, REPLAN_PROMPT
from app.agent.state import AgentState
from app.agent.tools import (
    map_tool,
    memory_tool,
    ocr_tool,
    reminder_tool,
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
    if any(keyword in message for keyword in ["不想去", "累", "换", "取消", "改"]):
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
    follow_up_questions = llm_result["follow_up_questions"] or [
        "要不要帮你把下午改轻松一点？",
        "需要我推荐附近适合休息的地方吗？",
    ]

    final_response = {
        "intent": "chat",
        "reply": reply,
        "structured_data": {},
        "follow_up_questions": follow_up_questions,
    }
    return {**state, "final_response": final_response}


# 拍照讲解节点：汇总 Vision/OCR mock 工具结果，生成识别结果和个性化讲解。
def photo_explain_node(state: AgentState) -> AgentState:
    image_info = state.get("image_info") or {}
    vision_result = vision_tool(image_info)
    ocr_result = ocr_tool(image_info)
    preferences = memory_tool(state)
    style = str(preferences.get("explanation_style") or "fun")

    if style == "children":
        explanation = (
            f"这张图可能是{vision_result['name']}。你可以把它想象成一个靠海的小舞台，"
            "建筑、海风和步道一起组成了适合散步的地方。"
        )
    else:
        explanation = (
            f"你上传的图片可能是{vision_result['name']}。这里适合慢节奏散步和拍照，"
            "可以重点观察海港空间、建筑立面和步道之间的层次。"
        )

    structured_data = {
        "recognition_result": vision_result["recognition_result"],
        "explanation": explanation,
        "ocr_text": ocr_result["text"],
    }
    final_response = {
        "intent": "photo_explain",
        "reply": explanation,
        "structured_data": structured_data,
        "follow_up_questions": [
            "这里怎么拍照好看？",
            "附近适合休息的地方有哪些？",
            "可以讲一个儿童版介绍吗？",
        ],
    }
    return {
        **state,
        "tool_results": {"vision": vision_result, "ocr": ocr_result},
        "final_response": final_response,
    }


# 智能提醒节点：根据当前行程、位置和时间生成主动提醒结果。
def reminder_node(state: AgentState) -> AgentState:
    reminder_result = reminder_tool(state)
    reminder = reminder_result.get("reminder") or {}
    reply = str(reminder.get("content") or "当前行程暂时没有明显风险，可以按计划继续。")
    final_response = {
        "intent": "reminder",
        "reply": reply,
        "structured_data": reminder_result,
        "follow_up_questions": [],
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
    llm_result = _generate_replan_with_llm(
        state=state,
        trip=trip,
        preferences=preferences,
        map_result=map_result,
        weather_result=weather_result,
    )
    structured_data = llm_result or _mock_replan_payload(map_result, preferences)
    reply = (
        structured_data.get("summary")
        or "我建议把较远的户外景点换成附近咖啡馆休息，再保留傍晚海边散步。"
    )
    final_response = {
        "intent": "replan",
        "reply": reply,
        "structured_data": structured_data,
        "follow_up_questions": [
            "要应用这个改线方案吗？",
            "要不要换成室内博物馆方案？",
        ],
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
        return {"reply": "", "follow_up_questions": []}

    try:
        data = json.loads(llm_text)
    except json.JSONDecodeError:
        return {"reply": llm_text, "follow_up_questions": []}

    reply = data.get("reply")
    questions = data.get("follow_up_questions")
    return {
        "reply": reply if isinstance(reply, str) else "",
        "follow_up_questions": questions if isinstance(questions, list) else [],
    }


def _mock_chat_reply(message: str, preferences: dict[str, object]) -> str:
    pace = str(preferences.get("travel_pace") or "normal")
    if "拍照" in message:
        return "如果你想拍照，我建议优先找海边开阔位置，把建筑和水面一起放进画面。"
    if pace == "slow":
        return "这次旅行我建议按慢节奏走。下午不要排太满，可以保留一个重点景点，再安排一段休息。"
    return "当前行程可以按计划推进。我会帮你留意时间和下一站路程。"


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
        "draft_id": str,
        "summary": str,
        "reason": str,
        "new_items": list,
        "removed_item_ids": list,
    }
    return all(
        isinstance(data.get(key), expected_type)
        for key, expected_type in required_keys.items()
    )


def _mock_replan_payload(
    map_result: dict[str, object],
    preferences: dict[str, object],
) -> dict[str, object]:
    reason = "用户当前偏好慢节奏和少步行，原计划下午路线较远。"
    if "less_walking" not in preferences.get("special_needs", []):
        reason = "当前请求表达了降低强度的需求，因此建议减少远距离移动。"

    return {
        "draft_id": "draft_001",
        "summary": "建议取消较远的户外景点，改为附近咖啡馆休息。",
        "reason": reason,
        "new_items": [map_result["recommended_place"]],
        "removed_item_ids": [3],
    }

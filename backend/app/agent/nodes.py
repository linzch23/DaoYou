from app.agent.state import AgentState
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
    pace = str(preferences.get("travel_pace") or "normal")

    if "拍照" in message:
        reply = "如果你想拍照，我建议优先找海边开阔位置，把建筑和水面一起放进画面。"
    elif pace == "slow":
        reply = "这次旅行我建议按慢节奏走。下午不要排太满，可以保留一个重点景点，再安排一段休息。"
    else:
        reply = "当前行程可以按计划推进。我会帮你留意时间和下一站路程。"

    final_response = {
        "intent": "chat",
        "reply": reply,
        "action_options": [],
        "follow_up_questions": [
            "要不要帮你把下午改轻松一点？",
            "需要我推荐附近适合休息的地方吗？",
        ],
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
        "action_options": [],
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
        "structured_data": structured_data,
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
        "action_options": [],
        "structured_data": reminder_result,
        "follow_up_questions": [],
    }
    return {
        **state,
        "tool_results": {"reminder": reminder_result},
        "structured_data": reminder_result,
        "final_response": final_response,
    }


# 动态改线节点：在 Chat 流程内生成可选的行程节点更新参数，不直接修改数据库。
def replan_node(state: AgentState) -> AgentState:
    trip = trip_tool(state)
    preferences = memory_tool(state)
    location = state.get("current_location") or {}
    map_result = map_tool(origin=location, keyword="附近咖啡馆")
    target_item = find_replan_target(trip)
    city = str(target_item.get("city") or "大连")
    weather_result = weather_tool(city=city)
    new_item = dict(map_result["recommended_place"])
    new_item["city"] = city

    reason = "用户当前偏好慢节奏和少步行，原计划下午路线较远。"
    if "less_walking" not in preferences.get("special_needs", []):
        reason = "当前请求表达了降低强度的需求，因此建议减少远距离移动。"

    item_id = int(target_item.get("id") or 3)
    action_options = [
        {
            "option_id": "option_001",
            "label": "改为附近咖啡馆休息",
            "description": reason,
            "operation": "update_trip_item",
            "item_id": item_id,
            "payload": new_item,
        },
        {
            "option_id": "option_002",
            "label": "跳过下一站",
            "description": "直接将下一站标记为跳过。",
            "operation": "update_trip_item",
            "item_id": item_id,
            "payload": {
                "status": "skipped",
                "notes": "用户临时取消该安排",
            },
        },
    ]
    reply = "我建议把较远的户外景点换成附近咖啡馆休息，也可以直接跳过下一站。"
    final_response = {
        "intent": "replan",
        "reply": reply,
        "action_options": action_options,
        "follow_up_questions": [],
    }
    return {
        **state,
        "tool_results": {"map": map_result, "weather": weather_result},
        "action_options": action_options,
        "final_response": final_response,
    }


# 长期记忆更新节点：当前是占位，后续在这里做用户偏好总结与写入。
def memory_update_node(state: AgentState) -> AgentState:
    return state

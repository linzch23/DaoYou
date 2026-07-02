from langgraph.graph import END, START, StateGraph
from pydantic import ValidationError

from app.agent.contracts import AgentInput, AgentResponse
from app.agent.nodes import (
    chat_response_node,
    intent_detect_node,
    memory_update_node,
    photo_explain_node,
    reminder_node,
    replan_node,
)
from app.agent.state import AgentState

FALLBACK_RESPONSE = {
    "intent": "chat",
    "reply": "导友暂时没能生成完整回复，但我会继续帮你看行程和时间安排。",
    "action_options": [],
    "follow_up_questions": [],
    "clarification_options": [],
}


# 成员 C 维护：把意图识别节点得到的 intent 映射到具体业务节点。
def route_by_intent(state: AgentState) -> str:
    intent = str(state.get("intent") or "chat")
    if intent in {"photo_explain", "reminder", "replan"}:
        return intent
    return "chat"


# 成员 C 维护：当前是 LangGraph Demo，流程为
# START -> intent_detect -> 分支业务节点 -> memory_update -> END。
def build_agent_graph():
    graph = StateGraph(AgentState)
    graph.add_node("intent_detect", intent_detect_node)
    graph.add_node("chat", chat_response_node)
    graph.add_node("photo_explain", photo_explain_node)
    graph.add_node("reminder", reminder_node)
    graph.add_node("replan", replan_node)
    graph.add_node("memory_update", memory_update_node)

    graph.add_edge(START, "intent_detect")
    graph.add_conditional_edges(
        "intent_detect",
        route_by_intent,
        {
            "chat": "chat",
            "photo_explain": "photo_explain",
            "reminder": "reminder",
            "replan": "replan",
        },
    )
    graph.add_edge("chat", "memory_update")
    graph.add_edge("photo_explain", "memory_update")
    graph.add_edge("reminder", "memory_update")
    graph.add_edge("replan", "memory_update")
    graph.add_edge("memory_update", END)
    return graph.compile()


AGENT_GRAPH = build_agent_graph()


# service 层调用 Agent 的唯一入口；不要在 router/service 中散写 Agent 推理逻辑。
def run_agent(state: AgentState) -> dict[str, object]:
    try:
        validated_state = AgentInput.model_validate(state).model_dump()
        final_state = AGENT_GRAPH.invoke(validated_state)
        response = dict(final_state.get("final_response") or FALLBACK_RESPONSE)
        response["memory_candidates"] = final_state.get("memory_candidates") or []
    except Exception as exc:
        response = {**FALLBACK_RESPONSE, "error": str(exc)}

    response.setdefault("intent", "chat")
    response.setdefault("reply", FALLBACK_RESPONSE["reply"])
    response.setdefault("action_options", [])
    response.setdefault("structured_data", {})
    response.setdefault("follow_up_questions", [])
    response.setdefault("clarification_options", [])
    try:
        return AgentResponse.model_validate(response).model_dump(mode="json", exclude_none=True)
    except ValidationError as exc:
        return AgentResponse(
            **FALLBACK_RESPONSE,
            error=f"Agent 输出结构无效: {exc}",
        ).model_dump(mode="json", exclude_none=True)

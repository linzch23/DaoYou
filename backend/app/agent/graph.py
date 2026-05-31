from app.agent.state import AgentState


def run_agent(state: AgentState) -> dict[str, object]:
    return {
        "intent": state.get("intent_hint", "chat"),
        "reply": "Agent 图待接入，当前为骨架响应。",
        "structured_data": {},
        "follow_up_questions": [],
    }


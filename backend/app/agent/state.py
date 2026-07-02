from typing import TypedDict


# 成员 C 维护：AgentState 是 LangGraph 每个节点共享和传递的状态对象。
class AgentState(TypedDict, total=False):
    # API/service 层传入的基础输入，用于识别用户、行程和本轮请求。
    user_id: int
    trip_id: int
    user_message: str
    intent_hint: str
    current_time: str
    # service 层注入的上下文，后续可替换为数据库、缓存或长期记忆查询结果。
    current_trip: dict[str, object]
    current_location: dict[str, float]
    user_preferences: dict[str, object]
    long_term_memories: list[dict[str, object]]
    chat_history: list[dict[str, object]]
    image_info: dict[str, object]
    # Agent 节点内部写入的中间结果，用于串联工具调用、结构化输出和最终回复。
    tool_results: dict[str, object]
    intent: str
    intent_classification: dict[str, object]
    memory_candidates: list[dict[str, object]]
    structured_data: dict[str, object]
    action_options: list[dict[str, object]]
    follow_up_questions: list[str]
    clarification_options: list[dict[str, str]]
    # graph.py 的 run_agent 只读取 final_response 作为对 service 层的统一返回。
    final_response: dict[str, object]
    error: str

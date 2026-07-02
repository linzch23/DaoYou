import json
import re

from pydantic import ValidationError

from app.agent.llm import call_llm
from app.agent.prompts import CUSTOM_PREFERENCE_PARSE_PROMPT
from app.schemas.preferences import CustomPreferences


def parse_custom_preferences(
    text: str,
    current_preferences: dict[str, object] | None = None,
) -> dict[str, object]:
    clean_text = text.strip()
    rules = _parse_with_rules(clean_text)
    llm_result = _parse_with_llm(clean_text, current_preferences or {})
    parsed = _merge_preferences(
        llm_result.get("parsed_preferences", {}) if llm_result else {},
        rules,
    )
    try:
        validated = CustomPreferences.model_validate(parsed)
    except ValidationError:
        validated = CustomPreferences.model_validate(rules)
    raw_warnings = llm_result.get("warnings", []) if llm_result else []
    raw_questions = llm_result.get("clarification_questions", []) if llm_result else []
    warnings = list(raw_warnings) if isinstance(raw_warnings, list) else []
    questions = list(raw_questions) if isinstance(raw_questions, list) else []
    warnings.extend(_security_warnings(clean_text))
    warnings.extend(_conflict_warnings(clean_text, current_preferences or {}))
    questions.extend(_rule_clarifications(clean_text, validated))
    return {
        "parsed_preferences": validated.model_dump(mode="json"),
        "summary_items": _summary_items(validated),
        "clarification_questions": _unique_strings(questions)[:5],
        "warnings": _unique_strings(warnings)[:5],
    }


def _parse_with_rules(text: str) -> dict[str, object]:
    result: dict[str, object] = {}
    dietary = {"likes": [], "avoid": [], "allergies": []}
    if re.search(r"(?:不吃|不能吃|避免|不喜欢吃).{0,3}(?:辣|辣椒)", text):
        dietary["avoid"].append("spicy")
    if re.search(r"(?:喜欢|爱吃).{0,3}(?:当地|本地)?(?:小吃|美食)", text):
        dietary["likes"].append("local_food")
    allergy = re.search(r"对([^，。；;]{1,20})过敏", text)
    if allergy:
        dietary["allergies"].append(allergy.group(1).strip())
    if any(dietary.values()):
        result["dietary"] = dietary

    budget = re.search(r"(?:每天|每日|一天|日预算).{0,8}?(\d{2,7})(?:元|块)", text)
    if budget:
        result["budget"] = {"daily_amount": float(budget.group(1)), "currency": "CNY"}

    schedule: dict[str, object] = {}
    start = re.search(r"(?:上午)?\s*(\d{1,2})(?:点|时)(?:以后|之后|再开始|再出发)", text)
    if start and 0 <= int(start.group(1)) <= 23:
        schedule["earliest_start_time"] = f"{int(start.group(1)):02d}:00"
    end = re.search(r"(?:晚上)?\s*(\d{1,2})(?:点|时)(?:以前|之前|结束|回去)", text)
    if end and 0 <= int(end.group(1)) <= 23:
        hour = int(end.group(1))
        if "晚上" in end.group(0) and hour < 12:
            hour += 12
        schedule["latest_end_time"] = f"{hour:02d}:00"
    if re.search(r"(?:午休|午睡)", text):
        schedule["needs_nap"] = True
    if schedule:
        result["schedule"] = schedule

    preferred: list[str] = []
    avoid: list[str] = []
    if re.search(r"(?:优先|喜欢|尽量).*(?:地铁|公交|公共交通)", text):
        preferred.append("public_transit")
    if re.search(r"(?:优先|喜欢|尽量).*(?:打车|出租车)", text):
        preferred.append("taxi")
    if re.search(r"(?:自驾|开车)", text):
        preferred.append("driving")
    if re.search(r"(?:少走路|少步行|避免步行|不想走)", text):
        avoid.append("walking")
    if preferred or avoid:
        result["transport"] = {"preferred": preferred, "avoid": avoid}

    companions = {
        "children": bool(re.search(r"(?:带|有|和).*(?:孩子|儿童|小朋友)", text)),
        "elderly": bool(re.search(r"(?:带|有|和).*(?:老人|长辈|父母)", text)),
        "wheelchair_user": bool(re.search(r"(?:轮椅|无障碍)", text)),
        "pet": bool(re.search(r"(?:带|和).*(?:宠物|狗|猫)", text)),
    }
    if any(companions.values()):
        result["companions"] = companions

    must_visit = re.findall(r"(?:一定要去|必须去|必去)([^，。；;]{1,30})", text)
    avoid_places = re.findall(r"(?:不去|避开|不要去)([^，。；;]{1,30})", text)
    if must_visit:
        result["must_visit"] = [item.strip() for item in must_visit]
    if avoid_places:
        result["avoid_places"] = [item.strip() for item in avoid_places]
    return result


def _parse_with_llm(text: str, current_preferences: dict[str, object]) -> dict[str, object] | None:
    response = call_llm(
        [
            {"role": "system", "content": CUSTOM_PREFERENCE_PARSE_PROMPT},
            {
                "role": "user",
                "content": json.dumps(
                    {"preference_text": text, "current_preferences": current_preferences},
                    ensure_ascii=False,
                ),
            },
        ]
    )
    if not response:
        return None
    try:
        data = json.loads(response)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _merge_preferences(base: object, override: dict[str, object]) -> dict[str, object]:
    merged = dict(base) if isinstance(base, dict) else {}
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = {**merged[key], **value}
        else:
            merged[key] = value
    return merged


def _security_warnings(text: str) -> list[str]:
    if re.search(r"忽略.*(?:指令|规则)|系统提示|开发者模式|直接.*数据库|绕过.*确认", text, re.I):
        return ["检测到非旅行偏好指令；它只会作为普通文本保存，不会改变系统权限。"]
    return []


def _conflict_warnings(text: str, current: dict[str, object]) -> list[str]:
    warnings: list[str] = []
    if current.get("travel_pace") == "compact" and re.search(r"不要太赶|慢节奏|轻松", text):
        warnings.append("自定义偏好倾向慢节奏，与已选择的紧凑型旅行节奏冲突。")
    if "less_walking" in current.get("special_needs", []) and re.search(r"喜欢.*步行|多走路", text):
        warnings.append("自定义偏好与已选择的少步行需求冲突。")
    return warnings


def _rule_clarifications(text: str, parsed: CustomPreferences) -> list[str]:
    questions: list[str] = []
    if re.search(r"预算(?:不要太高|低一点|有限)", text) and parsed.budget.daily_amount is None:
        questions.append("你希望每天的人均预算控制在多少元左右？")
    if re.search(r"不喜欢早起|晚一点出发", text) and parsed.schedule.earliest_start_time is None:
        questions.append("你希望每天最早几点开始行程？")
    return questions


def _summary_items(parsed: CustomPreferences) -> list[str]:
    items: list[str] = []
    if parsed.schedule.earliest_start_time:
        items.append(f"每天最早 {parsed.schedule.earliest_start_time} 开始行程")
    if parsed.schedule.latest_end_time:
        items.append(f"每天最晚 {parsed.schedule.latest_end_time} 结束行程")
    if parsed.schedule.needs_nap:
        items.append("需要预留午休时间")
    if parsed.budget.daily_amount:
        items.append(f"每日预算约 {parsed.budget.daily_amount:g} {parsed.budget.currency}")
    if parsed.dietary.avoid:
        items.append("避免饮食：" + "、".join(parsed.dietary.avoid))
    if parsed.dietary.allergies:
        items.append("过敏原：" + "、".join(parsed.dietary.allergies))
    if parsed.transport.preferred:
        items.append("优先交通：" + "、".join(parsed.transport.preferred))
    if parsed.transport.avoid:
        items.append("避免交通：" + "、".join(parsed.transport.avoid))
    if parsed.companions.children:
        items.append("有儿童同行")
    if parsed.companions.elderly:
        items.append("有老人同行")
    if parsed.companions.wheelchair_user:
        items.append("需要轮椅/无障碍条件")
    if parsed.companions.pet:
        items.append("有宠物同行")
    if parsed.must_visit:
        items.append("必去：" + "、".join(parsed.must_visit))
    if parsed.avoid_places:
        items.append("避开：" + "、".join(parsed.avoid_places))
    return items


def _unique_strings(values: list[object]) -> list[str]:
    return list(
        dict.fromkeys(value.strip() for value in values if isinstance(value, str) and value.strip())
    )

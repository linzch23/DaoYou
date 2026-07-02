import json
import re

from pydantic import TypeAdapter, ValidationError

from app.agent.contracts import MemoryCandidate
from app.agent.llm import call_llm
from app.agent.prompts import MEMORY_EXTRACT_PROMPT

_CANDIDATES_ADAPTER = TypeAdapter(list[MemoryCandidate])


def extract_explicit_memory_candidates(message: str) -> list[MemoryCandidate]:
    """Extract only preferences the user explicitly states, not inferred one-off behavior."""
    text = message.strip()
    if not text:
        return []

    candidates: dict[tuple[str, str], MemoryCandidate] = {}

    def add(candidate: MemoryCandidate) -> None:
        candidates[(candidate.memory_type, candidate.memory_key)] = candidate

    if re.search(r"(?:我|本人).*(?:喜欢|感兴趣|偏爱).*(?:拍照|摄影|出片)", text):
        add(_interest("photo", True, "用户明确表示喜欢拍照或摄影"))
    if re.search(r"(?:我|本人).*(?:不喜欢|没兴趣|不感兴趣).*(?:拍照|摄影|出片)", text):
        add(_interest("photo", False, "用户明确表示不喜欢拍照或摄影"))
    if re.search(r"(?:我|本人).*(?:喜欢|感兴趣|偏爱).*(?:历史|古迹|博物馆|人文)", text):
        add(_interest("history", True, "用户明确表示喜欢历史人文内容"))
    if re.search(r"(?:我|本人).*(?:喜欢|感兴趣|偏爱).*(?:美食|吃|餐厅|小吃)", text):
        add(_interest("food", True, "用户明确表示喜欢美食体验"))
    if re.search(r"(?:我|本人).*(?:喜欢|感兴趣|偏爱).*(?:自然|山水|户外|公园)", text):
        add(_interest("nature", True, "用户明确表示喜欢自然或户外景观"))

    if re.search(r"(?:我|本人).*(?:喜欢|希望|习惯|偏爱).*(?:慢节奏|轻松|不要太赶)", text):
        add(_preference("travel_pace", "slow", "用户明确偏好轻松慢节奏旅行"))
    elif ("我" in text or "本人" in text) and re.search(
        r"(?:想|希望).*(?:轻松|慢节奏|不要太赶)", text
    ):
        add(_preference("travel_pace", "slow", "用户明确希望行程更轻松"))
    elif re.search(r"(?:我|本人).*(?:喜欢|希望|习惯|偏爱).*(?:紧凑|多安排|排满)", text):
        add(_preference("travel_pace", "compact", "用户明确偏好紧凑充实的行程"))

    if re.search(
        r"(?:我|本人).*(?:不想|不喜欢|不能|尽量少|希望少|想少).*(?:走.*路|步行)",
        text,
    ):
        add(_need("less_walking", True, "用户明确希望减少步行"))
    if re.search(r"(?:我|本人).*(?:不想|不喜欢|尽量少|希望少).*(?:排队|等候)", text):
        add(_need("less_queue", True, "用户明确希望减少排队等候"))
    if re.search(r"(?:我|本人).*(?:需要|使用|依赖).*(?:无障碍|轮椅)", text):
        add(_need("accessible", True, "用户明确需要无障碍条件"))

    if re.search(r"(?:以后|今后|给我|讲解).*(?:专业|详细|严谨)", text):
        add(_preference("explanation_style", "professional", "用户明确偏好专业讲解"))
    elif re.search(r"(?:以后|今后|给我|讲解).*(?:有趣|轻松|幽默)", text):
        add(_preference("explanation_style", "fun", "用户明确偏好轻松有趣的讲解"))
    elif re.search(r"(?:以后|今后|给我|讲解).*(?:儿童|孩子|小朋友)", text):
        add(_preference("explanation_style", "children", "用户明确偏好儿童友好讲解"))

    return list(candidates.values())


def extract_memory_candidates_with_llm(
    user_messages: list[str],
) -> list[MemoryCandidate]:
    """Summarize repeated signals; invalid or unavailable model output yields no candidates."""
    clean_messages = [message.strip() for message in user_messages if message.strip()][-30:]
    if len(clean_messages) < 3:
        return []
    text = call_llm(
        [
            {"role": "system", "content": MEMORY_EXTRACT_PROMPT},
            {
                "role": "user",
                "content": json.dumps({"user_messages": clean_messages}, ensure_ascii=False),
            },
        ]
    )
    if not text:
        return []
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, dict) or not isinstance(data.get("memories"), list):
        return []
    try:
        candidates = _CANDIDATES_ADAPTER.validate_python(data["memories"])
    except ValidationError:
        return []
    return [
        candidate
        for candidate in candidates[:10]
        if _is_allowed_candidate(candidate)
        and _has_repeated_evidence(candidate, clean_messages)
    ]


def _is_allowed_candidate(candidate: MemoryCandidate) -> bool:
    allowed = {
        "interest": {"photo", "history", "food", "nature", "family"},
        "preference": {"slow_pace", "compact_pace", "explanation_style"},
        "special_need": {"less_walking", "less_queue", "accessible"},
    }
    return candidate.memory_key in allowed.get(candidate.memory_type, set())


def _has_repeated_evidence(candidate: MemoryCandidate, messages: list[str]) -> bool:
    keywords = {
        "photo": ["拍照", "摄影", "出片", "机位", "照片"],
        "history": ["历史", "古迹", "博物馆", "人文"],
        "food": ["美食", "餐厅", "小吃", "吃"],
        "nature": ["自然", "山水", "户外", "公园"],
        "family": ["亲子", "孩子", "家庭"],
        "slow_pace": ["轻松", "慢节奏", "不要太赶", "休息", "少走"],
        "compact_pace": ["紧凑", "排满", "多安排"],
        "less_walking": ["少走", "步行", "走路"],
        "less_queue": ["少排队", "排队", "等候"],
        "accessible": ["无障碍", "轮椅"],
        "explanation_style": ["讲解", "专业", "有趣", "儿童版"],
    }.get(candidate.memory_key, [])
    return sum(any(keyword in message for keyword in keywords) for message in messages) >= 2


def _interest(key: str, value: bool, description: str) -> MemoryCandidate:
    return MemoryCandidate(
        memory_type="interest",
        memory_key=key,
        value=value,
        description=description,
        confidence=0.95,
    )


def _preference(key: str, value: str | bool, description: str) -> MemoryCandidate:
    if key == "travel_pace":
        key = "slow_pace" if value == "slow" else "compact_pace"
        value = True
    return MemoryCandidate(
        memory_type="preference",
        memory_key=key,
        value=value,
        description=description,
        confidence=0.95,
    )


def _need(key: str, value: bool, description: str) -> MemoryCandidate:
    return MemoryCandidate(
        memory_type="special_need",
        memory_key=key,
        value=value,
        description=description,
        confidence=0.98,
    )

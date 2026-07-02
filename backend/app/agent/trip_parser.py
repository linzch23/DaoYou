import json
import re
from datetime import date

from pydantic import ValidationError

from app.agent.llm import call_llm
from app.agent.prompts import TRIP_PARSE_PROMPT
from app.schemas.trips import ParsedTripDraft


def parse_trip_text(text: str, current_date: date, timezone: str) -> dict[str, object]:
    clean_text = text.strip()
    rule_result = _parse_dates_with_rules(clean_text, current_date)
    llm_result = _parse_with_llm(clean_text, current_date, timezone)
    merged = dict(llm_result or {})
    for key, value in rule_result.items():
        if value is not None:
            merged[key] = value
    try:
        parsed = ParsedTripDraft.model_validate(merged)
    except ValidationError:
        parsed = ParsedTripDraft.model_validate(rule_result)
    result = parsed.model_dump(mode="json")
    result["missing_required_fields"] = [
        field for field in ("title", "start_date", "end_date") if result.get(field) is None
    ]
    return result


def _parse_dates_with_rules(text: str, current_date: date) -> dict[str, object]:
    result: dict[str, object] = {}
    iso_dates = re.findall(r"(?<!\d)(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?", text)
    dates: list[date] = []
    for year, month, day in iso_dates:
        try:
            dates.append(date(int(year), int(month), int(day)))
        except ValueError:
            continue
    if not dates:
        short_dates = re.findall(r"(?<!\d)(\d{1,2})月(\d{1,2})日", text)
        for month, day in short_dates:
            try:
                candidate = date(current_date.year, int(month), int(day))
                if candidate < current_date:
                    candidate = date(current_date.year + 1, int(month), int(day))
                dates.append(candidate)
            except ValueError:
                continue
    if dates:
        result["start_date"] = min(dates).isoformat()
        if len(dates) > 1:
            result["end_date"] = max(dates).isoformat()
    return result


def _parse_with_llm(text: str, current_date: date, timezone: str) -> dict[str, object] | None:
    response = call_llm([
        {"role": "system", "content": TRIP_PARSE_PROMPT},
        {"role": "user", "content": json.dumps({
            "text": text,
            "current_date": current_date.isoformat(),
            "timezone": timezone,
        }, ensure_ascii=False)},
    ])
    if not response:
        return None
    try:
        value = json.loads(response)
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) else None

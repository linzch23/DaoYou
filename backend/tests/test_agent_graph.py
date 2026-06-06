from app.agent.graph import run_agent


def test_chat_agent_returns_reply() -> None:
    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "user_message": "下午想轻松一点，怎么安排？",
            "current_trip": {},
            "user_preferences": {"travel_pace": "slow"},
        }
    )

    assert result["intent"] == "chat"
    assert result["reply"]
    assert isinstance(result["follow_up_questions"], list)


def test_photo_agent_returns_explanation() -> None:
    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "image_info": {"image_path": "uploads/images/yurenmatou.jpg"},
        }
    )

    assert result["intent"] == "photo_explain"
    assert result["structured_data"]["recognition_result"]
    assert result["structured_data"]["explanation"]
    assert result["follow_up_questions"]


def test_reminder_agent_returns_risk_payload() -> None:
    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "intent_hint": "reminder",
            "current_time": "2026-07-01T09:20:00+08:00",
            "current_location": {"latitude": 38.92, "longitude": 121.64},
        }
    )

    assert result["intent"] == "reminder"
    assert result["structured_data"]["has_risk"] is True
    assert result["structured_data"]["reminder"]["type"] in {"departure", "conflict"}


def test_replan_agent_returns_draft_items() -> None:
    result = run_agent(
        {
            "user_id": 1,
            "trip_id": 1,
            "user_message": "我累了不想去下一个景点，帮我换一个轻松点的安排。",
            "current_location": {"latitude": 38.92, "longitude": 121.64},
        }
    )

    assert result["intent"] == "replan"
    assert result["structured_data"]["draft_id"] == "draft_001"
    assert result["structured_data"]["new_items"]

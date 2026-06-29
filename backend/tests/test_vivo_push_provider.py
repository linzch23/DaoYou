import json

import httpx
import pytest

from app.services.vivo_push_provider import (
    VivoPushError,
    VivoPushProvider,
    vivo_auth_sign,
)


def test_vivo_auth_sign_matches_official_example() -> None:
    assert (
        vivo_auth_sign(
            app_id=10004,
            app_key="25509283-3767-4b9e-83fe-b6e55ac6243e",
            timestamp_ms=1501484120000,
            app_secret="7265f2a4-ebbb-44bf-88b9-b03e67dfdc21",
        )
        == "fe3b46a2befc60334c2388676a752bd6"
    )


def test_vivo_push_authenticates_then_sends_message() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path == "/message/auth":
            return httpx.Response(200, json={"result": 0, "authToken": "auth-001"})
        return httpx.Response(200, json={"result": 0, "taskId": "task-001"})

    provider = VivoPushProvider(
        app_id=10004,
        app_key="app-key",
        app_secret="app-secret",
        push_mode=1,
        transport=httpx.MockTransport(handler),
    )

    result = provider.send(
        reg_id="reg-1234567890",
        title="行程时间提醒",
        content="请准备出发。",
        payload={"trip_id": 1, "level": "warning"},
        request_id="request-001",
    )

    assert result.success is True
    assert result.provider_task_id == "task-001"
    assert [request.url.path for request in requests] == ["/message/auth", "/message/send"]
    send_body = json.loads(requests[1].content)
    assert send_body["regId"] == "reg-1234567890"
    assert send_body["requestId"] == "request-001"
    assert send_body["pushMode"] == 1
    assert send_body["clientCustomMap"] == {
        "trip_id": "1",
        "level": "warning",
    }


def test_vivo_push_reuses_cached_auth_token() -> None:
    auth_requests = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal auth_requests
        if request.url.path == "/message/auth":
            auth_requests += 1
            return httpx.Response(200, json={"result": 0, "authToken": "auth-001"})
        return httpx.Response(200, json={"result": 0, "taskId": "task-001"})

    provider = VivoPushProvider(
        app_id=10004,
        app_key="app-key",
        app_secret="app-secret",
        transport=httpx.MockTransport(handler),
    )

    for request_id in ("request-001", "request-002"):
        provider.send(
            reg_id="reg-1234567890",
            title="提醒",
            content="请出发。",
            payload={},
            request_id=request_id,
        )

    assert auth_requests == 1


def test_vivo_push_exposes_only_safe_error_code() -> None:
    provider = VivoPushProvider(
        app_id=10004,
        app_key="app-key",
        app_secret="app-secret",
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                json={"result": 10070, "desc": "secret provider detail"},
            )
        ),
    )

    with pytest.raises(VivoPushError) as error:
        provider.send(
            reg_id="reg-1234567890",
            title="提醒",
            content="请出发。",
            payload={},
            request_id="request-001",
        )

    assert error.value.code == "10070"
    assert "secret provider detail" not in str(error.value)

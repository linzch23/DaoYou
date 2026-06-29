import hashlib
import json
import time
from dataclasses import dataclass

import httpx

from app.core.config import settings


class VivoPushError(RuntimeError):
    def __init__(self, code: str, *, retryable: bool = False) -> None:
        self.code = code
        self.retryable = retryable
        super().__init__(f"vivo push failed ({code})")


@dataclass(frozen=True)
class PushSendResult:
    success: bool
    provider_task_id: str | None


def vivo_auth_sign(
    *,
    app_id: int,
    app_key: str,
    timestamp_ms: int,
    app_secret: str,
) -> str:
    raw = f"{app_id}{app_key}{timestamp_ms}{app_secret}".encode()
    return hashlib.md5(raw, usedforsecurity=False).hexdigest()


class VivoPushProvider:
    def __init__(
        self,
        *,
        app_id: int,
        app_key: str,
        app_secret: str,
        api_base: str | None = None,
        push_mode: int = 1,
        timeout_seconds: float = 10.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.app_id = app_id
        self.app_key = app_key
        self.app_secret = app_secret
        self.api_base = (api_base or settings.vivo_push_api_base).rstrip("/")
        self.push_mode = push_mode
        self.timeout_seconds = timeout_seconds
        self.transport = transport
        self._auth_token: str | None = None

    def send(
        self,
        *,
        reg_id: str,
        title: str,
        content: str,
        payload: dict[str, object],
        request_id: str,
    ) -> PushSendResult:
        auth_token = self._auth_token or self._authenticate()
        body = {
            "appId": self.app_id,
            "regId": reg_id,
            "notifyType": 3,
            "title": title,
            "content": content,
            "timeToLive": 86400,
            "skipType": 1,
            "networkType": -1,
            "clientCustomMap": _stringify_payload(payload),
            "requestId": request_id,
            "pushMode": self.push_mode,
            "classification": 1,
            "foregroundShow": True,
        }
        data = self._post(
            "/message/send",
            body,
            headers={"authToken": auth_token},
        )
        if data.get("result") != 0:
            raise VivoPushError(str(data.get("result") or "provider_error"))
        return PushSendResult(
            success=True,
            provider_task_id=(
                str(data["taskId"]) if data.get("taskId") is not None else None
            ),
        )

    def _authenticate(self) -> str:
        timestamp_ms = int(time.time() * 1000)
        data = self._post(
            "/message/auth",
            {
                "appId": self.app_id,
                "appKey": self.app_key,
                "timestamp": timestamp_ms,
                "sign": vivo_auth_sign(
                    app_id=self.app_id,
                    app_key=self.app_key,
                    timestamp_ms=timestamp_ms,
                    app_secret=self.app_secret,
                ),
            },
        )
        if data.get("result") != 0 or not data.get("authToken"):
            raise VivoPushError(str(data.get("result") or "auth_failed"))
        self._auth_token = str(data["authToken"])
        return self._auth_token

    def _post(
        self,
        path: str,
        body: dict[str, object],
        *,
        headers: dict[str, str] | None = None,
    ) -> dict[str, object]:
        try:
            with httpx.Client(
                transport=self.transport,
                timeout=self.timeout_seconds,
            ) as client:
                response = client.post(
                    f"{self.api_base}{path}",
                    headers={"content-type": "application/json", **(headers or {})},
                    content=json.dumps(
                        body,
                        ensure_ascii=False,
                        separators=(",", ":"),
                        sort_keys=True,
                    ).encode(),
                )
                response.raise_for_status()
                data = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise VivoPushError("network_error", retryable=True) from exc
        if not isinstance(data, dict):
            raise VivoPushError("invalid_response")
        return data


def _stringify_payload(payload: dict[str, object]) -> dict[str, str]:
    return {
        str(key): (
            value
            if isinstance(value, str)
            else json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        )
        for key, value in payload.items()
    }

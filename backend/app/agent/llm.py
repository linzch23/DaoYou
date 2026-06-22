import base64
import hashlib
import hmac
import time
import uuid
from urllib.parse import urlencode

import httpx

from app.core.config import settings


def _chat_completions_url() -> str:
    return f"{settings.llm_base_url.rstrip('/')}/chat/completions"


def _vivo_completions_url() -> str:
    return f"{settings.vivo_base_url.rstrip('/')}{settings.vivo_completions_uri}"


# 成员 C 维护：大模型统一入口。后续 chat、replan、photo 文案生成都优先走这里。
def call_llm(messages: list[dict[str, str]]) -> str | None:
    provider = settings.llm_provider.lower()
    if provider == "vivo":
        return _call_vivo_llm(messages)
    return _call_openai_compatible_llm(messages)


def _call_openai_compatible_llm(messages: list[dict[str, str]]) -> str | None:
    if not settings.llm_api_key:
        return None

    headers = {
        "Authorization": f"Bearer {settings.llm_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.llm_model,
        "messages": messages,
        "temperature": 0.6,
    }

    try:
        response = httpx.post(
            _chat_completions_url(),
            headers=headers,
            json=payload,
            timeout=settings.llm_timeout_seconds,
        )
        response.raise_for_status()
        data = response.json()
        content = data["choices"][0]["message"]["content"]
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        return None

    if not isinstance(content, str):
        return None
    return content.strip() or None


def _call_vivo_llm(messages: list[dict[str, str]]) -> str | None:
    if not settings.vivo_app_id or not settings.vivo_app_key:
        return None

    request_id = str(uuid.uuid4())
    query = {"requestId": request_id}
    prompt = _messages_to_prompt(messages)
    payload = {
        "prompt": prompt,
        "model": settings.vivo_model,
        "sessionId": request_id,
        "extra": {"temperature": 0.6},
    }
    headers = _build_vivo_auth_headers(
        method="POST",
        uri=settings.vivo_completions_uri,
        query=query,
        app_id=settings.vivo_app_id,
        app_key=settings.vivo_app_key,
    )
    headers["Content-Type"] = "application/json"

    try:
        response = httpx.post(
            _vivo_completions_url(),
            params=query,
            headers=headers,
            json=payload,
            timeout=settings.llm_timeout_seconds,
        )
        response.raise_for_status()
        data = response.json()
        content = data["data"]["content"]
    except (httpx.HTTPError, KeyError, TypeError, ValueError):
        return None

    if not isinstance(content, str):
        return None
    return content.strip() or None


def _messages_to_prompt(messages: list[dict[str, str]]) -> str:
    parts = []
    for message in messages:
        role = message.get("role", "user")
        content = message.get("content", "")
        parts.append(f"{role}: {content}")
    return "\n\n".join(parts)


# vivo 蓝心大模型使用网关签名鉴权；这里集中生成请求头，业务节点不关心鉴权细节。
def _build_vivo_auth_headers(
    method: str,
    uri: str,
    query: dict[str, str],
    app_id: str,
    app_key: str,
    timestamp: str | None = None,
    nonce: str | None = None,
) -> dict[str, str]:
    timestamp = timestamp or str(int(time.time()))
    nonce = nonce or uuid.uuid4().hex[:8]
    canonical_query = urlencode(sorted(query.items()))
    signing_string = "\n".join(
        [
            method.upper(),
            uri,
            canonical_query,
            app_id,
            timestamp,
            nonce,
        ]
    )
    digest = hmac.new(
        app_key.encode("utf-8"),
        signing_string.encode("utf-8"),
        hashlib.sha256,
    ).digest()
    signature = base64.b64encode(digest).decode("utf-8")
    return {
        "X-AI-GATEWAY-APP-ID": app_id,
        "X-AI-GATEWAY-TIMESTAMP": timestamp,
        "X-AI-GATEWAY-NONCE": nonce,
        "X-AI-GATEWAY-SIGNED-HEADERS": (
            "x-ai-gateway-app-id;x-ai-gateway-timestamp;x-ai-gateway-nonce"
        ),
        "X-AI-GATEWAY-SIGNATURE": signature,
    }

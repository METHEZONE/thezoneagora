from typing import Any

import httpx

from app.models import Signal


class ExecutorError(RuntimeError):
    pass


def _executor_payload(signal: Signal) -> dict[str, Any]:
    return {
        "signalId": signal.signal_id,
        "agentId": str(signal.agent_id),
        "side": signal.action,
        "symbol": signal.symbol,
        "price": float(signal.price),
        "timestampMs": int(signal.generated_at.timestamp() * 1000),
    }


async def execute_signal(
    signal: Signal,
    *,
    executor_url: str,
    timeout_seconds: float,
    transport: httpx.AsyncBaseTransport | None = None,
) -> str:
    try:
        async with httpx.AsyncClient(
            timeout=timeout_seconds,
            transport=transport,
        ) as client:
            response = await client.post(executor_url, json=_executor_payload(signal))
    except httpx.RequestError as exc:
        raise ExecutorError(f"Executor request failed: {exc}") from exc

    try:
        body = response.json()
    except ValueError as exc:
        raise ExecutorError("Executor returned invalid JSON") from exc
    if not isinstance(body, dict):
        raise ExecutorError("Executor returned invalid JSON object")

    if response.is_success and body.get("status") == "executed":
        digest = body.get("digest")
        if isinstance(digest, str) and digest:
            return digest
        raise ExecutorError("Executor response is missing digest")

    reason = body.get("reason")
    detail = reason if isinstance(reason, str) and reason else f"HTTP {response.status_code}"
    raise ExecutorError(f"Executor failed: {detail}")

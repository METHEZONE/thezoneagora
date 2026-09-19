import asyncio
from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace

import httpx
import pytest

from app.services.executor_client import ExecutorError, execute_signal


def signal():
    return SimpleNamespace(
        signal_id="mint-001",
        agent_id=7,
        action="BUY",
        symbol="DEEP/SUI",
        price=Decimal("0.0272"),
        generated_at=datetime(2026, 9, 19, 12, 0, tzinfo=UTC),
    )


def run_with(handler):
    return asyncio.run(
        execute_signal(
            signal(),
            executor_url="http://executor:8500/execute",
            timeout_seconds=1,
            transport=httpx.MockTransport(handler),
        )
    )


def test_executor_client_sends_canonical_signal_and_returns_digest():
    def handler(request: httpx.Request):
        assert request.url.path == "/execute"
        assert request.read()
        return httpx.Response(200, json={"status": "executed", "digest": "tx-123"})

    assert run_with(handler) == "tx-123"


def test_executor_client_surfaces_node_failure_reason():
    def handler(_request: httpx.Request):
        return httpx.Response(422, json={"status": "failed", "reason": "pair mismatch"})

    with pytest.raises(ExecutorError, match="pair mismatch"):
        run_with(handler)


def test_executor_client_rejects_malformed_success_response():
    def handler(_request: httpx.Request):
        return httpx.Response(200, content=b"not-json")

    with pytest.raises(ExecutorError, match="invalid JSON"):
        run_with(handler)


def test_executor_client_converts_transport_error():
    def handler(request: httpx.Request):
        raise httpx.ConnectError("connection refused", request=request)

    with pytest.raises(ExecutorError, match="request failed"):
        run_with(handler)


def test_executor_client_converts_timeout():
    def handler(request: httpx.Request):
        raise httpx.ReadTimeout("timed out", request=request)

    with pytest.raises(ExecutorError, match="request failed"):
        run_with(handler)

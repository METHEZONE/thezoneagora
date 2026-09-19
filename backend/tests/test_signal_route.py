import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError

from app.models import ExecutionAttempt
from app.routes.signals import create_signal
from app.services.executor_client import ExecutorError


def payload(**overrides):
    base = {
        "signal_id": "mint-route-001",
        "side": "SELL",
        "symbol": "DEEP/SUI",
        "price": 0.03,
        "timestamp_ms": int(datetime.now(UTC).timestamp() * 1000),
    }
    return base | overrides


class FakeSession:
    def __init__(self, agent, *, fail_first_commit=False):
        self.agent = agent
        self.added = []
        self.commits = 0
        self.fail_first_commit = fail_first_commit

    async def scalar(self, _statement):
        return self.agent

    def add(self, value):
        self.added.append(value)

    async def commit(self):
        self.commits += 1
        if self.fail_first_commit and self.commits == 1:
            raise IntegrityError("duplicate", {}, Exception("duplicate"))

    async def rollback(self):
        pass

    async def refresh(self, signal):
        now = datetime.now(UTC)
        if isinstance(signal, ExecutionAttempt):
            signal.id = 2
            signal.created_at = now
            signal.updated_at = now
        else:
            signal.id = 1
            signal.received_at = now


def agent(**overrides):
    values = {
        "id": 7,
        "status": "ACTIVE",
        "adapter_key": "mint",
        "timeframe": "5m",
    }
    return SimpleNamespace(**(values | overrides))


def test_create_signal_authenticates_normalizes_executes_and_stores(monkeypatch):
    session = FakeSession(agent())

    async def successful_executor(*_args, **_kwargs):
        return "tx-digest"

    monkeypatch.setattr("app.routes.signals.execute_signal", successful_executor)

    result = asyncio.run(create_signal(payload(), session, "agent-key"))

    assert session.commits == 3
    assert result["signal"].agent_id == 7
    assert result["signal"].action == "SELL"
    assert result["execution"].status == "SUCCESS"
    assert result["execution"].tx_digest == "tx-digest"


def test_create_signal_records_executor_failure(monkeypatch):
    session = FakeSession(agent())

    async def failed_executor(*_args, **_kwargs):
        raise ExecutorError("executor unavailable")

    monkeypatch.setattr("app.routes.signals.execute_signal", failed_executor)

    result = asyncio.run(create_signal(payload(), session, "agent-key"))

    assert result["execution"].status == "FAILED"
    assert result["execution"].error_message == "executor unavailable"


def test_create_signal_rejects_unknown_agent_key():
    session = FakeSession(None)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(create_signal(payload(), session, "wrong-key"))

    assert exc.value.status_code == 401
    assert session.added == []


def test_create_signal_rejects_inactive_agent():
    session = FakeSession(agent(status="PAUSED"))

    with pytest.raises(HTTPException) as exc:
        asyncio.run(create_signal(payload(), session, "agent-key"))

    assert exc.value.status_code == 409
    assert session.added == []


def test_duplicate_signal_does_not_call_executor(monkeypatch):
    session = FakeSession(agent(), fail_first_commit=True)

    async def must_not_execute(*_args, **_kwargs):
        raise AssertionError("executor must not be called for a duplicate signal")

    monkeypatch.setattr("app.routes.signals.execute_signal", must_not_execute)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(create_signal(payload(), session, "agent-key"))

    assert exc.value.status_code == 409

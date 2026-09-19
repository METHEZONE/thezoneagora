import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from app.services.agent_backtest_client import AgentBacktestError
from app.services.backtest_service import BacktestProcessor


START = datetime(2025, 1, 1, tzinfo=timezone.utc)


def candle(at: datetime, price: str) -> dict:
    return {"open_time": at.isoformat(), "open": price, "high": price, "low": price, "close": price, "volume": "1"}


class FakeRepository:
    def __init__(self, job):
        self.job, self.completed, self.failed = job, None, None
    async def claim_job(self, job_id, stale_seconds): return True
    async def get_job(self, job_id): return self.job
    async def complete_job(self, job_id, values): self.completed = values
    async def fail_job(self, job_id, message): self.failed = message
    async def get_or_create_signal_set(self, **kwargs): return SimpleNamespace(id=uuid4())
    async def attach_signal_set(self, job_id, signal_set_id): self.job.signal_set_id = signal_set_id


class MustNotCallAgent:
    async def get_signals(self, **kwargs): raise AssertionError("saved signals must be reused")


class FailingAgent:
    async def get_signals(self, **kwargs): raise AgentBacktestError("agent returned 500")


def make_job(signal_set):
    return SimpleNamespace(
        id=uuid4(), agent_id=1,
        agent=SimpleNamespace(strategy_version="v1", endpoint_url="http://agent"),
        symbol="BTC-USDT", timeframe="5m", ohlcv_hash="abc",
        candles=[candle(START, "10"), candle(START + timedelta(minutes=5), "11")],
        initial_cash=Decimal("1000"), order_size_quote=Decimal("100"),
        fee_bps=Decimal("0"), slippage_bps=Decimal("0"), signal_set=signal_set,
        signal_set_id=None if signal_set is None else signal_set.id,
    )


def test_processor_reuses_stored_signals_without_calling_agent():
    signal_set = SimpleNamespace(
        id=uuid4(), agent_id=1, strategy_version="v1", symbol="BTC-USDT",
        timeframe="5m", ohlcv_hash="abc",
        signals=[{"open_time": START.isoformat(), "action": "BUY"}],
    )
    repository = FakeRepository(make_job(signal_set))
    asyncio.run(BacktestProcessor(repository, MustNotCallAgent(), 120).process(repository.job.id))
    assert repository.failed is None
    assert repository.completed["trade_count"] == 1
    assert repository.completed["total_costs"] == repository.completed["total_fees"] + repository.completed["total_slippage"]


def test_agent_error_marks_job_failed():
    repository = FakeRepository(make_job(None))
    asyncio.run(BacktestProcessor(repository, FailingAgent(), 120).process(repository.job.id))
    assert repository.completed is None
    assert "AgentBacktestError" in repository.failed

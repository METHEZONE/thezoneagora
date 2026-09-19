import asyncio
import os
from datetime import datetime, timedelta, timezone

import httpx
from redis.asyncio import Redis

API_URL = os.environ["API_URL"]
MOCK_AGENT_URL = os.environ["MOCK_AGENT_URL"]
REDIS_URL = os.environ["REDIS_URL"]


async def wait_for_terminal(client: httpx.AsyncClient, job_id: str) -> dict:
    for _ in range(100):
        response = await client.get(f"{API_URL}/backtests/{job_id}")
        response.raise_for_status()
        job = response.json()
        if job["status"] in {"COMPLETED", "FAILED"}:
            return job
        await asyncio.sleep(0.1)
    raise AssertionError(f"job {job_id} did not finish")


def agent_payload(name: str, endpoint: str) -> dict:
    return {
        "name": name, "endpoint_url": endpoint, "public_key": "integration-key",
        "agent_key": f"{name}-signal-key", "adapter_key": "mint",
        "strategy_version": "v1", "timeframe": "5m", "max_position_bps": 5000,
        "max_order_bps": 5000, "max_daily_loss_bps": 1000,
        "allowed_symbols": ["BTC-USDT"],
    }


def backtest_payload(agent_id: int) -> dict:
    start = datetime(2025, 1, 1, tzinfo=timezone.utc)
    candles = []
    for index, price in enumerate(["100", "110", "120", "115"]):
        candles.append({
            "open_time": (start + timedelta(minutes=5 * index)).isoformat(),
            "open": price, "high": price, "low": price, "close": price, "volume": "1",
        })
    return {
        "agent_id": agent_id, "symbol": "BTC-USDT", "timeframe": "5m",
        "candles": candles, "initial_cash": "1000", "order_size_quote": "500",
        "fee_bps": "10", "slippage_bps": "5",
    }


async def main() -> None:
    redis = Redis.from_url(REDIS_URL, decode_responses=True)
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(f"{API_URL}/agents", json=agent_payload("integration-agent", MOCK_AGENT_URL))
        response.raise_for_status()
        created = await client.post(f"{API_URL}/backtests", json=backtest_payload(response.json()["id"]))
        assert created.status_code == 202, created.text
        job_id = created.json()["id"]
        entries = await redis.xrevrange("backtest_jobs", count=1)
        assert entries[0][1] == {"job_id": job_id}
        completed = await wait_for_terminal(client, job_id)
        assert completed["status"] == "COMPLETED" and completed["result"]["trade_count"] == 2
        signal_set_id = completed["signal_set_id"]
        assert (await client.get(f"{MOCK_AGENT_URL}/calls")).json()["count"] == 1

        rerun_response = await client.post(f"{API_URL}/backtests/{job_id}/rerun", json={"fee_bps": "20", "slippage_bps": "10"})
        rerun = await wait_for_terminal(client, rerun_response.json()["id"])
        assert rerun["status"] == "COMPLETED" and rerun["signal_set_id"] == signal_set_id
        assert (await client.get(f"{MOCK_AGENT_URL}/calls")).json()["count"] == 1

        await redis.xadd("backtest_jobs", {"job_id": job_id})
        await asyncio.sleep(0.5)
        assert (await client.get(f"{API_URL}/backtests/{job_id}")).json()["status"] == "COMPLETED"
        assert (await client.get(f"{MOCK_AGENT_URL}/calls")).json()["count"] == 1

        failed_agent = await client.post(f"{API_URL}/agents", json=agent_payload("failing-agent", f"{MOCK_AGENT_URL}/fail"))
        failed_create = await client.post(f"{API_URL}/backtests", json=backtest_payload(failed_agent.json()["id"]))
        failed = await wait_for_terminal(client, failed_create.json()["id"])
        assert failed["status"] == "FAILED" and "AgentBacktestError" in failed["error_message"]
    await redis.aclose()
    print("integration test passed")


if __name__ == "__main__":
    asyncio.run(main())

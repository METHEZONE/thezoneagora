from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest

from app.adapters import get_adapter
from app.adapters.mint import normalize_mint_signal


NOW = datetime(2026, 9, 19, 12, 0, tzinfo=UTC)


def payload(**overrides):
    base = {
        "signal_id": "mint-001",
        "side": "buy",
        "symbol": " deep/sui ",
        "price": 0.0272,
        "timestamp_ms": int(NOW.timestamp() * 1000),
    }
    return base | overrides


def normalize(body):
    return normalize_mint_signal(
        body,
        timeframe="5m",
        signal_ttl_ms=300_000,
        now=NOW,
    )


def test_mint_adapter_normalizes_payload_for_database():
    result = normalize(payload())

    assert result["signal_id"] == "mint-001"
    assert result["action"] == "BUY"
    assert result["symbol"] == "DEEP/SUI"
    assert result["timeframe"] == "5m"
    assert result["price"] == Decimal("0.0272")
    assert result["generated_at"] == NOW
    assert result["raw_payload"]["side"] == "buy"


@pytest.mark.parametrize("symbol", ["SUI/USDC", "DEEP/USDC", ""])
def test_mint_adapter_only_accepts_deep_sui(symbol):
    with pytest.raises(ValueError, match="DEEP/SUI"):
        normalize(payload(symbol=symbol))


@pytest.mark.parametrize("side", ["HOLD", "CLOSE", ""])
def test_mint_adapter_only_accepts_buy_and_sell(side):
    with pytest.raises(ValueError, match="BUY"):
        normalize(payload(side=side))


def test_mint_adapter_enforces_signal_id_byte_limit():
    normalize(payload(signal_id="a" * 64))

    with pytest.raises(ValueError, match="64 UTF-8 bytes"):
        normalize(payload(signal_id="한" * 22))


def test_mint_adapter_rejects_expired_signal():
    old = NOW - timedelta(milliseconds=300_001)

    with pytest.raises(ValueError, match="older"):
        normalize(payload(timestamp_ms=int(old.timestamp() * 1000)))


def test_adapter_registry_rejects_unknown_adapter():
    assert get_adapter("mint") is normalize_mint_signal
    with pytest.raises(ValueError, match="Unsupported adapter_key"):
        get_adapter("unknown")

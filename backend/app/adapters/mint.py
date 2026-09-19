from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any


MVP_SYMBOL = "DEEP/SUI"


def normalize_mint_signal(
    body: dict[str, Any],
    *,
    timeframe: str,
    signal_ttl_ms: int,
    now: datetime | None = None,
) -> dict[str, Any]:
    if not isinstance(body, dict):
        raise ValueError("body must be a JSON object")

    signal_id = body.get("signal_id")
    if not isinstance(signal_id, str) or not signal_id.strip():
        raise ValueError("signal_id is required")
    signal_id = signal_id.strip()
    if len(signal_id.encode("utf-8")) > 64:
        raise ValueError("signal_id must be at most 64 UTF-8 bytes")

    side = body.get("side")
    action = side.strip().upper() if isinstance(side, str) else ""
    if action not in {"BUY", "SELL"}:
        raise ValueError('side must be "BUY" or "SELL"')

    raw_symbol = body.get("symbol")
    symbol = raw_symbol.strip().upper() if isinstance(raw_symbol, str) else ""
    if symbol != MVP_SYMBOL:
        raise ValueError(f"symbol must be {MVP_SYMBOL}")

    try:
        price = Decimal(str(body.get("price")))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError("price must be a positive finite number") from exc
    if not price.is_finite() or price <= 0:
        raise ValueError("price must be a positive finite number")

    timestamp_ms = body.get("timestamp_ms")
    if isinstance(timestamp_ms, bool) or not isinstance(timestamp_ms, int) or timestamp_ms <= 0:
        raise ValueError("timestamp_ms must be a positive integer")

    current_time = now or datetime.now(UTC)
    now_ms = int(current_time.timestamp() * 1000)
    if now_ms - timestamp_ms > signal_ttl_ms:
        raise ValueError(f"signal is older than {signal_ttl_ms}ms")

    return {
        "signal_id": signal_id,
        "symbol": symbol,
        "timeframe": timeframe,
        "action": action,
        "generated_at": datetime.fromtimestamp(timestamp_ms / 1000, tz=UTC),
        "price": price,
        "raw_payload": dict(body),
    }

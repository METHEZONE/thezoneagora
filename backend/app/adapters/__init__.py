from collections.abc import Callable
from typing import Any

from app.adapters.mint import normalize_mint_signal


SignalAdapter = Callable[..., dict[str, Any]]

ADAPTERS: dict[str, SignalAdapter] = {
    "mint": normalize_mint_signal,
}


def get_adapter(adapter_key: str) -> SignalAdapter:
    try:
        return ADAPTERS[adapter_key]
    except KeyError as exc:
        raise ValueError(f"Unsupported adapter_key: {adapter_key}") from exc

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.backtest.metrics import max_drawdown
from app.backtest.simulator import Candle, Signal, simulate


START = datetime(2025, 1, 1, tzinfo=timezone.utc)


def candles(prices: list[str]) -> list[Candle]:
    return [
        Candle(
            open_time=START + timedelta(minutes=index),
            open=Decimal(price), high=Decimal(price), low=Decimal(price),
            close=Decimal(price), volume=Decimal("1"),
        )
        for index, price in enumerate(prices)
    ]


def run(prices: list[str], signals: list[Signal], **overrides):
    return simulate(
        candles=candles(prices), signals=signals,
        initial_cash=overrides.get("initial_cash", Decimal("1000")),
        order_size_quote=overrides.get("order_size_quote", Decimal("500")),
        fee_bps=overrides.get("fee_bps", Decimal("0")),
        slippage_bps=overrides.get("slippage_bps", Decimal("0")),
    )


def test_signals_execute_at_next_candle_open_and_final_signal_is_ignored():
    result = run(["10", "12", "15"], [
        Signal(START, "BUY"), Signal(START + timedelta(minutes=2), "SELL")
    ])
    assert result.trade_count == 1
    assert result.trades[0].price == Decimal("12")
    assert result.final_base_quantity == Decimal("500") / Decimal("12")


def test_buy_sell_average_cost_and_cash_limited_buy_policy():
    result = run(["10", "10", "20"], [
        Signal(START, "BUY"), Signal(START + timedelta(minutes=1), "SELL")
    ], initial_cash=Decimal("100"), order_size_quote=Decimal("500"), fee_bps=Decimal("100"))
    buy, sell = result.trades
    assert result.trade_count == 2
    assert buy.gross_amount == Decimal("100") / Decimal("1.01")
    assert buy.gross_amount + buy.fee == Decimal("100")
    assert result.final_base_quantity == 0
    assert result.average_entry_price == 0
    assert sell.quantity == buy.quantity


def test_fees_and_slippage_are_charged_and_reported():
    result = run(["100", "100", "100"], [
        Signal(START, "BUY"), Signal(START + timedelta(minutes=1), "SELL")
    ], fee_bps=Decimal("10"), slippage_bps=Decimal("100"))
    assert result.trades[0].price == Decimal("101")
    assert result.trades[1].price == Decimal("99")
    assert result.total_fees == sum(trade.fee for trade in result.trades)
    assert result.total_slippage == sum(trade.slippage_cost for trade in result.trades)


def test_mdd_uses_peak_to_trough_equity_ratio():
    assert max_drawdown([Decimal("100"), Decimal("120"), Decimal("90"), Decimal("110")]) == Decimal("0.25")


def test_duplicate_buy_and_sell_without_position_are_ignored():
    result = run(["10", "10", "10", "10", "10"], [
        Signal(START, "SELL"), Signal(START + timedelta(minutes=1), "BUY"),
        Signal(START + timedelta(minutes=2), "BUY"), Signal(START + timedelta(minutes=3), "SELL"),
    ])
    assert [trade.action for trade in result.trades] == ["BUY", "SELL"]
    assert result.trade_count == 2

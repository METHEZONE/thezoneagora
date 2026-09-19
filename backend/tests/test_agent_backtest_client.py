from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError

from app.schemas import AgentBacktestResponse, OhlcvCandle
from app.services.agent_backtest_client import AgentBacktestError, validate_agent_response


START = datetime(2025, 1, 1, tzinfo=timezone.utc)


def input_candles():
    return [OhlcvCandle(open_time=START, open="1", high="1", low="1", close="1", volume="1")]


def test_agent_action_schema_rejects_unknown_action():
    with pytest.raises(ValidationError):
        AgentBacktestResponse.model_validate({"signals": [{"open_time": START.isoformat(), "action": "HOLD"}]})


def test_agent_signal_time_must_exist_and_be_unique():
    unknown = AgentBacktestResponse.model_validate({"signals": [{
        "open_time": (START + timedelta(minutes=5)).isoformat(), "action": "BUY"
    }]})
    with pytest.raises(AgentBacktestError, match="not present"):
        validate_agent_response(unknown, input_candles())
    duplicate = AgentBacktestResponse.model_validate({"signals": [
        {"open_time": START.isoformat(), "action": "BUY"},
        {"open_time": START.isoformat(), "action": "SELL"},
    ]})
    with pytest.raises(AgentBacktestError, match="duplicate"):
        validate_agent_response(duplicate, input_candles())

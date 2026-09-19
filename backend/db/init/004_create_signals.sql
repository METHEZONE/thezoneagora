CREATE TABLE signals (
    id BIGSERIAL PRIMARY KEY,
    agent_id BIGINT NOT NULL REFERENCES agents(id) ON DELETE RESTRICT,
    signal_id VARCHAR(64) NOT NULL,
    symbol VARCHAR(50) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,
    action VARCHAR(10) NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    price NUMERIC(38, 18) NOT NULL,
    raw_payload JSONB NOT NULL DEFAULT '{}'::JSONB,

    CONSTRAINT signals_action_check CHECK (action IN ('BUY', 'SELL')),
    CONSTRAINT signals_price_check CHECK (price > 0),
    CONSTRAINT signals_agent_signal_unique UNIQUE (agent_id, signal_id)
);

CREATE INDEX signals_agent_generated_at_idx ON signals (agent_id, generated_at);
CREATE INDEX signals_symbol_generated_at_idx ON signals (symbol, generated_at);

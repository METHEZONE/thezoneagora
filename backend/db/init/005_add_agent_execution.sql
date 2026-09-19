ALTER TABLE agents
    ADD COLUMN agent_key VARCHAR(255),
    ADD COLUMN adapter_key VARCHAR(50);

UPDATE agents SET adapter_key = 'mint' WHERE adapter_key IS NULL;
UPDATE agents SET agent_key = 'agent-' || id::TEXT WHERE agent_key IS NULL;

ALTER TABLE agents
    ALTER COLUMN agent_key SET NOT NULL,
    ALTER COLUMN adapter_key SET NOT NULL,
    ADD CONSTRAINT agents_agent_key_unique UNIQUE (agent_key);

CREATE TABLE execution_attempts (
    id BIGSERIAL PRIMARY KEY,
    signal_id BIGINT NOT NULL REFERENCES signals(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    tx_digest VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT execution_attempts_status_check
        CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
    CONSTRAINT execution_attempts_signal_unique UNIQUE (signal_id)
);

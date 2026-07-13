CREATE TABLE order_intelligence_snapshots (
    order_id UUID PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    confirmation_confidence_score INT NOT NULL,
    fraud_risk_score INT NOT NULL,
    level VARCHAR(50) NOT NULL,
    summary VARCHAR(255) NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_order_intelligence_snapshots_tenant_level
    ON order_intelligence_snapshots (tenant_id, level);

CREATE TABLE order_intelligence_signals (
    signal_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    signal_key VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    detail VARCHAR(500),
    confidence_delta INT NOT NULL,
    risk_delta INT NOT NULL,
    severity VARCHAR(50) NOT NULL,
    source VARCHAR(50) NOT NULL,
    sort_rank INT NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_order_intelligence_signals_order_rank
    ON order_intelligence_signals (tenant_id, order_id, sort_rank);

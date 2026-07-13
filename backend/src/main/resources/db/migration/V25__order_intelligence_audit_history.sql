CREATE TABLE order_intelligence_audit_events (
    event_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sequence_number BIGINT NOT NULL,
    previous_confirmation_confidence_score INT,
    previous_fraud_risk_score INT,
    previous_level VARCHAR(50),
    confirmation_confidence_score INT NOT NULL,
    fraud_risk_score INT NOT NULL,
    level VARCHAR(50) NOT NULL,
    confidence_delta INT NOT NULL,
    risk_delta INT NOT NULL,
    change_label VARCHAR(255) NOT NULL,
    summary VARCHAR(255) NOT NULL,
    reason_key VARCHAR(100),
    reason_label VARCHAR(255),
    reason_detail VARCHAR(500),
    reason_severity VARCHAR(50),
    reason_source VARCHAR(50),
    calibration_version VARCHAR(30) NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_order_intelligence_audit_events_order
    ON order_intelligence_audit_events (tenant_id, order_id, sequence_number DESC, calculated_at DESC);

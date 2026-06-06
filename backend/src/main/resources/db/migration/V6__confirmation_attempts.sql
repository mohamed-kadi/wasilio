CREATE TABLE confirmation_attempts (
    attempt_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    order_id UUID NOT NULL,
    attempt_number INT NOT NULL,
    outcome VARCHAR(50) NOT NULL,
    note VARCHAR(1000),
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_confirmation_attempt_order_number
        UNIQUE (tenant_id, order_id, attempt_number)
);

CREATE INDEX idx_confirmation_attempts_tenant_order
    ON confirmation_attempts (tenant_id, order_id, attempt_number);

CREATE INDEX idx_confirmation_attempts_tenant_created_at
    ON confirmation_attempts (tenant_id, created_at);

CREATE TABLE delivery_failure_recoveries (
    recovery_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    decision VARCHAR(100) NOT NULL,
    note VARCHAR(1000),
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_delivery_failure_recoveries_tenant_order_created_at
    ON delivery_failure_recoveries (tenant_id, order_id, created_at);

CREATE INDEX idx_delivery_failure_recoveries_tenant_created_at
    ON delivery_failure_recoveries (tenant_id, created_at);

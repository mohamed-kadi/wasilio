CREATE TABLE delivery_failures (
    failure_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    courier_id UUID NOT NULL REFERENCES couriers(courier_id),
    reason VARCHAR(100) NOT NULL,
    note VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_delivery_failures_tenant_created_at
    ON delivery_failures (tenant_id, created_at);

CREATE INDEX idx_delivery_failures_tenant_order
    ON delivery_failures (tenant_id, order_id);

CREATE INDEX idx_delivery_failures_tenant_courier
    ON delivery_failures (tenant_id, courier_id);

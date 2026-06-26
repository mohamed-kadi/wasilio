CREATE TABLE inbound_orders (
    inbound_order_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    source VARCHAR(50) NOT NULL,
    external_order_id VARCHAR(255),
    idempotency_key VARCHAR(255) NOT NULL,
    raw_payload TEXT NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL,
    rejection_reason TEXT,
    normalized_order_id UUID,
    normalized_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX ux_inbound_orders_tenant_source_idempotency
    ON inbound_orders (tenant_id, source, idempotency_key);

CREATE UNIQUE INDEX ux_inbound_orders_tenant_source_external_order
    ON inbound_orders (tenant_id, source, external_order_id)
    WHERE external_order_id IS NOT NULL;

CREATE INDEX idx_inbound_orders_tenant_status_received
    ON inbound_orders (tenant_id, status, received_at DESC);

CREATE INDEX idx_inbound_orders_tenant_normalized_order
    ON inbound_orders (tenant_id, normalized_order_id)
    WHERE normalized_order_id IS NOT NULL;

ALTER TABLE orders ADD COLUMN source VARCHAR(50);
ALTER TABLE orders ADD COLUMN inbound_order_id UUID;
ALTER TABLE orders ADD COLUMN external_order_id VARCHAR(255);

CREATE INDEX idx_orders_tenant_source_created
    ON orders (tenant_id, source, created_at DESC);

CREATE INDEX idx_orders_tenant_inbound_order
    ON orders (tenant_id, inbound_order_id)
    WHERE inbound_order_id IS NOT NULL;

ALTER TABLE domain_events
    RENAME COLUMN timestamp TO created_at;

CREATE INDEX idx_orders_tenant_id
    ON orders (tenant_id);

CREATE INDEX idx_orders_tenant_status
    ON orders (tenant_id, status);

CREATE INDEX idx_orders_tenant_created_at
    ON orders (tenant_id, created_at);

CREATE INDEX idx_domain_events_tenant_aggregate_sequence
    ON domain_events (tenant_id, aggregate_id, aggregate_sequence);

CREATE INDEX idx_domain_events_tenant_created_at
    ON domain_events (tenant_id, created_at);

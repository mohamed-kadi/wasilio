CREATE TABLE order_search_saved_views (
    view_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    name VARCHAR(100) NOT NULL,
    filters_json TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_order_search_saved_views_tenant_name UNIQUE (tenant_id, name)
);

CREATE INDEX idx_order_search_saved_views_tenant_name
    ON order_search_saved_views (tenant_id, name);

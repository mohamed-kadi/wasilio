CREATE TABLE couriers (
    courier_id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_couriers_tenant_created_at
    ON couriers (tenant_id, created_at);

CREATE INDEX idx_couriers_tenant_active
    ON couriers (tenant_id, active);

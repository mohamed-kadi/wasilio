CREATE TABLE products (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(160) NOT NULL,
    description TEXT,
    price_amount DECIMAL(19, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    sku VARCHAR(100),
    image_url VARCHAR(1000),
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_products_tenant_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX idx_products_tenant_status_updated
    ON products (tenant_id, status, updated_at DESC);

CREATE INDEX idx_products_tenant_sku
    ON products (tenant_id, sku)
    WHERE sku IS NOT NULL;

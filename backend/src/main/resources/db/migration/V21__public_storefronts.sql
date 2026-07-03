CREATE TABLE public_storefronts (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    store_slug VARCHAR(160) NOT NULL,
    public_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    support_channel_type VARCHAR(50),
    support_channel_value VARCHAR(255),
    default_country_code VARCHAR(2) NOT NULL,
    default_currency VARCHAR(3) NOT NULL,
    phone_pattern VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_public_storefronts_store_slug UNIQUE (store_slug)
);

CREATE INDEX idx_public_storefronts_tenant_id
    ON public_storefronts (tenant_id);

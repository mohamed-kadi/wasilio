CREATE TABLE media_assets (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    purpose VARCHAR(50) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_path VARCHAR(1000) NOT NULL,
    public_url VARCHAR(1000) NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,
    uploaded_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_media_assets_tenant_product
    ON media_assets (tenant_id, product_id, created_at);

CREATE INDEX idx_media_assets_tenant_purpose
    ON media_assets (tenant_id, purpose, created_at);

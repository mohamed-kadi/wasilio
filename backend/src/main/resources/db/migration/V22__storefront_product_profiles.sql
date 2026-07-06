CREATE TABLE storefront_product_profiles (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    headline VARCHAR(255),
    subheadline VARCHAR(500),
    benefits TEXT NOT NULL DEFAULT '[]',
    features TEXT NOT NULL DEFAULT '[]',
    faq TEXT NOT NULL DEFAULT '[]',
    trust_badges TEXT NOT NULL DEFAULT '[]',
    gallery_image_urls TEXT NOT NULL DEFAULT '[]',
    seo_title VARCHAR(255),
    seo_description VARCHAR(500),
    seo_image_url VARCHAR(1000),
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_storefront_product_profiles_tenant_product UNIQUE (tenant_id, product_id)
);

CREATE INDEX idx_storefront_product_profiles_tenant_status
    ON storefront_product_profiles (tenant_id, status);

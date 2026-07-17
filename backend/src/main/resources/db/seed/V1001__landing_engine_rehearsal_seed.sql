-- Local-only landing-engine rehearsal data.
-- This file is loaded only when SPRING_FLYWAY_LOCATIONS includes classpath:db/seed.

INSERT INTO public_storefronts (
    id,
    tenant_id,
    store_slug,
    public_name,
    status,
    support_channel_type,
    support_channel_value,
    default_country_code,
    default_currency,
    phone_pattern,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    'first-store',
    'First Store',
    'ACTIVE',
    'whatsapp',
    '+212600000000',
    'MA',
    'MAD',
    '^(06|07)\d{8}$',
    NOW(),
    NOW()
) ON CONFLICT (store_slug) DO NOTHING;

INSERT INTO products (
    id,
    tenant_id,
    name,
    slug,
    description,
    price_amount,
    currency,
    sku,
    image_url,
    status,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000001',
    'First Store CoolAir Mini',
    'coolair-mini',
    'Compact rechargeable cooling fan for cash-on-delivery customers.',
    199.00,
    'MAD',
    'FIRST-COOLAIR-MINI',
    'http://localhost:8080/media/demo/first-store/coolair-mini-primary.svg',
    'ACTIVE',
    NOW(),
    NOW()
) ON CONFLICT (tenant_id, slug) DO NOTHING;

INSERT INTO storefront_product_profiles (
    id,
    tenant_id,
    product_id,
    headline,
    subheadline,
    benefits,
    features,
    faq,
    trust_badges,
    gallery_image_urls,
    seo_title,
    seo_description,
    seo_image_url,
    status,
    created_at,
    updated_at
)
SELECT
    '00000000-0000-0000-0000-000000000103',
    p.tenant_id,
    p.id,
    'Cool air without installation',
    'A compact fan prepared for the landing-engine local order rehearsal.',
    '["Cash on delivery available","Fast local delivery","Call confirmation before dispatch"]',
    '[{"title":"Rechargeable","description":"Runs for hours after charging."},{"title":"Compact size","description":"Fits on desks, counters, and bedside tables."}]',
    '[{"question":"Can I pay on delivery?","answer":"Yes, cash on delivery is supported."},{"question":"Will someone confirm my order?","answer":"Yes, Wasilio confirmation happens after the order is received."}]',
    '[{"label":"COD","description":"Pay when the package arrives."},{"label":"Local support","description":"WhatsApp support is available for order questions."}]',
    '["http://localhost:8080/media/demo/first-store/coolair-mini-gallery.svg"]',
    'First Store CoolAir Mini',
    'Order the CoolAir Mini locally and submit a Wasilio-powered COD order.',
    'http://localhost:8080/media/demo/first-store/coolair-mini-seo.svg',
    'PUBLISHED',
    NOW(),
    NOW()
FROM products p
WHERE p.tenant_id = '00000000-0000-0000-0000-000000000001'
  AND p.slug = 'coolair-mini'
ON CONFLICT (tenant_id, product_id) DO NOTHING;

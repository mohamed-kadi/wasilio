# ADR-010: Catalog As Reusable Product Context

## Status

Accepted. Minimal product management is implemented.

## Context

Storefronts, imports, and future integrations need product data, media, pricing display, FAQs, testimonials, and availability metadata. Putting those fields directly on orders or frontend files would make storefront and order operations hard to evolve.

## Decision

Add Catalog as a separate bounded context when product management is implemented. Catalog owns merchant products, variants, display pricing, product media, product FAQs, testimonials, and storefront-ready offer metadata.

Order creation should snapshot the product details needed for operations so historical orders remain stable after catalog edits.

The first implementation intentionally keeps the model small:

- Tenant-scoped products with name, slug, description, price, currency, nullable SKU, nullable image URL, status, and timestamps.
- Product statuses are `DRAFT`, `ACTIVE`, and `ARCHIVED`.
- Slug uniqueness is scoped to a tenant.
- Product media is currently a single `imageUrl` placeholder.
- Storefront publishing, checkout, product SEO, variants, galleries, FAQs, testimonials, attribution, adapters, and customer intelligence remain outside this step.

Order creation does not yet reference `productId`. That should be the next Catalog/Core connection and must include stable order-line snapshots rather than relying on mutable product records.

## Consequences

- Product presentation can be reused by Wasilio storefronts and future sales channels.
- Order lifecycle remains focused on COD operations.
- Catalog changes do not rewrite historical order facts.
- Storefront implementation should wait for at least a minimal Catalog API instead of hardcoding products in the frontend.

## Alternatives Considered

- Store products only in frontend content files: rejected because merchants need tenant-owned, API-backed product management.
- Add product presentation fields directly to orders: rejected because orders represent transactions, not reusable merchant catalog state.

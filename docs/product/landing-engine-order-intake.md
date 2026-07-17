# Landing Engine Contract

Phase 19F defined the stable handoff from landing-engine into Wasilio Core. Phase 20C adds a public product readiness review contract so landing-engine can render and QA Wasilio product pages without owning Wasilio operations logic.
Phase 21 documents and tests the local integration rehearsal in `docs/product/landing-engine-integration-rehearsal.md`. Phase 22 adds seeded local `first-store` data for repeating that rehearsal across Wasilio and landing-engine. Phase 25 improves the Wasilio operator handoff from storefront intake to confirmation without changing the public contract.

Landing-engine is an order-intent client. Wasilio remains the source of truth for order lifecycle, confirmation, courier operations, recovery, and intelligence scoring.

## Public Product Page Endpoint

Use the public storefront product endpoint to render a product page:

`GET /api/public/storefront/{storeSlug}/products/{productSlug}`

The response includes:

- storefront display context
- product ID, slug, name, description, and image URL
- offer price, currency, availability, and orderable flag
- SEO fallback or published SEO overrides
- published landing profile content when available
- `readiness`, a Wasilio-owned review object for landing-engine QA

Media fields are part of this public product page contract:

- `product.imageUrl` is the primary Wasilio catalog image.
- `landingProfile.galleryImageUrls` is the published gallery media list.
- `seo.image` is the published SEO image when present, otherwise the primary product image.

Landing-engine should render those URLs directly and keep object-fit/layout decisions in its presentation layer. Wasilio remains the owner of upload validation, storage, public URLs, profile publishing, and media readiness.

`readiness` is informational. It does not block the public endpoint by itself and does not mutate product, order, confirmation, delivery, or recovery state.

Readiness fields:

- `orderable`: whether the public product response can accept order intent.
- `requiredComplete`: number of required readiness items currently complete.
- `requiredTotal`: total required readiness items.
- `items`: business-readable checks with `key`, `label`, `complete`, `required`, and `detail`.

Current readiness item keys:

- `catalog_active`
- `product_description`
- `primary_image`
- `landing_profile_published`
- `landing_headline`
- `landing_benefits`
- `landing_features`
- `gallery_media`
- `seo_image`

## Public Storefront Order Endpoint

Use the public storefront endpoint for landing-engine order capture:

`POST /api/public/storefront/{storeSlug}/orders`

Optional header:

- `X-Correlation-ID`: UUID used for tracing logs, domain events, and the stored raw intake payload. If omitted or invalid, Wasilio generates one and returns it in the same response header.

Required body:

- `selection.product.productSlug` or `selection.product.productId`
- `selection.quantity`
- `customer.name`
- `customer.phone`
- `delivery.city`
- `delivery.address`
- `idempotencyKey`

Optional body:

- `correlationId`: UUID, normally supplied by the request header instead.
- `delivery.notes`
- `attribution.source`
- `attribution.medium`
- `attribution.campaign`
- `attribution.content`
- `attribution.term`
- `attribution.referrerUrl`
- `attribution.landingPageUrl`

Unsupported in V1:

- `selection.product.variantId`
- client-provided lifecycle status
- client-provided confirmation score
- client-provided fraud score
- client-provided score reasons

## Response Contract

Successful order intake returns `202 Accepted`:

```json
{
  "receiptId": "7f8dcb2e-6f03-4cf1-a835-7a4b8c5b2b41",
  "status": "accepted",
  "message": "Order received"
}
```

`receiptId` is the inbound receipt ID, not the internal Wasilio order ID. Landing-engine should store it for support and retry tracing. The public response intentionally does not expose tenant IDs, order IDs, source metadata, lifecycle status, confirmation confidence, fraud risk, or intelligence details.

Duplicate submissions with the same `idempotencyKey` and the same canonical payload return the same `receiptId` with `message: "Order already received"`.

Duplicate submissions with the same `idempotencyKey` and a different canonical payload return `409 Conflict`.

## Wasilio Operations Handoff

Accepted storefront orders enter Wasilio through the existing inbound order review surface.

For `WASILIO_STOREFRONT` records, the operator UI should use merchant-facing labels:

- source: `Storefront / landing-engine`
- normalized status: `Order created`
- linked order handoff: `Ready for confirmation`

When an inbound record has a linked internal Wasilio order ID, the UI can offer:

- `Open confirmation`: selects the created order in the confirmation queue.
- `Open order detail`: opens the canonical order detail page.

The inbound detail panel may parse the stored raw payload into a compact summary for operators:

- customer name and phone
- delivery city
- product name or slug
- selected quantity
- attribution source, medium, campaign, and landing page URL

The raw payload remains available as developer/debug context. This parsing is display-only and must not mutate the order, lifecycle state, intelligence scores, or source payload.

## Server-Owned Fields

Wasilio forces the source to `WASILIO_STOREFRONT` for this endpoint.

Wasilio snapshots product name, SKU, unit price, currency, quantity, and line total from the server-side Catalog. Landing-engine must not send trusted price, currency, or product names for order calculation.

Wasilio stores a normalized raw intake payload with:

- payload type and schema version
- payload hash
- correlation ID
- canonical customer, delivery, product, quantity, and attribution fields
- server product snapshot

## Intelligence Boundary

Landing-engine must not send intelligence fields.

Wasilio ignores score-looking fields such as:

- `intelligence`
- `confirmationConfidenceScore`
- `fraudRiskScore`

After a valid order is committed and projected, Wasilio creates the initial internal intelligence snapshot, score reasons, and audit event. The score is available to Wasilio operations queues and reports, but it is not returned to landing-engine.

For storefront orders, Wasilio may use internally owned product/page context, such as product media and published landing content, as low-weight intelligence signals. Landing-engine still does not send scores or score reasons.

The score remains informational. It does not automatically confirm, reject, assign, retry, refund, or close an order.

## Media Boundary

Landing-engine does not upload media into Wasilio in the current contract.

The supported flow is:

1. Merchant uploads primary, gallery, or SEO media inside Wasilio.
2. Wasilio returns stable `publicUrl` values.
3. Wasilio stores primary media on the product and gallery/SEO media on the published storefront profile.
4. Landing-engine reads `GET /api/public/storefront/{storeSlug}/products/{productSlug}`.
5. Landing-engine renders `product.imageUrl`, `landingProfile.galleryImageUrls`, and `seo.image`.
6. Landing-engine submits order intent through `POST /api/public/storefront/{storeSlug}/orders`.

Media readiness can be shown to operators or reviewers, but it must not become a client-owned rule for order acceptance, confirmation, courier assignment, recovery, refund review, or intelligence scoring.

## Failure Modes

- `400 Bad Request`: malformed or incomplete order intent.
- `404 Not Found`: storefront or active product is not available.
- `409 Conflict`: idempotency key reused with a different payload.
- `202 Accepted`: order intent accepted or previously accepted with the same payload.

## Operational Checks

For every accepted order, Wasilio should be able to trace:

- public response `receiptId`
- stored inbound order
- normalized internal order
- `OrderCreated` event with correlation ID
- initial intelligence snapshot and audit event
- confirmation queue visibility
- operations handoff from inbound detail to confirmation and order detail

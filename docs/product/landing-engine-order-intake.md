# Landing Engine Order Intake

Phase 19F defines the stable handoff from landing-engine into Wasilio Core.

Landing-engine is an order-intent client. Wasilio remains the source of truth for order lifecycle, confirmation, courier operations, recovery, and intelligence scoring.

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

The score remains informational. It does not automatically confirm, reject, assign, retry, refund, or close an order.

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

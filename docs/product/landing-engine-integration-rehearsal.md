# Landing Engine Integration Rehearsal

Phase 21 verifies that landing-engine can use Wasilio as the product and order source without owning Wasilio operations logic.

## Local Landing Engine Configuration

The sibling landing-engine project uses these environment variables for Wasilio mode:

```bash
NEXT_PUBLIC_PRODUCT_PROVIDER=wasilio
NEXT_PUBLIC_WASILIO_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_WASILIO_STORE_SLUG=<storeSlug>
```

Current local landing-engine `.env.local` was observed with:

```bash
NEXT_PUBLIC_PRODUCT_PROVIDER=wasilio
NEXT_PUBLIC_WASILIO_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_WASILIO_STORE_SLUG=first-store
```

Wasilio shows these values in Storefront Settings under Developer setup after a merchant configures the public storefront.

## Rehearsal Flow

1. Merchant creates/enables storefront settings in Wasilio.
2. Merchant creates an ACTIVE catalog product.
3. Merchant uploads primary product media.
4. Merchant creates and publishes storefront profile content.
5. Landing-engine reads:

   `GET /api/public/storefront/{storeSlug}/products/{productSlug}`

6. Landing-engine renders product name, offer, primary image, gallery media, SEO image, support channel, and published landing profile content.
7. Landing-engine submits:

   `POST /api/public/storefront/{storeSlug}/orders`

8. Wasilio returns only the public receipt shape:

```json
{
  "receiptId": "uuid",
  "status": "accepted",
  "message": "Order received"
}
```

9. Wasilio internally creates the inbound order, normalized operational order, order line snapshot, initial intelligence snapshot, score signals, and audit event.

## Contract Boundaries

Landing-engine may send:

- product ID and/or product slug
- quantity
- customer name and phone
- delivery city, address, and notes
- idempotency key
- attribution fields such as source, campaign, content, referrer URL, and landing page URL
- `X-Correlation-ID`

Landing-engine must not send or own:

- tenant IDs or merchant IDs
- trusted product names, prices, or currencies
- order lifecycle status
- confirmation status
- courier assignment or recovery decisions
- confirmation confidence score
- fraud risk score
- score reasons or intelligence level
- direct Wasilio media writes

## Verification Coverage

Wasilio Phase 21 locks this path with:

- API-level product fetch then order submit rehearsal in `PublicStorefrontControllerIntegrationTest`.
- Public response shape checks so product and order responses do not expose internal fields.
- Internal intelligence checks proving accepted public orders are scored by Wasilio, not by landing-engine.
- Storefront Settings smoke coverage for landing-engine `.env.local`, product GET URL, and order POST URL.

External landing-engine browser QA should verify:

- `/products/{productSlug}` fetches the Wasilio public product endpoint.
- Primary product image, gallery images, and SEO/social image render from Wasilio URLs.
- Order submission returns a receipt and shows the configured landing-engine success state.
- The Wasilio merchant dashboard shows the resulting storefront inbound order and internal intelligence score.

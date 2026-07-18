# Landing Engine Integration Rehearsal

Phase 21 verifies that landing-engine can use Wasilio as the product and order source without owning Wasilio operations logic.
Phase 22 adds local rehearsal seed data for the shared `first-store` flow so Wasilio and landing-engine can be run together without manually creating the storefront/product every time. Phase 23 uses that same flow to validate intelligence score movement after operator confirmation evidence.
Phase 24D adds a media handoff rehearsal around this flow so uploaded Wasilio media, public product media fields, fresh merchant previews, and dashboard layout stability are checked together.

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

## Phase 22 Seeded Rehearsal Data

Local Wasilio seed loading includes a demo storefront, product, and published landing profile:

| Field | Value |
| --- | --- |
| Store slug | `first-store` |
| Product slug | `coolair-mini` |
| Public product URL | `http://localhost:8080/api/public/storefront/first-store/products/coolair-mini` |
| Public order URL | `http://localhost:8080/api/public/storefront/first-store/orders` |
| Merchant preview URL | `http://localhost:3000/products/coolair-mini?wasilioPreview=1` |
| Merchant login | `admin@example.com` |

The seed is in `backend/src/main/resources/db/seed/V1001__landing_engine_rehearsal_seed.sql`. It is loaded only when local Flyway locations include `classpath:db/seed`; production compose excludes seed data.

The seeded product references local demo media under:

```text
backend/storage/media/demo/first-store/
```

When the backend is started from the `backend` directory, those files are served through:

```text
http://localhost:8080/media/demo/first-store/coolair-mini-primary.svg
http://localhost:8080/media/demo/first-store/coolair-mini-gallery.svg
http://localhost:8080/media/demo/first-store/coolair-mini-seo.svg
```

These placeholders exist only for local browser rehearsal. Real merchant media still uses authenticated upload through Wasilio and the existing media validation rules.

Local Docker compose mounts the same demo media directory into the backend container through `docker-compose.override.yml`. Production compose does not load seed data and does not need this rehearsal media.

## Phase 22 Local Runbook

Start Wasilio backend with local seed loading:

```bash
cd backend
export JWT_SECRET="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
export SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/nexora"
export SPRING_DATASOURCE_USERNAME="postgres"
export SPRING_DATASOURCE_PASSWORD="password"
export SPRING_FLYWAY_LOCATIONS="classpath:db/migration,classpath:db/seed"
export SPRING_FLYWAY_OUT_OF_ORDER="true"
mvn spring-boot:run
```

Verify Wasilio exposes the seeded product:

```bash
curl -s http://localhost:8080/api/public/storefront/first-store/products/coolair-mini
```

Expected checks:

- `storeSlug` is `first-store`.
- `product.productSlug` is `coolair-mini`.
- `product.imageUrl`, `landingProfile.galleryImageUrls`, and `seo.image` point to Wasilio-hosted local media.
- `readiness.requiredComplete` equals `7`.
- No tenant IDs, merchant IDs, internal product status, lifecycle status, or intelligence details are present.

Run landing-engine with Wasilio mode:

```bash
NEXT_PUBLIC_PRODUCT_PROVIDER=wasilio
NEXT_PUBLIC_WASILIO_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_WASILIO_STORE_SLUG=first-store
```

Open landing-engine at its local product page, usually:

```text
http://localhost:3000/products/coolair-mini
```

For merchant QA immediately after changing product media in Wasilio, use the preview URL:

```text
http://localhost:3000/products/coolair-mini?wasilioPreview=1
```

The preview flag tells landing-engine to fetch the Wasilio product payload fresh for the operator request. Normal public product pages keep the short landing-engine cache.

As of Phase 24D, the expected landing-engine code path is:

- `/products/{slug}?wasilioPreview=1` passes `fresh: true` to the product provider.
- `wasilioProductProvider` uses `cache: 'no-store'` for that preview fetch.
- Regular public product pages keep the existing short revalidation cache.
- Wasilio Storefront Publishing shows the same preview URL as a compact copy/open action, not as a long wrapped table value.

Submit one COD test order from landing-engine.

Expected Wasilio checks after submission:

- Landing-engine receives only the public receipt shape with `receiptId`, `status`, and `message`.
- Wasilio creates a storefront inbound order with source `WASILIO_STOREFRONT`.
- The normalized order appears in Wasilio operations queues without landing-engine owning lifecycle status.
- Wasilio creates the initial intelligence snapshot internally.
- The public receipt ID can be traced to the inbound order detail for debugging.

For score movement validation after the order is accepted, use `docs/product/intelligence-calibration-rehearsal.md`.
For real media upload/display validation before order submission, use `docs/product/media-upload.md#phase-24d-media-handoff-rehearsal`.

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

Wasilio Phase 21 and Phase 22 lock this path with:

- API-level product fetch then order submit rehearsal in `PublicStorefrontControllerIntegrationTest`.
- API-level `first-store` seeded contract rehearsal in `PublicStorefrontControllerIntegrationTest`.
- Public response shape checks so product and order responses do not expose internal fields.
- Internal intelligence checks proving accepted public orders are scored by Wasilio, not by landing-engine.
- Storefront Settings smoke coverage for landing-engine `.env.local`, product GET URL, and order POST URL.

External landing-engine browser QA should verify:

- `/products/{productSlug}` fetches the Wasilio public product endpoint.
- Primary product image, gallery images, and SEO/social image render from Wasilio URLs.
- `?wasilioPreview=1` refreshes recently changed Wasilio media for merchant QA without changing the normal public cache behavior.
- Order submission returns a receipt and shows the configured landing-engine success state.
- The Wasilio merchant dashboard shows the resulting storefront inbound order and internal intelligence score.

## Phase 36 Onboarding And Settings UX

Before production hardening, the merchant setup path should make the minimum Wasilio-to-landing-engine handoff visible without changing backend contracts.

- Signup shows workspace, main admin, and password readiness before creating the first tenant.
- Storefront Settings shows setup cards for store status, store identity, support contact, and checkout defaults before the editable form.
- Developer setup remains collapsed by default and still exposes the same public product URL, public order URL, landing-engine pattern, and `.env.local` values.
- Storefront Settings must remain stable at laptop width before and after opening Developer setup.

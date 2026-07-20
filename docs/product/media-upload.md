# Product Media Upload

Phase 20A added the first Wasilio-owned media upload path for catalog products. Phase 20B connects that media path to storefront publishing and public preview rendering.
Phase 20C exposes media readiness in public product responses and lets Wasilio intelligence use storefront media context as low-weight scoring evidence.
Phase 20D/20E hardens merchant-facing image rendering, profile media previews, and the landing-engine handoff contract.
Phase 22 adds local-only demo media placeholders for the seeded landing-engine rehearsal; authenticated upload remains the real merchant media path.
Phase 24 tightens merchant-facing media UX so uploaded product images render in stable dashboard frames immediately after upload and backend-relative media paths remain displayable in Wasilio.
Phase 24B makes Wasilio merchant Preview links request fresh landing-engine product data so recently uploaded images are visible immediately without changing public customer caching.
Phase 24C makes Storefront Publishing media readiness explicit so merchants can review primary image, gallery media, SEO image, public API media, and fresh preview status before publishing.
Phase 24D turns that media path into a repeatable QA rehearsal: Wasilio upload/display, public product media payload, fresh landing-engine preview, and dashboard layout stability should be checked together before moving on.

## Scope

- Authenticated merchants and admins can upload product media through `POST /api/products/{productId}/media`.
- Uploads are tenant-scoped by the existing product ownership check.
- Uploaded files are stored locally through a storage abstraction and served from `/media/**`.
- `PRODUCT_IMAGE` uploads update the existing `products.image_url` field. Existing product and public storefront payload contracts continue to use image URLs.
- `GALLERY_IMAGE` and `SEO_IMAGE` uploads return media URLs that merchants can place into the existing storefront profile gallery and SEO image fields.

## Request

Use multipart form data:

- `file`: required image file.
- `purpose`: optional, defaults to `PRODUCT_IMAGE`. Supported values are `PRODUCT_IMAGE`, `GALLERY_IMAGE`, and `SEO_IMAGE`.

Current validation:

- Allowed media types: JPEG, PNG, WebP.
- Maximum size: 5 MB by default.
- File bytes must match the declared media type signature.

## Response

The endpoint returns media metadata:

- `mediaId`
- `productId`
- `purpose`
- `originalFilename`
- `contentType`
- `sizeBytes`
- `publicUrl`
- `createdAt`

## Storage Boundary

Media rows are stored in `media_assets` with tenant, product, purpose, checksum, content type, size, public URL, storage path, uploader, and created time.

The default storage location is `storage/media`, configurable with `APP_MEDIA_STORAGE_DIR`. The public route defaults to `/media`, configurable with `APP_MEDIA_PUBLIC_BASE_PATH`.

`APP_MEDIA_PUBLIC_BASE_URL` controls whether uploaded media URLs are returned as absolute URLs. Local development defaults to `http://localhost:8080`, so a separate landing-engine preview can render Wasilio-hosted media. Production should set this to the externally reachable Wasilio API origin.

This is intentionally local-first. A future object-storage implementation should keep the application contract stable and swap only the storage implementation/public URL generation.

Docker deployments mount `/app/storage/media` as a named backend media volume. Production must set `APP_MEDIA_PUBLIC_BASE_URL` to the externally reachable origin that serves `/media`, and the media volume must be included in backup or host-migration procedures until object storage exists.

The Phase 22 rehearsal seed references SVG placeholders in `backend/storage/media/demo/first-store/` so landing-engine browser QA can render product, gallery, and SEO media locally. Local Docker compose mounts that demo directory read-only into the backend container. Those files are not uploaded media records and do not change upload validation, supported upload content types, or production media storage expectations.

## Landing Engine Boundary

Landing-engine should render the media URLs returned by Wasilio/public product APIs. It should not upload directly to Wasilio-owned storage unless it is acting as an authenticated merchant client or has a future explicit server-to-server media contract.

Public product responses include a `readiness` object with checks such as `primary_image`, `gallery_media`, and `seo_image`. Landing-engine can use these checks for preview/review UX, but they are not lifecycle commands and they do not replace Wasilio's internal intelligence scoring.

## Public Product Media Contract

The stable read path for landing-engine product rendering is:

`GET /api/public/storefront/{storeSlug}/products/{productSlug}`

Media fields in that response:

- `product.imageUrl`: primary catalog image. This is updated automatically when a merchant uploads media with `purpose=PRODUCT_IMAGE`.
- `landingProfile.galleryImageUrls`: published storefront gallery media. These URLs are saved through the storefront profile after `GALLERY_IMAGE` uploads return `publicUrl`.
- `seo.image`: SEO/social image. If a published profile has `seoImageUrl`, Wasilio returns that value. Otherwise it falls back to `product.imageUrl`.
- `readiness.items`: includes `primary_image`, `gallery_media`, and `seo_image` checks so a review UI can show what is complete without guessing from raw fields.

Landing-engine should treat these values as display URLs owned by Wasilio. It should not recalculate readiness, infer tenant state, or use media presence to change order lifecycle behavior.

## Merchant UX Rules

- Product table thumbnails and product editor previews must use fixed-size frames with `object-contain` so large uploaded images remain visible and do not distort dashboard density.
- Image frames must keep the same dimensions when the source is missing, loading, or unavailable; the fallback state should not expand rows or editor panels.
- Product image uploads should update the open editor and product table cache immediately, then refresh from the backend in the background.
- Wasilio UI previews may normalize backend-relative `/media/...` paths for display. This is a frontend rendering convenience only; stored product/profile payload values remain unchanged.
- Wasilio merchant Preview links include `wasilioPreview=1`; landing-engine treats that flag as an operator preview and bypasses its short product cache for that request.
- Storefront Publishing should show media readiness separately from general landing content readiness. Primary image, gallery media, SEO image/fallback, public API media, and fresh preview status should be visible at row level.
- Storefront Publishing must avoid horizontal page or table overflow on laptop-width dashboards when the media readiness and public links columns are visible.
- Storefront Publishing should label public links by purpose: Preview page means the customer-facing landing page, while API payload means the data contract landing-engine reads from Wasilio.
- Preview page and API payload URLs should remain copyable, but table rows should show compact purpose labels rather than long wrapped URLs.
- Storefront profile gallery and SEO fields remain URL-based payloads, but the editor should show compact previews from those URLs before save.
- Missing media is a readiness concern, not a lifecycle blocker. Merchants can keep draft profile content hidden until they publish it.
- Public readiness should be visible in Storefront Publishing when the store and product are active, because this is the closest in-app view to the landing-engine contract.

## Phase 24D Media Handoff Rehearsal

Use this checklist when validating media with real local services, not just mocked browser tests.

1. Start Wasilio backend with local seed support or a local merchant database.
2. Start Wasilio frontend and sign in as a merchant/admin.
3. Confirm storefront settings are active and expose the landing-engine `.env.local` values.
4. Create or open an ACTIVE product.
5. Upload a primary product image and confirm the product table/editor frames stay fixed-size with the full image contained.
6. Open Storefront Publishing and confirm the row shows media readiness for primary image, gallery media, SEO image/fallback, public API media, and fresh preview.
7. Confirm the full dashboard and publishing table do not shift left/right on a 14-inch/laptop viewport, including after browser refresh.
8. Copy the Public API link and verify the response contains `product.imageUrl`, `seo.image`, `landingProfile.galleryImageUrls`, and `readiness.items` without internal tenant/order/intelligence fields.
9. Open the landing preview link with `?wasilioPreview=1` and confirm landing-engine renders the latest uploaded Wasilio media.
10. Submit a test COD order from landing-engine and confirm Wasilio owns the resulting inbound order, lifecycle, and intelligence score.

Phase 24D does not add media domain rules. It validates that the existing authenticated upload path, public read path, and landing-engine preview cache bypass work together.

## Phase 35 Publishing UX Simplification

Storefront Publishing should stay useful as a readiness workspace without becoming a dense diagnostics table.

- Keep the same product list, storefront settings, profile queries, public product readiness query, copy actions, preview links, and publish/unpublish mutation.
- Show top-level workload cards for catalog products, active catalog products, primary image coverage, and storefront setup.
- Keep row-level publishing readiness, missing content, media readiness, public API readiness, public preview URL, and API payload URL visible.
- Present media checks as compact status chips with one attention line instead of long per-check explanations.
- Keep Preview page and API payload copy buttons labeled by purpose, with compact URL labels instead of full wrapped URLs.
- Verify the page and publishing table do not create horizontal overflow on a 14-inch/laptop viewport, including after refresh.

## Verification Checklist

For every media contract change, verify:

- `PRODUCT_IMAGE` upload returns a `publicUrl` and updates the authenticated product `imageUrl`.
- Product dashboard/editor previews shrink the image into stable frames.
- Broken or temporarily unreachable product media falls back inside the same thumbnail frame.
- Product and publishing Preview links include `wasilioPreview=1` so landing-engine refreshes Wasilio product data after media changes.
- Storefront Publishing shows row-level media readiness for primary image, gallery media, SEO image, public API media, and fresh preview status.
- Storefront Publishing keeps full-page and table horizontal scroll disabled at laptop width, including after browser refresh.
- Preview page and API payload links remain copyable from Storefront Publishing without rendering full wrapped URLs in the table row.
- `GALLERY_IMAGE` upload appends the returned URL into `galleryImageUrls` and shows a preview before save.
- `SEO_IMAGE` upload writes the returned URL into `seoImageUrl` and shows a preview before save.
- Saving the storefront profile sends the same gallery and SEO URLs back to Wasilio.
- The public product endpoint returns `product.imageUrl`, `seo.image`, `landingProfile.galleryImageUrls`, and media readiness without tenant IDs or internal status fields.
- Landing-engine consumes the public product endpoint and public order-intent endpoint only; it does not send fraud scores, confirmation scores, lifecycle commands, or direct media writes.

# Product Media Upload

Phase 20A added the first Wasilio-owned media upload path for catalog products. Phase 20B connects that media path to storefront publishing and public preview rendering.
Phase 20C exposes media readiness in public product responses and lets Wasilio intelligence use storefront media context as low-weight scoring evidence.
Phase 20D/20E hardens merchant-facing image rendering, profile media previews, and the landing-engine handoff contract.
Phase 22 adds local-only demo media placeholders for the seeded landing-engine rehearsal; authenticated upload remains the real merchant media path.

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
- Storefront profile gallery and SEO fields remain URL-based payloads, but the editor should show compact previews from those URLs before save.
- Missing media is a readiness concern, not a lifecycle blocker. Merchants can keep draft profile content hidden until they publish it.
- Public readiness should be visible in Storefront Publishing when the store and product are active, because this is the closest in-app view to the landing-engine contract.

## Phase 20E Verification Checklist

For every media contract change, verify:

- `PRODUCT_IMAGE` upload returns a `publicUrl` and updates the authenticated product `imageUrl`.
- Product dashboard/editor previews shrink the image into stable frames.
- `GALLERY_IMAGE` upload appends the returned URL into `galleryImageUrls` and shows a preview before save.
- `SEO_IMAGE` upload writes the returned URL into `seoImageUrl` and shows a preview before save.
- Saving the storefront profile sends the same gallery and SEO URLs back to Wasilio.
- The public product endpoint returns `product.imageUrl`, `seo.image`, `landingProfile.galleryImageUrls`, and media readiness without tenant IDs or internal status fields.
- Landing-engine consumes the public product endpoint and public order-intent endpoint only; it does not send fraud scores, confirmation scores, lifecycle commands, or direct media writes.

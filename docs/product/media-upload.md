# Product Media Upload

Phase 20A added the first Wasilio-owned media upload path for catalog products. Phase 20B connects that media path to storefront publishing and public preview rendering.
Phase 20C exposes media readiness in public product responses and lets Wasilio intelligence use storefront media context as low-weight scoring evidence.

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

## Landing Engine Boundary

Landing-engine should render the media URLs returned by Wasilio/public product APIs. It should not upload directly to Wasilio-owned storage unless it is acting as an authenticated merchant client or has a future explicit server-to-server media contract.

Public product responses include a `readiness` object with checks such as `primary_image`, `gallery_media`, and `seo_image`. Landing-engine can use these checks for preview/review UX, but they are not lifecycle commands and they do not replace Wasilio's internal intelligence scoring.

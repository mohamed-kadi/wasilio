import { expect, test } from '@playwright/test';
import { installMockApi, loginAs } from './helpers';

const product = {
  id: '55555555-5555-5555-5555-555555555555',
  tenantId: '00000000-0000-0000-0000-000000000001',
  name: 'Argan Oil',
  slug: 'argan-oil',
  description: 'Cold pressed argan oil',
  priceAmount: 174.5,
  currency: 'MAD',
  sku: 'ARG-001',
  imageUrl: '',
  status: 'ACTIVE',
  createdAt: '2026-06-23T09:00:00Z',
  updatedAt: '2026-06-23T09:00:00Z',
};

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64',
);

test('merchant uploads primary product media from product editor', async ({ page }) => {
  await installMockApi(page);
  let uploadedImageUrl = '';

  await page.route('**/api/storefront-settings', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        storeSlug: 'demo-store',
        publicName: 'Demo Store',
        status: 'ACTIVE',
        defaultCountryCode: 'MA',
        defaultCurrency: 'MAD',
        phonePattern: '^\\\\+?212[0-9]{9}$',
      }),
    });
  });

  await page.route('**/api/products?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [{ ...product, imageUrl: uploadedImageUrl }],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      }),
    });
  });

  await page.route(`**/api/products/${product.id}/storefront-profile`, async (route) => {
    await route.fulfill({ status: 204 });
  });

  await page.route(`**/api/products/${product.id}/media`, async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers()['content-type']).toContain('multipart/form-data');
    uploadedImageUrl = 'https://media.example.test/media/tenant/products/argan-oil/product-image.webp';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        mediaId: '66666666-6666-6666-6666-666666666666',
        productId: product.id,
        purpose: 'PRODUCT_IMAGE',
        originalFilename: 'argan.webp',
        contentType: 'image/webp',
        sizeBytes: 16,
        publicUrl: uploadedImageUrl,
        createdAt: '2026-07-13T10:00:00Z',
      }),
    });
  });

  await page.route('**/media/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: tinyPng,
    });
  });

  await loginAs(page, 'merchant@example.com');
  await page.goto('/app/products');

  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
  await page.getByRole('button', { name: /edit product/i }).click();
  await expect(page.getByRole('heading', { name: 'Edit Product' })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: 'argan.webp',
    mimeType: 'image/webp',
    buffer: Buffer.from('RIFF____WEBPVP8 '),
  });

  await expect(page.getByPlaceholder('Image URL')).toHaveValue(uploadedImageUrl);
  const editorPreview = page.getByTestId('product-editor-image-preview');
  await expect(editorPreview).toHaveCSS('width', '112px');
  await expect(editorPreview).toHaveCSS('height', '112px');
  await expect(editorPreview.locator('img')).toHaveCSS('object-fit', 'contain');
  await expect(page.getByText('JPEG, PNG, or WebP up to 5 MB.')).toBeVisible();

  await page.getByRole('button', { name: /close product editor/i }).click();
  const thumbnail = page.getByTestId('product-thumbnail').first();
  await expect(thumbnail.locator('img')).toHaveAttribute('src', uploadedImageUrl);
  await expect(thumbnail.locator('img')).toHaveCSS('object-fit', 'contain');
  await expect(thumbnail).toHaveCSS('width', '56px');
  await expect(thumbnail).toHaveCSS('height', '56px');
  await expect(page.getByRole('link', { name: /^preview$/i })).toHaveAttribute(
    'href',
    'http://localhost:3000/products/argan-oil?wasilioPreview=1',
  );
});

test('merchant uploads storefront gallery and SEO media into profile fields', async ({ page }) => {
  await installMockApi(page);
  const galleryUrl = 'https://media.example.test/media/tenant/products/argan-oil/gallery/gallery-1.webp';
  const seoUrl = 'https://media.example.test/media/tenant/products/argan-oil/seo/seo.webp';

  await page.route('**/api/storefront-settings', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        storeSlug: 'demo-store',
        publicName: 'Demo Store',
        status: 'ACTIVE',
        defaultCountryCode: 'MA',
        defaultCurrency: 'MAD',
        phonePattern: '^\\\\+?212[0-9]{9}$',
      }),
    });
  });

  await page.route('**/api/products?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [{
          ...product,
          imageUrl: 'https://media.example.test/media/tenant/products/argan-oil/product-image.webp',
        }],
        page: 0,
        size: 100,
        totalElements: 1,
        totalPages: 1,
      }),
    });
  });

  await page.route(`**/api/products/${product.id}/storefront-profile`, async (route) => {
    if (route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          productId: product.id,
          ...payload,
        }),
      });
      return;
    }

    await route.fulfill({ status: 204 });
  });

  await page.route(`**/api/products/${product.id}/media`, async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers()['content-type']).toContain('multipart/form-data');
    const body = route.request().postDataBuffer()?.toString('utf8') ?? '';
    const isSeoImage = body.includes('SEO_IMAGE');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        mediaId: isSeoImage
          ? '77777777-7777-7777-7777-777777777777'
          : '66666666-6666-6666-6666-666666666666',
        productId: product.id,
        purpose: isSeoImage ? 'SEO_IMAGE' : 'GALLERY_IMAGE',
        originalFilename: isSeoImage ? 'seo.webp' : 'gallery.webp',
        contentType: 'image/webp',
        sizeBytes: 16,
        publicUrl: isSeoImage ? seoUrl : galleryUrl,
        createdAt: '2026-07-13T10:00:00Z',
      }),
    });
  });
  await page.route('**/media/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: tinyPng,
    });
  });
  await page.route('**/api/public/storefront/demo-store/products/argan-oil', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        storeSlug: 'demo-store',
        storePublicName: 'Demo Store',
        defaultCountryCode: 'MA',
        defaultCurrency: 'MAD',
        supportChannel: null,
        product: {
          productId: product.id,
          productSlug: product.slug,
          productName: product.name,
          description: product.description,
          imageUrl: 'https://media.example.test/media/tenant/products/argan-oil/product-image.webp',
        },
        offer: {
          price: product.priceAmount,
          currency: product.currency,
          availability: 'IN_STOCK',
          orderable: true,
        },
        seo: {
          title: product.name,
          description: product.description,
          image: 'https://media.example.test/media/tenant/products/argan-oil/product-image.webp',
        },
        readiness: {
          orderable: true,
          requiredComplete: 3,
          requiredTotal: 7,
          items: [
            { key: 'catalog_active', label: 'Catalog product active', complete: true, required: true },
            { key: 'product_description', label: 'Product description', complete: true, required: true },
            { key: 'primary_image', label: 'Primary product image', complete: true, required: true },
            { key: 'landing_profile_published', label: 'Landing profile published', complete: false, required: true },
          ],
        },
        landingProfile: null,
      }),
    });
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await loginAs(page, 'merchant@example.com');
  await page.goto('/app/storefront/publishing');

  await expect(page.getByRole('heading', { name: 'Product Publishing' })).toBeVisible();
  const publishingTable = page.getByTestId('publishing-table-scroll');
  await expect(page.getByText('Catalog products', { exact: true })).toBeVisible();
  await expect(page.getByText('Active catalog', { exact: true })).toBeVisible();
  await expect(page.getByText('Primary images', { exact: true })).toBeVisible();
  await expect(publishingTable.getByText('Publishing status')).toBeVisible();
  await expect(publishingTable.getByText('Media & API')).toBeVisible();
  await expect(publishingTable.getByText('Public API check')).toBeVisible();
  await expect(publishingTable.getByText('3/7 required complete')).toBeVisible();
  await expect(publishingTable.getByText('Media readiness').first()).toBeVisible();
  await expect(publishingTable.getByText('4/5 ready')).toBeVisible();
  await expect(publishingTable.getByText('5 checks')).toBeVisible();
  await expect(publishingTable.getByText('Primary image', { exact: true })).toBeVisible();
  await expect(publishingTable.getByText('Gallery media', { exact: true })).toBeVisible();
  await expect(publishingTable.getByText('SEO image', { exact: true })).toBeVisible();
  await expect(publishingTable.getByText(/Needs media: Gallery media/)).toBeVisible();
  await expect(publishingTable.getByText('Preview page')).toBeVisible();
  await expect(publishingTable.getByText('Customer-facing landing page')).toBeVisible();
  await expect(publishingTable.getByText('API payload')).toBeVisible();
  await expect(publishingTable.getByText('Data sent to landing-engine')).toBeVisible();
  await expect(page.getByRole('button', { name: /copy preview page url/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /copy api payload url/i })).toBeVisible();
  await expect(page.getByText('localhost:8080 /argan-oil')).toBeVisible();
  await expectPublishingPageToStayWithinViewport(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Product Publishing' })).toBeVisible();
  await expectPublishingPageToStayWithinViewport(page);
  await expect(page.getByRole('link', { name: /incomplete preview/i })).toHaveAttribute(
    'href',
    'http://localhost:3000/products/argan-oil?wasilioPreview=1',
  );
  await page.getByRole('button', { name: /edit landing content/i }).click();
  await expect(page.getByRole('heading', { name: product.name })).toBeVisible();

  const fileInputs = page.locator('input[type="file"]');
  await fileInputs.nth(0).setInputFiles({
    name: 'gallery.webp',
    mimeType: 'image/webp',
    buffer: Buffer.from('RIFF____WEBPVP8 '),
  });
  await expect(page.locator('textarea[name="galleryImageUrls"]')).toHaveValue(galleryUrl);
  await expect(page.getByTestId('storefront-gallery-media-preview').locator('img')).toHaveAttribute('src', galleryUrl);
  await expect(page.getByTestId('storefront-gallery-media-preview').locator('img')).toHaveCSS('object-fit', 'contain');

  await fileInputs.nth(1).setInputFiles({
    name: 'seo.webp',
    mimeType: 'image/webp',
    buffer: Buffer.from('RIFF____WEBPVP8 '),
  });
  await expect(page.locator('input[name="seoImageUrl"]')).toHaveValue(seoUrl);
  await expect(page.getByTestId('storefront-seo-media-preview').locator('img')).toHaveAttribute('src', seoUrl);
  await expect(page.getByTestId('storefront-seo-media-preview').locator('img')).toHaveCSS('object-fit', 'contain');

  const saveRequest = page.waitForRequest((request) => (
    request.url().includes(`/api/products/${product.id}/storefront-profile`) && request.method() === 'PUT'
  ));
  await page.getByRole('button', { name: /save profile/i }).click();
  const payload = (await saveRequest).postDataJSON();

  expect(payload.galleryImageUrls).toContain(galleryUrl);
  expect(payload.seoImageUrl).toBe(seoUrl);
});

async function expectPublishingPageToStayWithinViewport(page: import('@playwright/test').Page) {
  const dimensions = await page.evaluate(() => {
    const tableRegion = document.querySelector('[data-testid="publishing-table-scroll"]');

    return {
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      tableScrollWidth: tableRegion?.scrollWidth ?? 0,
      tableClientWidth: tableRegion?.clientWidth ?? 0,
      windowScrollX: window.scrollX,
    };
  });

  expect(dimensions.windowScrollX).toBe(0);
  expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(dimensions.tableScrollWidth).toBeLessThanOrEqual(dimensions.tableClientWidth);
}

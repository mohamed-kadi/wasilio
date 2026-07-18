import { expect, test, type Page } from '@playwright/test';
import { installMockApi, loginAs } from './helpers';

test('storefront settings exposes landing-engine integration values', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installMockApi(page);

  await page.route('**/api/storefront-settings', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        storeSlug: 'first-store',
        publicName: 'First Store',
        status: 'ACTIVE',
        supportChannelType: 'whatsapp',
        supportChannelValue: '+212600000000',
        defaultCountryCode: 'MA',
        defaultCurrency: 'MAD',
        phonePattern: '^(06|07)\\\\d{8}$',
      }),
    });
  });

  await loginAs(page, 'merchant@example.com');
  await page.goto('/app/storefront/settings');

  await expect(page.getByRole('heading', { name: 'Storefront Settings' })).toBeVisible();
  await expect(page.getByText('Store status', { exact: true })).toBeVisible();
  await expect(page.getByText('Public product pages can be served')).toBeVisible();
  await expect(page.getByText('Store identity', { exact: true })).toBeVisible();
  await expect(page.getByText('Slug: first-store', { exact: true })).toBeVisible();
  await expect(page.getByText('Support contact', { exact: true })).toBeVisible();
  await expect(page.getByText('+212600000000')).toBeVisible();
  await expect(page.getByText('Checkout defaults', { exact: true })).toBeVisible();
  await expect(page.getByText('MA / MAD')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByText('Developer setup').click();

  await expect(page.getByText('Public product GET')).toBeVisible();
  await expect(page.getByText('http://localhost:8080/api/public/storefront/first-store/products/<productSlug>')).toBeVisible();
  await expect(page.getByText('Public order POST')).toBeVisible();
  await expect(page.getByText('http://localhost:8080/api/public/storefront/first-store/orders')).toBeVisible();
  await expect(page.getByText('NEXT_PUBLIC_PRODUCT_PROVIDER=wasilio')).toBeVisible();
  await expect(page.getByText('NEXT_PUBLIC_WASILIO_PUBLIC_API_BASE_URL=http://localhost:8080')).toBeVisible();
  await expect(page.getByText('NEXT_PUBLIC_WASILIO_STORE_SLUG=first-store')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

async function expectNoHorizontalOverflow(page: Page) {
  const pageFits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  expect(pageFits).toBe(true);
}

import { expect, test } from '@playwright/test';
import { installMockApi, loginAs } from './helpers';

const storefrontInboundOrderId = '11111111-1111-1111-1111-111111111111';
const linkedOrderId = '22222222-2222-2222-2222-222222222222';

test('operations UI renders a Wasilio storefront inbound order without external order ID', async ({ page }) => {
  await installMockApi(page);

  await page.route('**/api/inbound-orders?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [
          {
            inboundOrderId: storefrontInboundOrderId,
            source: 'WASILIO_STOREFRONT',
            externalOrderId: null,
            idempotencyKey: 'idem-storefront-ops-1001',
            status: 'NORMALIZED',
            receivedAt: '2026-07-03T10:00:00Z',
            normalizedOrderId: linkedOrderId,
            rejectionReason: null,
          },
        ],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      }),
    });
  });

  await page.route(`**/api/inbound-orders/${storefrontInboundOrderId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        inboundOrderId: storefrontInboundOrderId,
        source: 'WASILIO_STOREFRONT',
        externalOrderId: null,
        idempotencyKey: 'idem-storefront-ops-1001',
        status: 'NORMALIZED',
        receivedAt: '2026-07-03T10:00:00Z',
        normalizedOrderId: linkedOrderId,
        normalizedAt: '2026-07-03T10:00:05Z',
        rejectionReason: null,
        rawPayload: JSON.stringify({
          type: 'public-order-intent',
          payload: {
            customerName: 'Amina Buyer',
            city: 'Casablanca',
          },
        }),
      }),
    });
  });

  await loginAs(page, 'admin@example.com');
  await page.goto('/app/inbound-orders');

  await expect(page.getByRole('heading', { name: 'Inbound orders' })).toBeVisible();

  const storefrontRow = page.getByRole('row', { name: /Wasilio storefront/ });
  await expect(storefrontRow.getByText('No external order ID')).toBeVisible();
  await expect(storefrontRow.getByText('Key: idem-storefront-ops-1001')).toBeVisible();
  await expect(storefrontRow.getByText('Normalized')).toBeVisible();
  await expect(storefrontRow.getByRole('link', { name: '22222222...' })).toBeVisible();

  await storefrontRow.getByRole('button', { name: 'Inspect' }).click();

  await expect(page.getByText('Inbound detail')).toBeVisible();
  await expect(page.getByText('External order ID', { exact: true })).toBeVisible();
  await expect(page.getByText('public-order-intent')).toBeVisible();
  await expect(page.getByText('Amina Buyer')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open created order' })).toBeVisible();
});

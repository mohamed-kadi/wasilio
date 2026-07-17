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
            selection: {
              quantity: 1,
              product: {
                productSlug: 'coolair-mini',
              },
            },
            customer: {
              name: 'Amina Buyer',
              phone: '+212600000001',
            },
            delivery: {
              city: 'Casablanca',
              address: '12 Rue Atlas',
            },
            attribution: {
              source: 'landing-engine',
              campaign: 'phase-25',
              landingPageUrl: 'http://localhost:3000/products/coolair-mini?wasilioPreview=1',
            },
          },
          serverProductSnapshot: {
            productName: 'First Store CoolAir Mini',
            sku: 'FIRST-COOLAIR-MINI',
          },
        }),
      }),
    });
  });

  await loginAs(page, 'admin@example.com');
  await page.goto('/app/inbound-orders');

  await expect(page.getByRole('heading', { name: 'Inbound orders' })).toBeVisible();
  await expect(page.getByText('Storefront intake')).toBeVisible();
  await expect(page.getByText('1 ready for confirmation')).toBeVisible();

  const storefrontRow = page.getByRole('row', { name: /Storefront \/ landing-engine/ });
  await expect(storefrontRow.getByText('No external order ID')).toBeVisible();
  await expect(storefrontRow.getByText('Key: idem-storefront-ops-1001')).toBeVisible();
  await expect(storefrontRow.getByText('Order created')).toBeVisible();
  await expect(storefrontRow.getByText('A Wasilio order exists and can continue in the confirmation queue.')).toBeVisible();
  await expect(storefrontRow.getByRole('link', { name: 'Order detail 22222222...' })).toBeVisible();
  await expect(storefrontRow.getByRole('link', { name: 'Open confirmation' })).toBeVisible();

  await storefrontRow.getByRole('button', { name: 'Inspect' }).click();

  await expect(page.getByText('Inbound detail')).toBeVisible();
  await expect(page.getByText('Storefront handoff')).toBeVisible();
  await expect(page.getByText('Ready for confirmation', { exact: true })).toBeVisible();
  await expect(page.getByText('Order intent summary')).toBeVisible();
  await expect(page.getByText('External order ID', { exact: true })).toBeVisible();
  await expect(page.getByText('public-order-intent', { exact: true })).toBeVisible();
  await expect(page.getByText('Amina Buyer', { exact: true })).toBeVisible();
  await expect(page.getByText('First Store CoolAir Mini', { exact: true })).toBeVisible();
  await expect(page.getByText('coolair-mini', { exact: true })).toBeVisible();
  await expect(page.getByText('landing-engine / phase-25', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open order detail' })).toBeVisible();
});

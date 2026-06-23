import { expect, test } from '@playwright/test';
import { fakeJwt, installMockApi } from './helpers';

const order = {
  id: '11111111-1111-1111-1111-111111111111',
  tenantId: '00000000-0000-0000-0000-000000000001',
  status: 'CONFIRMED',
  customer: {
    firstName: 'Sara',
    lastName: 'Customer',
    email: 'sara@example.com',
    phone: '+212600000001',
  },
  address: {
    street: 'Rue Test',
    city: 'Casablanca',
    state: 'Casablanca-Settat',
    zipCode: '20000',
    country: 'Morocco',
  },
  amount: 349,
  createdAt: '2026-06-21T10:00:00Z',
  updatedAt: '2026-06-21T10:00:00Z',
  version: 1,
};

const courier = {
  courierId: '22222222-2222-2222-2222-222222222222',
  tenantId: order.tenantId,
  name: 'Amine Courier',
  phone: '+212600000002',
  active: true,
  createdAt: '2026-06-20T10:00:00Z',
};

const failedOrder = {
  ...order,
  status: 'FAILED',
  courierId: courier.courierId,
  failureReason: 'CUSTOMER_REFUSED',
  updatedAt: '2026-06-21T12:00:00Z',
};

test('merchant can understand order journey stage and next action', async ({ page }) => {
  await installMockApi(page);
  const token = fakeJwt({
    email: 'admin@example.com',
    role: 'MERCHANT',
    tenantId: '00000000-0000-0000-0000-000000000001',
  });
  await page.goto('/login');
  await page.evaluate((sessionToken) => {
    window.sessionStorage.setItem(
      'nexora.auth.session',
      JSON.stringify({
        token: sessionToken,
        user: {
          email: 'admin@example.com',
          role: 'MERCHANT',
          tenantId: '00000000-0000-0000-0000-000000000001',
          expiresAt: Date.now() + 3_600_000,
        },
      }),
    );
  }, token);

  await page.route('**/api/orders?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [order],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      }),
    });
  });

  await page.route('**/api/couriers?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [
          courier,
        ],
        page: 0,
        size: 100,
        totalElements: 1,
        totalPages: 1,
      }),
    });
  });

  await page.route('**/api/orders/search-views', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/orders/11111111-1111-1111-1111-111111111111', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(order),
    });
  });

  await page.route('**/api/orders/11111111-1111-1111-1111-111111111111/timeline', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          itemId: '33333333-3333-3333-3333-333333333333',
          source: 'DOMAIN_EVENT',
          category: 'LIFECYCLE',
          type: 'OrderConfirmed',
          title: 'Order confirmed',
          timestamp: '2026-06-21T10:05:00Z',
          actor: 'admin@example.com',
          details: {},
        },
      ]),
    });
  });

  await page.goto('/app/orders');

  await expect(page.locator('p').filter({ hasText: /^Needs confirmation$/ })).toBeVisible();
  await expect(page.getByText('Courier workflow')).toBeVisible();
  await expect(page.getByText('Closed orders')).toBeVisible();
  await expect(page.getByText('Assign courier')).toBeVisible();
  await expect(page.getByText('Assign stage')).toBeVisible();

  await page.goto('/app/orders/11111111-1111-1111-1111-111111111111');
  await expect(page).toHaveURL(/\/app\/orders\/11111111-1111-1111-1111-111111111111$/);
  await expect(page.getByText('Current COD stage', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Confirmed' })).toBeVisible();
  await expect(page.getByText('The customer accepted the order')).toBeVisible();
  await expect(page.getByText('Available actions')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Assign Courier' })).toBeDisabled();
});

test('merchant can review failed delivery recovery details', async ({ page }) => {
  await installMockApi(page);
  const token = fakeJwt({
    email: 'admin@example.com',
    role: 'MERCHANT',
    tenantId: '00000000-0000-0000-0000-000000000001',
  });
  await page.goto('/login');
  await page.evaluate((sessionToken) => {
    window.sessionStorage.setItem(
      'nexora.auth.session',
      JSON.stringify({
        token: sessionToken,
        user: {
          email: 'admin@example.com',
          role: 'MERCHANT',
          tenantId: '00000000-0000-0000-0000-000000000001',
          expiresAt: Date.now() + 3_600_000,
        },
      }),
    );
  }, token);

  await page.route('**/api/orders?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [failedOrder],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      }),
    });
  });

  await page.route('**/api/couriers?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [courier],
        page: 0,
        size: 100,
        totalElements: 1,
        totalPages: 1,
      }),
    });
  });

  await page.route('**/api/orders/search-views', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/orders/11111111-1111-1111-1111-111111111111', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(failedOrder),
    });
  });

  await page.route('**/api/orders/11111111-1111-1111-1111-111111111111/timeline', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          itemId: '44444444-4444-4444-4444-444444444444',
          source: 'DOMAIN_EVENT',
          category: 'DELIVERY',
          type: 'DeliveryFailed',
          title: 'Delivery failed',
          timestamp: '2026-06-21T12:00:00Z',
          actor: 'admin@example.com',
          details: {
            reason: 'CUSTOMER_REFUSED',
          },
        },
      ]),
    });
  });

  await page.goto('/app/orders');
  await page.getByRole('button', { name: 'Review failed deliveries' }).click();

  await expect(page.getByText('Failed delivery recovery')).toBeVisible();
  await expect(page.getByText('Reason: Customer refused')).toBeVisible();
  await expect(page.getByText('Contact customer or courier')).toBeVisible();
  await page.getByRole('link', { name: 'Open failure review' }).click();

  await expect(page).toHaveURL(/\/app\/orders\/11111111-1111-1111-1111-111111111111$/);
  await expect(page.getByRole('heading', { name: 'Failed delivery' })).toBeVisible();
  await expect(page.getByText('Failure reason: Customer refused')).toBeVisible();
  await expect(page.getByText('decide whether this needs retry')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to failed deliveries' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Review courier performance' })).toBeVisible();
});

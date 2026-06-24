import { expect, test } from '@playwright/test';
import { fakeJwt, installMockApi } from './helpers';

const courier = {
  courierId: '22222222-2222-2222-2222-222222222222',
  tenantId: '00000000-0000-0000-0000-000000000001',
  name: 'Amine Courier',
  phone: '+212600000002',
  active: true,
  createdAt: '2026-06-20T10:00:00Z',
};

test('merchant can manage courier availability and performance visibility', async ({ page }) => {
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

  await page.route('**/api/couriers?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [courier],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      }),
    });
  });

  await page.route('**/api/couriers/22222222-2222-2222-2222-222222222222', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(courier),
    });
  });

  await page.route('**/api/courier-operations/courier-performance', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          courierId: courier.courierId,
          courierName: courier.name,
          active: true,
          assignedOrdersCount: 4,
          pickedUpOrdersCount: 3,
          deliveredOrdersCount: 2,
          failedOrdersCount: 1,
          deliverySuccessRate: 0.66,
        },
      ]),
    });
  });

  await page.goto('/app/couriers');
  await expect(page.getByText('Active couriers', { exact: true })).toBeVisible();
  await expect(page.getByText('Available for new assignments')).toBeVisible();
  await expect(page.getByText('Can receive assignments')).toBeVisible();

  await page.goto('/app/couriers/22222222-2222-2222-2222-222222222222');
  await expect(page.getByText('Courier availability')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Active for assignment' })).toBeVisible();
  await expect(page.getByText('This courier can be selected')).toBeVisible();
  await expect(page.getByText('Courier profile')).toBeVisible();

  await page.goto('/app/couriers/performance');
  await expect(page.getByText('Historical assignment attempts, delivery outcomes')).toBeVisible();
  await expect(page.getByText('Assignment attempts', { exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Success rate' })).toBeVisible();
  await expect(page.getByText('Active - can receive assignments')).toBeVisible();
});

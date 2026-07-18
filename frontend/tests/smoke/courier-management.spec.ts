import { expect, test, type Page } from '@playwright/test';
import { fakeJwt, installMockApi } from './helpers';

const courier = {
  courierId: '22222222-2222-2222-2222-222222222222',
  tenantId: '00000000-0000-0000-0000-000000000001',
  name: 'Amine Courier',
  phone: '+212600000002',
  active: true,
  createdAt: '2026-06-20T10:00:00Z',
};
const failedOrderId = '11111111-1111-1111-1111-111111111111';

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

  await page.route(/\/api\/courier-operations\/courier-performance(\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('createdFrom')).toBeTruthy();
    expect(url.searchParams.get('createdTo')).toBeTruthy();
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

  await page.route(/\/api\/courier-operations\/delivery-failures\?.*$/, async (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get('courierId')).toBe(courier.courierId);
    expect(url.searchParams.get('createdFrom')).toBeTruthy();
    expect(url.searchParams.get('createdTo')).toBeTruthy();
    expect(url.searchParams.get('size')).toBe('10');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [
          {
            failure: {
              failureId: '33333333-3333-3333-3333-333333333333',
              tenantId: courier.tenantId,
              orderId: failedOrderId,
              courierId: courier.courierId,
              reason: 'CUSTOMER_UNREACHABLE',
              note: 'Customer did not answer at delivery',
              createdAt: '2026-06-25T12:00:00Z',
            },
            order: {
              orderId: failedOrderId,
              status: 'FAILED',
              customerFirstName: 'Failed',
              customerLastName: 'Customer',
              customerPhone: '0612345678',
              amount: 300,
              courierId: courier.courierId,
              failureReason: 'CUSTOMER_UNREACHABLE',
            },
          },
        ],
        page: 0,
        size: 10,
        totalElements: 1,
        totalPages: 1,
      }),
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
  await expect(page.getByText('Courier resource used across Assignment, Pickup, Delivery, and Recovery reporting.')).toBeVisible();
  await expect(page.getByText('Workflow use')).toBeVisible();
  await expect(page.getByRole('link', { name: 'View performance' })).toBeVisible();
  await expect(page.getByText('Courier profile')).toBeVisible();

  await page.goto('/app/couriers/performance');
  await expect(page.getByText('Compare couriers across Assignment, Pickup, Delivery, and Recovery')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Last 7 days' })).toBeVisible();
  await expect(page.getByText('Assignment workload', { exact: true })).toBeVisible();
  await expect(page.getByText('Recovery cases', { exact: true })).toBeVisible();
  await expect(page.getByText('Failed deliveries to review')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Workflow activity' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Delivery outcome' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Recovery action' })).toBeVisible();
  await expect(page.getByText('Active - can receive assignments')).toBeVisible();
  await expect(page.getByText('Delivered: 2')).toBeVisible();
  await expect(page.getByText('Recovery: 1')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'courier-performance-table-wrap');
  await page.getByRole('button', { name: 'Review recovery cases' }).click();
  await expect(page.getByRole('button', { name: 'Recovery cases open' })).toBeVisible();
  await expect(page.getByText('Recovery cases for review')).toBeVisible();
  await expectPanelInViewport(page, 'courier-recovery-review');
  await expect(page.getByText('Amine Courier - Last 7 days - 1 record')).toBeVisible();
  await expect(page.getByText('Failed Customer')).toBeVisible();
  await expect(page.getByText('Customer did not answer at delivery')).toBeVisible();
});

async function expectNoHorizontalOverflow(page: Page, tableTestId: string) {
  const tableFits = await page
    .getByTestId(tableTestId)
    .evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
  const pageFits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  expect(tableFits).toBe(true);
  expect(pageFits).toBe(true);
}

async function expectPanelInViewport(page: Page, testId: string) {
  await expect.poll(async () => (
    page.getByTestId(testId).evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top >= 0 && rect.top < window.innerHeight;
    })
  )).toBe(true);
}

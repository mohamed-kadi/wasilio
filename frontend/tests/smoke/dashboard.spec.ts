import { expect, test } from '@playwright/test';
import { installMockApi, loginAs } from './helpers';

test('merchant can see the operational dashboard and next queue to work', async ({ page }) => {
  await installMockApi(page);

  await page.route('**/api/confirmations/queue?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pageResponse(7)),
    });
  });

  await page.route('**/api/confirmations/callbacks?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pageResponse(2)),
    });
  });

  await page.route('**/api/courier-operations/assignment-queue?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pageResponse(3)),
    });
  });

  await page.route('**/api/courier-operations/pickup-queue?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pageResponse(4)),
    });
  });

  await page.route('**/api/courier-operations/delivery-queue?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pageResponse(5)),
    });
  });

  await page.route('**/api/orders?**', async (route) => {
    const url = new URL(route.request().url());
    const statuses = url.searchParams.getAll('status');
    const totalElements = statuses.includes('DELIVERED') ? 12 : statuses.includes('FAILED') ? 1 : 0;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pageResponse(totalElements)),
    });
  });

  await page.route('**/api/couriers?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pageResponse(0)),
    });
  });

  await page.route('**/api/orders/search-views', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await loginAs(page, 'admin@example.com');

  await expect(page.getByRole('heading', { name: 'Operations dashboard' })).toBeVisible();
  await expect(page.getByText('20 active work items across confirmation, courier flow, and delivery exceptions')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Call due callbacks' })).toBeVisible();
  await expect(page.getByText('2 customer callbacks are due now')).toBeVisible();

  await expect(page.getByText('Needs confirmation', { exact: true })).toBeVisible();
  await expect(page.getByText('2 due callbacks need attention')).toBeVisible();
  await expect(page.getByText('Awaiting courier', { exact: true })).toBeVisible();
  await expect(page.getByText('With couriers', { exact: true })).toBeVisible();
  await expect(page.getByText('4 waiting pickup, 5 out for delivery')).toBeVisible();
  await expect(page.getByText('Failed deliveries')).toBeVisible();
  await expect(page.getByText('Closed outcomes')).toBeVisible();

  await expect(page.getByText('Confirm customers')).toBeVisible();
  await expect(page.getByText('Confirmed orders without a courier')).toBeVisible();
  await expect(page.getByText('Picked up orders with couriers')).toBeVisible();

  await page.getByRole('link', { name: 'Review failures' }).click();
  await expect(page).toHaveURL(/\/app\/orders$/);
  await expect(page.getByText('Failed delivery recovery')).toBeVisible();
});

function pageResponse(totalElements: number) {
  return {
    content: [],
    page: 0,
    size: 1,
    totalElements,
    totalPages: totalElements > 0 ? 1 : 0,
  };
}

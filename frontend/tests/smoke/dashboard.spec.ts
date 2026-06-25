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

  await page.route('**/api/courier-operations/follow-ups?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pageResponse(2)),
    });
  });

  await page.route('**/api/orders?**', async (route) => {
    const url = new URL(route.request().url());
    const statuses = url.searchParams.getAll('status');
    const totalElements = statuses.includes('DELIVERED') ? 12 : statuses.includes('FAILED') ? 3 : 0;

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
  await expect(page.getByText('22 active orders need confirmation, courier movement, or recovery')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Call due callbacks' })).toBeVisible();
  await expect(page.getByText('2 customer callbacks are due now')).toBeVisible();
  await expect(page.getByText('Operations command center')).toBeVisible();

  await expect(page.getByText('Needs confirmation', { exact: true })).toBeVisible();
  await expect(page.getByText('2 due callbacks should be handled first.')).toBeVisible();
  await expect(page.getByText('Needs courier')).toBeVisible();
  await expect(page.getByText('3 need assignment. 9 are already with couriers.')).toBeVisible();
  await expect(page.getByText('Waiting pickup')).toBeVisible();
  await expect(page.getByText('Out for delivery')).toBeVisible();
  await expect(page.getByText('Failed recovery')).toBeVisible();
  await expect(page.getByText('2 failures have active customer follow-up tasks.')).toBeVisible();
  await expect(page.getByText('Delivery outcomes')).toBeVisible();
  await expect(page.getByText('Success')).toBeVisible();

  await expect(page.getByText('Operational map')).toBeVisible();
  await expect(page.getByText('Confirm', { exact: true })).toBeVisible();
  await expect(page.getByText('Assign', { exact: true })).toBeVisible();
  await expect(page.getByText('Recover', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Open follow-ups', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/delivery-follow-ups$/);
  await expect(page.getByRole('heading', { name: 'Customer follow-ups' })).toBeVisible();
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

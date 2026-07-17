import { expect, test } from '@playwright/test';
import { fakeJwt, installMockApi } from './helpers';

test('merchant can see the operational dashboard and next queue to work', async ({ page }) => {
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

  await page.route('**/api/courier-operations/orders/recovery-queue?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...pageResponse(5),
        counts: {
          all: 5,
          needsDecision: 1,
          openFollowUp: 2,
          retryReady: 1,
          refundReview: 1,
          closedUnrecoverable: 0,
        },
      }),
    });
  });

  await page.route('**/api/orders?**', async (route) => {
    const url = new URL(route.request().url());
    const statuses = url.searchParams.getAll('status');
    const totalElements = statuses.includes('DELIVERED') ? 12 : 0;

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

  await page.route('**/api/inbound-orders/summary', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        rejectedCount: 1,
        normalizedTodayCount: 4,
        latestRejectedSource: 'WASILIO_STOREFRONT',
        latestRejectedAt: '2026-07-17T10:00:00Z',
        latestRejectedReason: 'Missing customer phone',
      }),
    });
  });

  await page.goto('/app');

  await expect(page.getByRole('heading', { name: 'Operations dashboard' })).toBeVisible();
  await expect(page.getByText('24 active orders need confirmation, courier movement, or recovery')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Call due callbacks' })).toBeVisible();
  await expect(page.getByText('2 customer callbacks are due now')).toBeVisible();
  await expect(page.getByText('Operations command center')).toBeVisible();

  await expect(page.getByText('Needs confirmation', { exact: true })).toBeVisible();
  await expect(page.getByText('2 due callbacks should be handled first.')).toBeVisible();
  await expect(page.getByText('Needs courier')).toBeVisible();
  await expect(page.getByText('3 need assignment. 9 are already with couriers.')).toBeVisible();
  await expect(page.getByText('Waiting pickup')).toBeVisible();
  await expect(page.getByText('Out for delivery')).toBeVisible();
  await expect(page.getByText('Failed recovery', { exact: true })).toBeVisible();
  await expect(page.getByText('5 failed deliveries need a decision, follow-up, retry, or refund review.')).toBeVisible();
  await expect(page.getByText('Needs decision', { exact: true })).toBeVisible();
  await expect(page.getByText('Retry ready', { exact: true })).toBeVisible();
  await expect(page.getByText('Refund review', { exact: true })).toBeVisible();

  const workflow = page.getByLabel('Operations workflow');
  await expect(workflow).toBeVisible();
  await expect(workflow.getByText('Confirmation to performance')).toBeVisible();
  await expect(workflow.getByText('Confirmation', { exact: true })).toBeVisible();
  await expect(workflow.getByText('Assignment', { exact: true })).toBeVisible();
  await expect(workflow.getByText('Pickup', { exact: true })).toBeVisible();
  await expect(workflow.getByText('Delivery', { exact: true })).toBeVisible();
  await expect(workflow.getByText('Recovery', { exact: true })).toBeVisible();
  await expect(workflow.getByText('Performance', { exact: true })).toBeVisible();
  await expect(workflow.getByText('12 delivered / 5 failed')).toBeVisible();
  await expect(workflow.getByText('71%')).toBeVisible();

  await page.getByRole('link', { name: /Retry ready\s+1/ }).click();
  await expect(page).toHaveURL(/\/app\/orders$/);
  await expect(page.getByText('Failed delivery recovery')).toBeVisible();
  await expect(page.getByText('Retry ready (1)')).toBeVisible();

  await page.goto('/app');
  await page.getByRole('link', { name: 'Open follow-ups', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/delivery-follow-ups$/);
  await expect(page.getByRole('heading', { name: 'Delivery follow-ups' })).toBeVisible();
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

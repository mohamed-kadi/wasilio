import { expect, test } from '@playwright/test';
import { installMockApi, loginAs } from './helpers';

const order = {
  id: '11111111-1111-1111-1111-111111111111',
  tenantId: '00000000-0000-0000-0000-000000000001',
  status: 'CONFIRMATION_REQUESTED',
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
  intelligence: {
    confirmationConfidenceScore: 73,
    fraudRiskScore: 34,
    level: 'NEEDS_ATTENTION',
    summary: 'Review confirmation signals before progressing',
    calculatedAt: '2026-06-21T10:00:00Z',
    signals: [
      {
        key: 'complete_address',
        label: 'Address has delivery basics',
        detail: 'Street, city, and country are present.',
        confidenceDelta: 5,
        riskDelta: -3,
        severity: 'POSITIVE',
        source: 'ORDER',
      },
    ],
  },
  createdAt: '2026-06-21T10:00:00Z',
  updatedAt: '2026-06-21T10:00:00Z',
  version: 1,
};

const courier = {
  courierId: '22222222-2222-2222-2222-222222222222',
  tenantId: '00000000-0000-0000-0000-000000000001',
  name: 'Amine Courier',
  phone: '+212600000002',
  active: true,
  createdAt: '2026-06-20T10:00:00Z',
};

test('merchant can use the confirmation next-action panel', async ({ page }) => {
  await installMockApi(page);

  const attempts: Record<string, unknown>[] = [];
  let confirmed = false;

  await page.route('**/api/confirmations/queue?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: confirmed ? [] : [order],
        page: 0,
        size: 20,
        totalElements: confirmed ? 0 : 1,
        totalPages: confirmed ? 0 : 1,
      }),
    });
  });

  await page.route('**/api/confirmations/callbacks?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [],
        page: 0,
        size: 6,
        totalElements: 0,
        totalPages: 0,
      }),
    });
  });

  await page.route('**/api/orders/11111111-1111-1111-1111-111111111111/confirmation-attempts', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      attempts.push(body);
      confirmed = body.outcome === 'CONFIRMED';
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          attemptId: '22222222-2222-2222-2222-222222222222',
          orderId: order.id,
          attemptNumber: 1,
          outcome: body.outcome,
          note: body.note,
          callbackAt: body.callbackAt,
          createdBy: 'admin@example.com',
          createdAt: '2026-06-21T10:05:00Z',
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
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

  await page.route('**/api/courier-operations/assignment-queue?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: confirmed ? [{ ...order, status: 'CONFIRMED' }] : [],
        page: 0,
        size: 20,
        totalElements: confirmed ? 1 : 0,
        totalPages: confirmed ? 1 : 0,
      }),
    });
  });

  await loginAs(page, 'admin@example.com');
  await page.goto('/app/confirmations');

  await expect(page.getByRole('heading', { name: 'Confirmation Ops' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Call workspace' })).toBeVisible();
  await expect(page.getByText('Avg confidence')).toBeVisible();
  await expect(page.getByText('73/100').first()).toBeVisible();
  await expect(page.getByText('Avg risk')).toBeVisible();
  await expect(page.getByText('No order selected.')).toBeVisible();
  await expect(page.getByRole('table').getByText('Needs attention')).toBeVisible();

  await page.getByText('Sara Customer').click();
  const callWorkspace = page.getByRole('complementary');
  await expect(page.getByText('Selected order')).toBeVisible();
  await expect(callWorkspace.getByText('Review confirmation signals before progressing')).toBeVisible();
  await expect(callWorkspace.getByText('Address has delivery basics')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Call customer' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'WhatsApp' })).toBeVisible();
  await expect(page.getByText('Selected outcome')).toBeVisible();
  await expect(page.getByText('Product snapshot')).toHaveCount(0);

  await page.getByLabel('Outcome').selectOption('CONFIRMED');
  await expect(page.getByText('Customer accepted the order')).toBeVisible();
  await page.getByLabel('Note').fill('Customer confirmed address and total.');
  await page.getByRole('button', { name: /save: confirmed/i }).click();

  await expect(page.getByText('Order confirmed and moved to courier assignment')).toBeVisible();
  await expect(page.getByText('Sara Customer is no longer in')).toBeVisible();
  await page.getByRole('link', { name: 'Open assignment queue' }).click();

  await expect(page).toHaveURL(/\/app\/couriers\/assignment$/);
  await expect(page.getByText('Confirmed order ready for courier assignment')).toBeVisible();
  await expect(page.getByRole('table').getByText('From confirmation', { exact: true })).toBeVisible();
  await expect(page.getByRole('table').getByText('Sara Customer')).toBeVisible();

  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({
    outcome: 'CONFIRMED',
    note: 'Customer confirmed address and total.',
  });
});

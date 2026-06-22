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
  createdAt: '2026-06-21T10:00:00Z',
  updatedAt: '2026-06-21T10:00:00Z',
  version: 1,
};

test('merchant can use the confirmation next-action panel', async ({ page }) => {
  await installMockApi(page);

  const attempts: Record<string, unknown>[] = [];

  await page.route('**/api/confirmations/queue?**', async (route) => {
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

  await loginAs(page, 'admin@example.com');
  await page.goto('/app/confirmations');

  await expect(page.getByRole('heading', { name: 'Confirmations' })).toBeVisible();
  await expect(page.getByText('Record next attempt')).toBeVisible();
  await expect(page.getByText('Select an order from the queue.')).toBeVisible();

  await page.getByText('Sara Customer').click();
  await expect(page.getByRole('heading', { name: 'Next confirmation action' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Call customer' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'WhatsApp' })).toBeVisible();
  await expect(page.getByText('Current decision')).toBeVisible();

  await page.getByLabel('Outcome').selectOption('CONFIRMED');
  await expect(page.getByText('Customer accepted the order')).toBeVisible();
  await page.getByLabel('Note').fill('Customer confirmed address and total.');
  await page.getByRole('button', { name: /save: confirmed/i }).click();

  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({
    outcome: 'CONFIRMED',
    note: 'Customer confirmed address and total.',
  });
});

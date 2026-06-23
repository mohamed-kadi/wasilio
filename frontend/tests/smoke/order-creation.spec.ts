import { expect, test } from '@playwright/test';
import { installMockApi, loginAs } from './helpers';

const createdOrder = {
  id: '44444444-4444-4444-4444-444444444444',
  tenantId: '00000000-0000-0000-0000-000000000001',
  status: 'CREATED',
  customer: {
    firstName: 'Sara',
    lastName: 'Customer',
    email: 'sara@example.com',
    phone: '+212600000001',
  },
  address: {
    street: 'Rue Demo 12',
    city: 'Casablanca',
    state: 'Casablanca-Settat',
    zipCode: '20000',
    country: 'Morocco',
  },
  amount: 349,
  createdAt: '2026-06-23T10:00:00Z',
  updatedAt: '2026-06-23T10:00:00Z',
  version: 1,
};

test('merchant creates a COD order and continues to confirmation', async ({ page }) => {
  await installMockApi(page);
  const createRequests: Record<string, unknown>[] = [];
  let created = false;

  await page.route('**/api/orders', async (route) => {
    if (route.request().method() === 'POST') {
      createRequests.push(route.request().postDataJSON() as Record<string, unknown>);
      created = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(createdOrder.id),
      });
      return;
    }

    await route.fallback();
  });

  await page.route('**/api/confirmations/queue?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: created ? [createdOrder] : [],
        page: 0,
        size: 20,
        totalElements: created ? 1 : 0,
        totalPages: created ? 1 : 0,
      }),
    });
  });

  await page.route(`**/api/orders/${createdOrder.id}/confirmation-attempts`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await loginAs(page, 'admin@example.com');
  await page.goto('/app/orders/new');

  await expect(page.getByRole('heading', { name: 'Create COD order' })).toBeVisible();
  await expect(page.getByText('After creation, continue from the confirmation queue.')).toBeVisible();
  await expect(page.getByText('Next operational step')).toBeVisible();

  await page.getByLabel('First name').fill('Sara');
  await page.getByLabel('Last name').fill('Customer');
  await page.getByLabel('Phone / WhatsApp').fill('+212600000001');
  await page.getByLabel('Email').fill('sara@example.com');
  await page.getByLabel('Street address').fill('Rue Demo 12');
  await page.getByRole('button', { name: 'Casablanca' }).click();
  await page.getByLabel('Amount to collect (MAD)').fill('349');
  await page.getByRole('button', { name: /create and confirm next/i }).click();

  await expect(page).toHaveURL(/\/app\/confirmations$/);
  await expect(page.getByRole('heading', { name: 'Confirmations' })).toBeVisible();
  await expect(page.getByText('New order ready for confirmation')).toBeVisible();
  await expect(page.getByRole('table').getByText('Sara Customer')).toBeVisible();
  await expect(page.getByText('Start here')).toBeVisible();
  await expect(page.getByText('Start confirmation call')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Next confirmation action' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Call customer' })).toBeVisible();

  expect(createRequests).toHaveLength(1);
  expect(createRequests[0]).toMatchObject({
    customer: {
      firstName: 'Sara',
      lastName: 'Customer',
      email: 'sara@example.com',
      phone: '+212600000001',
    },
    address: {
      street: 'Rue Demo 12',
      city: 'Casablanca',
      state: 'Casablanca-Settat',
      zipCode: '20000',
      country: 'Morocco',
    },
    amount: 349,
  });
});

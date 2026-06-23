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

const baseOrder = {
  id: '11111111-1111-1111-1111-111111111111',
  tenantId: '00000000-0000-0000-0000-000000000001',
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
  courierId: courier.courierId,
  createdAt: '2026-06-21T10:00:00Z',
  updatedAt: '2026-06-21T10:00:00Z',
  version: 1,
};

test('merchant can read courier workflow stages across queues', async ({ page }) => {
  await installMockApi(page);
  const assignments: Record<string, unknown>[] = [];
  const pickups: Record<string, unknown>[] = [];
  const deliveredOrders: string[] = [];
  let assigned = false;
  let pickedUp = false;
  let delivered = false;
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
      body: JSON.stringify(assigned ? emptyPage() : pageResponse({ ...baseOrder, status: 'CONFIRMED', courierId: undefined })),
    });
  });

  await page.route('**/api/courier-operations/pickup-queue?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(assigned && !pickedUp ? pageResponse({ ...baseOrder, status: 'ASSIGNED_TO_COURIER' }) : emptyPage()),
    });
  });

  await page.route('**/api/orders/11111111-1111-1111-1111-111111111111/assign-courier', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    assignments.push(body);
    assigned = true;
    await route.fulfill({ status: 204 });
  });

  await page.route('**/api/orders/11111111-1111-1111-1111-111111111111/pick-up', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    pickups.push(body);
    pickedUp = true;
    await route.fulfill({ status: 204 });
  });

  await page.route('**/api/courier-operations/delivery-queue?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pickedUp && !delivered ? pageResponse({ ...baseOrder, status: 'PICKED_UP' }) : emptyPage()),
    });
  });

  await page.route('**/api/courier-operations/orders/11111111-1111-1111-1111-111111111111/deliver', async (route) => {
    deliveredOrders.push(baseOrder.id);
    delivered = true;
    await route.fulfill({ status: 204 });
  });

  await page.goto('/app/couriers/assignment');
  await expect(page.getByRole('heading', { name: 'Courier assignment' })).toBeVisible();
  await expect(page.getByText('Assign a courier to move the order into pickup.')).toBeVisible();
  await expect(page.getByText('Select courier and assign for pickup')).toBeVisible();
  await page.getByRole('combobox').filter({ hasText: 'Select courier' }).selectOption(courier.courierId);
  await page.getByRole('button', { name: 'Assign' }).click();
  await expect(page.getByText('Order assigned and moved to pickup')).toBeVisible();
  await expect(page.getByText('Sara Customer is assigned to Amine Courier')).toBeVisible();
  await page.getByRole('link', { name: 'Open pickup queue' }).click();

  await expect(page).toHaveURL(/\/app\/couriers\/pickup$/);
  await expect(page.getByRole('heading', { name: 'Pickup confirmation' })).toBeVisible();
  await expect(page.getByText('Assigned order ready for pickup confirmation')).toBeVisible();
  await expect(page.getByRole('table').getByText('From assignment', { exact: true })).toBeVisible();
  await expect(page.getByText('Mark picked up to move the order into delivery.')).toBeVisible();
  await expect(page.getByText('Confirm package pickup')).toBeVisible();
  await page.getByRole('button', { name: 'Picked up' }).click();
  await expect(page.getByText('Order picked up and moved to delivery')).toBeVisible();
  await expect(page.getByText('Sara Customer is with Amine Courier')).toBeVisible();
  await page.getByRole('link', { name: 'Open delivery queue' }).click();

  await expect(page).toHaveURL(/\/app\/couriers\/delivery$/);
  await expect(page.getByRole('heading', { name: 'Delivery outcome' })).toBeVisible();
  await expect(page.getByText('Picked up order ready for delivery outcome')).toBeVisible();
  await expect(page.getByRole('table').getByText('From pickup', { exact: true })).toBeVisible();
  await expect(page.getByText('Choose delivered or document the failure reason.')).toBeVisible();
  await expect(page.getByText('Record delivery result')).toBeVisible();
  await expect(page.getByRole('combobox').filter({ hasText: 'Customer refused' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Delivered' }).click();
  expect(deliveredOrders).toHaveLength(0);
  await expect(page.getByText('Are you sure this delivery should be marked delivered?')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Are you sure this delivery should be marked delivered?')).toBeHidden();
  await page.getByRole('button', { name: 'Delivered' }).click();
  await page.getByRole('button', { name: 'Yes, mark delivered' }).click();
  await expect.poll(() => deliveredOrders.length).toBe(1);

  expect(assignments).toHaveLength(1);
  expect(assignments[0]).toMatchObject({
    courierId: courier.courierId,
  });
  expect(pickups).toHaveLength(1);
  expect(pickups[0]).toMatchObject({
    courierId: courier.courierId,
  });
});

function pageResponse(order: Record<string, unknown>) {
  return {
    content: [order],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
  };
}

function emptyPage() {
  return {
    content: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  };
}

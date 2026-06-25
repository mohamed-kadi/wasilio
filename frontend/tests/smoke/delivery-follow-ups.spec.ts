import { expect, test } from '@playwright/test';
import { installMockApi, loginAs } from './helpers';

const firstOrderId = '11111111-1111-1111-1111-111111111111';
const secondOrderId = '22222222-2222-2222-2222-222222222222';

test('merchant can work open delivery follow-ups by due date', async ({ page }) => {
  await installMockApi(page);

  const followUps = [
    followUpTask({
      taskId: 'follow-up-later',
      orderId: secondOrderId,
      note: 'Call customer about replacement delivery window',
      dueAt: '2026-06-27T10:00:00Z',
    }),
    followUpTask({
      taskId: 'follow-up-overdue',
      orderId: firstOrderId,
      note: 'Refund must be confirmed with customer',
      dueAt: '2026-06-24T10:00:00Z',
    }),
  ];
  const resolveRequests: Array<Record<string, unknown>> = [];

  await page.route('**/api/courier-operations/follow-ups?**', async (route) => {
    const openTasks = followUps
      .filter((task) => task.status === 'OPEN')
      .sort((left, right) => String(left.dueAt).localeCompare(String(right.dueAt)));

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: openTasks,
        page: 0,
        size: 10,
        totalElements: openTasks.length,
        totalPages: openTasks.length > 0 ? 1 : 0,
      }),
    });
  });

  await page.route(`**/api/orders/${firstOrderId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(order(firstOrderId, 'Earlier', 'Customer')),
    });
  });

  await page.route(`**/api/orders/${secondOrderId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(order(secondOrderId, 'Later', 'Customer')),
    });
  });

  await page.route('**/api/courier-operations/orders/**/follow-ups/**/resolve', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    resolveRequests.push(body);
    const urlParts = new URL(route.request().url()).pathname.split('/');
    const taskId = urlParts[urlParts.length - 2];
    const task = followUps.find((currentTask) => currentTask.taskId === taskId);
    if (task) {
      task.status = 'RESOLVED';
      task.resolvedAt = '2026-06-25T12:00:00Z';
      task.resolvedBy = 'admin@example.com';
      task.resolutionNote = typeof body.note === 'string' ? body.note : undefined;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(task),
    });
  });

  await loginAs(page, 'admin@example.com');
  await page.goto('/app/delivery-follow-ups');

  await expect(page.getByRole('heading', { name: 'Customer follow-ups' })).toBeVisible();
  await expect(page.getByText('Open follow-up queue')).toBeVisible();
  await expect(page.locator('article')).toHaveCount(2);
  await expect(page.locator('article').first()).toContainText('Overdue');
  await expect(page.locator('article').first()).toContainText('Earlier Customer');
  await expect(page.locator('article').last()).toContainText('Later Customer');

  await page.locator('article').first().getByPlaceholder('Optional note, e.g. refund sent or customer reached').fill('Refund confirmed with customer');
  await page.locator('article').first().getByRole('button', { name: 'Resolve follow-up' }).click();

  await expect.poll(() => resolveRequests.length).toBe(1);
  expect(resolveRequests[0]).toEqual({ note: 'Refund confirmed with customer' });
  await expect(page.locator('article')).toHaveCount(1);
  await expect(page.getByText('Later Customer')).toBeVisible();
  await expect(page.getByText('Earlier Customer')).not.toBeVisible();
});

function followUpTask({
  taskId,
  orderId,
  note,
  dueAt,
}: {
  taskId: string;
  orderId: string;
  note: string;
  dueAt: string;
}) {
  return {
    taskId,
    tenantId: '00000000-0000-0000-0000-000000000001',
    orderId,
    recoveryId: `recovery-${taskId}`,
    status: 'OPEN',
    note,
    dueAt,
    assignedTo: 'admin@example.com',
    createdAt: '2026-06-23T10:00:00Z',
  };
}

function order(id: string, firstName: string, lastName: string) {
  return {
    id,
    tenantId: '00000000-0000-0000-0000-000000000001',
    status: 'FAILED',
    customer: {
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}@example.com`,
      phone: '0612345678',
    },
    address: {
      street: '1 Main St',
      city: 'Casablanca',
      state: 'Casablanca-Settat',
      zipCode: '20000',
      country: 'Morocco',
    },
    amount: 250,
    courierId: '33333333-3333-3333-3333-333333333333',
    failureReason: 'CUSTOMER_REFUSED',
    createdAt: '2026-06-20T10:00:00Z',
    updatedAt: '2026-06-24T10:00:00Z',
    version: 4,
  };
}

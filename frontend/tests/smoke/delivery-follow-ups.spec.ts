import { expect, test } from '@playwright/test';
import { installMockApi, loginAs } from './helpers';

const firstOrderId = '11111111-1111-1111-1111-111111111111';
const secondOrderId = '22222222-2222-2222-2222-222222222222';
const thirdOrderId = '33333333-3333-3333-3333-333333333333';

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
    followUpTask({
      taskId: 'follow-up-no-date',
      orderId: thirdOrderId,
      note: 'Customer unreachable after three attempts',
    }),
  ];
  const resolveRequests: Array<Record<string, unknown>> = [];
  let orderDetailRequests = 0;

  await page.route('**/api/courier-operations/follow-ups?**', async (route) => {
    const url = new URL(route.request().url());
    const dueFilter = url.searchParams.get('dueFilter') ?? 'ALL';
    const pageNumber = Number(url.searchParams.get('page') ?? '0');
    const size = Number(url.searchParams.get('size') ?? '10');
    const now = new Date('2026-06-25T12:00:00Z').getTime();
    const openTasks = followUps
      .filter((task) => task.status === 'OPEN')
      .filter((task) => {
        if (dueFilter === 'DUE_NOW') {
          return Boolean(task.dueAt) && new Date(task.dueAt).getTime() <= now;
        }
        if (dueFilter === 'SCHEDULED') {
          return Boolean(task.dueAt) && new Date(task.dueAt).getTime() > now;
        }
        if (dueFilter === 'NO_DUE_DATE') {
          return !task.dueAt;
        }
        return true;
      })
      .sort((left, right) => {
        if (!left.dueAt && !right.dueAt) return left.createdAt.localeCompare(right.createdAt);
        if (!left.dueAt) return 1;
        if (!right.dueAt) return -1;
        return left.dueAt.localeCompare(right.dueAt);
      });
    const pagedTasks = openTasks.slice(pageNumber * size, pageNumber * size + size);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: pagedTasks.map((task) => ({
          task,
          order: orderSummary(task.orderId),
        })),
        page: pageNumber,
        size,
        totalElements: openTasks.length,
        totalPages: openTasks.length > 0 ? Math.ceil(openTasks.length / size) : 0,
      }),
    });
  });

  await page.route(/\/api\/orders\/[0-9a-f-]{36}$/, async (route) => {
    orderDetailRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
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
  await expect(page.getByRole('button', { name: /All open \(3\)/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Due now \(1\)/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Scheduled \(1\)/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /No due date \(1\)/ })).toBeVisible();
  await expect(page.locator('article')).toHaveCount(3);
  await expect(page.locator('article').first()).toContainText('Overdue');
  await expect(page.locator('article').first()).toContainText('Earlier Customer');
  await expect(page.locator('article').nth(1)).toContainText('Later Customer');
  await expect(page.locator('article').last()).toContainText('Manual Customer');
  expect(orderDetailRequests).toBe(0);

  await page.getByRole('button', { name: /Due now \(1\)/ }).click();
  await expect(page.locator('article')).toHaveCount(1);
  await expect(page.locator('article')).toContainText('Earlier Customer');

  await page.getByRole('button', { name: /Scheduled \(1\)/ }).click();
  await expect(page.locator('article')).toHaveCount(1);
  await expect(page.locator('article')).toContainText('Later Customer');

  await page.getByRole('button', { name: /No due date \(1\)/ }).click();
  await expect(page.locator('article')).toHaveCount(1);
  await expect(page.locator('article')).toContainText('Manual Customer');

  await page.getByRole('button', { name: /All open \(3\)/ }).click();
  await expect(page.locator('article')).toHaveCount(3);
  await page.locator('article').first().getByPlaceholder('Optional note, e.g. refund sent or customer reached').fill('Refund confirmed with customer');
  await page.locator('article').first().getByRole('button', { name: 'Resolve follow-up' }).click();

  await expect.poll(() => resolveRequests.length).toBe(1);
  expect(resolveRequests[0]).toEqual({ note: 'Refund confirmed with customer' });
  await expect(page.locator('article')).toHaveCount(2);
  await expect(page.getByText('Later Customer')).toBeVisible();
  await expect(page.getByText('Manual Customer')).toBeVisible();
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
  dueAt?: string;
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

function orderSummary(orderId: string) {
  const firstName = orderId === firstOrderId ? 'Earlier' : orderId === secondOrderId ? 'Later' : 'Manual';
  const lastName = 'Customer';
  return {
    orderId,
    status: 'FAILED',
    customerFirstName: firstName,
    customerLastName: lastName,
    customerPhone: '0612345678',
    amount: 250,
    courierId: '33333333-3333-3333-3333-333333333333',
    failureReason: 'CUSTOMER_REFUSED',
  };
}

import { expect, test } from '@playwright/test';
import { installMockApi, loginAs } from './helpers';

test('staff plans section keeps plan review compact and create flow collapsed', async ({ page }) => {
  await installMockApi(page);

  const plans = [
    {
      planId: '10000000-0000-0000-0000-000000000001',
      code: 'starter',
      name: 'Starter',
      monthlyPrice: 299,
      currency: 'MAD',
      orderLimit: 500,
      userLimit: 3,
      active: true,
      createdAt: '2026-07-01T10:00:00Z',
      updatedAt: '2026-07-01T10:00:00Z',
    },
    {
      planId: '10000000-0000-0000-0000-000000000002',
      code: 'growth',
      name: 'Growth',
      monthlyPrice: 699,
      currency: 'MAD',
      orderLimit: 2000,
      userLimit: 10,
      active: true,
      createdAt: '2026-07-01T10:00:00Z',
      updatedAt: '2026-07-01T10:00:00Z',
    },
    {
      planId: '10000000-0000-0000-0000-000000000003',
      code: 'legacy',
      name: 'Legacy',
      monthlyPrice: 199,
      currency: 'MAD',
      orderLimit: 250,
      userLimit: 2,
      active: false,
      createdAt: '2026-07-01T10:00:00Z',
      updatedAt: '2026-07-01T10:00:00Z',
    },
  ];
  const creates: Record<string, unknown>[] = [];

  await page.route('**/api/admin/plans', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      creates.push(body);
      const createdPlan = {
        planId: '10000000-0000-0000-0000-000000000004',
        code: String(body.code),
        name: String(body.name),
        monthlyPrice: Number(body.monthlyPrice),
        currency: String(body.currency),
        orderLimit: Number(body.orderLimit),
        userLimit: Number(body.userLimit),
        active: true,
        createdAt: '2026-07-18T12:00:00Z',
        updatedAt: '2026-07-18T12:00:00Z',
      };
      plans.push(createdPlan);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(createdPlan),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(plans),
    });
  });

  await loginAs(page, 'superadmin@example.com');
  await page.getByRole('link', { name: /plans/i }).click();

  await expect(page).toHaveURL(/section=plans/);
  await expect(page.getByRole('heading', { name: 'Subscription Plans' })).toBeVisible();
  await expect(page.getByText('Active plans', { exact: true })).toBeVisible();
  await expect(page.getByText('Archived plans', { exact: true })).toBeVisible();
  await expect(page.getByText('299 MAD')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Legacy' })).toBeVisible();
  await expect(page.getByText('Archived', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Code')).toBeHidden();

  await page.getByRole('button', { name: /create plan/i }).click();
  await page.getByLabel('Code').fill('pilot');
  await page.getByLabel('Name').fill('Pilot');
  await page.getByLabel('Price').fill('399');
  await page.getByLabel('Currency').fill('MAD');
  await page.getByLabel('Order limit').fill('800');
  await page.getByLabel('Team seats').fill('4');
  await page.locator('form').getByRole('button', { name: /^create plan$/i }).click();

  await expect(page.getByRole('heading', { name: 'Pilot' })).toBeVisible();
  await expect(page.getByLabel('Code')).toBeHidden();
  expect(creates).toHaveLength(1);
  expect(creates[0]).toMatchObject({
    code: 'pilot',
    name: 'Pilot',
    monthlyPrice: 399,
    currency: 'MAD',
    orderLimit: 800,
    userLimit: 4,
  });
});

import { expect, test } from '@playwright/test';
import { installMockApi, loginAs } from './helpers';

test('super admin can update marketing lead follow-up status', async ({ page }) => {
  await installMockApi(page);

  let lead = {
    leadId: '11111111-1111-1111-1111-111111111111',
    contactName: 'Sara Admin',
    storeName: 'Casa Beauty',
    phone: '+212600000001',
    email: 'sara@example.com',
    city: 'Casablanca',
    monthlyOrderVolume: '100-500/month',
    message: 'Callbacks are hard to track.',
    campaignSource: 'utm_source=facebook&utm_campaign=pilot',
    status: 'NEW',
    nextFollowUpAt: null,
    internalNotes: null,
    createdAt: '2026-06-11T12:00:00Z',
  };

  const updates: Record<string, unknown>[] = [];

  await page.route('**/api/marketing/leads/11111111-1111-1111-1111-111111111111/follow-up', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    updates.push(body);
    lead = { ...lead, ...body };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(lead),
    });
  });

  await page.route('**/api/marketing/leads', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([lead]),
    });
  });

  await loginAs(page, 'superadmin@example.com');
  await page.getByRole('button', { name: /leads/i }).click();

  await expect(page.getByText('Casa Beauty')).toBeVisible();
  await expect(page.getByText('utm_source=facebook&utm_campaign=pilot')).toBeVisible();

  await page.getByLabel('Lead status').selectOption('CONTACTED');
  await page.getByLabel('Internal notes').fill('Reached on WhatsApp. Interested in pilot.');
  await page.getByRole('button', { name: /save follow-up/i }).click();

  await expect(page.locator('span').filter({ hasText: 'CONTACTED' })).toBeVisible();
  expect(updates).toHaveLength(1);
  expect(updates[0]).toMatchObject({
    status: 'CONTACTED',
    internalNotes: 'Reached on WhatsApp. Interested in pilot.',
  });
});

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
    convertedTenantId: null,
    convertedAt: null,
    createdAt: '2026-06-11T12:00:00Z',
  };

  const updates: Record<string, unknown>[] = [];
  const conversions: Record<string, unknown>[] = [];

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

  await page.route('**/api/marketing/leads/11111111-1111-1111-1111-111111111111/convert-to-tenant', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    conversions.push(body);
    lead = {
      ...lead,
      status: 'ONBOARDED',
      convertedTenantId: '22222222-2222-2222-2222-222222222222',
      convertedAt: '2026-06-11T13:00:00Z',
      internalNotes: body.internalNotes as string,
    };
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        lead,
        tenant: {
          tenantId: '22222222-2222-2222-2222-222222222222',
          tenantName: body.tenantName,
          workspaceId: '22222222-2222-2222-2222-222222222222',
          workspaceName: body.tenantName,
          adminUserId: '33333333-3333-3333-3333-333333333333',
          adminEmail: body.adminEmail,
          adminRole: 'ADMIN',
        },
      }),
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

  await page.getByRole('button', { name: 'Convert' }).click();
  await page.getByLabel('Tenant name').fill('Casa Beauty Pilot');
  await page.getByLabel('Admin email').fill('sara.admin@example.com');
  await page.getByLabel('Initial password').fill('PilotPass123!');
  await page.getByLabel('Conversion notes').fill('Free guided onboarding offered.');
  await page.getByRole('button', { name: /create trial tenant/i }).click();

  await expect(page.locator('span').filter({ hasText: 'ONBOARDED' })).toBeVisible();
  await expect(page.getByText(/Lead converted to a trial tenant/i)).toBeVisible();
  expect(conversions).toHaveLength(1);
  expect(conversions[0]).toMatchObject({
    tenantName: 'Casa Beauty Pilot',
    adminEmail: 'sara.admin@example.com',
    internalNotes: 'Free guided onboarding offered.',
  });
});

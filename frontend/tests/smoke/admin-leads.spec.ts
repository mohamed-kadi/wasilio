import { expect, test } from '@playwright/test';
import { installMockApi, loginAs } from './helpers';

test('super admin can update demo request follow-up status', async ({ page }) => {
  await installMockApi(page);

  const campaignLeadId = '11111111-1111-1111-1111-111111111111';
  const organicLeadId = '99999999-9999-9999-9999-999999999999';
  const organicLead = {
    leadId: organicLeadId,
    contactName: 'Youssef Admin',
    storeName: 'Organic Store',
    phone: '+212600000009',
    email: 'youssef@example.com',
    city: 'Rabat',
    monthlyOrderVolume: 'Under 100/month',
    message: 'Need to understand pricing.',
    campaignSource: null,
    status: 'NEW',
    nextFollowUpAt: null,
    internalNotes: null,
    convertedTenantId: null,
    convertedAt: null,
    createdAt: '2026-06-11T13:00:00Z',
  };
  let lead = {
    leadId: '11111111-1111-1111-1111-111111111111',
    contactName: 'Sara Admin',
    storeName: 'Casa Beauty',
    phone: '+212600000001',
    email: 'sara@example.com',
    city: 'Casablanca',
    monthlyOrderVolume: '100-500/month',
    message: 'Callbacks are hard to track.',
    campaignSource: 'utm_source=facebook&utm_medium=paid_social&utm_campaign=pilot&fbclid=fb-123&ref=instagram&referrer=https%3A%2F%2Fwww.instagram.com%2Fads',
    status: 'NEW',
    nextFollowUpAt: null,
    internalNotes: null,
    convertedTenantId: null,
    convertedAt: null,
    createdAt: '2026-06-11T12:00:00Z',
  };
  let leads = [organicLead, lead];

  const updates: Record<string, unknown>[] = [];
  const conversions: Record<string, unknown>[] = [];

  await page.route(`**/api/marketing/leads/${campaignLeadId}/follow-up`, async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    updates.push(body);
    lead = { ...lead, ...body };
    leads = leads.map((currentLead) => currentLead.leadId === campaignLeadId ? lead : currentLead);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(lead),
    });
  });

  await page.route(`**/api/marketing/leads/${campaignLeadId}/convert-to-tenant`, async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    conversions.push(body);
    lead = {
      ...lead,
      status: 'ONBOARDED',
      convertedTenantId: '22222222-2222-2222-2222-222222222222',
      convertedAt: '2026-06-11T13:00:00Z',
      internalNotes: body.internalNotes as string,
    };
    leads = leads.map((currentLead) => currentLead.leadId === campaignLeadId ? lead : currentLead);
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
      body: JSON.stringify(leads),
    });
  });

  await loginAs(page, 'superadmin@example.com');
  await page.getByRole('link', { name: /^Demo Requests$/i }).click();

  const leadCards = page.getByRole('article').filter({ hasText: /Casa Beauty|Organic Store/ });
  await expect(leadCards.first()).toContainText('Casa Beauty');
  const leadCard = page.getByRole('article').filter({ hasText: 'Casa Beauty' });

  await expect(leadCard.getByText('CAMPAIGN REQUEST')).toBeVisible();
  await expect(leadCard.getByText('PRIORITY FOLLOW-UP')).toBeVisible();
  await expect(leadCard.getByText('Next action')).toBeVisible();
  await expect(leadCard.getByText('Review paid request')).toBeVisible();
  await expect(leadCard.getByText('Campaign attribution')).toBeVisible();
  await expect(leadCard.getByText('Paid signal')).toBeVisible();
  await expect(leadCard.getByText('Source', { exact: true })).toBeVisible();
  await expect(leadCard.getByText('facebook', { exact: true })).toBeVisible();
  await expect(leadCard.getByText('Medium', { exact: true })).toBeVisible();
  await expect(leadCard.getByText('paid_social', { exact: true })).toBeVisible();
  await expect(leadCard.getByText('Campaign', { exact: true })).toBeVisible();
  await expect(leadCard.getByText('pilot', { exact: true })).toBeVisible();
  await expect(leadCard.getByText('Facebook click ID', { exact: true })).toBeVisible();
  await expect(leadCard.getByText('fb-123', { exact: true })).toBeVisible();
  await expect(leadCard.getByText('Ref', { exact: true })).toBeVisible();
  await expect(leadCard.getByText('instagram', { exact: true })).toBeVisible();
  await expect(leadCard.getByText('Referrer', { exact: true })).toBeVisible();
  await expect(leadCard.getByText('instagram.com', { exact: true })).toBeVisible();
  await expect(page.getByText('Campaign requests and due follow-ups are shown first.')).toBeVisible();
  await expect(page.getByText('1 new paid/campaign request')).toBeVisible();
  await expect(page.getByRole('button', { name: /Campaign 1/i })).toBeVisible();
  await expect(page.getByText('Open requests')).toBeVisible();
  await expect(page.getByRole('button', { name: /New request 2/i })).toBeVisible();
  await expect(leadCard.getByRole('link', { name: 'WhatsApp' })).toBeVisible();

  await leadCard.getByLabel('Request status').selectOption('CONTACTED');
  await leadCard.getByLabel('Internal notes').fill('Reached on WhatsApp. Interested in pilot.');
  await leadCard.getByRole('button', { name: /save follow-up/i }).click();

  await expect(leadCard.locator('span').filter({ hasText: /^Contacted$/ })).toBeVisible();
  expect(updates).toHaveLength(1);
  expect(updates[0]).toMatchObject({
    status: 'CONTACTED',
    internalNotes: 'Reached on WhatsApp. Interested in pilot.',
  });

  await leadCard.getByRole('button', { name: 'Convert' }).click();
  await leadCard.getByLabel('Store / business name').fill('Casa Beauty Pilot');
  await leadCard.getByLabel('Merchant owner email').fill('sara.admin@example.com');
  await leadCard.getByLabel('Conversion notes').fill('Free guided onboarding offered.');
  await leadCard.getByRole('button', { name: /create pilot workspace/i }).click();

  await expect(leadCard.locator('span').filter({ hasText: /^Workspace created$/ })).toBeVisible();
  await expect(page.getByText(/Demo request converted to a pilot workspace/i)).toBeVisible();
  expect(conversions).toHaveLength(1);
  expect(conversions[0]).toMatchObject({
    tenantName: 'Casa Beauty Pilot',
    adminEmail: 'sara.admin@example.com',
    internalNotes: 'Free guided onboarding offered.',
  });
  expect(conversions[0]).not.toHaveProperty('password');
});

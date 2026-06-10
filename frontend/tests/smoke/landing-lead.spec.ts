import { expect, test } from '@playwright/test';
import { installMockApi } from './helpers';

test('public landing captures a demo lead with campaign source', async ({ page }) => {
  await installMockApi(page);

  const leadRequests: Record<string, unknown>[] = [];
  await page.route('**/api/marketing/leads', async (route) => {
    leadRequests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        leadId: '11111111-1111-1111-1111-111111111111',
        createdAt: new Date().toISOString(),
        ...leadRequests[0],
      }),
    });
  });

  await page.goto('/?utm_source=facebook&utm_campaign=pilot');
  await expect(page.getByRole('heading', { name: /Wasilio turns WhatsApp/i })).toBeVisible();

  await page.getByLabel('Contact name').fill('Sara Admin');
  await page.getByLabel('Store name').fill('Casa Beauty');
  await page.getByLabel('Phone / WhatsApp').fill('+212600000001');
  await page.getByLabel('Email').fill('sara@example.com');
  await page.getByLabel('City').fill('Casablanca');
  await page.getByLabel('What is hard about your current COD workflow?').fill('Callbacks are hard to track.');
  await page.getByRole('button', { name: /request demo/i }).click();

  await expect(page.getByText(/Demo request received/i)).toBeVisible();
  expect(leadRequests).toHaveLength(1);
  expect(leadRequests[0]).toMatchObject({
    contactName: 'Sara Admin',
    storeName: 'Casa Beauty',
    campaignSource: 'utm_source=facebook&utm_campaign=pilot',
  });
});

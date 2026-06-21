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
        status: 'NEW',
        nextFollowUpAt: null,
        internalNotes: null,
        convertedTenantId: null,
        convertedAt: null,
        ...leadRequests[0],
      }),
    });
  });

  await page.goto('/?utm_source=facebook&utm_campaign=pilot');
  await expect(page.getByRole('heading', { name: /Arretez de perdre des commandes COD/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'العربية' })).toBeVisible();

  await page.getByLabel('Nom du contact').fill('Sara Admin');
  await page.getByLabel('Nom de la boutique').fill('Casa Beauty');
  await page.getByLabel('Telephone / WhatsApp').fill('+212600000001');
  await page.getByLabel('Email').fill('sara@example.com');
  await page.getByLabel('Ville').fill('Casablanca');
  await page.getByLabel('Quel est votre plus gros probleme de confirmation aujourd hui ?').fill('Callbacks are hard to track.');
  await page.getByRole('button', { name: /demander la demo/i }).click();

  await expect(page.getByText(/Demande recue/i)).toBeVisible();
  expect(leadRequests).toHaveLength(1);
  expect(leadRequests[0]).toMatchObject({
    contactName: 'Sara Admin',
    storeName: 'Casa Beauty',
    campaignSource: 'utm_source=facebook&utm_campaign=pilot',
  });
});

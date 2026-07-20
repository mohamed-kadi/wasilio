import { expect, test, type Page } from '@playwright/test';

test('merchant can create an account from signup', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const onboardingRequests: Array<Record<string, unknown>> = [];

  await page.route('**/api/onboarding/tenants', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    onboardingRequests.push(body);

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        tenantId: '00000000-0000-0000-0000-000000000001',
        tenantName: body.tenantName,
        adminUserId: '11111111-1111-1111-1111-111111111111',
        adminEmail: body.adminEmail,
      }),
    });
  });

  await page.goto('/signup');

  await expect(page.getByRole('heading', { name: 'Create merchant account' })).toBeVisible();
  await expect(page.getByText('Set up Wasilio access for your store operations.')).toBeVisible();
  await expect(page.getByText('Workspace', { exact: true })).toBeVisible();
  await expect(page.getByText('Contact', { exact: true })).toBeVisible();
  await expect(page.getByText('Security', { exact: true })).toBeVisible();
  await expect(page.getByText('Name the store your team will manage.')).toBeVisible();
  await expect(page.getByText('Add the person who signs in first.')).toBeVisible();
  await expect(page.getByText('Create a strong password for this account.')).toBeVisible();
  await expect(page.getByText('Merchant owner', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Store name needed')).toHaveCount(0);
  await expect(page.getByText('Owner email needed')).toHaveCount(0);
  await expect(page.getByText('Password rules pending')).toHaveCount(0);
  await expect(page.getByText('Direct signup is for approved merchants')).toHaveCount(0);
  await expect(page.getByText('Password requirements')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByLabel('Store / business name').fill('Atlas Shop');
  await page.getByLabel('Merchant full name').fill('Admin User');
  await page.getByLabel('Merchant email').fill('admin@example.com');
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('Str0ng!Password2026');
  await page.getByLabel('Confirm password').fill('Str0ng!Password2026');

  await expect(page.getByText('At least 12 characters')).toBeVisible();
  await expect(page.getByText('Uppercase and lowercase letters')).toBeVisible();
  await expect(page.getByText('Number and symbol')).toBeVisible();
  await expect(page.getByText('Passwords match')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('button', { name: /create account/i }).click();

  await expect.poll(() => onboardingRequests.length).toBe(1);
  expect(onboardingRequests[0]).toMatchObject({
    tenantName: 'Atlas Shop',
    adminName: 'Admin User',
    adminEmail: 'admin@example.com',
    password: 'Str0ng!Password2026',
  });
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Account created. Sign in to continue.')).toBeVisible();
});

async function expectNoHorizontalOverflow(page: Page) {
  const pageFits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  expect(pageFits).toBe(true);
}

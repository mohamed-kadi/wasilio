import { expect, test, type Page } from '@playwright/test';

test('merchant can create the first workspace from signup', async ({ page }) => {
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

  await expect(page.getByRole('heading', { name: 'Create store workspace' })).toBeVisible();
  await expect(page.getByText('Workspace', { exact: true })).toBeVisible();
  await expect(page.getByText('Main admin', { exact: true })).toBeVisible();
  await expect(page.getByText('Password readiness')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByLabel('Store / business name').fill('Atlas Shop');
  await page.getByLabel('Main admin full name').fill('Admin User');
  await page.getByLabel('Main admin email').fill('admin@example.com');
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('Str0ng!Password2026');
  await page.getByLabel('Confirm password').fill('Str0ng!Password2026');

  await expect(page.getByText('At least 12 characters')).toBeVisible();
  await expect(page.getByText('Uppercase and lowercase letters')).toBeVisible();
  await expect(page.getByText('Number and symbol')).toBeVisible();
  await expect(page.getByText('Passwords match')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('button', { name: /create workspace/i }).click();

  await expect.poll(() => onboardingRequests.length).toBe(1);
  expect(onboardingRequests[0]).toMatchObject({
    tenantName: 'Atlas Shop',
    adminName: 'Admin User',
    adminEmail: 'admin@example.com',
    password: 'Str0ng!Password2026',
  });
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Workspace created. Sign in with the main admin account.')).toBeVisible();
});

async function expectNoHorizontalOverflow(page: Page) {
  const pageFits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  expect(pageFits).toBe(true);
}

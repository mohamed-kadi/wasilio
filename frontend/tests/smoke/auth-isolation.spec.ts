import { expect, test } from '@playwright/test';
import { installMockApi, loginAs } from './helpers';

test('two tabs in the same browser can keep different signed-in users', async ({ context }) => {
  const merchantPage = await context.newPage();
  const adminPage = await context.newPage();
  await installMockApi(merchantPage);
  await installMockApi(adminPage);

  await loginAs(merchantPage, 'admin@example.com');
  await expect(merchantPage).toHaveURL(/\/app$/);
  await expect(merchantPage.getByText('admin@example.com')).toBeVisible();

  await loginAs(adminPage, 'superadmin@example.com');
  await expect(adminPage).toHaveURL(/\/admin\/billing$/);
  await expect(adminPage.getByText('superadmin@example.com')).toBeVisible();

  await merchantPage.reload();
  await expect(merchantPage).toHaveURL(/\/app$/);
  await expect(merchantPage.getByText('admin@example.com')).toBeVisible();
  await expect(merchantPage.getByText('superadmin@example.com')).toHaveCount(0);
});

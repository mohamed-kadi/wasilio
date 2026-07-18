import { expect, test } from '@playwright/test';
import { installMockApi, loginAs } from './helpers';

test('staff workspace keeps access billing payments and receipts clear', async ({ page }) => {
  await installMockApi(page);

  const tenantId = '20000000-0000-0000-0000-000000000001';
  const otherTenantId = '20000000-0000-0000-0000-000000000002';
  const plan = {
    planId: '30000000-0000-0000-0000-000000000001',
    code: 'starter',
    name: 'Starter',
    monthlyPrice: 299,
    currency: 'MAD',
    orderLimit: 500,
    userLimit: 3,
    active: true,
    createdAt: '2026-07-01T10:00:00Z',
    updatedAt: '2026-07-01T10:00:00Z',
  };
  const payment = {
    paymentId: '40000000-0000-0000-0000-000000000001',
    tenantId,
    subscriptionId: '50000000-0000-0000-0000-000000000001',
    receiptNumber: 'REC-2026-0001',
    method: 'BANK_TRANSFER',
    amount: 299,
    currency: 'MAD',
    paidAt: '2026-07-17T10:00:00Z',
    periodStart: '2026-07-01T00:00:00Z',
    periodEnd: '2026-07-31T23:59:59Z',
    collectedBy: 'Wasilio Super Admin',
    notes: 'July bank transfer.',
    createdAt: '2026-07-17T10:05:00Z',
  };
  let tenant = {
    tenantId,
    name: 'Casa Beauty',
    status: 'TRIALING',
    createdAt: '2026-07-01T10:00:00Z',
    updatedAt: '2026-07-17T10:00:00Z',
    usersCount: 2,
    ordersCount: 41,
    subscription: {
      subscriptionId: '50000000-0000-0000-0000-000000000001',
      tenantId,
      planId: plan.planId,
      status: 'TRIALING',
      currentPeriodStart: '2026-07-01T00:00:00Z',
      currentPeriodEnd: '2026-07-31T23:59:59Z',
      trialEndsAt: '2026-07-21T00:00:00Z',
      createdAt: '2026-07-01T10:00:00Z',
      updatedAt: '2026-07-17T10:00:00Z',
    },
    plan,
    payments: [payment],
  };
  const otherTenant = {
    tenantId: otherTenantId,
    name: 'Paused Merchant',
    status: 'SUSPENDED',
    createdAt: '2026-07-02T10:00:00Z',
    updatedAt: '2026-07-17T10:00:00Z',
    usersCount: 1,
    ordersCount: 0,
    subscription: undefined,
    plan: undefined,
    payments: [],
  };
  const statusUpdates: string[] = [];
  const subscriptionUpdates: Record<string, unknown>[] = [];
  const paymentPosts: Record<string, unknown>[] = [];

  await page.route('**/api/admin/plans', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([plan]),
    });
  });

  await page.route('**/api/admin/payments/export**', async (route) => {
    expect(route.request().url()).toContain('paidFrom=');
    await route.fulfill({
      status: 200,
      contentType: 'text/csv',
      headers: {
        'Content-Disposition': 'attachment; filename="wasilio-payment-records.csv"',
      },
      body: 'Receipt Number,Merchant Workspace,Payment Method,Amount,Currency,Collected By\nREC-2026-0001,Casa Beauty,BANK_TRANSFER,299,MAD,Wasilio Super Admin\n',
    });
  });

  await page.route('**/api/admin/payments/summary**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        paymentCount: 1,
        paidFrom: '2026-07-01T00:00:00Z',
        paidTo: '2026-08-01T00:00:00Z',
        totals: [{ currency: 'MAD', amount: 299, paymentCount: 1 }],
        monthlyTotals: [{ month: '2026-07', currency: 'MAD', amount: 299, paymentCount: 1 }],
      }),
    });
  });

  await page.route(`**/api/admin/tenants/${tenantId}/status`, async (route) => {
    const body = route.request().postDataJSON() as { status: string };
    statusUpdates.push(body.status);
    tenant = { ...tenant, status: body.status, updatedAt: '2026-07-18T10:00:00Z' };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(tenant),
    });
  });

  await page.route(`**/api/admin/tenants/${tenantId}/subscription`, async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    subscriptionUpdates.push(body);
    tenant = {
      ...tenant,
      subscription: {
        ...tenant.subscription,
        ...body,
        updatedAt: '2026-07-18T10:00:00Z',
      },
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(tenant),
    });
  });

  await page.route(`**/api/admin/tenants/${tenantId}/payments`, async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    paymentPosts.push(body);
    const createdPayment = {
      ...payment,
      paymentId: '40000000-0000-0000-0000-000000000002',
      receiptNumber: 'REC-2026-0002',
      method: body.method,
      amount: body.amount,
      currency: body.currency,
      paidAt: '2026-07-18T10:00:00Z',
      notes: body.notes,
    };
    tenant = { ...tenant, payments: [createdPayment, ...tenant.payments] };
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(createdPayment),
    });
  });

  await page.route(`**/api/admin/tenants/${tenantId}/payments/*/receipt`, async (route) => {
    const paymentId = route.request().url().split('/payments/')[1]?.split('/receipt')[0];
    const receiptPayment = tenant.payments.find((current) => current.paymentId === paymentId) ?? payment;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...receiptPayment,
        tenantName: tenant.name,
        tenantStatus: tenant.status,
        subscriptionStatus: tenant.subscription.status,
        plan,
      }),
    });
  });

  await page.route(`**/api/admin/tenants/${tenantId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(tenant),
    });
  });

  await page.route('**/api/admin/tenants', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        tenant,
        otherTenant,
      ]),
    });
  });

  await loginAs(page, 'superadmin@example.com');

  await expect(page.getByText('Wasilio Super Admin')).toBeVisible();
  await expect(page.getByText('Workspace access', { exact: true })).toBeVisible();
  await expect(page.getByText('Team members', { exact: true })).toBeVisible();
  const accessForm = page.locator('form').filter({ hasText: 'Workspace Access' });
  await expect(accessForm.getByText('Pilot access is available')).toBeVisible();
  await page.getByLabel('Access status').selectOption('OVERDUE');
  await page.getByRole('button', { name: /save access status/i }).click();
  await expect(accessForm.getByText('Access is blocked until payment is handled')).toBeVisible();
  expect(statusUpdates).toEqual(['OVERDUE']);

  await page.getByRole('link', { name: /^Billing$/i }).click();
  await expect(page.getByText('Subscription Update')).toBeVisible();
  await expect(page.getByText(/Current period:/)).toBeVisible();
  await page.getByLabel('Subscription status').selectOption('ACTIVE');
  await page.getByRole('button', { name: /save subscription/i }).click();
  expect(subscriptionUpdates[0]).toMatchObject({
    planId: plan.planId,
    status: 'ACTIVE',
  });

  await page.getByRole('link', { name: /^Payments$/i }).click();
  await expect(page.getByRole('button', { name: /download records/i })).toBeVisible();
  await expect(page.getByText('Matched receipts')).toBeVisible();
  await page.getByLabel('Paid from').fill('2026-07-01');
  await page.getByLabel('Paid to').fill('2026-07-31');
  await expect(page.getByText('Recorded payments', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Payment History' })).toBeVisible();
  const firstPaymentCard = page.getByRole('article').filter({ hasText: 'REC-2026-0001' });
  await expect(firstPaymentCard.getByText('Bank transfer', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /view receipt/i }).first().click();
  await expect(page.getByText('Receipt Preview')).toBeVisible();
  await expect(page.getByText('Manual payment receipt')).toBeVisible();

  await page.getByLabel('Payment method').selectOption('BANK_TRANSFER');
  await page.getByLabel('Amount').fill('699');
  await page.getByLabel('Currency').fill('MAD');
  await page.getByLabel('Notes').fill('Upgrade payment.');
  await page.getByRole('button', { name: /^record payment$/i }).click();

  expect(paymentPosts[0]).toMatchObject({
    method: 'BANK_TRANSFER',
    amount: 699,
    currency: 'MAD',
    notes: 'Upgrade payment.',
  });
  await expect(page.getByRole('heading', { name: 'REC-2026-0002' })).toBeVisible();

  const exportResponse = page.waitForResponse((response) =>
    response.url().includes('/api/admin/payments/export') && response.status() === 200,
  );
  await page.getByRole('button', { name: /download records/i }).click();
  await exportResponse;
});

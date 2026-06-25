import type { Page } from '@playwright/test';

interface TokenOptions {
  email: string;
  role: 'MERCHANT' | 'SUPER_ADMIN';
  tenantId: string;
}

export function fakeJwt({ email, role, tenantId }: TokenOptions) {
  const header = base64Url({ alg: 'HS256', typ: 'JWT' });
  const payload = base64Url({
    sub: email,
    role,
    tenantId,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  return `${header}.${payload}.signature`;
}

export async function installMockApi(page: Page) {
  await page.route('**/api/auth/login', async (route) => {
    const body = route.request().postDataJSON() as { email: string };
    const email = body.email.toLowerCase();
    const role = email.includes('superadmin') ? 'SUPER_ADMIN' : 'MERCHANT';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: fakeJwt({
          email,
          role,
          tenantId: role === 'SUPER_ADMIN'
            ? '00000000-0000-0000-0000-000000000099'
            : '00000000-0000-0000-0000-000000000001',
        }),
      }),
    });
  });

  await page.route('**/api/orders?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [],
        page: 0,
        size: 1,
        totalElements: 0,
        totalPages: 0,
      }),
    });
  });

  await page.route('**/api/confirmations/queue?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(emptyPage()),
    });
  });

  await page.route('**/api/confirmations/callbacks?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(emptyPage()),
    });
  });

  await page.route('**/api/courier-operations/assignment-queue?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(emptyPage()),
    });
  });

  await page.route('**/api/courier-operations/pickup-queue?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(emptyPage()),
    });
  });

  await page.route('**/api/courier-operations/delivery-queue?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(emptyPage()),
    });
  });

  await page.route('**/api/courier-operations/follow-ups?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(emptyPage()),
    });
  });

  await page.route('**/api/courier-operations/orders/recovery-queue?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...emptyPage(),
        counts: emptyRecoveryCounts(),
      }),
    });
  });

  await page.route('**/api/admin/tenants', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/admin/plans', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/marketing/leads', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
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
          ...body,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

export async function loginAs(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: /sign in/i }).click();
}

function base64Url(value: unknown) {
  return Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function emptyPage() {
  return {
    content: [],
    page: 0,
    size: 1,
    totalElements: 0,
    totalPages: 0,
  };
}

function emptyRecoveryCounts() {
  return {
    all: 0,
    needsDecision: 0,
    openFollowUp: 0,
    retryReady: 0,
    refundReview: 0,
    closedUnrecoverable: 0,
  };
}

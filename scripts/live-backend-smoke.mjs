#!/usr/bin/env node

const baseUrl = normalizeBaseUrl(process.env.WASILIO_API_BASE_URL || 'http://localhost:8080');
const superAdminEmail = process.env.WASILIO_SUPER_ADMIN_EMAIL || '';
const superAdminPassword = process.env.WASILIO_SUPER_ADMIN_PASSWORD || '';
const merchantEmail = process.env.WASILIO_MERCHANT_EMAIL || '';
const merchantPassword = process.env.WASILIO_MERCHANT_PASSWORD || '';
const captureLead = envFlag('WASILIO_SMOKE_CAPTURE_LEAD');
const createOrder = envFlag('WASILIO_SMOKE_CREATE_ORDER');
const recordConfirmationAttempt = envFlag('WASILIO_SMOKE_RECORD_CONFIRMATION_ATTEMPT');
const requestPasswordResetFor = process.env.WASILIO_SMOKE_PASSWORD_RESET_EMAIL || '';

let failures = 0;

console.log(`Wasilio live backend smoke: ${baseUrl}`);
console.log('Mutating checks are opt-in through WASILIO_SMOKE_CAPTURE_LEAD, WASILIO_SMOKE_CREATE_ORDER, and WASILIO_SMOKE_RECORD_CONFIRMATION_ATTEMPT.');
console.log('');

await check('readiness health', async () => {
  const response = await request('GET', '/actuator/health/readiness');
  if (response.data && response.data.status && response.data.status !== 'UP') {
    throw new Error(`Expected readiness status UP, got ${response.data.status}`);
  }
  return response.data?.status ? `status=${response.data.status}` : `status=${response.status}`;
});

let superAdminToken = '';
if (superAdminEmail && superAdminPassword) {
  await check('super-admin login', async () => {
    const response = await request('POST', '/api/auth/login', {
      body: { email: superAdminEmail, password: superAdminPassword },
    });
    superAdminToken = requireToken(response.data);
    return `email=${superAdminEmail}`;
  });

  await check('staff tenant list', async () => {
    const response = await request('GET', '/api/admin/tenants', { token: superAdminToken });
    if (!Array.isArray(response.data)) {
      throw new Error('Expected tenant list array');
    }
    return `${response.data.length} workspaces`;
  });

  await check('staff plan list', async () => {
    const response = await request('GET', '/api/admin/plans', { token: superAdminToken });
    if (!Array.isArray(response.data)) {
      throw new Error('Expected plan list array');
    }
    return `${response.data.length} plans`;
  });

  await check('staff demo request list', async () => {
    const response = await request('GET', '/api/marketing/leads', { token: superAdminToken });
    if (!Array.isArray(response.data)) {
      throw new Error('Expected lead list array');
    }
    return `${response.data.length} leads`;
  });
} else {
  skip('super-admin protected checks', 'set WASILIO_SUPER_ADMIN_EMAIL and WASILIO_SUPER_ADMIN_PASSWORD');
}

if (captureLead) {
  await check('public demo request capture', async () => {
    const stamp = Date.now();
    const response = await request('POST', '/api/marketing/leads', {
      expectedStatuses: [201],
      body: {
        contactName: 'Pilot Smoke',
        storeName: `Pilot Smoke Store ${stamp}`,
        phone: '0600000000',
        email: `pilot-smoke-${stamp}@example.com`,
        city: 'Casablanca',
        monthlyOrderVolume: 'smoke-test',
        message: 'Pilot readiness smoke check.',
        campaignSource: 'pilot-smoke',
      },
    });
    return `leadId=${response.data.leadId}`;
  });
} else {
  skip('public demo request capture', 'set WASILIO_SMOKE_CAPTURE_LEAD=true');
}

if (requestPasswordResetFor) {
  await check('password reset email request', async () => {
    const response = await request('POST', '/api/auth/password-reset/request', {
      body: { email: requestPasswordResetFor },
    });
    return response.data?.message || `status=${response.status}`;
  });
} else {
  skip('password reset email request', 'set WASILIO_SMOKE_PASSWORD_RESET_EMAIL');
}

let merchantToken = '';
if (merchantEmail && merchantPassword) {
  await check('merchant login', async () => {
    const response = await request('POST', '/api/auth/login', {
      body: { email: merchantEmail, password: merchantPassword },
    });
    merchantToken = requireToken(response.data);
    return `email=${merchantEmail}`;
  });

  await check('merchant order list', async () => {
    const response = await request('GET', '/api/orders?page=0&size=1', { token: merchantToken });
    if (!response.data || !Array.isArray(response.data.content)) {
      throw new Error('Expected paged order response');
    }
    return `${response.data.totalElements} orders`;
  });

  if (createOrder) {
    let orderId = '';
    await check('merchant create smoke order', async () => {
      const stamp = Date.now();
      const response = await request('POST', '/api/orders', {
        token: merchantToken,
        body: {
          customer: {
            firstName: 'Pilot',
            lastName: 'Smoke',
            email: `pilot-smoke-${stamp}@example.com`,
            phone: '0600000000',
          },
          address: {
            street: '1 Smoke Street',
            city: 'Casablanca',
            state: 'Casablanca-Settat',
            zipCode: '20000',
            country: 'MA',
          },
          amount: 10,
          source: 'MANUAL',
          externalOrderId: `pilot-smoke-${stamp}`,
          idempotencyKey: `pilot-smoke-${stamp}`,
        },
      });
      orderId = String(response.data || '').replaceAll('"', '');
      if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
        throw new Error(`Expected order UUID, got ${JSON.stringify(response.data)}`);
      }
      return `orderId=${orderId}`;
    });

    await check('merchant request confirmation', async () => {
      await request('POST', `/api/orders/${orderId}/request-confirmation`, { token: merchantToken });
      return `orderId=${orderId}`;
    });

    if (recordConfirmationAttempt) {
      await check('merchant record non-final confirmation attempt', async () => {
        const response = await request('POST', `/api/orders/${orderId}/confirmation-attempts`, {
          token: merchantToken,
          expectedStatuses: [201],
          body: {
            outcome: 'NO_ANSWER',
            note: 'Pilot readiness smoke check.',
          },
        });
        return `attemptId=${response.data.attemptId}`;
      });
    } else {
      skip('merchant record confirmation attempt', 'set WASILIO_SMOKE_RECORD_CONFIRMATION_ATTEMPT=true');
    }
  } else {
    skip('merchant create smoke order', 'set WASILIO_SMOKE_CREATE_ORDER=true');
  }
} else {
  skip('merchant protected checks', 'set WASILIO_MERCHANT_EMAIL and WASILIO_MERCHANT_PASSWORD');
}

console.log('');
if (failures > 0) {
  console.error(`Smoke failed: ${failures} failing check${failures === 1 ? '' : 's'}.`);
  process.exit(1);
}
console.log('Smoke passed: no failing checks.');

async function check(name, fn) {
  try {
    const detail = await fn();
    console.log(`PASS ${name}${detail ? ` - ${detail}` : ''}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name} - ${error.message}`);
  }
}

function skip(name, reason) {
  console.log(`SKIP ${name} - ${reason}`);
}

async function request(method, path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const data = parseResponseBody(text, response.headers.get('content-type') || '');
  const expectedStatuses = options.expectedStatuses || [200];
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${method} ${path} returned ${response.status}: ${snippet(text)}`);
  }
  return { status: response.status, data };
}

function parseResponseBody(text, contentType) {
  if (!text) {
    return null;
  }
  if (contentType.includes('application/json') || looksLikeJson(text)) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

function requireToken(data) {
  if (!data || typeof data.token !== 'string' || !data.token) {
    throw new Error('Login response did not include token');
  }
  return data.token;
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function envFlag(name) {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env[name] || '').toLowerCase());
}

function looksLikeJson(text) {
  const trimmed = text.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"');
}

function snippet(text) {
  return text.length > 300 ? `${text.slice(0, 300)}...` : text;
}

#!/usr/bin/env node

const baseUrl = normalizeBaseUrl(process.env.WASILIO_API_BASE_URL || 'http://localhost:8080');
const superAdminEmail = process.env.WASILIO_SUPER_ADMIN_EMAIL || '';
const superAdminPassword = process.env.WASILIO_SUPER_ADMIN_PASSWORD || '';
const merchantEmail = process.env.WASILIO_MERCHANT_EMAIL || '';
const merchantPassword = process.env.WASILIO_MERCHANT_PASSWORD || '';
const captureLead = envFlag('WASILIO_SMOKE_CAPTURE_LEAD');
const createOrder = envFlag('WASILIO_SMOKE_CREATE_ORDER');
const recordConfirmationAttempt = envFlag('WASILIO_SMOKE_RECORD_CONFIRMATION_ATTEMPT');
const uploadMedia = envFlag('WASILIO_SMOKE_UPLOAD_MEDIA');
const requestPasswordResetFor = process.env.WASILIO_SMOKE_PASSWORD_RESET_EMAIL || '';

let failures = 0;

console.log(`Wasilio live backend smoke: ${baseUrl}`);
console.log('Mutating checks are opt-in through WASILIO_SMOKE_CAPTURE_LEAD, WASILIO_SMOKE_CREATE_ORDER, WASILIO_SMOKE_RECORD_CONFIRMATION_ATTEMPT, and WASILIO_SMOKE_UPLOAD_MEDIA.');
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
        contactName: 'Trial Smoke',
        storeName: `Trial Smoke Store ${stamp}`,
        phone: '0600000000',
        email: `trial-smoke-${stamp}@example.com`,
        city: 'Casablanca',
        monthlyOrderVolume: 'smoke-test',
        message: 'Trial readiness smoke check.',
        campaignSource: 'trial-smoke',
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

  await check('merchant orders csv export', async () => {
    const response = await request('GET', '/api/orders/export', { token: merchantToken });
    const csv = String(response.data || '');
    if (!csv.includes('Order ID') || !csv.includes('Workflow Stage')) {
      throw new Error('Expected business CSV headers in order export');
    }
    return `${csv.split('\n').filter(Boolean).length} row(s) including header`;
  });

  if (createOrder) {
    let orderId = '';
    await check('merchant create smoke order', async () => {
      const stamp = Date.now();
      const response = await request('POST', '/api/orders', {
        token: merchantToken,
        body: {
          customer: {
            firstName: 'Trial',
            lastName: 'Smoke',
            email: `trial-smoke-${stamp}@example.com`,
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
          externalOrderId: `trial-smoke-${stamp}`,
          idempotencyKey: `trial-smoke-${stamp}`,
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
            note: 'Trial readiness smoke check.',
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

  if (uploadMedia) {
    await check('merchant product media upload', async () => {
      const stamp = Date.now();
      const productResponse = await request('POST', '/api/products', {
        token: merchantToken,
        body: {
          name: `Smoke Media Product ${stamp}`,
          slug: `smoke-media-product-${stamp}`,
          description: 'Hosted trial media upload smoke check.',
          priceAmount: 10,
          currency: 'MAD',
          sku: `SMOKE-${stamp}`,
          imageUrl: null,
          status: 'DRAFT',
        },
      });
      const productId = productResponse.data?.id;
      if (!isUuid(productId)) {
        throw new Error(`Expected product UUID, got ${JSON.stringify(productResponse.data)}`);
      }

      const formData = new FormData();
      formData.append('purpose', 'PRODUCT_IMAGE');
      formData.append('file', new Blob([tinyPngBytes()], { type: 'image/png' }), `wasilio-smoke-${stamp}.png`);

      const uploadResponse = await request('POST', `/api/products/${productId}/media`, {
        token: merchantToken,
        body: formData,
      });
      const publicUrl = uploadResponse.data?.publicUrl;
      if (!publicUrl || typeof publicUrl !== 'string') {
        throw new Error(`Expected publicUrl in media upload response, got ${JSON.stringify(uploadResponse.data)}`);
      }

      await request('GET', publicUrl, { expectedStatuses: [200] });
      return `productId=${productId}, mediaUrl=${publicUrl}`;
    });
  } else {
    skip('merchant product media upload', 'set WASILIO_SMOKE_UPLOAD_MEDIA=true');
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
  const url = urlFor(path);
  const headers = {};
  const isFormDataBody = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body !== undefined && !isFormDataBody) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: requestBody(options.body, isFormDataBody),
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

function urlFor(pathOrUrl) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }
  const normalizedPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${baseUrl}${normalizedPath}`;
}

function requestBody(body, isFormDataBody) {
  if (body === undefined) {
    return undefined;
  }
  return isFormDataBody ? body : JSON.stringify(body);
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

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
}

function tinyPngBytes() {
  return Uint8Array.from(Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    'base64'
  ));
}

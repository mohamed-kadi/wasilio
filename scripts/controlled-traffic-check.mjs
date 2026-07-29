#!/usr/bin/env node

const baseUrl = normalizeBaseUrl(process.env.WASILIO_TRAFFIC_BASE_URL || 'https://app.wasilio.ma');
const paths = parsePaths(process.env.WASILIO_TRAFFIC_PATHS || '/,/actuator/health/readiness');
const rounds = parsePositiveInteger(process.env.WASILIO_TRAFFIC_ROUNDS || '5', 'WASILIO_TRAFFIC_ROUNDS');
const concurrency = parsePositiveInteger(process.env.WASILIO_TRAFFIC_CONCURRENCY || '2', 'WASILIO_TRAFFIC_CONCURRENCY');
const delayMs = parseNonNegativeInteger(process.env.WASILIO_TRAFFIC_DELAY_MS || '250', 'WASILIO_TRAFFIC_DELAY_MS');
const timeoutMs = parsePositiveInteger(process.env.WASILIO_TRAFFIC_TIMEOUT_MS || '8000', 'WASILIO_TRAFFIC_TIMEOUT_MS');

const results = new Map(paths.map((path) => [path, []]));
let failures = 0;

console.log(`Wasilio controlled traffic check: ${baseUrl}`);
console.log(`Paths: ${paths.join(', ')}`);
console.log(`Rounds: ${rounds}, concurrency per path: ${concurrency}, delay between rounds: ${delayMs}ms, timeout: ${timeoutMs}ms`);
console.log('GET-only check. This script does not create orders, upload media, or change data.');
console.log('');

for (let round = 1; round <= rounds; round += 1) {
  const tasks = [];
  for (const path of paths) {
    for (let index = 0; index < concurrency; index += 1) {
      tasks.push(checkPath(path, round, index + 1));
    }
  }
  await Promise.all(tasks);
  if (round < rounds && delayMs > 0) {
    await sleep(delayMs);
  }
}

console.log('');
for (const path of paths) {
  const pathResults = results.get(path) || [];
  const okResults = pathResults.filter((result) => result.ok);
  const timings = okResults.map((result) => result.ms).sort((a, b) => a - b);
  const errorCount = pathResults.length - okResults.length;
  console.log(`${path}: ${okResults.length}/${pathResults.length} passed, errors=${errorCount}, p50=${percentile(timings, 50)}ms, p95=${percentile(timings, 95)}ms`);
}

if (failures > 0) {
  console.error(`Traffic check failed: ${failures} request(s) failed.`);
  process.exit(1);
}

console.log('Traffic check passed: no failing requests.');

async function checkPath(path, round, requestNumber) {
  const started = performance.now();
  try {
    const response = await request(path);
    const elapsedMs = Math.round(performance.now() - started);
    await validateResponse(path, response);
    results.get(path).push({ ok: true, ms: elapsedMs });
    console.log(`PASS round=${round} request=${requestNumber} path=${path} status=${response.status} ms=${elapsedMs}`);
  } catch (error) {
    failures += 1;
    const elapsedMs = Math.round(performance.now() - started);
    results.get(path).push({ ok: false, ms: elapsedMs, error: error.message });
    console.error(`FAIL round=${round} request=${requestNumber} path=${path} ms=${elapsedMs} - ${error.message}`);
  }
}

async function request(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(urlFor(path), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
      },
    });
    const text = await response.text();
    return {
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      text,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function validateResponse(path, response) {
  if (response.status !== 200) {
    throw new Error(`expected 200, got ${response.status}: ${snippet(response.text)}`);
  }
  if (path.includes('/actuator/health/readiness')) {
    const data = parseJson(response.text);
    if (data?.status !== 'UP') {
      throw new Error(`expected readiness status UP, got ${JSON.stringify(data)}`);
    }
  }
}

function parsePaths(value) {
  const parsed = value
    .split(',')
    .map((path) => path.trim())
    .filter(Boolean);
  if (parsed.length === 0) {
    throw new Error('WASILIO_TRAFFIC_PATHS must include at least one path.');
  }
  return parsed;
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

function parsePositiveInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return parsed;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function percentile(values, percentage) {
  if (values.length === 0) {
    return 'n/a';
  }
  const index = Math.ceil((percentage / 100) * values.length) - 1;
  return values[Math.max(0, Math.min(index, values.length - 1))];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function snippet(text) {
  return text.length > 160 ? `${text.slice(0, 160)}...` : text;
}

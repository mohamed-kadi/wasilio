import { API_BASE_URL } from '../api/client';

const DEFAULT_PUBLIC_API_BASE_URL = 'http://localhost:8080';
const DEFAULT_LANDING_ENGINE_URL = 'http://localhost:3000';
const DEFAULT_LANDING_ENGINE_PRODUCT_PATH_PATTERN = '/products/:productSlug';

export function publicApiBaseUrlForDisplay(): string {
  const configured = API_BASE_URL.trim();
  const browserOrigin = currentBrowserOriginForDisplay();
  if (!configured || configured === '/api') {
    return browserOrigin ?? DEFAULT_PUBLIC_API_BASE_URL;
  }
  if (configured.startsWith('/')) {
    const apiPath = configured.replace(/\/api\/?$/, '').replace(/\/$/, '');
    return `${browserOrigin ?? DEFAULT_PUBLIC_API_BASE_URL}${apiPath}`;
  }
  if (!configured.startsWith('http')) {
    return browserOrigin ?? DEFAULT_PUBLIC_API_BASE_URL;
  }
  return configured.replace(/\/api\/?$/, '').replace(/\/$/, '');
}

export function currentBrowserOriginForDisplay(): string | null {
  if (typeof window === 'undefined' || !window.location?.origin || window.location.origin === 'null') {
    return null;
  }
  return window.location.origin.replace(/\/$/, '');
}

export function customerPageHostConfigured(): boolean {
  const configured = import.meta.env.VITE_LANDING_ENGINE_URL?.trim();
  if (!configured) {
    return false;
  }
  const normalized = configured.replace(/\/$/, '');
  const browserOrigin = currentBrowserOriginForDisplay();
  if (!browserOrigin) {
    return normalized !== DEFAULT_LANDING_ENGINE_URL;
  }
  try {
    return new URL(normalized).origin !== browserOrigin;
  } catch {
    return false;
  }
}

export function customerPageHostUrlForDisplay(): string {
  if (!customerPageHostConfigured()) {
    return DEFAULT_LANDING_ENGINE_URL;
  }
  return landingEngineUrlForDisplay();
}

export function landingEngineUrlForDisplay(): string {
  const configured = import.meta.env.VITE_LANDING_ENGINE_URL?.trim();
  return (configured || DEFAULT_LANDING_ENGINE_URL).replace(/\/$/, '');
}

export function publicProductApiUrl(storeSlug: string, productSlug: string): string {
  return `${publicApiBaseUrlForDisplay()}/api/public/storefront/${storeSlug}/products/${productSlug}`;
}

export function publicProductApiPattern(storeSlug?: string): string {
  const safeStoreSlug = storeSlug || '<storeSlug>';
  return `${publicApiBaseUrlForDisplay()}/api/public/storefront/${safeStoreSlug}/products/<productSlug>`;
}

export function publicOrderApiPattern(storeSlug?: string): string {
  const safeStoreSlug = storeSlug || '<storeSlug>';
  return `${publicApiBaseUrlForDisplay()}/api/public/storefront/${safeStoreSlug}/orders`;
}

export function landingEngineProductUrl(storeSlug: string, productSlug: string): string {
  const url = new URL(renderLandingEngineProductPath(storeSlug, productSlug), `${landingEngineUrlForDisplay()}/`);
  url.searchParams.set('wasilioPreview', '1');
  return url.toString();
}

export function landingEngineProductPattern(storeSlug?: string): string {
  return `${landingEngineUrlForDisplay()}${renderLandingEngineProductPath(
    storeSlug || '<storeSlug>',
    '<productSlug>',
    false,
  )}`;
}

export function landingEngineEnvSnippet(storeSlug?: string): string {
  return [
    'NEXT_PUBLIC_PRODUCT_PROVIDER=wasilio',
    `NEXT_PUBLIC_WASILIO_PUBLIC_API_BASE_URL=${publicApiBaseUrlForDisplay()}`,
    `NEXT_PUBLIC_WASILIO_STORE_SLUG=${storeSlug || '<storeSlug>'}`,
  ].join('\n');
}

function landingEngineProductPathPattern(): string {
  const configured = import.meta.env.VITE_LANDING_ENGINE_PRODUCT_PATH_PATTERN?.trim();
  return normalizeProductPathPattern(configured || DEFAULT_LANDING_ENGINE_PRODUCT_PATH_PATTERN);
}

function normalizeProductPathPattern(pattern: string): string {
  const trimmed = pattern.trim() || DEFAULT_LANDING_ENGINE_PRODUCT_PATH_PATTERN;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function renderLandingEngineProductPath(storeSlug: string, productSlug: string, encode = true): string {
  const safeStoreSlug = encode ? encodeURIComponent(storeSlug) : storeSlug;
  const safeProductSlug = encode ? encodeURIComponent(productSlug) : productSlug;

  return landingEngineProductPathPattern()
    .replaceAll(':storeSlug', safeStoreSlug)
    .replaceAll('{storeSlug}', safeStoreSlug)
    .replaceAll('<storeSlug>', safeStoreSlug)
    .replaceAll(':productSlug', safeProductSlug)
    .replaceAll('{productSlug}', safeProductSlug)
    .replaceAll('<productSlug>', safeProductSlug)
    .replaceAll(':slug', safeProductSlug);
}

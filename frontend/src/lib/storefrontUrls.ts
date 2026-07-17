import { API_BASE_URL } from '../api/client';

const DEFAULT_PUBLIC_API_BASE_URL = 'http://localhost:8080';
const DEFAULT_LANDING_ENGINE_URL = 'http://localhost:3000';

export function publicApiBaseUrlForDisplay(): string {
  const configured = API_BASE_URL.trim();
  if (!configured || configured === '/api') {
    return DEFAULT_PUBLIC_API_BASE_URL;
  }
  return configured.replace(/\/api\/?$/, '').replace(/\/$/, '');
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

export function landingEngineProductUrl(productSlug: string): string {
  return `${landingEngineUrlForDisplay()}/products/${productSlug}?wasilioPreview=1`;
}

export function landingEngineProductPattern(): string {
  return `${landingEngineUrlForDisplay()}/products/<productSlug>`;
}

export function landingEngineEnvSnippet(storeSlug?: string): string {
  return [
    'NEXT_PUBLIC_PRODUCT_PROVIDER=wasilio',
    `NEXT_PUBLIC_WASILIO_PUBLIC_API_BASE_URL=${publicApiBaseUrlForDisplay()}`,
    `NEXT_PUBLIC_WASILIO_STORE_SLUG=${storeSlug || '<storeSlug>'}`,
  ].join('\n');
}

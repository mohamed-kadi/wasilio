import { API_BASE_URL } from '../api/client';

const BACKEND_MEDIA_PATH_PATTERN = /^\/media(?:\/|$)/;
const BROWSER_NATIVE_URL_PATTERN = /^(?:https?:|data:|blob:|\/\/)/i;

export function mediaDisplayUrl(imageUrl?: string | null): string | undefined {
  const trimmed = imageUrl?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (BROWSER_NATIVE_URL_PATTERN.test(trimmed)) {
    return trimmed;
  }
  if (!BACKEND_MEDIA_PATH_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const apiOrigin = configuredApiOrigin();
  return apiOrigin ? `${apiOrigin}${trimmed}` : trimmed;
}

function configuredApiOrigin(): string {
  const configured = API_BASE_URL.trim();
  if (!configured || configured === '/api' || !/^https?:\/\//i.test(configured)) {
    return '';
  }
  return configured.replace(/\/api\/?$/, '').replace(/\/$/, '');
}

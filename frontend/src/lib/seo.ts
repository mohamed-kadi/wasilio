import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description: string;
  path?: string;
  type?: string;
}

const siteName = 'Nexora';

export function publicSiteUrl() {
  return (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.replace(/\/$/, '')
    || window.location.origin;
}

export function usePageMeta({ title, description, path = '/', type = 'website' }: PageMeta) {
  useEffect(() => {
    const canonicalUrl = `${publicSiteUrl()}${path}`;
    document.title = title;

    setMeta('name', 'description', description);
    setMeta('name', 'application-name', siteName);
    setMeta('property', 'og:site_name', siteName);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:image', `${publicSiteUrl()}/social-preview.svg`);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setCanonical(canonicalUrl);
  }, [description, path, title, type]);
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.appendChild(element);
  }
  element.href = href;
}

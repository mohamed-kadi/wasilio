export function campaignSourceFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const campaignParams = new URLSearchParams();

  params.forEach((value, key) => {
    if (key.startsWith('utm_') || ['fbclid', 'gclid', 'ref'].includes(key)) {
      campaignParams.set(key, value);
    }
  });

  if (document.referrer) {
    campaignParams.set('referrer', document.referrer);
  }

  const source = campaignParams.toString();
  return source ? source.slice(0, 255) : undefined;
}

type MetaPixelQueue = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  loaded: boolean;
  version: string;
};

export function installMetaPixel() {
  const pixelId = import.meta.env.VITE_PUBLIC_META_PIXEL_ID as string | undefined;
  if (!pixelId) {
    return;
  }

  const trackedWindow = window as Window & {
    fbq?: MetaPixelQueue;
    _fbq?: unknown;
  };

  if (!trackedWindow.fbq) {
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) {
        fbq.callMethod(...args);
      } else {
        fbq.queue.push(args);
      }
    }) as MetaPixelQueue;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = '2.0';
    trackedWindow.fbq = fbq;
    trackedWindow._fbq = fbq;
  }

  const script = document.createElement('script');
  if (!document.getElementById('meta-pixel-script')) {
    script.id = 'meta-pixel-script';
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }

  trackedWindow.fbq?.('init', pixelId);
  trackedWindow.fbq?.('track', 'PageView');
}

export function trackLeadSubmitted() {
  const fbq = (window as Window & { fbq?: (...args: unknown[]) => void }).fbq;
  fbq?.('track', 'Lead');
}

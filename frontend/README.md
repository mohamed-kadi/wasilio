# Wasilio Frontend

The frontend is a Vite React app for the public landing page, merchant dashboard, and Wasilio staff admin workspace.

For full project setup, Docker instructions, local logins, and production notes, use the root [README.md](../README.md).

## Manual Frontend Development

Start the backend separately, then run:

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open http://localhost:5173.

## Checks

```bash
npm run build
npm run lint
npm run smoke
```

On a fresh machine, install the Playwright browser once before smoke tests:

```bash
npx playwright install chromium
```

## landing-engine Local Wiring

After creating a storefront in the merchant dashboard, configure landing-engine with:

```bash
NEXT_PUBLIC_PRODUCT_PROVIDER=wasilio
NEXT_PUBLIC_WASILIO_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_WASILIO_STORE_SLUG=<storeSlug>
```

Wasilio dashboard Preview links support two shapes:

- Local/default: `VITE_LANDING_ENGINE_URL=http://localhost:3000` with `VITE_LANDING_ENGINE_PRODUCT_PATH_PATTERN=/products/:productSlug`.
- Shared merchant subdomains: `VITE_LANDING_ENGINE_PRODUCT_URL_PATTERN=https://:storeSlug.wasilio.ma/products/:productSlug`.

When the full URL pattern is set, it takes priority over the local origin/path pair.

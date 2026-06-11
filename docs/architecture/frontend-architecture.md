# Frontend Architecture

The frontend is a Vite React application under `frontend`. It provides the public landing page, merchant operations dashboard, and Wasilio staff admin workspace.

## Stack

- React 19
- React Router
- TanStack Query
- Zustand
- TypeScript
- Tailwind CSS
- Lucide React icons
- Vite

## Structure

- `src/App.tsx`: router, protected shell, sidebar, header, and route registration.
- `src/api/client.ts`: API client helpers and authenticated backend calls.
- `src/store/authStore.ts`: persisted authentication/session state.
- `src/pages/*`: route-level screens.
- `src/index.css` and `src/App.css`: global and app styling.

## Routing

Public routes:

- `/`
- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/terms`
- `/privacy`
- `/payment-refund-policy`

Merchant protected routes under `/app`:

- `/app`
- `/app/orders`
- `/app/orders/new`
- `/app/orders/:id`
- `/app/confirmations`
- `/app/couriers`
- `/app/couriers/:id`
- `/app/couriers/assignment`
- `/app/couriers/pickup`
- `/app/couriers/delivery`
- `/app/couriers/performance`

Staff protected routes:

- `/admin/billing`

`ProtectedApp` redirects unauthenticated users to `/login` and keeps the authenticated dashboard shell around protected merchant pages. Super-admin users are redirected to `/admin/billing`.

## Data Fetching

TanStack Query is used for server reads and cache invalidation. Mutation flows should invalidate affected query keys after a successful write so projections and operational queues refresh predictably.

## Auth State

The frontend stores session state in `authStore`. API requests use the stored JWT. Logout clears the session and query cache, then returns the user to `/login`.

## Tests

The frontend has lint, build, and Playwright smoke scripts.

Current smoke coverage verifies:

- public landing lead capture with campaign source
- super-admin marketing lead follow-up update
- same-browser auth isolation across tabs

Remaining gaps before heavier production reliance: live-backend login, signup, order creation, confirmation, callbacks, courier operations, and billing flows in CI.

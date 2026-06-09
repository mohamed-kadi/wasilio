# Frontend Architecture

The frontend is a Vite React application under `frontend`. It provides the merchant operations dashboard for login, signup, order management, and confirmation operations.

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

- `/login`
- `/signup`

Protected routes:

- `/`
- `/orders`
- `/orders/new`
- `/orders/:id`
- `/confirmations`
- `/couriers`
- `/couriers/:id`
- `/couriers/assignment`
- `/couriers/pickup`
- `/couriers/delivery`
- `/couriers/performance`

`ProtectedApp` redirects unauthenticated users to `/login` and keeps the authenticated dashboard shell around protected pages.

## Data Fetching

TanStack Query is used for server reads and cache invalidation. Mutation flows should invalidate affected query keys after a successful write so projections and operational queues refresh predictably.

## Auth State

The frontend stores session state in `authStore`. API requests use the stored JWT. Logout clears the session and query cache, then returns the user to `/login`.

## Current Test Gap

The frontend has lint and build scripts but no E2E test suite. Confirmation operations, login redirects, signup, and order lifecycle screens should be covered with Playwright or an equivalent browser test suite before production reliance.

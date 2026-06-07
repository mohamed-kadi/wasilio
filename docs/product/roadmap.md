# Roadmap

This roadmap is intentionally product-oriented. Engineering debt that blocks reliability is tracked in `docs/technical-debt.md`.

## Completed

- Modular monolith foundation.
- PostgreSQL schema and Flyway migrations.
- Tenant, user, order, and domain event model.
- JWT authentication.
- Tenant onboarding with feature flag.
- Event-backed order lifecycle.
- Orders projection and projection processed-event tracking.
- Confirmation queue.
- Confirmation attempts.
- Callback scheduling and callback queue.
- Internal courier management.
- Courier assignment queue.
- Courier pickup queue.
- Operational baseline documentation.

## Phase 2 Remaining

- Improve confirmation UX and operator efficiency.
- Improve courier operator visibility and detail screens.
- Add frontend E2E coverage for login, signup, order creation, confirmation, and callbacks.
- Add richer audit views for order timelines and confirmation history.

## Phase 3 Candidate: Courier Operations

- Delivery and failure operations workspace.
- Courier integration abstraction.
- Courier webhook ingestion.
- Delivery failure reason analytics.

## Phase 4 Candidate: Reliability And Scale

- Outbox and retry worker.
- Distributed throttling.
- Refresh tokens and token revocation.
- Automated backups and restore drills.
- Event upcasters and event version migration process.

## Phase 5 Candidate: Commercial Platform

- Billing and plans.
- Tenant usage metrics.
- Merchant analytics dashboards.
- Integration marketplace for storefronts and couriers.
- Admin console for support and tenant operations.

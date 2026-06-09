# Roadmap

This roadmap is intentionally product-oriented. Engineering debt that blocks reliability is tracked in `docs/technical-debt.md`.

For detailed remaining phases, batch sequencing, deferred work, and the architecture audit gate, use `docs/product/master-roadmap.md` as the source of truth.

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
- Internal delivery queue.
- Delivery outcome workflow.
- Delivery failure reason tracking.
- Basic courier performance metrics.
- Advanced order search and filtering.
- Saved order search views.
- Unified order timeline.
- Operational baseline documentation.

## Phase 2 Remaining

- Customer notes.
- CSV and filtered exports.
- Add frontend E2E coverage for login, signup, order creation, confirmation, and callbacks.

## Phase 3 Candidate: Business Layer

- User management.
- Tenant settings.
- Audit center.
- Internal notifications.

## Phase 4 Candidate: SaaS Monetization

- Subscription management.
- Usage metering.
- Stripe checkout and billing portal.

## Phase 5 Candidate: Enterprise Hardening

- Outbox and retry worker.
- Distributed throttling.
- Refresh tokens and token revocation.
- Automated backups and restore drills.
- Event upcasters and event version migration process.
- Projection monitoring.

# Roadmap

This roadmap is intentionally product-oriented. Engineering debt that blocks reliability is tracked in `docs/technical-debt.md`.

For detailed remaining phases, batch sequencing, deferred work, and the architecture audit gate, use `docs/product/master-roadmap.md` as the source of truth.

For the temporary merchant-pilot/public-launch path, use `docs/product/launch-readiness-pivot.md`.

For the current tactical sequence after the public frontend launch, use `docs/product/next-implementation-plan.md`.

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
- Launch-readiness pivot plan.
- Super-admin tenant billing foundation.
- Subscription plans.
- Tenant subscription status.
- Manual cash/bank-transfer payment records.
- Receipt records.

## Phase 2 Remaining

- Customer notes.
- CSV and filtered exports.
- Add frontend E2E coverage for login, signup, order creation, confirmation, and callbacks.

## Launch Readiness Pivot

- Internal admin console: first billing workspace implemented.
- Tenant status and subscription status: first backend and UI slice implemented.
- Manual cash/bank-transfer payment tracking: first backend and UI slice implemented.
- Receipt generation: receipt records and printable receipt view implemented.
- Public landing site and lead capture: first slice implemented.
- SEO and Facebook/Meta tracking.
- Production backup, password recovery, and monitoring hardening.

## Current Tactical Focus

- Keep the public frontend live on Cloudflare Pages.
- Keep backend hosting deferred until there is pilot/client demand or a card-verified hosting account is acceptable.
- Stabilize production-readiness documentation and deployment checks so local testing, landing-engine rehearsal, frontend-only public mode, and future hosted backend pilot mode are not confused.
- Phase 35 completed the first public landing page and acquisition funnel cleanup, with fraud/intelligence positioning made clearer for merchants without exposing internal scoring rules.
- Phase 36 is now the hosted backend pilot preparation track: account ownership audit, live backend smoke checks, production environment inventory, backup rehearsal, SMTP/media/CORS validation, and super-admin bootstrap controls.
- Prioritize landing-page/acquisition UX, core workflow polish, lead-capture readiness, and focused frontend smoke coverage.

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

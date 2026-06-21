# Master Roadmap

This roadmap documents Wasilio from the initial foundation through the planned production and SaaS phases. Future engineers should use it to understand what has already been implemented, how the system evolved, what remains, and which documents provide deeper technical context.

## How To Use This Roadmap

- Start with the project history to understand the implemented platform shape.
- Use the current state section to understand what is production-adjacent today.
- Use `docs/product/launch-readiness-pivot.md` when preparing for merchant pilots or public acquisition.
- Use `docs/product/next-implementation-plan.md` for the current tactical sequence after the public frontend launch.
- Use the remaining phases to sequence future work.
- Use the architecture audit gate before moving from operational completion into commercialization or enterprise hardening.
- Use the linked architecture, ADR, phase, and audit documents for implementation details.

Primary supporting documents:

- `docs/phases/documentation-index.md`
- `docs/architecture/system-overview.md`
- `docs/architecture/event-sourcing.md`
- `docs/product/order-lifecycle.md`
- `docs/product/courier-workflow.md`
- `docs/product/launch-readiness-pivot.md`
- `docs/product/next-implementation-plan.md`
- `docs/technical-debt.md`

## Project History

### Phase 1: Foundation

Goal: establish Wasilio as a deterministic multi-tenant operational platform rather than a CRUD prototype.

Implemented:

- Modular monolith backend structure.
- Tenant, user, order, and domain event models.
- PostgreSQL persistence with Flyway migrations.
- Event store as the source of truth for order lifecycle changes.
- Orders projection as a read model.
- Docker local development stack.
- Initial frontend dashboard structure.

How it was built:

- Backend uses Spring Boot with API, application, domain, and infrastructure boundaries.
- Domain events are appended before read models are updated.
- Tenant isolation is enforced by `tenantId` on domain entities, events, and queries.

See:

- `docs/phases/phase-1-foundation.md`
- `docs/architecture/system-overview.md`
- `docs/architecture/ddd-boundaries.md`
- `docs/architecture/event-sourcing.md`

### Phase 1: Stabilization

Goal: make the foundation safer to run and easier to reason about.

Implemented:

- Authentication and authorization baseline.
- JWT security model.
- Correlation IDs for request tracing.
- Health checks.
- Docker local/production compose split.
- Initial production-readiness audits.
- Technical debt register.

How it was built:

- JWTs carry tenant and user identity.
- API requests resolve tenant context from authenticated user claims.
- Operational and security concerns are documented separately from feature roadmap items.

See:

- `docs/phases/phase-1-stabilization.md`
- `docs/architecture/security.md`
- `docs/audits/audit-001-initial-production-readiness.md`
- `docs/audits/audit-002-post-stabilization.md`

### Phase 2: Onboarding And Confirmation Operations

Goal: let real tenants enter the system and run COD confirmation workflows.

Implemented:

- Tenant onboarding.
- First admin user creation.
- Login throttling and onboarding abuse protection.
- Confirmation queue.
- Confirmation attempts.
- Callback scheduling.
- Callback queue.
- Callback resolution.
- Frontend onboarding, login, confirmation, and callback screens.

How it was built:

- Tenant onboarding creates the workspace and first admin atomically.
- Confirmation attempts are operational records tied to orders and tenants.
- Final confirmation or rejection appends lifecycle events.
- Callback scheduling remains operational data while lifecycle state remains event-sourced.

See:

- `docs/phases/phase-2-onboarding.md`
- `docs/phases/phase-2-confirmation.md`
- `docs/product/confirmation-workflow.md`
- `docs/product/callback-workflow.md`
- `docs/decisions/ADR-007-confirmation-attempts-operational-records.md`
- `docs/decisions/ADR-008-callback-scheduling-operational-records.md`

### Phase 2: Courier And Delivery Operations

Goal: complete the internal delivery workflow from confirmed order through courier assignment, pickup, delivery, or failure.

Implemented:

- Tenant-scoped courier management.
- Courier activation and deactivation.
- Assignment queue.
- Pickup queue.
- Delivery queue.
- Delivery outcome workflow.
- Delivery failure reason tracking.
- Basic courier performance metrics.
- Frontend courier, assignment, pickup, delivery, and performance screens.

How it was built:

- Couriers are internal tenant-scoped operational resources, not authenticated users.
- Assignment and pickup preserve event-sourced order lifecycle transitions.
- Delivery outcomes append existing `OrderDelivered` and `OrderDeliveryFailed` events.
- Failure reasons are stored as operational records while the order lifecycle remains event-sourced.
- Courier metrics are query-based over current projections.

See:

- `docs/product/courier-workflow.md`
- `docs/product/order-lifecycle.md`
- `docs/product/roadmap.md`
- `docs/technical-debt.md`

### Phase 2: Order Search And Filtering

Goal: make the order workspace usable when tenants have thousands of orders.

Implemented:

- Advanced tenant-scoped order search.
- Search by phone.
- Search by customer name.
- Search by full or partial order ID.
- Filter by courier.
- Multi-status filters.
- Created date range filters.
- Saved search views.
- Frontend advanced filter controls on the orders workspace.

How it was built:

- `GET /api/orders` remains the main tenant-scoped order listing endpoint.
- Search uses the orders projection read model, not event replay.
- Saved views are tenant-scoped operational preferences stored separately from order lifecycle state.
- Saved view filters are stored as JSON so the filter shape can evolve without a schema migration for every UI filter.

## Current State

Wasilio is no longer a prototype or MVP skeleton. The platform now has the core operational shape of a production order management system for COD and delivery operations.

Completed capabilities include:

- Multi-tenant architecture.
- Authentication and authorization.
- Event sourcing foundation.
- Order lifecycle.
- Confirmation operations.
- Callback scheduling.
- Courier management.
- Assignment queue.
- Pickup queue.
- Delivery queue.
- Delivery outcomes.
- Failure tracking.
- Courier performance metrics.
- Advanced order search and saved views.
- Unified order timeline.
- Frontend management UI.
- Docker deployment.
- Public frontend deployment on Cloudflare Pages at `wasilio.ma`.
- Brevo SMTP sender authentication and password-reset email delivery.
- Neon Postgres retained as the production database candidate for a future hosted backend.
- CI pipeline.
- Correlation IDs.
- Health checks.
- Documentation structure.
- Phase history.
- ADRs.
- Operational runbooks.

Approximate maturity:

- Completed production OMS foundation: 75-80%.
- Remaining work for real operational use: about 15%.
- Later SaaS commercialization and enterprise hardening: about 5% of product surface, but meaningful architecture effort.
- Current public deployment maturity: frontend-only public presence; hosted backend is intentionally deferred until pilot demand or a card-verified hosting account is acceptable.

## Execution Recommendation

Original operations-completion recommendation:

1. Customer Notes.
2. Exports.
3. Frontend E2E coverage.
4. User Management.

After those batches, pause feature work and perform a full architecture audit before continuing into monetization, integrations, or enterprise hardening.

Reason: at that point Wasilio should be usable by a real small-to-medium delivery operation. Work after that is primarily scale, commercial packaging, reliability, and enterprise hardening.

Launch-readiness pivot recommendation:

If the immediate goal is to publish, pilot, or sell Wasilio, temporarily follow `docs/product/launch-readiness-pivot.md` before returning to the operations-completion sequence. The launch path prioritizes internal admin, subscription status, manual Moroccan payment tracking, receipts, public landing/lead capture, SEO, and production trust hardening.

Current tactical recommendation:

Follow `docs/product/next-implementation-plan.md` first. The immediate sequence is landing/acquisition UX, local core-workflow polish, campaign readiness, and focused smoke coverage while backend hosting remains deferred.

## Phase 2: Operations Completion

Phase 2 should finish the internal operations workspace before adding new business or SaaS concerns.

### Batch 7: Order Search & Filtering

Purpose: allow operations teams to work with thousands of orders without relying on manual scanning.

Status: implemented.

Backend scope:

- Advanced tenant-scoped order search.
- Search by phone.
- Search by customer name.
- Search by order ID.
- Filter by courier.
- Filter by status.
- Filter by date range.
- Saved views for repeat operational queues.

Frontend scope:

- Dedicated order search page or upgraded orders page.
- Advanced filter controls.
- Saved view selector.
- Pagination that preserves filters.

Non-goals:

- Analytics dashboards.
- External search infrastructure unless the database approach becomes insufficient.
- Cross-tenant search.

### Batch 8: Order Timeline

Purpose: give operators and managers complete operational visibility into what happened to an order.

Status: implemented.

Backend scope:

- Complete event timeline endpoint.
- Confirmation history.
- Callback history.
- Courier assignment history.
- Pickup and delivery history.
- Failure history where available.

Frontend scope:

- Unified timeline view in order details.
- Clear event grouping by operational area.
- Timestamp and actor display where available.

Non-goals:

- Full audit center.
- Event editing.
- Event replay tooling.

### Batch 9: Customer Notes

Purpose: support teams need context that is separate from lifecycle events.

Backend scope:

- Add tenant-scoped customer or order note model.
- Add note.
- Edit note.
- Internal note visibility.
- Note audit trail.

Frontend scope:

- Notes panel on order details.
- Create and edit note interactions.
- Display note author and timestamps.

Non-goals:

- Customer-facing notes.
- Notifications.
- Rich text or attachments.

### Batch 10: Exports

Purpose: operations teams regularly export data for couriers, finance, reconciliation, and offline workflows.

Backend scope:

- CSV export.
- Filtered order export.
- Courier export.
- Delivery export.

Frontend scope:

- Export actions from filtered operational views.
- Export status and error handling.

Non-goals:

- Scheduled reports.
- BI dashboards.
- Data warehouse integration.

## Phase 3: Business Layer

Phase 3 turns the operational system into a stronger SaaS product for teams.

### Batch 1: User Management

Current state: tenant onboarding creates the first admin user. There is no full tenant user administration workflow.

Backend scope:

- Invite users.
- Deactivate users.
- Reset passwords.
- Role management.

Roles:

- Admin.
- Manager.
- Agent.
- Operations.

Frontend scope:

- User list.
- Invite user form.
- User details.
- Deactivate/reactivate controls.
- Role assignment controls.

### Batch 2: Tenant Settings

Backend scope:

- Tenant company settings.
- Branding fields.
- Timezone.
- Order defaults.

Frontend scope:

- Tenant settings page.
- Branding/company form.
- Timezone and operational defaults.

### Batch 3: Audit Center

Wasilio already has domain events and operational records. This batch exposes that history for administrative review.

Backend scope:

- Audit UI read models or endpoints.
- Actor tracking improvements where gaps remain.
- User activity history.

Frontend scope:

- Audit center page.
- Filters by actor, action, date range, and resource.

### Batch 4: Notifications

Internal notifications should come before external customer/courier messaging.

Backend scope:

- Confirmation reminders.
- Callback reminders.
- Delivery alerts.

Frontend scope:

- Internal notification list.
- Alert badges or counts in operational queues.

Non-goals:

- SMS/WhatsApp integrations.
- Customer-facing notifications.
- Courier mobile push notifications.

## Launch Readiness Pivot

Status: active path for merchant pilot and public acquisition preparation.

Use `docs/product/launch-readiness-pivot.md` as the detailed launch-readiness source of truth. Use `docs/product/next-implementation-plan.md` for the current tactical order.

Summary:

- L1: Internal admin console for tenant management.
- L2: Plans, manual cash/bank-transfer payments, and receipts.
- L3: Public landing site and lead capture first slice implemented; frontend is live on Cloudflare Pages. UX, campaign validation, and tracking setup remain.
- L4: Production trust hardening; hosted backend, production backups, monitoring, and full smoke checks remain deferred until hosting is funded or card-verified.
- L5: Controlled public beta.

Return to the original roadmap after L1-L4, then continue customer notes, exports, E2E coverage, user management, architecture audit, and deterministic risk scoring.

## Phase 4: SaaS Monetization

Phase 4 should wait until the core operations workflow is stable and useful. If the business is preparing for public launch sooner, use the launch-readiness pivot first and keep Stripe/online billing deferred until manual billing and receipts work.

### Subscription Management

- Plans.
- Billing status.
- Tenant limits.

### Usage Metering

- Orders per month.
- Users.
- Storage or operational record volume.

### Stripe Integration

- Checkout.
- Billing portal.
- Subscription webhooks.

Non-goals:

- Custom enterprise contracts.
- Multi-currency complexity beyond initial target market requirements.

## Phase 5: Enterprise Hardening

Phase 5 is mostly architecture and operations hardening. Some items may be pulled forward if production risk requires it.

### Outbox Pattern

Needed for durable asynchronous processing.

Scope:

- Durable outbox table.
- Retry worker.
- Dead-letter handling.
- Operational visibility into stuck messages.

### Event Upcasters

Needed before long-term production event evolution.

Scope:

- Event schema migration strategy.
- Upcaster registry.
- Tests for old event payload compatibility.

### Projection Monitoring

Scope:

- Projection lag metrics.
- Rebuild monitoring.
- Projection failure visibility.

### Backup Automation

Current state: backup requirements are documented.

Needed:

- Automated backup execution.
- Restore drills.
- Backup verification.

### Security Hardening

Current auth is acceptable for MVP and early internal production use. It still needs session hardening before broader SaaS commercialization.

Scope:

- Refresh tokens.
- Token revocation.
- Session management.
- MFA as a future option.

## Explicitly Deferred Work

Do not start these until the operations completion path and architecture audit are done:

- Billing and subscriptions.
- Analytics dashboards.
- External courier integrations.
- Live delivery tracking.
- Route optimization.
- Customer notification channels.
- Marketplace integrations.

## Architecture Audit Gate

After Phase 2 Batch 9 and Phase 3 Batch 1, run a full architecture audit before more feature work.

Audit focus:

- Event sourcing consistency.
- Projection rebuild and monitoring.
- Tenant isolation.
- Authorization coverage.
- Operational data volume assumptions.
- API consistency.
- Frontend state and routing complexity.
- Test coverage gaps.
- Deployment and backup readiness.

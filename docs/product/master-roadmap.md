# Master Roadmap

This roadmap captures the remaining Nexora implementation path after the core operational foundation. It is intended to prevent future work from becoming a sequence of disconnected feature prompts.

## Current State

Nexora is no longer a prototype or MVP skeleton. The platform now has the core operational shape of a production order management system for COD and delivery operations.

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
- Frontend management UI.
- Docker deployment.
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

## Execution Recommendation

The next implementation cycle should prioritize:

1. Order Search & Filtering.
2. Order Timeline.
3. Customer Notes.
4. User Management.

After those batches, pause feature work and perform a full architecture audit before continuing into monetization, integrations, or enterprise hardening.

Reason: at that point Nexora should be usable by a real small-to-medium delivery operation. Work after that is primarily scale, commercial packaging, reliability, and enterprise hardening.

## Phase 2: Operations Completion

Phase 2 should finish the internal operations workspace before adding new business or SaaS concerns.

### Batch 7: Order Search & Filtering

Purpose: allow operations teams to work with thousands of orders without relying on manual scanning.

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

Nexora already has domain events and operational records. This batch exposes that history for administrative review.

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

## Phase 4: SaaS Monetization

Phase 4 should wait until the core operations workflow is stable and useful.

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

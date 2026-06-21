# Technical Debt Register

Debt is classified by production risk and sequencing impact.

## Critical

### Outbox And Retry

Current state: events are persisted and then published through Spring application events. Projection failure leaves committed events that require manual rebuild.

Risk: projection drift and missed asynchronous work once more consumers exist.

Target: add transactional outbox, retry worker, dead-letter handling, and operational visibility.

### Token Hardening

Current state: JWT access tokens use environment-provided secret and 24-hour default expiration.

Risk: weak rotation/revocation posture for production.

Target: define key rotation, shorter access-token lifetime, stronger secret storage, and token validation hardening.

### Refresh Tokens

Current state: no refresh-token flow or revocation store.

Risk: long access-token lifetimes become the only way to avoid frequent logins.

Target: add refresh tokens, rotation, reuse detection, revocation, and logout invalidation.

## High

### Redis Or Distributed Throttling

Current state: login and onboarding throttling are in-memory.

Risk: limits reset on restart and are not shared across backend replicas.

Target: Redis-backed limiter or trusted gateway/WAF rate limiting.

### Backup Automation

Current state: backup and restore are documented, and a `scripts/backup-postgres.sh` helper creates and verifies local PostgreSQL dumps. Scheduling, off-host encrypted sync, alerts, and restore drills are still operational setup.

Risk: missed backups, host-local backup loss, and untested restores if production operations do not install scheduling and off-host storage.

Target: scheduled encrypted backups, off-host storage, alerts, restore drills, and documented RPO/RTO updates.

### Event Upcasters

Current state: events have `event_schema_version`, but no upcaster pipeline.

Risk: payload evolution can break replay and projection rebuilds.

Target: versioned payload mapping and tested upcasters before event schema changes.

### Frontend E2E Tests

Current state: frontend has lint/build scripts and a Playwright smoke suite for landing lead capture, super-admin lead follow-up, and same-browser auth isolation. It does not yet cover live backend workflows in CI.

Risk: regressions in login, signup, order creation, confirmation, and callbacks.

Target: expand Playwright coverage for live login, signup, order creation, confirmation, callbacks, billing, and run it in CI.

## Medium

### Courier Integrations

Current state: internal courier assignment, pickup, delivery outcomes, failure reasons, and basic courier metrics exist. External integrations are not implemented.

Risk: merchant teams still need manual coordination outside Wasilio for real courier networks, tracking updates, and webhook reconciliation.

Target: courier integration abstraction, webhook ingestion, external tracking sync, and delivery failure reason analytics.

### Analytics

Current state: no analytics dashboards beyond operational lists.

Risk: merchants cannot measure confirmation rate, callback burden, delivery success, or failure causes.

Target: reporting projections and dashboards for operational KPIs.

### Callback Notifications

Current state: callbacks are queryable but do not notify operators.

Risk: due callbacks rely on users checking the queue.

Target: reminder worker, SLA indicators, and optional notification channels.

## Low

### Billing

Current state: first-slice subscription plans, tenant subscription status, manual cash/bank-transfer payment records, and receipt records exist. Usage enforcement, online checkout, accounting-grade invoicing, and automated billing provider integration are not implemented.

Risk: commercial rollout still requires manual account management and reconciliation.

Target: usage tracking, billing status automation, invoice/accounting hardening, and billing provider integration when online payment becomes necessary.

### Admin Support Console

Current state: no internal support console for tenant lookup or operational support.

Risk: support requires direct database access or ad hoc scripts.

Target: internal admin UI with strict authorization and audit logging.

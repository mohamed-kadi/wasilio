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

Current state: backup and restore are documented, but execution is manual.

Risk: missed backups and untested restores.

Target: scheduled encrypted backups, off-host storage, alerts, restore drills, and documented RPO/RTO updates.

### Event Upcasters

Current state: events have `event_schema_version`, but no upcaster pipeline.

Risk: payload evolution can break replay and projection rebuilds.

Target: versioned payload mapping and tested upcasters before event schema changes.

### Frontend E2E Tests

Current state: frontend has lint/build scripts but no browser workflow tests.

Risk: regressions in login, signup, order creation, confirmation, and callbacks.

Target: Playwright or equivalent E2E suite in CI.

## Medium

### Courier Integrations

Current state: internal courier assignment, pickup, delivery outcomes, failure reasons, and basic courier metrics exist. External integrations are not implemented.

Risk: merchant teams still need manual coordination outside Nexora for real courier networks, tracking updates, and webhook reconciliation.

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

Current state: no billing, subscriptions, invoices, or usage enforcement.

Risk: commercial rollout requires manual account management.

Target: plan model, subscription status, usage tracking, and billing provider integration.

### Admin Support Console

Current state: no internal support console for tenant lookup or operational support.

Risk: support requires direct database access or ad hoc scripts.

Target: internal admin UI with strict authorization and audit logging.

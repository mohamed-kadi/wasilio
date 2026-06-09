# Implementation Guardrails

This document is the architecture checklist for hardening existing workflows and adding new ones. Use it before changing order, confirmation, courier, analytics, or future scoring behavior.

## Architectural Shape

Nexora is a modular monolith:

- Spring Boot backend owns business workflows and persistence.
- PostgreSQL stores tenants, users, domain events, projections, and operational records.
- React frontend consumes API read models and sends explicit workflow commands.
- Docker compose is the local runtime path; manual backend/frontend runs are development alternatives.

The goal is not to split services yet. The goal is to keep module boundaries clear enough that future extraction, integrations, and analytics do not require rewriting core workflows.

## Source Of Truth Rules

Order lifecycle state is event-sourced.

- `domain_events` is the authoritative write-side record for order state.
- `orders` is a projection/read model and must not become the source of lifecycle truth.
- State-changing lifecycle commands must go through `OrderLifecycleService`.
- Controllers should not directly mutate order state.
- Final confirmation, rejection, assignment, pickup, delivery, and failure must append domain events.
- Projection bugs should be fixed in projection handling or rebuilt from events, not patched by hand-updating lifecycle fields.

Operational records support workflows but do not replace lifecycle truth:

- `confirmation_attempts` records call-center activity and callback scheduling.
- `delivery_failures` records delivery failure details.
- Saved views, future notes, future exports, and future scores are operational/read-side data unless they intentionally emit lifecycle events.

## Tenant Isolation Rules

Every tenant-owned query and command must be scoped by tenant.

- Resolve tenant identity from the authenticated JWT principal.
- Pass `tenantId` into application services and repositories.
- Repository methods that read tenant-owned records must include `tenantId`.
- Cross-tenant IDs must return not found or validation errors, never another tenant's data.
- New tables that store tenant-owned data need a `tenant_id` column and tenant-based indexes.
- Frontend state must never be trusted for tenant selection.

## Backend Layer Rules

Controllers:

- Authenticate and authorize.
- Parse request parameters.
- Validate request shape and simple parameter consistency.
- Resolve current tenant.
- Delegate workflow decisions to application services.

Application services:

- Own workflow orchestration.
- Own transactions.
- Call lifecycle services for lifecycle changes.
- Create operational records when needed.
- Keep controller-specific response formatting out of core workflow logic.

Repositories:

- Keep tenant-scoped query contracts explicit.
- Avoid nullable JPQL/PostgreSQL filters like `:param is null` for timestamps or strings when Hibernate may infer the wrong SQL type. Prefer `:paramEnabled = false or ...`.
- Keep read-model query complexity in repositories or dedicated read services, not controllers.

Domain model and events:

- Add a domain event only for a durable business fact.
- Add an operational table when the data is workflow support, analytics input, UI preference, notes, or scheduling metadata.
- Version new event payloads with `event_schema_version`.

## Projection Rules

Projection handlers must be idempotent.

- Record processed event IDs for projections that can receive duplicate delivery.
- Projection rebuild must be possible from `domain_events`.
- Do not store projection-only data in event payloads just to satisfy a screen.
- If a screen needs combined history, create a read service like `OrderTimelineService` that merges events and operational records.

Current rebuild behavior clears the `orders` projection and replays events. Run it only as a maintenance action until projection monitoring and outbox/retry are implemented.

## Workflow Hardening Checklist

For every workflow, confirm:

- Command endpoint exists and is authenticated.
- Tenant isolation is tested.
- Invalid state transitions are rejected.
- Cross-tenant resource IDs are rejected.
- Final lifecycle changes append domain events.
- Operational records are created only where they add workflow value.
- Query endpoints are paginated.
- Filters validate date ranges, page, and size.
- PostgreSQL nullable filter behavior is tested or guarded with enabled flags.
- Frontend mutations invalidate all affected TanStack Query keys.
- Frontend shows loading, empty, success, and error states.
- Integration tests cover the happy path and at least one invalid/cross-tenant path.

## Frontend Rules

The frontend is a workflow UI, not a business-rule engine.

- Backend owns permissions and state transition validation.
- Frontend routes are protected by auth state but backend auth remains authoritative.
- Use `src/api/client.ts` for API contracts.
- Use TanStack Query for server state.
- Invalidate related queues and details after mutations.
- Keep route pages focused on workflow composition; move shared API types/helpers into the API client.

Critical workflows should receive browser-level E2E coverage before relying on them in production:

- Login/logout.
- Signup/onboarding.
- Order creation.
- Confirmation attempts and callbacks.
- Courier assignment.
- Pickup and delivery outcomes.
- Search/filter/saved views.

## Future Scoring And Intelligence Rules

Risk scoring should be added as a read-side/business-intelligence capability first, not as a replacement for lifecycle state.

Recommended shape for Risk Scoring v1:

- Store score snapshots in a tenant-scoped operational table or projection.
- Include numeric score, risk band, reasons, algorithm version, and calculated timestamp.
- Base reasons on existing facts: confirmation attempts, callbacks, failure history, courier performance, city/area, order amount, and timing.
- Keep scoring explainable and deterministic before adding machine learning.
- Never let a score silently mutate lifecycle state.
- If a score should block dispatch, expose that as an explicit workflow decision that an operator can accept or override with audit trail.

This lets Nexora become intelligent without corrupting the event-sourced order lifecycle.

## When To Add A New Module

Add a new package/service boundary when the feature owns its own language, data, and lifecycle.

Good future candidates:

- Customer/order notes.
- Exports.
- Risk scoring and analytics.
- Notifications.
- External courier integrations.
- Billing.

Do not add a new boundary just to avoid touching an existing service. If the feature is a lifecycle transition, it belongs near `OrderLifecycleService`. If it is a read model, keep it near repository/read-service patterns.

## Current Hardening Priorities

Before larger intelligence or SaaS work:

1. Customer/order notes.
2. Exports.
3. Frontend E2E tests.
4. User management.
5. Architecture audit gate.
6. Deterministic risk scoring v1.

This order keeps the operational system stable before adding decision automation.

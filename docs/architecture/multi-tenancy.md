# Multi-Tenancy

Nexora uses row-level tenant isolation in a single PostgreSQL database. Tenant identity is explicit in domain entities, domain events, projections, and operational records.

## Tenant Identity

`tenants.id` is the tenant identifier. Users belong to a tenant through `users.tenant_id`. Authenticated requests derive the active tenant from the JWT-authenticated principal, not from caller-supplied request body fields.

## Tenant-Scoped Data

Tenant-scoped tables include:

- `users`
- `orders`
- `domain_events`
- `projection_processed_events`
- `confirmation_attempts`

Repository methods used by API workflows include tenant filters such as `findByIdAndTenantId`, tenant-scoped queue queries, and tenant-scoped event stream loading.

## Isolation Rules

- Do not trust client-provided tenant IDs for authenticated business actions.
- Every aggregate stream query must include `tenantId`.
- Every projection query exposed to merchants must include `tenantId`.
- Every operational record query exposed to merchants must include `tenantId`.
- Cross-tenant identifiers must be treated as invalid or not found.

## Onboarding

Tenant onboarding creates a tenant and first ADMIN user in one transactional workflow when `APP_ONBOARDING_ENABLED=true`. Production compose requires this flag to be set explicitly, allowing closed deployments to disable public signup after initial setup.

## Current Limits

The database does not currently use PostgreSQL Row-Level Security. Isolation relies on application-layer tenant filters and schema constraints. This is acceptable for the current modular-monolith MVP, but RLS or stronger repository guardrails should be evaluated as the system grows.

# ADR-003: Tenant Isolation Strategy

## Status

Accepted.

## Context

Nexora serves multiple merchants. Tenant data must not leak across accounts, but the MVP does not yet need physically separate databases per tenant.

## Decision

Use a shared PostgreSQL database with explicit `tenant_id` columns and tenant-scoped repository queries. Authenticated request tenant context comes from the JWT principal.

## Consequences

- Efficient MVP operations with one database.
- Tenant-aware indexes support common query paths.
- Application code must consistently enforce tenant filters.
- PostgreSQL Row-Level Security remains a future hardening option.

## Alternatives Considered

- Database per tenant: stronger isolation, but higher operational complexity for early product discovery.
- Schema per tenant: more isolation than shared tables, but migration and onboarding complexity are higher.
- PostgreSQL RLS immediately: valuable, but deferred until application boundaries stabilize.

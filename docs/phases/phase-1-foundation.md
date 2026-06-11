# Phase 1 Foundation

## Goal

Establish Wasilio as a deterministic, tenant-aware COD operations platform with a backend, database schema, event-sourced order lifecycle, and frontend dashboard foundation.

## Major Changes

- Created Spring Boot backend and Vite React frontend.
- Added tenants, users, orders, and domain events.
- Introduced JWT authentication and protected dashboard routes.
- Implemented order lifecycle commands and event payloads.
- Added `orders` projection for query performance.
- Added Docker Compose runtime with backend, frontend, and PostgreSQL.

## Migrations Added

- `V1__initial_schema.sql`: tenants, users, orders, and domain events.
- `V2__event_sequence_constraints.sql`: aggregate sequence and event schema version.
- `V3__query_performance_indexes.sql`: tenant and query indexes.

## Commits

The oldest foundation commits are not all visible in the current short history. Use `git log --oneline --all` for a full archive when needed.

## Risks Fixed

- Avoided mutable order state as sole source of truth by using domain events.
- Added aggregate sequence constraints to reduce concurrent write corruption.
- Added query indexes for tenant-scoped order and event access.

## Remaining Gaps

- Event upcasters are not implemented.
- Outbox/retry is not implemented.
- Frontend E2E coverage is not implemented.

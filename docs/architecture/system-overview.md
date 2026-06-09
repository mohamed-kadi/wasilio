# System Overview

Nexora is a multi-tenant COD operations platform for Moroccan e-commerce merchants. The current implementation is a modular monolith with a Spring Boot backend, PostgreSQL persistence, and a Vite React frontend.

## Runtime Shape

- `frontend`: React dashboard served by the frontend container in Docker, or by Vite during local development.
- `backend`: Spring Boot API exposing authentication, onboarding, order lifecycle, and confirmation operations.
- `postgres`: PostgreSQL database containing tenant data, users, domain events, projections, and operational records.

## Backend Structure

The backend is organized by technical layer under `backend/src/main/java/com/nexora/backend`:

- `api`: REST controllers and API exception handling.
- `application`: use-case orchestration and transactional workflow services.
- `application/projection`: projection rebuild and processed-event tracking.
- `domain/model`: entities, value objects, roles, statuses, and confirmation enums.
- `domain/event`: domain event entity, event store contract, repository, and concurrency exception.
- `domain/event/payload`: immutable event payload records.
- `domain/repository`: Spring Data repository boundaries for domain and read-model persistence.
- `infrastructure`: persistence implementation, JWT security, throttling, CORS, correlation IDs, and configuration.

Controllers are intentionally thin. They authenticate the request, derive tenant context from the JWT principal, validate request-level shape, and delegate to application services.

## Source Of Truth

The authoritative order state is the append-only `domain_events` stream. The `orders` table is a read model maintained from events for query performance. Confirmation attempts and callback scheduling are operational records that support call-center workflow; final order state still comes from lifecycle events.

## Docker Local And Production Split

The base `docker-compose.yml` defines the services and defaults to Flyway migrations only. The local override, `docker-compose.override.yml`, enables developer defaults:

- database credentials with local fallbacks
- `db/seed` loading
- public onboarding enabled
- permissive local CORS origins
- default local JWT secret

The production overlay, `docker-compose.prod.yml`, requires explicit database credentials, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`, and `APP_ONBOARDING_ENABLED`. It excludes `db/seed`, keeping seeded development users out of production.

## Current Capability Map

- Tenant onboarding with first ADMIN user when explicitly enabled.
- JWT login and tenant-scoped authenticated requests.
- Order lifecycle commands backed by domain events.
- Orders projection with idempotent processed-event tracking.
- Manual projection rebuild flag for maintenance recovery.
- COD confirmation queue, attempts, and callback scheduling.
- Courier management, assignment, pickup, delivery, and failure operations.
- Advanced order search, saved views, and unified order timeline.
- Basic in-memory throttling for login and onboarding.
- Correlation IDs carried into logs, responses, errors, and domain events.

## Current Limits

- No distributed outbox or retry worker for projection/event dispatch failures.
- No refresh-token model or token revocation store.
- Abuse throttling is process-local and must be replaced or backed by Redis before multi-node deployment.
- Event payloads are versioned but there are no event upcasters yet.
- External courier integrations, billing, analytics dashboards, notifications, and risk scoring are planned but not implemented.

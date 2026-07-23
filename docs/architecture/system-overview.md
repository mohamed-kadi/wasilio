# System Overview

Wasilio is a multi-tenant COD operations platform for Moroccan e-commerce merchants. The current implementation is a modular monolith with a Spring Boot backend, PostgreSQL persistence, and a Vite React frontend.

## Runtime Shape

- `frontend`: React dashboard served by the frontend container in Docker, by Vite during local development, or by Cloudflare Pages for the current public frontend-only deployment.
- `backend`: Spring Boot API exposing authentication, onboarding, order lifecycle, and confirmation operations.
- `postgres`: PostgreSQL database containing tenant data, users, domain events, projections, and operational records.

Current public deployment note: `wasilio.ma` is live on Cloudflare Pages, but the hosted backend is intentionally deferred. Treat the public site as a frontend/acquisition presence until a backend host is selected and connected.

## Product Architecture Direction

Wasilio is the operating system for Moroccan COD ecommerce. It is not trying to replace YouCan, Shopify, WooCommerce, or other storefront builders. Wasilio Core owns order operations after order intent enters the platform.

Target flow:

1. A customer, operator, CSV import, marketplace, ecommerce platform, WhatsApp lead, or Wasilio storefront produces order intent.
2. A source adapter captures the raw inbound shape and source metadata.
3. Order Ingestion normalizes the payload into a stable Wasilio create-order command.
4. Order Lifecycle appends authoritative lifecycle events.
5. Operational contexts handle confirmation, callback, assignment, pickup, delivery, failure, recovery, analytics, and future intelligence.

The Wasilio storefront, when implemented, should be a thin customer-facing client. It can present Catalog data and collect orders, but it must not own confirmation, delivery, COD, recovery, marketing attribution truth, or customer intelligence.

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

External source data is not lifecycle truth. Source-specific payloads, campaign details, and platform identifiers should be preserved by Order Ingestion, Marketing Attribution, and integration records, then linked to orders without making lifecycle events depend on one sales channel.

## Docker Local And Production Split

The base `docker-compose.yml` defines the services and defaults to Flyway migrations only. The local override, `docker-compose.override.yml`, enables developer defaults:

- database credentials with local fallbacks
- `db/seed` loading
- public onboarding enabled
- permissive local CORS origins
- default local JWT secret

The production overlay, `docker-compose.prod.yml`, requires explicit database credentials, `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`, email settings, media public URL, browser API URL, landing-engine URL, and `APP_ONBOARDING_ENABLED`. It excludes `db/seed`, keeping seeded development users out of production.

In the recommended single-host trial topology, the frontend/Nginx container is the public entrypoint. The backend container stays internal to the Docker network, and Nginx proxies `/api`, `/media`, and health-only Actuator routes to it.

## Current Capability Map

- Tenant onboarding with first ADMIN user when explicitly enabled.
- JWT login and tenant-scoped authenticated requests.
- Order lifecycle commands backed by domain events.
- Order Ingestion foundation with inbound records, idempotency keys, source metadata, and rejection tracking.
- Orders projection with idempotent processed-event tracking.
- Manual projection rebuild flag for maintenance recovery.
- COD confirmation queue, attempts, and callback scheduling.
- Courier management, assignment, pickup, delivery, and failure operations.
- Advanced order search, saved views, and unified order timeline.
- Tenant product catalog, product media upload, storefront settings, and public product readiness.
- Public storefront product and order-intent endpoints for landing-engine.
- Order intelligence snapshots, score reasons, and append-only score audit history.
- Staff workspace for merchant workspaces, subscription plans, manual payments, receipts, financial export, and demo request conversion.
- Public landing page, demo request capture, campaign attribution fields, and legal pages.
- Basic in-memory throttling for login and onboarding.
- Correlation IDs carried into logs, responses, errors, and domain events.

## Target Capability Map

- Richer Catalog context for variants, product FAQs, testimonials, video, and deeper storefront-ready offer data.
- Storefront presentation layer that continues to read Catalog data and submit order intent.
- Order Ingestion boundary for CSV, ecommerce platform, marketplace, WhatsApp, and lead-form sources beyond the implemented manual and Wasilio storefront sources.
- Integration adapters that preserve raw external payloads and translate them into Wasilio-owned commands.
- Marketing Attribution context for campaign, channel, UTM, referrer, click, lead source, and conversion linkage data.
- Customer Profile context for reusable customer identity and address history across orders.
- Customer Intelligence context for broader explainable repeat-customer, risk, delivery, and segmentation signals beyond the current order intelligence slice.
- Analytics and reporting over lifecycle events, projections, operational records, attribution, and intelligence snapshots.
- Notifications context for internal reminders and future SMS, WhatsApp, email, or push workflows.

## Current Limits

- Public frontend is live, but online app/API workflows are not production-complete until a hosted backend and production database connection are deployed.
- Product media is stored through the local filesystem implementation with Docker volume persistence. Object storage, CDN behavior, and backup policy for media remain production hardening items.
- Source-specific integration adapters for CSV imports, ecommerce platforms, marketplaces, WhatsApp intake, and lead-form order intake remain future work.
- No distributed outbox or retry worker for projection/event dispatch failures.
- No refresh-token model or token revocation store.
- Abuse throttling is process-local and must be replaced or backed by Redis before multi-node deployment.
- Event payloads are versioned but there are no event upcasters yet.
- External courier integrations, accounting-grade billing, analytics dashboards, notification workers, and broader customer intelligence remain future work.

# Operational Baseline

## Health Checks

The backend exposes Spring Actuator health probes:

- Liveness: `GET /actuator/health/liveness`
- Readiness: `GET /actuator/health/readiness`
- Aggregate health: `GET /actuator/health`

Only health endpoints are exposed over HTTP. The application security config permits these health paths without JWT authentication so container platforms can poll them.

## Logging

The backend writes console logs with a consistent key-value Logback pattern. Each line includes:

- timestamp
- level
- logger
- correlationId
- tenantId when a JWT-authenticated request is available
- message

JSON logs are still recommended for production ingestion, but the current pattern keeps the fields stable for an MVP stdout log pipeline.

## Correlation IDs

The API uses `X-Correlation-ID` for request tracing. Incoming valid UUID correlation IDs are accepted. When the header is missing or invalid, the backend generates a new UUID.

For every request, the backend:

- adds the correlation ID to MDC as `correlationId`
- returns `X-Correlation-ID` in the response headers
- includes `correlationId` in API problem/error responses
- stores the active ID in `domain_events.correlation_id` when a domain event is created

The `domain_events.correlation_id` column is a UUID, so non-UUID inbound values are replaced with a generated UUID rather than being persisted verbatim.

## CORS

Production CORS must be configured with explicit allowed origins. Wildcard origins are not used.

Set `CORS_ALLOWED_ORIGINS` to a comma-separated list, for example:

```text
CORS_ALLOWED_ORIGINS=https://wasilio.ma
```

Local Docker Compose development defaults are defined in `docker-compose.override.yml` and documented in `.env.example`:

```text
http://localhost,http://127.0.0.1,http://localhost:5173,http://127.0.0.1:5173
```

Production compose requires `CORS_ALLOWED_ORIGINS` and fails configuration if it is missing.

## Controlled Merchant Trial Environment Inventory

Use `docs/deployment/environment-inventory.md` before preparing a controlled merchant trial. That inventory separates:

- local `.env` values used only by developer Docker Compose
- backend host secrets and config
- Cloudflare Pages public build variables
- one-time super-admin bootstrap values
- smoke-test-only operator variables

Validate a host-only trial env file without printing secret values:

```bash
./scripts/trial-env-check.sh /etc/wasilio/trial.env
```

Then run production Compose config validation with the same env file before deploy:

```bash
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml config
```

## Tenant Onboarding

Tenant onboarding is controlled by `APP_ONBOARDING_ENABLED`. The backend default is `false`, local Docker Compose development enables it, and production compose requires the variable to be set explicitly.

Use `APP_ONBOARDING_ENABLED=true` only when public tenant signup is intentionally open or during a controlled first-tenant setup window. Use `APP_ONBOARDING_ENABLED=false` for closed/private deployments after the initial ADMIN account exists.

The local development seed remains limited to `docker-compose.override.yml` through `SPRING_FLYWAY_LOCATIONS=classpath:db/migration,classpath:db/seed`. Production compose uses only `classpath:db/migration`, so the seeded `admin@example.com` account is not created in production.

## Trial Account Ownership Audit

Before a trial merchant receives access, confirm users are attached to the intended workspaces. Wasilio currently uses `users.tenant_id` as the workspace membership link. There is no full team-invite management flow yet, so each trial workspace should normally have one intended owner/admin login.

Run the read-only audit from the deployment host:

```bash
POSTGRES_USER="<production-user>" \
POSTGRES_DB="nexora" \
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml" \
./scripts/trial-account-audit.sh
```

Review every row under `Trial review flags` before merchant handoff. The expected early-trial shape is:

- `SUPER_ADMIN` users belong to the internal staff workspace.
- Merchant `ADMIN` or `MERCHANT` users belong to merchant workspaces only.
- Each trial merchant workspace has an intended owner/admin login.
- Extra merchant logins are deliberate and documented until team management is implemented.
- Users that appear in headers, receipts, and audit screens have display names.

## Public Site And Demo Request Capture

The public landing page is served at `/`. Authenticated merchant workflows live under `/app`, while Wasilio staff operations live under `/admin/billing`.

Current public deployment mode: the frontend is live on Cloudflare Pages at `wasilio.ma`, but a hosted backend API is intentionally deferred. Demo request capture and authenticated workflows require a running backend; for now, validate those flows locally unless a backend host has been connected.

Production frontend builds require public build-time values:

```text
VITE_PUBLIC_SITE_URL=https://wasilio.ma
VITE_PUBLIC_SUPPORT_EMAIL=support@wasilio.ma
VITE_PUBLIC_WHATSAPP_URL=https://wa.me/212600000000
VITE_PUBLIC_META_PIXEL_ID=
```

Only values intended for public browser exposure should use the `VITE_PUBLIC_` prefix. Do not put backend secrets, SMTP passwords, database credentials, or JWT secrets in Vite variables.

Demo request capture flow:

- Anonymous visitors submit `POST /api/marketing/leads`.
- Campaign fields preserve `utm_*`, `fbclid`, `gclid`, `ref`, and browser referrer up to the stored field length.
- Wasilio staff users review demo requests from `/admin/billing?section=leads`.
- Super-admin users can update request status, next follow-up timestamp, and internal notes.
- Super-admin users can convert qualified requests into `TRIALING` merchant workspaces with a first merchant owner account.
- Meta Pixel is loaded only when `VITE_PUBLIC_META_PIXEL_ID` is configured.

Before paid traffic, confirm `frontend/public/sitemap.xml` uses the final production domain and verify that legal pages are reachable:

- `/terms`
- `/privacy`
- `/payment-refund-policy`

## Deployment Smoke Checklist

Run this checklist after every production deployment and before sending paid traffic to the public landing page.

Use `docs/deployment/testing-and-deployment-runbook.md` first to choose the correct operating mode. The checklist below is the technical smoke subset after a deployment has been selected.

For the current frontend-only Cloudflare Pages deployment, run items 1, 2, 5, and 6. Run the backend-dependent items only after a hosted backend API is deployed and `VITE_API_BASE_URL` points to it.

1. Run `cd frontend && npm run smoke` before publishing frontend changes. On a fresh machine, run `npx playwright install chromium` once first.
2. Open `/` and confirm the public landing page renders with the final brand, support email, WhatsApp link, and no development placeholder contact values.
3. Submit a demo request with a test `utm_source=smoke` URL and confirm it appears in `/admin/billing?section=leads`.
4. Update that request to `Contacted`, add an internal note, and confirm the change persists after refresh.
5. Open `/robots.txt` and `/sitemap.xml` and confirm they are reachable.
6. Open `/terms`, `/privacy`, and `/payment-refund-policy`.
7. Log in as `SUPER_ADMIN`, open `/admin/billing`, and confirm merchant workspaces, plans, payments, receipts, and demo requests load from the staff sidebar.
8. Log in as a merchant, open `/app`, create a test order, request confirmation, record a confirmation attempt, and verify the order timeline.
9. Request a password reset and confirm the email delivery mode sends or logs the expected reset link.
10. Verify `/actuator/health/readiness` returns healthy through the production ingress.
11. Confirm production compose uses only `classpath:db/migration` and that seed accounts are not present.
12. Upload product media and confirm the returned public URL resolves through `/media`.
13. Capture a fresh database backup and record the backup artifact name for the deployment.

The live backend smoke helper covers the executable subset of these checks:

```bash
WASILIO_API_BASE_URL="https://<backend-origin>" \
WASILIO_SUPER_ADMIN_EMAIL="<staff-email>" \
WASILIO_SUPER_ADMIN_PASSWORD="<staff-password>" \
node scripts/live-backend-smoke.mjs
```

Lead capture, password reset, merchant order creation, and non-final confirmation attempts are opt-in through environment flags documented in `docs/deployment/testing-and-deployment-runbook.md`.

## Abuse Protection And Security Audit Logs

The backend has an MVP in-memory throttling layer for public security-sensitive endpoints.

Login throttling applies to `POST /api/auth/login`. Failed login attempts increment counters for both normalized email and remote IP. A successful login clears the email counter, but it does not clear the remote IP counter because that counter protects against credential stuffing across many accounts.

Onboarding throttling applies to valid `POST /api/onboarding/tenants` requests. Attempts increment counters for admin email and remote IP before tenant creation is attempted, so both successful onboarding and rejected onboarding count against the limit.

Configuration:

```text
APP_SECURITY_THROTTLING_ENABLED=true
APP_LOGIN_THROTTLE_MAX_ATTEMPTS=5
APP_LOGIN_THROTTLE_WINDOW=PT10M
APP_LOGIN_THROTTLE_LOCKOUT=PT15M
APP_ONBOARDING_THROTTLE_MAX_ATTEMPTS=3
APP_ONBOARDING_THROTTLE_WINDOW=PT1H
APP_ONBOARDING_THROTTLE_LOCKOUT=PT1H
```

Durations use Spring Boot duration syntax. ISO-8601 values such as `PT10M` and `PT1H` are recommended for environment variables.

Throttled requests return `429 Too Many Requests` and a `Retry-After` header. The current implementation stores counters in process memory, so counters reset on application restart and are not shared across backend replicas. Before multi-node production, replace or back this with Redis, a gateway/WAF rate limit, or another distributed store.

Security-sensitive events are logged through the `security.audit` logger:

- successful login
- failed login
- tenant onboarding success
- tenant onboarding rejected
- throttled login
- throttled onboarding

Audit log messages include `correlationId`, `email`, `tenantId` when available, and `remoteIp`. The remote IP resolver honors `X-Forwarded-For` when present, so production ingress must sanitize or overwrite that header at the trusted proxy boundary.

## COD Confirmation Workflow

The confirmation queue is exposed through:

- `GET /api/confirmations/queue`
- `POST /api/orders/{orderId}/confirmation-attempts`
- `GET /api/orders/{orderId}/confirmation-attempts`
- `GET /api/confirmations/callbacks`
- `POST /api/confirmations/callbacks/{callbackId}/resolve`

All confirmation endpoints require an authenticated `ADMIN` or `MERCHANT` user and scope data to the tenant in the JWT. The queue returns only orders in `CREATED` or `CONFIRMATION_REQUESTED`. It supports optional `status`, `createdFrom`, `createdTo`, customer name/phone `search`, `page`, and `size` parameters. The `status` filter accepts only `CREATED` or `CONFIRMATION_REQUESTED`.

Each confirmation attempt records:

- attempt ID
- tenant ID
- order ID
- attempt number
- outcome
- note
- callback timestamp for `CALL_BACK_LATER`
- callback resolved timestamp/user when a scheduled callback is closed
- authenticated user email
- created timestamp

Attempt outcomes are `CONFIRMED`, `REJECTED`, `NO_ANSWER`, `CALL_BACK_LATER`, and `WRONG_NUMBER`. `CONFIRMED` appends `OrderConfirmed` and moves the order projection to `CONFIRMED`. `REJECTED` appends `OrderRejected` and moves the projection to `REJECTED`. If either final outcome is recorded while the order is still `CREATED`, the backend first appends `OrderConfirmationRequested`, then the final event. Non-final outcomes leave the order in its existing confirmation queue status.

`CALL_BACK_LATER` requires a future `callbackAt` timestamp. The backend rejects missing or past callback timestamps and rejects `callbackAt` for every other outcome. Scheduled callbacks remain actionable only while the order is still in `CREATED` or `CONFIRMATION_REQUESTED`; confirmed, rejected, delivered, and failed orders are excluded from the callback queue.

The callback queue is tenant scoped and supports `page`, `size`, `scope`, `callbackFrom`, and `callbackTo`. `scope=DUE` returns callbacks due now, including overdue callbacks. `scope=OVERDUE` returns callbacks before the current UTC day. `scope=UPCOMING` returns future callbacks. `scope=ALL` is available for internal review and date-range filtering.

Recording `CONFIRMED` or `REJECTED` resolves all pending callbacks for the order. Operators may also explicitly resolve a callback through `POST /api/confirmations/callbacks/{callbackId}/resolve` when no lifecycle event should be emitted.

Confirmation attempts are operational records in `confirmation_attempts`. They are not the source of truth for final order state; final order state still comes from `domain_events` and the `orders` projection. The attempts table has a tenant/order/attempt-number uniqueness constraint. It intentionally does not foreign-key to the `orders` projection, so projection rebuilds can clear and rebuild `orders` without deleting historical attempt records.

## Inbound Order Review

The ingestion review layer is exposed through:

- `GET /api/inbound-orders`
- `GET /api/inbound-orders/summary`
- `GET /api/inbound-orders/{inboundOrderId}`
- Merchant UI: `/app/inbound-orders`

All inbound order endpoints require an authenticated `ADMIN` or `MERCHANT` user and scope data to the tenant in the JWT. The list endpoint supports `source`, `status`, `search`, `page`, and `size`. `search` matches `externalOrderId` and `idempotencyKey`.

List responses include source, external order ID, idempotency key, status, received timestamp, normalized order ID, and rejection reason when available. They intentionally do not include the raw payload.

Detail responses include the raw payload for same-tenant operational debugging. Treat this as sensitive merchant/customer data: use it for troubleshooting ingestion, normalization, rejection, and idempotency issues, not for general reporting.

The dashboard summary endpoint returns only operational counters and latest rejected metadata. It does not expose raw payloads.

## Catalog Operations

Authenticated merchant/admin users can manage the minimal tenant-scoped product catalog from `/app/products`.

- Products support create, list, detail, update, and archive operations through `/api/products`.
- Product status is operational: `DRAFT` for incomplete records, `ACTIVE` for products ready for future order/storefront use, and `ARCHIVED` for retained records not intended for new use.
- Product media supports authenticated primary image uploads through `/api/products/{productId}/media`; gallery and SEO uploads can populate existing storefront profile fields.
- Docker deployments mount `/app/storage/media` as a named volume so uploaded media survives container replacement. Production must set `APP_MEDIA_PUBLIC_BASE_URL` to the public origin that serves `/media`.
- Public product responses include readiness checks for landing-engine review. These checks are informational and do not mutate order lifecycle.
- Local seed loading adds a `first-store`/`coolair-mini` landing-engine rehearsal product when `classpath:db/seed` is enabled. Local Docker compose mounts the matching demo media read-only; production compose excludes this seed path.
- Existing order creation remains stable. Product-referenced orders use stable order-line snapshots so historical orders remain readable after catalog edits.

## Database Backup And Restore

PostgreSQL is the production source of truth for tenants, users, orders, and domain events. Backups must include the whole database, not only the `orders` projection, because `domain_events` is the authoritative event log.

### Backup

Run logical backups from a trusted deployment host after the production Compose stack is running:

```bash
POSTGRES_USER="<production-user>" \
POSTGRES_DB="nexora" \
BACKUP_DIR="/var/backups/wasilio" \
BACKUP_RETENTION_DAYS="14" \
./scripts/backup-postgres.sh
```

The script writes `BACKUP_DIR/BACKUP_PREFIX-YYYYMMDDTHHMMSSZ.dump` using PostgreSQL custom format and verifies the dump catalog with `pg_restore --list`. `BACKUP_RETENTION_DAYS` is optional; when set, only local files matching the configured prefix are pruned.

Store backup artifacts outside the application host with encryption at rest. For early-stage production, take at least daily full logical backups and keep enough history to recover from accidental data corruption discovered after a delay. A simple daily cron entry on the deployment host is acceptable for the first controlled trials:

```cron
17 2 * * * cd /srv/wasilio && POSTGRES_USER=postgres POSTGRES_DB=nexora BACKUP_DIR=/var/backups/wasilio BACKUP_RETENTION_DAYS=14 ./scripts/backup-postgres.sh >> /var/log/wasilio-backup.log 2>&1
```

After each successful run, sync the new `.dump` artifact to encrypted off-host storage and record the artifact name in the deployment log.

### Restore

Restore into a fresh database or isolated environment first, then promote after verification:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "${POSTGRES_DB:-nexora}" --clean --if-exists \
  < backups/wasilio-YYYYMMDDTHHMMSSZ.dump
```

After restore, run the backend with Flyway enabled and Hibernate set to `validate`. Verify `/actuator/health/readiness`, login, order list, and event timelines before accepting traffic.

Run a restore drill before the first trial merchant and after any migration that changes order, tenant, billing, or event tables. The drill should restore the latest backup into an isolated database, start one backend instance against it, and verify:

- `/actuator/health/readiness` returns healthy.
- Super-admin login works.
- A merchant login works.
- Existing orders and timelines load.
- Staff admin merchant workspaces, subscriptions, payments, receipts, and demo requests load.

### Migration Rollback

Flyway migrations are forward-only for production. Do not rely on Hibernate schema mutation or manual table edits to roll back a release. If a migration must be reverted, create a new corrective Flyway migration and restore from backup only when data loss or corruption requires it.

Before applying a risky migration, capture a fresh backup and record the exact application image tag, migration version, backup artifact name, and restore command used for the release.

### RPO/RTO

Early-stage SaaS target:

- RPO: 24 hours until automated scheduled backups are in place, then 1 hour for production.
- RTO: 4 hours for manual restore while the platform is early-stage.

These targets must be revisited before onboarding customers with stricter delivery or compliance requirements.

## Order Projection Recovery

`domain_events` is the write-side source of truth. The `orders` table is a read model rebuilt from those events.

The orders projection records processed event IDs in `projection_processed_events` with `projection_name='orders'`. Reprocessing the same event ID is skipped, so duplicate delivery does not duplicate or corrupt the projection.

Order projection updates are dispatched after the event transaction commits. If projection processing fails, the event remains committed in `domain_events` and the event ID is not marked as processed for the orders projection. Recovery is to rebuild the projection from the event log.

For an MVP maintenance rebuild, run one backend instance with:

```bash
APP_PROJECTIONS_REBUILD_ORDERS_ON_STARTUP=true \
docker compose -f docker-compose.yml -f docker-compose.prod.yml up backend
```

Use this in a maintenance window or isolated admin run. The rebuild clears `orders` and the `orders` projection markers, then replays `domain_events` in tenant, aggregate, and aggregate sequence order. Leave `APP_PROJECTIONS_REBUILD_ORDERS_ON_STARTUP` unset or `false` during normal application startup.

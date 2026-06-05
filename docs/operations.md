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
CORS_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
```

Local Docker Compose development defaults are defined in `docker-compose.override.yml` and documented in `.env.example`:

```text
http://localhost,http://127.0.0.1,http://localhost:5173,http://127.0.0.1:5173
```

Production compose requires `CORS_ALLOWED_ORIGINS` and fails configuration if it is missing.

## Database Backup And Restore

PostgreSQL is the production source of truth for tenants, users, orders, and domain events. Backups must include the whole database, not only the `orders` projection, because `domain_events` is the authoritative event log.

### Backup

Run logical backups with `pg_dump` from a trusted host or a short-lived maintenance container:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "${POSTGRES_DB:-nexora}" --format=custom \
  > "backups/nexora-$(date +%Y%m%d%H%M%S).dump"
```

Store backup artifacts outside the application host with encryption at rest. For early-stage production, take at least daily full logical backups and keep enough history to recover from accidental data corruption discovered after a delay.

### Restore

Restore into a fresh database or isolated environment first, then promote after verification:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "${POSTGRES_DB:-nexora}" --clean --if-exists \
  < backups/nexora-YYYYMMDDHHMMSS.dump
```

After restore, run the backend with Flyway enabled and Hibernate set to `validate`. Verify `/actuator/health/readiness`, login, order list, and event timelines before accepting traffic.

### Migration Rollback

Flyway migrations are forward-only for production. Do not rely on Hibernate schema mutation or manual table edits to roll back a release. If a migration must be reverted, create a new corrective Flyway migration and restore from backup only when data loss or corruption requires it.

Before applying a risky migration, capture a fresh backup and record the exact application image tag, migration version, backup artifact name, and restore command used for the release.

### RPO/RTO

Early-stage SaaS target:

- RPO: 24 hours until automated scheduled backups are in place, then 1 hour for production.
- RTO: 4 hours for manual restore while the platform is early-stage.

These targets must be revisited before onboarding customers with stricter delivery or compliance requirements.

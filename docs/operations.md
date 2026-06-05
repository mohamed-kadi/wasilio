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

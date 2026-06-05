# Operational Baseline

## Health Checks

The backend exposes Spring Actuator health probes:

- Liveness: `GET /actuator/health/liveness`
- Readiness: `GET /actuator/health/readiness`
- Aggregate health: `GET /actuator/health`

Only health endpoints are exposed over HTTP. The application security config permits these health paths without JWT authentication so container platforms can poll them.

## Logging

The backend currently uses Spring Boot's default Logback console logging. Logs include timestamps, logger names, thread names, and levels, but they are not emitted as JSON structured logs yet.

For production, prefer JSON logs written to stdout with stable fields such as `timestamp`, `level`, `logger`, `message`, `tenantId`, `correlationId`, and `requestId`.

## Correlation IDs

Domain events persist a `correlation_id` and `causation_id` for event-level traceability.

HTTP request correlation ID propagation is not implemented yet: inbound `X-Correlation-ID` is not read, generated when missing, written to MDC, returned in responses, or propagated into created domain events by the web layer. Treat this as a remaining production readiness gap.

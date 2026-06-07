# Audit 001: Initial Production Readiness

## Scope

Early production-readiness review of the MVP foundation before stabilization work.

## Original Issues

- Development seed user risk if seed loading reached production.
- Production CORS needed explicit origin control.
- JWT secret handling needed required production configuration.
- Projection processing lacked durable processed-event tracking.
- Operational logging and request correlation were limited.
- Backup and restore process was not documented.
- Public onboarding needed an explicit enable/disable switch.

## Fixed Issues

- Production compose requires `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`, and onboarding flag.
- Local seed loading is limited to `docker-compose.override.yml`.
- Operational runbook documents health checks, CORS, backups, restore, and projection rebuild.
- Correlation IDs are included in logs, error responses, responses, and domain events.
- Projection processed-event tracking was added.

## Remaining Issues

- Backup automation is still manual.
- No outbox/retry worker.
- No distributed throttling.
- No token refresh/revocation.

## Current Readiness Status

The system moved from prototype readiness toward controlled MVP readiness, assuming single-node backend operation and careful production configuration.

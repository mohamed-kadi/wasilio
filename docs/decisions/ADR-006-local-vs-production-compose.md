# ADR-006: Local Vs Production Compose

## Status

Accepted.

## Context

Developers need convenient local defaults and seed users. Production must require explicit secrets and must not load development seed data.

## Decision

Use:

- `docker-compose.yml` for shared service definitions.
- `docker-compose.override.yml` for local defaults, seed loading, local CORS, and public onboarding.
- `docker-compose.prod.yml` for production-required configuration and migrations-only startup.

## Consequences

- Local setup remains fast.
- Production fails early when required secrets/config are missing.
- Development seed data is excluded from production.
- Deployment docs must be explicit about which compose files to use.

## Alternatives Considered

- One compose file for all environments: rejected because local defaults could leak into production.
- Separate unrelated compose files: rejected because service definitions would drift.

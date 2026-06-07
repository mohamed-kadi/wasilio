# ADR-004: Projection Rebuild Strategy

## Status

Accepted.

## Context

The `orders` table is a read model derived from `domain_events`. Projection processing can fail after an event is committed, and the system needs a recovery path.

## Decision

Track processed events per projection in `projection_processed_events`. Provide a startup-controlled rebuild path with `APP_PROJECTIONS_REBUILD_ORDERS_ON_STARTUP=true`.

## Consequences

- Duplicate event handling can be skipped.
- Operators can rebuild the orders projection from the event log.
- Rebuild clears the projection and should run only during maintenance or an isolated admin run.
- There is no self-service admin UI or automated projection repair loop yet.

## Alternatives Considered

- No processed-event table: simpler, but duplicate event handling would be unsafe.
- Always rebuild on startup: rejected because it can cause downtime and unnecessary load.
- Dedicated projection worker: deferred until outbox/retry infrastructure exists.

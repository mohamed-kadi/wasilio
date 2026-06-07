# ADR-002: Event Store As Source Of Truth

## Status

Accepted.

## Context

COD order operations need auditability and deterministic lifecycle transitions. Merchants must be able to understand how an order reached its current state.

## Decision

Use `domain_events` as the source of truth for order lifecycle state. Store lifecycle changes as ordered domain events and maintain `orders` as a projection for reads.

## Consequences

- Order history is preserved.
- Invalid transitions can be rejected by replaying aggregate state.
- Projection repair is possible from the event log.
- Schema evolution requires event-version discipline and future upcasters.
- Query features must avoid treating projections as authoritative write state.

## Alternatives Considered

- CRUD-only `orders` table: simpler, but weak auditability and harder recovery.
- Full event-sourcing framework: deferred to avoid framework complexity during MVP.

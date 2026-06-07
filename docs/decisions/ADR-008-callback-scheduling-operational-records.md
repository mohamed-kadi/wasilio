# ADR-008: Callback Scheduling As Operational Records

## Status

Accepted.

## Context

Customers often ask to be called later. Operators need a queue of due, overdue, and upcoming follow-ups without changing final order state.

## Decision

Represent scheduled callbacks as fields on `CALL_BACK_LATER` confirmation attempts: `callback_at`, `callback_resolved_at`, and `callback_resolved_by`.

## Consequences

- Callback scheduling stays close to the attempt that created it.
- Pending callback queries can use a partial index.
- Final confirmation/rejection can resolve pending callbacks for the order.
- There is no independent reminder worker or notification system yet.

## Alternatives Considered

- Separate callback table: more flexible for recurring reminders, but unnecessary for MVP.
- Domain event for callback scheduled/resolved: useful for full audit streams, but deferred to keep lifecycle events focused.

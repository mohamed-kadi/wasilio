# ADR-007: Confirmation Attempts As Operational Records

## Status

Accepted.

## Context

COD confirmation requires call history, notes, attempt counts, and non-final outcomes such as no answer or wrong number. These records are operationally important but do not always represent lifecycle state changes.

## Decision

Store confirmation attempts in `confirmation_attempts`. Final outcomes trigger order lifecycle events, while non-final outcomes remain operational records.

## Consequences

- Operators get call history without polluting the lifecycle event stream with every non-final call.
- Final state remains event-sourced.
- Attempts survive projection rebuilds because they do not foreign-key to the `orders` projection.
- Analytics must combine operational records with lifecycle events carefully.

## Alternatives Considered

- Model every attempt as a domain event: more audit-complete, but would mix operational call logs with lifecycle state.
- Store attempts only in frontend/client state: rejected because call history must be durable and tenant scoped.

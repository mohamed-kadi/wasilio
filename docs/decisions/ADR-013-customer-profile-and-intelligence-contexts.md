# ADR-013: Customer Profile And Intelligence Contexts

## Status

Accepted.

## Context

Wasilio will need reusable customer identity, address history, repeat behavior, delivery reliability, confirmation reliability, segmentation, risk signals, and future AI recommendations. These needs are related but not the same as order lifecycle state.

## Decision

Separate Customer Profile from Customer Intelligence.

Customer Profile owns stable customer facts such as phone, name, address history, city/area, and consent state.

Customer Intelligence owns derived snapshots such as repeat-customer signals, reliability scores, risk reasons, segments, and future recommendations. Intelligence starts as read-side, explainable, and versioned data.

## Consequences

- Customer data can be reused across orders without bloating the order lifecycle model.
- Intelligence can improve operations while staying auditable and explainable.
- Scores and recommendations must not silently mutate lifecycle state.
- Any intelligence-driven workflow action must be an explicit operator or system command with an audit trail.

## Alternatives Considered

- Store customer intelligence directly on orders: rejected because intelligence is derived and evolves independently.
- Let AI or scoring mutate lifecycle automatically from the start: rejected because COD operations need deterministic, auditable decisions first.

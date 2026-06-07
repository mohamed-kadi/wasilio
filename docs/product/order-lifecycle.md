# Order Lifecycle

Nexora enforces deterministic order transitions through `OrderLifecycleService`. Invalid transitions are rejected.

## States

- `CREATED`
- `CONFIRMATION_REQUESTED`
- `CONFIRMED`
- `REJECTED`
- `ASSIGNED_TO_COURIER`
- `PICKED_UP`
- `DELIVERED`
- `FAILED`

## Core Flow

```text
CREATED
  -> CONFIRMATION_REQUESTED
  -> CONFIRMED
  -> ASSIGNED_TO_COURIER
  -> PICKED_UP
  -> DELIVERED
```

## Rejection Flow

```text
CREATED
  -> CONFIRMATION_REQUESTED
  -> REJECTED
```

Confirmation operations can record a final `REJECTED` attempt while an order is still `CREATED`; the backend first appends `OrderConfirmationRequested`, then `OrderRejected`.

## Delivery Failure Flow

```text
CONFIRMED
  -> ASSIGNED_TO_COURIER
  -> PICKED_UP
  -> FAILED
```

## Source Of Truth

Each state change appends an event to `domain_events`. The `orders` table reflects the latest projected state for fast reads.

## Planned Courier Workflow

Internal courier operations now support courier resources, assignment queues, and pickup queues. Operators can assign active tenant couriers to confirmed orders and mark assigned orders as picked up.

Delivery operations now support a delivery queue for `PICKED_UP` orders. Operators can mark picked up orders as `DELIVERED` or `FAILED`. A failed delivery appends `OrderDeliveryFailed`, updates the order projection to `FAILED`, and creates a tenant-scoped operational failure record with courier, reason, note, and timestamp.

External courier integrations, courier authentication, delivery tracking, route optimization, and notifications remain future work.

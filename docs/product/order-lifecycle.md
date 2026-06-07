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

The event types for assignment, pickup, delivery, and delivery failure already exist. The next product step is a courier operations surface and integration model that makes these transitions usable by operators and external courier systems.

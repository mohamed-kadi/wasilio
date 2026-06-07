# Courier Workflow

Courier operations are internal merchant operations in this phase. Couriers are tenant-scoped operational resources, not authenticated users.

## Courier Resource

Each courier has:

- `courierId`
- `tenantId`
- `name`
- `phone`
- `active`
- `createdAt`

Couriers belong to one tenant. Deactivation is soft: inactive couriers remain visible but cannot be used for new assignment or pickup commands.

## Assignment Queue

The assignment queue lists tenant-scoped orders that are:

- `CONFIRMED`
- not yet assigned to a courier

Operators assign an active courier to an order. Assignment appends `OrderAssignedToCourier` and moves the order projection to `ASSIGNED_TO_COURIER`.

Reassignment is not supported in this phase. Once an order leaves `CONFIRMED`, another assignment command is rejected by the lifecycle rules.

## Pickup Queue

The pickup queue lists tenant-scoped orders that are:

- `ASSIGNED_TO_COURIER`
- waiting for pickup

Operators can filter by courier, status, date range, and pagination. Marking pickup appends `OrderPickedUp` and moves the order projection to `PICKED_UP`.

## Delivery Queue

The delivery queue lists tenant-scoped orders that are:

- `PICKED_UP`
- waiting for a final delivery outcome

Operators can filter by courier, date range, and pagination. Delivery outcomes are final lifecycle transitions:

- `DELIVERED`: appends `OrderDelivered` and moves the order projection to `DELIVERED`.
- `FAILED`: appends `OrderDeliveryFailed` and moves the order projection to `FAILED`.

Only `PICKED_UP` orders can be marked delivered or failed. Confirmed, assigned, delivered, failed, rejected, or created orders are rejected by lifecycle rules.

## Failure Reasons

Failed deliveries create an operational `delivery_failures` record in addition to the lifecycle event. The record stores:

- `failureId`
- `tenantId`
- `orderId`
- `courierId`
- `reason`
- `note`
- `createdAt`

Supported reasons are `CUSTOMER_UNREACHABLE`, `CUSTOMER_REFUSED`, `INVALID_ADDRESS`, `CUSTOMER_RESCHEDULED`, `LOST_PACKAGE`, and `OTHER`.

The event remains the source of final order state. The failure record supports operations review and later reporting.

## Courier Performance

The current performance endpoint is query-based and tenant-scoped. For each courier it returns assigned, picked up, delivered, and failed order counts plus delivery success rate.

This is an operational summary, not a full analytics dashboard.

## Non-Goals

This phase does not implement courier authentication, courier mobile apps, external courier APIs, delivery tracking integrations, route optimization, or notifications.

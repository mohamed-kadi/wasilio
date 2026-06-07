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

## Non-Goals

This phase does not implement courier authentication, courier mobile apps, external courier APIs, delivery tracking integrations, route optimization, or notifications.

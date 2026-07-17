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

The assignment UX keeps the handoff compact: rows show the order, customer, product with amount, confirmation handoff context, address readiness, score indicators, and the courier assignment control. Active courier options are shown from the existing courier list so merchants can compare available couriers without changing assignment rules or adding a new backend contract.

## Pickup Queue

The pickup queue lists tenant-scoped orders that are:

- `ASSIGNED_TO_COURIER`
- waiting for pickup

Operators can filter by courier, status, date range, and pagination. Marking pickup appends `OrderPickedUp` and moves the order projection to `PICKED_UP`.

The pickup UX keeps assigned orders compact on laptop screens by showing product with amount, assigned courier, pickup status, and the pickup action in one row. Courier filtering, date filters, pagination, and the assignment handoff remain unchanged.

## Delivery Queue

The delivery queue lists tenant-scoped orders that are:

- `PICKED_UP`
- waiting for a final delivery outcome

Operators can filter by courier, date range, and pagination. Delivery outcomes are final lifecycle transitions:

- `DELIVERED`: appends `OrderDelivered` and moves the order projection to `DELIVERED`.
- `FAILED`: appends `OrderDeliveryFailed` and moves the order projection to `FAILED`.

Only `PICKED_UP` orders can be marked delivered or failed. Confirmed, assigned, delivered, failed, rejected, or created orders are rejected by lifecycle rules.

The delivery UX uses the same compact handoff pattern: product with amount, courier context, delivery status, and delivered/failed outcome controls stay visible without a wide table. The failure panel still collects the existing failure reason and optional note before sending the order into recovery.

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

Failed recovery decisions sit on top of the failed order state:

- `RETRY_DELIVERY` keeps the failed event for history, then allows the order to return to courier assignment.
- `REFUND_OR_CUSTOMER_FOLLOW_UP` opens a customer follow-up task until refund, replacement, or contact is completed.
- `CLOSE_UNRECOVERABLE` closes recovery when the customer cannot be reached or no further delivery action is expected. A closure note is required, and open follow-up tasks are resolved as superseded.

## Courier Performance

The current performance endpoint is query-based and tenant-scoped. For each courier it returns assigned, picked up, delivered, and failed order counts plus delivery success rate. Merchants can review today, the last 7 days, or the last 30 days, then drill into the exact failed delivery records for a courier and date window.

This is an operational summary, not a full analytics dashboard.

## Non-Goals

This phase does not implement courier authentication, courier mobile apps, external courier APIs, delivery tracking integrations, route optimization, or notifications.

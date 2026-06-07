# Event Sourcing

Nexora uses event sourcing for order lifecycle state. The `domain_events` table is the authoritative write-side record of order state changes.

## Event Append Flow

1. A controller receives an authenticated request and extracts `tenantId`.
2. An application service loads the aggregate event stream for `tenantId` and `orderId`.
3. The service replays events into in-memory state.
4. The requested transition is validated against that state.
5. A new `DomainEvent` is created with:
   - `eventId`
   - `eventType`
   - `aggregateSequence`
   - `eventSchemaVersion`
   - `tenantId`
   - `aggregateId`
   - `correlationId`
   - `created_at`
   - JSON payload
6. `EventStoreImpl` verifies the expected aggregate sequence and persists the event.
7. The event is published through Spring `ApplicationEventPublisher`.
8. The orders projection handles the event after commit and updates the `orders` read model.

## Concurrency

`V2__event_sequence_constraints.sql` adds `aggregate_sequence` and a uniqueness constraint on `(tenant_id, aggregate_id, aggregate_sequence)`. `EventStoreImpl` checks the current sequence before save and converts persistence conflicts into `EventConcurrencyException`.

## Projection Flow

The `orders` table is a projection. `OrderProjectionService` applies order events and writes projection rows. `projection_processed_events` records which event IDs have already been applied to the `orders` projection so duplicate delivery can be skipped.

Projection processing runs in a new transaction. If an event is committed but projection handling fails, the event remains in `domain_events` and the projection can be rebuilt later.

## Rebuild Strategy

`APP_PROJECTIONS_REBUILD_ORDERS_ON_STARTUP=true` runs a maintenance rebuild through `OrderProjectionRebuildRunner`. The rebuild clears the `orders` projection and `orders` processed-event markers, then replays `domain_events` ordered by tenant, aggregate, and aggregate sequence.

This should be used in a maintenance window or an isolated admin run because the projection is cleared during rebuild.

## Current Event Types

- `OrderCreated`
- `OrderConfirmationRequested`
- `OrderConfirmed`
- `OrderRejected`
- `OrderAssignedToCourier`
- `OrderPickedUp`
- `OrderDelivered`
- `OrderDeliveryFailed`

## Current Gaps

- No outbox table or retry worker for asynchronous delivery.
- No event upcasters despite `event_schema_version`.
- No separate dead-letter handling for projection failures.
- No administrative endpoint for projection rebuild; rebuild is controlled by startup configuration.

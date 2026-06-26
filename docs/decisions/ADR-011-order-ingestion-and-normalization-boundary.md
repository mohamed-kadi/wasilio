# ADR-011: Order Ingestion And Normalization Boundary

## Status

Accepted.

## Context

Orders can enter Wasilio from many sources: manual entry, CSV imports, Wasilio storefronts, YouCan, Shopify, WooCommerce, WhatsApp, Facebook leads, and future integrations. Each source has different payload shapes and metadata.

## Decision

Create an Order Ingestion boundary before external or storefront orders become lifecycle orders. Ingestion preserves source metadata, optionally stores raw inbound payload references, validates source-level completeness, deduplicates where needed, and normalizes payloads into a stable Wasilio create-order command.

Order Lifecycle remains the authority for final state transitions after ingestion.

## Consequences

- Source-specific complexity stays outside the event-sourced lifecycle model.
- Integrations can be added without changing the core create-order command for every platform.
- Operators can trace where an order came from and troubleshoot source payload issues.
- Ingestion requires idempotency rules for webhooks, imports, and retrying clients.

## Implementation Note

The foundation is implemented with `inbound_orders`, `OrderIngestionService`, `OrderSource`, `InboundOrderStatus`, and lightweight `OrderSourceMetadata` on `OrderCreated` events and the `orders` projection. Manual order creation flows through this boundary with `MANUAL` as the default source.

Storefront capture, CSV import, platform adapters, marketing attribution, and customer intelligence remain future work.

## Alternatives Considered

- Let each integration call lifecycle APIs directly: rejected because it spreads source-specific logic across controllers and services.
- Store all source fields on `orders`: rejected because it would make the read model platform-specific and difficult to maintain.

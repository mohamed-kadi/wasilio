# ADR-009: Storefront As Presentation Client

## Status

Accepted.

## Context

Wasilio may provide merchant storefronts, but its product mission is COD ecommerce operations. A storefront can help merchants capture orders, but it must not compete with Wasilio Core for lifecycle ownership.

## Decision

Treat the Wasilio storefront as a thin customer-facing presentation client. It reads Catalog data, displays merchant/product content, captures customer order intent, captures source metadata, and submits the payload to Order Ingestion.

The storefront does not own order lifecycle transitions, confirmation, delivery, recovery, COD collection, attribution truth, customer intelligence, or operational analytics.

## Consequences

- Storefront implementation can move quickly without weakening core operational rules.
- The same ingestion boundary can support storefront, manual, CSV, marketplace, and ecommerce platform orders.
- Business logic stays in Wasilio Core and related bounded contexts.
- Storefront UX must tolerate asynchronous backend validation instead of assuming an order is operationally accepted at the browser layer.

## Alternatives Considered

- Full ecommerce builder: rejected because Wasilio should not become a YouCan, Shopify, or WooCommerce replacement.
- Frontend-only order creation directly into lifecycle APIs: rejected because it would bypass source normalization and create storefront-specific lifecycle coupling.

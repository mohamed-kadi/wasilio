# ADR-012: Marketing Attribution Context

## Status

Accepted.

## Context

Merchants need to understand which campaigns, channels, referrers, lead sources, and landing pages produce confirmed and delivered COD orders. Attribution data is important, but it is not order lifecycle truth.

## Decision

Model Marketing Attribution as its own bounded context. It owns campaign, channel, UTM, click, referrer, lead source, and conversion linkage data. Attribution records link to orders and customers, but lifecycle events remain focused on durable operational facts.

## Consequences

- Campaign reporting can evolve without polluting lifecycle events or the `orders` projection.
- Attribution can support storefront, marketplace, manual, WhatsApp, and ad-lead sources consistently.
- Analytics must join attribution records with lifecycle and delivery outcomes.
- Attribution implementation should include tenant scope and source traceability from the start.

## Alternatives Considered

- Add UTM fields directly to `Order`: rejected because attribution will grow beyond a few fields and needs its own language.
- Treat attribution as frontend analytics only: rejected because merchants need server-side conversion linkage to confirmed, delivered, and failed orders.

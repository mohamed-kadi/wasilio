# DDD Boundaries

Wasilio uses a modular monolith rather than separate deployable services. Bounded contexts are expressed through packages, services, repositories, and database ownership rules.

This document separates what exists today from the target context map. The target map matters because Wasilio is the operating system for Moroccan COD ecommerce, not a storefront competitor. Storefronts, external ecommerce platforms, WhatsApp leads, CSV uploads, and manual entry should all feed Wasilio Core through stable ingestion boundaries.

## Implemented Contexts

### Identity And Tenant Access

Owns tenants, users, roles, JWT authentication, onboarding, and tenant identity in authenticated requests.

Primary code:

- `api/AuthController.java`
- `api/OnboardingController.java`
- `application/TenantOnboardingService.java`
- `domain/model/Tenant.java`
- `domain/model/User.java`
- `domain/model/Role.java`
- `infrastructure/security/*`

### Order Lifecycle

Owns deterministic state transitions for COD orders. It appends domain events and rebuilds aggregate state by replaying an order stream before validating a command.

Primary code:

- `application/OrderLifecycleService.java`
- `domain/event/*`
- `domain/event/payload/*`
- `domain/model/OrderStatus.java`

### Order Read Model

Owns the query-optimized `orders` projection and processed-event markers. It is not the write-side source of truth.

Primary code:

- `application/OrderProjectionListener.java`
- `application/projection/OrderProjectionService.java`
- `application/projection/ProjectionProcessedEvent.java`
- `domain/repository/OrderRepository.java`

### Order Ingestion

Owns the minimum inbound order foundation for all order sources before a Wasilio lifecycle order is created. It records tenant-scoped inbound payload snapshots, source, external order ID, idempotency key, received status, rejection reason, and the normalized Wasilio order ID.

Implemented scope:

- Manual order creation now flows through ingestion with `OrderSource.MANUAL` by default.
- Future sources can reuse the same service contract without calling `OrderLifecycleService` directly.
- Duplicate submissions by `(tenantId, source, idempotencyKey)` or source external order ID return the existing normalized order instead of creating duplicates.
- `OrderCreated` events and the `orders` projection preserve lightweight source metadata: source, inbound order ID, and external order ID.

Primary code:

- `application/OrderIngestionService.java`
- `domain/model/InboundOrder.java`
- `domain/model/InboundOrderStatus.java`
- `domain/model/OrderSource.java`
- `domain/repository/InboundOrderRepository.java`
- `domain/event/payload/OrderSourceMetadata.java`

### Catalog

Owns the minimum tenant-scoped merchant product model needed before storefronts, imports, external adapters, and richer manual order creation.

Implemented scope:

- Product create, list, detail, update, and archive endpoints.
- Tenant-scoped product slug uniqueness.
- Product statuses: `DRAFT`, `ACTIVE`, and `ARCHIVED`.
- A single nullable `imageUrl` placeholder instead of full media galleries.
- No storefront publishing, SEO, checkout, adapters, attribution, or customer intelligence.

Order connection:

- Existing order behavior is unchanged.
- Product references from order creation should be added as the next small step, together with an order-line snapshot so historical orders remain stable after catalog edits.

Primary code:

- `api/ProductController.java`
- `application/ProductService.java`
- `domain/model/Product.java`
- `domain/model/ProductStatus.java`
- `domain/repository/ProductRepository.java`

### Confirmation Operations

Owns operational records for COD confirmation attempts and callback scheduling. It may trigger order lifecycle events for final confirmation/rejection outcomes.

Primary code:

- `api/ConfirmationController.java`
- `application/ConfirmationWorkflowService.java`
- `domain/model/ConfirmationAttempt.java`
- `domain/model/ConfirmationOutcome.java`
- `domain/model/ConfirmationCallbackScope.java`
- `domain/repository/ConfirmationAttemptRepository.java`

### Courier Operations

Owns tenant-scoped internal couriers, assignment queues, pickup queues, delivery queues, delivery outcomes, delivery failure records, and basic courier performance metrics. Final assignment, pickup, delivery, and failure state transitions still go through the order lifecycle.

Primary code:

- `api/CourierController.java`
- `api/CourierOperationsController.java`
- `application/CourierService.java`
- `application/DeliveryOperationsService.java`
- `domain/model/Courier.java`
- `domain/model/DeliveryFailure.java`
- `domain/model/DeliveryFailureReason.java`
- `domain/repository/CourierRepository.java`
- `domain/repository/DeliveryFailureRepository.java`

### Order Workspace

Owns read-side usability features for operational order management, including advanced search, saved views, and unified timeline composition.

Primary code:

- `api/OrderController.java`
- `application/OrderTimelineService.java`
- `domain/model/OrderSearchSavedView.java`
- `domain/repository/OrderSearchSavedViewRepository.java`

### Admin Billing

Owns Wasilio-side tenant administration, launch-readiness subscription status, manual payment records, and receipt records. These records are operational/commercial data and do not affect order lifecycle truth.

Primary code:

- `api/AdminController.java`
- `application/AdminBillingService.java`
- `domain/model/SubscriptionPlan.java`
- `domain/model/TenantSubscription.java`
- `domain/model/TenantPayment.java`
- `domain/model/TenantStatus.java`
- `domain/model/SubscriptionStatus.java`
- `domain/model/PaymentMethod.java`
- `domain/repository/SubscriptionPlanRepository.java`
- `domain/repository/TenantSubscriptionRepository.java`
- `domain/repository/TenantPaymentRepository.java`

## Target Context Map

These contexts define the product architecture direction. Some are implemented, some are partial, and some are future modules. They should still guide schema, API, and UI decisions now.

### Wasilio Core

Owns the operational platform: identity, order lifecycle, confirmation, courier operations, COD delivery outcomes, operational read models, timeline, and internal workflows.

Wasilio Core is the source of truth for order status. Storefronts and external platforms are sources of order intent, not lifecycle authorities.

### Catalog

Owns merchant products, variants, pricing display data, images, videos, FAQs, testimonials, and product availability metadata needed to present offers.

Catalog should be reusable by Wasilio-generated storefronts and future external sales surfaces. It should not own order lifecycle, confirmation, delivery, or COD collection decisions.

### Storefront

Owns customer-facing presentation and order-intent capture only.

Allowed responsibilities:

- Show products, images, videos, pricing, FAQs, testimonials, and merchant trust content.
- Capture customer contact details, delivery address, selected products, quantities, notes, and consent where needed.
- Capture source, campaign, and attribution hints.
- Submit an order-intent payload to Wasilio ingestion.

Forbidden responsibilities:

- Directly mutate order lifecycle state.
- Decide confirmation, assignment, delivery, failure, COD, or recovery outcomes.
- Hold independent business rules that disagree with Wasilio Core.
- Become the source of customer intelligence or marketing attribution truth.

### Order Ingestion

Owns order intake from all sources before an order becomes a Wasilio lifecycle order. The foundation exists; source-specific adapters remain future work.

Sources include Wasilio storefronts, manual entry, CSV import, YouCan, Shopify, WooCommerce, WhatsApp, Facebook leads, and future platform adapters.

Responsibilities:

- Preserve source metadata.
- Preserve raw inbound payloads where integration troubleshooting requires it.
- Normalize source-specific payloads into a stable internal create-order command.
- Validate source-level completeness before calling Wasilio Core.
- Keep platform-specific fields out of order lifecycle events unless they are durable lifecycle facts.

### Integrations

Owns adapters for external commerce, courier, notification, payment, and acquisition systems.

Adapters translate external APIs and webhook shapes into Wasilio-owned commands or operational records. They do not bypass tenant isolation or call repositories directly to mutate core state.

### Customer Profile

Owns stable customer identity and reusable customer facts across orders, such as phone, name, address history, preferred city/area, and consent state.

Customer Profile should emerge as a separate context instead of overloading `orders` with customer intelligence fields.

### Marketing Attribution

Owns campaign, channel, UTM, click, referrer, lead source, and conversion linkage data.

Attribution should be linked to orders and customers, but it is not part of order lifecycle truth. Order lifecycle events should reference source metadata only when needed for traceability, not absorb every marketing field.

### Customer Intelligence

Owns derived insights about customers and orders: repeat behavior, confirmation reliability, delivery reliability, risk signals, segmentation, and future AI recommendations.

Customer Intelligence should be read-side first. It must not silently mutate order lifecycle state. Any intelligence-driven workflow action must be explicit, auditable, and overrideable.

### Analytics And Reporting

Owns operational dashboards, exports, cohort reporting, courier performance analysis, COD reconciliation reports, and future BI feeds.

Analytics may read from lifecycle events, projections, operational records, attribution records, and customer intelligence snapshots, but it should not become the write-side owner of those facts.

### Notifications

Owns internal reminders and external communication orchestration for future SMS, WhatsApp, email, and push flows.

Notifications may be triggered by lifecycle events or operational schedules, but final workflow decisions remain in the owning contexts.

### Billing And Subscription

Owns tenant plans, payments, receipts, usage limits, subscription status, and commercial access rules.

Billing can restrict product access at the application boundary, but it does not own order lifecycle or operational data.

## Boundary Rules

- Application services coordinate workflows; domain decisions should not be hidden in controllers.
- Order state changes go through `OrderLifecycleService` and append domain events.
- Query screens read projections and operational records, not reconstructed aggregates.
- Tenant context must be passed into every repository query that can expose tenant-owned data.
- Operational records may support workflow, but they must not become the source of final order lifecycle truth.
- Storefronts are presentation clients. They submit order intent; they do not run COD operations.
- External platform adapters must flow through Order Ingestion before creating lifecycle orders.
- Source and attribution metadata should be preserved without making the order lifecycle model platform-specific.
- Marketing Attribution, Customer Profile, and Customer Intelligence are linked to orders, but they are separate ownership boundaries.
- Intelligence can recommend or flag; it cannot silently confirm, reject, assign, deliver, fail, or close an order.
- New workflow hardening should follow `docs/architecture/implementation-guardrails.md`.

## Implementation Sequence Guidance

When adding the next product surface, prefer this sequence:

1. Extend the Order Ingestion/source metadata foundation for each new source.
2. Extend the implemented Catalog foundation into manual order product references with stable order-line snapshots.
3. Add Storefront as a thin presentation layer over Catalog and Order Ingestion.
4. Add Marketing Attribution as its own context before campaign analytics.
5. Add Customer Profile before broad Customer Intelligence.
6. Add Customer Intelligence as explainable read-side snapshots before automation.

This order keeps Wasilio Core stable while allowing storefronts and external integrations to grow without contaminating lifecycle rules.

# DDD Boundaries

Wasilio currently uses a modular monolith rather than separate deployable services. Bounded contexts are expressed through packages, services, repositories, and database ownership rules.

## Current Contexts

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

## Boundary Rules

- Application services coordinate workflows; domain decisions should not be hidden in controllers.
- Order state changes go through `OrderLifecycleService` and append domain events.
- Query screens read projections and operational records, not reconstructed aggregates.
- Tenant context must be passed into every repository query that can expose tenant-owned data.
- Operational records may support workflow, but they must not become the source of final order lifecycle truth.
- New workflow hardening should follow `docs/architecture/implementation-guardrails.md`.

## Future Context Candidates

- Risk scoring and delivery intelligence.
- Courier dispatch integrations and courier webhooks.
- Merchant analytics and reporting.
- Integration ingestion for stores, marketplaces, and shipping partners.

# DDD Boundaries

Nexora currently uses a modular monolith rather than separate deployable services. Bounded contexts are expressed through packages, services, repositories, and database ownership rules.

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

## Boundary Rules

- Application services coordinate workflows; domain decisions should not be hidden in controllers.
- Order state changes go through `OrderLifecycleService` and append domain events.
- Query screens read projections and operational records, not reconstructed aggregates.
- Tenant context must be passed into every repository query that can expose tenant-owned data.
- Operational records may support workflow, but they must not become the source of final order lifecycle truth.

## Future Context Candidates

- Courier dispatch and courier webhooks.
- Billing and subscription management.
- Merchant analytics and reporting.
- Integration ingestion for stores, marketplaces, and shipping partners.

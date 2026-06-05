# Nexora - COD E-Commerce Operations SaaS

Nexora is a multi-tenant operational platform designed for COD (Cash-on-Delivery) e-commerce merchants in Morocco. It replaces manual WhatsApp and Excel tracking with a deterministic, event-driven SaaS system.

## Architecture

Nexora is built as a **Modular Monolith** using **Domain-Driven Design (DDD)** and an **Event-Driven Architecture**.

- **Domain Layer:** Contains business rules, entities (`Tenant`, `User`, `Order`), value objects (`Address`, `Customer`), and immutable domain events.
- **Application Layer:** Orchestrates use cases (e.g., `OrderLifecycleService`), appending events and acting as the boundary for transactions.
- **Infrastructure Layer:** Handles PostgreSQL persistence, JWT security, and publishing events via Spring ApplicationEventPublisher.
- **API Layer:** Exposes thin REST controllers for external integrations and the frontend dashboard.

## Domain Model & Event Sourcing Strategy

The source of truth for the system is the **Domain Events**. No state change occurs without an event being appended to the `domain_events` table. 

### Event Projection Strategy
The `orders` table acts strictly as a **read model / projection**. When a domain event is appended (e.g., `OrderCreated`, `OrderConfirmed`), a projection listener catches it and updates the `orders` read model, providing optimized query performance without sacrificing the audit log.

### Multi-Tenancy
Strict tenant data isolation is enforced. Every domain entity and event requires a `tenantId`. All queries filter by this ID to ensure data security.

## Order Lifecycle

The system enforces strict determinism. Invalid state transitions throw illegal state exceptions.

**Core Workflow:**
`CREATED` → `CONFIRMATION_REQUESTED` → `CONFIRMED` or `REJECTED` → `ASSIGNED_TO_COURIER` → `PICKED_UP` → `DELIVERED` or `FAILED`.

## Local Setup

### Prerequisites
- Docker and Docker Compose
- Java 17
- Node.js 20+

### Running via Docker
The easiest way to start the system locally is using Docker Compose:

```bash
export JWT_SECRET="$(openssl rand -base64 32)"
docker-compose up --build
```
- **Frontend Dashboard:** [http://localhost:80](http://localhost:80)
- **Backend API:** [http://localhost:8080](http://localhost:8080)

### Running Manually

1. **Start Database:**
```bash
docker-compose up postgres -d
```

2. **Run Backend:**
```bash
cd backend
export JWT_SECRET="$(openssl rand -base64 32)"
mvn spring-boot:run
```

3. **Run Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## API Overview

Base URL: `/api/orders`

- `POST /` - Create a new order
- `POST /{id}/request-confirmation` - Request order confirmation
- `POST /{id}/confirm` - Confirm order
- `POST /{id}/reject` - Reject order
- `POST /{id}/assign-courier` - Assign to a courier
- `POST /{id}/pick-up` - Mark picked up
- `POST /{id}/deliver` - Mark delivered
- `POST /{id}/fail` - Mark failed
- `GET /` - List all orders
- `GET /{id}` - Get order details
- `GET /{id}/events` - Get event timeline

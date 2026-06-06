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
- Node.js 20.19+ (Vite 8 requires 20.19+)

### Running via Docker
The easiest way to start the system locally is using Docker Compose:

```bash
cp .env.example .env
docker-compose up --build
```
- **Frontend Dashboard:** [http://localhost:80](http://localhost:80)
- **Backend API:** [http://localhost:8080](http://localhost:8080)

**Local Development Bootstrap User:**
The default Compose stack loads `docker-compose.yml` plus `docker-compose.override.yml`. The override is local-development only and configures Flyway to load the development database seed (`db/seed`).
You can log in to the system with the following credentials:
- **Email:** `admin@example.com`
- **Password:** `password`

The local override also enables public tenant onboarding. Use [http://localhost/signup](http://localhost/signup) to create a real tenant and first ADMIN user without relying on the seed account.

### Tenant Onboarding

Tenant onboarding creates the merchant workspace context, tenant row, and first ADMIN user atomically.

```http
POST /api/onboarding/tenants
Content-Type: application/json

{
  "tenantName": "Atlas Shop",
  "adminName": "Admin User",
  "adminEmail": "admin@example.com",
  "password": "Str0ng!Password"
}
```

Public onboarding is disabled by default unless `APP_ONBOARDING_ENABLED=true` is configured. Keep the development seed limited to local development; production compose loads only `db/migration` and does not load `db/seed`.

### Abuse Protection

The backend applies basic in-memory throttling to `POST /api/auth/login` and `POST /api/onboarding/tenants`.

- Login throttling tracks failed attempts by normalized email and remote IP.
- Onboarding throttling tracks valid onboarding attempts by admin email and remote IP.
- Throttled requests return `429 Too Many Requests` with `Retry-After`.
- Security-sensitive login and onboarding outcomes are logged through the `security.audit` logger with correlation ID, email, tenant ID when available, and remote IP.

The in-memory limiter is single-node only. Use Redis or another shared rate-limit store before running multiple backend instances.

### COD Confirmation Operations

The confirmation queue is available at [http://localhost/confirmations](http://localhost/confirmations) in the frontend. It lists tenant-scoped orders in `CREATED` or `CONFIRMATION_REQUESTED`, with status, date range, customer name/phone search, and pagination filters.

Confirmation attempts are recorded per order with an outcome and note. `CONFIRMED` and `REJECTED` attempts append the matching order lifecycle event and finalize the order into `CONFIRMED` or `REJECTED`. `NO_ANSWER`, `CALL_BACK_LATER`, and `WRONG_NUMBER` keep the order in the queue for follow-up.

`CALL_BACK_LATER` requires a future callback time. Scheduled callbacks appear in the follow-up callbacks section with due, overdue, and upcoming views. Recording a final `CONFIRMED` or `REJECTED` attempt closes any pending callbacks for that order.

**Production Compose:**
Use the production override and provide `JWT_SECRET`, database credentials, CORS origins, and the onboarding toggle from deployment secrets/configuration. This configuration runs only Flyway migrations (`db/migration`) and excludes the development seed (`db/seed`).

```bash
POSTGRES_USER="<production-user>" \
POSTGRES_PASSWORD="<production-password>" \
JWT_SECRET="<production-jwt-secret>" \
CORS_ALLOWED_ORIGINS="https://app.example.com" \
APP_ONBOARDING_ENABLED="false" \
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

Set `APP_ONBOARDING_ENABLED=true` only during a controlled signup window or when the deployment is intentionally self-serve. Set it to `false` after the first tenant is created for closed/private deployments.

### Running Manually

1. **Start Database:**
```bash
docker-compose up postgres -d
```

2. **Run Backend:**
```bash
cd backend
export JWT_SECRET="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
export SPRING_FLYWAY_LOCATIONS="classpath:db/migration,classpath:db/seed"
export APP_ONBOARDING_ENABLED="true"
export APP_SECURITY_THROTTLING_ENABLED="true"
mvn spring-boot:run
```

3. **Run Frontend:**
```bash
cd frontend
nvm use 20.19.0 || nvm install 20.19.0
npm ci
npm run dev
```

## API Overview

Base URL: `/api`

- `POST /api/onboarding/tenants` - Create a tenant and first ADMIN user when onboarding is enabled
- `GET /api/confirmations/queue` - List orders awaiting COD confirmation
- `GET /api/confirmations/callbacks` - List scheduled confirmation callbacks
- `POST /api/confirmations/callbacks/{callbackId}/resolve` - Resolve a scheduled confirmation callback
- `POST /api/orders/{id}/confirmation-attempts` - Record a confirmation attempt
- `GET /api/orders/{id}/confirmation-attempts` - List confirmation attempts for an order
- `POST /api/orders` - Create a new order
- `POST /api/orders/{id}/request-confirmation` - Request order confirmation
- `POST /api/orders/{id}/confirm` - Confirm order
- `POST /api/orders/{id}/reject` - Reject order
- `POST /api/orders/{id}/assign-courier` - Assign to a courier
- `POST /api/orders/{id}/pick-up` - Mark picked up
- `POST /api/orders/{id}/deliver` - Mark delivered
- `POST /api/orders/{id}/fail` - Mark failed
- `GET /api/orders` - List all orders
- `GET /api/orders/{id}` - Get order details
- `GET /api/orders/{id}/events` - Get event timeline

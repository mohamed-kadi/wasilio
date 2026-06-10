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

## Documentation

The full engineering documentation set starts at [docs/phases/documentation-index.md](docs/phases/documentation-index.md).

- [System overview](docs/architecture/system-overview.md)
- [DDD boundaries](docs/architecture/ddd-boundaries.md)
- [Event sourcing](docs/architecture/event-sourcing.md)
- [Multi-tenancy](docs/architecture/multi-tenancy.md)
- [Security](docs/architecture/security.md)
- [Frontend architecture](docs/architecture/frontend-architecture.md)
- [Product vision](docs/product/vision.md)
- [Master roadmap](docs/product/master-roadmap.md)
- [Roadmap](docs/product/roadmap.md)
- [Order lifecycle](docs/product/order-lifecycle.md)
- [Confirmation workflow](docs/product/confirmation-workflow.md)
- [Callback workflow](docs/product/callback-workflow.md)
- [Architecture decision records](docs/decisions/ADR-001-modular-monolith.md)
- [Phase history](docs/phases/documentation-index.md)
- [Audit archive](docs/audits/audit-003-current-readiness.md)
- [Technical debt register](docs/technical-debt.md)
- [Operations runbook](docs/operations.md)

## Order Lifecycle

The system enforces strict determinism. Invalid state transitions throw illegal state exceptions.

**Core Workflow:**
`CREATED` → `CONFIRMATION_REQUESTED` → `CONFIRMED` or `REJECTED` → `ASSIGNED_TO_COURIER` → `PICKED_UP` → `DELIVERED` or `FAILED`.

## Local Setup

### Prerequisites
- Docker and Docker Compose
- Java 17
- Node.js 20.19+ (Vite 8 requires 20.19+)

### Choose One Local Run Mode

Use **Docker Compose** when you want the full app with PostgreSQL, backend, and frontend in one command. This is the recommended path for testing the product locally.

Use **manual running** when you are actively developing backend or frontend code and want hot reload or direct Maven/Vite logs. In manual mode, run PostgreSQL with Docker, then start the backend and frontend from your terminal.

Do not run the Docker backend and the manual backend at the same time on the same host port. Both default to `8080`.

### Running With Docker Compose

```bash
cp .env.example .env
docker-compose up --build
```

Default local URLs:

- **Public landing page:** [http://localhost](http://localhost)
- **Merchant dashboard:** [http://localhost/app](http://localhost/app)
- **Backend API:** [http://localhost:8080](http://localhost:8080)
- **PostgreSQL:** `localhost:5432`

If Docker fails with `bind: address already in use`, another local process is already using one of those host ports. Either stop that process or change the host port in `.env`:

```dotenv
FRONTEND_PORT=8081
BACKEND_PORT=8082
POSTGRES_PORT=5433
```

Then restart Compose:

```bash
docker-compose up --build
```

With the example overrides above, open:

- **Public landing page:** `http://localhost:8081`
- **Merchant dashboard:** `http://localhost:8081/app`
- **Backend API:** `http://localhost:8082`

To see what is using a port on macOS/Linux:

```bash
lsof -nP -iTCP:8080 -sTCP:LISTEN
```

**Local Development Bootstrap User:**
The default Compose stack loads `docker-compose.yml` plus `docker-compose.override.yml`. The override is local-development only and configures Flyway to load the development database seed (`db/seed`).
You can log in to the system with the following credentials:
- **Email:** `admin@example.com`
- **Password:** `password`

The local seed also creates a Nexora staff account for the admin billing workspace:
- **Email:** `superadmin@example.com`
- **Password:** `password`

The local override also enables public tenant onboarding. Use [http://localhost/signup](http://localhost/signup) to create a real tenant and first ADMIN user without relying on the seed account.

The local override sets `SPRING_FLYWAY_OUT_OF_ORDER=true` because the development seed is versioned as `V999`. This lets an existing local database volume accept newer app migrations that were added after the seed had already run. Production compose does not enable this.

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

The backend applies basic in-memory throttling to `POST /api/auth/login`, `POST /api/auth/password-reset/request`, and `POST /api/onboarding/tenants`.

- Login throttling tracks failed attempts by normalized email and remote IP.
- Password reset throttling tracks reset requests by normalized email and remote IP.
- Onboarding throttling tracks valid onboarding attempts by admin email and remote IP.
- Throttled requests return `429 Too Many Requests` with `Retry-After`.
- Security-sensitive login and onboarding outcomes are logged through the `security.audit` logger with correlation ID, email, tenant ID when available, and remote IP.

The in-memory limiter is single-node only. Use Redis or another shared rate-limit store before running multiple backend instances.

### Password Reset Email Delivery

Password reset is available from [http://localhost/forgot-password](http://localhost/forgot-password).

Local Docker uses `APP_EMAIL_MODE=log`, so reset links are printed in backend logs:

```bash
docker-compose logs -f backend
```

In production, set `APP_EMAIL_MODE=smtp` and provide SMTP settings:

```dotenv
APP_EMAIL_MODE=smtp
APP_EMAIL_FROM=Nexora <no-reply@example.com>
APP_SUPPORT_CONTACT=support@example.com
APP_FRONTEND_BASE_URL=https://app.example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_AUTH=true
SMTP_STARTTLS_ENABLE=true
```

The reset response is intentionally generic. If an email does not belong to a user, the API still returns success and does not send a link.

### Public Landing And Lead Capture

The public landing page is available at [http://localhost](http://localhost). Anonymous visitors can request a pilot demo with contact name, store name, phone or WhatsApp number, city, order volume, message, and campaign source.

Lead capture writes to `marketing_leads` through `POST /api/marketing/leads`. Super-admin users can review captured demo requests from the Leads tab in [http://localhost/admin/billing](http://localhost/admin/billing).

### COD Confirmation Operations

The confirmation queue is available at [http://localhost/app/confirmations](http://localhost/app/confirmations) in the frontend. It lists tenant-scoped orders in `CREATED` or `CONFIRMATION_REQUESTED`, with status, date range, customer name/phone search, and pagination filters.

Confirmation attempts are recorded per order with an outcome and note. `CONFIRMED` and `REJECTED` attempts append the matching order lifecycle event and finalize the order into `CONFIRMED` or `REJECTED`. `NO_ANSWER`, `CALL_BACK_LATER`, and `WRONG_NUMBER` keep the order in the queue for follow-up.

`CALL_BACK_LATER` requires a future callback time. Scheduled callbacks appear in the follow-up callbacks section with due, overdue, and upcoming views. Recording a final `CONFIRMED` or `REJECTED` attempt closes any pending callbacks for that order.

### Admin Billing Operations

The admin billing workspace is available at [http://localhost/admin/billing](http://localhost/admin/billing) for users with `SUPER_ADMIN`.

It supports the first launch-readiness billing workflow:

- View tenants.
- Set tenant status.
- Create subscription plans.
- Assign or update a tenant subscription.
- Record manual payments such as cash or bank transfer.
- Generate, review, and print receipt records.
- Review public demo requests from captured marketing leads.

This is intentionally manual-first for Moroccan pilot operations. Online payment gateways, PDF rendering, tax accounting, and automated suspension rules are not implemented yet.

**Production Compose:**
Use the production override and provide `JWT_SECRET`, database credentials, CORS origins, and the onboarding toggle from deployment secrets/configuration. This configuration runs only Flyway migrations (`db/migration`) and excludes the development seed (`db/seed`).

For the first production deployment, create the initial Nexora staff account with the explicit super-admin bootstrap variables. The bootstrap is one-time: if a `SUPER_ADMIN` already exists, startup leaves existing credentials unchanged.

```bash
POSTGRES_USER="<production-user>" \
POSTGRES_PASSWORD="<production-password>" \
JWT_SECRET="<production-jwt-secret>" \
CORS_ALLOWED_ORIGINS="https://app.example.com" \
APP_FRONTEND_BASE_URL="https://app.example.com" \
VITE_PUBLIC_SITE_URL="https://app.example.com" \
VITE_PUBLIC_SUPPORT_EMAIL="support@example.com" \
VITE_PUBLIC_WHATSAPP_URL="https://wa.me/212600000000" \
VITE_PUBLIC_META_PIXEL_ID="" \
APP_EMAIL_MODE="smtp" \
APP_EMAIL_FROM="Nexora <no-reply@example.com>" \
APP_SUPPORT_CONTACT="support@example.com" \
SMTP_HOST="smtp.example.com" \
SMTP_PORT="587" \
SMTP_USERNAME="<smtp-user>" \
SMTP_PASSWORD="<smtp-password>" \
SMTP_AUTH="true" \
SMTP_STARTTLS_ENABLE="true" \
APP_ONBOARDING_ENABLED="false" \
APP_SUPER_ADMIN_BOOTSTRAP_ENABLED="true" \
APP_SUPER_ADMIN_EMAIL="owner@example.com" \
APP_SUPER_ADMIN_PASSWORD="<strong-password-with-upper-lower-number-symbol>" \
APP_SUPER_ADMIN_TENANT_NAME="Nexora Internal" \
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

After the first successful login, set `APP_SUPER_ADMIN_BOOTSTRAP_ENABLED=false` and redeploy. Keep `APP_SUPER_ADMIN_PASSWORD` only in deployment secrets, never in the repository or shell history for shared machines.

Set `APP_ONBOARDING_ENABLED=true` only during a controlled signup window or when the deployment is intentionally self-serve. Set it to `false` after the first tenant is created for closed/private deployments.

### Running Manually For Development

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

Manual local URLs:

- **Public landing page:** [http://localhost:5173](http://localhost:5173)
- **Merchant dashboard:** [http://localhost:5173/app](http://localhost:5173/app)
- **Backend API:** [http://localhost:8080](http://localhost:8080)
- **PostgreSQL:** `localhost:5432`

If you previously started the full Docker stack, stop the Docker backend/frontend before manual development:

```bash
docker-compose stop backend frontend
```

## API Overview

Base URL: `/api`

- `POST /api/onboarding/tenants` - Create a tenant and first ADMIN user when onboarding is enabled
- `POST /api/marketing/leads` - Capture a public pilot/demo request
- `GET /api/marketing/leads` - Super-admin lead list for pilot follow-up
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
- `GET /api/orders/{id}/timeline` - Get unified lifecycle and operational timeline
- `GET /api/admin/tenants` - Super-admin tenant list
- `GET /api/admin/tenants/{tenantId}` - Super-admin tenant billing detail
- `PATCH /api/admin/tenants/{tenantId}/status` - Update tenant status
- `GET /api/admin/plans` - List subscription plans
- `POST /api/admin/plans` - Create a subscription plan
- `POST /api/admin/tenants/{tenantId}/subscription` - Create or update tenant subscription
- `POST /api/admin/tenants/{tenantId}/payments` - Record manual tenant payment
- `GET /api/admin/tenants/{tenantId}/payments/{paymentId}/receipt` - Retrieve printable receipt details

## Publication Checklist

Before the first public trial-client campaign, set real values for:

- `APP_FRONTEND_BASE_URL`
- `VITE_PUBLIC_SITE_URL`
- `VITE_PUBLIC_SUPPORT_EMAIL`
- `VITE_PUBLIC_WHATSAPP_URL`
- `VITE_PUBLIC_META_PIXEL_ID` if Meta Pixel is enabled
- `CORS_ALLOWED_ORIGINS`

The public site includes runtime page metadata, Open Graph tags, `robots.txt`, `sitemap.xml`, legal policy pages, and lead capture. Update `frontend/public/sitemap.xml` with the final production domain before publishing.

Run the frontend launch smoke suite before publishing UI changes:

```bash
cd frontend
npm run smoke
```

The current smoke suite starts Vite locally, verifies landing-page lead capture, and verifies that two tabs in the same browser can keep different signed-in users. Run `npx playwright install chromium` once on new developer or CI machines before the first smoke run.

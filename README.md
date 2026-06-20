# Wasilio

Wasilio is a multi-tenant COD operations platform for Moroccan e-commerce merchants. It helps teams manage order confirmation, callbacks, courier workflows, delivery outcomes, manual payments, receipts, and pilot lead follow-up.

## Start Here

For most local testing, use **Docker Compose**. It runs PostgreSQL, the Spring Boot backend, and the Vite-built frontend together.

You need Docker Desktop running before Docker commands will work on macOS or Windows. On Linux, the Docker daemon must be running.

Prerequisites:

- Docker Desktop or Docker Engine with Docker Compose v2 (`docker compose`)
- Java 17, only for manual backend development and `mvn test`
- Node.js 20.19 or newer, only for manual frontend development and smoke tests

```bash
cp .env.example .env
docker compose up --build
```

Open:

- Public landing page: http://localhost
- Merchant app: http://localhost/app
- Staff admin: http://localhost/admin/billing
- Backend API: http://localhost:8080
- PostgreSQL: `localhost:5432`

Local seeded logins:

| Role | Email | Password | Where to go |
| --- | --- | --- | --- |
| Merchant | `admin@example.com` | `password` | `/app` |
| Wasilio staff / super-admin | `superadmin@example.com` | `password` | `/admin/billing` |

Local signup is also enabled in Docker Compose. You can create another merchant tenant at http://localhost/signup.

## Stop, Restart, And Reset

Stop the stack:

```bash
docker compose down
```

Restart after code or env changes:

```bash
docker compose up --build
```

Reset the local database completely:

```bash
docker compose down -v
docker compose up --build
```

This deletes the local PostgreSQL Docker volume and recreates seed accounts. Do not run `down -v` against production data.

## If Ports Are Busy

The default Docker ports are:

- frontend: `80`
- backend: `8080`
- postgres: `5432`

Check what is using a port:

```bash
lsof -nP -iTCP:8080 -sTCP:LISTEN
```

Either stop that process or change host ports in `.env`:

```dotenv
FRONTEND_PORT=8081
BACKEND_PORT=8082
POSTGRES_PORT=5433
```

Then run:

```bash
docker compose up --build
```

With those overrides, open:

- public landing page: http://localhost:8081
- merchant app: http://localhost:8081/app
- backend API: http://localhost:8082

## Manual Development Mode

Use this mode when you want backend or frontend hot reload and direct terminal logs. Keep Docker running only for PostgreSQL.

First stop Docker backend/frontend if the full stack is running:

```bash
docker compose stop backend frontend
```

Start PostgreSQL:

```bash
docker compose up postgres -d
```

Start backend:

```bash
cd backend
export JWT_SECRET="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="
export SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/nexora"
export SPRING_DATASOURCE_USERNAME="postgres"
export SPRING_DATASOURCE_PASSWORD="password"
export SPRING_FLYWAY_LOCATIONS="classpath:db/migration,classpath:db/seed"
export SPRING_FLYWAY_OUT_OF_ORDER="true"
export APP_ONBOARDING_ENABLED="true"
export APP_SECURITY_THROTTLING_ENABLED="true"
mvn spring-boot:run
```

Start frontend in another terminal:

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Manual local URLs:

- Public landing page: http://localhost:5173
- Merchant app: http://localhost:5173/app
- Staff admin: http://localhost:5173/admin/billing
- Backend API: http://localhost:8080
- PostgreSQL: `localhost:5432`

Do not run the Docker backend and manual backend at the same time. Both use backend port `8080` by default.

## Smoke Tests And Checks

Backend tests:

```bash
cd backend
mvn test
```

Frontend build and lint:

```bash
cd frontend
npm run build
npm run lint
```

Frontend smoke tests:

```bash
cd frontend
npx playwright install chromium
npm run smoke
```

The smoke suite defaults to port `5173`. It starts Vite with `--strictPort` unless a server is already running there. If a stale local server is blocking the port, stop it first:

```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
kill <PID>
```

Current smoke coverage verifies:

- French-first landing lead capture with campaign source.
- Super-admin marketing lead follow-up update.
- Two tabs in one browser can keep different signed-in users.

## What The Main Screens Do

- `/`: public landing page in French, Arabic, and English.
- `/signup`: public tenant onboarding in local development.
- `/login`: login.
- `/app`: merchant dashboard.
- `/app/orders`: order list and order search.
- `/app/confirmations`: confirmation queue and scheduled callbacks.
- `/app/couriers`: courier management and delivery queues.
- `/admin/billing`: Wasilio staff workspace for tenants, plans, subscriptions, manual payments, receipts, and marketing lead follow-up.

## Password Reset In Local Docker

Password reset is available at http://localhost/forgot-password.

Local Docker uses `APP_EMAIL_MODE=log`, so reset links appear in backend logs:

```bash
docker compose logs -f backend
```

## API Overview

Base URL: `/api`

Public:

- `POST /api/onboarding/tenants` - create a tenant and first admin when onboarding is enabled.
- `POST /api/marketing/leads` - capture a public pilot/demo request.
- `POST /api/auth/login` - login.
- `POST /api/auth/password-reset/request` - request password reset.
- `POST /api/auth/password-reset/confirm` - confirm password reset.

Merchant:

- `GET /api/orders`
- `POST /api/orders`
- `GET /api/orders/{id}`
- `GET /api/orders/{id}/events`
- `GET /api/orders/{id}/timeline`
- `POST /api/orders/{id}/request-confirmation`
- `POST /api/orders/{id}/confirm`
- `POST /api/orders/{id}/reject`
- `POST /api/orders/{id}/assign-courier`
- `POST /api/orders/{id}/pick-up`
- `POST /api/orders/{id}/deliver`
- `POST /api/orders/{id}/fail`
- `GET /api/confirmations/queue`
- `GET /api/confirmations/callbacks`
- `POST /api/orders/{id}/confirmation-attempts`
- `GET /api/orders/{id}/confirmation-attempts`
- `POST /api/confirmations/callbacks/{callbackId}/resolve`

Super-admin:

- `GET /api/admin/tenants`
- `GET /api/admin/tenants/{tenantId}`
- `PATCH /api/admin/tenants/{tenantId}/status`
- `GET /api/admin/plans`
- `POST /api/admin/plans`
- `POST /api/admin/tenants/{tenantId}/subscription`
- `POST /api/admin/tenants/{tenantId}/payments`
- `GET /api/admin/tenants/{tenantId}/payments/{paymentId}/receipt`
- `GET /api/marketing/leads`
- `PATCH /api/marketing/leads/{leadId}/follow-up`

Health:

- `GET /actuator/health`
- `GET /actuator/health/liveness`
- `GET /actuator/health/readiness`

## Local Vs Production Compose

Local Docker Compose automatically uses `docker-compose.override.yml`. That override:

- uses local database credentials from `.env`
- loads Flyway migrations and development seed data
- enables public signup
- enables local CORS origins
- logs email instead of sending SMTP

Production must use the production overlay:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

Production compose:

- requires database credentials, JWT secret, CORS origins, frontend URL, email settings, and public Vite values
- runs only `db/migration`
- excludes `db/seed`, so `admin@example.com` and `superadmin@example.com` are not created

For the first production deployment, create the initial Wasilio staff account with explicit bootstrap variables:

```bash
POSTGRES_USER="<production-user>" \
POSTGRES_PASSWORD="<production-password>" \
JWT_SECRET="<production-jwt-secret>" \
CORS_ALLOWED_ORIGINS="https://wasilio.ma" \
APP_FRONTEND_BASE_URL="https://wasilio.ma" \
VITE_PUBLIC_SITE_URL="https://wasilio.ma" \
VITE_PUBLIC_SUPPORT_EMAIL="support@wasilio.ma" \
VITE_PUBLIC_WHATSAPP_URL="https://wa.me/212600000000" \
VITE_PUBLIC_META_PIXEL_ID="" \
APP_EMAIL_MODE="smtp" \
APP_EMAIL_FROM="Wasilio <no-reply@wasilio.ma>" \
APP_SUPPORT_CONTACT="support@wasilio.ma" \
SMTP_HOST="smtp.example.com" \
SMTP_PORT="587" \
SMTP_USERNAME="<smtp-user>" \
SMTP_PASSWORD="<smtp-password>" \
SMTP_AUTH="true" \
SMTP_STARTTLS_ENABLE="true" \
APP_ONBOARDING_ENABLED="false" \
APP_SUPER_ADMIN_BOOTSTRAP_ENABLED="true" \
APP_SUPER_ADMIN_EMAIL="owner@example.com" \
APP_SUPER_ADMIN_PASSWORD="<strong-password>" \
APP_SUPER_ADMIN_TENANT_NAME="Wasilio Internal" \
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

After the first successful staff login, set `APP_SUPER_ADMIN_BOOTSTRAP_ENABLED=false` and redeploy.

## Production Checklist

Before publishing a trial-client campaign:

- Register and configure the real domain.
- Update `VITE_PUBLIC_SITE_URL`.
- Update `frontend/public/sitemap.xml`.
- Set real `VITE_PUBLIC_SUPPORT_EMAIL`.
- Set real `VITE_PUBLIC_WHATSAPP_URL`.
- Set `VITE_PUBLIC_META_PIXEL_ID` only if Meta Pixel is ready.
- Set SMTP values and verify password reset.
- Verify `/terms`, `/privacy`, and `/payment-refund-policy`.
- Submit a test landing lead with `utm_source=smoke`.
- Confirm the lead appears in `/admin/billing`, follow-up status can be updated, and qualified leads can be converted into trial tenants.
- Run `mvn test`, `npm run build`, `npm run lint`, and `npm run smoke`.
- Capture a database backup.

## Backups

Run the backup helper from the deployment host after the production Compose stack is running:

```bash
POSTGRES_USER="<production-user>" \
POSTGRES_DB="nexora" \
BACKUP_DIR="/var/backups/wasilio" \
BACKUP_RETENTION_DAYS="14" \
./scripts/backup-postgres.sh
```

The database name is still `nexora` internally. That is a technical identifier and does not affect public Wasilio branding.

## Documentation

Detailed documentation starts at [docs/phases/documentation-index.md](docs/phases/documentation-index.md).

Useful references:

- [Operations runbook](docs/operations.md)
- [System overview](docs/architecture/system-overview.md)
- [Security](docs/architecture/security.md)
- [Frontend architecture](docs/architecture/frontend-architecture.md)
- [Launch readiness pivot](docs/product/launch-readiness-pivot.md)
- [Pilot acquisition workflow](docs/product/pilot-acquisition-workflow.md)
- [Technical debt register](docs/technical-debt.md)
- [Brand direction](docs/product/brand-direction.md)

# Wasilio

Wasilio is a multi-tenant COD operations platform for Moroccan e-commerce merchants. It helps teams manage order confirmation, callbacks, courier workflows, delivery outcomes, manual payments, receipts, and demo request follow-up.

Current public deployment status: the frontend is live on Cloudflare Pages at `wasilio.ma`. The hosted backend is intentionally deferred while product UX, acquisition readiness, and local demo workflows are polished. See [docs/product/next-implementation-plan.md](docs/product/next-implementation-plan.md).

Documentation starts at [docs/README.md](docs/README.md). Use it as the reading guide for architecture, product workflows, landing-engine handoff, intelligence scoring, and phase history.

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
export APP_FRONTEND_BASE_URL="http://localhost:5173"
export APP_EMAIL_MODE="log"
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

- French-first landing demo request capture with campaign source.
- Super-admin demo request follow-up update.
- Two tabs in one browser can keep different signed-in users.
- Product media upload, stable dashboard thumbnails, storefront media previews, and public product readiness.
- Storefront developer setup URLs for landing-engine product reads and order submits.

## What The Main Screens Do

- `/`: public landing page in French, Arabic, and English.
- `/signup`: public tenant onboarding in local development.
- `/login`: login.
- `/app`: merchant dashboard.
- `/app/orders`: order list and order search.
- `/app/confirmations`: confirmation queue and scheduled callbacks.
- `/app/couriers`: courier management and delivery queues.
- `/admin/billing`: Wasilio staff workspace for merchant workspaces, plans, subscriptions, manual payments, receipts, and demo request follow-up.

## Password Reset In Local Docker

Password reset is available at http://localhost/forgot-password.

Local Docker uses `APP_EMAIL_MODE=log` by default, so reset links appear in backend logs:

```bash
docker compose logs -f backend
```

If `.env` sets `APP_EMAIL_MODE=smtp`, Docker will send through the configured SMTP provider instead. `MailAuthenticationException: Authentication failed` means the provider rejected `SMTP_USERNAME` / `SMTP_PASSWORD`; switch local `.env` back to `APP_EMAIL_MODE=log` for local reset-link testing or use valid SMTP credentials.

Reset links are built from `APP_FRONTEND_BASE_URL`. For local development, keep it set to `http://localhost`; production should use `https://wasilio.ma`.

## API Overview

Base URL: `/api`

Public:

- `POST /api/onboarding/tenants` - create a tenant and first admin when onboarding is enabled.
- `POST /api/marketing/leads` - capture a public demo request.
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

- requires database credentials, JWT secret, CORS origins, frontend URL, email settings, media public URL, API URL, landing-engine URL, and public Vite values
- runs only `db/migration`
- excludes `db/seed`, so `admin@example.com` and `superadmin@example.com` are not created
- publishes the frontend/Nginx service only; the backend stays on the internal Docker network and is reached through `/api` and `/media`

For the full non-programmer testing and deployment sequence, use [docs/deployment/testing-and-deployment-runbook.md](docs/deployment/testing-and-deployment-runbook.md).

For the first controlled merchant trial deployment, do not paste production-like secrets into the root `.env`. Use the environment inventory at [docs/deployment/environment-inventory.md](docs/deployment/environment-inventory.md).

If the trial uses Docker Compose on a VPS, keep a host-only env file outside the repository, for example `/etc/wasilio/trial.env`, then validate it without printing secrets:

```bash
./scripts/trial-env-check.sh /etc/wasilio/trial.env
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml config
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

For the first VPS trial, point the public domain to the frontend/Nginx service. Nginx proxies `/api` and `/media` to the backend container, so do not expose the backend container directly unless you intentionally deploy a separate API origin and ingress.

Create the initial Wasilio staff account with `APP_SUPER_ADMIN_BOOTSTRAP_ENABLED=true`, `APP_SUPER_ADMIN_EMAIL`, and `APP_SUPER_ADMIN_PASSWORD` only during the first deployment. After the first successful staff login, set `APP_SUPER_ADMIN_BOOTSTRAP_ENABLED=false`, remove the bootstrap password from the host secret set, and redeploy.

## Production Checklist

Before publishing a trial-client campaign:

- Confirm `wasilio.ma` and `www.wasilio.ma` are active on Cloudflare Pages.
- Confirm `VITE_PUBLIC_SITE_URL` is `https://wasilio.ma`.
- Confirm `frontend/public/sitemap.xml` uses the final production domain.
- Set real `VITE_PUBLIC_SUPPORT_EMAIL`.
- Set real `VITE_PUBLIC_WHATSAPP_URL`.
- Set `VITE_PUBLIC_META_PIXEL_ID` only if Meta Pixel is ready.
- Set SMTP values and verify password reset.
- Set `APP_MEDIA_PUBLIC_BASE_URL` to the public origin that serves `/media`.
- Set `VITE_API_BASE_URL` to the hosted backend `/api` URL.
- Run `./scripts/trial-env-check.sh` against the host-only trial env.
- Verify `/terms`, `/privacy`, and `/payment-refund-policy`.
- Submit a test landing demo request with `utm_source=smoke`.
- Confirm the request appears in `/admin/billing`, follow-up status can be updated, and qualified requests can be converted into trial merchant workspaces.
- Run `mvn test`, `npm run build`, `npm run lint`, and `npm run smoke`.
- Capture a database backup.

For the current frontend-only deployment, the backend-dependent items in this checklist are deferred until a hosted backend API is connected.

## Backups

Run the backup helper from the deployment host after the production Compose stack is running:

```bash
POSTGRES_USER="<production-user>" \
POSTGRES_DB="nexora" \
BACKUP_DIR="/var/backups/wasilio" \
BACKUP_RETENTION_DAYS="14" \
./scripts/backup-postgres.sh
```

Before a real merchant trial, prove that the dump can restore into an isolated database:

```bash
POSTGRES_USER="<production-user>" \
POSTGRES_DB="nexora" \
./scripts/trial-restore-rehearsal.sh /var/backups/wasilio/wasilio-YYYYMMDDTHHMMSSZ.dump
```

Use [docs/deployment/backup-restore-rehearsal.md](docs/deployment/backup-restore-rehearsal.md) for the full database restore, media-volume backup, and off-host storage procedure.

The database name is still `nexora` internally. That is a technical identifier and does not affect public Wasilio branding.

## Documentation

Detailed documentation starts at [docs/README.md](docs/README.md).

Useful references:

- [Testing and deployment runbook](docs/deployment/testing-and-deployment-runbook.md)
- [Operations runbook](docs/operations.md)
- [System overview](docs/architecture/system-overview.md)
- [Security](docs/architecture/security.md)
- [Frontend architecture](docs/architecture/frontend-architecture.md)
- [Launch readiness pivot](docs/product/launch-readiness-pivot.md)
- [Next implementation plan](docs/product/next-implementation-plan.md)
- [Acquisition workflow](docs/product/pilot-acquisition-workflow.md)
- [Technical debt register](docs/technical-debt.md)
- [Brand direction](docs/product/brand-direction.md)

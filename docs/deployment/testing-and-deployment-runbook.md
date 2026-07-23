# Testing And Deployment Runbook

This runbook is the operator-facing path for testing and deploying Wasilio safely. Use it before changing environment values, starting a local rehearsal, or preparing a controlled merchant trial.

## Golden Rules

1. Choose one mode before running commands.
2. Treat the root `.env` file as local-only.
3. Put real staging or production secrets in the deployment platform or host secret manager, not in committed files.
4. Never run `docker compose down -v` against production data.
5. Do not call the public frontend a complete SaaS until a hosted backend, production database, backups, SMTP, and smoke checks are active.

## Files That Matter

| File | Purpose |
| --- | --- |
| `.env.example` | Local development template only. Copy to `.env` for local Docker work. |
| `docker-compose.yml` | Shared Docker service definitions. |
| `docker-compose.override.yml` | Local Docker defaults: seeds, local CORS, local email logging, local media URL. |
| `docker-compose.prod.yml` | Production overlay: required secrets, migrations only, no seed data. |
| `docs/deployment/environment-inventory.md` | Controlled merchant trial environment ownership, variable placement, and pre-handoff checklist. |
| `docs/deployment/backup-restore-rehearsal.md` | Database restore rehearsal, media backup, off-host storage, and merchant export boundary. |
| `scripts/trial-env-check.sh` | Checks controlled trial environment values without printing secrets. |
| `scripts/trial-account-audit.sh` | Read-only database audit for workspace/user ownership before merchant handoff. |
| `scripts/trial-restore-rehearsal.sh` | Restores a dump into an isolated temporary database and checks required tables. |
| `scripts/hosted-trial-rehearsal.sh` | Runs the hosted backend trial rehearsal checks in the intended order. |
| `scripts/live-backend-smoke.mjs` | Live backend smoke checks for controlled trial deployments. |
| `docs/operations.md` | Technical operations details, backup and restore, projection recovery. |
| `docs/product/landing-engine-integration-rehearsal.md` | Local Wasilio plus landing-engine rehearsal. |
| `docs/technical-debt.md` | Hardening debt that blocks wider SaaS production. |

## Mode 1: Local Demo

Use this mode for daily development, screenshots, guided demos, and local QA.

Expected behavior:

- Frontend: `http://localhost`
- Backend: `http://localhost:8080`
- Database: local Docker PostgreSQL
- Email: logged in backend terminal
- Seed users: available
- Public signup: enabled
- Demo landing-engine product seed: available

Setup:

```bash
cp .env.example .env
docker compose up --build
```

Safe checks:

1. Open `http://localhost`.
2. Log in as the seeded merchant or super-admin.
3. Create an order.
4. Request confirmation.
5. Record a confirmation attempt.
6. Request password reset and copy the logged reset link from backend logs.
7. Upload product media and confirm it renders in the dashboard.

Reset local data only:

```bash
docker compose down -v
docker compose up --build
```

This deletes only the local Docker database volume. Do not use it on a production host.

## Mode 2: Local Landing-Engine Rehearsal

Use this when validating Wasilio with the sibling landing-engine project.

Wasilio should run in local Docker or local backend mode with seed data enabled. Landing-engine should use:

```bash
NEXT_PUBLIC_PRODUCT_PROVIDER=wasilio
NEXT_PUBLIC_WASILIO_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_WASILIO_STORE_SLUG=first-store
```

Safe checks:

1. Open `http://localhost:8080/api/public/storefront/first-store/products/coolair-mini`.
2. Confirm the product response does not expose tenant IDs, lifecycle status, or intelligence scores.
3. Open landing-engine at `http://localhost:3000/products/coolair-mini`.
4. Use `?wasilioPreview=1` when checking fresh Wasilio media after upload.
5. Submit a COD test order.
6. Confirm Wasilio creates the inbound order, normalized order, and internal intelligence snapshot.

Landing-engine remains an order-intent client. It must not send lifecycle commands, fraud scores, confirmation scores, or direct media writes.

## Mode 3: Frontend-Only Public Site

Use this for the current `wasilio.ma` public frontend presence when no hosted backend is connected.

Expected behavior:

- Public pages render.
- Legal pages render.
- SEO and social metadata can be reviewed.
- App login, demo request capture, signup, password reset, and merchant workflows are not production-ready unless a backend API is connected.

Required public build values:

```text
VITE_PUBLIC_SITE_URL=https://wasilio.ma
VITE_PUBLIC_SUPPORT_EMAIL=support@wasilio.ma
VITE_PUBLIC_WHATSAPP_URL=https://wa.me/<number>
VITE_PUBLIC_META_PIXEL_ID=<only when ready>
```

Safe checks:

1. Open `/`.
2. Verify the hero, offer, support email, WhatsApp link, legal links, `robots.txt`, and `sitemap.xml`.
3. Do not run backend-dependent smoke steps unless `VITE_API_BASE_URL` points to a hosted backend.

## Mode 4: Controlled Merchant Trial

Use this for the first real backend deployment with selected merchants.

Recommended first hosted shape:

- one VPS or equivalent host running Docker Compose
- frontend/Nginx is the only public container port
- backend stays internal on the Docker network
- Nginx proxies `/api` and `/media` to the backend
- `APP_MEDIA_PUBLIC_BASE_URL` uses the public origin that serves `/media`

Required before deploy:

- Backend host selected.
- Managed PostgreSQL or production Docker PostgreSQL chosen.
- SMTP credentials verified.
- `APP_FRONTEND_BASE_URL` points to the real frontend.
- `VITE_API_BASE_URL` points to the real backend `/api` URL.
- `APP_MEDIA_PUBLIC_BASE_URL` points to the public backend or same-origin app URL that serves `/media`.
- `VITE_LANDING_ENGINE_URL` points to the landing-engine product site if merchant previews are used.
- Production CORS contains only approved frontend origins.
- Public onboarding decision is explicit.
- Backup location is encrypted and off-host.

Production Compose requires these values:

| Variable | Meaning |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Production database access. |
| `JWT_SECRET` | High-entropy base64 JWT signing secret. |
| `CORS_ALLOWED_ORIGINS` | Approved frontend origins. |
| `APP_FRONTEND_BASE_URL` | Base URL used in password reset and setup links. |
| `APP_EMAIL_MODE`, `APP_EMAIL_FROM`, `APP_SUPPORT_CONTACT` | Email delivery mode and visible sender/support contact. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` | SMTP credentials for account setup and password reset. |
| `APP_MEDIA_PUBLIC_BASE_URL` | Public origin used in uploaded media URLs. |
| `APP_ONBOARDING_ENABLED` | Whether public merchant signup is open. |
| `VITE_API_BASE_URL` | Browser API URL, usually `https://<host>/api`. |
| `VITE_LANDING_ENGINE_URL` | Landing-engine product preview origin. |
| `VITE_PUBLIC_SITE_URL`, `VITE_PUBLIC_SUPPORT_EMAIL` | Public browser-safe values. |

Use `docs/deployment/environment-inventory.md` for the full ownership table before setting these values. To validate a host-only env file without printing secrets:

```bash
./scripts/trial-env-check.sh /etc/wasilio/trial.env
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml config
```

First production bootstrap:

1. Set `APP_SUPER_ADMIN_BOOTSTRAP_ENABLED=true`.
2. Set `APP_SUPER_ADMIN_EMAIL` and `APP_SUPER_ADMIN_PASSWORD`.
3. Deploy with `docker-compose.yml` plus `docker-compose.prod.yml`.
4. Log in as the super-admin once.
5. Set `APP_SUPER_ADMIN_BOOTSTRAP_ENABLED=false`.
6. Redeploy and confirm the same super-admin can still log in.

Trial account ownership audit:

Run this after bootstrap, after lead conversion, and before handing access to a trial merchant:

```bash
POSTGRES_USER="<production-user>" \
POSTGRES_DB="nexora" \
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml" \
./scripts/trial-account-audit.sh
```

The audit is read-only. It prints the workspace/user matrix and flags issues to review:

- super-admin users outside the internal staff workspace
- merchant users attached to the internal staff workspace
- merchant workspaces with no owner/admin login
- merchant workspaces with multiple logins while team management is still basic
- users without display names

Trial smoke checklist:

1. `/actuator/health/readiness` is healthy through the production ingress.
2. Seed users are not present.
3. Super-admin login works.
4. Staff workspace loads merchant workspaces, billing, payments, plans, and demo requests.
5. Password reset or account setup email is delivered through SMTP.
6. A demo request can be captured and converted into a merchant workspace.
7. Merchant owner can set a password and sign in.
8. Merchant can create an order, request confirmation, and record an attempt.
9. Merchant can upload product media and public media URLs resolve from `/media`.
10. A database backup is captured and the artifact name is recorded.
11. The database dump restores into an isolated database through `scripts/trial-restore-rehearsal.sh`.
12. Media volume backup or media host-migration procedure is documented.

One-command rehearsal wrapper:

```bash
WASILIO_API_BASE_URL="https://<backend-origin>" \
WASILIO_SUPER_ADMIN_EMAIL="<staff-email>" \
WASILIO_SUPER_ADMIN_PASSWORD="<staff-password>" \
WASILIO_MERCHANT_EMAIL="<merchant-owner-email>" \
WASILIO_MERCHANT_PASSWORD="<merchant-owner-password>" \
./scripts/hosted-trial-rehearsal.sh /etc/wasilio/trial.env
```

This wrapper runs the environment inventory check, production Compose config validation, and live backend smoke in order. It does not print secret values. Account audit and restore rehearsal remain opt-in because they require live database access and a fresh backup artifact:

```bash
RUN_ACCOUNT_AUDIT=true \
POSTGRES_USER="<production-user>" \
POSTGRES_DB="nexora" \
./scripts/hosted-trial-rehearsal.sh /etc/wasilio/trial.env /var/backups/wasilio/wasilio-YYYYMMDDTHHMMSSZ.dump
```

Backup and restore rehearsal:

```bash
POSTGRES_USER="<production-user>" \
POSTGRES_DB="nexora" \
BACKUP_DIR="/var/backups/wasilio" \
BACKUP_PREFIX="wasilio" \
./scripts/backup-postgres.sh
```

Then restore the printed `.dump` artifact into an isolated temporary database:

```bash
POSTGRES_USER="<production-user>" \
POSTGRES_DB="nexora" \
./scripts/trial-restore-rehearsal.sh /var/backups/wasilio/wasilio-YYYYMMDDTHHMMSSZ.dump
```

Use `docs/deployment/backup-restore-rehearsal.md` for the full local and hosted trial procedure, including media volume backup.

Live backend smoke command:

Use this after deploy for executable checks. The default checks are non-mutating unless the optional flags are set.

```bash
WASILIO_API_BASE_URL="https://<backend-origin>" \
WASILIO_SUPER_ADMIN_EMAIL="<staff-email>" \
WASILIO_SUPER_ADMIN_PASSWORD="<staff-password>" \
node scripts/live-backend-smoke.mjs
```

To include controlled test records during a trial rehearsal:

```bash
WASILIO_API_BASE_URL="https://<backend-origin>" \
WASILIO_SUPER_ADMIN_EMAIL="<staff-email>" \
WASILIO_SUPER_ADMIN_PASSWORD="<staff-password>" \
WASILIO_SMOKE_CAPTURE_LEAD=true \
WASILIO_SMOKE_PASSWORD_RESET_EMAIL="<merchant-owner-email>" \
WASILIO_MERCHANT_EMAIL="<merchant-owner-email>" \
WASILIO_MERCHANT_PASSWORD="<merchant-owner-password>" \
WASILIO_SMOKE_CREATE_ORDER=true \
WASILIO_SMOKE_RECORD_CONFIRMATION_ATTEMPT=true \
WASILIO_SMOKE_UPLOAD_MEDIA=true \
node scripts/live-backend-smoke.mjs
```

Only use the mutating flags when the created lead, order, or product/media record can remain as an explicit smoke record or be cleaned through the normal product workflow. Merchant Orders CSV export is checked automatically when merchant smoke credentials are supplied.

## Mode 5: Paid SaaS Production Gate

Do not move beyond selected controlled merchant trials until these are true:

- Scheduled database backups run automatically.
- Backups are copied to encrypted off-host storage.
- A restore drill has passed against an isolated database.
- Monitoring and error alerting are active.
- Ingress sanitizes or overwrites `X-Forwarded-For`.
- Login/onboarding/password reset throttling is distributed or enforced at the gateway/WAF.
- JWT lifetime, rotation, refresh, and revocation strategy are approved.
- Outbox/retry or equivalent projection/event delivery recovery is designed for additional consumers.
- Live-backend smoke tests cover login, onboarding/account setup, order creation, confirmation, courier flow, media upload, billing, payments, and receipts.
- Legal, support, refund/payment, and privacy pages have final business review.

## Rollback And Recovery

For application rollback:

1. Stop the new release.
2. Redeploy the previous known-good image/configuration.
3. Run health, login, order list, and staff workspace smoke checks.

For data corruption:

1. Stop writes.
2. Restore the latest valid backup into an isolated database first.
3. Verify readiness, login, orders, timelines, billing, payments, receipts, and demo requests.
4. Promote only after the isolated restore passes.

For projection drift:

1. Confirm `domain_events` remains intact.
2. Schedule a maintenance window.
3. Run one backend instance with `APP_PROJECTIONS_REBUILD_ORDERS_ON_STARTUP=true`.
4. Return the flag to `false` after the rebuild.

## Current Recommendation

The next real deployment step is Mode 4 only when Wasilio is ready to host the backend for selected trial merchants. Until then, use Mode 1 and Mode 2 for product QA, and Mode 3 for the public frontend/acquisition presence.

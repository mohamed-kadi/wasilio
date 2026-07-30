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
| `docs/deployment/hosted-trial-operator-guide.md` | Step-by-step Hostinger/VPS hosted trial guide with command explanations, backup, and restore. |
| `docs/deployment/backup-restore-rehearsal.md` | Database restore rehearsal, media backup, off-host storage, and merchant export boundary. |
| `docs/deployment/trial-deployment-log.md` | Optional checklist template for recording deployment checks, artifacts, and handoff decisions. |
| `scripts/trial-env-check.sh` | Checks controlled trial environment values without printing secrets. |
| `scripts/trial-account-audit.sh` | Read-only database audit for workspace/user ownership before merchant handoff. |
| `scripts/trial-restore-rehearsal.sh` | Restores a dump into an isolated temporary database and checks required tables. |
| `scripts/hosted-trial-rehearsal.sh` | Runs the hosted backend trial rehearsal checks in the intended order. |
| `scripts/live-backend-smoke.mjs` | Live backend smoke checks for controlled trial deployments. |
| `scripts/controlled-traffic-check.mjs` | GET-only low-rate hosted traffic check for readiness, frontend, and public product reads. |
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

This section is the single source of truth for the hosted-backend trial. If no host exists yet, stop after local checks and do not treat the backend as deployed.

Recommended first hosted shape:

- one VPS or equivalent host running Docker Compose
- frontend/Nginx is the only public container port
- backend stays internal on the Docker network
- Nginx proxies `/api`, `/media`, and health-only Actuator routes to the backend
- `APP_MEDIA_PUBLIC_BASE_URL` uses the public origin that serves `/media`

Use `docs/deployment/trial-deployment-log.md` as the current hosted trial status record and open handoff checklist.

For the command-by-command Hostinger/VPS walkthrough, use `docs/deployment/hosted-trial-operator-guide.md`. Keep this Mode 4 section as the decision checklist and production-readiness gate.

Current hosted trial shape verified in July 2026:

- Hostinger VPS runs Docker Compose from `/opt/wasilio`.
- The host-only env file is `/etc/wasilio/trial.env`.
- Docker frontend/Nginx is bound to `127.0.0.1:8080` with `FRONTEND_PORT=127.0.0.1:8080`.
- Caddy is the public HTTPS entrypoint for `app.wasilio.ma`.
- Caddy reverse-proxies to the local frontend/Nginx service at `127.0.0.1:8080`.
- Backend and PostgreSQL containers stay internal to Docker.
- Cloudflare DNS manages the domain. For this Caddy-origin setup, the `app` DNS record is DNS-only, not proxied.
- `APP_SUPER_ADMIN_BOOTSTRAP_ENABLED=false` after the first staff login, and the bootstrap password is removed from the host env file.

Required before deploy:

- Backend host selected.
- Managed PostgreSQL or production Docker PostgreSQL chosen.
- HTTPS is configured in front of login, setup/reset links, `/api`, `/media`, and health checks.
- SMTP credentials verified.
- `APP_FRONTEND_BASE_URL` points to the real frontend.
- `VITE_API_BASE_URL` points to the real backend `/api` URL.
- `APP_MEDIA_PUBLIC_BASE_URL` points to the public backend or same-origin app URL that serves `/media`.
- `VITE_LANDING_ENGINE_URL` points to the landing-engine product site if merchant previews are used.
- `VITE_LANDING_ENGINE_PRODUCT_PATH_PATTERN` matches the customer-page route shape. Keep `/products/:productSlug` for one configured merchant storefront, or use a store-aware pattern such as `/stores/:storeSlug/products/:productSlug` only after the customer-page host supports it.
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
| `VITE_LANDING_ENGINE_PRODUCT_PATH_PATTERN` | Customer-page product route pattern used by dashboard Preview links. |
| `VITE_PUBLIC_SITE_URL`, `VITE_PUBLIC_SUPPORT_EMAIL` | Public browser-safe values. |

Use `docs/deployment/environment-inventory.md` for the full ownership table before setting these values.

Execution sequence:

1. Choose the host and point the trial domain or subdomain to it.
2. Install Docker Engine with Docker Compose v2.
3. Configure HTTPS in front of login, setup/reset links, `/api`, `/media`, and `/actuator/health`.
4. Clone the repository and check out the exact commit intended for the trial.
5. Create `/etc/wasilio/trial.env` on the host with restricted permissions.
6. Populate `/etc/wasilio/trial.env` from `docs/deployment/environment-inventory.md`. Do not copy the local root `.env`.
7. Validate the host env file and production Compose config.
8. Deploy once with staff bootstrap enabled.
9. Log in as staff, then disable bootstrap, remove the bootstrap password from host config, and redeploy.
10. Convert one qualified demo request into one merchant owner through setup email.
11. Run smoke checks, account audit, backup, restore rehearsal, media URL check, and Orders CSV check.
12. Hand access to the merchant only after every check passes.

Hostinger VPS command walkthrough:

Run the Mac commands in your Mac terminal. Run the VPS commands after connecting with SSH. Replace placeholders like `<vps-ip>`, `<commit-sha>`, `<trial-domain>`, and emails with the real values. Do not paste secrets into documentation or Git.

### 1. Create and register the SSH key from the Mac

```bash
ssh-keygen -t ed25519 -C "wasilio-vps" -f ~/.ssh/id_ed25519_wasilio_vps
```

Creates a new SSH key pair on the Mac. The private key stays on the Mac at `~/.ssh/id_ed25519_wasilio_vps`; the public key is written to `~/.ssh/id_ed25519_wasilio_vps.pub`.

```bash
cat ~/.ssh/id_ed25519_wasilio_vps.pub
```

Prints the public key. Paste the whole line that starts with `ssh-ed25519` into Hostinger's SSH key field. Use a name such as `wasilio-vps`.

### 2. Connect to the VPS and verify the host

```bash
ssh -i ~/.ssh/id_ed25519_wasilio_vps root@<vps-ip>
```

Connects from the Mac to the Hostinger VPS as `root` using the private key. After this command, the shell prompt belongs to the VPS, not the Mac.

```bash
whoami
hostnamectl
```

Checks that the current user is `root` and prints the VPS operating system and hostname details.

### 3. Check Docker and firewall state

```bash
docker --version
docker compose version
```

Confirms Docker Engine and Docker Compose are available on the VPS.

```bash
ufw status
```

Shows the firewall rules. For this setup, SSH, HTTP `80/tcp`, and HTTPS `443/tcp` must be allowed.

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

Allows SSH, HTTP, and HTTPS traffic, then enables the firewall if it is not already active.

### 4. Point DNS and check reachability

In Cloudflare DNS, add an `A` record:

- Name: `app`
- Content: `<vps-ip>`
- Proxy status for this Caddy setup: DNS-only
- TTL: auto

```bash
dig +short app.wasilio.ma
```

Checks which IP addresses DNS returns. If Cloudflare proxy is enabled, this shows Cloudflare IPs. If DNS-only is enabled, this should resolve to the VPS IP after propagation.

```bash
curl -I http://<vps-ip>
```

Checks whether the VPS responds directly on HTTP before troubleshooting the domain.

### 5. Clone the Wasilio repository on the VPS

```bash
mkdir -p /opt
cd /opt
git clone https://github.com/mohamed-kadi/wasilio.git wasilio
cd /opt/wasilio
git checkout <commit-sha>
git status --short
```

Creates `/opt`, clones Wasilio into `/opt/wasilio`, checks out the exact commit intended for the hosted trial, and confirms the working tree is clean.

### 6. Create the host-only environment file

```bash
mkdir -p /etc/wasilio
nano /etc/wasilio/trial.env
```

Creates the config directory and opens the private host env file. This file is not part of Git. Put deployment values here, including database credentials, JWT secret, SMTP values, public URLs, CORS origins, and first-run staff bootstrap values.

Generate high-entropy secrets on the VPS when needed:

```bash
openssl rand -base64 48
```

Prints a random secret suitable for values such as `JWT_SECRET`. Save the generated value only in the host env file or secret manager.

Recommended hosted trial values after first staff login:

```text
APP_EMAIL_MODE=smtp
APP_ONBOARDING_ENABLED=false
APP_MEDIA_PUBLIC_BASE_URL=https://app.wasilio.ma
APP_FRONTEND_BASE_URL=https://app.wasilio.ma
VITE_API_BASE_URL=/api
FRONTEND_PORT=127.0.0.1:8080
APP_SUPER_ADMIN_BOOTSTRAP_ENABLED=false
APP_SUPER_ADMIN_PASSWORD=
```

The first deploy temporarily needs `APP_SUPER_ADMIN_BOOTSTRAP_ENABLED=true`, `APP_SUPER_ADMIN_EMAIL`, and `APP_SUPER_ADMIN_PASSWORD`. Disable bootstrap and remove the bootstrap password after the first successful staff login.

### 7. Validate and start Docker Compose

```bash
./scripts/trial-env-check.sh /etc/wasilio/trial.env
```

Checks that required hosted trial values exist without printing secrets. Policy warnings must be reviewed before merchant handoff.

```bash
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml config
```

Renders the final production Compose configuration and catches missing variables before starting containers.

```bash
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Builds and starts PostgreSQL, backend, and frontend/Nginx containers in detached mode.

```bash
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml ps
```

Shows container status. Expected services are `postgres`, `backend`, and `frontend`.

```bash
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 backend
```

Shows the last backend log lines for startup, migration, SMTP, or runtime errors.

### 8. Verify the local container entrypoint

```bash
curl -I http://127.0.0.1:8080
curl -fsS http://127.0.0.1:8080/actuator/health/readiness
```

Checks that frontend/Nginx responds locally on the VPS and that Nginx can proxy the readiness health check to the backend.

### 9. Configure Caddy HTTPS

```bash
caddy version
systemctl status caddy --no-pager
```

Confirms Caddy is installed and shows whether the service is running.

```bash
nano /etc/caddy/Caddyfile
```

Open the Caddy config. For the hosted trial, the relevant site block is:

```text
app.wasilio.ma {
    reverse_proxy 127.0.0.1:8080
}
```

This makes Caddy terminate HTTPS publicly and forward requests to Docker's local frontend/Nginx port.

```bash
systemctl restart caddy
systemctl status caddy --no-pager
```

Restarts Caddy and confirms it is active. If Caddy fails with `address already in use` on port 80, Docker is still bound publicly on `80`. Set `FRONTEND_PORT=127.0.0.1:8080` in `/etc/wasilio/trial.env`, redeploy Compose, then restart Caddy.

### 10. Verify public HTTPS

```bash
curl -I http://app.wasilio.ma
curl -I https://app.wasilio.ma
curl -fsS https://app.wasilio.ma/actuator/health/readiness
```

Confirms HTTP redirects to HTTPS, HTTPS returns the Wasilio frontend, and the public health route reaches the backend through Caddy and Nginx.

### 11. Deploy a newer commit later

```bash
cd /opt/wasilio
git fetch origin
git checkout <new-commit-sha>
git status --short
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Pulls the latest repository state, checks out the specific pushed commit, confirms the working tree, and rebuilds/restarts the stack.

For backend-only changes, this shorter command is acceptable:

```bash
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml up -d --build backend
```

Use full rebuild when frontend code, Vite build values, Docker config, Nginx config, or shared assets changed.

### 12. Practical hosted smoke checks

Use the browser for account and workflow checks:

- staff login at `https://app.wasilio.ma/login`
- password reset email from `https://app.wasilio.ma/forgot-password`
- public demo request from `https://wasilio.ma`
- demo request conversion in staff billing/demo requests
- merchant password setup and merchant login
- product creation, media upload, store settings, and publishing readiness
- public product API on `https://app.wasilio.ma/api/public/storefront/<store-slug>/products/<product-slug>`
- public order intake by POST to `https://app.wasilio.ma/api/public/storefront/<store-slug>/orders`
- inbound order to confirmation
- confirmation to assignment queue

For public order intake, a browser `GET` returns `405 Method Not Allowed`; that is expected because the endpoint accepts `POST` only.

### 13. Controlled traffic rehearsal

Do not run load tests against `app.wasilio.ma` casually. Use a defined test window, test accounts, and a cleanup plan so the trial data and provider limits stay understandable.

Traffic rehearsal stages:

1. Local baseline: run API and frontend checks locally with seeded data to catch obvious regressions.
2. Hosted low-rate smoke: run a small scripted flow against the VPS after deployment, using dedicated test merchant records.
3. Hosted concurrency rehearsal: simulate concurrent logins, product reads, public product API reads, public order intake posts, inbound review, and confirmation actions.
4. Public campaign readiness: only after rate limits, backups, monitoring, and intake abuse controls are reviewed.

What to measure:

- HTTP error rate for login, password reset, product API, order intake, and confirmation actions.
- p95 response time for public product reads and public order intake.
- backend CPU and memory usage.
- PostgreSQL CPU, disk usage, and active connections.
- Nginx/Caddy access and error logs.
- application logs for throttling, validation errors, and failed order normalization.

Robustness controls before wider traffic:

- keep login, password reset, onboarding, and public order intake throttling enabled
- add WAF or gateway rules for obvious bot traffic before paid ads
- keep daily backups and restore rehearsal current
- keep media backup or media migration procedure current
- define a rollback commit and redeploy command before each campaign
- add monitoring/alerts for backend health, disk usage, and database failures

Minimum host-only env policy for a closed trial:

```text
APP_EMAIL_MODE=smtp
APP_ONBOARDING_ENABLED=false
APP_MEDIA_PUBLIC_BASE_URL=https://<trial-domain>
APP_FRONTEND_BASE_URL=https://<trial-domain>
VITE_API_BASE_URL=/api
```

Validation commands:

```bash
./scripts/trial-env-check.sh /etc/wasilio/trial.env
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml config
```

First production bootstrap:

1. Set `APP_SUPER_ADMIN_BOOTSTRAP_ENABLED=true`.
2. Set `APP_SUPER_ADMIN_EMAIL` and `APP_SUPER_ADMIN_PASSWORD`.
3. Deploy with `docker-compose.yml` plus `docker-compose.prod.yml`.
4. Check health with `curl -fsS https://<trial-domain>/actuator/health/readiness`.
5. Log in as the super-admin once.
6. Set `APP_SUPER_ADMIN_BOOTSTRAP_ENABLED=false`.
7. Remove `APP_SUPER_ADMIN_PASSWORD` from the host config.
8. Redeploy and confirm the same super-admin can still log in.

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

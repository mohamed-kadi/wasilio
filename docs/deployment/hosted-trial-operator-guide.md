# Hosted Trial Operator Guide

This guide explains the practical hosted Wasilio trial setup from the beginning. It is written for an operator who wants to understand what to run, where to run it, and what each command means.

This is different from `trial-deployment-log.md`. The log records what happened in one trial. This guide explains how to repeat the process safely.

## Safety Labels

- Safe: read-only or non-destructive.
- Changes server: modifies the VPS, app config, DNS, or running containers.
- Destructive: can delete live trial data or media. Run only during an intentional restore drill or real emergency.

## Names Used In This Guide

Replace placeholders before running commands:

| Placeholder | Meaning |
| --- | --- |
| `<vps-ip>` | Public IP address from Hostinger. |
| `<trial-domain>` | Hosted app domain, for example `app.wasilio.ma`. |
| `<commit-sha>` | Git commit to deploy. |
| `<new-commit-sha>` | New Git commit to deploy later. |
| `<staff-email>` | Wasilio staff/super-admin email. |
| `<merchant-email>` | Merchant owner email. |

Current hosted trial paths:

| Item | Value |
| --- | --- |
| VPS app folder | `/opt/wasilio` |
| Host-only env file | `/etc/wasilio/trial.env` |
| Live database | `nexora` |
| PostgreSQL service | `postgres` |
| Frontend service | `frontend` |
| Backend service | `backend` |
| Media Docker volume | `wasilio_backend_media` |
| Public app origin | `https://app.wasilio.ma` |

## 1. Choose The VPS

Where: Hostinger dashboard.

Recommended for controlled trial:

- Region: choose the closest low-latency region to Morocco and your expected merchants. Germany or France are both acceptable when latency is low.
- Image/type: plain Ubuntu OS is enough.
- Panels: do not add cPanel or Plesk for Wasilio. The app already has its own Docker deployment.
- Website builder/WordPress: not needed for Wasilio.
- Docker manager: optional, but command line remains the source of truth.
- Malware scanner: optional if free. It does not replace backups or app security.

Why:

- Wasilio is deployed with Docker Compose.
- Caddy handles HTTPS.
- PostgreSQL runs in Docker for this controlled single-server trial.

## 2. Create An SSH Key On The Mac

Where: Mac terminal.

Safe.

```bash
ssh-keygen -t ed25519 -C "wasilio-vps" -f ~/.ssh/id_ed25519_wasilio_vps
```

Meaning:

- Creates a new SSH key pair.
- Private key: `~/.ssh/id_ed25519_wasilio_vps`
- Public key: `~/.ssh/id_ed25519_wasilio_vps.pub`
- The private key stays on your Mac.
- The public key is what Hostinger receives.

Print the public key:

```bash
cat ~/.ssh/id_ed25519_wasilio_vps.pub
```

Meaning:

- Shows the public key line that starts with `ssh-ed25519`.
- Copy the full line into Hostinger.
- In Hostinger's required name field, use something clear such as `wasilio-vps`.

## 3. Connect To The VPS

Where: Mac terminal.

Safe.

```bash
ssh -i ~/.ssh/id_ed25519_wasilio_vps root@<vps-ip>
```

Meaning:

- Opens a secure shell from your Mac into the VPS.
- `root@...` means you are controlling the server.
- After this command, commands run on the VPS, not your Mac.

Confirm where you are:

```bash
whoami
hostnamectl
```

Meaning:

- `whoami` should print `root`.
- `hostnamectl` prints the VPS hostname and OS details.

## 4. Check Docker And Firewall

Where: VPS SSH terminal.

Safe.

```bash
docker --version
docker compose version
```

Meaning:

- Confirms Docker Engine and Docker Compose are installed.

If Docker is missing, install Docker before continuing. Use Hostinger's Docker image/installer or Docker's official Ubuntu instructions.

Check firewall:

```bash
ufw status
```

Meaning:

- Shows which ports are open.
- Wasilio needs SSH, HTTP, and HTTPS.

If needed:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

Meaning:

- Allows SSH access.
- Allows web traffic on ports 80 and 443.
- Enables the firewall.

## 5. Point DNS To The VPS

Where: Cloudflare dashboard.

Changes server/domain behavior.

Create an `A` record:

| Field | Value |
| --- | --- |
| Type | `A` |
| Name | `app` |
| Content | `<vps-ip>` |
| TTL | Auto |
| Proxy status | DNS-only for this Caddy setup |

Check DNS from Mac or VPS:

```bash
dig +short app.wasilio.ma
```

Meaning:

- Shows what IP address the domain currently resolves to.
- If Cloudflare proxy is orange/proxied, it returns Cloudflare IPs.
- If DNS-only is grey, it should eventually return the VPS IP.

Check direct HTTP reachability:

```bash
curl -I http://<vps-ip>
```

Meaning:

- Sends a lightweight HTTP header request to the VPS.
- `200 OK` means something is serving HTTP.
- Connection failure means the app, firewall, or port binding needs review.

## 6. Clone Wasilio On The VPS

Where: VPS SSH terminal.

Changes server filesystem.

```bash
mkdir -p /opt
cd /opt
git clone https://github.com/mohamed-kadi/wasilio.git wasilio
cd /opt/wasilio
git checkout <commit-sha>
git status --short
```

Meaning:

- Creates `/opt` if it does not already exist.
- Clones the Wasilio repo into `/opt/wasilio`.
- Checks out the exact commit intended for the trial.
- `git status --short` should print nothing for a clean checkout.

The detached HEAD message after `git checkout <commit-sha>` is normal. It means the server is pinned to an exact commit.

## 7. Create The Host Environment File

Where: VPS SSH terminal.

Changes server config.

```bash
mkdir -p /etc/wasilio
chmod 700 /etc/wasilio
touch /etc/wasilio/trial.env
chmod 600 /etc/wasilio/trial.env
nano /etc/wasilio/trial.env
```

Meaning:

- Creates a private config folder.
- Restricts folder access.
- Creates the env file.
- Restricts file access.
- Opens the file in `nano`.

Generate secrets when needed:

```bash
openssl rand -base64 48
```

Meaning:

- Prints a strong random value.
- Use it for secrets like `JWT_SECRET`.
- Store it only in `/etc/wasilio/trial.env` or a real secret manager.

Minimum shape for `/etc/wasilio/trial.env`:

```text
POSTGRES_DB=nexora
POSTGRES_USER=wasilio
POSTGRES_PASSWORD=<strong-database-password>

JWT_SECRET=<strong-random-secret>
CORS_ALLOWED_ORIGINS=https://app.wasilio.ma,https://wasilio.ma,https://www.wasilio.ma

APP_FRONTEND_BASE_URL=https://app.wasilio.ma
APP_MEDIA_PUBLIC_BASE_URL=https://app.wasilio.ma
APP_ONBOARDING_ENABLED=false

APP_EMAIL_MODE=smtp
APP_EMAIL_FROM=Wasilio <no-reply@wasilio.ma>
APP_SUPPORT_CONTACT=support@wasilio.ma
APP_EMAIL_DISPLAY_ZONE=Africa/Casablanca

SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USERNAME=<smtp-username>
SMTP_PASSWORD=<smtp-password>
SMTP_AUTH=true
SMTP_STARTTLS_ENABLE=true

VITE_API_BASE_URL=/api
VITE_LANDING_ENGINE_URL=https://wasilio.ma
VITE_PUBLIC_SITE_URL=https://wasilio.ma
VITE_PUBLIC_SUPPORT_EMAIL=support@wasilio.ma
VITE_PUBLIC_WHATSAPP_URL=<public-whatsapp-link-or-blank>
VITE_PUBLIC_META_PIXEL_ID=

FRONTEND_PORT=127.0.0.1:8080

APP_SUPER_ADMIN_BOOTSTRAP_ENABLED=true
APP_SUPER_ADMIN_EMAIL=<staff-email>
APP_SUPER_ADMIN_PASSWORD=<temporary-bootstrap-password>
APP_SUPER_ADMIN_TENANT_NAME=Wasilio Internal
```

Important:

- `APP_SUPER_ADMIN_BOOTSTRAP_ENABLED=true` is only for the first deployment.
- After first staff login works, set it to `false`.
- Then remove `APP_SUPER_ADMIN_PASSWORD` from the file or leave it blank.

## 8. Validate The Environment

Where: VPS SSH terminal in `/opt/wasilio`.

Safe.

```bash
cd /opt/wasilio
./scripts/trial-env-check.sh /etc/wasilio/trial.env
```

Meaning:

- Checks required values without printing secrets.
- Passing means the file has the values needed by the trial deployment.
- Policy warnings are not always blockers, but they must be understood.

Render Docker Compose config:

```bash
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml config
```

Meaning:

- Combines the shared Docker file with the production overlay.
- Catches missing required variables before starting containers.

## 9. Start Wasilio

Where: VPS SSH terminal in `/opt/wasilio`.

Changes server runtime.

```bash
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Meaning:

- Builds the frontend and backend images.
- Starts PostgreSQL, backend, and frontend/Nginx containers.
- `-d` means detached mode, so containers run in the background.

Check running containers:

```bash
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml ps
```

Meaning:

- Shows whether `postgres`, `backend`, and `frontend` are up.

Check backend logs:

```bash
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 backend
```

Meaning:

- Shows recent backend startup logs.
- Use it to catch migration, SMTP, config, or runtime errors.

## 10. Check The Local VPS Entrypoint

Where: VPS SSH terminal.

Safe.

```bash
curl -I http://127.0.0.1:8080
curl -fsS http://127.0.0.1:8080/actuator/health/readiness
```

Meaning:

- First command checks frontend/Nginx.
- Second command checks Nginx proxying to backend health.
- Expected health response: `{"status":"UP"}`.

## 11. Configure Caddy HTTPS

Where: VPS SSH terminal.

Changes server runtime.

```bash
caddy version
systemctl status caddy --no-pager
```

Meaning:

- Confirms Caddy is installed.
- Shows whether Caddy is active.

Open Caddy config:

```bash
nano /etc/caddy/Caddyfile
```

Use this site block:

```text
app.wasilio.ma {
    reverse_proxy 127.0.0.1:8080
}
```

Meaning:

- Caddy receives public traffic on ports 80 and 443.
- Caddy automatically issues HTTPS certificates.
- Caddy forwards requests to Wasilio's local Docker frontend/Nginx on `127.0.0.1:8080`.

Restart Caddy:

```bash
systemctl restart caddy
systemctl status caddy --no-pager
```

Meaning:

- Applies the Caddy config.
- Confirms Caddy is running.

If Caddy says port 80 is already in use:

- Make sure `/etc/wasilio/trial.env` has `FRONTEND_PORT=127.0.0.1:8080`.
- Redeploy Docker Compose.
- Restart Caddy again.

## 12. Verify Public HTTPS

Where: Mac terminal or VPS SSH terminal.

Safe.

```bash
curl -I http://app.wasilio.ma
curl -I https://app.wasilio.ma
curl -fsS https://app.wasilio.ma/actuator/health/readiness
```

Meaning:

- HTTP should redirect to HTTPS.
- HTTPS should return `200`.
- Readiness should return `{"status":"UP"}`.

In the browser:

- Open `https://app.wasilio.ma`.
- Login as the bootstrap staff account.

## 13. Disable Bootstrap After First Staff Login

Where: VPS SSH terminal.

Changes server config/runtime.

Open env file:

```bash
nano /etc/wasilio/trial.env
```

Change:

```text
APP_SUPER_ADMIN_BOOTSTRAP_ENABLED=false
APP_SUPER_ADMIN_PASSWORD=
```

Redeploy:

```bash
cd /opt/wasilio
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Meaning:

- Stops automatic super-admin bootstrap from running again.
- Removes the bootstrap password from server config.
- Existing staff user remains in the database.

Verify:

- Staff login still works in the browser.
- Password reset email works.

## 14. Deploy A New Commit Later

Where: VPS SSH terminal.

Changes server runtime.

```bash
cd /opt/wasilio
git fetch origin
git checkout <new-commit-sha>
git status --short
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Meaning:

- Downloads latest Git data.
- Moves the server to the exact commit.
- Confirms no unexpected local changes.
- Rebuilds and restarts the app.

For backend-only changes:

```bash
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml up -d --build backend
```

Use the full rebuild when frontend files, Vite variables, Docker files, Nginx config, or shared assets changed.

## 15. Practical Hosted Test Path

Where: browser and VPS SSH terminal.

Safe except where noted by the app UI.

Test one item at a time:

1. Staff login works.
2. Password reset email is delivered and link works.
3. Public demo request reaches staff dashboard.
4. Staff converts demo request into a merchant workspace.
5. Merchant owner sets password.
6. Merchant owner logs in.
7. Merchant creates product.
8. Merchant completes store settings.
9. Merchant uploads product image.
10. Product reaches publishing readiness.
11. Public product API returns JSON.
12. Public order intake creates inbound order.
13. Inbound order opens Confirmation Ops.
14. Confirmation moves order to Assignment Queue.
15. Orders CSV export downloads from Orders workspace.

Public product API:

```text
https://app.wasilio.ma/api/public/storefront/<store-slug>/products/<product-slug>
```

Public order intake:

```text
POST https://app.wasilio.ma/api/public/storefront/<store-slug>/orders
```

Important:

- Opening the order-intake URL in a browser uses `GET`.
- A browser `GET` returns `405 Method Not Allowed`.
- That is expected because order intake accepts `POST`.

## 16. Controlled Traffic Check

Where: Mac terminal or VPS SSH terminal.

Safe. GET-only.

Use this after the manual hosted flow passes and before giving real merchant access. It checks whether the hosted app can handle a small, controlled burst of normal reads without creating orders or changing data.

Default check:

```bash
cd /opt/wasilio
WASILIO_TRAFFIC_BASE_URL="https://app.wasilio.ma" \
node scripts/controlled-traffic-check.mjs
```

Meaning:

- Sends repeated `GET` requests to `/` and `/actuator/health/readiness`.
- Confirms responses are `200`.
- Confirms readiness returns `UP`.
- Prints pass/fail counts and p50/p95 response timings.
- Does not log in or mutate data.

Include one public product API path:

```bash
cd /opt/wasilio
WASILIO_TRAFFIC_BASE_URL="https://app.wasilio.ma" \
WASILIO_TRAFFIC_PATHS="/,/actuator/health/readiness,/api/public/storefront/<store-slug>/products/<product-slug>" \
node scripts/controlled-traffic-check.mjs
```

Meaning:

- Adds the public storefront product JSON endpoint.
- This verifies that the public product API stays responsive during low traffic.

Slightly stronger hosted check:

```bash
cd /opt/wasilio
WASILIO_TRAFFIC_BASE_URL="https://app.wasilio.ma" \
WASILIO_TRAFFIC_PATHS="/,/actuator/health/readiness,/api/public/storefront/<store-slug>/products/<product-slug>" \
WASILIO_TRAFFIC_ROUNDS=10 \
WASILIO_TRAFFIC_CONCURRENCY=3 \
WASILIO_TRAFFIC_DELAY_MS=250 \
node scripts/controlled-traffic-check.mjs
```

Meaning:

- Runs 10 rounds.
- Sends 3 concurrent requests per path per round.
- With 3 paths, this is 90 GET requests total.
- This is still not a load test.

Watch server health in another VPS SSH terminal while it runs:

```bash
docker stats --no-stream
```

Meaning:

- Shows CPU and memory for containers once.
- Look for unexpectedly high CPU, memory, or restarts.

Check logs after the run:

```bash
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 backend
```

Meaning:

- Shows recent backend logs.
- Look for errors, failed database connections, or unexpected exceptions.

What counts as passed:

- Script ends with `Traffic check passed`.
- Public readiness remains `UP`.
- No backend errors appear.
- Containers remain up.
- Browser login still works after the check.

Do not use this for paid ads or large traffic decisions. Wider traffic still needs abuse controls, monitoring, and a deliberate load-test plan.

## 17. Account Audit

Where: VPS SSH terminal in `/opt/wasilio`.

Safe. Read-only.

```bash
cd /opt/wasilio
POSTGRES_USER="wasilio" \
POSTGRES_DB="nexora" \
COMPOSE_FILES="--env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml" \
./scripts/trial-account-audit.sh
```

Meaning:

- Reads the live database.
- Shows workspaces, users, staff users, merchant owners, and order counts.
- Flags account ownership issues before merchant handoff.

Good result:

- Internal Wasilio workspace has staff users.
- Merchant workspace has one owner/admin.
- Review flags table is empty.

## 18. Create A Database Backup

Where: VPS SSH terminal in `/opt/wasilio`.

Safe.

```bash
cd /opt/wasilio
POSTGRES_USER="wasilio" \
POSTGRES_DB="nexora" \
BACKUP_DIR="/var/backups/wasilio" \
BACKUP_PREFIX="wasilio" \
COMPOSE_FILES="--env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml" \
./scripts/backup-postgres.sh
```

Meaning:

- Uses `pg_dump` inside the PostgreSQL container.
- Creates a `.dump` file under `/var/backups/wasilio`.
- Verifies the backup catalog with `pg_restore --list`.
- Does not change the live database.

Example result:

```text
/var/backups/wasilio/wasilio-YYYYMMDDTHHMMSSZ.dump
```

## 19. Test Database Restore Safely

Where: VPS SSH terminal in `/opt/wasilio`.

Safe.

```bash
POSTGRES_USER="wasilio" \
POSTGRES_DB="nexora" \
COMPOSE_FILES="--env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml" \
./scripts/trial-restore-rehearsal.sh /var/backups/wasilio/wasilio-YYYYMMDDTHHMMSSZ.dump
```

Meaning:

- Restores the dump into a temporary database.
- Checks required tables.
- Drops the temporary database.
- Does not touch live `nexora`.

This is the correct first proof that a backup is restorable.

## 20. Copy Database Backup Off The VPS

Where: Mac terminal, not inside SSH.

Safe.

```bash
scp root@<vps-ip>:/var/backups/wasilio/wasilio-YYYYMMDDTHHMMSSZ.dump ~/Desktop/
```

Meaning:

- Copies the database backup from the VPS to your Mac.
- A backup only on the same VPS is not enough.

Verify:

```bash
ls -lh ~/Desktop/wasilio-YYYYMMDDTHHMMSSZ.dump
```

## 21. Create A Media Backup

Where: VPS SSH terminal.

Safe.

Find the media volume:

```bash
docker volume ls --format '{{.Name}}' | grep backend_media
```

Expected:

```text
wasilio_backend_media
```

Create archive:

```bash
docker run --rm \
  -v wasilio_backend_media:/media:ro \
  -v /var/backups/wasilio:/backup \
  alpine:3.20 \
  tar -C /media -czf /backup/wasilio-media-YYYYMMDDTHHMMSSZ.tgz .
```

Meaning:

- Starts a temporary Alpine container.
- Mounts the media volume read-only at `/media`.
- Writes a compressed `.tgz` archive to `/var/backups/wasilio`.
- Does not modify live media files.

Verify:

```bash
ls -lh /var/backups/wasilio/wasilio-media-YYYYMMDDTHHMMSSZ.tgz
```

## 22. Copy Media Backup Off The VPS

Where: Mac terminal, not inside SSH.

Safe.

```bash
scp root@<vps-ip>:/var/backups/wasilio/wasilio-media-YYYYMMDDTHHMMSSZ.tgz ~/Desktop/
```

Verify:

```bash
ls -lh ~/Desktop/wasilio-media-YYYYMMDDTHHMMSSZ.tgz
```

## 23. Test Media Restore Safely

Where: VPS SSH terminal.

Safe.

```bash
mkdir -p /tmp/wasilio-media-restore-check

tar -C /tmp/wasilio-media-restore-check \
  -xzf /var/backups/wasilio/wasilio-media-YYYYMMDDTHHMMSSZ.tgz

find /tmp/wasilio-media-restore-check -type f | head
```

Meaning:

- Extracts the media backup into a temporary folder.
- Lists a few restored media files.
- Does not touch the live media volume.

Clean the temporary folder:

```bash
rm -rf /tmp/wasilio-media-restore-check
```

## 24. Real Trial Restore Drill

Destructive. This replaces the live trial database and media from backup.

Only run this when:

- the trial data can be overwritten
- you have a fresh backup
- you know which backup files you are restoring
- you are ready to verify the app immediately after

Use this order.

Go to the app folder:

```bash
cd /opt/wasilio
```

Stop frontend and backend, but keep PostgreSQL running:

```bash
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml stop frontend backend
```

Meaning:

- Stops app traffic.
- Keeps the database container alive for restore.

Drop the live database:

```bash
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  psql -U wasilio -d postgres -c 'DROP DATABASE IF EXISTS nexora WITH (FORCE);'
```

Meaning:

- Deletes the live `nexora` database.
- This is destructive.

Recreate the empty database:

```bash
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  psql -U wasilio -d postgres -c 'CREATE DATABASE nexora;'
```

Meaning:

- Creates a fresh empty `nexora`.

Restore the database dump:

```bash
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U wasilio -d nexora --no-owner --no-acl \
  < /var/backups/wasilio/wasilio-YYYYMMDDTHHMMSSZ.dump
```

Meaning:

- Loads the backup into the real database.

Restore media:

```bash
docker run --rm \
  -v wasilio_backend_media:/media \
  -v /var/backups/wasilio:/backup:ro \
  alpine:3.20 \
  sh -c 'rm -rf /media/* && tar -C /media -xzf /backup/wasilio-media-YYYYMMDDTHHMMSSZ.tgz'
```

Meaning:

- Clears current live media files.
- Extracts media from the backup archive.
- This is destructive for current live media.

Start the app:

```bash
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Verify:

```bash
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1:8080/actuator/health/readiness
curl -fsS https://app.wasilio.ma/actuator/health/readiness
```

Browser checks:

- Staff login works.
- Merchant login works.
- Products exist.
- Product images load.
- Orders exist.
- Public product API works.
- Public order intake still works.

## 25. What Not To Do

- Do not run `docker compose down -v` on the hosted VPS unless you intentionally want to delete Docker volumes.
- Do not store real secrets in Git.
- Do not use the local root `.env` as the hosted env file.
- Do not enable public signup unless onboarding policy is intentional.
- Do not point ads or large traffic at public order intake before abuse protection and monitoring are reviewed.
- Do not keep only one backup copy on the VPS.

# Controlled Merchant Trial Environment Inventory

This inventory defines where each environment value belongs for a controlled merchant trial on a hosted Wasilio backend.

Use this document before changing deployment settings. The goal is to avoid the confusing pattern where developers edit the root `.env` for local testing and later forget which values were production-like.

## Rules

- Root `.env` is local-only. It is for Docker development on one workstation.
- `.env.example` is also local-only. It is a template for root `.env`, not a staging or production template.
- Do not commit real staging, trial, or production credentials.
- Hosted backend secrets belong in the backend host secret manager.
- If the first controlled merchant trial uses Docker Compose on a VPS, keep the host env file outside the repository, for example `/etc/wasilio/trial.env`, with restricted file permissions.
- Cloudflare Pages variables belong in the Cloudflare Pages project settings, not in the root `.env`.
- Values prefixed with `VITE_` are browser build values. Never put database, SMTP password, or JWT secrets in them.

## Local Development

Owner: local developer.

Storage: root `.env`, copied from `.env.example`.

Purpose:

- local Docker PostgreSQL credentials
- local frontend/backend ports
- local CORS origins
- logged email mode
- seed data enabled through `docker-compose.override.yml`
- public signup enabled for local testing

Do not reuse local `.env` for a controlled merchant trial.

## Cloudflare Pages Public Frontend

Owner: Cloudflare Pages project settings.

Use these values when deploying the public frontend:

| Variable | Trial value rule |
| --- | --- |
| `VITE_PUBLIC_SITE_URL` | `https://wasilio.ma` |
| `VITE_PUBLIC_SUPPORT_EMAIL` | public support inbox |
| `VITE_PUBLIC_WHATSAPP_URL` | public WhatsApp contact URL when ready |
| `VITE_PUBLIC_META_PIXEL_ID` | blank until Meta Pixel is intentionally enabled |
| `VITE_API_BASE_URL` | hosted backend `/api` URL only after a backend is connected |
| `VITE_LANDING_ENGINE_URL` | public product-preview origin when merchant previews are used |

For the current frontend-only public site, keep backend-dependent actions treated as not fully production-ready unless `VITE_API_BASE_URL` points to a live backend that has passed smoke checks.

## Hosted Trial Backend

Owner: backend host secret manager, or a host-only env file outside the repo for a single-node Docker Compose trial.

Required backend values:

| Variable | Where it belongs | Trial rule |
| --- | --- | --- |
| `POSTGRES_DB` | database/backend host | Usually `nexora` internally. |
| `POSTGRES_USER` | database/backend host secret | Production database user. |
| `POSTGRES_PASSWORD` | database/backend host secret | Production database password. |
| `JWT_SECRET` | backend host secret | High-entropy base64 value, unique per environment. |
| `CORS_ALLOWED_ORIGINS` | backend host config | Only approved browser origins, for example `https://wasilio.ma,https://www.wasilio.ma`. |
| `APP_FRONTEND_BASE_URL` | backend host config | Public frontend URL used in password reset and setup links. |
| `APP_EMAIL_MODE` | backend host config | `smtp` for a hosted trial. |
| `APP_EMAIL_FROM` | backend host config | Verified sender, for example `Wasilio <no-reply@wasilio.ma>`. |
| `APP_SUPPORT_CONTACT` | backend host config | Support email shown in notifications. |
| `SMTP_HOST` | backend host secret/config | SMTP provider host. |
| `SMTP_PORT` | backend host secret/config | Usually `587` with STARTTLS. |
| `SMTP_USERNAME` | backend host secret | SMTP username. |
| `SMTP_PASSWORD` | backend host secret | SMTP password or provider app password. |
| `SMTP_AUTH` | backend host config | Usually `true`. |
| `SMTP_STARTTLS_ENABLE` | backend host config | Usually `true`. |
| `APP_MEDIA_PUBLIC_BASE_URL` | backend host config | Public origin that serves `/media`. |
| `APP_ONBOARDING_ENABLED` | backend host config | `false` for closed trial access unless public signup is intentionally open. |

Optional backend values with defaults:

| Variable | Trial rule |
| --- | --- |
| `APP_PASSWORD_RESET_TOKEN_TTL` | Keep `PT30M` unless support needs a different window. |
| `APP_SECURITY_THROTTLING_ENABLED` | Keep `true`. |
| `APP_LOGIN_THROTTLE_MAX_ATTEMPTS` | Keep conservative default unless support needs adjustment. |
| `APP_LOGIN_THROTTLE_WINDOW` | Keep conservative default. |
| `APP_LOGIN_THROTTLE_LOCKOUT` | Keep conservative default. |
| `APP_ONBOARDING_THROTTLE_MAX_ATTEMPTS` | Keep conservative default. |
| `APP_ONBOARDING_THROTTLE_WINDOW` | Keep conservative default. |
| `APP_ONBOARDING_THROTTLE_LOCKOUT` | Keep conservative default. |
| `APP_PASSWORD_RESET_THROTTLE_MAX_ATTEMPTS` | Keep conservative default. |
| `APP_PASSWORD_RESET_THROTTLE_WINDOW` | Keep conservative default. |
| `APP_PASSWORD_RESET_THROTTLE_LOCKOUT` | Keep conservative default. |

One-time bootstrap values:

| Variable | Trial rule |
| --- | --- |
| `APP_SUPER_ADMIN_BOOTSTRAP_ENABLED` | `true` only for the first deployment, then `false`. |
| `APP_SUPER_ADMIN_EMAIL` | Set only while bootstrapping the first staff account. |
| `APP_SUPER_ADMIN_PASSWORD` | Set only while bootstrapping, then remove from the host secret set. |
| `APP_SUPER_ADMIN_TENANT_NAME` | Usually `Wasilio Internal`. |

After the first successful staff login, redeploy with `APP_SUPER_ADMIN_BOOTSTRAP_ENABLED=false` and remove the bootstrap password from the host secret store.

## Media Storage

Uploaded product images are served from backend storage under `/media`.

For a Docker Compose trial:

- keep `backend_media` as a durable Docker volume
- set `APP_MEDIA_PUBLIC_BASE_URL` to the public origin that serves `/media`
- include the media volume in backup planning
- verify uploaded product image URLs after every deploy

If the backend is behind the same public origin as the frontend, `APP_MEDIA_PUBLIC_BASE_URL` can be `https://wasilio.ma`. If the backend uses a separate API origin, use that public backend origin.

## Docker Compose Trial Pattern

If a VPS trial uses Docker Compose, keep the env file outside the repo:

```bash
sudo mkdir -p /etc/wasilio
sudo chmod 700 /etc/wasilio
sudo touch /etc/wasilio/trial.env
sudo chmod 600 /etc/wasilio/trial.env
```

Then validate without printing secrets:

```bash
./scripts/trial-env-check.sh /etc/wasilio/trial.env
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml config
```

Deploy only after both commands pass:

```bash
docker compose --env-file /etc/wasilio/trial.env -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Smoke-Only Variables

These variables are for `scripts/live-backend-smoke.mjs`. They are operator inputs, not application config:

| Variable | Purpose |
| --- | --- |
| `WASILIO_API_BASE_URL` | Backend origin to test. |
| `WASILIO_SUPER_ADMIN_EMAIL` | Staff login for smoke checks. |
| `WASILIO_SUPER_ADMIN_PASSWORD` | Staff password for smoke checks. |
| `WASILIO_MERCHANT_EMAIL` | Optional merchant login for merchant checks. |
| `WASILIO_MERCHANT_PASSWORD` | Optional merchant password for merchant checks. |
| `WASILIO_SMOKE_CAPTURE_LEAD` | Opt-in demo request creation. |
| `WASILIO_SMOKE_PASSWORD_RESET_EMAIL` | Opt-in password reset email request. |
| `WASILIO_SMOKE_CREATE_ORDER` | Opt-in smoke order creation. |
| `WASILIO_SMOKE_RECORD_CONFIRMATION_ATTEMPT` | Opt-in confirmation attempt on the smoke order. |
| `WASILIO_SMOKE_UPLOAD_MEDIA` | Opt-in smoke product creation, primary image upload, and public media URL check. |

Use mutating smoke flags only when the test records can remain as explicit smoke records or be cleaned through the normal product workflow.

## Pre-Handoff Checklist

Before a real merchant receives access:

1. `./scripts/trial-env-check.sh` passes against the host trial env.
2. Production Compose config validation passes.
3. Readiness endpoint is healthy from the public ingress.
4. Super-admin bootstrap is disabled after first staff login.
5. Public onboarding policy is explicit.
6. Password reset or setup email is delivered through SMTP.
7. `APP_FRONTEND_BASE_URL` creates links to the public frontend, not localhost.
8. Product media upload returns public URLs that resolve.
9. `scripts/trial-account-audit.sh` shows no review flags.
10. `scripts/live-backend-smoke.mjs` passes against the hosted backend.
11. A database backup has been captured and restored into an isolated database.
12. Media volume backup or media host-migration procedure is documented.

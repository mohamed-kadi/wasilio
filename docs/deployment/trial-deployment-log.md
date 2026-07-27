# Hosted Trial Deployment Log

This file records the July 2026 hosted Wasilio trial deployment and walkthrough. Do not store passwords, SMTP secrets, JWT secrets, database passwords, VPS IP addresses, or private keys in this log.

For the command-by-command Hostinger/VPS setup record, use Mode 4 in `docs/deployment/testing-and-deployment-runbook.md`.

## Deployment Identity

| Field | Value |
| --- | --- |
| Deployment date | Initial VPS deploy: July 23, 2026. Hosted walkthrough updated through July 27, 2026. |
| Operator | Mohamed Najib Kadi, guided by Codex |
| Repo commit SHA | `30f081f` for the latest deployed password reset email update |
| Trial domain | `https://app.wasilio.ma` |
| Backend/API origin | Same origin through `/api` on `https://app.wasilio.ma` |
| Frontend origin | `https://app.wasilio.ma` |
| TLS/HTTPS provider | Caddy automatic HTTPS on the VPS; Cloudflare manages DNS |
| Docker Compose files | `docker-compose.yml`, `docker-compose.prod.yml` |
| Host-only env path | `/etc/wasilio/trial.env` |
| Public entrypoint | Caddy reverse proxy to Docker frontend/Nginx on `127.0.0.1:8080` |
| DNS mode for `app` record | Cloudflare DNS-only for the Caddy-origin setup |

## Environment Checks

| Check | Result | Notes |
| --- | --- | --- |
| `scripts/trial-env-check.sh` passed | Passed | Required values present. Policy warnings were reviewed before continuing. |
| Production Compose config rendered | Passed | Stack started with `docker-compose.yml` plus `docker-compose.prod.yml`. |
| Backend container is not directly public | Passed | Backend is reached through frontend/Nginx proxy routes only. |
| Frontend/Nginx is the public service | Passed | Docker frontend is local-only on `127.0.0.1:8080`; Caddy is public on 80/443. |
| `APP_ONBOARDING_ENABLED=false` unless intentionally opened | Passed | Closed access is active for the hosted trial. |
| `APP_FRONTEND_BASE_URL` points to HTTPS public frontend | Passed | Password reset links resolve to `https://app.wasilio.ma`. |
| `APP_MEDIA_PUBLIC_BASE_URL` points to HTTPS public media origin | Passed | Uploaded product media resolves from `https://app.wasilio.ma/media/...`. |
| SMTP mode and sender verified | Passed | Brevo SMTP sends from the authenticated Wasilio domain. |
| Support mailbox routing verified | Passed | Cloudflare Email Routing forwards `support@wasilio.ma` to the verified destination mailbox. |

## Staff Bootstrap

| Check | Result | Notes |
| --- | --- | --- |
| Bootstrap enabled only for first deploy | Passed | Bootstrap was used only to create the first staff account. |
| Staff account created | Passed | Super-admin login worked after first deploy. |
| Staff login passed | Passed | Super-admin dashboard loaded successfully. |
| Bootstrap password removed from host config | Passed | `APP_SUPER_ADMIN_PASSWORD` was cleared from `/etc/wasilio/trial.env`. |
| Bootstrap disabled and redeployed | Passed | `APP_SUPER_ADMIN_BOOTSTRAP_ENABLED=false`. |
| Staff login still passed after bootstrap disabled | Passed | Existing database user remains valid after bootstrap is disabled. |

## Merchant Handoff

| Check | Result | Notes |
| --- | --- | --- |
| Demo request captured or created | Passed | Public landing demo request reached the staff demo request workflow. |
| Demo request qualified | Passed | Request was processed through the staff workflow. |
| Merchant workspace created from request | Passed | Workspace was created from the demo request conversion path. |
| Setup email delivered | Passed | Account setup/password email was delivered through SMTP. |
| Merchant owner set password | Passed | Merchant owner completed password setup. |
| Merchant owner login passed | Passed | Merchant owner could sign in to the hosted app. |
| Product created | Passed | Merchant created a product in the hosted dashboard. |
| Storefront settings completed | Passed | Store slug and store settings were saved. |
| Product media uploaded | Passed | Image upload worked after the product existed. UX note remains below. |
| Product publishing readiness | Passed | Product reached `7/7` readiness after landing content was completed. |
| Public product API resolved | Passed | Public product JSON resolved on `https://app.wasilio.ma`. |
| Public order intake created inbound order | Passed | Public `POST` order intake created an inbound order in the dashboard. |
| Inbound order opened confirmation workflow | Passed | Inbound order inspection could open Confirmation Ops. |
| Confirmation attempt recorded | Passed | Confirmation workflow action moved the order forward. |
| Confirmation moved order to assignment queue | Passed | Confirmation-to-assignment queue path was tested successfully. |
| Orders CSV downloaded from Orders workspace | Not confirmed in this walkthrough | Keep as a pre-handoff check before real merchant operations. |

## Rehearsal Results

| Command or Check | Result | Notes |
| --- | --- | --- |
| Manual hosted walkthrough | Passed | Login, email, merchant setup, product, media, public API, order intake, inbound, confirmation, and assignment path passed. |
| `scripts/hosted-trial-rehearsal.sh` | Not run | Manual browser walkthrough was used first. Keep wrapper for repeatable future checks. |
| `scripts/live-backend-smoke.mjs` | Not run | Keep as executable regression check once stable hosted test accounts are defined. |
| `scripts/trial-account-audit.sh` | Not run | Recommended before handing a real merchant account to a trial client. |
| Account audit review flags resolved | Pending | Depends on running `scripts/trial-account-audit.sh`. |
| Database backup created | Pending | Required before real merchant handoff. |
| Restore rehearsal passed | Pending | Required before real merchant handoff. |
| Media archive created | Pending | Required before real merchant handoff if product media is used. |
| Backup artifacts copied off-host | Pending | Required before real merchant handoff. |

## Backup Artifacts

| Artifact | Location | Created At | Restore/List Check |
| --- | --- | --- | --- |
| Database dump | Pending | Pending | Pending |
| Media archive | Pending | Pending | Pending |
| Off-host copy | Pending | Pending | Pending |

## UX Notes From Hosted Walkthrough

These are not blockers for the hosted infrastructure, but they should be considered in the next cleanup phase:

- Product media upload was confusing because upload became available only after the product existed. Follow-up UX cleanup keeps the editor open after create and enables upload as the next step.
- Product preview depends on the separate customer page host. Follow-up UX cleanup disables Preview when that host is not connected instead of sending merchants to the Wasilio app fallback.
- Public product data links should display the hosted origin in same-origin deployments. Follow-up UX cleanup uses the current browser origin when `VITE_API_BASE_URL=/api`.
- Inbound Orders and Confirmation both expose paths into the confirmation workflow. This is useful for experienced merchants but may need clearer labels and grouping.
- Public order intake worked, but it needs abuse protection before ads or wider public traffic.
- Staff workspace creation is currently driven by demo request conversion. The super-admin UX should make that path easier to discover.

## Go/No-Go

| Decision | Value |
| --- | --- |
| Merchant access approved? | Not yet |
| Approved by | Pending |
| Open issues | Backup/restore rehearsal, account audit, Orders CSV check, customer page deployment decision, public intake hardening before paid traffic |
| Next review date | Before first real merchant handoff |

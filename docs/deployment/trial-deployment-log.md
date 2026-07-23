# Trial Deployment Log

Copy this template for each controlled merchant trial deployment. Do not store passwords, SMTP secrets, JWT secrets, database passwords, or private keys in this log.

## Deployment Identity

| Field | Value |
| --- | --- |
| Deployment date |  |
| Operator |  |
| Repo commit SHA |  |
| Trial domain |  |
| Backend/API origin |  |
| Frontend origin |  |
| TLS/HTTPS provider |  |
| Docker Compose files | `docker-compose.yml`, `docker-compose.prod.yml` |
| Host-only env path | `/etc/wasilio/trial.env` |

## Environment Checks

| Check | Result | Notes |
| --- | --- | --- |
| `scripts/trial-env-check.sh` passed |  |  |
| Production Compose config rendered |  |  |
| Backend container is not directly public |  |  |
| Frontend/Nginx is the public service |  |  |
| `APP_ONBOARDING_ENABLED=false` unless intentionally opened |  |  |
| `APP_FRONTEND_BASE_URL` points to HTTPS public frontend |  |  |
| `APP_MEDIA_PUBLIC_BASE_URL` points to HTTPS public media origin |  |  |
| SMTP mode and sender verified |  |  |

## Staff Bootstrap

| Check | Result | Notes |
| --- | --- | --- |
| Bootstrap enabled only for first deploy |  |  |
| Staff account created |  |  |
| Staff login passed |  |  |
| Bootstrap password removed from host config |  |  |
| Bootstrap disabled and redeployed |  |  |
| Staff login still passed after bootstrap disabled |  |  |

## Merchant Handoff

| Check | Result | Notes |
| --- | --- | --- |
| Demo request captured or created |  |  |
| Demo request qualified |  |  |
| Merchant workspace created from request |  |  |
| Setup email delivered |  |  |
| Merchant owner set password |  |  |
| Merchant owner login passed |  |  |
| Test order created |  |  |
| Confirmation attempt recorded |  |  |
| Product media uploaded |  |  |
| Public media URL resolved |  |  |
| Orders CSV downloaded from Orders workspace |  |  |

## Rehearsal Results

| Command or Check | Result | Notes |
| --- | --- | --- |
| `scripts/hosted-trial-rehearsal.sh` |  |  |
| `scripts/live-backend-smoke.mjs` |  |  |
| `scripts/trial-account-audit.sh` |  |  |
| Account audit review flags resolved |  |  |
| Database backup created |  |  |
| Restore rehearsal passed |  |  |
| Media archive created |  |  |
| Backup artifacts copied off-host |  |  |

## Backup Artifacts

| Artifact | Location | Created At | Restore/List Check |
| --- | --- | --- | --- |
| Database dump |  |  |  |
| Media archive |  |  |  |
| Off-host copy |  |  |  |

## Go/No-Go

| Decision | Value |
| --- | --- |
| Merchant access approved? |  |
| Approved by |  |
| Open issues |  |
| Next review date |  |

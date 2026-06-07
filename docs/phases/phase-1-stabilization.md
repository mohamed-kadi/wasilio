# Phase 1 Stabilization

## Goal

Harden the MVP foundation for operational reliability and safer production setup.

## Major Changes

- Added health probes and operational documentation.
- Added correlation IDs across requests, logs, error responses, and domain events.
- Split local and production Compose behavior.
- Added explicit production CORS configuration.
- Added projection processed-event tracking and rebuild strategy.
- Added security throttling for login and onboarding.

## Migrations Added

- `V4__projection_processed_events.sql`: processed-event table and indexes.

## Commits

Recent related commits include:

- `d7ed005 fix(security): add auth abuse throttling`
- `76f7204 chore(config): expose security throttling settings`
- `2dcacc4 docs(security): document abuse protection`

## Risks Fixed

- Production seed leakage risk reduced by keeping seed loading in local override only.
- Projection duplicate processing risk reduced with processed-event markers.
- Public auth/onboarding abuse risk reduced with in-memory throttling.
- Operational traceability improved with correlation IDs.

## Remaining Gaps

- Throttling is still process-local.
- Projection rebuild is manual and startup controlled.
- Backup automation is documented but not automated.

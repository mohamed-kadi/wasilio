# Wasilio Documentation

This is the main documentation entry point for Wasilio. Use it to decide which document to read first instead of scanning every file in `docs/`.

## Start Here

1. `../README.md`: local setup, Docker Compose, seeded users, smoke tests, and API overview.
2. `deployment/testing-and-deployment-runbook.md`: the single operator path for local testing, landing-engine rehearsal, frontend-only public mode, hosted backend trial, and SaaS production gates.
3. `product/next-implementation-plan.md`: current tactical sequence and near-term product priorities.
4. `architecture/system-overview.md`: system shape, backend layers, source of truth, and runtime split.

Supporting deployment references:

- `deployment/environment-inventory.md`: where local, hosted backend, Cloudflare Pages, SMTP, media, and smoke-test variables belong.
- `deployment/backup-restore-rehearsal.md`: database restore rehearsal, media backup, off-host storage, and merchant export boundary.
- `deployment/trial-deployment-log.md`: optional checklist template used while executing the hosted backend trial.

## Current Work

Use `product/next-implementation-plan.md` as the current planning source. It should answer what is next, what is intentionally deferred, and which cleanup batch is queued.

Current near-term direction:

- Keep Wasilio Core stable while product UX cleanup continues.
- Keep landing-engine connected through the public product and public order-intent contracts.
- Use the landing-engine handoff docs as production-readiness checklists, not as a request to rebuild the integration.
- Prepare the controlled hosted merchant trial path with single-host Compose deployment, account ownership audit, hosted rehearsal checks, live backend smoke checks, production environment inventory, and backup rehearsal.
- Keep demo request conversion on the secure account setup email path; do not let staff set merchant passwords directly.
- Continue intelligence calibration after enough realistic confirmation evidence exists.

## Common Reading Paths

For local setup and verification:

- `../README.md`
- `deployment/testing-and-deployment-runbook.md`
- `operations.md`
- `product/next-implementation-plan.md`

For core operations UX:

- `product/order-lifecycle.md`
- `product/orders-workspace.md`
- `product/order-detail-workflow.md`
- `product/confirmation-workflow.md`
- `product/callback-workflow.md`
- `product/courier-workflow.md`

For storefront, media, and landing-engine:

- `product/landing-engine-order-intake.md`: public product and order-intent contract.
- `product/landing-engine-integration-rehearsal.md`: local Wasilio plus landing-engine runbook.
- `product/media-upload.md`: product media upload, public media fields, readiness, and QA checklist.
- `decisions/ADR-009-storefront-as-presentation-client.md`
- `decisions/ADR-010-catalog-as-reusable-product-context.md`
- `decisions/ADR-011-order-ingestion-and-normalization-boundary.md`

For intelligence and fraud scoring:

- `product/intelligence-scoring.md`
- `product/intelligence-calibration-rehearsal.md`
- `decisions/ADR-013-customer-profile-and-intelligence-contexts.md`

For architecture changes:

- `architecture/implementation-guardrails.md`
- `architecture/ddd-boundaries.md`
- `architecture/event-sourcing.md`
- `architecture/multi-tenancy.md`
- `architecture/security.md`
- `decisions/`

For launch, controlled merchant trials, and acquisition:

- Start with `deployment/testing-and-deployment-runbook.md`, Mode 3 for frontend-only public site or Mode 4 for hosted backend trial.
- Use `deployment/environment-inventory.md` only when setting environment values.
- Use `deployment/backup-restore-rehearsal.md` only when proving backup and restore.
- Use `deployment/trial-deployment-log.md` only as an optional execution checklist.
- Use `product/launch-readiness-pivot.md`, `product/staff-admin-workspace.md`, and `product/brand-direction.md` for business/product context.

## Source-Of-Truth Rules

- Use `../README.md` for commands and local environment setup.
- Use `deployment/testing-and-deployment-runbook.md` as the only hosted deployment guide.
- Use `deployment/environment-inventory.md` as a variable ownership reference, not as a second deployment guide.
- Use `deployment/trial-deployment-log.md` as an optional checklist, not required reading.
- Use `product/next-implementation-plan.md` for the active sequence.
- Use `product/master-roadmap.md` for history and long-range sequencing.
- Use ADRs for architectural decisions that should not be re-litigated in feature docs.
- Use runbooks for verification steps; do not copy those steps into multiple product docs.
- When a product doc overlaps with another doc, link to the owner instead of duplicating the contract.

## Archives

- `phases/`: historical phase summaries.
- `audits/`: readiness and production-risk audits.
- `technical-debt.md`: known engineering debt that should not be hidden inside roadmap text.

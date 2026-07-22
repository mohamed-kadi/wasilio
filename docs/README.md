# Wasilio Documentation

This is the main documentation entry point for Wasilio. Use it to decide which document to read first instead of scanning every file in `docs/`.

## Start Here

1. `../README.md`: local setup, Docker Compose, seeded users, smoke tests, and API overview.
2. `deployment/testing-and-deployment-runbook.md`: operator-safe testing and deployment modes.
3. `architecture/system-overview.md`: system shape, backend layers, source of truth, and runtime split.
4. `architecture/implementation-guardrails.md`: rules for changing workflows without breaking domain boundaries.
5. `product/next-implementation-plan.md`: current tactical sequence and near-term product priorities.
6. `product/master-roadmap.md`: full project history, completed phases, remaining phases, and audit gate.

## Current Work

Use `product/next-implementation-plan.md` as the current planning source. It should answer what is next, what is intentionally deferred, and which cleanup batch is queued.

Current near-term direction:

- Keep Wasilio Core stable while product UX cleanup continues.
- Keep landing-engine connected through the public product and public order-intent contracts.
- Use the landing-engine handoff docs as production-readiness checklists, not as a request to rebuild the integration.
- Prepare the hosted backend pilot path with account ownership audit, live backend smoke checks, production environment inventory, and backup rehearsal.
- Keep refining staff/admin UX, then move demo request conversion to a secure merchant account setup email.
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

For launch, pilots, and acquisition:

- `deployment/testing-and-deployment-runbook.md`
- `product/vision.md`
- `product/launch-readiness-pivot.md`
- `product/pilot-acquisition-workflow.md`
- `product/staff-admin-workspace.md`
- `product/brand-direction.md`

## Source-Of-Truth Rules

- Use `../README.md` for commands and local environment setup.
- Use `product/next-implementation-plan.md` for the active sequence.
- Use `product/master-roadmap.md` for history and long-range sequencing.
- Use ADRs for architectural decisions that should not be re-litigated in feature docs.
- Use runbooks for verification steps; do not copy those steps into multiple product docs.
- When a product doc overlaps with another doc, link to the owner instead of duplicating the contract.

## Archives

- `phases/`: historical phase summaries.
- `audits/`: readiness and production-risk audits.
- `technical-debt.md`: known engineering debt that should not be hidden inside roadmap text.

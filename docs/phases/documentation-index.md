# Documentation Index

This index is the starting point for future engineers and AI agents.

## Architecture

- `docs/architecture/system-overview.md`: runtime shape, backend layers, source of truth, and compose split.
- `docs/architecture/implementation-guardrails.md`: checklist for safely hardening workflows and adding new features.
- `docs/architecture/ddd-boundaries.md`: bounded contexts and package ownership.
- `docs/architecture/event-sourcing.md`: event append flow, projections, rebuilds, and gaps.
- `docs/architecture/multi-tenancy.md`: tenant identity and row-level isolation strategy.
- `docs/architecture/security.md`: JWT, roles, CORS, throttling, and security debt.
- `docs/architecture/frontend-architecture.md`: React app structure, routing, auth state, and test gap.

## Product

- `docs/product/vision.md`: product direction and target users.
- `docs/product/master-roadmap.md`: remaining phases, batches, sequencing, and audit gate.
- `docs/product/launch-readiness-pivot.md`: temporary path for merchant pilots, admin billing, receipts, public site, SEO, and return path.
- `docs/product/next-implementation-plan.md`: current tactical plan after frontend launch, including deferred backend hosting and next UX/acquisition priorities.
- `docs/product/pilot-acquisition-workflow.md`: guided demo request to trial tenant conversion workflow.
- `docs/product/brand-direction.md`: working name shortlist, logo direction, and rebrand rollout plan.
- `docs/product/roadmap.md`: completed work and future phases.
- `docs/product/order-lifecycle.md`: lifecycle states and transitions.
- `docs/product/confirmation-workflow.md`: confirmation queue and attempts.
- `docs/product/callback-workflow.md`: callback scheduling and resolution.
- `docs/product/courier-workflow.md`: internal courier resources, assignment, pickup, delivery, and performance.
- `docs/product/intelligence-scoring.md`: Phase 19 confirmation confidence and fraud risk scoring model.
- `docs/product/landing-engine-order-intake.md`: stable public product, media, and order-intent contract for landing-engine handoff into Wasilio.
- `docs/product/media-upload.md`: Phase 20 product media upload, rendering, readiness, and storage boundary.

## Decisions

- `docs/decisions/ADR-001-modular-monolith.md`
- `docs/decisions/ADR-002-event-store-source-of-truth.md`
- `docs/decisions/ADR-003-tenant-isolation-strategy.md`
- `docs/decisions/ADR-004-projection-rebuild-strategy.md`
- `docs/decisions/ADR-005-jwt-authentication-model.md`
- `docs/decisions/ADR-006-local-vs-production-compose.md`
- `docs/decisions/ADR-007-confirmation-attempts-operational-records.md`
- `docs/decisions/ADR-008-callback-scheduling-operational-records.md`
- `docs/decisions/ADR-009-storefront-as-presentation-client.md`
- `docs/decisions/ADR-010-catalog-as-reusable-product-context.md`
- `docs/decisions/ADR-011-order-ingestion-and-normalization-boundary.md`
- `docs/decisions/ADR-012-marketing-attribution-context.md`
- `docs/decisions/ADR-013-customer-profile-and-intelligence-contexts.md`

## Phase History

- `docs/phases/phase-1-foundation.md`
- `docs/phases/phase-1-stabilization.md`
- `docs/phases/phase-2-onboarding.md`
- `docs/phases/phase-2-confirmation.md`

## Audit Archive And Operations

- `docs/audits/audit-001-initial-production-readiness.md`
- `docs/audits/audit-002-post-stabilization.md`
- `docs/audits/audit-003-current-readiness.md`
- `docs/audits/audit-004-frontend-launch-readiness.md`
- `docs/technical-debt.md`
- `docs/operations.md`

# Launch Readiness Pivot

This document captures the temporary product pivot from pure operations workflow completion into commercial launch readiness. The goal is to make Wasilio usable for controlled merchant pilots and eventually public acquisition without losing the original COD operations roadmap.

## Decision

Pause the next operations feature batch briefly and build the minimum commercial/admin foundation needed to publish and sell the product safely.

This does not replace the existing roadmap. It inserts a launch-readiness track before returning to:

- Customer notes.
- Exports.
- Frontend E2E coverage.
- User management.
- Risk scoring and delivery intelligence.

## Why Pivot Now

The current product has a real operational core, but public launch introduces new responsibilities that the current app does not yet handle:

- Managing tenants after signup.
- Controlling subscription access.
- Supporting cash or bank-transfer payments common in Morocco.
- Issuing receipts.
- Capturing leads before full public self-service.
- Presenting a credible brand and landing site.
- Running Facebook/Meta and SEO acquisition.
- Hardening production security, backups, and support workflows.

Without these, merchants can test the operational app, but the business cannot reliably sell, support, suspend, or account for customers.

## Current Launch Readiness

Ready for private demos and controlled pilots:

- Tenant onboarding.
- Login/authentication.
- Multi-tenant order operations.
- Confirmation/callback workflow.
- Courier operations.
- Delivery outcome tracking.
- Failure reasons.
- Order search and timeline.
- Docker deployment path.
- Production compose separation from local seed data.
- Internal admin billing first slice.
- Password reset.
- Public landing page first slice.
- Demo request lead capture.

Not ready for public paid SaaS:

- Subscription plans are first-slice only.
- Tenant billing status is first-slice only.
- Manual cash/bank-transfer tracking is first-slice only.
- Receipt generation is operational but not accounting-grade.
- Internal super-admin console is first-slice only.
- No tenant support console.
- Public marketing site is first-slice only.
- Lead capture exists, but no CRM automation.
- SEO setup has a first slice, but final production domain metadata still needs campaign validation.
- Facebook/Meta tracking is configurable but not enabled until a pixel ID is provided.
- Final product name, logo, and brand system are still incomplete. Current working front-runner: `Wasilio`; see `docs/product/brand-direction.md`.
- Legal pages have first-slice publication copy and still need final business/legal review.
- No email verification.
- No production backup automation.
- First frontend smoke coverage exists; deeper live workflow E2E coverage is still needed.

## Launch Track

### Batch L1: Internal Admin Console

Purpose: let the business manage merchants without direct database access.

Status: first slice implemented.

Backend scope:

- Internal admin role or separate support/admin access model.
- Tenant list.
- Tenant detail.
- Tenant status: active, trialing, overdue, suspended, disabled.
- View tenant users.
- View tenant order counts and recent activity.
- Admin-only audit trail for status changes.

Frontend scope:

- Admin shell or protected admin section.
- Tenant list and tenant detail screens.
- Status change controls.
- Basic support notes.

Non-goals:

- Full CRM.
- Automated billing.
- Marketplace-style merchant self-service.

### Batch L2: Plans, Manual Payments, And Receipts

Purpose: support Moroccan payment reality before online billing.

Status: first slice implemented.

Backend scope:

- Subscription plan model.
- Tenant subscription record.
- Manual payment record:
  - cash
  - bank transfer
  - check
  - other
- Amount, currency, paid date, period covered, collected by, and notes.
- Receipt number generation.
- Receipt read endpoint.
- Tenant billing status calculation.
- Optional suspension date.

Frontend scope:

- Plan management for admin.
- Tenant billing panel.
- Record payment form.
- Receipt list.
- Receipt detail/print view.

Non-goals:

- Stripe or online payment gateway.
- Accounting-grade tax system.
- Inventory or merchant payout reconciliation.

### Batch L3: Public Landing Site And Lead Capture

Purpose: create a credible public entry point before open self-service signup.

Status: first slice implemented.

Scope:

- Public landing page outside the authenticated app shell.
- Product positioning for COD merchants in Morocco.
- Demo request/contact form.
- WhatsApp contact link.
- Lead storage for super-admin follow-up.
- Pricing teaser without automatic purchase.
- Terms, Privacy, and Payment/Refund policy pages.
- Basic brand assets: logo, colors, favicon.

SEO scope:

- Page titles and meta descriptions.
- Open Graph tags.
- `robots.txt`.
- `sitemap.xml`.
- Canonical URL.
- Structured content for COD delivery operations and failed delivery reduction.

Marketing tracking scope:

- Facebook/Meta Pixel configuration.
- Google Analytics or privacy-friendly analytics.
- Campaign source capture for lead forms.

### Batch L4: Production Trust Hardening

Purpose: make pilot/public traffic safer.

Backend/deployment scope:

- Managed production PostgreSQL.
- Automated backups and restore drill.
- HTTPS-only ingress.
- Strict production CORS.
- Strong JWT secret handling.
- Password reset.
- Email verification or verified invite flow.
- Monitoring and error logs.
- Operational runbook for tenant suspension, restore, and support.

Frontend/test scope:

- E2E tests for login, onboarding, order creation, confirmation, courier flow, and billing/admin flows.
- Smoke test command documented for deployment checks.

### Batch L5: Controlled Public Beta

Purpose: collect real leads and onboard selected merchants while preserving control.

Scope:

- Public marketing site live.
- Demo/contact capture live.
- Admin creates or approves tenants.
- Manual payment and receipts available.
- Public self-service signup may remain disabled.
- Track pilot issues and merchant feedback.

Exit criteria:

- At least 2-5 merchants can run daily operations without database/manual developer intervention.
- Business can record payments and issue receipts.
- Support/admin can suspend or reactivate tenants.
- Backups are automated and restore-tested.
- Critical workflow E2E tests exist.

## Return Path To Original Roadmap

After L1-L4 are implemented, return to the original roadmap in this order:

1. Finish Phase 2 Batch 9: Customer Notes.
2. Finish Phase 2 Batch 10: Exports.
3. Complete frontend E2E coverage if not already completed in L4.
4. Continue Phase 3 User Management and Tenant Settings.
5. Run the architecture audit gate.
6. Start deterministic Risk Scoring v1.
7. Add analytics dashboards and external integrations after scoring foundations are stable.

## Risk Scoring Placement

Risk scoring remains important, but it should come after the launch foundation unless a pilot merchant specifically needs it to close a sale.

When implemented, scoring should follow `docs/architecture/implementation-guardrails.md`:

- Read-side/business intelligence first.
- Explainable deterministic scores.
- Tenant-scoped score snapshots.
- No silent lifecycle mutation.
- Operator-visible reasons and override/audit trail.

## Public Launch Criteria

Do not call the product publicly ready until these are true:

- Production database has automated backups and a tested restore path.
- Local seed data is not present in production.
- Initial super-admin account is created through the explicit production bootstrap and the bootstrap flag is disabled after first use.
- Admin can manage tenants and subscriptions.
- Manual cash/bank-transfer payments can be recorded.
- Receipts can be generated and reviewed.
- Password reset or invite-based account recovery exists.
- Critical workflow E2E tests pass.
- Public site has SEO basics, lead capture, legal pages, and tracking configuration.
- Brand name, domain, logo, and social handles are decided.
- Support process is documented.

## Recommended Immediate Next Implementation

Start with Batch L1 and L2 together as a minimal admin/billing foundation:

1. Add tenant status and subscription plan tables.
2. Add manual payment and receipt tables.
3. Add internal admin endpoints.
4. Add admin UI for tenant list/detail and record payment.
5. Add production-safe super-admin bootstrap.
6. Add receipt detail/print view.

This gives the business a way to onboard and charge merchants before investing in full public acquisition.

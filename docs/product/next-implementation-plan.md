# Next Implementation Plan

This document is the current tactical plan for Wasilio after the public frontend launch.

## Current Decision

Pause paid or card-required backend hosting setup for now. Keep the public frontend live and focus the next implementation work on product UX, acquisition readiness, and the highest-value local app workflows.

Reason:

- `wasilio.ma` and `www.wasilio.ma` are live on Cloudflare Pages.
- Brevo sender authentication and password-reset email sending are working.
- Neon Postgres is available for a later backend deployment.
- Free backend hosts tested so far require a credit card for activation.
- The product still benefits more from UX, landing-page clarity, workflow polish, and ad-readiness than from forcing production backend hosting before there is pilot demand.

## Current Operating Mode

- Public frontend: Cloudflare Pages.
- Backend: local development only.
- Database for local work: local PostgreSQL through Docker Compose.
- Production database candidate: Neon Postgres, retained for later backend deployment.
- Email sending: Brevo SMTP.
- Domain/DNS: Cloudflare.

Do not treat the online frontend as a complete production SaaS until the backend is deployed and connected.

## Architecture Direction Note

Operational UX polish can continue inside Wasilio Core. Order creation now has a minimal Order Ingestion/source metadata foundation. Any work that captures orders from public storefronts, CSV, ecommerce platforms, WhatsApp, marketplace sources, or campaign flows should extend that boundary instead of calling order lifecycle directly.

Do not build a Wasilio storefront as a standalone business-rule layer. Storefront should read Catalog data and submit order intent only.

## Near-Term Queue

1. Documentation organization and handoff clarity.
2. Super-admin cleanup and UX review for staff/admin workflows. See `docs/product/staff-admin-workspace.md`.
3. Secure merchant account setup email after demo request conversion.
4. Real merchant launch-readiness pass.
5. Intelligence calibration pilot after enough realistic confirmation evidence is available.

Landing-engine integration is already connected locally through the public product and order-intent contracts. Any landing-engine handoff work from here should be treated as production-readiness documentation, environment verification, and QA rehearsal, not a rebuild of the connection.

## Immediate Priorities

### 1. Public Landing And Acquisition UX

Goal: make `wasilio.ma` convincing enough for Facebook/Instagram traffic and merchant demos.

Scope:

- Tighten above-the-fold positioning for Moroccan COD merchants.
- Make the demo request flow obvious and low-friction.
- Improve mobile layout and readability.
- Strengthen trust signals: local market fit, operational clarity, support/contact routes.
- Confirm all public pages have final domain metadata, social previews, and no placeholder values.
- Decide whether the public site should hide, soften, or clearly mark app login until backend hosting is ready.

Exit criteria:

- A cold visitor can understand what Wasilio does in under 10 seconds.
- A merchant can request a demo from mobile without confusion.
- Public pages look credible enough for paid ad traffic.

### 2. Core App Workflow Polish

Goal: make the local product demo smooth before investing in backend hosting.

Scope:

- Login and password reset UX.
- Dashboard first impression.
- Order creation.
- Confirmation queue and attempt recording.
- Callback follow-up queue.
- Courier assignment, pickup, delivery outcome, and failure reason flows.
- Staff admin workspace for billing, plans, payments, and demo requests.
- Empty states, loading states, validation messages, and error handling.
- Replace staff-entered merchant owner passwords with a backend-generated setup email before real merchant onboarding.

Exit criteria:

- A guided demo can run end-to-end locally without awkward gaps.
- The operator workflow feels coherent for a real merchant use case.

### 3. Demo Request Capture And Campaign Readiness

Goal: prepare for ads before spending on traffic.

Scope:

- Confirm Meta Pixel can be enabled through `VITE_PUBLIC_META_PIXEL_ID`.
- Validate demo request campaign fields: `utm_*`, `fbclid`, `gclid`, and referrer.
- Draft Facebook/Instagram ad angles and landing-page promise.
- Define the manual follow-up process after a demo request arrives.
- Decide whether the first campaign sends users to the demo request form, WhatsApp, or both.

Exit criteria:

- A test demo request from a campaign URL is captured with attribution.
- The admin workflow for reviewing and following up with demo requests is clear.

### 4. Focused Test Coverage

Goal: avoid regressions while polishing the product.

Scope:

- Keep existing backend tests passing.
- Add or expand frontend smoke/E2E coverage for the paths being polished.
- Prefer tests around landing demo request capture, auth isolation, order creation, confirmation, callbacks, and admin demo request follow-up.

Exit criteria:

- The next UX/feature batch has targeted tests for its highest-risk flows.

## Deferred Until Backend Hosting Is Worth Funding

Defer these until there is a pilot/client reason to pay for hosting or use a card-verified free tier:

- Render/Koyeb/AWS/Azure backend deployment.
- Production backend URL wiring in Cloudflare Pages.
- Production super-admin bootstrap on hosted backend.
- Production backup automation and restore drill.
- Production monitoring/log alerting.

When ready, the backend deployment path is:

1. Use Neon Postgres or the selected host's managed Postgres.
2. Deploy the Spring Boot backend through Docker or a Java runtime.
3. Set production environment variables in the backend host.
4. Set `VITE_API_BASE_URL` in Cloudflare Pages to the backend `/api` URL.
5. Run deployment smoke checks from `docs/operations.md`.
6. Disable `APP_SUPER_ADMIN_BOOTSTRAP_ENABLED` after first successful login.

## Next Recommended Batch

Start with **Landing And Acquisition UX** when working on the public site because it is already public and does not require backend hosting.

When working inside the app, keep prioritizing core workflow polish and smoke coverage. If the next app feature touches external order capture or source tracking, extend Order Ingestion before storefront, integrations, or campaign analytics.

Suggested first tasks:

1. Review `wasilio.ma` on mobile and desktop.
2. Identify copy, layout, and trust gaps on the landing page.
3. Improve demo request CTA and mobile form flow.
4. Validate SEO/social metadata for the live domain.
5. Add smoke coverage if the updated public flow changes behavior.

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

Use `docs/deployment/testing-and-deployment-runbook.md` when choosing between local demo, local landing-engine rehearsal, frontend-only public mode, hosted backend pilot mode, and paid SaaS production gates.

## Current Phase Queue

### Phase 35: Public Landing Page And Acquisition Funnel Cleanup

This is the active next product phase. It should make Wasilio's public site explain the product clearly, especially the order-intelligence and fraud/risk detection value for Moroccan COD merchants.

Scope:

- Clean public landing page layout, copy, and mobile readability.
- Add a clear intelligence/fraud-risk section without exposing scoring weights or internal rules.
- Explain how merchant orders can enter Wasilio through manual entry, product landing pages, WhatsApp-assisted operations, Facebook/Instagram traffic, and Google Ads traffic.
- Keep Wasilio sales leads separate from merchant customer orders in the copy and internal documentation.
- Keep CTA paths clear: request demo, contact on WhatsApp, or create workspace only when the onboarding decision supports it.

### Phase 36: Hosted Backend Pilot Preparation

Keep this phase parked until the public landing/acquisition story is stable enough to justify a hosted pilot.

Scope:

- Add or organize live-backend smoke checks for login, lead capture, lead conversion, setup/reset email, merchant login, order creation, confirmation, and media upload.
- Finalize pilot deployment environment inventory for backend host secrets, Cloudflare Pages variables, and local-only `.env` values.
- Document scheduled database backups, off-host encrypted storage, restore drills, and media volume backup.
- Confirm SMTP, production CORS, media URLs, super-admin bootstrap disablement, and onboarding policy before real pilot merchants use the hosted backend.

## Architecture Direction Note

Operational UX polish can continue inside Wasilio Core. Order creation now has a minimal Order Ingestion/source metadata foundation. Any work that captures orders from public storefronts, CSV, ecommerce platforms, WhatsApp, marketplace sources, or campaign flows should extend that boundary instead of calling order lifecycle directly.

Do not build a Wasilio storefront as a standalone business-rule layer. Storefront should read Catalog data and submit order intent only.

## Near-Term Queue

1. Phase 35 public landing page and acquisition funnel cleanup.
2. Super-admin cleanup and UX review for staff/admin workflows as needed. See `docs/product/staff-admin-workspace.md`.
3. Secure merchant account setup email after demo request conversion.
4. Phase 36 hosted backend pilot preparation when the public story and pilot target are ready.
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

Start with **Phase 35: Public Landing Page And Acquisition Funnel Cleanup** because the public site is already live and the fraud/intelligence positioning is one of Wasilio's strongest merchant-facing differentiators.

Keep **Phase 36: Hosted Backend Pilot Preparation** parked until the public acquisition story is stable and there is a controlled pilot target. If the next app feature touches external order capture or source tracking, extend Order Ingestion before storefront, integrations, or campaign analytics.

Suggested first tasks:

1. Review `wasilio.ma` on mobile and desktop.
2. Identify copy, layout, and trust gaps on the landing page.
3. Add a business-friendly intelligence/fraud-risk section.
4. Explain manual, landing-page, WhatsApp-assisted, Facebook/Instagram, and Google Ads order paths without blurring Wasilio sales leads with merchant customer orders.
5. Improve demo request CTA and mobile form flow.
6. Validate SEO/social metadata for the live domain.
7. Add smoke coverage if the updated public flow changes behavior.

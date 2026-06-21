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
- Admin billing/leads workspace.
- Empty states, loading states, validation messages, and error handling.

Exit criteria:

- A guided demo can run end-to-end locally without awkward gaps.
- The operator workflow feels coherent for a real merchant use case.

### 3. Lead Capture And Campaign Readiness

Goal: prepare for ads before spending on traffic.

Scope:

- Confirm Meta Pixel can be enabled through `VITE_PUBLIC_META_PIXEL_ID`.
- Validate lead form campaign fields: `utm_*`, `fbclid`, `gclid`, and referrer.
- Draft Facebook/Instagram ad angles and landing-page promise.
- Define the manual follow-up process after a lead arrives.
- Decide whether the first campaign sends users to the lead form, WhatsApp, or both.

Exit criteria:

- A test lead from a campaign URL is captured with attribution.
- The admin workflow for reviewing and following up with leads is clear.

### 4. Focused Test Coverage

Goal: avoid regressions while polishing the product.

Scope:

- Keep existing backend tests passing.
- Add or expand frontend smoke/E2E coverage for the paths being polished.
- Prefer tests around landing lead capture, auth isolation, order creation, confirmation, callbacks, and admin lead follow-up.

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

Start with **Landing And Acquisition UX** because it is already public and does not require backend hosting.

Suggested first tasks:

1. Review `wasilio.ma` on mobile and desktop.
2. Identify copy, layout, and trust gaps on the landing page.
3. Improve demo request CTA and mobile form flow.
4. Validate SEO/social metadata for the live domain.
5. Add smoke coverage if the updated public flow changes behavior.


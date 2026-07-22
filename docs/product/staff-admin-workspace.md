# Staff Admin Workspace

The staff admin workspace is the internal Wasilio console for support, billing, pilot onboarding, manual payments, receipts, and demo request follow-up.

## Terminology

In backend and database code, `tenant` means one merchant workspace/account. It is not a sub-admin role.

User-facing wording should prefer:

- `Merchant workspace` for a tenant/store account.
- `Merchant owner` for the first merchant user created during signup or demo request conversion.
- `Wasilio staff` or `Staff workspace` for the internal `SUPER_ADMIN` surface.

Keep `tenantId`, `SUPER_ADMIN`, and related names in backend code, API types, migrations, and existing contracts unless there is a larger technical rename plan.

## Sidebar Sections

The staff workspace uses sidebar navigation for its main sections:

- `Merchant Workspaces`: workspace health, operational status, plan snapshot, user count, and order count.
- `Billing`: selected workspace subscription plan, subscription status, billing period, and trial end.
- `Payments`: manual payment recording, payment history, receipts, and financial record export.
- `Plans`: subscription plan review, creation, archive/restore, and guarded cleanup. `Team seats` means how many people can log in under the same merchant workspace; the backend field is still `userLimit`.
- `Demo Requests`: public demo requests, staff follow-up, campaign attribution, qualification, and pilot workspace conversion.

The current frontend route remains `/admin/billing`. The selected staff section is carried in the URL query string, for example `/admin/billing?section=leads`.

## Demo Request Statuses

The backend still stores these records as marketing leads. In the staff UI, they are shown as demo requests because that matches the business workflow.

- `New request`: submitted and not reviewed yet.
- `Contacted`: Wasilio staff called, messaged, or emailed the merchant.
- `Qualified`: merchant is a good pilot candidate and can be converted when onboarding is agreed.
- `Not a fit`: duplicate, fake, outside target, or not ready.
- `Workspace created`: a pilot merchant workspace was created from the request.

## Current UX Direction

The staff workspace should be organized for scanning before editing:

- Show summary cards before action forms.
- Use business labels in the UI while preserving backend enum values and payloads.
- Keep Merchant Workspaces, Billing, Payments, Plans, and Demo Requests in the sidebar, not as nested page tabs.
- Prefer compact cards and short summaries over dense administrative tables where possible.
- Keep receipts printable and tied to recorded manual payments.

## Signup Access

Public signup should not be treated as fully open self-service during early pilots.

Current control:

- `APP_ONBOARDING_ENABLED=true` allows direct merchant workspace creation.
- `APP_ONBOARDING_ENABLED=false` blocks public signup while keeping staff-led pilot conversion available.

Recommended pilot flow:

1. Merchant submits a demo request.
2. Wasilio staff reviews and qualifies the merchant.
3. Staff converts the request into a pilot merchant workspace.
4. Merchant opens the setup email, chooses their own password, then signs in as the merchant owner.

Future option:

- Add invite codes for approved self-serve signup if Wasilio needs a middle path between closed pilot conversion and fully open signup.
- Invite codes should be server-validated, single-use or limited-use, expirable, and tied to audit history.

## Account Setup Email

The demo request conversion flow does not ask staff to create or share an initial password.

Current guided pilot flow:

1. Staff qualifies the demo request.
2. Staff creates the pilot merchant workspace.
3. Backend creates the merchant owner account with a hidden temporary password.
4. Backend sends an expiring setup-password email to the merchant owner using the existing password reset token flow.
5. Merchant sets their own password through the existing reset/setup link flow.

Do not email generated passwords. The backend owns token generation, expiry, notification delivery, and audit safety.

Local development:

- Use `APP_EMAIL_MODE=log` to write setup/reset links to the backend terminal.
- The log entry should include `Account setup requested`, the merchant owner email, the reset/setup URL, and the expiry time.
- Local Docker defaults to log mode unless `.env` overrides `APP_EMAIL_MODE`.

SMTP verification:

- Use `APP_EMAIL_MODE=smtp` only when `spring.mail.*` / `SMTP_*` points to a reachable SMTP server or local mail catcher.
- `APP_EMAIL_FROM` should be a sender accepted by that SMTP provider.
- `MailAuthenticationException: Authentication failed` means the SMTP provider rejected the configured username/password. For Brevo-style providers, use the SMTP login and SMTP key/password, not the Wasilio account password.
- Staff-led workspace conversion treats account setup email delivery as required. If SMTP delivery fails, conversion returns an error and the merchant workspace is not left half-created.
- Public password reset still returns the generic success message when notification delivery fails, so account existence is not exposed. Backend logs keep this as a warning because the token is still created but no email was delivered.

## Financial Records

Payments includes a staff-only CSV download for manual payment records. Staff can filter by paid date before downloading and see a summary of matched receipts, selected-period totals, and latest monthly totals.

The export contains receipt number, merchant workspace, method, amount, currency, paid date, covered billing period, collector display name, notes, payment ID, tenant ID, and creation timestamp.

The staff UI includes quick date filters for current month, previous month, and clear dates. Downloaded filenames include the selected period when one is applied.

Receipt privacy rule:

- Receipts and exports should show a staff display name such as `Wasilio Super Admin`, not the staff login email.
- Existing records may still contain older collector values until they are cleaned or reissued.

Scope:

- This is an operating-record export for bookkeeping and tax review.
- It is not a formal invoice engine, tax calculation engine, or accounting approval workflow.
- Future improvements can add invoice numbering rules, accountant-ready export formats, and formal tax categories after the manual-payment model is stable.

## Staff Identity Display

The auth token includes a display name claim. The frontend should show the staff display name first and keep the email as secondary context.

Fallback rule:

- `SUPER_ADMIN` without a stored name displays as `Wasilio Staff`.
- Merchant users without a stored name display their email, not a staff label.

## Boundaries

The staff workspace may:

- Review merchant workspace status.
- Update workspace access status.
- Assign or update subscription state.
- Record manual payments and generate receipts.
- Download manual payment records for financial review.
- Follow up with captured demo requests.
- Convert a qualified request into a pilot merchant workspace.

The staff workspace must not:

- Change order lifecycle rules.
- Own merchant order operations.
- Own courier or recovery domain behavior.
- Rewrite public storefront or landing-engine contracts.
- Treat internal billing/payment records as accounting-grade invoicing.
- Hard-delete subscription plans that are already referenced by subscriptions, payments, or receipts.

## Plan Cleanup

Plan cleanup is deliberately conservative:

- Active plans can be archived so they stop appearing as normal billing choices.
- Archived plans can be restored if Wasilio wants to sell that package again.
- Archived plans can be deleted only when no merchant workspace subscription references them.
- Plans already assigned to merchant workspaces must stay available for billing history, receipts, and support review.

This gives staff flexibility for mistaken or temporary plan creation, while preserving subscription and receipt history.

## Verification

For frontend changes, run focused lint on `AdminBilling.tsx` and affected smoke tests, then run frontend typecheck, frontend build, and the staff admin smoke tests for workspace, plans, and demo requests.

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
- `Payments`: manual payment recording, payment history, and receipts.
- `Plans`: subscription plan review and creation. `Team seats` means how many people can log in under the same merchant workspace; the backend field is still `userLimit`.
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
4. Merchant signs in with the merchant owner account created during guided onboarding.

Future option:

- Add invite codes for approved self-serve signup if Wasilio needs a middle path between closed pilot conversion and fully open signup.
- Invite codes should be server-validated, single-use or limited-use, expirable, and tied to audit history.

## Planned Account Setup Email

The current demo request conversion flow creates the merchant owner with a staff-entered initial password. That is acceptable for local rehearsal but should be replaced before real merchant onboarding.

Preferred production flow:

1. Staff qualifies the demo request.
2. Staff creates the pilot merchant workspace.
3. Backend creates the merchant owner account.
4. Backend sends an expiring setup-password email to the merchant owner.
5. Merchant sets their own password through the existing reset/setup link flow.

Do not email generated passwords. The backend should own token generation, expiry, notification delivery, and audit safety. The existing password reset token and email notifier infrastructure should be reused or extended for this phase.

## Boundaries

The staff workspace may:

- Review merchant workspace status.
- Update workspace access status.
- Assign or update subscription state.
- Record manual payments and generate receipts.
- Follow up with captured demo requests.
- Convert a qualified request into a pilot merchant workspace.

The staff workspace must not:

- Change order lifecycle rules.
- Own merchant order operations.
- Own courier or recovery domain behavior.
- Rewrite public storefront or landing-engine contracts.
- Treat internal billing/payment records as accounting-grade invoicing.
- Hard-delete subscription plans that are already referenced by subscriptions, payments, or receipts.

Plan cleanup should use archive/deactivate first. True deletion should only be allowed for unused plans after backend validation exists.

## Verification

For frontend changes, run focused lint on `AdminBilling.tsx` and affected smoke tests, then run frontend typecheck, frontend build, and the staff admin smoke tests for workspace, plans, and demo requests.

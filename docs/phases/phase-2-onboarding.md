# Phase 2 Onboarding

## Goal

Allow controlled tenant signup and first ADMIN user creation without relying on development seed data.

## Major Changes

- Added tenant onboarding API.
- Added frontend signup page.
- Added onboarding feature flag.
- Added local development default that enables onboarding.
- Kept production onboarding explicitly controlled by `APP_ONBOARDING_ENABLED`.

## Migrations Added

- `V5__tenant_onboarding_constraints.sql`: user display name and case-insensitive tenant/user uniqueness indexes.

## Commits

Recent related commits include:

- `b9eb2fb feat(onboarding): add tenant creation api`
- `6a2d916 feat(frontend): add tenant signup page`
- `7467e69 docs(onboarding): document signup configuration`

## Risks Fixed

- Removed dependence on seeded admin users for real tenant creation.
- Added uniqueness constraints for tenant names and user emails.
- Made public onboarding an explicit deployment decision.

## Remaining Gaps

- No email verification.
- No invitation flow.
- No billing or plan enforcement.
- No tenant admin console beyond the signup and dashboard basics.

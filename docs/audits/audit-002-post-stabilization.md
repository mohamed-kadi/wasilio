# Audit 002: Post Stabilization

## Scope

Review after operational baseline, projection rebuild strategy, onboarding controls, and abuse protection were added.

## Original Issues

- Need safer public endpoints for login and onboarding.
- Need clear production onboarding controls.
- Need projection recovery path.
- Need tenant onboarding constraints.
- Need security audit logging for sensitive operations.

## Fixed Issues

- Login and onboarding throttling added.
- Security audit logger added for sensitive auth/onboarding outcomes.
- Tenant onboarding controlled by `APP_ONBOARDING_ENABLED`.
- Case-insensitive uniqueness indexes added for tenant names and user emails.
- Projection rebuild path documented and controlled by environment flag.

## Remaining Issues

- Throttling remains in-memory and single-node.
- Remote IP trust depends on ingress sanitizing `X-Forwarded-For`.
- Projection rebuild is operational, not automated.
- JWT lifecycle remains basic.

## Current Readiness Status

Suitable for local development, demos, and tightly controlled pilot setup. Multi-node production still requires distributed throttling and stronger token/session controls.

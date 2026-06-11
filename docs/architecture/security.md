# Security

Wasilio uses JWT authentication, role-based authorization, tenant-scoped principals, explicit CORS configuration, and basic abuse protection.

## Authentication

`POST /api/auth/login` authenticates a user by email and password. On success, the backend returns a signed JWT containing enough identity for the API to derive user, role, and tenant context.

Current token configuration:

- `JWT_SECRET` is required.
- `jwt.expiration` defaults to 24 hours.
- There is no refresh-token flow yet.
- There is no token revocation store yet.

## Authorization

Most API endpoints require an authenticated user. Confirmation endpoints require `ADMIN` or `MERCHANT`. Health endpoints are public so container platforms can poll liveness and readiness.

Tenant isolation is enforced by reading tenant context from the authenticated principal and passing it to application services and repositories.

## CORS

Production CORS must use explicit allowed origins through `CORS_ALLOWED_ORIGINS`. Production compose requires this variable. Local compose defaults include localhost origins for the frontend and Vite dev server.

## Abuse Protection

The backend applies process-local throttling to:

- `POST /api/auth/login`
- `POST /api/onboarding/tenants`

Login throttling tracks failed attempts by normalized email and remote IP. Onboarding throttling tracks valid onboarding attempts by admin email and remote IP. Throttled responses return `429 Too Many Requests` and `Retry-After`.

This limiter is single-node only. Redis, gateway limits, or another distributed store is required before running multiple backend instances.

## Security Audit Logs

Security-sensitive outcomes are logged through `security.audit` with correlation ID, email, tenant ID when available, and remote IP.

Production ingress must sanitize or overwrite `X-Forwarded-For`; the backend resolver honors that header when present.

## Current Security Debt

- Strengthen JWT key handling and rotation.
- Add refresh tokens, token revocation, and shorter access-token lifetimes.
- Replace process-local throttling with distributed throttling.
- Add more authorization tests around role boundaries as new roles are introduced.
- Add production-grade secret management instead of relying only on environment variables.

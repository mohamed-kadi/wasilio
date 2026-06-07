# ADR-005: JWT Authentication Model

## Status

Accepted for MVP.

## Context

The frontend needs authenticated API access for tenant-scoped merchant users. The MVP needs a straightforward auth model with low infrastructure overhead.

## Decision

Use signed JWT access tokens issued by `POST /api/auth/login`. The backend validates the token on protected requests and derives user, role, and tenant context from the authenticated principal.

## Consequences

- Simple stateless authentication for the MVP.
- Backend instances do not need a session store.
- Token lifetime and key management become important production controls.
- Refresh tokens, revocation, and rotation are not implemented yet.

## Alternatives Considered

- Server-side sessions: stronger revocation semantics, but requires shared session storage for multi-node deployments.
- OAuth/OIDC provider: likely future option, but too heavy for the initial merchant dashboard.

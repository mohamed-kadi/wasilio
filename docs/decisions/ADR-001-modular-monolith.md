# ADR-001: Modular Monolith

## Status

Accepted.

## Context

Wasilio is an early-stage SaaS with several related workflows: tenant identity, order lifecycle, confirmation operations, projections, and future courier operations. The team needs fast iteration while preserving clear boundaries for future extraction.

## Decision

Use a Spring Boot modular monolith. Keep bounded contexts separated by packages, application services, repositories, and data ownership rules instead of deploying separate services.

## Consequences

- Simpler local development and deployment.
- Easier transactional consistency for early workflows.
- Clear package boundaries are required to avoid turning the codebase into a single undifferentiated module.
- Future service extraction remains possible when a context has enough scale or ownership pressure.

## Alternatives Considered

- Microservices from day one: rejected because operational overhead would exceed current product maturity.
- Single technical CRUD module: rejected because event sourcing, tenant isolation, and workflow boundaries need explicit structure.

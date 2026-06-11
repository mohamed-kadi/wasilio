# Product Vision

Wasilio is a COD operations platform for Moroccan e-commerce merchants. It replaces informal WhatsApp threads, spreadsheets, and manual status tracking with a deterministic SaaS workflow.

## Target Users

- Merchants selling physical goods with cash-on-delivery fulfillment.
- Merchant operations staff who confirm orders by phone.
- Admin users who manage tenant onboarding, orders, and daily operational review.
- Future courier coordinators who need assignment, pickup, delivery, and failure visibility.

## Problem

COD merchants often lose operational control because order state lives across disconnected tools:

- WhatsApp conversations
- spreadsheets
- courier notes
- manual phone-call logs
- unclear follow-up reminders

This creates duplicate work, missed callbacks, poor auditability, and unclear responsibility for failed deliveries.

## Product Direction

Wasilio should become the operational source of truth for COD merchants:

- deterministic order lifecycle
- tenant-scoped merchant workspaces
- confirmation queue and callback follow-up
- courier assignment and delivery tracking
- reporting on confirmation, delivery, failure, and revenue outcomes
- integrations with stores, couriers, and payment/billing systems

## Current MVP

The MVP supports tenant onboarding, authentication, event-backed order lifecycle, order read models, confirmation attempts, and callback scheduling.

## Near-Term Product Priorities

- Harden production readiness.
- Add frontend E2E coverage for critical workflows.
- Build courier workflow screens and integrations.
- Add analytics for confirmation and delivery performance.
- Add billing/subscription support when commercial onboarding starts.

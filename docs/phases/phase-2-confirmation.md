# Phase 2 Confirmation

## Goal

Support daily COD confirmation operations with a queue, attempt records, and scheduled callbacks.

## Major Changes

- Added confirmation queue API.
- Added frontend confirmations page.
- Added confirmation attempt recording.
- Added final outcome handling that appends lifecycle events.
- Added callback scheduling with due, overdue, upcoming, and all scopes.
- Added explicit callback resolution endpoint.

## Migrations Added

- `V6__confirmation_attempts.sql`: confirmation attempts table and indexes.
- `V7__confirmation_callback_scheduling.sql`: callback scheduling fields and partial queue index.

## Commits

Recent related commits include:

- `e6bff6f feat(confirmation): add cod confirmation workflow`
- `35a0a11 feat(frontend): add confirmation operations page`
- `893b94c docs(confirmation): document cod confirmation workflow`
- `0c32b04 feat(confirmation): add callback follow-up workflow`
- `b247b9f feat(frontend): show confirmation callbacks`
- `c19e779 docs(confirmation): document callback scheduling`

## Risks Fixed

- Operators can record durable call attempts instead of using only WhatsApp/spreadsheets.
- Callback follow-up is queryable and tenant scoped.
- Final confirmation/rejection still flows through the event-sourced lifecycle.

## Remaining Gaps

- No notification/reminder worker for callbacks.
- No operator assignment or workload balancing.
- No confirmation performance analytics.
- Frontend E2E coverage is still missing.

# Callback Workflow

Callbacks support follow-up when a customer asks to be called later.

## Scheduling

An operator schedules a callback by recording a confirmation attempt with:

- outcome `CALL_BACK_LATER`
- future `callbackAt`
- optional note

The backend rejects missing or past callback times and rejects `callbackAt` for non-callback outcomes.

## Queue

`GET /api/confirmations/callbacks` lists tenant-scoped pending callbacks. Supported scopes:

- `DUE`: due now, including overdue callbacks.
- `OVERDUE`: callbacks before the current UTC day.
- `UPCOMING`: future callbacks.
- `ALL`: broad review and date-range filtering.

Callbacks remain actionable only while the related order is still in `CREATED` or `CONFIRMATION_REQUESTED`.

## Resolution

Callbacks are resolved when:

- an operator records a final `CONFIRMED` or `REJECTED` attempt for the order, or
- an operator explicitly resolves the callback through `POST /api/confirmations/callbacks/{callbackId}/resolve`.

Resolution records timestamp and user email.

## Current Limits

There is no notification worker, calendar integration, or SLA escalation yet. Operators must use the callback queue to find due follow-ups.

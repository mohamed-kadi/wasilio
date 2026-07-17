# Confirmation Workflow

The confirmation workflow helps operators call customers before courier dispatch.

## Queue

`GET /api/confirmations/queue` returns tenant-scoped orders in:

- `CREATED`
- `CONFIRMATION_REQUESTED`

The queue supports status, date range, search, page, and size filters.

Phase 26 uses the intelligence score as an operations KPI in the queue:

- `HIGH_RISK`: verify first
- `NEEDS_ATTENTION`: review signals
- `HIGH_CONFIDENCE`: fast confirm

These labels are display guidance only. They do not confirm, reject, assign, or block orders.

## Attempts

Operators record attempts through `POST /api/orders/{orderId}/confirmation-attempts`.

Supported outcomes:

- `CONFIRMED`
- `REJECTED`
- `NO_ANSWER`
- `CALL_BACK_LATER`
- `WRONG_NUMBER`

Every attempt stores attempt number, order ID, tenant ID, outcome, note, created user, and timestamp.

## Final Outcomes

`CONFIRMED` appends `OrderConfirmed`. `REJECTED` appends `OrderRejected`. If the order is still `CREATED`, the backend first appends `OrderConfirmationRequested` so the event stream remains deterministic.

Final outcomes also resolve pending callbacks for the order.

## Non-Final Outcomes

`NO_ANSWER`, `CALL_BACK_LATER`, and `WRONG_NUMBER` keep the order in the confirmation queue. They are operational records, not lifecycle state changes.

## Clearing A Request

If an operator clicks `Request confirmation` by mistake, the order can be returned from `CONFIRMATION_REQUESTED` to `CREATED` through `POST /api/orders/{orderId}/clear-confirmation-request`.

The backend appends `OrderConfirmationRequestCleared`. The action does not delete confirmation attempts, callbacks, timeline entries, or intelligence history.

Order Detail should use the confirmation-attempt endpoint for customer outcomes rather than direct lifecycle shortcuts. This keeps no-answer, callback, wrong-number, confirmed, and rejected outcomes separated from the request/clear stage controls.

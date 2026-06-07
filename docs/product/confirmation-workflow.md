# Confirmation Workflow

The confirmation workflow helps operators call customers before courier dispatch.

## Queue

`GET /api/confirmations/queue` returns tenant-scoped orders in:

- `CREATED`
- `CONFIRMATION_REQUESTED`

The queue supports status, date range, search, page, and size filters.

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

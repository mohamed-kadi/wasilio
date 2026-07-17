# Orders Workspace

The Orders workspace is the broad scan surface for the simplified Operations workflow:

Confirmation -> Assignment -> Pickup -> Delivery -> Recovery -> Closed

Phase 30 keeps the Orders page as a read-model workspace. It does not change order lifecycle transitions, courier assignment rules, failed-delivery recovery rules, saved-view payloads, or backend APIs.

## Existing Sources

The Orders page continues to use:

- `GET /api/orders`
- `GET /api/couriers`
- saved order search view endpoints
- failed delivery recovery queue endpoints when recovery mode is active
- failed delivery recovery summary endpoints for failed rows in the normal orders view

## UX Contract

The top scan should use business workflow labels instead of generic internal grouping. Table rows should stay compact on laptop screens by grouping:

- order ID, source, and date
- customer and phone
- product and amount
- workflow state or failure reason
- next action or recovery status
- row action

Advanced filters, saved views, recovery tabs, retry-ready actions, and order detail links remain part of the same workspace.

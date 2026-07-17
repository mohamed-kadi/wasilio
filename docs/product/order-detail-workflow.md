# Order Detail Workflow

Order Detail is the deep operational workspace for a single order. It mirrors the simplified Operations workflow:

Confirmation -> Assignment -> Pickup -> Delivery -> Recovery -> Closed.

## UX Contract

- The primary stage card shows the business workflow stage first, then the underlying order status.
- The stage trail keeps the order anchored in the same sequence used by dashboard, queues, and orders search.
- The action panel is labeled as a stage action, so operators understand it is tied to the current workflow stage.
- Snapshot labels use merchant-facing language such as `Order total`, `Source`, `Stage`, and `Next action`.
- Storefront-created orders are labeled as `Storefront / landing-engine`.

## Preserved Functionality

- Existing lifecycle actions stay unchanged: request confirmation, clear confirmation request, record confirmation attempts, assign courier, confirm pickup, mark delivered, mark failed, retry delivery, and recovery decisions.
- Existing recovery history, follow-up tasks, timeline, order line snapshots, and intelligence score history remain visible on Order Detail.
- Backend payloads, status values, domain rules, and order lifecycle transitions are unchanged.

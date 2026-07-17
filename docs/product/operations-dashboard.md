# Operations Dashboard

The dashboard is the first scan of the simplified Operations workflow:

Confirmation -> Assignment -> Pickup -> Delivery -> Recovery -> Performance

Phase 29 keeps the dashboard as a read-only operational overview. It does not introduce new backend rules, lifecycle transitions, courier rules, recovery rules, or intelligence scoring behavior.

## Dashboard Sources

The dashboard continues to use existing operational read endpoints:

- confirmation queue
- due confirmation callbacks
- courier assignment queue
- pickup queue
- delivery queue
- delivered order summary
- failed delivery recovery queue
- inbound order summary

## UX Contract

The dashboard should show the next queue to work first, then the six-stage workflow summary. Detailed grouped cards remain available for confirmation, courier movement, and failed recovery, but the first scan should match the merchant's actual operations sequence.

Performance is presented as the final stage using existing delivered and failed counts. Courier performance drilldown remains in the courier performance page.

# Intelligence Scoring

Phase 19 introduces an explainable scoring layer for confirmation quality and fraud risk.

The score is an operations signal only. It must not automatically confirm, reject, assign, retry, or close an order. The order lifecycle remains controlled by existing lifecycle commands and recovery rules.

## Goals

- Help merchants prioritize orders with a higher chance of successful confirmation.
- Flag suspicious or low-quality orders before the team spends time on them.
- Explain every score with visible business reasons.
- Keep the order ingestion contract stable for external clients such as landing-engine.

## Integration Boundary

External order creators send normal order intent data only:

- customer
- phone
- address
- selected product or amount
- source metadata
- idempotency or correlation identifiers

They do not send confidence scores, fraud scores, score reasons, or lifecycle decisions.

Wasilio calculates intelligence after an order exists and recalculates it when operational evidence changes. This keeps landing-engine independent from Wasilio's scoring rules and prevents external systems from spoofing risk scores.

See `docs/product/landing-engine-order-intake.md` for the public order-intent contract used by landing-engine. Accepted public orders create an initial internal intelligence snapshot after the order is committed and projected; rejected intake payloads do not create orders or scores.

## Score Outputs

Each order can have one current intelligence snapshot:

- `confirmationConfidenceScore`: `0-100`; higher means the order is more likely to be real and confirmable.
- `fraudRiskScore`: `0-100`; higher means the order has more suspicious or low-quality evidence.
- `level`: `HIGH_CONFIDENCE`, `NEEDS_ATTENTION`, or `HIGH_RISK`.
- `summary`: short operator-facing explanation.
- top signals: the strongest positive and negative reasons behind the score.

The default baseline is:

- confirmation confidence: `60`
- fraud risk: `40`

Scores are clamped between `0` and `100`.

## Audit History

The current snapshot is optimized for queue and detail display. Every recalculation also writes an append-only audit event so operators can see how the score moved over time.

Each audit event records:

- order-scoped sequence number for stable latest-first ordering
- previous confidence, risk, and level when a previous score exists
- new confidence, risk, and level
- confidence and risk deltas
- business change label such as `Initial score`, `Risk increased`, or `Moved to High risk`
- top score reason from the recalculation
- calibration version used to calculate the score
- calculation timestamp

Audit history is informational only. It does not trigger confirmation, assignment, delivery, recovery, refund, or closure actions.

## Scoreable Evidence

Only business evidence is scoreable. Random UI interactions such as expanding a panel or opening a modal are not evidence.

Scoreable events include:

- order created or ingested
- confirmation requested
- confirmation attempt recorded
- callback scheduled
- callback resolved or overdue
- order confirmed or rejected
- delivery marked failed
- future orders using the same phone, customer name, or address

## V1 Rule Set

Positive signals:

| Signal | Confidence | Risk |
| --- | ---: | ---: |
| Valid phone format | +5 | -3 |
| Customer name present | +3 | 0 |
| Address has street, city, and country | +5 | -3 |
| Same phone has previous delivered order | +20 | -15 |
| Same phone has previous confirmed order | +15 | -10 |
| Customer requested callback | +5 | 0 |
| Callback resolved on time | +8 | -5 |
| Order confirmed | set confidence at least 95 | set risk at most 5 |
| Order delivered | set confidence at least 98 | set risk at most 3 |

Negative signals:

| Signal | Confidence | Risk |
| --- | ---: | ---: |
| Weak or incomplete phone | -25 | +25 |
| Weak address | -15 | +15 |
| First no-answer attempt | -10 | +10 |
| Second consecutive no-answer attempt | -15 | +15 |
| Third or later no-answer attempt | -20 | +20 |
| Repeated same unresolved outcome | -10 | +10 |
| Wrong number | -60 | +60 |
| Customer rejected order | -50 | +40 |
| Callback overdue | -15 | +15 |
| Multiple callbacks without confirmation | -10 | +10 |
| Same phone rejected another recent order | -25 | +25 |
| Same phone has repeated no-answer history | -20 | +20 |
| Same phone used with different customer names | -15 | +15 |
| Delivery failed because customer was unreachable | -25 | +25 |
| Delivery failed because customer refused | -30 | +30 |
| Delivery failed because address was invalid | -35 | +35 |

## Level Mapping

- `HIGH_CONFIDENCE`: confidence is at least `75` and risk is at most `35`.
- `HIGH_RISK`: risk is at least `65`.
- `NEEDS_ATTENTION`: everything between those two states.

## Calibration Contract

The V1 calibration constants are owned by Wasilio:

- base confidence: `60`
- base risk: `40`
- high-confidence threshold: confidence `>= 75` and risk `<= 35`
- high-risk threshold: risk `>= 65`
- confirmed cap: confidence at least `95`, risk at most `5`
- delivered cap: confidence at least `98`, risk at most `3`
- valid phone length: `9-15` digits and not all one repeated digit

Any future calibration change must keep these guarantees:

- keep scores clamped to `0-100`
- keep every score explainable by stored signals
- keep public order ingestion independent from score fields
- cover representative low-risk, review, and high-risk scenarios with integration tests

## Backend Ownership

Scoring lives beside confirmation and delivery workflows. It reads their records, but it does not own their rules.

Recommended classes:

- `ConfirmationWorkflowService`: records attempts only.
- `DeliveryOperationsService`: records delivery outcomes and recovery only.
- `OrderIntelligenceScoringService`: calculates scores from order, confirmation, delivery, and historical evidence.
- `OrderIntelligenceSnapshot`: current score for fast UI display.
- `OrderIntelligenceSignal`: explainable reasons behind the current score.
- `OrderIntelligenceAuditEvent`: append-only score movement history for order detail and future reporting.

## Frontend Usage

The confirmation queue should show:

- queue-level KPI cards for visible score health
- average confirmation confidence
- average fraud risk
- visible high-risk count
- per-order score badge, confidence meter, risk meter, and top reason

Order detail should show the deeper scoring explanation. Operators should be able to see why a score changed without reading raw database records.

Order detail should also show compact score history:

- latest score movement first
- confidence and risk deltas
- current level after the movement
- strongest business reason

The intelligence report should show aggregate score health without changing operational state:

- scored order count
- average confirmation confidence
- average fraud risk
- current high-confidence, needs-attention, and high-risk counts
- current high-risk watchlist with order links
- top current score reasons
- recent score movements from audit events
- active calibration version and thresholds

The report reads current snapshots, current signals, and append-only audit events. It must not recalculate scores automatically or mutate orders.

Score UX should use business labels:

- Confirmation confidence
- Fraud risk
- High confidence
- Needs attention
- High risk
- Score reasons

The score should be treated as an operations KPI, not as a lifecycle command. It can help teams prioritize which orders to call first, which orders need review, and which score rules need calibration, but it must not directly confirm, reject, assign, retry, refund, or close an order.

## Guardrails

- Do not use score to mutate lifecycle automatically in Phase 19.
- Do not require landing-engine to send score fields.
- Ignore external score-looking fields such as `intelligence`, `confirmationConfidenceScore`, and `fraudRiskScore` on public order intake.
- Do not remove existing confirmation outcomes or recovery decisions.
- Do not replace operator judgment with hidden automation.
- Keep every score explainable by stored signals.

# Intelligence Calibration Rehearsal

Phase 23 validates that Wasilio's intelligence score behaves like an operations KPI after a real landing-engine order enters Wasilio.

This phase does not add automatic fraud blocking. It does not change confirmation, assignment, delivery, recovery, refund, or closure rules.

## Rehearsal Goal

Prove that a storefront order can move through the simplified workflow while score movement remains:

- internal to Wasilio
- explainable by business evidence
- visible to operators
- audit-backed
- non-authoritative over lifecycle decisions

## Seeded Baseline

Use the Phase 22 local seed:

- storefront: `first-store`
- product: `coolair-mini`
- landing-engine product page: `http://localhost:3000/products/coolair-mini`
- Wasilio product API: `http://localhost:8080/api/public/storefront/first-store/products/coolair-mini`
- Wasilio order API: `http://localhost:8080/api/public/storefront/first-store/orders`

The expected initial score for a valid `first-store` order is:

| Evidence | Confidence | Risk | Level |
| --- | ---: | ---: | --- |
| Valid landing-engine order with product media/profile | `76` | `32` | `HIGH_CONFIDENCE` |

The public response still returns only the receipt shape. Landing-engine must not receive score details.

## Calibration Matrix

These values are current V2 expectations for the seeded `first-store` rehearsal order.

| Step | Operator Evidence | Expected Confidence | Expected Risk | Expected Level | Primary Audit Reason |
| --- | --- | ---: | ---: | --- | --- |
| 1 | Order accepted from landing-engine | `76` | `32` | `HIGH_CONFIDENCE` | Initial score |
| 2 | First confirmation call not answered | `66` | `42` | `NEEDS_ATTENTION` | First no-answer attempt |
| 3 | Second confirmation call not answered | `41` | `67` | `HIGH_RISK` | Second no-answer attempt |
| 4 | Customer confirms on follow-up | `95` | `5` | `HIGH_CONFIDENCE` | Order confirmed |

The score should move down when repeat no-answer behavior appears, then recover when the customer confirms. The order lifecycle should change only because the operator records `CONFIRMED`, not because the score becomes high confidence.

## Manual Local Runbook

1. Start Wasilio with local seed loading.
2. Start landing-engine in Wasilio mode:

   ```bash
   NEXT_PUBLIC_PRODUCT_PROVIDER=wasilio
   NEXT_PUBLIC_WASILIO_PUBLIC_API_BASE_URL=http://localhost:8080
   NEXT_PUBLIC_WASILIO_STORE_SLUG=first-store
   ```

3. Open `http://localhost:3000/products/coolair-mini`.
4. Submit one COD order.
5. In Wasilio, open the resulting order detail.
6. Confirm the initial intelligence block shows:
   - confirmation confidence `76`
   - fraud risk `32`
   - level `High confidence`
   - storefront product image/content reasons
7. Record first `No answer` confirmation attempt.
8. Confirm the score moves to `66 / 42`, level `Needs attention`, with an audit event reason `First no-answer attempt`.
9. Record second `No answer` confirmation attempt.
10. Confirm the score moves to `41 / 67`, level `High risk`, with an audit event reason `Second no-answer attempt`.
11. Record `Confirmed`.
12. Confirm the score moves to `95 / 5`, level `High confidence`, and the order lifecycle changes to confirmed because of the operator action.

## What To Watch

During manual QA, verify:

- the public order response does not expose `orderId`, lifecycle status, confidence, risk, level, or score reasons
- Wasilio order detail shows the current score and score history
- confirmation queue KPI cards reflect the visible scored orders
- the intelligence report includes score movement after recalculations
- score movement never creates lifecycle transitions by itself

## Test Coverage

`PublicStorefrontControllerIntegrationTest.landingEngineOrderScoreMovesThroughConfirmationCalibrationPath` locks the seeded calibration path:

- public `first-store` order acceptance
- initial Wasilio-owned score
- first no-answer score movement
- second no-answer high-risk movement
- final confirmation score recovery
- append-only audit history for every recalculation

Existing confirmation and courier tests continue to cover individual outcome behavior, report aggregation, delivered phone history, wrong number, repeated no-answer, and delivery failure signals.

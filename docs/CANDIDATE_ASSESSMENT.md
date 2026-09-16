# Candidate assessment — September 16, 2026

Version `2026-09-16.1`. Applies to Main reports at/after `2026-09-16T00:00:00-07:00`.

The producer must finish the research-to-decision step for a promising exact selection. A ranked lead is not a betting recommendation. The mechanism does not lower Core requirements, assign LEAN/BET, fabricate probabilities, change staking or rewrite issuance.

## Working sequence

1. Bind the normal eligible primary inventory, exact execution quotes and qualified Pinnacle observer. Run `report-evidence-repair.mjs candidates` using the report/sidecar/root arguments already used by preparation. The initial queue works before decisions are populated.
2. Review the full inventory's applicable forecast routes. Reuse current event research across sides while recording real attempts and original source times. A later run must revalidate earlier forecasts rather than silently dropping them. No exact free forecast is guaranteed.
3. Prioritize the strongest positive price comparisons and exact forecast disagreements. The queue groups opposing contracts at the same line and retains both sides; it does not count two sides as independent opportunities. Investigate approaching starts and recoverable blockers while continuing full coverage.
4. Complete the promising selection's actual personnel, forecast and uncertainty review. Record `candidateAssessment` on its primary receipt. Adopt the fair once per exact paired market and derive coherent opposing probabilities/ranges before evaluating both prices. The existing gate prohibits mixing a model basis on one side with a conflicting market-only basis on its exact opposite. Different lines and settlement contracts remain separate. An adopted fair is still subject to the existing exact-selection, provenance, settlement, Core and staking checks.
5. Run `report-evidence-repair.mjs prepare` on unfrozen drafts. Incomplete promising evaluations are moved to existing `RESEARCH_INCOMPLETE` receipts, with real checks and a concrete next action. Completed unrelated selections remain publishable. Continue the missing work before finalizing when the normal time/quote conditions allow.
6. Run normal validation, freeze and publish. Read back the shortlist and completed/unfinished counts. The publisher and terminal do not promote any status.

## Decision meaning

**Market-based LEAN:** a favorable exact qualified comparison, resolved material information and a specific judgment that the price merits directional interest. Zero stake and NO BET remain mandatory. An independent forecast or calibrated probability interval is not required. A tiny or conflicted advantage can remain PASS when its actual weakness is explained.

**Forecast-based BET review:** accept or reject each applicable forecast explicitly. An accepted point may come directly from a suitable current model. Ground the uncertainty endpoints in identified applicable forecasts or quantified scenarios; identify a sensitivity range as such. Check the conservative bound at the exact obtainable price, then apply existing Core, personnel and exposure requirements. A point probability, source brand or model agreement alone does not establish calibration or independence.

**PASS:** a completed assessment explains why the price and evidence do not qualify. `No independent model`, `no published interval` or a routine unchecked lineup field alone does not complete a promising market-based candidate review.

**Unfinished:** missing research, an unassessed forecast disagreement or unexplained contradictory personnel fields remain work to finish. Record that work as `RESEARCH_INCOMPLETE`; do not label it WAIT merely to create a recommendation. A genuine unresolved material fact can be a completed reason to PASS when the applicability/impact review and alternatives have actually been completed.

Missing the new metadata alone must not invalidate an already supported market assessment. The finalizer checks for actual unanswered decision-sensitive work and retains valid market LEANs without imposing model adoption or a numerical range. A completed, concrete rejection can remain PASS. Machine validation checks traceable inputs and consistency; it cannot establish research quality from prose length.

## Producer schema

Write the object at `sidecar.primaryAnalysis.receipts[n].candidateAssessment`. It records the producer's decision; the derived `report.candidateAssessment` shortlist is a separate output. Existing decision, evidence, source, fair and publication requirements still apply.

| Field | Required meaning |
| --- | --- |
| `schema`, `selectionId`, `checkedAt` | `1`, the receipt's exact inventory selection ID, and a review time from `report.feedGeneratedAt` through `report.ts`, inclusive. |
| `quote` | Copy `receipt.quote`: exact `eventId`, `marketKey`, `side`, `selectionKey`, `book`, numeric `line` or `null`, `priceDecimal`, and original `quoteUpdatedAt` / `quoteObservedAt` when present. The quote must exist in the bound inventory. Spread `line` remains HOME-oriented for either side. |
| `priceChoiceRationale` | Required when the assessed quote differs from the strongest identified option. Explain the actual book, price or contract choice; do not silently apply one line's decision to another. |
| `forecastDispositions` | One `{recordId, disposition, rationale}` for every current `ELIGIBLE_EXACT` record. Values: `ADOPTED_FAIR`, `CONTEXT`, `REJECTED`. Use `[]` when none exists. Other recorded forecasts may also be discussed; only eligible exact records can be adopted. Adopted IDs must also appear in `receipt.decision.fairValueEvidence.forecastRecordIds`, and vice versa. |
| `personnel` | `{state, sourceIds, rationale}`. Completed resolved states are `RESOLVED` or `NOT_MATERIAL`. If other fields still say unresolved, also supply `materialityExplanation` and `remainingUncertainty` explaining the distinction. |
| `personnel.state = REVIEW_COMPLETED_UNRESOLVED` | A completed investigation with a material fact still unknown: additionally require `materialityExplanation`, `remainingUncertainty`, `decisionImpact`. Supports a reasoned `PASS`, or `WAIT` with existing valid `waitQualification`; never makes the market LEAN route technically eligible. Plain `UNRESOLVED` remains unfinished. |
| `decision` | `{status, rationale, betEligibility}`; `status` is `BET`, `LEAN`, `WAIT` or `PASS` and must equal the receipt's recorded decision. A favorable qualified market option also requires `marketRoute: {considered: true, rationale}`. A technically eligible market LEAN kept as PASS requires a concrete `marketPassReason`. |
| `decision.betEligibility` | `{state: "ASSESSED" or "NOT_APPLICABLE", rationale}`. If a fair is adopted, or the decision is BET, use `ASSESSED` plus `conservativeBound: {unit, value, sourceIds, rationale}` matching the recorded fair's conservative endpoint. No fair/range is required for the market-only route. |
| `priceCondition` | Either `{state: "NO_PRICE_ONLY_CHANGE", rationale}` explaining the needed non-price change, or `{state: "PRICE_THRESHOLD", basis, priceDecimal, hypothetical: true, rationale}` with an exactly derivable comparison boundary. |

All referenced source IDs must exist in the decision/evidence `sourceEvidence`, name the same `eventId`, and retain a valid original `checkedAt` or `asOf` no later than issuance. Personnel references must be `OFFICIAL` or `REPORTING`. The current candidate/information review records applicability; do not rewrite an older observation to make it appear new. An unresolved forecast's personnel assumptions require their own review.

Price bases are `MARKET_REFERENCE_BREAK_EVEN` (reciprocal of the qualified no-vig probability), `FORECAST_BREAK_EVEN` (also provide its exact `recordId`; preserve push accounting), or `CONSERVATIVE_BOUND` (reciprocal of a supported `selection_probability` lower bound, explicitly conditional on no push or with zero push probability). Store full precision, not the rounded display value. Unsupported or non-probability bounds can use `NO_PRICE_ONLY_CHANGE`. There is no mandatory numerical edge threshold or extra universal buffer.

For conservative fair endpoints, use the lower selection probability; the American-odds endpoint with lower implied probability; the higher selected-team/home fair spread; or the lower fair total for Over and higher for Under. Source-grounded derivation and existing Core checks remain mandatory.

### Synthetic market LEAN example

This is schema illustration, not live research or a recommendation. Assume a matching synthetic receipt/decision, a qualified exact reference probability of `0.5`, no eligible exact forecast, and source `fixture-official-check` containing the same event's completed check. The decision remains zero stake with `playTo: "NO BET"` and no `fairValueEvidence`.

```json
{
  "schema": 1,
  "selectionId": "MLB|fixture-event|full_game_moneyline|home",
  "checkedAt": "2026-09-16T13:05:00Z",
  "quote": {
    "eventId": "fixture-event",
    "marketKey": "ml",
    "side": "home",
    "selectionKey": "fixture-event|ml|home||",
    "book": "Bet365",
    "line": null,
    "priceDecimal": 2.1,
    "quoteUpdatedAt": "2026-09-16T12:55:00Z",
    "quoteObservedAt": "2026-09-16T13:00:00Z"
  },
  "forecastDispositions": [],
  "personnel": {
    "state": "RESOLVED",
    "sourceIds": ["fixture-official-check"],
    "rationale": "Synthetic checked starters and lineup assumptions match this market review."
  },
  "decision": {
    "status": "LEAN",
    "rationale": "Synthetic exact favorable comparison merits directional interest at zero stake.",
    "marketRoute": {
      "considered": true,
      "rationale": "The exact 2.1 offer is favorable against the qualified 2.0 reference; material information is resolved."
    },
    "betEligibility": {
      "state": "NOT_APPLICABLE",
      "rationale": "Market reference only; no supported independent fair adopted."
    }
  },
  "priceCondition": {
    "state": "PRICE_THRESHOLD",
    "basis": "MARKET_REFERENCE_BREAK_EVEN",
    "priceDecimal": 2,
    "hypothetical": true,
    "rationale": "Market-reference parity only; not a BET trigger."
  }
}
```

When adopting an eligible forecast, merge the following synthetic fields into that object while retaining its other fields and recording the actual resulting decision. This fragment assumes `fixture-forecast-1` is currently eligible, the existing fair lists that ID, the fair's supported probability range is `[0.54, 0.58]`, and `fixture-model-source` backs the derivation. It does not establish BET eligibility by itself.

```json
{
  "forecastDispositions": [
    {
      "recordId": "fixture-forecast-1",
      "disposition": "ADOPTED_FAIR",
      "rationale": "Synthetic exact forecast accepted after current event, personnel and settlement review."
    }
  ],
  "decision": {
    "betEligibility": {
      "state": "ASSESSED",
      "rationale": "Compare the supported lower bound with the obtainable price, then apply the existing Core and exposure checks.",
      "conservativeBound": {
        "unit": "selection_probability",
        "value": 0.54,
        "sourceIds": ["fixture-model-source"],
        "rationale": "Lower endpoint of the documented synthetic sensitivity range.",
        "probabilityBasis": "CONDITIONAL_ON_NO_PUSH"
      }
    }
  }
}
```

For a completed unresolved WAIT, also retain the existing `waitQualification` with `actionableIfResolved: true`, nonempty `blockers`, current non-market `independentSignals` containing `origin` and `finding`, and a concrete `rationale`. No additional `trigger` property is required by the candidate schema; the existing WAIT validator still applies.

## Price conditions

Show a numerical price condition only when it follows from an identified current reference or supported conservative probability bound with compatible settlement. Label benchmark parity as market-reference break-even, not a guaranteed BET trigger. For push-capable lines, preserve conditional/non-push semantics. If changing price alone cannot resolve the case, say which non-price input is needed. No invented universal buffer or fixed edge threshold is introduced.

## Separate prospective method test

`research/market-method-shadow-v1.json` fixes the experimental rule before forward observations. `report.marketMethodShadow` records hypothetical candidates and exclusions from September 16 onward. It has no wager authority. Earlier replay is development evidence only and cannot enter the prospective performance sample.

Evaluation uses the first qualifying appearance per exact market and retains its exact price, selection, source times and limitations. Later repeated appearances cannot replace that entry based on outcomes. Resolved hypothetical 1u returns, missing results and comparable closing-price observations are reported separately; absent closing evidence remains missing. Results are rebuilt with the normal results index process into `results-index.json.marketMethodTest`, without a new scheduled task. Profitability has not been established.

## Acceptance

- Strong candidates survive as a visible review queue, including when no issued card exists yet.
- Recorded findings affect a producer's explicit assessment; missing review is no longer a template PASS.
- A supported LEAN can be completed without an unnecessary independent-model requirement.
- BET still needs the supported forecast/fair path and all existing controls.
- Completed cards publish while unfinished candidates stay visible and resumable.
- Future test selections are fixed before outcomes and counted once per exact market.

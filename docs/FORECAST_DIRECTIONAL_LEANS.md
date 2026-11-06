# Source-backed directional LEAN

Current analytical policy for new Main reports at/after **`2026-11-06T17:00:00Z`** (10:00 Pacific on the project's current America/Vancouver clock). Read [adaptive strategy research](ADAPTIVE_STRATEGY_RESEARCH.md) with [shared scheduled authority section 6](../BETTING_EDGE_SCHEDULED_REPORT_AUTHORITY.md#6-assessment-routes-one-decision-contract). The original opinion route began October 1; the bounded historical policies below retain replay authority for issued reports. Governance v1.0, Core 1.5, the existing five tasks and issued History remain unchanged.

## Product decision

LEAN is a reasoned directional opinion below BET strength. Review an eligible exact published probability supporting the actual offered price, then choose LEAN/WAIT/PASS from source quality, current assumptions, recent and longer-run feedback, price and contrary evidence. No fixed two-source set, universal one-point gap or automatic positive-forecast default governs current forecast LEANs. Provider capability still comes from the current forecast registry and exact applicability checks; a catalogue listing alone is not eligibility.

Review BET first through its supported-fair/range and risk requirements, then assess the zero-stake opinion separately. Missing an independent fair, published confidence interval, qualified Pinnacle pair or BET clearance does not itself reject the opinion. A quote-only discrepancy is not an independent forecast, and a score projection or team-win percentage cannot be recast as another contract's probability.

Use one directional preference per exact paired market; preserve supporting and contrary models, common origins and source versions. A changed opinion on a later run needs the actual changed price or evidence. No card quota or automatic numerical weighting applies.

## Authoring

### Current source-led and qualified-market routes

Work on an unfrozen draft with the exact executable `feed`, current `forecastReview`, genuine MODEL evidence and actual current information/personnel/settlement review. Use `createSourceLedForecastLean(report, rec, judgment)` from `tools/forecast-lean.mjs` when the forecast leads the opinion without adoption as independent fair. Use `createForecastLean` directly when retaining an already completed `QUALIFIED_PINNACLE` assessment. Both require producer judgment and preserve original forecast identity/probability.

Illustrative source-led handoff; every ID, finding, clock and dependency must come from the actual selection:

```js
const opinion = createSourceLedForecastLean(report, rec, {
  forecastRecordId: 'the-real-bound-record-id',
  sourceIds: ['the-selection-specific-MODEL-source-id'],
  rationale: 'Why this exact side is preferred at its recorded price.',
  uncertainty: 'The actual unknown model error, dependence and assumptions.',
  conflictReview: 'The strongest contrary forecast and any available signed Pinnacle disagreement.',
  limitations: 'What the published point cannot establish.',
  informationReview: {
    checkedAt: report.ts,
    sourceIds: ['the-actual-current-official-or-reporting-source-id'],
    state: 'UNRESOLVED',
    impact: 'The investigated material assumption still awaiting confirmation.'
  },
  settlementRationale: 'The exact market, line, period and compatible settlement/push basis.',
  provisional: true,
  recheckCondition: 'The actual unresolved dependency and required recheck.'
});
```

The MODEL source must link the original forecast URL with a selection-specific finding. A completed unresolved material review requires **PROVISIONAL LEAN**, its named recheck and the genuine unresolved information/Core state. Retain Stage 2 and quarterback follow-up where the actual assessment requires them. Missing research remains incomplete; do not change PARTIAL into CONFIRMED or treat an injury list as a second adjustment without checking the model's assumptions.

The source-led helper sets `marketAssessment.basis:SOURCE_LED_OPINION`, adopts no reference probability or independent fair, labels `fair` as `Published forecast point: ... (independent fair unavailable)` and recomputes Core with `fairValueBasis:UNAVAILABLE` and BET authority blocked. Its forecast uncertainty remains `UNQUANTIFIED`. An available qualified exact Pinnacle comparison stays separately signed, visible and replayed. An unavailable comparison stays unavailable; never substitute another line or manufacture a reference.

The qualified-market helper retains `marketAssessment.basis:QUALIFIED_PINNACLE`, the separately labelled `Market reference` and `MARKET_DERIVED_ONLY` Core context. Both routes keep `fairValueEvidence:null`, `independentFairClaimed:false`, `status:LEAN`, `stake:$0`, `playTo:NO BET` and no wagering price watch. Neither the raw point nor its arithmetic gap is established profit.

Helpers return a new draft card, without updating the original report, sidecar, receipt, counts or History. Bind the card to its exact EVALUATED receipt, synchronize the matching sidecar, `cardEvidence` and counts through the existing controller, and retain current source/applicability review. Record an unadopted opinion forecast as CONTEXT with the reason it supports direction without supplying independent fair.

### NHL forecast price WAIT

The existing `createForecastWait` helper remains available for an eligible unconditional NHL full-game moneyline point with a positive price-support gap below one probability point. Its concrete reassessment target remains `1 / (publishedProbability - 0.01)`, with the displayed American odds rounded toward a better price. This retained helper target is not a current universal LEAN floor or a rule forcing every smaller positive gap into WAIT. A documented discretionary LEAN or reasoned PASS can also be appropriate under the current policy.

Preserve the original record, current exact gap, `targetKind:LEAN_REASSESSMENT`, uncertainty and concrete trigger. Unresolved material assumptions require a provisional label and named personnel recheck included in that trigger. The matching `waitQualification` remains `mode:FORECAST_PRICE_WAIT`, `actionableIfResolved:false`, `leanReassessmentIfResolved:true`, with no claimed independent wagering signals; preserve `cardEvidence.waitCondition`. This is $0 / NO BET. Ordinary WAIT retains its separate independent-signal, actionability and HIGH-error requirements. Unfinished research is not WAIT.

A price target only triggers fresh assessment. It cannot auto-promote a saved WAIT, carry a decision to another line or authorize BET. A newly authored LEAN removes the old forecast-WAIT receipt/condition. The October 15 two-source WAIT arithmetic remains historical replay only.

## BET follow-through

For promising eligible forecasts/native fairs, assess whether the actual current evidence can support an adopted fair and a source-grounded uncertainty/sensitivity range. Identify endpoints and assumptions, resolve decision-sensitive personnel and apply the existing conservative bound, independent-support, model-error, exact-price, exposure and staking requirements. A sensitivity range is not automatically a calibrated confidence interval. A source brand, vote count, streak, better payout or published point alone does not supply BET authority.

If BET is unsupported, separately assess the directional preference. For an eligible forecast-supported PASS, retain `candidateAssessment.decision.directionalReview = {state:"REJECTED", rationale:"the actual source-grounded directional objection"}` and the existing source bindings/provisional-alternative review. The old one-point `leanDefaultException` is no longer mandatory after the current cutoff. `INSUFFICIENT_CORROBORATION` is a historical rejection kind for the former active NHL quota; do not use it to reject current opinions solely for missing that quota. Explain real source conflicts, invalid assumptions or the lack of a defensible preference. For a withdrawn earlier LEAN retain `previousDecision` and the actual `changedFinding`, without inventing movement.

## Publisher verification

The existing gates check exact identity, original MODEL linkage, unstarted event, current producer judgment, source/applicability/personnel/settlement, positive exact-price support, visible uncertainty/provisional wording, zero risk and one opinion side per contract. `forecastLean` must match the sidecar and receipt. Current replay validates applicable original supporting and contrary probability records, not just a favorable anchor. A producer-written `ELIGIBLE_EXACT` flag cannot replace that replay.

A qualified market route still requires its exact pinned pair and arithmetic. A source-led route does not require an unavailable pair, and must not invent reference fields. Both retain Core recomputation, candidate completion, original clocks, normal freeze/staged publication and remote issuance readback. Optional strategy feedback is not a new publication veto. Reassess each new run rather than carrying old grades, fair values or prices forward.

## Historical policy windows

These windows describe replay, not current authoring. Compare absolute report instants; do not rewrite issued timestamps or assume a winter offset.

| Window | Policy at that time |
| --- | --- |
| From `2026-10-01T12:00:00-07:00` | Original reviewed exact-probability opinion added to an already qualified market assessment. |
| `2026-10-06T15:53:55-07:00` to before `2026-11-06T17:00:00Z` | One-point meaningful-forecast LEAN default and source-bound `leanDefaultException` for a qualifying PASS, subject to later NHL refinements. |
| `2026-10-13T07:07:42-07:00` to before `2026-11-06T17:00:00Z` | NHL one-point LEAN floor and below-one-point forecast price WAIT, subject to October 15 corroboration. |
| `2026-10-15T12:11:48-07:00` to before `2026-11-06T17:00:00Z` | NHL deciding set MoneyPuck/DRatings/Dimers, two supporting sources and approved one-point anchor; PuckCast research-only for this route. WAIT target met both source and one-point conditions. |
| At/after `2026-11-06T17:00:00Z` | Current discretionary opinion and source-led expansion described above. Source eligibility, honest uncertainty, original replay and BET requirements remain. |

### Morning baseline

October 1's 06:26, 08:12 and 09:42 reports each contained 70 PASS and no LEAN/BET/WAIT. At 09:42 Atlanta's ESPN 59.7% point, exact execution price and contrary Pinnacle reference motivated the original opinion review. The 08:12 report had no eligible exact positive forecast. These are historical examples, not current candidates or retroactive promotions. Current sources, assumptions and prices require fresh review.

## Validation

The October 1 rollout recorded 45 passing tests and unchanged readback of the three issued morning reports. The November 6 implementation added nine strategy-research cases and passed its targeted and historical regressions. These are implementation/historical-compatibility results, not evidence of winning performance or adoption by every in-flight draft.

When changing opinion code, use the existing strategy-research, forecast-LEAN/default/WAIT, forecast-evidence, market-assessment, candidate, coverage, sidecar and shared-pipeline regressions appropriate to the change. For historical details use the report's pinned authority blobs and Git history. Do not rerun or regrade an issued report to apply today's policy.

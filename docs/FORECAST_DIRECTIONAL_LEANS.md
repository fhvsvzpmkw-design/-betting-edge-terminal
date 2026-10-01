# Source-backed directional LEAN — October 1, 2026

Status: OPERATIONAL for **new reports at/after 2026-10-01T12:00:00-07:00**. All five Main lanes inherit this through the shared scheduled authority. Governance v1.0 and Core 1.5 remain unchanged. Earlier issued reports keep their original decisions.

## Product decision

LEAN is a directional opinion below BET strength. A real forecast supporting an exact price must receive an actual LEAN review, even when its interval or independence is insufficient for BET. An unknown calculation time, unavailable published confidence interval, disagreement with Pinnacle, or failed BET qualification is not by itself proof that there is no useful directional opinion.

This adds a narrowly scoped route: retain the **qualified exact paired-market assessment**, and add `forecastLean` for a **current, exact, source-linked published outcome probability**. The model point must support the chosen supported-book price under its actual settlement/push convention. The producer must make and explain the preference. A quote-only edge is not an independent forecast; score projections and probabilities for another side, line or period cannot qualify.

No numeric LEAN/BET quota applies. Opposing cards continue to receive full coverage. Choose one side per exact market in the customer-facing opinion; the report evidence gate rejects opposing LEANs on an exact paired contract when this forecast-opinion route is used. Retain model disagreement in the analysis. A change in opinion across later runs must be explained with the changed price or evidence.

## Authoring

Use `createForecastLean` in `tools/forecast-lean.mjs` on an **unfrozen draft** with an already complete qualified market assessment and current `forecastReview`. It requires producer judgment:

```js
const opinion = createForecastLean(report, rec, {
  forecastRecordId: 'the-real-bound-record-id',
  sourceIds: ['the-selection-specific-MODEL-source-id'],
  rationale: 'Explain why this exact side is preferred at its recorded price.',
  uncertainty: 'Name unknown model uncertainty, dependence or assumptions.',
  conflictReview: 'Explain disagreement with Pinnacle and any other actual sources.',
  limitations: 'State what this point cannot establish.',
  provisional: true,
  recheckCondition: 'Name the unresolved starter/lineup dependency and the required recheck.'
});
```

The model source must use the original forecast URL and a selection-specific finding. Include a current official/reporting information review. If material personnel remains unresolved, the opinion must visibly say **PROVISIONAL LEAN**, name the dependency and recheck, and retain the unresolved information/Core state. Do not convert PARTIAL into CONFIRMED, claim an invented uncertainty band, erase a contrary market price, or use a provisional opinion to authorize risk. Material Stage 2 and quarterback follow-up requirements still apply where required by the real assessment; the new field does not waive them.

`forecastLean` records one original probability point, probability basis, immutable record ID, exact selection key, current judgment, MODEL source IDs, explicit `UNQUANTIFIED` forecast uncertainty, limitations and disagreement. `independentFairClaimed` is false. The existing market reference remains separately labelled in `fair`; `fairValueEvidence` stays null. Display the forecast point in support/analysis, rather than presenting it as an adopted fair. Do not describe the raw point's arithmetic advantage as established expected profit.

The result has `status:LEAN`, `stake:$0`, `playTo:NO BET`, no price watch, and the honest `MARKET_DERIVED_ONLY` Core context with BET authority blocked. The helper returns a draft and changes no original card, report count, sidecar, receipt or history. Bind the returned card to the exact receipt, update the matching sidecar status, `cardEvidence` and counts, and normalize its derived fields through the existing controller. Record the forecast disposition as CONTEXT with an explicit explanation that it supports a directional opinion but is not adopted independent fair.

If the candidate's personnel review uses `REVIEW_COMPLETED_UNRESOLVED`, give the real source IDs, materiality explanation, remaining uncertainty and provisional decision impact. The candidate completion layer now recognizes a properly validated provisional forecast LEAN without pretending personnel resolved. Missing actual research remains incomplete.

## BET follow-through

For every promising eligible forecast/native fair, explicitly assess **BET first, then LEAN**, rather than defaulting to market PASS because the separate forecast has not been adopted. Where evidence permits, construct and source the actual uncertainty/sensitivity case, recheck decision-sensitive assumptions, calculate the conservative price boundary, and finish the existing BET tests. Missing a publisher's confidence interval alone starts this assessment; it is not an automatic model rejection.

When that work cannot establish BET, issue the justified source-backed opinion where this route qualifies. A PASS on a forecast-supported price needs a **directional rejection reason** explaining why the actual preference is not credible. “Not BET-grade”, “no published interval” or “Pinnacle disagrees” alone describes a BET limitation, not a complete rejection of an opinion. Strong unresolved contradictions, obsolete assumptions, inapplicable settlement, wrong-side forecasts and no defendable preference can still justify PASS/incomplete research.

For a PASS on an eligible forecast-supported exact price, record `candidateAssessment.decision.directionalReview = {state:"REJECTED", rationale:"the actual source-grounded reason for rejecting the directional preference"}`. From the stated cutover the candidate completion gate requires this separate assessment; missing work is deferred as research incomplete. This is an assessment requirement, not an automatic LEAN or a count quota.

This amendment creates no market-only BET authority and changes no stake/exposure limits. Completing a BET remains a real price and uncertainty decision. It is not inferred from product engagement, a streak, a tempting payout, or the exploratory movement study.

## Publisher verification

The report evidence gate checks selection identity, current producer judgment, zero risk, source linkage, exact eligible probability, price support and visible uncertainty/provisional wording. `forecastLean` must match between card and sidecar. The primary coverage gate independently re-evaluates the **original bound forecast record plus current report applicability** using `evaluateForecast`. A producer-written `ELIGIBLE_EXACT` field cannot bypass missing/stale/wrong-line/personnel/settlement checks.

Market-reference pairing, quote freshness, Core recomputation, current personnel semantics, candidate completion, freeze and remote issuance verification remain enforced. No existing report is rewritten or reissued under the new rule.

Reassess on every new run. If the opinion no longer qualifies, remove `forecastLean` and record the newly justified status; do not carry its point or grade onto a different side, line or price without current review.

## Morning baseline

October 1's 06:26, 08:12 and 09:42 reports each contained 70 PASS and zero LEAN/BET/WAIT. Atlanta had an eligible ESPN 59.7% moneyline point at 06:26 and 09:42. At 09:42, 1.95 decimal required 51.28% before model uncertainty, while Pinnacle's no-vig reference was 49.53%. The prior producer used that disagreement, unknown model time/dependence and unresolved starters/lineups to keep the point as context.

That is a concrete candidate for a **provisional directional review** under the new route; it is not a current bet, an automatic promotion, or a retroactive changed grade. The 08:12 report had no exact eligible positive forecast. New runs must revalidate the actual source point, event assumptions and price. Buffalo's 0.23-point market discrepancy at 09:42 is not an independent forecast and does not gain automatic LEAN/BET status through this amendment.

## Validation

Run `node --test tests/forecast-lean.test.mjs` plus the forecast, market assessment, candidate assessment, evidence, primary coverage, sidecar and shared pipeline regressions. The new synthetic tests exercise full primary publication validation, negative Pinnacle disagreement, provisional candidate completion, raw-source/applicability replay, false eligibility, no risk/fair promotion and immutable morning history.

Pre-activation validation: **45 tests passed** across 12 test files, including nine new opinion-route cases. Each of the three October 1 issued morning reports also passed all **15 shared readback gates** under the updated code, without a byte change or retroactive regrading. This validates implementation and historical compatibility; the first real post-cutover opinion still needs fresh source/price review and ordinary publisher verification.

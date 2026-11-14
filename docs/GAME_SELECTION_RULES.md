# Game selection rules

Forward amendment for new reports at/after **`2026-11-14T17:00:00Z`**, authorized by the user's request to revise rules/thresholds and retain the Pinnacle comparison without using it as a strategy. This supersedes the conflicting market-first qualifier and discretionary no-floor language in older guides. Issued reports retain their original rules.

Start with a current game forecast or supported native fair, assess the matchup and material personnel, then compare that estimate with the actual executable price. Use the same event research across its markets. Pinnacle's exact signed comparison, arithmetic, source and display remain available as **context only**. It cannot create a candidate, improve its research rank, qualify LEAN/WAIT/BET, or reject an otherwise supported game opinion. An unavailable comparison does not block the source-led route. Do not delete comparisons or their history.

| Decision | Probability-based operating rule |
| --- | --- |
| LEAN | At least **0.50 percentage point** above the exact contract's break-even probability from a reviewed eligible game forecast or adopted fair. One suitable source can be enough. Default to reviewing the supported LEAN; rejecting it needs an actual source-grounded assumption conflict or material contrary finding, rather than missing BET strength. Zero stake and NO BET remain explicit. |
| BET review | At least **2.00 percentage points** from the supported game fair, plus a **supported conservative endpoint above break-even**. The existing Core independent-support/model-error, current personnel, executable price, play-to, exposure and staking requirements must also pass. A raw published point or meeting this cutoff alone never authorizes BET. |
| Price WAIT | A positive eligible forecast gap below 0.50 point with a real obtainable-price recheck. Use `createSourceLedForecastWait`; its exact American price target reaches the 0.50-point LEAN review threshold. Available for compatible full-game forecast contracts across sports, rather than NHL alone. It is zero stake, no wager, and cannot auto-promote. |
| Provisional LEAN | A supported LEAN whose current material assumption has been investigated but remains unresolved. State the actual uncertainty and named recheck. Ordinary unannounced final lineups do not by themselves erase a directional opinion. Decision-sensitive uncertainty still prevents BET unless the supported fair/range and existing personnel rules resolve it. |
| PASS / incomplete | PASS needs a game/selection-specific rejection. Unfinished applicability or research remains incomplete; it is not evidence that a game has no advantage. Publish completed supported work with the actual remaining counts. |

These are initial operating cutoffs, not established profit rates or a guarantee of daily selections. Preserve all suitable supporting and contrary forecasts and shared source families; do not select a favorable provider merely to clear a cutoff. Reuse the existing prospective strategy/source feedback and grading to assess the rules. No new task, broad model build, extra odds request, worker quota or pick quota is introduced.

Prior saved game assessments reopen once at this policy change, preserving their research rather than restarting it. A completed Pinnacle-price PASS is not a completed game forecast. A new context-route PASS must have its existing `candidateAssessment.decision.directionalReview` with a current game-specific rejection and linked MODEL/OFFICIAL/REPORTING evidence; price-only reasoning cannot close it. Changed Pinnacle prices refresh context without restarting game research after the current policy has been reviewed.

## Probability, settlement and uncertainty

For a conditional-on-no-push probability, the gap in percentage points is `100 * (p - 1 / priceDecimal)`. For an unconditional win probability with refund probability `q`, it is `100 * (p - (1 - q) / priceDecimal)`. Zero-push markets use `q = 0`. Preserve the original basis and actual settlement; the two kinds of probability cannot be pooled. At -110 with no push, break-even is about 52.38%, LEAN starts near 52.88%, and BET review starts near 54.38%, with its supported downside still above 52.38%. These are probability points, not ROI percentages.

Probability-based adopted fairs must retain `probabilityBasis`, and an unconditional fair must retain its supported `pushProbability` or `settlement.pushRule: NO_PUSH`. The conservative endpoint comes from the real sourced range, never a fixed invented haircut. A published confidence interval is not mandatory: suitable sourced scenarios or an explicitly justified sensitivity range can be assessed under the existing Core rules. They are not automatically calibrated confidence intervals. Unknown unbounded error still cannot authorize a wager.

Native spread/total fairs stay in their original units and keep their existing supported-fair/range and Core requirements. The probability cutoffs do not turn a one-point projected spread advantage into a one-percentage-point cover advantage. A win forecast cannot price a spread, total, regulation-only or other settlement contract without a supported exact conversion.

## Producer and validation

`tools/game-selection-policy.mjs` owns the forward cutoff and numeric policy. The existing forecast helpers, candidate assessment, event/primary research plans and report-evidence gate apply it. `forecastLeanDefault` exposes the qualifying record IDs and 2.00-point BET-review IDs; producer judgment, original-source replay and normal staged publication remain required. A qualifying forecast-supported PASS must retain the existing meaningful source-linked LEAN-default exception, with the actual contrary evidence and directional impact.

Keep the source-led `UNAVAILABLE` fair basis and `UNQUANTIFIED` model-error state honest when no fair/range is adopted. Separately author BET through supported `fairValueEvidence`; do not relabel a LEAN or turn its published point into a fair merely to pass the cutoff. The raw forecast, source clocks, exact side/line/book/settlement, available signed Pinnacle comparison, card/sidecar/receipt binding and independent Graham ownership retain their normal validation.

Run `node --test tests/game-selection-policy.test.mjs` and the affected existing forecast/candidate/research/publication regression tests before changing the policy. Changes apply forward, with a new dated cutoff/revision when the definition changes; never rewrite issued grades or historical trial fingerprints.

# Core 1.4 deep review — September 20, 2026

Status: REVIEW COMPLETE; bounded forward corrections, not a new wagering strategy.
Audit base: `d4e1bf4ca6827d5123c054be78eb6da6d4648eaf`.
Historical window: August 25 activation through September 20, 15:17:13 Pacific.
Forward correction cutover: `2026-09-20T18:15:00-07:00`.

## Findings from the actual records

The read-only audit parsed the indexed reports and sidecars with no read failures. GitHub Actions run 35544662540 completed successfully and confirmed no governed file changes. A second successful run, 35544851656, exported the exact pinned inputs for local review. Counts below are card appearances, not independent bets, settled outcomes or evidence of profitable selection.

| Cohort | Reports containing cards | Appearances | BET | LEAN | WAIT | PASS | Model-error eligible |
|---|---:|---:|---:|---:|---:|---:|---:|
| Core 1.4 since activation | 90 | 3,014 | 0 | 31 | 17 | 2,966 | 533 |
| Primary-market period, September 6 onward | 46 | 2,656 | 0 | 6 | 5 | 2,645 | 225 |
| September 15 candidate amendment onward | 6 | 52 | 0 | 2 | 0 | 50 | 0 |

Passing model-error eligibility is not passing the entire BET process. Nevertheless, 533 eligible appearances and zero BETs show that the model-error filter alone cannot explain the result.

All 52 appearances in the latest cohort were market-derived, with independent support NONE and no numerical `fairValueEvidence`. Qualified market-only analysis has an intentional LEAN/qualified-WAIT ceiling: `validateMarketAssessment` excludes BET. Those 52 did not test a completed independent-fair BET pathway.

In the primary-market period, 240 appearances retained numerical fair evidence. All were selection probabilities. Only six central estimates exceeded the break-even probability of their recorded decimal price, and none of their conservative lower bounds cleared it. Most earlier constructions began with the execution books' no-vig probability and small capped adjustments. Repeated sensitivity widths ranged from 8 to 18 probability points, with 8-point widths appearing 82 times. These are not established statistical confidence intervals. A wide band must not be narrowed merely to create a bet, but a generic reused width is not evidence of calibrated uncertainty either.

An illustrative case is the September 9 06:00 Athletics +155 PASS: central probability 40.2%, lower endpoint 39.1%, price break-even approximately 39.216%. Failure of the lower-bound BET test did not by itself answer whether the central forecast merited a zero-stake LEAN. It is a review example, not a retrospective upgrade.

On September 20 morning, Raiders +6.5 carried an AVAILABLE Walters/Graham fair of Chargers -4.344, but the card recorded ADVISORY_ONLY and MARKET_DERIVED_ONLY. A contrary DRatings forecast was also present. This does not prove a missed BET; it shows why governed native spread values and their source disagreements must be explicitly assessed rather than ignored for lack of an exact published cover probability.

## Confirmed overly broad restriction and correction

`receiptCore` required MODERATE or STRONG independent support for every numerical-fair EVALUATED decision, including zero-stake LEAN, WAIT and PASS. That September 6 receipt rule applied a BET-level strength condition more widely than the status-specific Core policy and the newer market-assessment path.

From the correction cutover, the extra primary-receipt strength floor applies to BET only. Non-BETs still need their exact supported fair/range, real source-linked inputs, coherent opposing-market assessment, current applicable personnel review, exact card evidence and specific decision rationale. No source-free PASS, automatic LEAN, invented fair or hidden unfinished work is permitted. WAIT keeps its actionable independent-signal requirements and the existing HIGH-error support rule. All BET model-error, conservative-bound, price, exposure and staking gates remain intact. Historical reports retain their original rule semantics.

## Candidate discovery correction

The candidate queue previously ranked only qualified Pinnacle comparisons and registry-formatted exact forecast probabilities. An already recorded native fair could therefore disappear from the promising queue when it had no matching registry probability, even though the normal evidence schema supports fair spreads, totals and probabilities.

The queue now reviews a source-linked current recorded fair at the exact same event, selection and line. Native spread and total margins retain point units; they are never treated as cover probabilities, EV or probability-point scores. A positive central estimate or native point margin is a deeper-review lead, not a grade. A conservative-bound failure is shown separately. Missing push semantics remain explicit and cannot establish BET clearance. Both source times and previously issued decisions are preserved. Different line, side, event, unreviewed prior receipt or missing source invalidates the comparison.

## Classification consistency corrections

The liquidity resolver now recognizes `full_game_primary_run_line` and `full_game_primary_total` as aliases of the existing governed MLB full-game NORMAL-liquidity contracts. The historical audit found 1,278 appearances whose labels missed that rule, but all were already recorded NORMAL. This is an enforcement repair, not evidence of 1,278 missed bets. Props remain outside that rule.

New unfrozen drafts resolve a combined NBA_WNBA Core label from the exact bound event's actual league, event ID and start time. No combined label is blindly treated as WNBA. The existing WNBA era rule recognizes the inventory's singular `total` only on the explicit new taxonomy marker. The repair synchronizes the existing exact-key Core copies and recomputes classification trace, never price, fair, status or stake. Ambiguous league identity or existing copy disagreement is disclosed, not guessed or concealed. Older contexts remain unchanged.

## Rules tested but not blindly removed

One-at-a-time base-rule removal yielded the following model-error-only sensitivity across the full historical cohort:

| Rule removed in development test | Error classifications changed | Newly model-error eligible |
|---|---:|---:|
| Material sportsbook dispersion | 63 | 32 |
| Calibration gap | 170 | 0 |
| Market-derived-only floor | 0 | 0 |
| Unresolved personnel | 126 | 1 |
| Thin liquidity | 3 | 0 |

These are neither new BET counts nor expected profits. Several dispersion examples were retired props or lower-liquidity markets. Floors overlap rather than adding fixed percentage penalties. This experiment does not justify discarding every caution or adding a universal smaller buffer.

Four historical recorded/evaluated trace differences were found in August 26–30 artifacts. They remain immutable historical evidence, not rewritten outcomes. The September 20 repairs do not convert them into retrospective recommendations.

The existing home-spread coordinate rule was also checked: `home_spread_points` is intentionally allowed only for home selections; away models must be converted to selected-side coordinates. The apparent away-coordinate issue is prevented by that gate and was not used as grounds for an unnecessary patch.

## Forward producer instructions

Assess BET, LEAN, WAIT and PASS separately. Failure of a BET lower-bound test, weak independent support or an uncalibrated interval does not automatically imply PASS. A LEAN still needs a reasoned favorable directional/price case and zero stake; WAIT still needs its real actionable condition. Fully rejected evidence can produce a supported PASS. Truly unfinished work remains RESEARCH_INCOMPLETE.

Do not create canned numerical adjustments from win records, recent streaks or named historical systems. Review the actual mechanism, applicability, time window, source independence and contrary evidence. Use a supported model or governed fair in its native unit where available. A raw score projection is not a cover probability, and a model brand alone is not proof of independence.

Choose the adopted forecast and uncertainty construction for evidential quality, not because they produce the largest edge. Neither a compulsory fixed-width range nor the minimum/maximum of every available model is a universal requirement. Rejected, inapplicable or duplicated model-family forecasts do not automatically define the adopted range. Preserve genuine disagreement and source-grounded sensitivity. Do not shrink an unsupported band to manufacture conservative-bound clearance; record the limitation honestly.

A qualified Pinnacle-only BET remains outside the live market-assessment route. Evaluating a separately specified sharp-market wagering method is a strategy/calibration question, not a syntax correction. The frozen existing market-method shadow may provide forward evidence; this review does not rewrite its rule or authorize wagers. The excluded autonomous results/CLV learning and personal-ledger calibration remain excluded.

## Acceptance and boundaries

Tests reproduce the old non-BET support-floor rejection, verify the forward documented non-BET path, retain BET rejection, reject missing sources and wrong quote identity, retain native-fair opportunities without creating grades, reject wrong lines/events/future evidence, repair actual-league/MLB aliases, and preserve historical semantics. Existing Core, candidate, exact-evidence and partial-publication regression suites must pass before merge.

No schedule changes, new scheduled tasks, new execution books, odds-budget changes, history rewrite, automated wagers or staking changes. This review improves decision-path fidelity; it does not establish predictive profitability. Numeric summary: `docs/audits/core14-review-2026-09-20.json`.

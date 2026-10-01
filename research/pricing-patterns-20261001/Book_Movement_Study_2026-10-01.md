# Book movement study — October 1, 2026

The graded archive does not yet establish a reliable “bait” signal or a profitable movement rule. A tempting payout alone was approximately break-even. Several patterns looked profitable early and lost money in the later historical check. Prices and outcomes cannot establish deliberate bookmaker intent.

## What was tested

Here, “bait” is a hypothesis: an unusually generous payout draws bettors to a side that subsequently underperforms. We can test the payout, market disagreement, subsequent observations, and grades. The archive has no verified customer bet shares, bookmaker exposure, trading decisions, or promotional placement, so it cannot test deliberate targeting of customers.

We reconstructed 217 archived feed snapshots, 2,922 fresh exact-market frames across 858 markets, and 2,145 comparable Bet365/DraftKings/Pinnacle frames. There were 1,190 adjacent three-book intervals no more than six hours apart. Exact event kickoff, full-game scope, side, and line must agree. Only contracts represented in the prior cleaned graded-card study are covered; this is not a census of every available sportsbook market.

A generous price lowers the selected side’s break-even probability by at least 1 percentage point relative to the other execution book. Pinnacle support means its paired proportional no-vig probability exceeds that break-even probability by at least 1 point. Pinnacle is a market reference, not known truth. A material move is at least 0.5 probability points; steady means no more than 0.1 point. Persistence requires two observations 30 minutes to six hours apart.

## Results

Each hypothesis takes its first qualifying entry per exact market, with deterministic selection based on the contemporaneous reference discrepancy and book price difference. Outcomes do not choose entries. Returns assume one hypothetical unit staked at the recorded decimal price, zero on pushes/voids, and exclude unresolved entries from the ROI denominator. These are hypothetical selections, not placed-bet performance. Hypotheses overlap and their profits must not be added.

| Hypothesis | Settled | Net units | ROI | Early ROI | Later ROI |
|---|---:|---:|---:|---:|---:|
| Generous price versus the other book | 428 | +0.35 | +0.08% | +1.02% (306) | -2.26% (122) |
| Generous price, no positive Pinnacle discrepancy | 427 | +1.57 | +0.37% | +2.35% (305) | -4.59% (122) |
| Generous price plus Pinnacle support | 36 | +2.51 | +6.97% | +13.24% (25) | -7.27% (11) |
| Any first qualifying Pinnacle discrepancy | 41 | +0.56 | +1.37% | +8.14% (29) | -15.00% (12) |
| Payout improves while both markets weaken | 222 | -17.41 | -7.84% | -12.41% (144) | +0.59% (78) |
| Book shortens the side while Pinnacle weakens it | 46 | +5.75 | +12.50% | +22.34% (29) | -4.29% (17) |
| Pinnacle moves toward the side; book stays steady | 11 | -0.88 | -8.00% | +26.50% (8) | -100.00% (3) |
| Other book moves toward the side; book stays steady | 12 | +0.07 | +0.58% | +34.11% (9) | -100.00% (3) |
| Supported generous price persists at two observations | 4 | -1.85 | -46.25% | -28.33% (3) | -100.00% (1) |

“Early” and “later” use the existing Vancouver kickoff split at September 21. The later group is a historical check, not a pristine blind forward test. Thresholds were fixed before this movement run, but the broad archive and earlier pricing study had already been inspected. No multiple-testing correction was applied.

The 428 settled generous-price entries returned +0.35 units (+0.08%). Their event-cluster bootstrap 95% ROI interval was −9.63% to +9.83%. They did not reliably underperform Pinnacle: excluding pushes, observed win rate exceeded mean reference probability by 2.04 points, with an interval of −2.62 to +6.95 points. This residual is conditional on WIN/LOSS resolution and is not an unconditional expected-value calculation.

Payouts improving while both book and Pinnacle probabilities weakened lost 7.84% overall, but the later 78 settled entries returned +0.59%. That does not validate a consistent “fade the bait” rule. Supported generous prices returned +6.97% overall but −7.27% across 11 later entries. All reported overall ROI confidence intervals cross zero; small subgroups are especially unstable.

A supported Pinnacle reversal produced no qualifying entry under these definitions. That is a coverage result, not evidence that reversals never happen.

## What looks like a book habit

| Matched interval observation | Bet365 | DraftKings |
|---|---:|---:|
| Material price-probability changes, among 1,190 matched intervals | 296 | 411 |
| Book moves materially while the other stays steady | 110 | 274 |
| Those intervals with a later comparable observation within six hours | 55 | 118 |
| Other book subsequently moves in the same direction | 18 | 46 |

DraftKings changed more often in these sampled exact-contract intervals. This is an observed archive tendency, not proof of an intrinsic trading policy or actual order of moves. The same contract can contribute several intervals, and the snapshots are unevenly spaced. “First” here means first observed in sampled data. Missing follow-up observations are not failures to follow. Precise response-time claims would exceed the resolution of this archive.

Raw spread-line change counts are misleading: Bet365 returned several lines in 1,218 spread observations and one line in only 78; DraftKings returned one line in 1,288 and several in four. We therefore do not interpret the one versus 54 recorded sole-line changes as a speed comparison. A sole returned line is not verified as the bookmaker’s main line. No point movement is converted into a probability movement without an exact paired contract.

## Later prices and the earlier MLB finding

Later quotes are the last available same-book, same-line, pre-start observation within six hours. None is a verified closing price. Of 36 supported generous entries, only 17 had such a later price; 13 of those entries paid better than the later quote. This partial price improvement did not establish profitable outcomes.

This movement study has a different entry trigger and coverage from the earlier report-based pricing study. The broad first-qualifying ≥1-point Pinnacle discrepancy produced 41 settled entries, +1.37% overall and −15.00% later, versus the earlier report-based 36-entry +15.25% result. Neither estimate supersedes the other by silently changing the rule. The earlier MLB totals lead remains a small exploratory candidate; this study adds no robust movement confirmation.

## What to track next

Keep these as research flags: generous price plus reference support; one book remaining steady after a material reference move; improving payout while the reference weakens; and persistent disagreement. Freeze the flag definitions, record every qualifying instance before its result, and judge them against same-market baseline entries. Obtain verified opening/closing prices and synchronized observations before claiming actual lead/lag. Verified public wagering shares would be needed to connect a discrepancy to customer popularity.

No new betting rule, automatic fade, stake adjustment, or production change follows from this study. For the same settled contract, the higher payout pays more on a win; calling it suspicious adds value only if an independently validated signal changes the estimated chance of winning.

## Data controls and reproduction

Execution quotes must be observed pregame and no more than 30 minutes old at the comparison frame. Pinnacle uses the project’s exact paired-market, clock, freshness, and historical scope-cutover rules (reference maximum age 75 minutes). Thus the three books are fresh enough for this study but are not guaranteed to have simultaneous quote timestamps. Unsupported identities, scope, ambiguous duplicates, suspended quotes, and the earlier study’s conflicting grades are excluded. Seventy-five archived feed commits lacked an observer file; 366 constructed execution frames lacked a qualifying exact reference.

The event-cluster bootstrap uses 5,000 resamples and seed 20261001. It groups bets from the same event, but does not eliminate dependence across dates or teams. Tests cover selected-side orientation, exact-contract later-price filtering, missing follow-up preservation, outcome-resolution treatment, and the underlying reference freshness/alternate-total contract rules.

Rebuild the prior pricing study first, then run:

```sh
node tools/research-book-movements.mjs
python tools/research-movement-patterns.py
python tools/research-movement-report.py
python tests/research-movement-patterns-test.py
node --test tests/pinnacle-exact-total-assessment.test.mjs tests/pinnacle-observation-freshness.test.mjs
```

The extractor uses the immutable feed blobs and matching observer blobs at the feed commit, rather than refreshing odds. It requires those historical Git objects. Intermediate `movement-frames.json` and `movement-entries.json` are reproducible and are not committed. The summary, examples, scripts, tests, and source manifest are retained beside this report.

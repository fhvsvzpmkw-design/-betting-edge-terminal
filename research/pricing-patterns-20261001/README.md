# Betting Edge pricing study — October 1, 2026

The history contains a promising MLB-total pricing signal. It does not yet establish a dependable profitable strategy. The primary all-market test remains statistically uncertain, and the existing prospective experiment weakened in its latest period.

## Results

Every return below is hypothetical flat one-unit risk at an archived quoted price. Pushes return zero and remain in the ROI denominator. These overlapping cohorts must not be added together.

| Cohort | Settled entries | Win / Loss / Push | Net units | ROI | Event-bootstrap 95% interval |
|---|---:|---|---:|---:|---|
| Primary: reference advantage ≥1pp, all markets | 36 | 21 / 14 / 1 | +5.49 | +15.2% | -14.1% to +44.0% |
| Exploratory subset: MLB totals, advantage ≥1pp | 15 | 11 / 3 / 1 | +7.24 | +48.3% | +4.1% to +83.1% |
| Existing prospective market experiment, all markets | 48 | 25 / 22 / 1 | +1.17 | +2.4% | -24.8% to +29.2% |
| Existing prospective experiment, MLB totals | 22 | 14 / 7 / 1 | +5.55 | +25.2% | -13.0% to +60.7% |

The primary hypothesis, split date and sensitivity thresholds were fixed before this study calculated its results. MLB totals are an exploratory subgroup found during the study. Their favorable interval is unadjusted for subgroup searching and is not a confirmatory significance claim. Small empirical bootstrap samples can miss unobserved outcomes. Dates, teams and series can have dependence beyond the event clusters.

## Chronological check

The retrospective study splits by actual Vancouver kickoff date: before September 21 for discovery, September 21–30 for the later check. Both periods are historical; the later check is not newly collected blind forward evidence.

| Cohort | Settled entries | Win / Loss / Push | Net units | ROI | Event-bootstrap 95% interval |
|---|---:|---|---:|---:|---|
| Primary, discovery | 27 | 15 / 11 / 1 | +3.09 | +11.4% | -20.8% to +43.1% |
| Primary, later check | 9 | 6 / 3 / 0 | +2.40 | +26.7% | -35.0% to +81.1% |
| MLB totals ≥1pp, discovery | 11 | 8 / 2 / 1 | +5.39 | +49.0% | +4.4% to +91.0% |
| MLB totals ≥1pp, later check | 4 | 3 / 1 / 0 | +1.85 | +46.2% | -51.2% to +97.5% |

Only four later-check games qualify for the MLB-total subgroup. That is the central limitation despite its positive result.

The already frozen prospective experiment uses any strictly positive discrepancy plus its existing information and settlement eligibility rules, and can enter at a later qualifying report. It differs from this study’s first paired-market observation rule. Its MLB-total entries returned +6.79 units on 15 games before September 25, then −1.24 units on seven games from September 25 onward. Its full cohort returned +4.01 on 29 early entries, then −2.84 on 19 settled later entries, with one later entry unresolved.

## What the books suggest

On 1,484 settled exact selections with both books available at the same archived snapshot, Bet365 returned -4.73% and DraftKings -4.99%. Bet365’s same-selection advantage was only +0.26 percentage points. Both broad samples lost. This supports comparing obtainable prices, not automatically preferring a book.

The MLB-total ≥1pp subgroup contains 11 Bet365 entries and 4 DraftKings entries. The lead is the exact price discrepancy, not a claim that one bookmaker systematically misprices every total.

Across the first paired-market cohort, any positive discrepancy produced +25.39 units on 91 settled entries. One +12-unit college-football winner materially inflated that total. Removing that largest winner leaves +13.39 on 90 entries, with an interval still spanning losses. Raising the threshold to ≥3pp did not improve the result: six entries returned −0.04 units. Neither threshold sensitivity is a tuned production strategy.

## Why PASS cards matter

The MLB-total ≥1pp subgroup was issued as 13 PASS, one LEAN and one WAIT. The returns are hypothetical and do not affect the betting ledger. Positive outcomes do not prove those rejections were mistakes: this study deliberately does not require independent fair-value support, calibrated model error, current personnel clearance or all production BET checks. Review the original rejection reasons against the price signal before considering a policy change.

## Price movement

The existing prospective experiment has 23 usable later same-book observations. Entry prices beat the later observed price in 18 of those cases. Mean entry-to-later decimal-price advantage was 4.50%. None is a verified closing price. Twenty-six experiment entries lack a usable later comparison, so this is a selected subset and cannot prove closing-line value or forecast accuracy.

## Data and method

Source index generated: `2026-10-01T10:33:24.245Z`. It contains 4,467 card appearances and 4,410 settled appearances. Data commit: `da87fc0e30203efafb613191ab24312b608cba7c`. Index SHA-256: `eee49fa5532f3b0f0d4a6fd34511171f4669db915707780edd5c64b12090390b`.

Reconstructed 4,418 exact-price card records from 173 immutable Git odds blobs. All 4,418 matched their indexed issued analysis price. The reconstruction applies the repository’s collector-observation clocks, latest-market handling, suspension checks, exact selection-key identity, exact kickoff binding and 30-minute execution-quote freshness. It excludes post-start or post-report snapshots and ambiguous duplicates.

After scope and quality exclusions, 1,965 first-observed primary selections remain, of which 1,932 are settled and 33 unresolved. The reference test uses 839 first paired exact markets. Both sides must be present at the same report, qualified complementary reference probabilities must sum to one, and the reference clock must precede the report by no more than 75 minutes.

For each exact event/kickoff/market/line, choose the side and supported book with the greatest reference probability minus executable break-even probability at its first paired reference appearance. Main hypothesis: gap ≥1 percentage point. Sensitivities: strictly positive and ≥3pp. No winner, later price or later favorable appearance can replace an entry. A spread’s line is normalized to home orientation; totals with different lines remain distinct contracts. Moneylines, integer/half-point spreads and totals only. Event, market and line identity remain exact.

Settlements come from immutable observations with `verificationState: verified`. Conflicting completed selection grades or final scores exclude the affected event. Repeated lanes do not add samples. Event-cluster bootstrap uses 5,000 resamples with seed 20261001 and preserves all markets from the same sport/event/kickoff together. It measures sampling variation, not certainty about book efficiency or data correctness.

The broad first-selection baseline returned −5.32%. It includes both sides from the report inventory and is a price/friction baseline, not the result of a sensible wagering strategy or a measurement of placed-bet performance. The card population is selected by published report coverage; unissued/unresearched inventory cannot be inferred from it.

Prices were recorded as fresh obtainable feed quotes, not verified customer fills. Pinnacle probabilities are proportional margin-adjusted references, generally conditional on no push. They are not independently established true probabilities or unconditional expected returns. The study does not infer bookmaker intent, sharp betting volume or “trap lines” from outcomes.

## Quality findings

4 exact event identities have conflicting historical final scores, including 2 exact selections with contradictory settled grades. Sixteen card appearances were excluded. These are separate grading-data follow-ups; this study does not rewrite their historical observations.

```json
{
  "selectionIds": [
    "MLB|63302985|2026-09-02T17:05:00Z|63302985|ml|home||",
    "MLB|63303197|2026-09-02T18:35:00Z|63303197|ml|away||"
  ],
  "eventKeys": [
    "MLB|63301763|2026-09-02T16:40:00Z",
    "MLB|63301961|2026-09-02T19:10:00Z",
    "MLB|63302985|2026-09-02T17:05:00Z",
    "MLB|63303197|2026-09-02T18:35:00Z"
  ]
}
```

Other card-level exclusions: 49 missing usable exact quotes, 203 unsupported/missing full-game scope, 86 outside primary market keys, six non-pregame records and six unsupported quarter-line contracts. These exclusions occur before selection deduplication.

## Next validation

Retain the existing prospective experiment. Freeze MLB full-game totals with an exact price advantage ≥1pp as a research candidate; keep both over and under eligible and use the best valid Bet365/DraftKings quote. Preserve its original entry time, price, paired reference, information clearance and exclusion reason. Collect genuinely observed later reference pairs and verified pre-start closing prices where possible. Do not use eventual grades to backfill missing pregame evidence.

Evaluate future entries under the unchanged candidate rule, reporting returns, event counts, availability, calibration diagnostics where applicable and genuine closing comparisons. Check the original PASS reasons. The study does not authorize changing Core thresholds, official statuses, staking, schedules, report production or live odds.

## Reproduce

From the research branch checkout, with the repository’s historical Git blobs available:

```bash
node tools/research-pricing-quotes.cjs
python tools/research-pricing-patterns.py
python tools/research-pricing-report.py
python tests/research-pricing-patterns-test.py
node --test tests/quote-observation.test.mjs tests/market-method-shadow.test.mjs
```

Python requires NumPy. The quote and entry JSON files are reproducible intermediate outputs. The summary and compact ≥1pp candidate sample are retained with the study.

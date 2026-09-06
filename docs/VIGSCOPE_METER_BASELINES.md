# VigScope meter baselines

Status: OPERATIONAL for report timestamps at or after **2026-09-05 11:00 America/Vancouver**.
Calculation version: **2** through September 5; **3** from `2026-09-06T00:00:00-07:00`. Calibration coefficients remain `vigscope-meter-calibration-v1`.

## Version 3 — primary-market sample

Version 3 replaces the dependency on published cards for market heat and book agreement. It derives the exact available full-game primary sides from the same coverage inventory, using the pinned coverage-authority blob and current feed. Both market sides receive equal weight. Status weights and play-to threshold bonuses are excluded from this market-wide sample; this changes sample semantics, not betting decisions or calibrated coefficients.

Heat measures absolute same-book/exact-selection price movement and current cross-book dispersion. Agreement uses only fresh identical primary selection keys at Bet365 and DraftKings. Both can be measured when there are no published cards, provided the corresponding evidence exists. Genuine unchanged prices can produce measured zero heat. A single supported book can supply a movement comparison but cannot establish cross-book agreement.

Price pressure is directional and therefore keeps a separate sample of verified BET/LEAN/WAIT references, equally weighted. A PASS does not establish a desired direction. Without a reference it is explicitly unmeasured (`NO_DIRECTIONAL_REFERENCE`), with conflicting opposing references explicitly identified. No synthetic home/over stance or artificial neutral reading is introduced. The combined graphic remains unmeasured when a required input is missing, with an explanation while the independent market readings remain visible.

Version 3 uses only archived odds baselines with exact primary identity and the same book at both endpoints, within the existing 24-hour/12-snapshot limits. Changed lines, unsupported/closed/suspended/ambiguous identities, future timestamps and stale quotes cannot be rescued from older entries. The source receipt pins the coverage authority, feed and odds index. Version 1/2 replay remains unchanged. The older empty-card display now describes the missing card sample explicitly; archived readings are never recalculated for display.

Regression: `tests/vigscope-primary-market-sample.test.mjs` covers the empty-card case, zero versus unavailable readings, source pinning, book/line/freshness integrity, conflict handling and historical compatibility. `tests/primary-report-dashboard.test.mjs` verifies visible coverage, missing-direction messages and receipt integrity.

Missed report generation must not prevent measurement when verified market data is available. This changes the evidence used by the meters; it does not change fair values, prices, recommendations, staking, the report schedule, the odds-pull budget, or the calibrated meter formulas and thresholds.

## Version 2 evidence and order

1. Current inputs come from the exact Git odds blob named by the report sidecar. Its `generatedAt` must match the report. Fresh executable quotes retain the 30-minute quote-age check at their own feed snapshot.
2. **Book agreement** uses exact Bet365/DraftKings selection pairs in that current feed. It requires no earlier report or odds snapshot.
3. **Movement** first uses the latest earlier same-day issued report for each matching selection, retaining that earlier card's bookmaker. If that comparison is unavailable, use the newest eligible archived odds snapshot with fresh exact quotes at the same bookmaker at both endpoints. Prefer the current card's book, then the established Bet365/DraftKings order. A changed selection or spread line cannot be treated as price movement.
4. Archived baselines must precede the current feed by no more than **24 hours**. A previous Vancouver calendar day is eligible within that limit. Consider at most the latest **12** distinct eligible snapshots in `data/history/odds-index.json`; entries indexed after the report time are excluded. This is a read of saved evidence and triggers no odds request.
5. Each movement comparison records its basis, bookmaker, exact selection, baseline time, prices/probabilities and source references. The report pins the odds-index blob and any prior report blob. Later index additions cannot change replay of an issued receipt.

## Partial measurements

Use the existing calibrated formulas and evidence-coverage confidence. With current agreement but no movement baseline, heat is explicitly **PARTIAL**, pressure is **UNMEASURED**, and agreement remains measured. With no usable evidence, retain an unmeasured field; do not turn missing data into a measured zero or neutral value. The combined graphic requires all three inputs to be measured. The terminal displays the comparison source counts and baseline time range.

## Publication and compatibility

`tools/vigscope-meter-telemetry.mjs` alone attaches the publisher receipt. `tools/vigscope-meter-telemetry-gate.mjs` independently reproduces it from the pinned sources, including on remote read-back. Missing or contradictory pinned source blobs fail publication; a missing earlier report is an ordinary supported condition.

Reports before the effective time retain the original calculation and exact receipts, including the recovered September 5 09:30 report. No retrospective rewrite, reprice overlay, or scheduled-task estimate may replace issued telemetry. The new behavior applies automatically to future published reports.

Regression: `tests/vigscope-meter-resilient.test.mjs` covers absent reports, new selections, mixed sources, overnight baselines, stale/future/mismatched evidence, same-book comparison, current-only agreement, immutable replay, receipt tampering and terminal handling.

# VigScope meter baselines

Status: OPERATIONAL for report timestamps at or after **2026-09-05 11:00 America/Vancouver**.
Calculation version: **2**. Calibration remains `vigscope-meter-calibration-v1`.

Missed report generation must not prevent measurement when verified market data is available. This changes the evidence used by the meters; it does not change fair values, prices, recommendations, staking, the report schedule, the odds-pull budget, or the calibrated meter formulas and thresholds.

## Evidence and order

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

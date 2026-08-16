# Betting Edge Research Library v1.8 — Candidate Freeze R2

**Date:** 2026-08-15  
**Freeze ID:** `v1.8-candidate-freeze-2026-08-15-r2`  
**State:** STAGING CANDIDATE FREEZE — NOT RUNTIME AUTHORITY  
**Active production library remains:** v1.7

## Why R2 exists

R1 remains immutable. The freeze review found several Phase-2 KEEP/KEEP_WITH_CAUTION candidates that were neither admitted nor explicitly deferred, two uncontrolled sport labels, and ambiguous wording around independent-study weighting. R2 repairs those bookkeeping/semantic issues without reopening broad discovery.

## R2 result

- Admitted logical items: **24** (**+5 vs R1**)
- Phase-2 ledger items explicitly reconciled: **23/23**
- Silent Phase-2 disappearances: **0**
- New source-registry records added vs R1: **5**
- Explicit gap items: **2**
- Direct market-calibration evidence is now tracked separately from independent mechanism research.

## Restored from Phase-2 review

- NBA individualized forecasting methodology (overlap-clustered, no extra independent vote)
- NBA third-party projection caution
- NHL rink-recording/data-quality caution
- NHL shooter/goaltender skill-adjusted xG mechanism
- NFL injury/participation/role caution

## Taxonomy correction

`NFL/NCAAF` is represented as controlled sports `NFL` + `College Football/Basketball`; `Cross-market` is normalized to `Cross-Sport`. WNBA remains the only new controlled sport extension required by v1.8.

## Evidence semantics

`independentResearchSourceEligible` means a source may be counted as distinct research after deduplication. It does **not** mean the source is an independent market-mispricing signal. `directMarketCalibrationEvidenceEligible` is tracked separately, and no research item can create a bet, executable price, stake, or override current market gates.

## Hard boundary

No production manifest, live History Fit library, runner, workflow prompt, production contract, or scheduled report is changed by R2.

## Next gate

Review R2 and its complete reconciliation report. Only after that review should the merged v1.8 candidate library be materialized and tested.

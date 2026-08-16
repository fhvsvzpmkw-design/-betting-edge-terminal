# Betting Edge Research Library v1.8 — SmartStake MLB Full Audit Results

**State:** STAGING AUDIT EXECUTED — NOT RUNTIME AUTHORITY  
**Active production library remains:** v1.7  
**Dataset revision:** `049dd4caeb562010a5806207c413e9f9bc012825`  
**Executed UTC:** 2026-08-16T03:17:03.558060+00:00

## Coverage

- Raw quote rows: **621,391,637**
- Games: **1,168**
- Players: **933**
- Markets: **6**
- Books/sources: **75**
- Graded quote rows: **535,183,883**
- Null-result quote rows: **86,207,754**

## Integrity checks

- Over grade mismatches: **0**
- Under grade mismatches: **0**
- Graded pushes: **0**
- Invalid decimal-odds rows: **0**
- At/after scheduled-start rows: **0**
- Exact within-file duplicate rows: **0**

Exact duplicate checking was exhaustive inside every parquet file. The calibration surface globally regroups every file by exact selection before pairing, but a single global 621M-row minute-key hash aggregation was not required on the hosted runner.

## Market calibration surface

The JSON result contains exact-line pairing, market-information-only main-line selection, proportional no-vig probabilities, Brier/log loss, reliability bins, and cutoff sensitivity at 0/5/15/60 minutes before first pitch.

These remain **descriptive research-QA results**, not a bookmaker ranking or betting edge. Source-type classification, forward holdout testing, and provenance limitations must be resolved before a direct-market finding enters canonical v1.8.

## Promotion status

**NOT READY FOR PROMOTION.** Production v1.7 remains unchanged.

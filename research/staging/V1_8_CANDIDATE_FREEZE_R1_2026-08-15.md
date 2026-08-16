# Betting Edge Research Library v1.8 — Candidate Freeze R1

**Date:** 2026-08-15  
**Freeze ID:** `v1.8-candidate-freeze-2026-08-15-r1`  
**State:** STAGING CANDIDATE FREEZE — NOT RUNTIME AUTHORITY  
**Active production library remains:** v1.7

## Frozen scope

- Admitted v1.8 logical delta items: **19**
- Explicit gap items: **2**
- Independent-study-weight-eligible delta items: **14**
- Deferred/hold logical items: **4**
- New source-registry records: **22**
- Source correction records: **1**
- New v1.8 evidence clusters: **9**

## What this freeze means

Discovery is closed for v1.8 except a blocking citation/provenance correction or replication issue. New interesting research that is not required to fix the frozen build should move to v1.9 rather than silently changing this candidate set.

The freeze incorporates the completed MLB direct-market audit and forward holdout. It preserves the conclusion that no universal MLB prop recalibration survived across total bases, hits, home runs and pitcher strikeouts, while walks and RBIs retain only a limited C-tier mixed signal.

Strong single studies that carried provisional A labels during discovery are frozen conservatively at B because the v1.7 taxonomy reserves A for replicated/consistent evidence bodies.

## Files

- `research/staging/V1_8_CANDIDATE_FREEZE_R1_2026-08-15.json`
- `research/staging/V1_8_CANDIDATE_SOURCE_REGISTRY_DELTA_R1_2026-08-15.json`
- `research/staging/V1_8_CANDIDATE_EVIDENCE_CLUSTERS_R1_2026-08-15.json`
- `research/staging/V1_8_CANDIDATE_FREEZE_CHECKSUMS_R1_2026-08-15.json`

## Hard boundary

Nothing here is linked to `research/manifest.json`, scheduled report prompts, the runner, odds workflows, the production contract, or live History Fit. Production v1.7 remains authoritative until retrieval tests, R3 boundary proof, checksum verification, and explicit promotion approval are complete.

## Next gate

Materialize a merged v1.8 candidate library and corrected source registry from the immutable v1.7 base plus this frozen delta, then run the broad cross-sport History Fit retrieval suite.

# Betting Edge Research Library v1.8 — Candidate Freeze R2 Review

**Date:** 2026-08-15  
**Freeze ID:** `v1.8-candidate-freeze-2026-08-15-r2`  
**Review result:** **PASS — READY FOR TEST-DEFINITION GATE**  
**Runtime authority:** none  
**Active production library remains:** v1.7

## Review scope

This review checks Candidate Freeze R2 for the defects found in R1: silent Phase-2 omissions, uncontrolled sport labels, ambiguous evidence-weight semantics, incomplete source accounting, and accidental production linkage.

## Findings

### 1. Phase-2 accounting — PASS

- R2 contains **24 admitted logical items**, up from 19 in R1.
- All **23/23** Phase-2 candidate-ledger records have an explicit disposition.
- Silent Phase-2 disappearances: **0**.
- The five R1 omissions are restored: NBA individualized forecasting, NBA projection-provider caution, NHL rink-recording caution, NHL shooter/goalie xG mechanism, and NFL injury/participation caution.
- Infrastructure-only and still-unaudited datasets remain explicitly outside predictive/canonical evidence rather than disappearing silently.

### 2. Deduplication / overlap handling — PASS

- The two NFL receiving mechanism studies remain represented by one logical receiving cluster while retaining separate source provenance.
- The 2025 Papageorgiou/Sarlis/Tjortjis NBA paper is retained but overlap-clustered with the authors' 2024 forecasting work and does not receive an extra independent-weight vote.
- The SmartStake MLB raw dataset candidate is represented by the completed audit-derived findings rather than being counted as an additional independent source of evidence.
- MLB walks/RBIs remain a cautious derived signal and are not counted as an additional independent-study vote from the same dataset.

### 3. Taxonomy normalization — PASS

- `NFL/NCAAF` is normalized to controlled sports `NFL` plus `College Football/Basketball`.
- `Cross-market` is normalized to `Cross-Sport`.
- WNBA is the only new controlled sport extension required for v1.8.
- No uncontrolled sport labels remain in the R2 admitted set.

### 4. Evidence semantics — PASS

R2 separates two concepts that were ambiguous in R1:

- `independentResearchSourceEligible`: distinct research-source eligibility after deduplication;
- `directMarketCalibrationEvidenceEligible`: evidence eligible to support a scoped historical market-calibration statement.

Mechanism/forecastability research may support or caution History Fit without becoming an independent sportsbook-mispricing vote. Every R2 item explicitly forbids creating a bet/executable price or overriding current market gates.

### 5. Source registry — PASS

- R2 source-registry delta contains **27 new-source records**: 22 admitted sources and 5 deferred/hold sources.
- Five source records were restored with the five R2 logical additions.
- The Shank 2022 DOI correction remains a v1.8 registry correction with provenance; v1.7 is not rewritten.
- Walsh/Joshi remains on hold pending corrigendum reconciliation; this is not a blocker for the rest of v1.8.

### 6. Evidence clusters — PASS

R2 contains 10 v1.8 delta clusters. The restored items are linked into the player-prop directness boundary and relevant NBA/WNBA, NHL and NFL clusters. A dedicated projection-signal caution cluster now makes the mechanism-versus-market distinction explicit.

### 7. Integrity / immutability — PASS

SHA-256 checksums were generated for the R2 freeze, source-registry delta, evidence-cluster file, and R1→R2 reconciliation file. R1 remains immutable. No production manifest, live Research Library, History Fit runtime, runner, production contract, report prompt, or scheduled workflow was changed by R2.

## Non-blocking holds carried forward

- Walsh/Joshi corrected quantitative results remain held.
- NHL public historical SOG-odds data remain deferred pending provenance audit.
- SmartStake lineup-reaction data remain deferred as adjacent infrastructure rather than independent evidence.
- WNBA and broad NFL regulated player-prop closing calibration remain explicit gaps.

These are correctly represented as holds/gaps and do not require reopening v1.8 discovery.

## Decision

**Candidate Freeze R2 passes the freeze-review checkpoint.**

Do not promote or merge into production yet. The next gate is to define the representative History Fit retrieval/boundary test cases *before* materializing the merged v1.8 candidate library. Once the expected test behavior is frozen, the merged candidate can be assembled mechanically from immutable v1.7 plus R2 and tested against those predeclared cases.

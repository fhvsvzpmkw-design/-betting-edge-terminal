# Betting Edge Research Library v1.8 — History Fit Test Definition R1 Review

**Date:** 2026-08-15  
**Test Suite:** `v1.8-history-fit-predeclared-r1-2026-08-15`  
**Target Freeze:** `v1.8-candidate-freeze-2026-08-15-r2`  
**Review result:** **PASS — TEST DEFINITIONS FROZEN BEFORE MERGED CANDIDATE**  
**Runtime authority:** none  
**Active production library remains:** v1.7

## Why this checkpoint exists

The expected History Fit behavior is now written before a merged v1.8 candidate library exists. This prevents retrieval cases, grade bands or boundary expectations from being tailored after seeing v1.8 outputs.

## Frozen narrative coverage

The suite contains **15 representative retrieval cases** spanning:

- MLB pitcher strikeouts, home runs/contact quality, and batting walks;
- NHL shots on goal, goalie saves, and anytime goals;
- NFL receiving props, key-number movement, and preseason anchoring;
- NBA assists/stat-specific props and external projection-provider caution;
- WNBA direct player-prop calibration gap;
- soccer 1X2 versus Asian-handicap market structure;
- NFL parlay/SGP margin structure;
- cross-sport line-movement interpretation.

The cases explicitly predeclare allowable grade bands, required concepts and forbidden claims. They are not candidate-selection scripts and do not prescribe current fair value, bet status, stake or executable price.

## Boundary coverage

The suite contains **9 hard-boundary cases** covering:

1. source/cluster deduplication;
2. mechanism evidence masquerading as sportsbook mispricing evidence;
3. NBA-to-WNBA direct-market transport;
4. research gaps being misread as negative evidence;
5. research attempts to change fair value/status/play-to/model error/stake;
6. research attempts to create a bet or executable price;
7. research-library unavailability;
8. wrong-sport/wrong-market retrieval ordering;
9. silent blending of same-day movement or personal-ledger performance into History Fit.

## Validation result

Automated definition validation passed with:

- R2 admitted items: **24**;
- representative retrieval cases: **15**;
- boundary cases: **9**;
- R2 items directly referenced by narrative cases: **22**;
- missing referenced item IDs: **0**;
- duplicate case IDs: **0**;
- hard-boundary mismatches with `research/history-fit-policy.json`: **0**;
- freeze-hash mismatch: **0**;
- cluster-hash mismatch: **0**;
- validation warnings: **0**.

Two admitted R2 items are intentionally not forced into a narrative case solely to achieve numeric coverage: the older NFL totals-momentum behavior item and the tennis replication/data-quality guardrail. Both remain available through their evidence clusters. The merged-candidate validation must additionally include a structural inventory check proving **all 24 admitted items** are present, source-resolvable and retrievable by exact sport/market/role metadata even when a narrative test does not name them.

## Decision

The predeclared History Fit test-definition gate passes.

The next permitted step is to materialize the merged **staging-only** v1.8 candidate from immutable v1.7 + Candidate Freeze R2, while keeping `research/manifest.json` and production History Fit on v1.7. After materialization, run these exact frozen narrative/boundary cases plus the 24/24 structural inventory check. Do not alter the test definitions to accommodate candidate outputs.

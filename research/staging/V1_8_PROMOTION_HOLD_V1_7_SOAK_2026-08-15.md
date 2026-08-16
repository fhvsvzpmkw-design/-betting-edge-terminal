# Betting Edge Research Library — v1.8 Promotion Hold / v1.7 Soak Plan

**Date:** 2026-08-15  
**State:** PROMOTION HOLD — v1.8 NOT PRODUCTION  
**Active production library:** v1.7  
**Promotion candidate:** `v1.8-promotion-candidate-r1-2026-08-15`

## Decision

Research Library v1.8 has completed candidate freeze, merged-candidate construction, structural validation, narrative History Fit testing, hard-boundary testing and promotion-candidate packaging. It is **not approved for production promotion yet**.

The reason is operational evidence, not a failed v1.8 test. Production v1.7 has not yet accumulated enough normal live-report exposure to establish a reliable baseline for comparison. Promoting v1.8 immediately would make it difficult to distinguish genuine improvement from ordinary run-to-run variation.

## Required v1.7 soak period

Keep v1.7 live and read-only while observing normal Betting Edge production runs. At minimum, complete one full five-lane production day before reopening the promotion decision; additional days are preferred when they provide materially different sports/market situations.

During the soak, review v1.7 History Fit for:

- relevance of retrieved evidence;
- grade reasonableness;
- concise explanation quality;
- correct use of NR for true evidence gaps;
- deduplication and overlap handling;
- correct separation of mechanism evidence from sportsbook market-calibration evidence;
- preservation of candidate-first behavior and all R3 hard boundaries.

## v1.8 shadow comparison

The frozen v1.8 candidate may be evaluated in **shadow only** against the same real candidates seen by v1.7. Shadow results must not alter the issued report, fair value, play-to, status, model error, stake, executable price or production manifest.

For each useful real candidate, compare:

1. v1.7 live History Fit result;
2. v1.8 shadow History Fit result;
3. retrieval relevance;
4. grade calibration;
5. explanation clarity;
6. whether v1.8 materially improves the result without weakening boundaries.

No automatic promotion threshold is implied by a small number of favorable comparisons.

## Promotion gate

Do not promote v1.8 until all of the following are true:

- v1.7 has completed the agreed soak period;
- representative live History Fit behavior has been reviewed;
- v1.8 shadow comparisons show credible improvement or clear added value;
- no boundary regression is observed;
- explicit promotion approval is given.

## Production boundary

This checkpoint changes documentation only. It does **not** modify:

- `research/manifest.json`;
- `research/research-library.json`;
- `research/source-registry.json`;
- `research/taxonomy.json`;
- production contract v0.9;
- runner or scheduled report prompts.

Production Research Library remains v1.7 until a later explicit promotion step.

# Betting Edge Research Library v1.8 — Narrative Test Review R1

**Build:** `v1.8-merged-candidate-r1-2026-08-15`  
**Frozen test suite:** `v1.8-history-fit-predeclared-r1-2026-08-15`  
**Result:** **PASS**  
**Runtime authority:** none  
**Active production library remains:** v1.7

## Result

All **15/15** predeclared History Fit narrative cases passed their allowed grade bands, required concepts and forbidden-claim checks. All **9/9** hard-boundary cases also passed.

Representative grades were deliberately conservative:

- MLB pitcher strikeouts: **B-** — matchup/workload mechanism supported, no universal price correction.
- MLB home run/contact-quality case: **C+** — mechanism useful, not sportsbook calibration.
- MLB batting walks: **C** — limited June holdout signal, partial-season/single-dataset caution.
- NHL SOG: **C+** — role/context forecastability, no direct closing calibration.
- NHL goalie hot-hand case: **D**.
- NHL anytime goal: **C+** — shooter/goalie xG mechanism only.
- NFL receiving: **C** — strong mechanism with direct regulated-prop calibration gap.
- NFL move across 3: **D** — demand discontinuity/order flow does not prove sharp information.
- NFL preseason anchoring: **D**.
- NBA assists/stat-specific case: **B-**.
- NBA external-projection reliance: **D**.
- WNBA direct prop calibration: **NR**.
- Soccer 1X2 vs Asian handicap structure: **B**.
- NFL parlay/SGP structure: **D**.
- Cross-sport same-direction movement: **C-**.

## Boundary proof

The review preserved all R3 hard boundaries: no research-created wager, executable price, fair-value rewrite, play-to rewrite, status rewrite, model-error rewrite or stake rewrite. Mechanism studies never became market-mispricing votes. Gaps produced NR rather than negative predictions. NBA evidence was not transported into direct WNBA price confidence. Same-day movement and personal-ledger performance stayed outside the historical grade.

## Deduplication proof

Two specific overlap cases were exercised deliberately. The two SmartStake-derived MLB logical findings count as one underlying direct-market source, and the overlapping Papageorgiou NBA forecasting lineage does not create two independent market votes.

## Diagnostic observation

The generic structural-test scorer can still list additional low-value fallback candidates after the exact required evidence. This is **non-blocking** because that scorer is test-harness code, not the production History Fit retrieval mechanism. The narrative review applied the already-frozen `smallest relevant set` rule and discarded those extras. The diagnostic scorer must not be wired into production retrieval.

## Decision

**Merged Candidate R1 passes the frozen History Fit retrieval and hard-boundary test gate.**

The next gate is a final candidate-integrity/checksum review: pin the merged artifacts plus these test results, verify production files are still unchanged, and produce the promotion package. That package still must not change `research/manifest.json` until there is explicit promotion approval.

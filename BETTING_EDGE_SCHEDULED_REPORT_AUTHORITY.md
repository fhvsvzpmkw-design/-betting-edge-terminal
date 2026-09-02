# Betting Edge Scheduled Report Authority

**Status:** OPERATIONAL  
**Authority version:** 1.0  
**Effective:** 2026-09-02  
**Repository:** `fhvsvzpmkw-design/-betting-edge-terminal`  
**Branch:** `main`

This file is the shared operating instruction for all standard Betting Edge scheduled report tasks. A task supplies only its expected Vancouver report time. All five standard lanes must inherit this file rather than carrying independent market-coverage logic.

## 1. Schedule profile gate — mandatory first step

Given `EXPECTED_REPORT_TIME` in America/Vancouver:

1. Read `BETTING_EDGE_SCHEDULE_PROFILE_ADDENDUM.md`, `data/schedule-profiles.json` and `data/schedule-state.json` from authoritative `main`.
2. Resolve the active Vancouver schedule profile and exact slot whose `reportTime` equals `EXPECTED_REPORT_TIME`.
3. Retain profile id/name, canonicalSlot, slot, pulseTime, reportTime, label and featuredVigScope.
4. If no exact active slot matches, do not notify, handicap, stage a candidate or write History.

The schedule profile controls timing only. It never excludes a major sport or market from otherwise valid evaluation.

## 2. Core 1.4 production preflight

Require:
- `BETTING_EDGE_CONTRACT.md` Contract v1.0 / OPERATIONAL;
- `core/core-v1.4-production.json` coreVersion 1.4 / OPERATIONAL;
- current `core/core-handicap-framework-v1.4.json`;
- Research Library v1.8 and `research/manifest.json`;
- current `core/walters-intelligence-interface-v1.4.json` and `core/walters-authority-v1.4.json`;
- current `core/pinnacle-sharp-benchmark-v1.4.json`;
- `BETTING_EDGE_PERSONNEL_SWEEP.md`;
- `data/major-sport-market-coverage-v1.json` and `BETTING_EDGE_MAJOR_SPORT_MARKET_COVERAGE.md`.

Retain exact current blob SHAs required by the production report/sidecar contract. Verify the production manifest sharp-market benchmark block is OPERATIONAL, its pinned policy id/blob matches the current Pinnacle policy, its authority is `OFFICIAL_NON_EXECUTABLE_SHARP_BENCHMARK`, and `executionAuthority=false`. Resolve current Walters mode.

Require the market-coverage authority to have schema 1, authorityId `major-sport-market-coverage-v1` and state `OPERATIONAL`.

Any authority conflict is `PREFLIGHT BLOCK — ANALYSIS NOT STARTED`.

## 3. Bind the exact odds snapshot

Bind the exact `data/live-odds.json` snapshot for this lane. Enforce all Contract gates, including:
- maximum 75-minute feed freshness;
- maximum 30-minute executable quote age using the Contract's feed-generated-at measurement rule;
- scheduleMeta compatibility with the resolved active profile/slot;
- exact event, market, line, side and selection identity;
- Bet365 and DraftKings as supported executable books.

Do not pull replacement odds merely because a market or candidate is unattractive.

## 4. Major-sport market coverage — evaluate first, select cards second

Apply `data/major-sport-market-coverage-v1.json` exactly.

For every in-scope game in MLB, NHL, NBA/WNBA, NFL, NCAAF and CFL, evaluate every fresh supported required primary selection before recommendation-card selection:
- MLB: both moneyline sides, both sides of the primary run line, primary total over and under;
- NHL: both moneyline sides, both sides of the primary puck line, primary total over and under;
- NBA/WNBA: both moneyline sides, both sides of the primary spread, primary total over and under;
- NFL/NCAAF/CFL: both moneyline sides, both sides of the primary spread, primary total over and under.

Build one internally coherent fair for each exact primary market, then grade both opposing selections against their own exact executable prices. Do not manufacture separate contradictory fairs merely to force both sides into the process.

Never preselect an underdog, favorite, home team, away team, over or under as the only candidate side. One market never substitutes for another. One league never substitutes for another.

If an expected primary market is missing, stale, identity-unsafe or otherwise unusable, retain an explicit availability limitation rather than silently skipping it.

### Props

Props are part of the major-sport sweep. Inspect fresh exact markets in `live-odds.events` first; `deepMarkets` and `baseballProps` are supplemental discovery collections and are not the sole evidence of prop availability.

Enumerate and screen all fresh exact supported player props returned by the bound feed for in-scope MLB, NHL, NBA/WNBA, NFL, NCAAF and CFL games. Examples include pitcher strikeouts/hits/total bases/home runs/RBI; NHL shots/goals/assists/points/goalie saves; NBA/WNBA points/rebounds/assists/threes; and football passing/rushing/receiving yards, receptions and touchdowns.

Broad prop screening happens before card selection. Maximum-depth matchup/personnel research is then concentrated on serious prop candidates and props whose apparent value materially depends on unresolved participation/role assumptions. Every actionable prop must satisfy Contract invariant 23 exact player-prop identity.

League/book prop absence is an availability result; never substitute another player, event or league.

## 5. Pinnacle official sharp benchmark

Read the current production manifest sharp-market block, its pinned Pinnacle policy and `data/oddspapi-observer.json` when present.

Pinnacle/OddsPapi is an official **non-executable** sharp benchmark only. Use only status=ok observations with exact primaryMatch and exact event/market/selection identity, active unsuspended market/quotes, mainLine=true where applicable, complete pairing and policy-compliant freshness. Use the observer's deterministic paired no-vig fields; do not hand-create a substitute benchmark.

A QUALIFIED benchmark may confirm alignment, expose conflict or support caution/uncertainty where Core independently permits it. It may not replace Bet365/DraftKings, originate a BET by itself, set stake, directly overwrite independent Core fair, directly move playTo/status, or bypass any gate.

Unavailable/stale/suspended/unmatched/incomplete Pinnacle is `PINNACLE_BENCHMARK_UNAVAILABLE` and does not block the report.

## 6. Research and current fair-value process

Run Stage 1 broad current-information research before the provisional current handicap/fair-value screen. Run mandatory Stage 2 personnel depth and explicit re-handicap where material, including the Contract's official-source-first and 3-to-5 credible fallback-source completion rules.

Personnel information may create, remove or materially change value. It must not be treated only as a post-value confirmation check.

`WAIT` requires a current independent signal plus plausible actionability; book/market disagreement alone is not sufficient. Zero BETs is valid.

## 7. Core assessment and pre-freeze trace audit

For every recommendation, build `coreAssessment` only from current controlled schema/framework values. Never invent enum labels.

Automatically derive every applicable graduatedResearchId and recompute `modelErrorState`, `betEligibleByModelError`, `effects`, `appliedRules` and `reasons` from the current Core 1.4 framework. Every matching base/graduated rule and reason must appear, even when another rule already establishes the same or higher error floor.

After every recommendation context is finalized and **before freeze**, perform the complete deterministic Core trace audit and require exact equality/set equality between recomputed and stored derived fields. Before freeze only, correct deterministic derived trace fields from the unchanged finalized context and rerun the audit. Do not alter analytical context merely to make the trace pass.

Do not freeze or stage until the complete recommendation set passes. Once frozen/staged, never mutate, repair or re-stage that candidate merely to satisfy publication.

## 8. Walters engine

For eligible NFL spread/moneyline use the current operational Walters interface/authority. In `BET_AUTHORITY`, AVAILABLE/current/arithmetic-verified Walters work may originate a candidate or contribute an independent fair, but it must still pass all Core, identity, freshness, personnel, price-quality, playTo, exposure and staking gates.

Walters cannot fabricate price or stake. Include `waltersEvidence` on every recommendation. Markets/leagues not eligible under the controlled Walters interface use `NOT_APPLICABLE`. Research History Fit remains read-only and cannot create a BET or move fair.

## 9. Recommendation-card selection and delivery

Only after the complete major-sport market sweep and serious-candidate research are finished may the report select display cards.

Resolve `data/preferences.json` module `report_card_target`. The current target of nine is **soft**, not a hard ceiling. Fewer cards are valid when the board is thin. A qualifying/tracked/actionable BET, LEAN or WAIT may overflow the target and may not be discarded merely to keep nine cards. PASS cards may be curated after complete evaluation.

Build the frozen Core 1.4 report for VigScope UI v1.5 with fresh Vancouver `run.ts`, exact `feedGeneratedAt`, current bankroll, correct risk/counts/summary, and no filler. Preserve exact `rec.feed` identity, fair/playTo/status/stake consistency, personnelRequired/personnelEvidence, WAIT qualification, coreAssessment and waltersEvidence.

Build the matching schema-3 sidecar with all provenance and Pinnacle information required by the current production contract/publisher. When a recommendation has exact QUALIFIED Pinnacle, preserve the current structured benchmark object and keep executable price separate. When unavailable, record `PINNACLE_BENCHMARK_UNAVAILABLE` rather than inventing a comparison.

## 10. Publisher ownership — fail closed

The scheduled task is a **candidate producer only**.

Never directly create, update, delete, repair or index:
- `data/history/runs/**`;
- `data/history/research-fit/**`;
- `run-history.json`.

After the complete report and schema-3 sidecar pass all pre-freeze gates, update only `data/history/staging/report-bundle.json` with the current schema-1 READY bundle using candidateId `<report.ts>|<canonicalSlot>` and the exact frozen report/sidecar.

The repository-controlled `.github/workflows/report-history-staged.yml` owns clean-history preflight, Core trace validation, Core validation, official Pinnacle provenance/authority validation, selection continuity, non-spread availability, spread lineage, atomic durable publication and remote read-back.

Inspect the workflow run for the staging commit/head SHA. Never bypass publication with direct History writes.

If publication fails: `PUBLICATION BLOCKED — CANDIDATE NOT STORED` plus the failing gate, with no short link.

If publication has not completed by the task's end: `PUBLICATION PENDING — CANDIDATE STAGED`; do not claim storage/read-back success or release a short link.

Only after workflow SUCCESS, re-read `run-history.json` and the exact indexed report/sidecar from authoritative main. Build user-facing counts, named selections, risk and material-change summary only from that durable read-back artifact. Then provide the deterministic VigScope v1.5 short link labeled with the resolved report time.

# Betting Edge Scheduled Report Authority

**Status:** OPERATIONAL  
**Authority version:** 1.1
**Effective:** 2026-09-02  
**Validation clarification:** 2026-09-05
**Primary-market scope amendment:** 2026-09-05 13:00 America/Vancouver
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

### Player props — PAUSED_BY_SCOPE

For report timestamps at or after `2026-09-05T13:00:00-07:00`, resolve `reportScope` in `data/major-sport-market-coverage-v1.json`. The active scope is `PRIMARY_FULL_GAME_ONLY`: full-game moneylines, primary spreads/run lines/puck lines and game totals, across MLB, NHL, NBA/WNBA, NFL, NCAAF and CFL.

Do not screen props, estimate prop fairs, perform prop-specific matchup/personnel research, or issue new/carried player-prop BET, LEAN, WAIT or PASS cards. Existing prop lineages are paused by scope rather than converted into analytical PASS decisions. Retain the normal Stage 1 and Stage 2 personnel work for active primary-market candidates.

The shared odds feed may still contain props in `live-odds.events`, `deepMarkets` or `baseballProps`. The coverage validator counts fresh returned exact keys as inventory only; it does not require prop analysis. In every sport row set `props.state=PAUSED_BY_SCOPE`, `screened=0`, `seriousDeepReviewed=0` and `excludedByScope=returned`. Preserve the exact returned inventory count. Copy `reportScope.id`, `effectiveFrom` and `playerProps` into `coverageAudit.scope`; include `totals.propsExcludedByScope=totals.propsReturned`.

State “Player-prop analysis paused; full-game primary markets covered” in the report summary, subject to the actual primary availability limitations. Never claim paused props were screened, unavailable or rejected on value. Future prop categories require individual validation and an explicit scope amendment; `enabledPropMarkets` is currently empty. Archived reports and their grading remain governed by their original scope and exact identities.

### Full-game total movement across reports

For report timestamps at or after `2026-09-05T13:30:00-07:00`, apply Contract section 6.1a across MLB, NHL, NBA/WNBA, NFL, NCAAF and CFL. Read the latest same-day archived total for each event and Over/Under side. Preserve unstarted tracked BET/LEAN/WAIT candidates as current decisions; PASS cards may be curated. Reconcile the current primary total even if the old exact line still survives as an alternate row. A changed number is a new current selection with independent requalification.

Use the bound snapshot, the coverage gate's primary-line resolver, and the normal feed/quote clocks. One fresh supported book can be sufficient. Preserve book-specific differences with `CONFLICTING SIGNALS` and each book's line/price; never invent a consensus total. A lower total helps a prospective Over and a higher total helps a prospective Under. Record line movement and odds movement separately in `rec.move`, with the prior/current totals and odds, using the Contract labels. Reassess current fair, uncertainty, playTo and decision; information-driven fair changes remain distinct from sportsbook movement. Keep the exact original selection and decision unchanged in History.

Before freeze run `node tools/total-lineage.mjs audit --report <report.json> --sidecar <sidecar.json>` using the exact bound feed (or `--feed <snapshot.json>`). Resolve any mismatch from the actual evidence. The check performs no new odds requests or analytical writes. If the current total cannot be verified, preserve the tracked candidate as an explicit zero-stake unavailable/unverified decision rather than silently dropping it or repricing the original ticket at a different number.

### Primary spreads, run lines and puck lines across reports

For report timestamps at or after `2026-09-05T14:00:00-07:00`, apply Contract section 6.1b to MLB run lines, NHL puck lines, and NBA/WNBA/NFL/NCAAF/CFL spreads. This is the forward replacement for the older disappearance-only spread check. Read the latest same-day exact event/team decision, follow the current primary handicap even when the old line survives as an alternate, and compare price changes even when the handicap is unchanged.

Use the exact provider selectionKey and hdp orientation: home displays raw hdp; away displays its negative. Archived cards with no separate hdp still qualify for tracking when the exact selectionKey supplies it. Show prior/current signed handicaps and odds in rec.move with separate LINE MOVED IN FAVOR/AGAINST/LINE UNCHANGED and PRICE IMPROVED/WORSENED/UNCHANGED/COMPARISON UNAVAILABLE labels as defined in the Contract. Preserve book-specific disagreement and verify the selected book's exact line/price. One fresh supported book remains sufficient for quote availability under the normal Core gates.

Reassess the current fair, uncertainty, playTo and decision; keep original selections immutable. Unstarted tracked BET/LEAN/WAIT candidates must receive a current decision or explicit zero-stake unavailable/unverified resolution. Latest PASS cards may be curated. Before freeze run `node tools/spread-lineage.mjs audit --report <report.json> --sidecar <sidecar.json>` with the exact bound feed (or `--feed <snapshot.json>`), as well as the existing totals check. This shared instruction applies to all five Betting Edge report tasks; their schedules and paused-prop scope continue unchanged.

## 5. Pinnacle official sharp benchmark

Read the current production manifest sharp-market block, its pinned Pinnacle policy and `data/oddspapi-observer.json` when present.

Pinnacle/OddsPapi is an official **non-executable** sharp benchmark only. Use only status=ok observations with exact primaryMatch and exact event/market/selection identity, active unsuspended market/quotes, mainLine=true where applicable, complete pairing and policy-compliant freshness. Use the observer's deterministic paired no-vig fields; do not hand-create a substitute benchmark.

A QUALIFIED benchmark may confirm alignment, expose conflict or support caution/uncertainty where Core independently permits it. It may not replace Bet365/DraftKings, originate a BET by itself, set stake, directly overwrite independent Core fair, directly move playTo/status, or bypass any gate.

Unavailable/stale/suspended/unmatched/incomplete Pinnacle is `PINNACLE_BENCHMARK_UNAVAILABLE` and does not block the report.

## 6. Research and current fair-value process

Run Stage 1 broad current-information research before the provisional current handicap/fair-value screen. Run mandatory Stage 2 personnel depth and explicit re-handicap where material, including the Contract's official-source-first and 3-to-5 credible fallback-source completion rules.

For every personnel-dependent serious candidate that still has a material unresolved dependency at the end of Stage 2, perform one **final authoritative-source re-check before assigning `BET`, `LEAN`, `WAIT`, or `PASS`**. Use the best authoritative source appropriate to that sport and dependency; the authoritative source may legitimately still say `TBD`, `unconfirmed`, `questionable`, `lineup not posted`, inactive list not released, or equivalent. Record the closing check in the existing `personnelEvidence.officialSources` array with `origin`, `url`, `asOf`, a dependency-specific `fact`, and `finalRecheck: true`. Do not invent a universal sport clock for this closing check. Existing sport-specific timing windows remain research-urgency and fallback-depth guidance. If the authoritative source genuinely cannot be reached or does not exist, record that explicitly in the existing `sourceShortfall` and preserve an appropriately uncertain personnel state rather than fabricating a check. A single event-level closing check may support multiple recommendations when it genuinely addresses the same exact dependency.

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

### Walters QB production read-back

Before assessing any NFL spread or moneyline, resolve the active Graham week from `data/walters/nfl/active-week.json` and read the exact active current-numbers board, `data/walters/nfl/qb-production/production-contract-v1.json`, and `data/walters/nfl/qb-production-current.json`. Require QB production `state=OPERATIONAL_SCOPED`, authority token `APPROVED_WALTERS_QB_PERFORMANCE`, `productionAuthority=true`, `grahamWritesAllowed=true`, and `marketViewed=false`.

For a game whose two team bindings are currently resolved, require exactly one matching `QB_PERFORMANCE_PRODUCTION` adjustment on the active board, verify that its home-spread points equal away-team QB delta minus home-team QB delta, and verify the board's exact and displayed fair decomposition before using the Graham fair. Use the durable current board result; never rebuild the QB calculation from memory or market prices. If either team is currently fail closed, record the QB layer as unavailable for that game and do not let Walters originate the candidate; an otherwise valid independent Core review may continue under its own controls. Atlanta remains permanently excluded from routine QB production scope.

The QB layer has no direct BET, status, stake, or gate-bypass authority. The first durably published report containing an NFL evaluation while `postActivationCanary.state=PENDING` is the candidate for `FIRST_NFL_BEARING_BETTING_EDGE_READBACK`. After publication, report its exact history paths and whether each NFL Walters fair matched the same active-board QB production state so the governed canary can be closed. The scheduled report task must not directly edit the QB production manifest, rewrite issued History, or roll back a Graham board.

## 9. Recommendation-card selection and delivery

Only after the complete major-sport market sweep and serious-candidate research are finished may the report select display cards.

Resolve `data/preferences.json` module `report_card_target`. The repository-selected `report_card_target.current` value is **soft**, not a hard ceiling. Fewer cards are valid when the board is thin. An in-scope qualifying/tracked/actionable BET, LEAN or WAIT may overflow the target and may not be discarded merely to enforce the soft target. PASS cards may be curated after complete evaluation.

Build the frozen Core 1.4 report for VigScope UI v1.5 with fresh Vancouver `run.ts`, exact `feedGeneratedAt`, current bankroll, correct risk/counts/summary, and no filler. Preserve exact `rec.feed` identity, fair/playTo/status/stake consistency, personnelRequired/personnelEvidence, WAIT qualification, coreAssessment and waltersEvidence.

Build the matching schema-3 sidecar with all provenance and Pinnacle information required by the current production contract/publisher. When a recommendation has exact QUALIFIED Pinnacle, preserve the current structured benchmark object and keep executable price separate. When unavailable, record `PINNACLE_BENCHMARK_UNAVAILABLE` rather than inventing a comparison.

### Complete bundle validation before freeze

Before freezing either payload, run the publisher's read-only bundle validator against the complete report and matching sidecar:

`node tools/report-publication.mjs validate --report <report.json> --sidecar <sidecar.json>`

Also run `node tools/major-sport-market-coverage-gate.mjs validate --report <report.json> --sidecar <sidecar.json>` against the exact bound feed before freeze. Both must pass, including the active market-scope and paused-prop receipt checks.

Require success across the entire recommendation set. This reuses the publisher's report/sidecar checks, including material-personnel text, `personnelRequired`, required evidence, WAIT qualification and exact report paths. It writes no History and confers no issuance authority. It supplements the Core, coverage, personnel-semantic, Pinnacle, continuity, availability, spread-lineage and total-lineage checks; none is replaced.

If the earlier personnel-semantic check reports `checked=0`, that means no card was marked `personnelRequired=true`; it does not establish that the report text and those flags are consistent. Resolve all reported contradictions from the actual research before freeze. Record real material dependencies and their required evidence. Do not remove a genuine dependency, invent evidence, or alter analytical context to obtain a passing result. General risk prose must accurately describe the recorded decision and must not claim unsupported personnel conclusions.

Read the current bankroll from the authoritative ledger projection for the report, retaining its source path and blob SHA. Do not carry forward an older report's bankroll merely because no new risk is recommended.

Meter telemetry remains publisher-owned. For reports from 2026-09-05 11:00 America/Vancouver onward, the publisher measures current book agreement independently and uses the governed saved-odds fallback when an earlier report comparison is unavailable. Follow `docs/VIGSCOPE_METER_BASELINES.md`; do not estimate meter values in the scheduled task or run extra odds pulls to fill them. A missed earlier report alone must not block the new report.

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

# Betting Edge Scheduled Report Authority

**Status:** OPERATIONAL  
**Authority version:** 1.2
**Effective:** 2026-09-02  
**Validation clarification:** 2026-09-05
**Primary-market scope amendment:** 2026-09-05 13:00 America/Vancouver
**Source and fair-value evidence amendment:** 2026-09-05 17:00 America/Vancouver
**Documented primary evaluation amendment:** 2026-09-06 00:00 America/Vancouver
**Unbounded card-output amendment:** 2026-09-06 00:00 America/Vancouver
**Fair-construction workflow clarification:** 2026-09-06, following the 06:00 review
**Quote observation amendment:** 2026-09-06, forward-only for feeds declaring `quoteObservationVersion: 1`
**Schedule simplification:** 2026-09-06 — one permanent Main Betting Edge schedule
**Repository:** `fhvsvzpmkw-design/-betting-edge-terminal`  
**Branch:** `main`

This file is the shared operating instruction for all standard Betting Edge scheduled report tasks. A task supplies only its expected Vancouver report time. All five standard lanes must inherit this file rather than carrying independent market-coverage logic.

## 1. Main schedule gate — mandatory first step

Given `EXPECTED_REPORT_TIME` in America/Vancouver:

1. Read `BETTING_EDGE_MAIN_SCHEDULE.md` and `data/main-schedule.json` from authoritative `main`.
2. Resolve the exact permanent Main Betting Edge slot whose `reportTime` equals `EXPECTED_REPORT_TIME`.
3. Retain schedule id/name, canonicalSlot, slot, pulseTime, reportTime, label and featuredVigScope.
4. If no exact slot matches, do not notify, handicap, stage a candidate or write History.

The Main Betting Edge schedule controls timing only. It never excludes a major sport or market from otherwise valid evaluation.

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
- maximum 30-minute executable quote age at feed generation: use `market.observedAt` for `quoteObservationVersion: 1`, and the original `market.updatedAt` rule only for legacy feeds;
- scheduleMeta compatibility with the permanent Main Betting Edge slot;
- exact event, market, line, side and selection identity;
- Bet365 and DraftKings as supported executable books.

Apply Contract section 4.0a and `docs/ODDS_OBSERVATION_FRESHNESS.md`. A new-format feed has `collectionStartedAt`, a completed-snapshot `generatedAt`, and market-level `observedAt` recorded from each successful exact response. Preserve the provider's `updatedAt` as last-change provenance. Missing, invalid or future observations cannot be replaced with another timestamp. The existing 90-minute retention horizon uses observation age. Missing/suspended quotes in the latest successful requested scope remain unavailable; older copies cannot supply them. Do not manually restamp feed data or count an unchanged re-observation as movement. Validation, coverage explanations, meters and lineage must agree on the bound feed's clock; legacy issued snapshots retain their original interpretation.

Do not pull replacement odds merely because a market or candidate is unattractive.

## 4. Major-sport market coverage — evaluate first, publish decisions second

Apply `data/major-sport-market-coverage-v1.json` exactly.

For every in-scope game in MLB, NHL, NBA/WNBA, NFL, NCAAF and CFL, evaluate every fresh supported required primary selection before recommendation-card publication:
- MLB: both moneyline sides, both sides of the primary run line, primary total over and under;
- NHL: both moneyline sides, both sides of the primary puck line, primary total over and under;
- NBA/WNBA: both moneyline sides, both sides of the primary spread, primary total over and under;
- NFL/NCAAF/CFL: both moneyline sides, both sides of the primary spread, primary total over and under.

Build one internally coherent fair for each exact primary market, then grade both opposing selections against their own exact executable prices. Do not manufacture separate contradictory fairs merely to force both sides into the process.

Never preselect an underdog, favorite, home team, away team, over or under as the only candidate side. One market never substitutes for another. One league never substitutes for another.

If an expected primary market is missing, stale, identity-unsafe or otherwise unusable, retain an explicit availability limitation rather than silently skipping it.

### Documented evaluation — from September 6

For report timestamps at/after `2026-09-06T00:00:00-07:00`, read the primary-analysis section of `docs/REPORT_EVIDENCE_REQUIREMENTS.md`. Use `derivePrimarySelectionInventory(report, feed, policy)` from the existing coverage gate to establish exact available primary sides. Availability is not a completed evaluation. For **each available side**, retain one `sidecar.primaryAnalysis.receipts` entry with either the actual EVALUATED decision and evidence or a BLOCKED record explaining the specific research/fair/personnel/calibration shortfall and actual event-specific checks. Never bulk-label available odds as PASS or invent fair values to satisfy this receipt.

Keep both sides of the same market on a coherent fair and uncertainty range. Every EVALUATED decision must appear unchanged in the published card set, including BET, LEAN, WAIT and PASS. There is no card-count minimum, target, profile or maximum, and no evaluated PASS may be hidden by presentation curation. An explicit unavailable continuity PASS remains a non-evaluated resolution under its existing gates. BLOCKED is an evidence limitation, not a betting decision or a substitute PASS.

Reconcile `primary.available = primary.evaluated + primary.blocked` and `primary.required = primary.available + primary.unavailable` for every sport and in totals. Include the exact visible clause `Primary selections: N available; N evaluated; N evidence-blocked; N unavailable.` with the four actual counts. Evidence-blocked is not an analytical PASS; zero completed evaluations must be disclosed as such. Coverage describes retained same-day pregame events; publisher diagnostics disclose known acquisition omissions separately. Complete inventory accounting must not be described as complete handicapping when research is blocked.

The existing coverage and bundle validators enforce this before freeze and again at publication/read-back. The publisher derives `coverageSummary` and version-3 meter telemetry; tasks must not supply invented display counts or meter readings. Heat and agreement use verified primary quotes independently of cards. Price pressure needs an actual BET/LEAN/WAIT directional reference; absent references remain explicitly unmeasured. All five standard tasks inherit this change through this shared file; no new task or schedule is added.

### Player props — PAUSED_BY_SCOPE

For report timestamps at or after `2026-09-05T13:00:00-07:00`, resolve `reportScope` in `data/major-sport-market-coverage-v1.json`. The active scope is `PRIMARY_FULL_GAME_ONLY`: full-game moneylines, primary spreads/run lines/puck lines and game totals, across MLB, NHL, NBA/WNBA, NFL, NCAAF and CFL.

Do not screen props, estimate prop fairs, perform prop-specific matchup/personnel research, or issue new/carried player-prop BET, LEAN, WAIT or PASS cards. Existing prop lineages are paused by scope rather than converted into analytical PASS decisions. Retain the normal Stage 1 and Stage 2 personnel work for active primary-market candidates.

The shared odds feed may still contain props in `live-odds.events`, `deepMarkets` or `baseballProps`. The coverage validator counts fresh returned exact keys as inventory only; it does not require prop analysis. In every sport row set `props.state=PAUSED_BY_SCOPE`, `screened=0`, `seriousDeepReviewed=0` and `excludedByScope=returned`. Preserve the exact returned inventory count. Copy `reportScope.id`, `effectiveFrom` and `playerProps` into `coverageAudit.scope`; include `totals.propsExcludedByScope=totals.propsReturned`.

State “Player-prop analysis paused; full-game primary markets covered” in the report summary, subject to the actual primary availability limitations. Never claim paused props were screened, unavailable or rejected on value. Future prop categories require individual validation and an explicit scope amendment; `enabledPropMarkets` is currently empty. Archived reports and their grading remain governed by their original scope and exact identities.

### Full-game total movement across reports

For report timestamps at or after `2026-09-05T13:30:00-07:00`, apply Contract section 6.1a across MLB, NHL, NBA/WNBA, NFL, NCAAF and CFL. Read the latest same-day archived total for each event and Over/Under side. Preserve unstarted tracked BET/LEAN/WAIT candidates as current decisions. Reconcile the current primary total even if the old exact line still survives as an alternate row. A changed number is a new current selection with independent requalification. From the September 6 documented-evaluation cutover, an evaluated current PASS is published like every other evaluated decision.

Use the bound snapshot, the coverage gate's primary-line resolver, and the normal feed/quote clocks. One fresh supported book can be sufficient. Preserve book-specific differences with `CONFLICTING SIGNALS` and each book's line/price; never invent a consensus total. A lower total helps a prospective Over and a higher total helps a prospective Under. Record line movement and odds movement separately in `rec.move`, with the prior/current totals and odds, using the Contract labels. Reassess current fair, uncertainty, playTo and decision; information-driven fair changes remain distinct from sportsbook movement. Keep the exact original selection and decision unchanged in History.

Before freeze run `node tools/total-lineage.mjs audit --report <report.json> --sidecar <sidecar.json>` using the exact bound feed (or `--feed <snapshot.json>`). Resolve any mismatch from the actual evidence. The check performs no new odds requests or analytical writes. If the current total cannot be verified, preserve the tracked candidate as an explicit zero-stake unavailable/unverified decision rather than silently dropping it or repricing the original ticket at a different number.

### Primary spreads, run lines and puck lines across reports

For report timestamps at or after `2026-09-05T14:00:00-07:00`, apply Contract section 6.1b to MLB run lines, NHL puck lines, and NBA/WNBA/NFL/NCAAF/CFL spreads. This is the forward replacement for the older disappearance-only spread check. Read the latest same-day exact event/team decision, follow the current primary handicap even when the old line survives as an alternate, and compare price changes even when the handicap is unchanged.

Use the exact provider selectionKey and hdp orientation: home displays raw hdp; away displays its negative. Archived cards with no separate hdp still qualify for tracking when the exact selectionKey supplies it. Show prior/current signed handicaps and odds in rec.move with separate LINE MOVED IN FAVOR/AGAINST/LINE UNCHANGED and PRICE IMPROVED/WORSENED/UNCHANGED/COMPARISON UNAVAILABLE labels as defined in the Contract. Preserve book-specific disagreement and verify the selected book's exact line/price. One fresh supported book remains sufficient for quote availability under the normal Core gates.

Reassess the current fair, uncertainty, playTo and decision; keep original selections immutable. Unstarted tracked BET/LEAN/WAIT candidates must receive a current decision or explicit zero-stake unavailable/unverified resolution. From the September 6 documented-evaluation cutover, every evaluated current PASS is also published. Before freeze run `node tools/spread-lineage.mjs audit --report <report.json> --sidecar <sidecar.json>` with the exact bound feed (or `--feed <snapshot.json>`), as well as the existing totals check. This shared instruction applies to all five Betting Edge report tasks; their schedules and paused-prop scope continue unchanged.

### Full-game moneylines — all displayed quotes and price movement

For report timestamps at or after `2026-09-05T14:15:00-07:00`, apply Contract section 6.1c across all seven supported sports. Verify every displayed moneyline, including new selections and previously marked PASS cards. Use each book's newest canonical marketKey=ml entry only; do not recover a missing/suspended/unverified selection from an older entry. A fresh valid supported second book can be used, and one valid book remains sufficient for quote availability under the ordinary Core gates.

Bind the exact full-game event, home/away team, selectionKey, selected book and executable price. Compare against that team's latest same-day archived moneyline decision, including PASS, and show prior/current odds plus PRICE IMPROVED/WORSENED/UNCHANGED. MOVEMENT UNCHANGED requires identical odds. Use PRICE COMPARISON UNAVAILABLE when the prior price is unverified; NEW SELECTION, FIRST LOOK or PRICE COMPARISON UNAVAILABLE with current odds is appropriate when no same-day reference exists. Never invent movement. Reassess current fair, uncertainty, playTo and decision, with the existing personnel process. Preserve original issued selections.

Before freeze run `node tools/moneyline-lineage.mjs audit --report <report.json> --sidecar <sidecar.json>` with the exact bound snapshot (or `--feed <snapshot.json>`). Resolve every displayed quote error, including PASS/new cards. When no current quote can be verified, preserve the identified candidate as a zero-stake unavailable/unverified decision with matching price and movement text. The older availability gate delegates future moneylines to this complete check. Publication repeats it on retries and remote read-back. This instruction is shared by the 06:00, 08:00, 09:30, 15:15 and 18:15 Pacific report tasks.

## 5. Pinnacle official sharp benchmark

Read the current production manifest sharp-market block, its pinned Pinnacle policy and `data/oddspapi-observer.json` when present.

Pinnacle/OddsPapi is an official **non-executable** sharp benchmark only. Use only status=ok observations with exact primaryMatch and exact event/market/selection identity, active unsuspended market/quotes, mainLine=true where applicable, complete pairing and policy-compliant freshness. Use the observer's deterministic paired no-vig fields; do not hand-create a substitute benchmark.

A QUALIFIED benchmark may confirm alignment, expose conflict or support caution/uncertainty where Core independently permits it. It may not replace Bet365/DraftKings, originate a BET by itself, set stake, directly overwrite independent Core fair, directly move playTo/status, or bypass any gate.

Unavailable/stale/suspended/unmatched/incomplete Pinnacle is `PINNACLE_BENCHMARK_UNAVAILABLE` and does not block the report.

## 6. Research and current fair-value process

### Complete the handicap before assigning an evidence blocker

For every available primary market, perform the current Core handicapping work. A maintained model is useful when applicable, but it is not a universal prerequisite. Source pages normally supply facts and inputs, not finished probability distributions. The absence of a prebuilt model, or of a probability on a schedule, scoreboard or personnel page, is not by itself a reason to stop.

1. Research the event once across its relevant primary markets: current team performance, matchup, material personnel and conditions. Reuse a checked fact across sides or markets only where it actually applies. Identify what each market still needs; a moneyline estimate does not establish a run-line, puck-line, spread or total fair.
2. Use applicable governed model work where available. Otherwise attempt the permitted `MARKET_ANCHORED_MODEL` route under Contract section 4.1: combine an explicitly identified current market baseline with substantive independent current matchup/personnel analysis. Explain the actual numerical derivation, any judgmental adjustment and its basis, and the uncertainty range. Do not relabel a no-vig quote plus narrative as an independent model, invent fixed blend weights or uncertainty margins, or treat Pinnacle as the fair-setting authority.
3. Complete material Stage 2 work and re-handicap. Classify calibration honestly using the current Core framework: `directCalibration=GAP` raises the floor to `ELEVATED`; it does not automatically prohibit evaluation. Apply all other matching rules and the actual independent-support requirement. Core error categories do not supply a universal numerical uncertainty margin. Grade both opposing selections from one coherent supported fair/range against their exact prices.
4. If the work still cannot support a numerical fair or bounded uncertainty, record the concrete unresolved input or method limitation and what was attempted. Use `RESEARCH_INCOMPLETE` when the work was not completed, rather than asserting that a model or calibration is unavailable. Never manufacture an estimate or a PASS to fill the inventory.

### Source and fair-value evidence — forward from 17:00 PT September 5

For `run.ts >= 2026-09-05T17:00:00-07:00`, read and apply `docs/REPORT_EVIDENCE_REQUIREMENTS.md` and the additive fields in `data/history/report-provenance-schema.json`. This is shared by all five report lanes. Earlier issued reports remain immutable under their original requirements.

Every displayed card, including PASS, must retain event- and sport-matched `sourceEvidence` with actual URLs, check times and specific findings. Do not copy generic league/source text from another sport. If a source or market genuinely cannot be verified, record the permitted PASS `sourceShortfall` with its decision impact; never invent a source or numeric fair to complete a card.

Every BET/LEAN/WAIT must also retain `fairValueEvidence`: the exact selection, units and orientation, numeric inputs linked to the checked sources, method/calculation, final estimate, numeric uncertainty range, limitations and explicit personnel basis. A quoted forecast or a list of favorable articles does not by itself establish a supported numerical fair or uncertainty range. Explain the estimate and uncertainty using the actual Core/Walters handicapping work, including the permitted market-anchored process above. Do not manufacture a formula or set `personnelRequired=false` to evade material Stage 2 work. If an estimate cannot be supported, resolve its analytical availability before freeze under the existing Core rules.

Keep status and execution language consistent: a zero-stake LEAN is not an instruction to wager merely because a directional `playTo` threshold is met. State why BET strength is absent. Record the machine-checkable `benchmarkComparison` for each QUALIFIED Pinnacle card. A better independent handicap may disagree with Pinnacle; an unfavorable benchmark comparison must be described as unfavorable and may not be presented as confirming an execution advantage.

Run `node tools/report-evidence-gate.mjs validate --report <report.json> --sidecar <sidecar.json>` before freeze. The publisher repeats this read-only validation during initial publication, retries and remote read-back. The gate checks evidence structure, identity and numeric consistency; it cannot prove source truth or model quality. The report task remains responsible for reading the sources and doing the handicap.

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

## 9. Recommendation-card publication and delivery

Only after the complete major-sport market sweep and required candidate research are finished may the report publish decision cards.

For report timestamps at/after `2026-09-06T00:00:00-07:00`, there is **no numeric card minimum, target, profile or maximum**. Do not resolve a card-count preference and do not curate completed decisions toward a number. Publish every EVALUATED primary decision unchanged, including BET, LEAN, WAIT and PASS. The final card count is therefore an output of the completed analysis. Do not add filler. BLOCKED receipts remain evidence limitations rather than cards, except that separately governed unavailable continuity resolutions retain their existing behavior. Reports issued before this cutover remain immutable under their original presentation receipts.

For new receipts use `coverageAudit.presentation = { mode: "UNBOUNDED_ANALYSIS_OUTPUT", allEvaluatedPublished: true, fillerAdded: 0 }`. Legacy target fields are retired for new reports. The coverage validator verifies this presentation mode and independently checks that every EVALUATED primary receipt has an exact matching published card.

Build the frozen Core 1.4 report for VigScope UI v1.5 with fresh Vancouver `run.ts`, exact `feedGeneratedAt`, current bankroll, correct risk/counts/summary, and no filler. Preserve exact `rec.feed` identity, fair/playTo/status/stake consistency, personnelRequired/personnelEvidence, WAIT qualification, coreAssessment and waltersEvidence.

For reports from 17:00 PT September 5, when `coverageAudit.totals.primaryUnavailable > 0`, include this exact clause in the visible summary, substituting the actual counts: `Primary selections: N evaluated; M unavailable.` From the September 6 documented-evaluation cutover, use the four-count clause required above. The coverage gate checks it against the receipt. Distinguish a complete inventory check from usable market coverage. `MARKET_NOT_RETURNED` means no usable retained market in this snapshot; it does not prove the sportsbook never offered that market. Use acquisition diagnostics when present to explain missing, filtered, not-attempted and unsuccessful recovery outcomes. Do not request replacement odds from the report task to improve an unattractive result.

Build the matching schema-3 sidecar with all provenance and Pinnacle information required by the current production contract/publisher. When a recommendation has exact QUALIFIED Pinnacle, preserve the current structured benchmark object and keep executable price separate. When unavailable, record `PINNACLE_BENCHMARK_UNAVAILABLE` rather than inventing a comparison.

### Complete bundle validation before freeze

Before freezing either payload, run the publisher's read-only bundle validator against the complete report and matching sidecar:

`node tools/report-publication.mjs validate --report <report.json> --sidecar <sidecar.json>`

Also run `node tools/major-sport-market-coverage-gate.mjs validate --report <report.json> --sidecar <sidecar.json>` against the exact bound feed before freeze. Both must pass, including the active market-scope and paused-prop receipt checks.

Require success across the entire recommendation set. This reuses the publisher's report/sidecar checks, including material-personnel text, `personnelRequired`, required evidence, WAIT qualification and exact report paths. It writes no History and confers no issuance authority. It supplements the Core, coverage, personnel-semantic, Pinnacle, continuity, availability, moneyline-lineage, spread-lineage and total-lineage checks; the dedicated moneyline gate owns future moneyline quote validation.

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

Serialize the complete validated bundle to a local file and parse that file's exact serialized bytes before staging. Commit and push the file directly with authenticated Git. The connected GitHub Git-data API is also permitted when populated programmatically from complete, length-checked file bytes and its returned blob SHA matches local `git hash-object` before updating the branch. Never reconstruct the payload from displayed command output, chat text, previews or truncated tool responses. Preserve the exact frozen local file until durable publication and read-back finish; a transfer retry must use those same bytes and must not change the candidate's report, sidecar, identity or analytical decisions.

After pushing, fetch authoritative main and confirm it contains the staging commit. Compare `git hash-object <frozen-bundle-file>` with `git rev-parse <staging-commit>:data/history/staging/report-bundle.json` to verify that the committed blob is identical to the preserved local bytes. A parse failure, incomplete transfer or blob mismatch remains `PUBLICATION BLOCKED — CANDIDATE NOT STORED`; do not repair analytical content or bypass publisher checks to recover a transfer failure.

The repository-controlled `.github/workflows/report-history-staged.yml` owns clean-history preflight, Core trace validation, Core validation, official Pinnacle provenance/authority validation, selection continuity, non-spread availability, spread lineage, atomic durable publication and remote read-back.

After verifying the committed bytes, inspect the workflow run for the staging commit/head SHA. Never bypass publication with direct History writes.

If publication fails: `PUBLICATION BLOCKED — CANDIDATE NOT STORED` plus the failing gate, with no short link.

If publication has not completed by the task's end: `PUBLICATION PENDING — CANDIDATE STAGED`; do not claim storage/read-back success or release a short link.

Only after workflow SUCCESS, re-read `run-history.json` and the exact indexed report/sidecar from authoritative main. Build user-facing counts, named selections, risk and material-change summary only from that durable read-back artifact. Then provide the deterministic VigScope v1.5 short link labeled with the resolved report time.

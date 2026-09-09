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
**Partial research publication amendment:** forward from `2026-09-06T18:15:00-07:00`; supersedes the whole-report completion veto in PR #66 before its first applicable run
**Research handoff clarification:** 2026-09-07 — resume indexed same-day evidence, scan the whole slate, then complete market calculations
**Source-first fair-value amendment:** forward from `2026-09-07T18:15:00-07:00` — retrieve published fair estimates, verify current personnel, then compare executable prices
**Market-first completion amendment:** forward from `2026-09-07T18:31:00-07:00`; section 6 overrides older universal fair/range and research-first requirements
**Public forecast lookup and completion reporting:** 2026-09-07 — applies within the source-first amendment; use the sport/market routes below and disclose actual evidence completion
**Card evidence application repair:** 2026-09-09 — apply specific current facts and canonical History Fit to new drafts; retain earlier forecast leads and advisory review without changing market-assessment or partial-publication eligibility
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

For new drafts after the September 9 repair, also read `docs/REPORT_CARD_EVIDENCE.md`. It governs card explanations and actual research application; it adds no publication gate or independent-model requirement for market assessments.

Retain exact current blob SHAs required by the production report/sidecar contract. Verify the production manifest sharp-market benchmark block is OPERATIONAL, its pinned policy id/blob matches the current Pinnacle policy, its authority is `OFFICIAL_NON_EXECUTABLE_SHARP_BENCHMARK`, and `executionAuthority=false`. Resolve current Walters mode.

Require the market-coverage authority to have schema 1, authorityId `major-sport-market-coverage-v1` and state `OPERATIONAL`.

Any authority conflict is `PREFLIGHT BLOCK — ANALYSIS NOT STARTED`.

Apply the dated amendments to their stated scope. The Contract's market-derived benchmark allowance is an input to screening; the September 6 primary-receipt rule governs final evaluated decisions, including PASS. Research Library restrictions govern historical priors, not current matchup/personnel research. Neither distinction is an authority conflict or a reason to skip the current handicap.

## 3. Bind the exact odds snapshot

Bind the exact `data/live-odds.json` snapshot for this lane. Enforce all Contract gates, including:
- maximum 75-minute feed freshness;
- maximum 30-minute executable quote age at feed generation: use `market.observedAt` for `quoteObservationVersion: 1`, and the original `market.updatedAt` rule only for legacy feeds;
- scheduleMeta compatibility under the manual-snapshot binding rule below;
- exact event, market, line, side and selection identity;
- Bet365 and DraftKings as supported executable books.

### Manual-snapshot binding — September 7 clarification

The report task's `EXPECTED_REPORT_TIME` and the permanent Main schedule determine the report lane. The odds refresh trigger records collection provenance; it does not determine whether otherwise valid odds may be analyzed.

A snapshot explicitly marked `scheduleMeta.triggerSource: manual` is eligible for any resolved Main report lane when its actual generation time is on the report's Vancouver operating date and it passes all normal feed freshness, exact-quote observation, identity and event-eligibility gates. Missing/null `canonicalSlot` and `plannedReportTime`, and the normal `MANUAL` pulse/slot markers, are expected for a manual refresh and must not cause a preflight block. Resolve the report's canonical slot, scheduled pulse/report times, label and featured metadata from section 1. Preserve the exact source feed bytes, blob SHA, timestamps and manual trigger provenance; never restamp or relabel the snapshot as an automatic scheduled pulse.

For an automatic snapshot, continue requiring its declared schedule identity to match the resolved lane. Conflicting non-manual slot identities, unknown/invalid trigger provenance, stale/future feeds and unsafe quotes remain subject to the existing gates. Do not infer a missed/delayed automatic pulse merely because the bound snapshot is manual, or request replacement odds solely to obtain schedule metadata.

A user-requested recovery retains the original canonical report lane, appends `— RECOVERY` to its display label and uses the actual issue time. It follows the same analysis, staged-publisher and durable read-back requirements; no backdating or direct History writes are permitted.

Apply Contract section 4.0a and `docs/ODDS_OBSERVATION_FRESHNESS.md`. A new-format feed has `collectionStartedAt`, a completed-snapshot `generatedAt`, and market-level `observedAt` recorded from each successful exact response. Preserve the provider's `updatedAt` as last-change provenance. Missing, invalid or future observations cannot be replaced with another timestamp. The existing 90-minute retention horizon uses observation age. Missing/suspended quotes in the latest successful requested scope remain unavailable; older copies cannot supply them. Do not manually restamp feed data or count an unchanged re-observation as movement. Validation, coverage explanations, meters and lineage must agree on the bound feed's clock; legacy issued snapshots retain their original interpretation.

Do not pull replacement odds merely because a market or candidate is unattractive.

## 4. Major-sport market coverage — evaluate first, publish decisions second

Apply `data/major-sport-market-coverage-v1.json` exactly.

For every in-scope game in MLB, NHL, NBA/WNBA, NFL, NCAAF and CFL, evaluate every fresh supported required primary selection before recommendation-card publication:
- MLB: both moneyline sides, both sides of the primary run line, primary total over and under;
- NHL: both moneyline sides, both sides of the primary puck line, primary total over and under;
- NBA/WNBA: both moneyline sides, both sides of the primary spread, primary total over and under;
- NFL/NCAAF/CFL: both moneyline sides, both sides of the primary spread, primary total over and under.

Establish one coherent assessment basis for each exact primary market under section 6: a sourced fair/range for the forecast path, or the qualified paired reference for the market-assessment path. Grade both opposing selections against their own exact executable prices. Do not manufacture separate contradictory fairs merely to force both sides into the process.

Never preselect an underdog, favorite, home team, away team, over or under as the only candidate side. One market never substitutes for another. One league never substitutes for another.

If an expected primary market is missing, stale, identity-unsafe or otherwise unusable, retain an explicit availability limitation rather than silently skipping it.

### Documented evaluation — from September 6

For report timestamps at/after `2026-09-06T00:00:00-07:00`, read the primary-analysis section of `docs/REPORT_EVIDENCE_REQUIREMENTS.md`. Use `derivePrimarySelectionInventory(report, feed, policy)` from the existing coverage gate to establish exact available primary sides. Availability is not a completed evaluation. From the market-first completion amendment, the verified non-wager market-assessment path in section 6 is also EVALUATED. For **each available side**, retain one `sidecar.primaryAnalysis.receipts` entry with either the actual EVALUATED decision and evidence or a BLOCKED record explaining the specific research/fair/personnel/calibration shortfall and actual event-specific checks. Never bulk-label available odds as PASS or invent fair values to satisfy this receipt.

An unfinished selection must never suppress another completed, validated decision. `RESEARCH_INCOMPLETE` sends the producer back to section 6 to continue the work, but any unfinished remainder can be retained honestly in the published sidecar. It carries no betting decision or stake. A terminal BLOCKED receipt means the applicable work and alternatives were attempted but a specific evidential limitation remains. Both are selection-level limitations, not whole-report publication vetoes.

Keep opposing sides on the same assessment basis: coherent model fair/range or the same qualified paired market reference. Every EVALUATED decision must appear unchanged in the published card set, including BET, LEAN, WAIT and PASS. There is no card-count minimum, target, profile or maximum, and no evaluated PASS may be hidden by presentation curation. An explicit unavailable continuity PASS remains a non-evaluated resolution under its existing gates. BLOCKED is an evidence limitation, not a betting decision or a substitute PASS.

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

### Market-first completion — forward from `2026-09-07T18:31:00-07:00`

This is the current Main Betting Edge workflow for all five lanes. It supersedes the earlier universal independent-fair/range requirement for EVALUATED non-wager assessments and the earlier research-first ordering. The forecast lookup table remains a resource for targeted investigation and the existing forecast-based BET process.

1. **Grade the market price first.** Validate the eligible inventory and exact execution quotes. Resolve the matching qualified Pinnacle full-game pair from the pinned observer using `exactMarketReference` in `tools/market-price-assessment.mjs`; apply the exact alternate-total amendment below for new reports. Compare the no-vig reference probability with `1 / priceDecimal`, using the exact decimal quote rather than rounded American display odds. Record direction and magnitude separately from the final decision. Evaluate each side; a favorite is not automatically value and the opposing side does not automatically receive the opposite status.
2. **Check current information for every event.** Perform Stage 1 roster, lineup, starter, injuries, relevant news and conditions checks once per game and reuse the actual findings across its applicable markets. Preserve source timestamps. The price grade is provisional: material news may reopen any initial PASS or weak price, change source applicability or require further investigation. These facts alone are not an independently calibrated win probability.
3. **Investigate a concrete remaining question.** Use Stage 2 depth and closing checks when a material personnel dependency or conflict can change the conclusion, or investigate an attractive price/forecast disagreement when it could establish a bettable case. Use the Research Library's relevant priors and existing governed knowledge without treating repeated market observations or historical priors as new independent votes. Do not require another full forecast hunt or deep sweep on every negative price merely to publish a market assessment. Missing forecast uncertainty is a limitation of that forecast, not a blocker when the market-assessment path is supported.
4. **Complete the supported decision.** A new EVALUATED receipt may contain a `marketAssessment` instead of `fairValueEvidence`. This path supports zero-stake PASS, LEAN or qualified WAIT. PASS states why the price/evidence does not warrant action; it must not claim the true win probability is known. LEAN needs a favorable exact comparison, resolved material information and an explicit no-wager statement. WAIT retains the existing current independent signal, plausible actionability and concrete resolution trigger; routine unfinished research or the mere possibility of better odds is not WAIT. Keep `playTo: "NO BET"`, omit priceWatch, label fair as `Market reference: <no-vig American price>` and retain `fairValueBasis: MARKET_DERIVED_ONLY`. Do not invent a numerical uncertainty range or independent support. BET still requires the existing supported fair/range, Core conservative-bound clearance, personnel and staking process; `marketAssessment` cannot authorize BET or stake.
5. **Publish and retain real limitations.** Include every EVALUATED decision in the existing cards/receipts. A missing qualified exact reference requires targeted published-forecast/governed-fair fallback; if neither basis is supportable, record the actual source/identity/settlement gap as BLOCKED. Unfinished work remains RESEARCH_INCOMPLETE with its concrete next step. Never convert all available prices to PASS without the comparison and information review. Keep all issued history unchanged.

A two-way no-vig probability is a market reference conditional on a non-push settlement, not an unconditional predicted win probability. For an integer spread or total, matched push/void rules allow an exact-price comparison without inventing a push rate; do not claim unconditional win probabilities, absolute expected ROI or a wager from that comparison. A published Over probability with unspecified settlement semantics still cannot be blindly complemented. Verify book settlement compatibility and document it.

Pinnacle remains non-executable, does not overwrite independent fairs, and does not directly change a decision, playTo or stake. This amendment permits the analyst to use its qualified comparison as evidence for a completed non-wager assessment. Core model-error and BET authority, Graham/Walters, the Research Library, props pause, odds clocks/budget and five scheduled times are unchanged. No first-pull movement history is required: establish the baseline. Later runs use the saved same-day odds snapshots even if no earlier decision was evaluated; show book-specific entry-price movement separately from market direction and any forecast change.

See `docs/REPORT_EVIDENCE_REQUIREMENTS.md` for the structured record. `validatePrimaryAnalysis` re-resolves the reference against the pinned observer; the evidence, coverage and publication gates validate the same record.

### Exact alternate-total comparison — from `2026-09-09T16:00:00-07:00`

For new Main market assessments, a full-game total offered by Bet365/DraftKings may use Pinnacle's exact same total even when Pinnacle labels it an alternate. Use `exactMarketReference`; it requalifies the raw pair from the pinned snapshot at report time. Do not discard an exact pair merely because its stored observer annotation says `COMPLETE_TWO_WAY_MAIN_LINE_REQUIRED`. This narrowly supersedes the baseline main-line requirement for these zero-stake total assessments; default observer annotations, the original benchmark policy/hash and historical report interpretation remain unchanged.

Require one unambiguous full-game `altLine/<five components>/0/totals` market, exactly one active Over and Under at the identical numeric line, fresh quotes, active unsuspended book/market, matching event/start time and compatible settlement. Integer and half-point totals are supported; quarter/split totals require their own settlement treatment and cannot use this exception. Never substitute 44 or 45 for 44.5, or use a period/team total or alternate spread. Reuse the original change and observation timestamps. Copy the returned `referenceKind: "EXACT_FULL_GAME_ALTERNATE_TOTAL"` and exact `bookmakerMarketId` into `pinnacleBenchmark` on the card and all mirrored sidecar/receipt records. Keep the source finding and settlement rationale explicit.

The collector retains full-game alternate totals beyond its general market trimming limit without making extra API requests. This supplies comparison evidence only: current information review, PASS/LEAN/WAIT qualification, forecast-based BET authority, personnel checks and all publication gates still apply. It does not turn a missing research conclusion into an automatic PASS or rewrite any issued card.

### Card evidence application — September 9 repair

Follow `docs/REPORT_CARD_EVIDENCE.md` while forming the draft. SUPPORT and CONTRARY must communicate the actual relevant facts and unresolved dependencies; ANALYSIS must explain their effect on this decision; SOURCE must identify recognizable publishers and readable Pacific check times. Apply the existing historical pack to HIST FIT with actual research links, mechanism and limitations; use NR or HISTORY LIBRARY UNAVAILABLE honestly when appropriate. Do not use a B grade to describe today's price comparison. Do not use an assembly loop that sets every matched selection to PASS, clears all earlier forecasts, or replaces completed research with generic process statements.

The research plan now retains `priorForecastResearch` separately from the newest receipt. Review the earlier exact forecast, original sources and personnel assumptions even if an intervening market-only PASS omitted them; explain adoption or non-adoption from current evidence. Never inherit an old fair, status, quote or check time automatically. Prioritize concrete favorable-price/personnel and forecast-disagreement questions under existing Stage 2 rules, with no new numerical trigger or universal deep-research quota.

Run `node tools/review-card-evidence.mjs review --report <report.json> --sidecar <sidecar.json>` before freeze and inspect its event facts and focused warnings. Correct the unfrozen draft from verified evidence and keep all copies aligned. This is advisory, not a publication veto: preserve every supported market assessment, use truthful selection-level limitations for genuinely unfinished current research, and publish the completed remainder. Historical-fit gaps do not block current decisions. The WAIT/BET requirements in section 6 remain unchanged.

### Published-forecast lookup — used when the market-first review needs it

For report timestamps at/after `2026-09-07T18:15:00-07:00`, apply Contract section 4.1's source-first amendment. Betting Edge retrieves and assesses published fair estimates, verifies them against current matchup research, and compares them with the bound sportsbook prices. Independence means substantive model evidence separate from the execution quotes; it does not require a model built by Betting Edge. A verified external forecast may be used unchanged as the point estimate. Do not create a new predictive model or arbitrary raw-statistic/personnel adjustment during a standard run.

Use this lookup order for the currently active full-game primary markets. Move to the alternative when the needed number, current applicability or uncertainty support is missing. These are discovery routes, not automatic endorsements, calibration certifications or executable books. The September 7 audit verified examples, not free access to every event/line. Historical examples cannot price a current game.

| Sport / market | First lookup | Alternative / field check |
|---|---|---|
| MLB moneyline | [FanGraphs scores](https://www.fangraphs.com/scores): operating date, pregame game odds, pitchers and posted/projected lineups. | [Dimers MLB](https://www.dimers.com/mlb/predictions), then the exact MLB game in [DRatings predictions](https://www.dratings.com/predictor/). FanGraphs in-game win expectancy and season/playoff odds are different outputs. |
| MLB run line and total | [Dimers MLB](https://www.dimers.com/mlb/predictions): exact game and Run Line or Over / Under probability tab. | Its dated exact-game analysis, then another current explicit exact-line forecast. FanGraphs win percentages do not price these markets. |
| NFL moneyline, spread and total | [Dimers NFL](https://www.dimers.com/nfl/predictions): required market, forecast time/version and expected QB. | [DRatings NFL](https://www.dratings.com/predictor/nfl-football-predictions/) or [ESPN NFL](https://www.espn.com/nfl/) Matchup Predictor for labeled win forecasts; theScore for explicit analyst fair lines. Existing Walters fairs remain subject to section 8. Exact NFL total probabilities were not verified in the audit; check the field or continue searching. |
| NCAAF moneyline, spread and total | [Dimers college football](https://www.dimers.com/cfb/predictions): exact game/date and required market. | DRatings college-football win forecasts, ESPN's exact-game predictor where present, then current explicit analyst estimates. Confirm event status and QB assumptions. Exact total probabilities were not verified in the audit; projected scores do not establish them. |
| NBA / WNBA moneyline, spread and total | [Dimers NBA](https://www.dimers.com/nba/predictions) / [WNBA](https://www.dimers.com/wnba/predictions): exact market probability in the game panel or dated analysis. | DRatings, ESPN exact-game predictors or [FanDuel Research](https://www.fanduel.com/research) / numberFire for an explicitly published win probability where available. Adjacent sportsbook spread/total columns are not model forecasts; seek an explicit exact-line alternative for those markets. |
| NHL moneyline | [MoneyPuck](https://moneypuck.com/): exact pregame win forecast when current game access is available. | [Dimers NHL](https://www.dimers.com/nhl/predictions), then DRatings NHL win forecasts. Check overtime/shootout settlement and goalie assumptions. MoneyPuck's displayed expected starter does not prove its win forecast incorporates that exact goalie; postgame Deserve To Win is not a pregame forecast. |
| NHL puck line and total | [Dimers NHL](https://www.dimers.com/nhl/predictions): exact game/line probability or dated analysis. | Search a current explicit alternative if absent. MoneyPuck's win forecast alone does not price these markets. |
| CFL moneyline, spread and total | Check the CFL route in [DRatings predictions](https://www.dratings.com/predictor/), then current CFL-specific forecasts/analyst fair lines for the exact game and market. | A dependable numerical CFL source was not verified in the audit. Record actual results and pursue applicable alternatives; never substitute NFL/NCAAF forecasts or assume coverage from a multi-sport brand. |

This table does not activate new sports or markets. If later controlled scope enables them, discovery leads include Dimers / ESPN BPI for men's college basketball; Dimers / DRatings / [Opta Analyst](https://theanalyst.com/articles/opta-football-predictions) for soccer; Dimers for tennis match winners; and DRatings for UFC winners. Revalidate exact coverage then. Opta documents betting-odds inputs alongside its Power Rankings; assess it as market-anchored. Player props remain paused.

**theScore and personnel research.** Search [theScore](https://www.thescore.com/) for the current event/date and an explicit analyst fair line, probability or quantified personnel scenario, alongside injury, lineup and matchup reporting. Historical [Arizona–Clemson fair-spread analysis](https://www.thescore.com/ncaab/news/2877398) and [Eagles–Seahawks QB scenarios](https://www.thescore.com/nfl/news/2792027) demonstrate the format only. Label an adopted forecast as an analyst estimate and explain its actual basis. A pick, quoted price, implied probability or betting-split percentage is not a separately established fair. Its [Super Bowl betting-line simulation](https://www.thescore.com/nfl/news/3466836/super-bowl-simulation-how-betting-lines-expect-seahawks-patriots-to-unfold) explicitly uses market lines. A fair spread/total point alone does not establish the exact selection probability needed for expected return. Retain official-source-first personnel checks and material Stage 2 depth.

**Field and access checks.** Read the actual game page/article; snippets and directories are leads. On Dimers, separate model percentages from prices and verify the fixture date inside the article. On DRatings, labeled win forecasts, bookmaker/no-vig columns and Bet Value scores are different fields; assess actual forecast market dependence. On FanDuel Research, use an explicitly attributed model probability. If a number is locked, stale, blocked or absent, record that limitation and move to a suitable alternative. Do not bypass access controls or repeatedly retry a challenge page. Forebet was access-blocked and TeamRankings' inspected numerical projections were subscription-locked; neither is a dependable free fallback without a successful authorized current check.

Read the actual source and retain its published estimate, update time, retrieval time, model basis and applicable personnel assumptions in the existing evidence fields. A page retrieval does not refresh the forecast. Prefer a verifiably newer applicable prediction panel over an older article on the same page; document discrepancies and retain unresolved conflicts. Do not select a forecast because it creates the largest edge or average syndicated copies into an apparent consensus. A single suitable independent source can establish the point estimate; no new source-count quota applies to pricing. Existing personnel fallback depth still applies separately.

The [Stanford Wong notes](docs/source-material/sharp-sports-betting-methods.md) remain a methodology reference for interpreting estimates, uncertainty and prices. They do not supply current game probabilities or require the producer to rebuild a source model. Earlier numerical trials are historical context only and are not current fair inputs.

### Execute qualified odds → research → fair value → decision

Start this process immediately after binding the qualified inventory; do not build a finished all-blocked report first. First perform the broad Stage 1 scan across every eligible event in start-time order, sharing relevant facts across its markets. Then complete market calculations and targeted deeper research. Give urgent current BET/LEAN/WAIT dependencies and approaching starts their required checks, and advance unfinished games instead of repeatedly rebuilding the first completed games. Complete each supportable market through both decisions as the work progresses; an unresolved total must not halt an independently supportable moneyline or another event. Cover the whole eligible slate without a card quota.

Use the existing report/sidecar working files, with an empty `primaryAnalysis.receipts` array initially. Retain the exact feed SHA and timestamp. Run this read-only command at the start and again when research stalls or before closing the research pass:

`node tools/major-sport-market-coverage-gate.mjs research-plan --report <report.json> --sidecar <sidecar.json> --summary`

Start with this compact queue. To inspect one game's recorded findings, run the same command without `--summary` and with `--event-id <exact eventId from the queue>`. This filters the displayed research detail only; coverage and headline counts still cover the full current inventory. Avoid repeatedly loading the full slate's detailed evidence when working one event.

The command groups exact available selections by event and market, identifies missing or unfinished receipts, and automatically reads earlier indexed reports and their matching research sidecars from the same Vancouver date. For each currently available selection it returns the latest matching prior receipt as `priorResearch`, with exact report/sidecar paths and hashes, original times, prior quote, missing work and personnel dependencies. `sharedResearch` groups original source findings/check attempts once per event. A recorded attempt is not proof the missing fact was obtained. Read the referenced prior sidecar for the full calculation when needed. Warnings identify unavailable or mismatched prior context; research those gaps afresh.

Treat inherited work as historical context only. Revalidate current relevance and changing facts; keep original source times and record actual new checks separately. Rebind the exact current quote and independently reassess fair/range, playTo, status and stake. A changed primary line requires a calculation for that new line. Prior EVALUATED and terminal BLOCKED receipts both return as pending current work; they never supply automatic evaluation credit or current decisions. The helper writes nothing and creates no sources, fairs, decisions, history or per-game archive. `READY_FOR_VALIDATION` means only that every current selection has a recorded outcome; the complete validators still apply.

The following forecast-investigation steps apply when section 6's market-first review calls for an independent forecast; they are not a mandatory prerequisite to a market assessment.

1. **Current evidence first.** Complete the broad Stage 1 scan of team performance, matchup, material personnel and conditions for the whole eligible slate before concentrating Stage 2 on a few games. Read the actual event/team sources and extract the facts needed by each market. Retain each checked finding once in the existing working evidence and reuse it only for the exact event/markets it supports; do not repeat the same source hunt for six selections. A probable-pitcher page alone is not a completed MLB matchup/lineup/bullpen assessment. A game preview alone is not a completed football personnel and fair-value assessment.
2. **Retrieve and verify the fair estimate.** Look up the current exact-market published forecast using the source-first workflow above, or an applicable existing governed fair record. Match sport, game/date, full-game scope, side, handicap/total and settlement treatment. Record the source number as a numeric input and explain its direct adoption or probability/odds conversion in `fairValueEvidence`; do not rebuild the source's model. Read the uncertainty guidance below. Keep moneyline, spread/run-line/puck-line and total estimates distinct. Neither a picks label nor a displayed sportsbook price establishes an independent fair.
3. **Follow unresolved dependencies.** If a material unknown prevents even a provisional fair, research that dependency now; a candidate need not already have a numerical edge to justify the work needed to establish one. Use the fallback process below. After the provisional screen, complete material Stage 2 work for serious candidates and perform the required closing authoritative check. Compare the findings with the source's roster, lineup, starter, injury and availability assumptions, including MLB bullpen availability. Seek an updated applicable forecast when material news is missing from it. Record the resulting fair/range and any justified `NO MATERIAL CHANGE`; do not add another adjustment for news already incorporated by the source.
4. **Decide and retain progress.** Compare the coherent fair/range with each side's exact executable price and apply Core, personnel, WAIT, playTo and staking rules. Retain completed decisions and evidence in the existing draft receipts as each market finishes. If there is still no supportable fair/range after the applicable work, record the exact terminal limitation and attempted alternatives. A supported low-value result is PASS; an unsupported fair is BLOCKED.
5. **Continue research and publish completed decisions.** Re-run `research-plan` and pursue missing work from its last actual finding, without restarting completed research unnecessarily. If some work remains unfinished at delivery, retain its exact missing input, actual attempts, reason work stopped and next step in the existing `RESEARCH_INCOMPLETE` receipt. Account for every available selection, run the pre-freeze gates on the completed decisions and full accounting, and stage the bundle. A `RESEARCH_PENDING` queue does not prohibit partial publication. Do not rename unfinished work to a terminal blocker, fabricate a PASS, or stop researching merely because partial publication is possible.

For an unfinished receipt, retain `blocker.progress = {stage, nextStep, stoppingReason}` alongside the actual `missing`, `impact` and `attempts`. Choose the actual next stage: `EVIDENCE_COLLECTION`, `FAIR_CONSTRUCTION`, `PERSONNEL_RECHECK`, or `DECISION_VALIDATION`. `nextStep` names the specific source/input/calculation/check still required; `stoppingReason` records the observed interruption or dependency, not simply “unfinished before issue.” Existing historical receipts without this detail appear as `UNSPECIFIED`; clarify their missing work rather than assuming either source collection or the calculation is complete. This is progress context, not a new decision gate or permission to stop. No timeout or usage cap may be claimed without evidence. Keep common factual research distinct from the separate moneyline, handicap and total calculations.

### Fallback and execution failure

- **A page fails or lacks the needed fact:** try another relevant official channel, then event/team/participant-specific credible current reporting or established statistics/lineup sources. Retain the failed check as an attempt and pursue the missing fact. Checking the local odds artifact verifies the price; it is not an independent research fallback.
- **Material personnel remains unresolved:** apply the sport-wide Stage 2 3-to-5-source completion rule where applicable, record genuine source shortfalls, conflicts, sensitivity and the closing authoritative check. Unconfirmed personnel may support a bounded scenario analysis; it does not force either a fabricated confirmation or an automatic whole-event block.
- **The forecast or uncertainty remains unsupported:** check another suitable current exact-market projection or applicable existing governed fair record. Name the actual source, stale/mismatched assumption, missing line, settlement ambiguity or unsupported range and explain the alternatives attempted. Do not turn source lookup into a new model-building project. No in-house model and `directCalibration=GAP` alone are insufficient stopping reasons. Current research can change which forecast is applicable and its uncertainty; historical Research Library material cannot directly set the fair.
- **Work has not been done:** continue it while execution and the normal feed/event clocks permit. If it remains unfinished at delivery, publish the completed, validated decisions and disclose the unfinished selections and observed reason. The publisher adds `PARTIAL REPORT: N evaluated; M unfinished.` If no selection was evaluated, it adds `ANALYSIS INCOMPLETE: 0 evaluated; M unfinished.` and publishes the truthful operational result without inventing decision cards. Do not claim a timeout or usage limit without evidence or call unfinished analysis a successful no-value board. Use the existing run records; this amendment adds no automatic retries, odds pulls, scheduled tasks or durable research store.

The normal feed and event clocks continue to apply throughout. If the bound feed expires or the event starts before a valid final candidate can be completed, disclose the failure under the existing gates; never restamp the odds or loosen the freshness limits.

### Sourced fair estimates, uncertainty and terminal evidence limitations

For markets using the forecast path, seek a supported current fair under the source-first workflow. Supported non-wager market assessments retain the section 6 exception; no universal forecast hunt or range is required for them. A verified model forecast is `sourceEvidence.kind=MODEL` and may support `fairValueBasis=INDEPENDENT_MODEL` without any homemade adjustment. Preserve `MARKET_ANCHORED_MODEL` only when the adopted source/approved method actually combines a market baseline with substantive independent inputs and that basis is explained. Outside publication alone does not make a no-vig quote independent. Existing governed Walters fair records remain eligible only within their current authority.

Use the existing evidence schema as described in `docs/REPORT_EVIDENCE_REQUIREMENTS.md`. The derivation may simply be the checked published probability divided by 100, with direct adoption and any odds conversion shown. A moneyline estimate does not establish a run-line, puck-line, spread or total fair. Do not transfer a probability at 7.5 to 8, infer an Over probability solely from a predicted score, or ignore a push at an integer line.

Retain an explained numerical uncertainty range. Prefer source-published parameter/model uncertainty or relevant published scenario bounds; check what an interval actually measures. A judgmental range remains permitted when its endpoints are grounded in identified applicable forecasts or quantified source scenarios and its limitations are explicit. Source disagreement is a sensitivity range, not a calibrated confidence interval; closely agreeing forecasts do not establish low model error. Do not fabricate a fixed margin, use repeated copies as independent support, or use simulation-count sampling error as the full model-error range. Missing published intervals alone initiate the uncertainty review, not an automatic block. If no defensible range remains after the applicable alternatives, record that specific limitation.

Classify calibration honestly using the current Core framework: `directCalibration=GAP` raises the floor to `ELEVATED`; it does not automatically prohibit evaluation. Apply all other matching rules and the actual independent-support requirement. Core error categories do not supply a universal numerical uncertainty margin. Grade both opposing selections from one coherent supported fair/range against their exact prices.

### Source and fair-value evidence — forward from 17:00 PT September 5

For `run.ts >= 2026-09-05T17:00:00-07:00`, read and apply `docs/REPORT_EVIDENCE_REQUIREMENTS.md` and the additive fields in `data/history/report-provenance-schema.json`. This is shared by all five report lanes. Earlier issued reports remain immutable under their original requirements.

Every displayed card, including PASS, must retain event- and sport-matched `sourceEvidence` with actual URLs, check times and specific findings. Do not copy generic league/source text from another sport. If a source or market genuinely cannot be verified, record the permitted PASS `sourceShortfall` with its decision impact; never invent a source or numeric fair to complete a card.

Every EVALUATED primary decision on the forecast-based path, including a forecast-based PASS, must retain `fairValueEvidence`: the exact selection, units and orientation, numeric inputs linked to the checked sources, method/calculation, final estimate, numeric uncertainty range, limitations and explicit personnel basis. The qualified non-wager `marketAssessment` path instead retains its paired reference and current information review, with `fairValueEvidence: null`. A checked applicable external model forecast can supply the point estimate directly; verify source quality, current assumptions and uncertainty under the process above. The numerical trace documents adoption/conversion of the source estimate, not a requirement to reproduce its predictive model. Do not manufacture a formula or set `personnelRequired=false` to evade material Stage 2 work. If neither permitted assessment basis can be supported, record the exact selection-level limitation and preserve the completed remainder.

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

For a game whose two team bindings are currently resolved, require exactly one matching `QB_PERFORMANCE_PRODUCTION` adjustment on the active board, verify that its home-spread points equal away-team QB delta minus home-team QB delta, and verify the board's exact and displayed fair decomposition before using the Graham fair. Use the durable current board result; never rebuild the QB calculation from memory or market prices. If either team is currently fail closed, record the QB layer as unavailable for that game and do not let Walters originate the candidate; an otherwise valid independent Core review may continue under its own controls. Use the current QB production contract for approved scope. Atlanta is admitted under the September 7 baseline amendment when its applied amendment and current starter binding validate; any subsequently unresolved starter still makes that game unavailable to Walters origination.

The QB layer has no direct BET, status, stake, or gate-bypass authority. The first durably published report containing an NFL evaluation while `postActivationCanary.state=PENDING` is the candidate for `FIRST_NFL_BEARING_BETTING_EDGE_READBACK`. After publication, report its exact history paths and whether each NFL Walters fair matched the same active-board QB production state so the governed canary can be closed. The scheduled report task must not directly edit the QB production manifest, rewrite issued History, or roll back a Graham board.

## 9. Recommendation-card publication and delivery

Complete the major-sport inventory accounting and publish every completed, validated decision. Each issued decision must finish its own required research; unfinished research elsewhere does not block it. For example, five valid evaluated selections and one `RESEARCH_INCOMPLETE` selection publish five unchanged cards with a partial-report notice and the remaining selection documented as unfinished. Continue pursuing the remaining work before delivery; do not require the entire slate to finish as a publication condition.

The publisher derives `coverageSummary.researchCompletion` and the leading partial/incomplete notice in `report.summary` from validated receipts. This is display metadata and may be attached to the frozen bundle without changing decision content, status, price, fair, stake or research evidence. Read-back verifies the notice and counts. Normal terminal blockers, quote-unavailable selections and unfinished research remain distinguishable in the existing coverage details. `READY` means the bundle and its completed decisions are valid for publication, including honest partial publication; it does not mean every selection has a finished handicap.

For source-first reports, follow the source lookup completion instructions in `docs/REPORT_EVIDENCE_REQUIREMENTS.md`: state the count of available primary selections with an applicable published point estimate, the verified evaluated/evidence-blocked counts, and the specific remaining evidence gaps. Derive the sourced-point count from actual extracted numbers and applicability findings in the existing receipts; a retrieved point is not necessarily a completed fair/range or decision. Preserve publisher-owned coverage notices. Check this explanation against durable read-back before delivery, and compare matching selections rather than different slates when claiming evidence graduation.

Count extracted published forecasts separately from qualified market references. A no-vig reference is not an independent published forecast; do not substitute the evaluated-card count for the sourced-forecast count.

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

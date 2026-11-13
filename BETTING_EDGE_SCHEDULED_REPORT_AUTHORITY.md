# Betting Edge Scheduled Report Authority

**Status:** OPERATIONAL
**Authority version:** 1.2
**Operating revision:** 2026-11-12.SlateFocused
**Repository:** fhvsvzpmkw-design/-betting-edge-terminal
**Branch:** main
**Effective from:** 2026-11-13T02:15:00Z (November 12, 19:15 Vancouver)

This is the single operating path for the five existing Main tasks. The user authorized this redesign to reduce usage, preserve card visuals, and answer: what is worth betting on tonight, at an available price, why, and what could change the decision?

The previous accumulated authority is retained in archive/authorities/BETTING_EDGE_SCHEDULED_REPORT_AUTHORITY.2026-11-07.md for historical replay only. Do not load it for routine forward runs. This edition supersedes exhaustive source-catalogue review, slot-based broad research, routine research teams and dated recovery handoffs. It preserves the current analytical routes and the existing executable validators. Resolve schema details in the relevant guide only when authoring that route; do not reload every guide, research catalogue or historical review for every game.

## 1. Main schedule gate and Core production preflight

Use authoritative main and data/main-schedule.json. EXPECTED_REPORT_TIME resolves one of 06:00, 08:00, 09:30, 15:15, 18:15 America/Vancouver. Preserve activation, schedules and timezone. Use actual timestamps with current timezone data; do not hand-code winter offsets. A failure never authorizes disabling or rescheduling a task.

Routine connected GitHub reads, governed checkpoint/request/staging/receipt writes, publication and readback are already authorized. Do not ask again to resume or publish. Respect actual tool-enforced denials and preserve saved work.

Run tools/report-inputs.mjs --at <actual-ISO-timestamp> --report-time <HH:MM>. Inspect workload before source research. NO_UPCOMING_GAMES means no betting research or workers: leave the latest report intact and report the empty current slate honestly. PRICES_UNAVAILABLE means an acquisition limitation, never no value found. SLATE_UNVERIFIED means stale inputs or failed discovery; it cannot establish an empty slate. Keep grading independent.

Resolve Core with tools/core-release.mjs and pin its returned production path/SHA; current production is Core 1.5. The 1.4-named components remain intentional dependencies. Preserve Contract v1.0, Research v1.8, exact source/provenance bindings, current enums, bankroll and risk controls. Read the Core operating contract and relevant evidence schemas when needed; the existing pipeline executes validation. Never invent a release, enum, source clearance, fair, clock or stake.

## 2. Bind current executable prices

The normal report owns its default odds pull. Follow docs/ODDS_RUN_REQUEST.md: reuse an eligible fulfilled exact-slot feed or normally eligible fresh same-day manual feed. Otherwise submit one exact-slot scheduled_recovery request only when no matching submitted/queued/running/failed request already owns the attempt. Verify the request's actual collection, saved feed and slot receipt. Green skipped jobs and queued requests are not successful pulls. No duplicate spending, price-driven refreshes or retry after possible API spend without the established provider/budget check.

Use current bound FanDuel/DraftKings books; preserve historical Bet365 snapshots. Respect docs/ODDSPAPI_BUDGET.md and the existing protected monthly/daily allocation. Missing optional references never authorize extra odds calls.

Preserve exact feed bytes/SHA and oddsSnapshot acceptance at the saved run start. The 75-minute input rule and eligible manual provenance stay in force; quote observation freshness and last-price-change clocks remain distinct. Keep the independent executable/benchmark quote-age checks under docs/ODDS_OBSERVATION_FRESHNESS.md. Retiming cannot refresh source or quote observations. Exclude started events at actual issue time.

Bind event, sport, kickoff, full-game period, side, handicap/total, settlement, bookmaker and selectionKey. Different book lines are separate contracts. Never fill missing or suspended current quotes from an older snapshot.

## 3. Major-sport market coverage

Use derivePrimarySelectionInventory with data/major-sport-market-coverage-v1.json and BETTING_EDGE_MAJOR_SPORT_MARKET_COVERAGE.md. Cover MLB, NHL, NBA/WNBA, NFL, NCAAF and CFL plus eligible professional soccer. NFL, NCAAF and CFL are independently eligible.

Inventory both moneyline sides, both primary spreads, MLB primary run line, NHL primary puck line, and primary Over/Under. Never preselect an underdog, favorite or total direction. Screen the full inventory cheaply, then share research once per game and assess exact contracts. A shortlist is not the full inventory.

### Player props — PAUSED_BY_SCOPE

PRIMARY_FULL_GAME_ONLY remains active. Do not collect, research or carry props from live-odds.events, deepMarkets or baseballProps. Preserve scope accounting: props.state=PAUSED_BY_SCOPE, screened/deep-reviewed=0, excludedByScope=returned. College soccer remains excluded. Crypto's separately authorized combat work is independent.

Unbounded card-output amendment: there is no numeric card minimum, target, profile or maximum. Publish every EVALUATED primary decision unchanged, including PASS, with coverageAudit.presentation mode UNBOUNDED_ANALYSIS_OUTPUT, allEvaluatedPublished=true and fillerAdded=0. Never invent selections to fill cards.

## 4. Pinnacle official sharp benchmark

Use loadBoundMarketObserver and exactMarketReference from tools/market-price-assessment.mjs for exact paired no-vig comparisons. Pinnacle is non-executable sharp context, never independent BET authority or a replacement for an unavailable execution quote. Preserve a valid signed comparison, including disagreement.

The existing exact full-game alternate-total exception retains its exact bookmakerMarketId and referenceKind EXACT_FULL_GAME_ALTERNATE_TOTAL. Other points/periods/settlements never inherit it. A missing reference is a named selection limitation, not a whole-report veto or automatic PASS.

## 5. One saved game assessment, change-only research

The existing report checkpoint and pinned gameIntelligenceInputs are the shared game record. Do not create a parallel research ledger or model. On checkpoint --event-id the controller stores a compact gameAssessments reference to that same evidence. report-inputs and the normal work plan compare content, contracts, execution prices and benchmark inputs with the latest saved review; collection timestamps alone do not count as changed reasoning.

Follow workload.assessments:
- INITIAL_REVIEW: assess the actual game using captured forecasts/picks, personnel and current exact prices.
- RESUME_REVIEW: finish named unfinished work; retain completed observations.
- REPRICE: re-evaluate changed prices using saved research; investigate only a decision-changing issue.
- TARGETED_RESEARCH: check changed contracts, game facts or forecasts and update affected decisions.
- REVALIDATE: reuse reasoning, check present applicability, source clocks, exact prices and named rechecks. Do not restart catalogue discovery.

Every current quote still needs its own current decision/evidence binding. Saved grades, fair values, personnel clearance and forecasts are never automatically inherited. The workload is advisory, not freshness or publication approval. A missing/corrupt saved assessment falls back to review and cannot create a decision. Named rechecks remain visible even when content hashes match.

Start with the coordinator and zero workers at every slot. Up to six priced games use one analyst. A larger slate may justify at most one targeted read-only worker for a named consequential question; no routine team or separate per-market researchers. See data/research-agents/policy.json only if delegation is actually useful. Reuse hockey research for Guy; Graham's independent number generation keeps its own market-free context.

Use captured native forecasts and public expert opinions first. Additional sources answer specific consequential questions or genuine conflicts. Do not open every registered source merely to complete a catalogue, repeat the same failed access attempt without new evidence, rebuild a provider's model, or print entire source ledgers. Preserve source families, original times, native units and contrary evidence. Consensus, descriptive ranges and majority votes are not adopted betting fairs. Applicable strategy guidance and source/results feedback can inform judgment; no compulsory history narration or invented streak adjustment.

Work in start-time order; Sunday's unstarted early NFL group keeps existing priority. Review both teams' material facts once, assess moneyline/spread/total sensitivity separately, save the event, advance. Publish completed work while disclosing real unfinished cases. Do not repeatedly perfect the first game or rerun unchanged validation after no substantive edit.

## 6. Current assessment routes and useful card analysis

BET requires a sourced exact fair/range, conservative-bound and model-error clearance, independent support, current personnel, executable price, playTo, exposure and stake checks.

LEAN is a completed zero-stake directional opinion through the current qualified exact market route, adopted-fair route or reviewed source-led forecast route. Current source-led opinions have no universal Pinnacle, fixed source-count or one-point gate. Original exact forecast replay, settlement/applicability review, explicit uncertainty and an honest provisional label/recheck still apply. Missing BET intervals or ordinary unconfirmed lineups alone do not reject an otherwise eligible provisional opinion. Use docs/FORECAST_DIRECTIONAL_LEANS.md and the existing helpers when authoring these routes.

WAIT requires its existing current independent actionable signal and concrete trigger; retain the HIGH-error support rule. The existing narrow NHL forecast price-WAIT helper remains a separate zero-stake opinion exception. Unfinished work alone is never WAIT.

PASS requires a game/selection-specific reasoned rejection. A price screen, missing optional model or failed BET gate alone is not an authored PASS. RESEARCH_INCOMPLETE remains unfinished work, separately disclosed. Keep $0/NO BET semantics for opinions.

Resolve decision-sensitive personnel through actual team/league and originating reporting sources. Name the projected/confirmed participant and material alternative; an injury list is not full investigation. Retain real fallback failures. Final material rechecks retain finalRecheck=true and original origin/url/asOf. checked=0 does not certify semantic agreement. Football starter questions use docs/QUARTERBACK_FOLLOW_UP.md and the existing QB_STARTER_FOLLOW_UP route. Preserve unknowns rather than assert clearance.

Record source URL, original checked time, specific finding, exact application and limitation once in current cardEvidence/sourceEvidence. Keep exact selectionKey equality across report, sidecar and receipt. Capture discovered exact forecasts through the typed controller intake; never leave a usable point only in prose.

Keep the card layout, statuses, American odds, price limits, stakes and three active meters. View analysis answers four questions:
1. Why this play tonight? State the decisive sourced matchup/news/forecast finding and its application.
2. Why this price? Explain the exact available odds and recorded limit; distinguish model opinion from sharp comparison.
3. Strongest concern? Give the actual contrary finding or consequential uncertainty.
4. Act now or wait? State the current action and named condition that changes it.

Write a few useful sentences, expanding only when the game warrants it. Use existing decisionExplanation, finding/application, contrary and recheck fields; do not duplicate them into another required schema. Sources/timestamps stay in a collapsed drawer. Internal logs, schema/gate descriptions, repeated model disclaimers, team histories and irrelevant statistics do not belong in customer analysis. Applicable History Fit stays read-only and only earns explanation when it changes this decision.

## 7. Walters engine and Graham handoff

For eligible NFL spread/moneyline use current Walters authority and docs/GRAHAM_NFL_FAIR_HANDOFF.md. Other markets use NOT_APPLICABLE. Explicitly adopt, retain as context, reject or document unavailability of native spreads. Points remain points. Never move Graham fair to match Pinnacle or produce BET merely from comparison.

Walters QB production read-back: resolve active-week board and QB contract/current production. Require OPERATIONAL_SCOPED, APPROVED_WALTERS_QB_PERFORMANCE, productionAuthority/grahamWritesAllowed=true and marketViewed=false. Verify exact QB_PERFORMANCE_PRODUCTION adjustment and home spread delta=away QB delta minus home QB delta. A fail-closed starter blocks that game's Walters origination; independent valid routes continue. Resolve any pending FIRST_NFL_BEARING_BETTING_EDGE_READBACK canary with exact board binding. Main cannot change independent numbers or QB production.

## 8. One resumable producer; Publisher ownership

Use tools/report-run.mjs and docs/REPORT_RUN_CONTROLLER.md for exact command syntax. Resume existing saved work; start a new actual-time run only when identity/feed or a sealed run requires it. Persist and remotely verify the initial checkpoint, then each completed event via checkpoint --event-id with the current expected revision. Export large drafts locally; never dump/reconstruct entire checkpoints in chat.

Use next --event-id for the one game's exact quotes, sources and questions. Separate producer-unfinished work, documented source shortfalls, validation and publication. Incomplete proposed decisions or completion labels never count as completed handoff. A source unavailable once stays a named recheck until new information justifies another attempt.

Before issue, retime the unfrozen draft to actual time, reconcile newly started events, and revalidate applicability without changing original clocks. Prepare once, inspect all deferrals/diagnostics together, correct real recoverable defects and continue remaining useful game work. Perform the pre-freeze trace audit using finalized context: exact Core effects/rules/reasons/modelErrorState/betEligibleByModelError must agree. Only deterministic derived traces may be repaired.

Run the shared report-pipeline.mjs gates on exact report/sidecar files, including normal evidence, personnel, Core, candidate, Pinnacle, coverage, continuity, availability and lineage checks. The standalone equivalent includes:
node tools/report-publication.mjs validate --report <report.json> --sidecar <sidecar.json>

Freeze seals exact bytes; stage only data/history/staging/report-bundle.json. Transfer complete integrity-checked compressed bytes; never shrink a candidate by dropping decisions, sources or receipts. Only .github/workflows/report-history-staged.yml owns issued History and run-history.json. Never bypass it or mutate a frozen candidate.

Verify the exact triggering commit's successful publication, fetch main and run controller readback against the indexed report/sidecar. A queued job, saved draft or green skipped workflow is not publication. On failure preserve work and name the failing action; no report link before verified publication.

Deliver a concise list of the actual BET/LEAN/WAIT opportunities and meaningful limitations, with the verified report link. Record available=evaluated+blocked and required=available+unavailable accurately; no completed decisions with an available board is unfinished analysis, not no value. For real partial publication state the named incomplete work and next existing review. Guy uses the same NHL research and his separate existing authority/one-minute pregame lock; publish and verify his supported call promptly without making his shortfall a Main veto. Historical issued bytes, bankroll/ledger ownership, grading and all existing odds budgets remain intact.

# Betting Edge Scheduled Report Authority

**Status:** OPERATIONAL
**Authority version:** 1.2
**Operating revision:** 2026-09-30.2
**Repository:** `fhvsvzpmkw-design/-betting-edge-terminal`
**Branch:** `main`

This is the single current operating sequence for all five Main report tasks. A task supplies `EXPECTED_REPORT_TIME` only. This consolidated edition replaces the accumulated ordering amendments; it is not another parallel workflow. Earlier editions remain in Git history and in issued provenance. Historical reports, decisions and source observations remain immutable.

For reports at/after `2026-09-27T12:00:00-07:00`, this edition controls producer ordering and the observed-forecast exception below. Earlier reports retain their original timing eligibility. Core 1.5 remains the production release. Component files named 1.4 are intentional dependencies, not an instruction to issue Core 1.4 reports.

## Operating precedence

1. This file owns the current producer sequence, scope, completion and delivery rules.
2. `core/CORE_V1_5_OPERATING_CONTRACT.md` owns status meaning and release resolution.
3. The linked domain documents own their field schemas and exact validation rules. Historical review documents explain changes; they are not extra tasks or prerequisites to finish on every run.
4. `BETTING_EDGE_CONTRACT.md` v1.0 remains OPERATIONAL. Its older universal independent-fair and research-first wording does not override the current status-specific market route or sequence here. There is no universal forecast-search completion gate or card quota.

An actual authority/identity conflict must be resolved before using the affected input. Do not treat documented component version differences or explicitly superseded ordering as conflicts. Do not bypass a validator or edit evidence merely to make it pass.

## 1. Main schedule gate and Core production preflight

Read `BETTING_EDGE_MAIN_SCHEDULE.md`, `data/main-schedule.json`, the operating contract, Contract v1.0, and the production manifest from authoritative main. Resolve the exact Main slot for `EXPECTED_REPORT_TIME`. The permanent times are 06:00, 08:00, 09:30, 15:15 and 18:15 America/Vancouver. If no slot matches, do not research, stage, notify or write History. Retain schedule id/name, canonicalSlot, slot, pulseTime, reportTime, label and featuredVigScope.

Resolve the release with `node tools/core-release.mjs <report-timestamp>`. For the current release require `core/core-v1.5-production.json`, `coreVersion=1.5`, `state=OPERATIONAL`; retain its exact provenance. Resolve the current pinned model-error framework, liquidity classification, Research Library v1.8 and manifest, Walters interface/current authority, Pinnacle policy, personnel sweep and primary-market coverage policy. Use their real component IDs and enum values. Missing or genuinely conflicting authority is `PREFLIGHT BLOCK — ANALYSIS NOT STARTED`.

Read schemas as needed for the chosen route: `docs/CANDIDATE_ASSESSMENT.md`, `docs/REPORT_CARD_EVIDENCE.md`, `docs/REPORT_EVIDENCE_REQUIREMENTS.md`, `docs/FORECAST_EVIDENCE.md`, and `data/history/report-provenance-schema.json`. Do not repeatedly reread historical amendment narratives as research work.

## 2. Bind current executable prices

Start with `node tools/report-inputs.mjs --at <actual-report-timestamp> --report-time <HH:MM> --root <repo-root>` for a compact inventory and exact source bindings; add `--event-id <id>` for one event's executable quotes and availability limitations. Process the full feed, observer and histories locally in code; do not print entire datasets into the conversation. This read-only projection runs the canonical inventory selector but is not issuance clearance: `validationState=NOT_RUN`. Existing feed provenance/freshness, evidence, Core and publication validators remain authoritative. Rebuild projections when bound bytes change. No extra odds pull is needed to build them.

Bind exact `data/live-odds.json` bytes, blob SHA and `generatedAt`. Retain the actual clock; never backdate issuance or restamp quotes. Enforce 75-minute feed freshness and 30-minute executable quote age at feed generation. For `quoteObservationVersion:1`, quote freshness uses `observedAt`; provider `updatedAt` remains the last-change clock. Legacy feeds retain their original rule. Read `docs/ODDS_OBSERVATION_FRESHNESS.md`; observation freshness is not price movement.

Executable books are Bet365 and DraftKings. One valid supported book can establish availability; it does not establish value. Bind exact event/start time, full-game period, side, line, settlement and selectionKey. Missing/suspended quotes in the newest successful scope cannot be supplied by older copies. Preserve disagreements between books.

A same-operating-date snapshot explicitly marked `scheduleMeta.triggerSource:manual` may serve any Main lane if normal freshness and identity checks pass. Null canonicalSlot/plannedReportTime and MANUAL markers are valid manual provenance. Resolve the lane from the Main schedule without relabeling the feed. An automatic snapshot must match the lane. Unknown provenance, stale/future prices and conflicting automatic identities remain blocked.

A user-requested recovery keeps the original lane, appends `— RECOVERY` to its label and uses the actual issue time. Follow ordinary staging/read-back. A report task must not refresh odds merely to improve an unattractive result. If freshness fails, report the exact failure; do not present it as research failure or no betting value.

## 3. Major-sport market coverage

Use `data/major-sport-market-coverage-v1.json` and `BETTING_EDGE_MAJOR_SPORT_MARKET_COVERAGE.md`. Main timing never excludes otherwise eligible MLB, NHL, NBA/WNBA, NFL, NCAAF and CFL. NFL, NCAAF and CFL are independently eligible.

Inventory both moneyline sides, both sides of the primary spread, MLB primary run line, NHL primary puck line, and primary total Over/Under. Never preselect an underdog, favorite or total direction. A market or league cannot substitute for another. Use `derivePrimarySelectionInventory`; retain missing/stale/unsafe markets as availability limitations.

### Player props — PAUSED_BY_SCOPE

`PRIMARY_FULL_GAME_ONLY` remains active. Props in `live-odds.events`, `deepMarkets` or `baseballProps` are inventory only: no prop research, fair construction or new/carried prop decisions. Retain `props.state=PAUSED_BY_SCOPE`, screened/deep-reviewed=0, excludedByScope=returned, and the scope fields required by coverage validation. State that player-prop analysis is paused.

### Completion accounting

Each available selection gets an actual EVALUATED receipt or an honest BLOCKED receipt. `RESEARCH_INCOMPLETE` means work remains, not PASS or WAIT. Reconcile available=evaluated+blocked and required=available+unavailable. Include: `Primary selections: N available; N evaluated; N evidence-blocked; N unavailable.`

Unbounded card-output amendment: there is **no numeric card minimum, target, profile or maximum**. Publish every EVALUATED primary decision unchanged, including PASS. Use `coverageAudit.presentation={mode:"UNBOUNDED_ANALYSIS_OUTPUT",allEvaluatedPublished:true,fillerAdded:0}`. Unfinished selections never veto completed unrelated cards. Zero decisions with available inventory means no completed assessments, not a successful search finding no value.

## 4. Pinnacle official sharp benchmark

Load the pinned observer with `loadBoundMarketObserver` and use `exactMarketReference` in `tools/market-price-assessment.mjs`. Require exact current full-game pairing, compatible settlement, active unsuspended quotes, matching event/start time and policy freshness. Use deterministic no-vig comparison at the exact decimal execution price; never manufacture a substitute reference.

The existing exact alternate-total exception remains: an unambiguous matching full-game Over/Under pair at the identical integer or half-point total can qualify even if stored observer annotation says `COMPLETE_TWO_WAY_MAIN_LINE_REQUIRED`. The helper requalifies raw evidence. Retain `referenceKind:"EXACT_FULL_GAME_ALTERNATE_TOTAL"` and exact bookmakerMarketId on all copies. No different line, period/team total, quarter/split total or alternate spread inherits this exception.

Pinnacle is non-executable. It cannot alone originate BET, set stake, replace execution books or overwrite Graham/Core fair. Unavailable Pinnacle is `PINNACLE_BENCHMARK_UNAVAILABLE`, a selection limitation rather than a report-wide veto.

## 5. One research queue, incremental completed decisions

Official personnel observations retain their original clocks and can be reused across lanes for the exact event and kickoff while recent and still applicable. A newer odds snapshot alone does not invalidate them. The event planner surfaces current and prior-lane personnel sources and pinned official MLB observations; review changed dependencies and decision sensitivity once per event. Published probable pitchers are not confirmed starters, and missing final lineups stay unresolved. Preserve dependency-specific source shortfalls under the personnel gate rather than making every missing official observation a universal market-PASS veto. BET retains its existing final personnel checks.

Use `report-run diagnose` to inspect all fourteen read-only candidate gates together. Preparation includes the same diagnostics. Correct actual recoverable problems and inspect all deferrals before freezing; do not repeatedly prepare unchanged evidence or relabel unfinished research as PASS. Freeze and publication keep the existing blocking validation sequence.

1. Screen the entire valid inventory at exact prices. Run `node tools/report-evidence-repair.mjs candidates --report <draft-report.json> --sidecar <draft-sidecar.json> --root <repo-root> --work-plan`. Use `--work-plan --event-id <eventId>` to open one pending event’s exact quotes and source leads. The full audit remains available without `--work-plan`.
2. Work events in start-time order, raising decision-changing opportunities and previously researched candidates within that order. Revalidate the event's recorded source leads and named starter/lineup/injury/conditions facts once. Preserve original source times. A later incomplete receipt must not erase earlier useful research. Earlier findings are review leads, never inherited clearance or grades.
3. After that event scan, finish supported exact paired-market decisions before moving to another event. Do not first exhaust forecasts for all 198 sides or finish all event research before producing any decision. Use the market route when qualified; deepen favorable price cases, actual forecast disagreement, native fair leads and material uncertainties. News may reopen any initially unfavorable screen.
4. Record each decision and its exact evidence immediately. Reuse event facts, not a different side's card, fair, stance or selectionKey. Give opposing sides one coherent basis for the same contract; different lines are separate contracts.
5. Continue through the full queue. Preserve concrete remaining gaps, real attempts, stopping reason and next step. Rerun the work plan after substantive research. `NO_COMPLETED_DECISIONS` requires an explicit source-to-decision diagnosis and a completion attempt on supported leads before final delivery; it is not a new publication veto or a forced-pick quota.

This incremental sequence supersedes the September 20 requirement to finish a breadth-first scan over every event before deeper completion. Inventory breadth is retained; paperwork must not starve actual assessment. The shortlist is not the full queue. An empty shortlist is not a stopping condition.

## 6. Two assessment routes, one decision contract

| Route | Required work | Permitted result |
|---|---|---|
| Qualified exact market comparison | Paired no-vig reference, current event facts, material personnel review, contrary evidence, explicit exact-price judgment | Zero-stake LEAN, justified PASS, or WAIT only with its separate independent actionable signal |
| Supported forecast/native fair | Applicable sourced fair, coherent uncertainty/sensitivity construction, exact settlement/units, current assumptions and price comparison | BET only after all BET checks; otherwise assess LEAN/WAIT/PASS on their own requirements |

The market route does not require an independent model, numerical fair/range or published calibration interval. Missing forecasts do not block an otherwise supported market LEAN/PASS. A favorable comparison needs a reasoned directional judgment; tiny/conflicted advantages can be PASS. A negative quote screen alone cannot manufacture PASS.

A forecast can supply its published point estimate without rebuilding the provider's model. Source-grounded scenario/sensitivity ranges are permitted and must be described honestly; they are not automatically calibrated confidence intervals. No universal point-to-probability conversion, fixed uncertainty width, mandatory min/max across all providers or arbitrary streak/injury adjustment. Missing published intervals starts uncertainty assessment, not automatic rejection of the point. BET requires supported fair/range, conservative-bound clearance, sufficient independent support, model-error eligibility, material personnel, current execution, playTo, exposure and staking checks. A failed BET bound does not automatically mean PASS.

WAIT requires a real current independent signal, plausible actionability and the existing HIGH-error support rule. Work not yet done is not WAIT. An unresolved material fact can support a completed reasoned PASS or qualified WAIT after the actual investigation; unexplained uncertainty remains incomplete. Every LEAN/WAIT has zero stake; market LEAN uses NO BET execution language.

### Personnel: facts and materiality

Follow `BETTING_EDGE_PERSONNEL_SWEEP.md`: Stage 1 current event facts precede final decisions or adopted fair; Stage 2 investigates decision-sensitive dependencies and conflicts. A blank final lineup is not automatically material. Name the actual dependency and its effect. Use official sources and credible fallback depth where needed; do not manufacture clearance by changing flags. Apply new findings back to the handicap, without double-counting news already in a forecast.

For an unresolved material Stage 2 dependency, make the closing authoritative check and retain `finalRecheck: true`, origin/url/asOf and the dependency-specific fact, or an honest authoritative-source shortfall. One real check can support the same dependency on multiple cards. `checked=0` from a semantic check does not prove text/flags agree.

**Quarterback follow-up, forward from 2026-09-28T07:30:00-07:00:** apply `docs/QUARTERBACK_FOLLOW_UP.md` on every report with a material unresolved/projected football starter. The morning clock does not excuse targeted research. Read the pinned personnel-news leads, recheck current team and originating reporter sources, record `personnelEvidence.quarterbackFollowUp`, name the expected/confirmed starter, and separately assess forecast applicability and Graham numeric authority. A generic game page plus an unresolved sentence is incomplete. The controller routes missing research to `QB_STARTER_FOLLOW_UP`; preparation defers only affected selections, and the semantic publication gate verifies completed cards.

### Shared game intelligence comes first

Use `docs/GAME_INTELLIGENCE.md`. The shared collector maintains `data/game-intelligence/current.json` after odds refreshes; it does not consume the odds API budget. `report-run start` pins actual source observations, applicable internal Graham/Walters data and the research catalogue in `sidecar.gameIntelligenceInputs`. Read `next --event-id` to work from the combined dossier: outside model fields, exact book prices, native internal fair lines, current event facts, and knowledge-base references. Published reports retain this same snapshot for source comparison.

Review the full dossier before deciding a game. Explain material agreement and disagreement; preserve native units and model-family dependence. Outside picks, model probabilities, projected scores, book prices and research principles are different evidence types. A descriptive model median/range is not a calibrated fair value or independent confirmation. Apply actual source-grounded reasoning through the existing candidate and forecast evidence contracts; do not silently replace the fair with an average or ignore a contrary source.

Reuse fresh captures across sides and runs. Revalidate event/personnel/settlement applicability once per event, then bind exact selection reviews. The collector does not manufacture those judgments. Exported draft `forecastEvidence.records` includes captured probability fields; add genuine `forecastEvidence.revalidations` using `docs/FORECAST_EVIDENCE.md`, and record each applicable forecast's disposition. A wrong-line forecast remains useful comparison context without becoming the probability for today's different line. Read published model points before evaluating uncertainty.

The compact work plan includes `forecastReviews` even when the event already has completed market cards. Review these captured fields before new source discovery. Inspect the actual record/capture in the exported draft, preserve its times, and append real current-report applicability reviews or concrete shortfalls. For observed pregame snapshots, retain `observedSnapshotReviewed` and `modelTimeLimitation` when justified. A capture without that judgment is found-but-unreviewed, not proof that forecasts were unavailable. Qualified completed cards retain their publication authority; this review queue is advisory. Attribute each personnel fact to its originating source: an ESPN injury listing is REPORTING evidence with its ESPN URL, even when an official game page was also checked. Do not transfer it into an official source's finding.

For NHL, confirm that the Pinnacle collector requested tournament 234. Its live catalogue must identify game markets with `period:result`, including overtime and penalties. Regulation markets and matching-line totals/puck lines cannot substitute. Record catalogue/acquisition failure separately from a genuinely absent Pinnacle price. No extra primary odds pull is authorized merely by an unfavorable result.

When coverage is missing, perform targeted source research using the existing registry and save permitted source captures for reuse. Source acquisition failures do not veto otherwise supported decisions. Dimers currently requires a permitted feed/permission for automated redistribution; do not add a scraper. Other sources marked research/import are not established automated feeds. Source names on the coverage panel never imply completed retrieval.

### Forecast intake before BET qualification

Use the registry's exact market/source routes and real game panels/articles. Capture the actual point and context even when no BET interval is available. A generic page, odds, pick, score projection or Bet Value component is not an extracted outcome probability. Try appropriate alternatives when access fails; record real failures rather than repeating a generic INELIGIBLE sentence for all sides. Searching one board is not 198 independent model searches.

`docs/FORECAST_EVIDENCE.md` owns capture/import fields. Published model time is preferred. From the forward cutoff, a preserved, explicitly reviewed `OBSERVED_PREGAME_SNAPSHOT` may establish exact point availability when the publisher omits calculation time. Keep forecastAt null, original observedAt unchanged and the missing-time limitation visible. Exact event/side/line/settlement, pregame capture and current personnel/freshness review still apply. This is intake eligibility, never calibration or BET authority.

Retain source families and dependence honestly: Cipher copies are one family; market-influenced models are not independent confirmations. A moneyline probability cannot become a cover probability. Preserve integer-line push accounting. Revalidate prior immutable records separately; never use postgame information as earlier evidence. No unapproved scraping or paywall bypass.

### Evidence once, bound to the correct selection

Record source URL, original check time, specific finding, application and limitation for each exact card. Use candidateAssessment and cardEvidence schemas, preserving identical selectionKey bindings across recommendation, sidecar and receipt. Derive presentation with shared preparation. Source quantity, prose length and successful serialization do not establish analytical quality. History Fit remains read-only; gaps there do not block current market assessments or move fair/status/stake.

## 7. Walters engine and Graham handoff

For eligible NFL spread/moneyline use current operational Walters interface and runtime authority. In BET_AUTHORITY, AVAILABLE/current/arithmetic-verified work may originate or contribute a fair within ordinary Core/BET controls. Other markets use NOT_APPLICABLE. Review NFL native spreads through `docs/GRAHAM_NFL_FAIR_HANDOFF.md`; explicitly adopt, retain as context, reject or document unavailability. Native points remain points, not invented probabilities. Never move Graham fair just to agree with Pinnacle.

### Walters QB production read-back

Resolve `data/walters/nfl/active-week.json`, active current-numbers board, QB production contract and `data/walters/nfl/qb-production-current.json`. Require OPERATIONAL_SCOPED, APPROVED_WALTERS_QB_PERFORMANCE, productionAuthority/grahamWritesAllowed=true and marketViewed=false. Verify one exact QB_PERFORMANCE_PRODUCTION adjustment on each resolved game and home-spread delta=away QB delta minus home QB delta; verify board decomposition. A currently fail-closed starter prevents Walters origination for that game, while an independently valid Core route can continue. Never silently average unresolved starters.

If the governed canary remains pending, identify the first published NFL-bearing report for FIRST_NFL_BEARING_BETTING_EDGE_READBACK and verify its exact board binding. The report producer cannot edit QB production, roll back the board or rewrite History.

## 8. One resumable producer

`tools/report-run.mjs` owns producer state. Use `docs/REPORT_RUN_CONTROLLER.md` for the command sequence. After constructing the exact initial draft and source bindings, `start` a uniquely named checkpoint at `data/report-production/checkpoints/<run-id>.json`. Use `next` for the compact full queue and `next --event-id <id>` for one event. Export drafts outside the repository, complete actual research/decisions, and `checkpoint` them after each event with the expected revision. Persist the exact checkpoint through the connected repository so another execution can resume; this path never triggers publication. Read current remote state before resuming. Never reconstruct completed work from prose summaries.

The checkpoint stores the current complete draft and phase atomically. It does not grant analytical clearance. `prepare` performs shared evidence assembly and derived-field normalization; inspect its deferrals before `freeze`. Before final preparation, use `retime` to advance an unfrozen draft to actual issuance time and reconcile event eligibility without changing source clocks. Freeze invokes the single validation plan in `tools/report-pipeline.mjs`. `stage` revalidates, serializes the sealed bytes and writes only the staging bundle. Resume a failed stage with the same frozen bytes. Frozen candidates cannot be edited; a changed issue time/feed/analysis starts a new actual-time candidate. Do not backdate the new candidate.

`report-pipeline.mjs` is the single gate ordering used by the controller, publisher and publication retries. Do not independently reconstruct a second gate list in a task. The domain validators remain the owners of their requirements. Self-tests run in development CI, not repeatedly inside live publication.

### Prepare, validate and freeze details

Read bankroll from the authoritative ledger projection with its blob SHA. Use actual Vancouver issuance time, exact bound feed, Core 1.5 provenance, real counts/risk and all completed decisions. Publisher owns meters and completion display metadata; do not invent them.

Run shared preparation on unfrozen local drafts:

`node tools/report-evidence-repair.mjs prepare --report <draft-report.json> --sidecar <draft-sidecar.json> --root <repo-root>`

Inspect deferrals and complete recoverable work while quote clocks permit. Preparation may synchronize derived copies and defer mismatched/incomplete selections; it cannot obtain missing research or promote grades. Review card findings using `tools/review-card-evidence.mjs`.

Perform the pre-freeze trace audit: recompute all applicable Core rules/effects/reasons/modelErrorState/betEligibleByModelError from finalized context and compare exact derived fields. Correct only deterministic trace errors; never change analytical context to pass.

Run the normal evidence, Core, personnel, Pinnacle, coverage, candidate, continuity, availability and lineage gates on those exact files. In particular:

- `node tools/report-evidence-gate.mjs validate --report <report.json> --sidecar <sidecar.json>`
- `node tools/major-sport-market-coverage-gate.mjs validate --report <report.json> --sidecar <sidecar.json>`
- `node tools/report-publication.mjs validate --report <report.json> --sidecar <sidecar.json>`

Audit moneyline, spread and total lineage using their tools and exact bound feed. Follow current primary lines even when older lines survive as alternates; requalify changed contracts. Verify every displayed moneyline including PASS/new cards against the newest canonical quote. Keep LINE and PRICE movement distinct, preserve book disagreement and original history. Resolve unstarted tracked decisions or explicitly retain quote-unavailable continuity under the existing rules. Never transfer an old LEAN to a changed line automatically.

Freeze only after checks pass. All finished decisions publish; incomplete selections remain separate. Never repair a frozen candidate's analytical content in place.

## 9. Publisher ownership and truthful delivery

The task produces candidates only. Never directly create/update/delete/index `data/history/runs/**`, `data/history/research-fit/**`, or `run-history.json`.

For publication, the controller stages only `data/history/staging/report-bundle.json`: `{schema:1,candidateId:"<report.ts>|<canonicalSlot>",phase:"<canonicalSlot>",report:<complete report>,sidecar:<complete schema-3 sidecar>,state:"READY"}`.

Serialize/parse the complete local file. Commit exact bytes through authenticated Git or the Git-data API populated programmatically from full length-checked bytes; verify returned blob SHA against local `git hash-object`. Never reconstruct from displayed/truncated output. Preserve frozen bytes for retries. Fetch main, confirm the staging commit and blob identity.

`.github/workflows/report-history-staged.yml` alone owns publication and durable read-back. It reads the candidate from the exact triggering commit, not whichever bundle happens to be newest when the job starts. `report-history.yml` is verification-only; its legacy publish path is retired. Inspect the run for the staging commit. A failed gate/transfer is `PUBLICATION BLOCKED — CANDIDATE NOT STORED`; incomplete execution is `PUBLICATION PENDING — CANDIDATE STAGED`. Neither permits a success claim or short link. Do not bypass it with a History write.

After workflow SUCCESS, fetch authoritative main and run controller `readback` against the exact checkpoint. It verifies indexed decision/evidence identity and the shared read-back gates. Never run this against unpublished locally edited History. Read exact indexed report/sidecar from authoritative main. Then give the deterministic terminal link labeled `Open Betting Edge Terminal v1.5 — <report time>`. Report issued decisions/risk, completed versus pending counts and specific remaining limitations from those artifacts. Distinguish raw availability, source attempts, captured forecasts, adopted fairs and completed decisions. A published zero-card report with unfinished inventory is an incomplete analysis, not evidence that all opportunities were rejected. Profitability is measured by prospective results, prices and uncertainty; it cannot be inferred from more BET labels or publication success.

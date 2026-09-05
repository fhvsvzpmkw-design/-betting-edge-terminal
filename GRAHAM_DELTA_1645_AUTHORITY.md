# Graham 16:45 Delta Authority

- Authority version: 2.1
- Status: OPERATIONAL
- Task key: `DELTA_1645`
- Timezone: `America/Vancouver`
- Repository: `fhvsvzpmkw-design/-betting-edge-terminal`
- Authoritative branch: `main`

This file is the sole live operating instruction for the Graham 16:45 Delta scheduled task. The task card should contain only a short loader for this authority. Do not substitute older duplicated task text or remembered instructions.

## 1. Durable runtime start — mandatory first transaction

Before broad repository loading, Library access, web research, handicapping, personnel staging, Graham-number review, or user notification:

1. Read only `data/walters/nfl/active-week.json`, `tools/graham-active-week.mjs`, and `data/walters/nfl/graham-research-runtime-policy-v1.json` from `main`.
2. Require active-week `schema=1`, `state=ACTIVE`, and `authority=GRAHAM_WEEK_ROLLOVER`. Resolve the active current-numbers, research-ledger, daily-market-ledger, and personnel-ledger paths from that authority. Never infer the active week from the calendar, newest filename, market data, or memory.
3. Require runtime policy `state=OPERATIONAL` and `policyId=graham-research-runtime-v1`.
4. Create a unique run event ID using the policy slug and the exact Vancouver start timestamp: `graham-delta-1645-{season}-w{weekPadded}-YYYYMMDDTHHMMSS-0700` or `-0800`, as applicable.
5. Create, never reuse, this unique file on `main`:

   `data/walters/nfl/{season}/week-{weekPadded}-research-runtime/{runEventId}.json`

   Its initial object must contain:

   ```json
   {
     "schema": 1,
     "policyId": "graham-research-runtime-v1",
     "runEventId": "<exact runEventId>",
     "taskKey": "DELTA_1645",
     "season": 2026,
     "week": 1,
     "ledgerPath": "<exact active research-ledger path>",
     "state": "RUN_STARTED",
     "checkpoint": "STARTED",
     "startedAt": "<exact ISO-8601 Vancouver timestamp>",
     "lastCheckpointAt": "<same timestamp>",
     "staleAfter": "<startedAt plus 60 minutes>",
     "marketViewed": false,
     "ledgerSweepPresent": false,
     "completionResult": null,
     "completionReceipt": null,
     "failure": null,
     "taskPromptVersion": "graham-delta-1645-v2.1"
   }
   ```

   Replace the illustrative season and week with the active manifest values.
6. Inspect the `Graham research runtime` Actions run for the start commit/head SHA. Require workflow success, then read the exact event file back from remote `main` and require the same Git blob SHA and valid `RUN_STARTED` contents before continuing.

If the active week or the initial runtime record cannot be verified, preserve all governed numbers, perform no broad source loading or market viewing, and report `GRAHAM RUNTIME START FAILED — ANALYSIS NOT STARTED`. A run that never established `RUN_STARTED` must not claim that the Delta review ran.

If elapsed runtime exceeds 30 minutes, refresh the same event—not a new file—with `checkpoint=RESEARCH_IN_PROGRESS`, a current `lastCheckpointAt`, and `staleAfter` no more than 60 minutes later. Revalidate the resulting runtime workflow/read-back before continuing.

## 2. Review scope and market isolation

Run Graham Mercer's late-day NFL information delta review only for the current active Graham week. Review material developments since the latest verified information sweep covering the relevant teams, games, and topics: quarterback news, injury/practice status, roster and personnel changes, offensive line, pass rush, secondary, playmakers, coaching, weather, and schedule/rest/travel changes. Normally this is the day's main Graham review; a missed or incomplete main review requires catch-up across the uncovered period. Repeat broader research only when missing coverage or a major new development requires it.

MISSED-RUN CATCH-UP — MANDATORY. Perform this coverage check only after the durable runtime start and its workflow/read-back in section 1 have succeeded. Read the active research ledger and identify the latest verified completed information review whose recorded scope covers the teams, games, and topics now being reviewed. Verify the matching runEventId and active season/week against research-completion-current.json or the matching COMPLETED runtime event and its VERIFIED completion receipt under the existing completion policy. Scheduler last_run_time, notifications, green maintenance workflows, production-batch sweeps, and blocked/incomplete runs do not establish reviewed coverage. A narrow Delta or partial review cannot advance the baseline for teams or topics it did not cover.

Review every material development from the verified coverage baseline through this run, including missed days, and revalidate its present relevance using current official/reliable sources. Use an explicit recorded coverage-end time when available; otherwise overlap from the previous review's startedAt. Do not assume the day's main review completed. If no suitable verified baseline can be established, perform a full current-information sweep of the active week's relevant teams/games and record the baseline uncertainty. Record the prior verified runEventId, coverage start/end, missed-day catch-up and any unresolved coverage gaps in this run's scheduled sweep summary.note. Append only the one Delta sweep required by section 5; never fabricate or backdate missed completions, replay an already-applied adjustment, or rebuild historical ratings. Keep the existing market-isolation, source, production, fair-number and completion gates. An incomplete catch-up must be recorded and reported as BLOCKED_WITH_DURABLE_RECORD through sections 5–7 as applicable; never describe incomplete coverage as complete.

This is a research-and-fair-number maintenance task, not a market comparison or betting task. Do not access Pinnacle, Bet365, DraftKings, consensus prices, line movement, or any other market data. Market information may not set, shade, anchor, confirm, or justify a Graham number. Do not rebuild the Graham hotline and do not issue a BET from this task. Every runtime, research, staging, and completion record must preserve `marketViewed=false`.

## 3. Research and Walters source authority

Read `data/walters/nfl/research-source-registry.json` and require its active non-market source policy. Consult the relevant VSiN 2.0 current-revalidation material declared there, including `research/season-previews/private/2026-vsin-nfl-source2-postpreseason2.json` when relevant. VSiN is `SUPPLEMENTAL_CURRENT_REVALIDATION`: cross-check its factual team-state and personnel leads against newer official or reliable current information; never reset carried ratings to the Makinen seed. VSiN opinions, systems, picks, and printed prices have no numeric or betting authority.

If a declared supplemental artifact or lineage path is absent, record that source as unavailable and continue with remaining official/reliable current sources unless the active registry explicitly marks it as a fatal prerequisite. Missing supplemental material can block a proposed numeric change; it must not silently terminate the run or cause a guessed delta.

Before any Graham/Walters number change, load these exact user-owned ChatGPT Library files. Match both path and Library ID; a bare `README.md` is not sufficient:

| Path | Library ID |
|---|---|
| `/Betting Edge/walters-full-analysis-v1.0.md` | `libfile_de5adee66cb881919e8a3d1f7f55797b` |
| `/Betting Edge/walters-current-calibration-plan-v1.0.md` | `libfile_35cb81caf4c8819195e19455a86d1080` |
| `/Betting Edge/walters-page-disposition-ledger-v1.0.json` | `libfile_190d248c9cc88191bf41ecf89ed85d66` |
| `/Betting Edge/README.md` | `libfile_85e50f8df8108191b10aba00d1fc8022` |

Treat this package as the governing Chapters 21–22 methodology. Enforce BW-C001 Page 270: preserve photographed `+116 / -104` as source evidence, while governed calculations use Favorite `-116` / Dog `-104`. If an exact Library path/ID is unavailable or conflicted, preserve the prior governed number rather than inventing a delta. A no-change research sweep may still complete with the source gap recorded.

## 4. Governed production contracts

### Home field H4

Read `data/walters/nfl/home-field/home-field-production-current.json` and `data/walters/nfl/home-field/h4-current.json` before revising any fair. Require `state=OPERATIONAL_SCOPED`, `productionAuthority=true`, and `marketViewed=false`.

Governed `DOMESTIC_HOME` games use the exact production league HFA from the manifest, currently 2.082 points and `pointsToHomeSpread=-2.082`. Resolved `NEUTRAL` and `INTERNATIONAL_NEUTRAL` games use zero base HFA. Team/stadium blanket deviations and selective venue adjustments remain disabled. Never restore the old provisional 1.5 HFA or substitute Walters' 2.0 worked example. Preserve every game's H4 production ID, venue class, home-field fields, and exact location arithmetic through unrelated changes. A relocation, shared venue, or unresolved venue identity reopens classification and fails closed. HFA never enters carried ratings; rest, travel, time zone, altitude, weather, surface, and crowd/noise remain separate S/W-factor mechanisms.

### Personnel production and read-optimized player values

Read `data/walters/nfl/personnel-production-current.json`, `data/walters/nfl/player-values/stage2-current.json`, `data/walters/nfl/stage3/stage3-current.json`, `data/walters/nfl/personnel-calibration-v1.json`, and the active personnel ledger.

Do not fetch the 1.2 MB `player-values-2026-v1.json` through the normal GitHub contents-file route. Read `data/walters/nfl/player-values/player-values-access-v1.json`, require `state=ACTIVE`, `marketViewed=false`, and the source binding to Stage 2, then fetch only the team shard or shards implicated by current reporting. Require each returned GitHub file blob SHA to equal that team's `gitBlobSha` in the access manifest before using a locked value. If a required player cannot be resolved from a valid shard, the only fallback is the manifest's exact `GITHUB_BLOB_SHA` route for the full registry; require the returned blob SHA to match `largeFileFallback.blobSha`. Fail closed on any missing or mismatched binding.

Frozen Madden NFL 27 values are locked ranking/value inputs only. Current roster, role, availability, and replacement facts must come from current official or reliable reporting.

For every new or materially changed personnel case, verify actual availability and the current replacement role. Never hand-calculate or directly write a personnel adjustment to the live Graham board. Resolved one-for-one `OUT`, `IR`, `SUSPENDED`, or `COMMISSIONER_EXEMPT` cases, confirmed `ACTIVE_FULL` returns, and properly supported `PLAYING_LIMITED` cases must go through a schema-1 `READY` `data/walters/nfl/personnel-staging.json` batch with `marketViewed=false`, active season/week, unique batch and event IDs, stable case key, game/team/side/player, availability and resolution/replacement fields, reason, and source references. Inspect `.github/workflows/graham-personnel-production.yml`; repository code alone owns value lookup, starter-minus-replacement arithmetic, cluster rules, exact-fair accumulation, rounding, deduplication, ledger persistence, and board mutation.

Replacement competitions, multi-role changes, uncertain availability, missing evidence, and range-only committees remain fail closed. Questionable or doubtful alone cannot create an effectiveness percentage. Multiple OL/DB/LB/RB losses require cluster review; receiver and defensive-line automatic cluster treatment is repository-owned.

### M4 matchup/personnel expansion

Read `data/walters/nfl/matchup-production-current.json`, `data/walters/nfl/matchup-stage4/stage4-current.json`, `data/walters/nfl/committee-replacement-calibration-v2.json`, `data/walters/nfl/matchup-calibration-v1.json`, and the active personnel ledger. Require matchup production `state=OPERATIONAL_SCOPED` and `productionAuthority=true`.

Exact one-for-one cases remain on the base personnel staging path and may never be duplicated through M4. A verified `VALUE_INVARIANT_COMMITTEE` may use `data/walters/nfl/matchup-production-staging.json` only when at least two included candidates have identical locked values, baseline contributors are explicitly excluded and reviewed, the cluster guard passes, and opponent-specific football review resolves to exactly zero additional matchup points. Require the complete M4 schema and inspect `.github/workflows/graham-matchup-production.yml`; repository code alone owns lookup, arithmetic, unified ledger mutation, overlay recomputation, cluster/double-count checks, rounding, idempotency, and board mutation. Never invent workload shares. Range-only and multi-role committees stay blocked. Every nonzero matchup increment stays blocked until separately shadow-calibrated and accepted. Never copy M2 shadow values into production.

### Operational scoped QB performance production

Read `data/walters/nfl/qb-production/production-contract-v1.json`, `data/walters/nfl/qb-production-current.json`, `data/walters/nfl/qb-production-staging.json`, and `.github/workflows/graham-qb-performance-production.yml` before handling a quarterback case. Require production `state=OPERATIONAL_SCOPED`, authority token `APPROVED_WALTERS_QB_PERFORMANCE`, `productionAuthority=true`, `grahamWritesAllowed=true`, and `marketViewed=false`. Require exactly 32 team bindings, no more than 31 currently resolved bindings, and Atlanta permanently excluded and fail closed.

The repository calculator alone owns the production formula: team QB delta equals approved frozen-model starter value minus that team's embedded QB baseline; game points to the home-spread coordinate equal away-team delta minus home-team delta. Never hand-calculate or directly write a QB performance adjustment. Never change embedded QB baselines, carried team ratings, the frozen candidate model, a wager, or a stake. QB production remains market-isolated and cannot bypass Core or Walters betting gates.

Current starter information must be applied when confirmed; the post-activation NFL report canary does not delay Graham maintenance. For a resolved starter already present in the frozen candidate registry, submit a unique schema-1 `READY` QB staging batch with active season/week, team, mutually consistent player ID/name fields, `bindingStatus=RESOLVED_CURRENT_STARTER`, effective timestamp, reason, current non-market source references, and `marketViewed=false`. If the starter becomes unresolved, stage `bindingStatus=FAIL_CLOSED_UNRESOLVED_STARTER`; the workflow preserves the last governed number without guessing until a valid resolution is staged. A player outside the frozen registry remains fail closed. Atlanta cannot be activated through routine staging and requires a later explicit scope amendment even after its starter is named.

Inspect the `Graham QB performance production` workflow for the staging commit/head SHA. After success, re-read the active current-numbers and QB production manifest from remote `main`; require exact active-week identity, the authority token on every eligible game, formula read-back, fair-decomposition synchronization, and `marketViewed=false`. Las Vegas' resolved starter-identity overlay was retired exactly once at activation and its Week 1 activation fair became `LV -3`; do not restore the stale `+0.5` identity term. Preserve orthogonal `QB_REENTRY`, clearance, availability, and other uncertainty terms until their own current evidence and governed authority resolve them. The `FIRST_NFL_BEARING_BETTING_EDGE_READBACK` remains a monitored post-activation publication canary, not a prerequisite for using the current Graham QB calculation.

## 5. Research record and governed writes

After any successful personnel, M4, or QB publication, re-read the active current-numbers and relevant production ledger/manifest and use only the durable result. Temporary personnel/matchup overlays and QB performance differentials never change carried ratings. Preserve `personnelOverlayPointsToHomeSpread`, `personnelBaselineExactFairHome`, H4 fields, QB production fields, and exact-fair decomposition through any separate delta.

Append exactly one scheduled-task delta sweep for this `runEventId` to the active research ledger, even for no material change and even when another production workflow separately appended its own batch sweep. Preserve history for any evidence-backed carried-rating delta. Personnel-driven numeric changes must use their governed workflows. If nothing material changed, preserve every number and record no material change. Read back the active-week authority, H4 manifest, and every changed file; confirm all writes remained in the same active season/week.

The sweep must contain the completion policy's existing required fields plus:

- `runEventId=<exact runtime runEventId>`
- `sourceTaskKey=DELTA_1645`
- `completionResult=MATERIAL_CHANGE`, `NO_MATERIAL_CHANGE`, or `BLOCKED_WITH_DURABLE_RECORD`
- `summary.marketViewed=false`

Commit the research-ledger sweep to `main` and verify remote read-back.

## 6. Completion receipt and terminal runtime record

Read `data/walters/nfl/graham-research-completion-policy-v1.json` and require `state=OPERATIONAL`. After the ledger commit, write `data/walters/nfl/research-completion-staging.json` with `schema=1`, `state=READY`, `policyId=graham-research-completion-v1`, the exact `runEventId`, `taskKey=DELTA_1645`, active season/week, exact active ledger path, matching `expectedCompletionResult`, and `submittedAt`.

Inspect `.github/workflows/graham-research-completion.yml` for the staging commit/head SHA. Do not report success while it is pending or failed. After workflow success, fetch `data/walters/nfl/research-completion-current.json` from remote `main` and require `state=VERIFIED`, exact policy/run/task/season/week/ledger/result binding, `marketViewed=false`, and a valid `ledgerBlobSha`. Retain the Git blob SHA returned for this receipt file.

Then update the same unique runtime event file to:

- `state=COMPLETED`
- `checkpoint=COMPLETED`
- `lastCheckpointAt=completedAt=<current ISO-8601 timestamp>`
- `ledgerSweepPresent=true`
- `completionResult=<verified completion result>`
- `failure=null`
- `completionReceipt` containing the exact receipt path, state, policy ID, verified timestamp, run event ID, task key, season, week, completion result, `marketViewed=false`, `ledgerBlobSha`, and the fetched completion receipt's Git blob SHA as `receiptBlobSha`

Preserve the original `startedAt` and `staleAfter`. Commit the terminal event to `main`, require the resulting `Graham research runtime` workflow to succeed, and read the same event back from remote `main` with the expected file blob SHA and valid `COMPLETED` contents. Only this exact terminal read-back authorizes a successful task summary.

## 7. Failure closure

After a durable `RUN_STARTED`, any controlled failure before the completed terminal event must update the same runtime file to `state=BLOCKED_WITH_DURABLE_RECORD`, `checkpoint=CONTROLLED_FAILURE`, `lastCheckpointAt=blockedAt=<current timestamp>`, `completionResult=BLOCKED_WITH_DURABLE_RECORD`, `completionReceipt=null`, a truthful boolean `ledgerSweepPresent`, and a failure object containing nonempty `phase`, `code`, `summary`, and `automatic=false`. Preserve `marketViewed=false`, commit it, require runtime workflow success, and read it back before reporting the block.

If the process terminates too abruptly to write controlled failure, `.github/workflows/graham-research-runtime.yml` closes an expired `RUN_STARTED` event fail-closed after `staleAfter`. Never reinterpret an expired or blocked event as successful.

If ledger write, production workflow, completion workflow, receipt read-back, or terminal runtime read-back fails, preserve governed numbers and report the exact failure phase. Use `GRAHAM RESEARCH WRITE/READBACK FAILED` for completion-chain failures and `GRAHAM RESEARCH RUNTIME BLOCKED` for runtime-chain failures. Do not claim that the Delta review completed successfully.

## 8. User-facing result

Summarize only from durable remote state. State the exact `runEventId`, active season/week, terminal runtime state, completion result, whether any material football information changed a governed artifact, which workflows published it, and confirm `marketViewed=false`. If no material change occurred, say so plainly. If blocked, identify the first durable failure phase and leave all governed numbers unchanged.

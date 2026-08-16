# Betting Edge — Project State

**Last updated:** 2026-08-15 — v1.8 candidate ready; promotion held for v1.7 soak  
**Repository:** `fhvsvzpmkw-design/-betting-edge-terminal`  
**Primary branch:** `main`

This document is the practical snapshot of what Betting Edge is *right now*. It is not a replacement for the governance contract. Update it when the active architecture, runtime boundaries, major versions, or operating assumptions change.

## Current production surface

- **Production governance:** `BETTING_EDGE_CONTRACT.md`, Betting Edge contract **v0.9 OPERATIONAL**.
- **Production contract blob at activation:** `27e485c3974fb6ef78e3fbf8036d81281c440a0b`.
- **Live acceptance record:** `BETTING_EDGE_V0.9_ACCEPTANCE_2026-08-15.md`.
- **Runner:** `runner.html`, Betting Edge Terminal **v1.3**.
- **Static shell:** `index.html`, aligned to UI **v1.3**.
- **Quick runner backup:** `runner.html.old`.
- **Authoritative rollback system:** Git history. Named `.old` files are convenience backups only.
- **Live odds feed:** `data/live-odds.json`.
- **Betting ledger:** `data/betting-ledger.json`.
- **Issued-run index:** `run-history.json`.
- **Durable history documentation:** `data/history/README.md`.
- **Compact odds provenance index:** `data/history/odds-index.json`.
- **Research/provenance sidecar schema:** `data/history/report-provenance-schema.json`, production schema **3** for post-cutover runs; historical schema-2 sidecars remain valid.

The runner loads `index.html`, consumes an encoded run payload from the URL hash, and uses `data/live-odds.json` for repricing. Browser/device-local runner history remains a separate fallback/cache alongside repository-backed same-day history. Player props may additionally carry the runner-supported `rec.feed` structured identity required by v0.9; otherwise the visible payload remains compact.

Current UI terminology deliberately separates the two history concepts: the Board uses **`SAME-DAY RUNS // REPORT HISTORY`** for same-date issued report/session history, while F3 is labeled **`BET HISTORY`** for personal ledger/performance history. **`CLEAR LOCAL HISTORY`** clears only browser-local runner history; it does not delete repository-backed issued reports or `run-history.json`.

## Daily report sessions

The standard Betting Edge report windows are:

- 06:00
- 08:00
- 09:30
- 15:15
- 18:15

The corresponding target odds-refresh slots are approximately:

- 05:45
- 07:45
- 09:15
- 14:55
- 17:55

The GitHub workflow uses paired/backup cron attempts around those target slots rather than trusting a single scheduled dispatch.

All five report tasks are being cut over to a mandatory production-contract preflight: resolve `BETTING_EDGE_CONTRACT.md` v0.9 operational and the current runner before handicapping; otherwise stop with `PREFLIGHT BLOCK — ANALYSIS NOT STARTED`.

## Odds pipeline

The active production refresh workflow is `.github/workflows/odds-refresh.yml`.

Current core properties:

- Source API: Odds-API.io v3.
- Primary books: **Bet365** and **DraftKings**.
- Covered sport families include soccer/football, American football, basketball, baseball, ice hockey, tennis, boxing, and MMA.
- Scheduled jobs more than **25 minutes late** for their intended slot are treated as zombies and exit before spending API quota.
- The workflow has a hard request ceiling of **70**, with a safety reserve and early-stop controls.
- Invalid refreshes are designed not to replace a previously good live-odds snapshot.
- Structured event/market/selection identity is preferred over title parsing.

A separate post-refresh workflow exists:

- `.github/workflows/odds-history-index.yml` — **Index Betting Edge odds history**.

It is intentionally isolated from the production refresh. After a successful odds-refresh workflow it builds/updates `data/history/odds-index.json` with compact provenance such as generation time, snapshot commit, exact Git blob SHA and SHA-256. The full odds snapshot remains in Git history and is not duplicated. A failure in this indexing workflow must not prevent the live odds snapshot from being published.

Scheduler diagnostics remain separate from both workflows:

- `.github/workflows/scheduler-canary.yml`
- `.github/workflows/scheduler-canary-v2.yml`
- `.github/workflows/scheduler-canary-v3.yml`

The canaries are diagnostics and make no odds API requests.

## Durable report history

Validated issued report payloads are stored under:

`data/history/runs/YYYY-MM-DD/<slot>-<timestamp>.json`

`run-history.json` is the compact index. The stored issued payload is authoritative for what the report actually recommended.

Structured research/provenance detail is stored separately under:

`data/history/research-fit/YYYY-MM-DD/<slot>-<timestamp>.json`

The sidecar uses the exact issued slot/timestamp to link back to the report. Post-cutover schema-3 sidecars record the authoritative production contract version/path/blob SHA along with runner, feed and Research Library provenance. Historical schema-2 sidecars from before the cutover remain immutable valid evidence.

The 2026-08-15 15:15 + 18:15 live acceptance pair passed exact payload archive, matching sidecar, correct `run-history.json` linkage, normal runner delivery, source-backed same-day lineage/navigation, and reprice-overlay regression checks. The acceptance is recorded in `BETTING_EDGE_V0.9_ACCEPTANCE_2026-08-15.md`.

All five scheduled report lanes — 06:00, 08:00, 09:30, 15:15 and 18:15 — now share the production durable-history behavior. The next operational observation is the first full post-cutover day, particularly that a fresh device arriving later can hydrate all earlier successfully archived same-day lanes.

## Runner repricing model

The issued report is immutable. Repricing is an **overlay/comparison**, not a rewrite of the original recommendation.

Current runner principles include:

- live feed URL: `./data/live-odds.json`;
- maximum quote age for repricing: **30 minutes**;
- book priority: Bet365, then DraftKings;
- if equal best prices are tied and the issued book is one of the tied books, retain the issued book;
- otherwise use the configured book priority;
- structured identity first, title parsing only as fallback;
- exact player-prop line/selection identity when `rec.feed` is present;
- all five scheduled report lanes preserve exact `rec.feed` identity for every displayed moneyline, spread and game total issued after the 2026-08-16 identity hardening;
- archived game cards without `rec.feed` remain compatible through fail-closed fallback matching, whose event-time parser accepts `a.m.` / `p.m.` and existing 24-hour PT forms;
- unresolved comparisons remain explicit rather than being forced into a false match.

The current comparison vocabulary distinguishes matched movement from unresolved states. If the literal word `UNCATEGORIZED` appears in a future report, investigate the run/report payload layer as well as the runner rather than assuming the current repricing UI generated it.

Runner-side `UPDATE ODDS / REPRICE NOW` remains client-side comparison state. Individual browser reprice clicks are not represented as centrally archived repository history. The accepted 18:15 regression correctly returned `NO NEWER ODDS SNAPSHOT` without mutating the report.

## Research Library

Current research state:

- Library: **Betting Edge Research Library 1.7**.
- **Production runtime authority remains v1.7** during the soak period.
- A complete **v1.8 promotion candidate exists in staging only**: 120 logical items, 100 source records and 26 evidence clusters.
- Candidate Freeze R2 structural inventory passed **24/24**; frozen History Fit narrative tests passed **15/15**; hard-boundary tests passed **9/9**.
- v1.8 promotion is explicitly **ON HOLD** pending v1.7 operational soak, same-candidate shadow comparisons and later explicit approval.
- v1.8 shadow output may be compared with live v1.7 History Fit but may not modify any issued report, fair value, play-to, status, model error, stake or executable price.
- Canonical library status: `R1_CANONICAL_READ_ONLY`.
- Production contract compatibility: **v0.9 operational**.
- R2 manual-read suite: **PASS** at `research/tests/R2_MANUAL_READ_TEST_2026-08-15.json`.
- The test covered direct/mixed MLB movement evidence, NBA era-drift conflict handling, and an explicit boxing-derivative research gap that correctly returned NR.
- Runtime Research Library writes required: **false**.
- Scheduled-report linkage: **true across all five lanes**.
- Current mode: `R3_LIVE_READ_ONLY_HISTORY_FIT_WITH_HISTORY_SIDECAR`.
- Next stage: `V1_7_PRODUCTION_SOAK_WITH_V1_8_SHADOW_COMPARISON`.

`research/manifest.json` is the authoritative pointer for current tested compatibility. The internal `research-library.json` header preserves historical metadata from when the canonical library was built; that historical header is not rewritten merely to advance production compatibility metadata.

The Research Library remains read-only. Scheduled history writes go to `data/history/...`, not `research/*`.

## Governance contract

Authoritative production contract:

`BETTING_EDGE_CONTRACT.md` — **v0.9 OPERATIONAL**.

The production file incorporates the exact v0.8 baseline, v0.9 durable-history/provenance delta, and player-prop identity delta by fixed Git blob identity and defines conflict precedence. The draft files remain historical design artifacts and are not independently operational.

The principal v0.9 production additions are:

1. mandatory production-contract/runner preflight before handicapping;
2. exact issued-report immutability and archive authority;
3. Research Fit/provenance sidecars linked to the exact issued report;
4. production-contract blob provenance in new sidecars;
5. compact Git-backed odds-snapshot indexing without full-feed duplication;
6. history-save failure isolation from live report delivery;
7. a dedicated **H-track** for durable issued-report/market provenance;
8. explicit separation of H-track history from future S-track / Shadow History;
9. source-backed same-day lineage and archive-backed session navigation;
10. compact deterministic share links with validated long-link fallback;
11. exact executable player-prop identity preserved in `rec.feed` and durable history;
12. later result/CLV enrichment remains a separate future observation layer.

## Activation state summary

- **C-track:** C1 — v0.9 production contract operational.
- **R-track:** R3 — live read-only History Fit on production v1.7 with durable sidecar provenance; v1.8 is frozen staging-only pending soak/shadow comparison and explicit promotion approval.
- **H-track:** H3 — live issued-report/provenance history; Evening/Late archive/index/lineage acceptance passed; full five-lane day remains to be observed post-cutover.
- **S-track:** S0 — Shadow History remains inactive.

## Known-good checkpoints

A key rollback checkpoint from **2026-08-11** remains preserved as project history:

- a manual odds pull completed successfully;
- the newly pulled odds propagated through the pipeline;
- the terminal displayed the updated odds correctly;
- UI/layout experimentation was intentionally paused at that point.

A second checkpoint is the **2026-08-15 v0.9 acceptance pair**:

- 15:15 exact report archive + sidecar + index succeeded;
- 18:15 exact report archive + sidecar + index succeeded;
- 18:15 used the stored 15:15 run for same-day history/lineage;
- the runner rendered the meter-only UI change normally;
- Reprice Now remained a non-mutating comparison overlay;
- v0.9 was then explicitly promoted to production.

Use Git history and these checkpoints to distinguish future regressions from previously working pipelines.

## Repository-write capability

As of 2026-08-15, the connected GitHub integration can create, update, commit, read back, and delete repository files directly on `main`. A fresh create/read/delete capability check was completed immediately before v0.9 promotion, and temporary probe files were removed.

All direct changes follow the safety policy in the root `README.md`: fetch current state first, preserve rollback information, make narrow changes, compare before/after, validate, commit clearly, read back, and verify Pages/Actions when relevant.

## Operational boundaries

The following boundaries are intentional and should not be crossed casually:

- Do not couple Research Library **writes** to normal report runs.
- Do not promote Research Library v1.8 merely because the staging validation package is green; complete the v1.7 soak/shadow gate and obtain explicit promotion approval first.
- Do not treat the v0.8/v0.9 draft files as production authority; `BETTING_EDGE_CONTRACT.md` is authoritative.
- Do not place bulky structured research metadata into the runner payload; player-prop `rec.feed` identity is the narrow approved structured addition.
- Do not let odds-history indexing interfere with the production odds-refresh workflow.
- Do not interpret the v0.9 cutover as activation of Shadow History.
- Do not mix scheduler/odds-refresh changes with UI changes unless the change truly spans both systems.
- Do not rewrite an issued report during repricing or later history enrichment.
- Do not claim browser-side reprice clicks are centrally archived until a safe authenticated persistence path exists.
- Do not consume API quota for clearly stale scheduled jobs.
- Do not replace a good feed with an invalid refresh.
- Do not treat tomorrow's full five-lane archive observation as permission to silently weaken the production contract if one lane fails; diagnose the specific delivery/history path instead.

For daily procedures see `docs/OPERATIONS.md`. For architectural choices see `docs/DECISIONS.md`. For planned work see `docs/ROADMAP.md`.

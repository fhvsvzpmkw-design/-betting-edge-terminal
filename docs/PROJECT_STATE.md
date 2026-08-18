# Betting Edge — Project State

**Last updated:** 2026-08-17 — runner UI v1.4 Syndicates release  
**Repository:** `fhvsvzpmkw-design/-betting-edge-terminal`  
**Primary branch:** `main`

This document is the practical snapshot of what Betting Edge is *right now*. It is not a replacement for the governance contract. Update it when the active architecture, runtime boundaries, major versions, or operating assumptions change.

## Current production surface

- **Production governance:** `BETTING_EDGE_CONTRACT.md`, Betting Edge contract **v0.9 OPERATIONAL**.
- **Production contract blob at activation:** `27e485c3974fb6ef78e3fbf8036d81281c440a0b`.
- **Live acceptance record:** `BETTING_EDGE_V0.9_ACCEPTANCE_2026-08-15.md`.
- **Runner presentation:** `runner.html`, VigScope Terminal UI **v1.4**.
- **Report engine/core:** `runner-core.html` and `index.html`, report engine/UI core **v1.3**.
- **Quick runner backup:** `runner.html.old`.
- **Authoritative rollback system:** Git history. Named `.old` files are convenience backups only.
- **Live odds feed:** `data/live-odds.json`.
- **Betting ledger:** `data/betting-ledger.json`.
- **Issued-run index:** `run-history.json`.
- **Durable history documentation:** `data/history/README.md`.
- **Compact odds provenance index:** `data/history/odds-index.json`.
- **Research/provenance sidecar schema:** `data/history/report-provenance-schema.json`, production schema **3** for post-cutover runs; historical schema-2 sidecars remain valid.
- **Manual report-lane recovery:** active operating capability under `docs/OPERATIONS.md` and Decision D-028; recovery remains inside the original five-lane model.
- **F5 Syndicates:** active presentation capability driven by external `data/syndicates.json`; four independently editable Syndicate feed pages load inside the runner workspace.

The runner loads `index.html`, consumes an encoded run payload from the URL hash, and uses `data/live-odds.json` for repricing. Browser/device-local runner history remains a separate fallback/cache alongside repository-backed same-day history. Player props may additionally carry the runner-supported `rec.feed` structured identity required by v0.9; otherwise the visible payload remains compact.

The active version boundary is deliberate: `runner.html` owns presentation/UI version **v1.4**, the report engine/core remains **v1.3**, and the production governance contract remains **v0.9**. The v1.4 promotion is a presentation/product-surface release and does not imply an engine or contract promotion.

Current UI terminology deliberately separates the two history concepts: the Board uses **`SAME-DAY RUNS // REPORT HISTORY`** for same-date issued report/session history, while F3 is labeled **`BET HISTORY`** for personal ledger/performance history. **`CLEAR LOCAL HISTORY`** clears only browser-local runner history; it does not delete repository-backed issued reports or `run-history.json`.

UI v1.3.1 established the accepted responsive hierarchy: F1–F4 sit directly beneath the terminal header; the duplicated upper Bankroll/New Risk/Bet/Lean/Wait-Pass strip is removed; bankroll remains as a compact header readout; New Risk is nested inside the BET counter; and navigation/outcome grids use four columns when space permits and 2 × 2 layouts at narrower iPad and iPhone widths. UI v1.4 preserves that hierarchy and adds the F5 Syndicate workspace, external manifest-driven nameplates/avatars, and independent feed pages. The current four presentation identities are Muddy’s Number, Larry Lombardo, Bill Weston and Jesse Bains / The Delphoria Sheet. Bill Weston is the Syndicate personality reserved for Walters-intelligence presentation. These changes do not alter issued payloads, browser history keys, durable archive schemas, odds/repricing logic, status/stake semantics or report-generation rules.

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

All five report tasks use the mandatory production-contract preflight: resolve `BETTING_EDGE_CONTRACT.md` v0.9 operational and the current runner before handicapping; otherwise stop with `PREFLIGHT BLOCK — ANALYSIS NOT STARTED`.

If a standard report lane does not produce a usable issued report while its betting window still has practical value, a manual **same-lane recovery** may be issued. The recovery keeps the original slot, appends `— RECOVERY`, uses the actual recovery timestamp, obeys all normal v0.9 freshness/identity/value/risk gates, and is archived as a separate immutable issuance. Recovery is not a sixth report session and does not itself require another odds API pull when a valid feed already exists.

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

All five scheduled report lanes — 06:00, 08:00, 09:30, 15:15 and 18:15 — share the production durable-history behavior. On 2026-08-16 the 15:15 Evening and 18:15 Late / West Coast lanes were both successfully recovered manually using the same immutable payload + schema-3 sidecar + `run-history.json` path. Both recoveries preserved zero risk when candidates failed ordinary value and/or executable-price gates. The next observation is continued normal five-lane operation plus additional recovery evidence if future misses occur; no recovery automation or contract promotion is implied yet.

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
- The first real same-candidate v1.7/v1.8 shadow comparison is recorded at `research/staging/V1_8_SHADOW_COMPARISON_2026-08-16.json`: five real 2026-08-16 report runs, 14 issued-card observations and six unique candidates.
- That first shadow comparison produced **0 upgrades, 0 cross-letter-band downgrades, 2 within-B-band softenings and 4 unchanged grades**, with no production recommendation, status, stake, fair-value or play-to changes.
- The primary soak finding is interpretive: **observed line movement is not synonymous with sharp/informed action**. v1.8 adds bookmaker order-flow/demand evidence that should temper movement-heavy History Fit language without discarding direct sport/market evidence.
- v1.8 also correctly refused wrong-market transport: its new WNBA player-prop evidence did not fill the WNBA game-moneyline gap, and European soccer market-structure evidence did not become direct MLS three-way price-band calibration.
- v1.8 promotion remains explicitly **ON HOLD** pending additional real same-candidate shadow comparisons and later explicit approval.
- v1.8 shadow output may be compared with live v1.7 History Fit but may not modify any issued report, fair value, play-to, status, model error, stake or executable price.
- Canonical library status: `R1_CANONICAL_READ_ONLY`.
- Production contract compatibility: **v0.9 operational**.
- R2 manual-read suite: **PASS** at `research/tests/R2_MANUAL_READ_TEST_2026-08-15.json`.
- The test covered direct/mixed MLB movement evidence, NBA era-drift conflict handling, and an explicit boxing-derivative research gap that correctly returned NR.
- Runtime Research Library writes required: **false**.
- Scheduled-report linkage: **true across all five lanes**.
- Current mode: `R3_LIVE_READ_ONLY_HISTORY_FIT_WITH_HISTORY_SIDECAR`.
- Next stage: `CONTINUE_V1_7_SOAK_WITH_VARIED_V1_8_SHADOW_COMPARISONS`, prioritizing real NFL and player-prop candidates where v1.8 contains more genuinely new direct evidence.

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

Manual same-lane report recovery is currently an **operating procedure and durable project decision**, not an amendment to the v0.9 contract. It may be considered for future contract promotion only after additional live evidence and/or a decision to automate or guarantee recovery behavior.

The first v1.8 shadow comparison is likewise an **evaluation observation**, not a production-library promotion. That evaluation itself did not change Contract 0.9, the production v1.7 manifest/library, the report engine, scheduler or odds workflow; UI v1.4 remains presentation-only with respect to those systems.

## Activation state summary

- **C-track:** C1 — v0.9 production contract operational.
- **R-track:** R3 — live read-only History Fit on production v1.7 with durable sidecar provenance; first real v1.8 same-candidate shadow comparison completed positively but promotion remains on hold pending broader real-slate evidence and explicit approval.
- **H-track:** H3 — live issued-report/provenance history; scheduled-lane history is operational and the 2026-08-16 Evening/Late same-lane recovery pair also passed archive/sidecar/index handling.
- **S-track:** S0 — Shadow History remains inactive. The v1.8 Research Library shadow comparison is a staging evaluation and does not activate S-track Shadow History.

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

A third checkpoint is the **2026-08-16 same-lane recovery pair**:

- the missed 15:15 Evening lane was recovered as `15:15 EVENING — RECOVERY` with its actual recovery timestamp;
- the missed 18:15 Late / West Coast lane was recovered as `18:15 LATE / WEST COAST — RECOVERY` with its actual recovery timestamp;
- both recoveries used the existing lane codes and normal immutable history/sidecar/index path rather than creating a sixth lane;
- both preserved the ordinary v0.9 freshness, identity, fair-value and zero-risk safeguards;
- the observed pair established the manual recovery runbook now documented in `docs/OPERATIONS.md` and Decision D-028 without changing the production contract, runner, scheduler or odds workflow.

A fourth checkpoint is the **2026-08-16 first real v1.7 vs v1.8 shadow comparison**:

- the same real candidates from all five issued/recovered report lanes were compared without modifying issued reports;
- six unique candidates were evaluated across 14 issued-card observations;
- v1.8 produced no upgrades and no cross-letter-band downgrades; White Sox and Red Sox movement-heavy History Fit softened from B to B-, while Rays stayed B and the WNBA/MLS direct-calibration gaps stayed NR;
- the shadow result improved caution/transportability language without creating a bet or changing price, fair value, play-to, status or stake;
- the comparison is preserved at `research/staging/V1_8_SHADOW_COMPARISON_2026-08-16.json` and is positive evidence for continued soak, not sufficient evidence for promotion.

A fifth checkpoint is the **2026-08-17 runner UI v1.3.1 hierarchy acceptance**:

- F1–F4 were moved directly beneath the terminal header;
- the duplicated upper status strip was removed, bankroll was reduced to a compact header readout, and New Risk was moved into the BET counter;
- full-width iPad landscape, narrower iPad layouts and iPhone portrait behavior were visually verified;
- four-column layouts remain active when space permits, with 2 × 2 navigation and outcome grids at narrower widths;
- the report engine remains v1.3 and Contract 0.9, issued payloads, history keys, archive schemas, odds logic and decision/stake behavior remain unchanged.

A sixth checkpoint is the **2026-08-17 runner UI v1.4 Syndicates release**:

- the known-good v1.3.2 runner was promoted to v1.4 by changing only the four runner version declarations;
- F5 Syndicates remains manifest-driven and external to the report engine, allowing feed/report pages to evolve without a runner rewrite;
- four Syndicate profiles and independent presentation pages are active;
- Bill Weston remains the sole Syndicate presentation consuming Walters-intelligence output;
- engine/core v1.3, Contract 0.9, Research Library authority, odds/scheduler behavior, durable history schemas and recommendation/stake semantics remain unchanged.

Use Git history and these checkpoints to distinguish future regressions from previously working pipelines.

## Repository-write capability

As of 2026-08-15, the connected GitHub integration can create, update, commit, read back, and delete repository files directly on `main`. A fresh create/read/delete capability check was completed immediately before v0.9 promotion, and temporary probe files were removed.

All direct changes follow the safety policy in the root `README.md`: fetch current state first, preserve rollback information, make narrow changes, compare before/after, validate, commit clearly, read back, and verify Pages/Actions when relevant.

## Operational boundaries

The following boundaries are intentional and should not be crossed casually:

- Do not couple Research Library **writes** to normal report runs.
- Do not promote Research Library v1.8 merely because the staging validation package is green or because one real shadow comparison is positive; continue the v1.7 soak/shadow gate and require explicit promotion approval.
- Do not equate observed market movement, steam or a favorite flip with confirmed sharp/informed action; distinguish movement from its cause and from current executable value.
- Do not use evidence from the wrong market to fill a direct research gap: WNBA player-prop evidence is not WNBA game-moneyline calibration, and European soccer calibration is not direct MLS numerical calibration.
- Do not treat the v0.8/v0.9 draft files as production authority; `BETTING_EDGE_CONTRACT.md` is authoritative.
- Do not place bulky structured research metadata into the runner payload; player-prop `rec.feed` identity is the narrow approved structured addition.
- Do not let odds-history indexing interfere with the production odds-refresh workflow.
- Do not interpret the v0.9 cutover as activation of Shadow History.
- Do not mix scheduler/odds-refresh changes with UI changes unless the change truly spans both systems.
- Do not rewrite an issued report during repricing or later history enrichment.
- Do not claim browser-side reprice clicks are centrally archived until a safe authenticated persistence path exists.
- Do not consume API quota for clearly stale scheduled jobs.
- Do not replace a good feed with an invalid refresh.
- Do not create a separate recovery lane or relax production gates merely because a scheduled report was missed; recovery remains a same-lane manual issuance under the existing five-lane model.
- Do not treat additional recovery evidence as automatic permission to amend the production contract; promotion remains a separate explicit decision.

For daily procedures see `docs/OPERATIONS.md`. For architectural choices see `docs/DECISIONS.md`. For planned work see `docs/ROADMAP.md`.
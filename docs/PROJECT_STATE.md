# Betting Edge — Project State

**Last updated:** 2026-08-15  
**Repository:** `fhvsvzpmkw-design/-betting-edge-terminal`  
**Primary branch:** `main`

This document is the practical snapshot of what Betting Edge is *right now*. It is not a replacement for the governance contract. Update it when the active architecture, runtime boundaries, major versions, or operating assumptions change.

## Current production surface

- **Runner:** `runner.html`, Betting Edge Terminal **v1.3**.
- **Static shell:** `index.html`, aligned to UI **v1.3**.
- **Quick runner backup:** `runner.html.old`.
- **Authoritative rollback system:** Git history. Named `.old` files are convenience backups only.
- **Live odds feed:** `data/live-odds.json`.
- **Betting ledger:** `data/betting-ledger.json`.
- **Issued-run index:** `run-history.json`.
- **Durable history documentation:** `data/history/README.md`.
- **Compact odds provenance index:** `data/history/odds-index.json`.
- **Research/provenance sidecar schema:** `data/history/report-provenance-schema.json`.

The runner loads `index.html`, consumes an encoded run payload from the URL hash, and uses `data/live-odds.json` for repricing. Browser/device-local runner history remains a separate fallback/cache alongside repository-backed same-day history. The runner payload format has not been enlarged for the new structured history work.

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

It is intentionally isolated from the production refresh. After a successful odds-refresh workflow it builds/updates `data/history/odds-index.json` with compact provenance such as generation time, snapshot commit, exact Git blob SHA and SHA-256. The full 20+ MB odds snapshot remains in Git history and is not duplicated. A failure in this indexing workflow must not prevent the live odds snapshot from being published.

The scheduler diagnostics remain separate from both workflows:

- `.github/workflows/scheduler-canary.yml`
- `.github/workflows/scheduler-canary-v2.yml`

Both canaries are intentionally read-only and make no odds API requests.

## Durable report history

Validated issued report payloads are configured to be stored under:

`data/history/runs/YYYY-MM-DD/<slot>-<timestamp>.json`

`run-history.json` is the compact index. The stored issued payload is authoritative for what the report actually recommended.

Structured research/provenance detail is deliberately separated from the runner payload and is configured to be stored under:

`data/history/research-fit/YYYY-MM-DD/<slot>-<timestamp>.json`

The sidecar uses the exact issued slot/timestamp to link back to the report. It can preserve the Research Library version and item IDs consulted, evidence clusters, History Fit grade, transportability/caveats, feed blob SHA, runner provenance and non-operational governance-draft provenance without increasing the share-link payload.

All five scheduled report lanes — 06:00, 08:00, 09:30, 15:15 and 18:15 — are now staged with the same exact-issued-payload archive and Research Fit/provenance sidecar behavior. This is an **H2/R3-staged configuration**, not yet a declaration of successful live acceptance.

The first preferred live acceptance pair is 15:15 and 18:15. Successful completion should verify exact payload archive, matching sidecar, correct `run-history.json` linkage, normal runner delivery and same-day lineage behavior where applicable.

## Runner repricing model

The issued report is treated as immutable. Repricing is an **overlay/comparison**, not a rewrite of the original recommendation.

Current runner principles include:

- live feed URL: `./data/live-odds.json`;
- maximum quote age for repricing: **30 minutes**;
- book priority: Bet365, then DraftKings;
- if equal best prices are tied and the issued book is one of the tied books, retain the issued book;
- otherwise use the configured book priority;
- structured identity first, title parsing only as fallback;
- unresolved comparisons remain explicit rather than being forced into a false match.

The current comparison vocabulary distinguishes matched movement from unresolved states. If the literal word `UNCATEGORIZED` appears in a future report, investigate the run/report payload layer as well as the runner rather than assuming the current repricing UI generated it.

Runner-side `UPDATE ODDS / REPRICE NOW` remains client-side comparison state. Individual browser reprice clicks are not yet represented as centrally archived repository history.

## Research Library

Current research state:

- Library: **Betting Edge Research Library 1.7**.
- Canonical library status: `R1_CANONICAL_READ_ONLY`.
- Current tested/staged contract-compatibility pointer: draft **0.9**.
- R2 manual-read suite: **PASS** at `research/tests/R2_MANUAL_READ_TEST_2026-08-15.json`.
- The test covered direct/mixed MLB movement evidence, NBA era-drift conflict handling, and an explicit boxing-derivative research gap that correctly returned NR.
- Runtime Research Library writes required: **false**.
- Scheduled-report linkage: **true, staged across all five lanes**.
- Current mode: `R3_STAGED_READ_ONLY_HISTORY_FIT_WITH_HISTORY_SIDECAR`.
- Next stage: `VERIFY_15_15_AND_18_15_LIVE_CHAIN`.

`research/manifest.json` is the authoritative pointer for current tested compatibility. The internal `research-library.json` header preserves the contract version recorded when the canonical library was originally built; that historical header is not rewritten merely to advance compatibility metadata.

The Research Library itself remains read-only. Scheduled history writes go to `data/history/...`, not `research/*`.

## Governance contract

Current newest draft: `BETTING_EDGE_CONTRACT_DRAFT_v0.9.md`.

Status: **DRAFT — governance/specification only; NOT YET OPERATIONAL.**

v0.9 explicitly inherits the full v0.8 baseline except where it adds or overrides durable-history/provenance governance. `BETTING_EDGE_CONTRACT_DRAFT_v0.8.md` remains untouched as the v0.9 baseline/reference.

The principal v0.9 additions are:

1. exact issued-report immutability and archive authority;
2. Research Fit/provenance sidecars linked to the exact issued report;
3. compact Git-backed odds-snapshot indexing without full-feed duplication;
4. history-save failure isolation from live report delivery;
5. a dedicated **H-track** for durable issued-report/market provenance;
6. explicit separation of H-track history from future S-track / Shadow History;
7. source-backed same-day lineage;
8. later result/CLV enrichment as a separate future observation layer.

Current contract track remains **C0**: the existence of v0.9 and its use as non-operational sidecar provenance do not make it the authoritative production contract.

## Activation state summary

- **C-track:** C0 — v0.9 documentation only; no production contract cutover.
- **R-track:** R2 passed; R3 behavior staged across all five scheduled lanes; live acceptance pending.
- **H-track:** H2 — issued-report/sidecar/odds-index configuration established; H3 live-chain verification pending.
- **S-track:** S0 — Shadow History remains inactive.

## Known-good checkpoint

A key rollback checkpoint from **2026-08-11** is preserved as project history:

- a manual odds pull completed successfully;
- the newly pulled odds propagated through the pipeline;
- the terminal displayed the updated odds correctly;
- UI/layout experimentation was intentionally paused at that point.

When debugging future regressions, use Git history and this checkpoint to distinguish a new issue from a previously working pipeline.

## Repository-write capability

As of 2026-08-15, the connected GitHub integration can create, update, commit, read back, and delete repository files directly on `main`. A fresh create/edit/delete capability test was completed successfully.

All direct changes follow the safety policy in the root `README.md`: fetch current state first, preserve rollback information, make narrow changes, compare before/after, validate, commit clearly, read back, and verify Pages/Actions when relevant.

## Operational boundaries

The following boundaries are intentional and should not be crossed casually:

- Do not couple Research Library **writes** to normal report runs.
- Do not activate the v0.9 contract simply by renaming, referencing or recording the draft in provenance.
- Do not place bulky structured research metadata into the runner payload while long hash links are still in use.
- Do not let odds-history indexing interfere with the production odds-refresh workflow.
- Do not interpret all-five-lane staging as proof of live R3/H3 acceptance; verify the 15:15/18:15 chain first.
- Do not mix scheduler/odds-refresh changes with UI changes unless the change truly spans both systems.
- Do not rewrite an issued report during repricing or later history enrichment.
- Do not claim browser-side reprice clicks are centrally archived until a safe authenticated persistence path exists.
- Do not consume API quota for clearly stale scheduled jobs.
- Do not replace a good feed with an invalid refresh.

For daily procedures see `docs/OPERATIONS.md`. For architectural choices see `docs/DECISIONS.md`. For planned work see `docs/ROADMAP.md`.

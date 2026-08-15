# Betting Edge — Operations

**Last updated:** 2026-08-15

This document describes how the current Betting Edge system is operated and checked. It is practical runbook material, not a substitute for the governance contract.

## Standard daily sequence

| Report session | Target odds slot | Scheduled attempts |
|---|---:|---|
| 06:00 | 05:45 | 05:43 and 05:53 Vancouver |
| 08:00 | 07:45 | 07:43 and 07:53 Vancouver |
| 09:30 | 09:15 | 09:13 and 09:23 Vancouver |
| 15:15 | 14:55 | 14:53 and 15:03 Vancouver |
| 18:15 | 17:55 | 17:53 and 18:03 Vancouver |

The two-trigger pattern exists because GitHub scheduled workflows can arrive late or occasionally fail to dispatch. The backup trigger is intended to provide a second opportunity without blindly spending quota when a valid same-slot refresh already exists.

## Active odds workflow

File: `.github/workflows/odds-refresh.yml`

Key controls:

- manual `workflow_dispatch` remains available;
- concurrency group: `betting-edge-odds-refresh`;
- `cancel-in-progress: false`;
- output: `data/live-odds.json`;
- books: Bet365 and DraftKings;
- stale scheduled-job cutoff: 25 minutes after the intended slot;
- hard request budget: 70;
- safety reserve: 5;
- optional stop point: 65;
- core request planning target: 34;
- deep request planning target: 20;
- event horizon: 30 hours;
- prop horizon: 8 hours;
- maximum market age in the refresh workflow: 90 minutes.

A stale scheduled trigger should exit before making Odds-API requests. This is the "zombie killer" behavior.

## Post-refresh odds-history index

File: `.github/workflows/odds-history-index.yml`  
Workflow: `Index Betting Edge odds history`

This workflow is deliberately separate from the production odds refresh. It runs after a successful `Refresh Betting Edge odds` workflow and maintains `data/history/odds-index.json`.

Its job is provenance/navigation only. It records compact information such as:

- exact feed `generatedAt`;
- snapshot commit SHA;
- exact `data/live-odds.json` blob SHA;
- SHA-256 of the snapshot bytes;
- feed schema/identity schema;
- source/event count and available request/sport summary metadata.

The large full feed is **not copied** into the history directory. Git history remains the full-fidelity snapshot archive.

Operational rule: a failure in `odds-history-index.yml` must never be treated as failure of the already-published live odds snapshot. Repair the index independently; do not rerun the odds API solely because indexing failed.

## Scheduler diagnostics

Two intentionally simple workflows test GitHub scheduler dispatch independently of the odds API:

### Canary v1

File: `.github/workflows/scheduler-canary.yml`

- runs at minutes 17 and 47 each hour;
- may also be run manually;
- read-only permissions;
- no API requests;
- no repository writes.

### Canary v2

File: `.github/workflows/scheduler-canary-v2.yml`

- runs at minutes 19 and 49 each hour;
- separate workflow identity from v1;
- may also be run manually;
- read-only permissions;
- no API requests;
- no repository writes.

The two canaries help distinguish a general GitHub scheduling problem from an odds-workflow-specific problem.

## Normal health check

When checking whether a report window is on track, use this order:

1. **Check the scheduled odds workflow run.** Confirm whether an expected trigger appeared and whether it completed, is delayed, or was killed as stale.
2. **Check canaries.** If both canaries have recent scheduled successes while the odds workflow does not, focus on the odds workflow rather than assuming all GitHub scheduling is down.
3. **Check `data/live-odds.json`.** Confirm the latest valid snapshot reflects the intended refresh period.
4. **Check the odds-history index.** After a successful published refresh, confirm the separate indexing workflow eventually records the snapshot. Index lag does not invalidate the live feed.
5. **Check API-use evidence when needed.** A zombie-killed run should make zero odds API requests. A successful live refresh should show actual request activity.
6. **Open the runner/report.** Reprice only after a valid live feed exists.

Do not infer success solely from the existence of a workflow run. A run can finish successfully because a stale trigger was intentionally rejected or because no publishable odds changes were produced.

## Manual recovery procedure

Use manual recovery when an important scheduled refresh did not produce a usable feed in time.

1. Confirm there is not already a fresh valid same-slot snapshot.
2. Check whether the scheduled run is merely delayed, failed, or was killed as a stale zombie.
3. Run `Refresh Betting Edge odds` manually with `workflow_dispatch` if a fresh pull is still required.
4. Confirm the manual workflow completes successfully.
5. Confirm `data/live-odds.json` was actually updated or that the workflow explicitly reported there were no valid changes to publish.
6. Confirm API activity is consistent with the action taken.
7. Allow/check the separate odds-history index run; repair it independently if necessary.
8. Reprice/open the Betting Edge runner using the new feed.

A manual odds refresh should not require changing runner code.

## Durable issued-report history

The exact validated payload used for a runner link is stored under:

`data/history/runs/YYYY-MM-DD/<slot>-HHMMSS.json`

`run-history.json` is the compact index. The stored payload is authoritative for what Betting Edge actually issued.

History-save failure must not cause a different report to be generated solely for storage. If the already-validated live report can be delivered but its archive cannot be written, deliver it with the existing `HISTORY SAVE FAILED` warning and repair the archive later.

Issued payloads are historical evidence. Do not silently overwrite or delete them during ordinary operations.

## 15:15 R2 Research Fit pilot

The 15:15 EVENING lane is currently the only scheduled lane using the read-only R2 Research Fit pilot. The 06:00, 08:00, 09:30 and 18:15 lanes remain unchanged until this pilot is verified.

For each displayed 15:15 recommendation, the report process forms its current handicap first and then reads the canonical Research Library as an independent History Fit lens. Research must not:

- create a BET;
- supply an executable sportsbook price;
- override identity or freshness failures;
- directly rewrite fair value;
- directly rewrite `playTo`;
- directly rewrite status or stake;
- write to `research/*` during a normal report.

The concise History Fit conclusion remains in the existing `hist` field of the issued runner payload. Structured detail is stored separately so the runner URL does not grow.

Expected sidecar path:

`data/history/research-fit/YYYY-MM-DD/evening-HHMMSS.json`

The sidecar must match the issued payload's exact `slot`, `run.ts`, report path and `feedGeneratedAt`. It may contain prior IDs, evidence clusters, grade, directness, transportability, mechanism/limitation and feed/runner/research provenance. It is not authoritative for the recommendation itself and may not rewrite the issued payload.

### 15:15 live-pilot verification

For the first successful live pilot, verify the chain in this order:

1. 14:53/15:03 odds-refresh attempt produces a valid 14:55-window feed.
2. `data/live-odds.json` has the expected fresh `generatedAt`.
3. `Index Betting Edge odds history` runs after the successful refresh and adds the snapshot to `data/history/odds-index.json`.
4. The 15:15 report is generated with the normal runner payload shape and validates normally.
5. The exact issued payload is created under `data/history/runs/YYYY-MM-DD/evening-HHMMSS.json`.
6. A matching `data/history/research-fit/YYYY-MM-DD/evening-HHMMSS.json` sidecar is created.
7. `run-history.json` contains the run plus `researchFitPath`, feed blob SHA when available, and Research Library version.
8. The runner link opens normally and the report presentation/repricing behavior is unchanged.

If all eight checks pass, the pilot may be considered proven for later rollout planning. Do not automatically change the other four report lanes merely because the files exist.

### Sidecar recovery

If the issued payload exists but the Research Fit sidecar fails:

- do not modify or regenerate the issued recommendation;
- inspect the Research Library read/provenance failure separately;
- if repair is appropriate, create a clearly linked repair/correction record rather than silently rewriting historical evidence;
- keep Research Library files read-only during normal report execution.

## Repricing checks

The runner uses `data/live-odds.json` as a comparison layer over the issued report.

Current runner safeguards include:

- quote age for repricing must be no more than 30 minutes at feed time;
- stale feeds are rejected rather than silently applied;
- event/market/selection identity is matched structurally first;
- unresolved cases remain unresolved rather than being guessed;
- issued recommendation content remains unchanged under the comparison overlay.

When evaluating a reprice, distinguish:

- **MATCHED / UNCHANGED**
- **MATCHED / IMPROVED**
- **MATCHED / WORSENED**
- **UNRESOLVED** states such as identity mismatch, unavailable market, unverified price, or event started/closed.

If an unexpected label such as `UNCATEGORIZED` appears, capture the actual run payload and trace which layer produced it before changing code.

## Invalid refresh behavior

The odds workflow is designed to protect the last good feed. Examples of conditions that should not overwrite it include malformed output or a refresh that fails core validation.

When investigating a suspicious refresh:

- compare the new workflow log with the previous valid feed;
- inspect the publish/validation step rather than assuming a completed Action means the feed changed;
- preserve the prior good snapshot until the new data has passed validation.

## GitHub Pages verification

Changes to the root web files and documentation can trigger GitHub Pages deployment.

For any functional runner/index change:

1. commit the narrow change;
2. read the committed file back from GitHub;
3. review the before/after diff;
4. wait for Pages build and deploy to succeed;
5. only then treat the deployed version as the new active state.

Documentation-only Pages deployments should still be checked when convenient, but they do not alter odds or scheduling behavior.

## Direct repository changes

The root `README.md` contains the authoritative repository-change safety policy. Operationally:

- fetch the current file immediately before editing;
- retain its blob/commit as rollback information;
- change only the intended file/section;
- validate file-specific invariants;
- read back after commit;
- verify Actions/Pages where relevant;
- restore the previous Git version if behavior regresses.

For higher-risk changes to the runner, odds-refresh workflow, scheduler logic, research governance, or contract integration, perform a stricter before/after review before calling the change complete.

## What not to do during incident recovery

- Do not rewrite several layers at once because one report is late.
- Do not modify runner UI to solve an upstream odds-refresh failure.
- Do not spend API quota repeatedly without first checking whether a valid feed already exists.
- Do not modify the production odds-refresh workflow merely to repair a failed odds-history index.
- Do not write to the canonical Research Library during a normal report.
- Do not roll the R2 sidecar pilot to all five lanes before the 15:15 chain has passed.
- Do not activate a governance draft while debugging scheduler/history reliability.
- Do not delete working backup files or rewrite Git history to make the repo look cleaner.

The preferred recovery strategy is narrow diagnosis, narrow repair, validation, then resume normal operation.

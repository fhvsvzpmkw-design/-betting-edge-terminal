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

The paired-trigger pattern exists because GitHub scheduled workflows can arrive late or occasionally fail to dispatch. The backup trigger provides another opportunity without blindly spending quota when a valid same-slot refresh already exists.

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

Git history is the rollback authority for this workflow. The obsolete `.github/workflows/odds-refresh.yml.old` duplicate has been removed; restore an earlier workflow from Git history if rollback is required.

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

Operational rule: failure of `odds-history-index.yml` must never be treated as failure of the already-published live odds snapshot. Repair the index independently; do not rerun the odds API solely because indexing failed.

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
6. **Open the issued report.** Prefer the compact short link when durable history/indexing succeeded; use the long fallback when history saving failed.
7. **Reprice only after a valid live feed exists.**

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
8. Open/reprice the Betting Edge report using the new feed.

A manual odds refresh should not require changing runner code.

## Durable issued-report history

The exact validated issued payload is stored under:

`data/history/runs/YYYY-MM-DD/<slot>-HHMMSS.json`

`run-history.json` is the compact discovery/index layer. The stored issued payload is authoritative for what Betting Edge actually issued.

Structured Research Fit/provenance is stored separately under:

`data/history/research-fit/YYYY-MM-DD/<slot>-HHMMSS.json`

The sidecar must refer to the same slot, exact `run.ts`, report path and `feedGeneratedAt`. It is supplementary evidence and cannot rewrite the recommendation.

Issued payloads and sidecars are historical evidence. Do not silently overwrite or delete genuine issued records during ordinary operations.

## Report link delivery

Every scheduled report lane follows the same delivery hierarchy.

### Long fallback — built first

The validated report payload is serialized, round-trip checked, Base64URL encoded and used to build:

`runner.html#run=<validated payload>`

This long link is retained as the self-contained emergency fallback. It must be capable of opening the active issued card without depending on repository history.

### Short link — normal primary delivery after history success

After the exact issued payload, required Research Fit/provenance sidecar and matching `run-history.json` entry have been stored successfully, the report derives the deterministic compact ID and delivers:

`r.html?id=<shortId>`

Current short ID format:

`YYMMDD + slot code + HHMMSS`

Slot codes:

- `open = o`;
- `main = m`;
- `final_morning = f`;
- `evening = e`;
- `late = l`.

The short resolver retrieves the authoritative archived active report. It may also hydrate the newest valid archived run for the other session lanes on the **same active report date** into the existing five session buttons. It must not pull a different date into that strip.

The short and long delivery mechanisms must preserve the same active issued report content. Same-day `prior_runs` hydration is navigation context only and cannot change the active recommendation.

### History/share failure

If payload storage, required sidecar storage, or `run-history.json` indexing fails:

- do not rebuild or re-handicap the report merely for history;
- do not send a known-unresolvable short link as the sole report path;
- deliver the already-validated long fallback;
- surface `HISTORY SAVE FAILED`;
- repair the history/index problem separately.

Publication lag in GitHub Pages may be retried by the compact resolver for a bounded period, but the resolver must never substitute a different report.

## Research Fit — all five lanes staged

Read-only Research Fit/history-sidecar behavior is configured across all five report lanes:

- 06:00 OPEN / OVERNIGHT;
- 08:00 MAIN;
- 09:30 FINAL MORNING;
- 15:15 EVENING;
- 18:15 LATE / WEST COAST.

The canonical Research Library is read **after** the provisional current handicap is formed. Research must not:

- create a BET;
- supply an executable sportsbook price;
- override identity or freshness failures;
- directly rewrite fair value;
- directly rewrite `playTo`;
- directly rewrite status or stake;
- write to `research/*` during a normal report.

The concise History Fit conclusion remains in the existing `hist` field of the issued runner payload. Structured detail belongs in the sidecar so the issued payload shape does not grow.

This configuration is staged, not yet proof of live acceptance. R2 manual Research Library validation has passed; R3/H3 live-chain acceptance still requires successful scheduled evidence.

## Preferred live acceptance sequence

The preferred first acceptance pair is 15:15 followed by 18:15.

### 15:15 acceptance

Verify:

1. the 14:53/15:03 refresh window produces a valid fresh feed;
2. the odds-history index records the corresponding snapshot;
3. the 15:15 report passes the normal feed/price/stake/timestamp gates;
4. the exact issued payload is archived;
5. the matching Research Fit/provenance sidecar is archived;
6. `run-history.json` contains the matching entry;
7. the compact `r.html?id=` link resolves the exact archived report;
8. the retained long fallback opens the same active issued report content;
9. same-date session hydration does not leak another betting date;
10. non-BET stakes remain zero and total risk reconciles.

### 18:15 acceptance

Repeat the same checks and additionally verify:

- the valid 15:15 archived lane can appear in the 18:15 same-day session navigation;
- no prior-date report appears in the current day's strip;
- same-day lineage comes from actual archived evidence where available;
- prior lane evidence is not double-counted as Research Library evidence.

Only after live evidence passes should H3/R3 behavior be described as proven rather than merely staged.

## Sidecar recovery

If the issued payload exists but a Research Fit sidecar fails:

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

The odds workflow is designed to protect the last good feed. Conditions such as malformed output or a refresh that fails core validation should not overwrite it.

When investigating a suspicious refresh:

- compare the new workflow log with the previous valid feed;
- inspect the publish/validation step rather than assuming a completed Action means the feed changed;
- preserve the prior good snapshot until the new data has passed validation.

## GitHub Pages verification

Changes to root web files and documentation can trigger GitHub Pages deployment.

For functional runner/resolver/index changes:

1. commit the narrow change;
2. read the committed file back from GitHub;
3. review the before/after diff;
4. wait for Pages build and deploy to succeed;
5. only then treat the deployed version as the new active state.

Documentation-only Pages deployments should still be checked when convenient, but they do not alter odds or scheduling behavior.

## Direct repository changes

The root `README.md` contains the repository-change safety policy. Operationally:

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
- Do not declare all-lane R3/H3 behavior proven merely because all five scheduled definitions are configured; verify the live chain first.
- Do not activate a governance draft while debugging scheduler/history reliability.
- Do not delete `runner.html.old` while it remains the designated quick runner backup.
- Do not delete `BETTING_EDGE_CONTRACT_DRAFT_v0.8.md` while v0.9 explicitly inherits it.
- Do not rewrite Git history merely to make the repository look cleaner.

The preferred recovery strategy is narrow diagnosis, narrow repair, validation, then resume normal operation.

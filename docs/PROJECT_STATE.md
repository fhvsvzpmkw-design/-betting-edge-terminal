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
- **Run history file:** `run-history.json`.

The runner loads `index.html`, consumes an encoded run payload from the URL hash, and uses `data/live-odds.json` for repricing. Browser/device-local history is stored separately from repository data.

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

The active workflow is `.github/workflows/odds-refresh.yml`.

Current core properties:

- Source API: Odds-API.io v3.
- Primary books: **Bet365** and **DraftKings**.
- Covered sport families include soccer/football, American football, basketball, baseball, ice hockey, tennis, boxing, and MMA.
- Scheduled jobs more than **25 minutes late** for their intended slot are treated as zombies and exit before spending API quota.
- The workflow has a hard request ceiling of **70**, with a safety reserve and early-stop controls.
- Invalid refreshes are designed not to replace a previously good live-odds snapshot.
- Structured event/market/selection identity is preferred over title parsing.

The scheduler diagnostics are separate from the odds workflow:

- `.github/workflows/scheduler-canary.yml`
- `.github/workflows/scheduler-canary-v2.yml`

Both canaries are intentionally read-only and make no odds API requests.

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

## Research Library

Current research state:

- Library: **Betting Edge Research Library 1.7**.
- Status: `R1_CANONICAL_READ_ONLY`.
- Contract compatibility metadata: draft **0.8**.
- Next stage: `R2_MANUAL_READ_TEST`.
- Scheduled reports linked: **false**.
- Runtime writes required: **false**.

Research is therefore available as a curated evidence library but is **not yet part of the live scheduled report path**. That separation is deliberate.

## Governance contract

Current draft: `BETTING_EDGE_CONTRACT_DRAFT_v0.8.md`.

Status: **DRAFT — governance/specification only; NOT YET OPERATIONAL.**

The draft must not be treated as live merely because it exists in the repository. Production activation requires a separate, deliberate integration and validation step.

The v0.8 draft preserves the existing historical-evidence architecture and adds three explicit areas over the prior baseline:

1. authoritative repository/version preflight;
2. deterministic equal-price sportsbook tie handling;
3. report timestamp integrity.

## Known-good checkpoint

A key rollback checkpoint from **2026-08-11** is preserved as project history:

- a manual odds pull completed successfully;
- the newly pulled odds propagated through the pipeline;
- the terminal displayed the updated odds correctly;
- UI/layout experimentation was intentionally paused at that point.

When debugging future regressions, use Git history and this checkpoint to distinguish a new issue from a previously working pipeline.

## Repository-write capability

As of 2026-08-15, the connected GitHub integration can create, update, commit, read back, and delete repository files directly on `main`. A harmless create/delete test was completed successfully.

All direct changes follow the safety policy in the root `README.md`: fetch current state first, preserve rollback information, make narrow changes, compare before/after, validate, commit clearly, read back, and verify Pages/Actions when relevant.

## Operational boundaries

The following boundaries are intentional and should not be crossed casually:

- Do not couple Research Library writes to normal report runs.
- Do not activate the v0.8 contract simply by renaming or referencing the draft.
- Do not mix scheduler/odds-refresh changes with UI changes unless the change truly spans both systems.
- Do not rewrite an issued report during repricing.
- Do not consume API quota for clearly stale scheduled jobs.
- Do not replace a good feed with an invalid refresh.

For daily procedures see `docs/OPERATIONS.md`. For architectural choices see `docs/DECISIONS.md`. For planned work see `docs/ROADMAP.md`.

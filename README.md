# Betting Edge Terminal

## Project documentation

The repository includes four durable project references:

- [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) — current production state, versions, runtime boundaries, active data/research/governance status, and known-good checkpoints.
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md) — daily refresh/report timing, scheduler diagnostics, zombie protection, manual recovery, repricing checks, history/share-link handling, and deployment verification.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — durable architectural and operating decisions, including the reasoning behind them.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — completed foundations, current priorities, planned History/Research/ledger work, and future contract evolution.

## Production governance

The authoritative production contract is [`BETTING_EDGE_CONTRACT.md`](BETTING_EDGE_CONTRACT.md), **v0.9 OPERATIONAL**.

The production contract incorporates by fixed Git blob identity:

- [`BETTING_EDGE_CONTRACT_DRAFT_v0.8.md`](BETTING_EDGE_CONTRACT_DRAFT_v0.8.md) as the inherited execution/pricing/risk baseline;
- [`BETTING_EDGE_CONTRACT_DRAFT_v0.9.md`](BETTING_EDGE_CONTRACT_DRAFT_v0.9.md) as the durable-history/provenance design delta;
- [`BETTING_EDGE_CONTRACT_DRAFT_v0.9_PLAYER_PROP_DELTA.md`](BETTING_EDGE_CONTRACT_DRAFT_v0.9_PLAYER_PROP_DELTA.md) as the player-prop identity delta.

Those draft files are retained as historical design artifacts and are **not independently operational**. The live promotion/acceptance record is [`BETTING_EDGE_V0.9_ACCEPTANCE_2026-08-15.md`](BETTING_EDGE_V0.9_ACCEPTANCE_2026-08-15.md).

Every scheduled production report must resolve the production contract and current approved runner before handicapping. If authority cannot be resolved, the report must stop before analysis rather than silently falling back to a draft.

## Repository change safety policy

Direct edits to this repository use the following default safety process:

1. Fetch the current file from `main` before editing and record its current Git blob/commit as the rollback point.
2. Make only the intended change; unrelated files stay out of the commit.
3. Compare the before/after versions and check for accidental deletions or unrelated edits.
4. Validate the changed file appropriately (for example JSON parsing, workflow integrity, expected runner sections, or other file-specific checks).
5. Commit with a clear, narrow description of the change.
6. Read the committed file back from GitHub to confirm the repository contains the intended result.
7. When relevant, verify GitHub Pages or GitHub Actions completes successfully after the commit.
8. If validation fails or behavior regresses, restore the exact previous Git version rather than manually reconstructing the file.

Git history is the authoritative rollback system for all repository files. Named `.old` files may be retained where they provide a useful quick backup (for example `runner.html.old`), but they do not replace Git history. Obsolete duplicate workflow backups should not be retained merely for rollback when Git history already preserves the exact prior version.

Higher-risk files — including the runner, odds-refresh workflows, scheduler logic, research governance, and production contract integration — receive stricter before/after comparison and validation before a change is treated as complete.

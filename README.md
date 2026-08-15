# Betting Edge Terminal

## Project documentation

The repository includes four durable project references:

- [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) — current production state, versions, runtime boundaries, active data/research/governance status, and known-good checkpoint.
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md) — daily refresh/report timing, scheduler diagnostics, zombie protection, manual recovery, repricing checks, and deployment verification.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — durable architectural and operating decisions, including the reasoning behind them.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — completed foundations, current priorities, planned History/Research/ledger work, and eventual contract activation.

The governance specification remains separate in [`BETTING_EDGE_CONTRACT_DRAFT_v0.8.md`](BETTING_EDGE_CONTRACT_DRAFT_v0.8.md). The draft is not operational merely because it exists in the repository.

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

Git history is the authoritative rollback system for all repository files. Named `.old` files may be retained where they provide a useful quick backup (for example `runner.html.old`), but they do not replace Git history.

Higher-risk files — including the runner, odds-refresh workflows, scheduler logic, research governance, and production contract integration — receive stricter before/after comparison and validation before a change is treated as complete.

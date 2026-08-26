# Betting Edge Terminal

## Project documentation

The repository includes four durable project references:

- [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) — current production state, versions, runtime boundaries, active data/research/governance status, and known-good checkpoints.
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md) — daily refresh/report timing, scheduler diagnostics, zombie protection, manual recovery, repricing checks, history/share-link handling, and deployment verification.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — durable architectural and operating decisions, including the reasoning behind them.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — completed foundations, current priorities, planned History/Research/ledger work, and future contract evolution.

## Splash branding

Current splash identity is centralized in `r.html` under `BRAND_CONFIG`. For a splash rename, update `appName` and/or `companyName`, then verify the GitHub Pages deployment and the splash-to-report transition. Terminal branding remains separate and should be changed independently when a broader product rename is intended.

## Current production version boundary

The current presentation release is **VigScope Terminal UI v1.5** in `runner.html`.

v1.5 is a consolidation boundary for the accumulated production presentation work now operating together, including the manifest-driven Syndicate workspace and independent hotline shells, the rebuilt F3 Bet History/public performance surface, the current Preferences/report-card presentation, and the private-ledger public-projection architecture. It does not imply a betting-engine rewrite.

The underlying Betting Edge report engine/core is now **Core v1.4 OPERATIONAL**, with `core/core-v1.4-production.json` as its production manifest and `runner-core.html` / `index.html` as the inner presentation/runtime shell. The authoritative governance contract remains **Betting Edge Contract v1.0 OPERATIONAL**. The production Research Library is **v1.8 R3 live read-only**. Walters launches in switchable **BET_AUTHORITY** mode for eligible NFL spread/moneyline work.

These versions are intentionally independent:

- **Terminal / product UI:** v1.5
- **Report engine/core:** v1.4
- **Governance contract:** v1.0
- **Research Library:** v1.8 / R3 live read-only
- **Hotline shells:** independently versioned per character/publication

## F3 Bet History and ledger boundary

The public terminal does not use the raw private betting ledger as a browser-facing data source. The authoritative master ledger is held in the private repository and a Cloudflare Worker exposes the sanitized public `/api/bet-history` projection used by F3 and other approved public-facing views. A sanitized repository fallback may be used when necessary; private ticket/reference identifiers remain excluded.

F3 is the public performance/history surface. Exact cash-accounting summary totals come from the sanctioned public projection summary, while public wager rows remain sanitized and must not be heuristically treated as an exact cash/free-bet classifier.

## Syndicate presentation

Syndicate slots are externally configured by `data/syndicates.json`. Character profiles, nameplates, avatars, hotline shells, live editions and archives remain independently maintainable. Shell versions are independent from the terminal UI version; promoting the terminal or governance contract does not renumber a character shell.

Betting Edge report data remains authoritative wherever a character hotline presents current recommendations. Fictional character voice, setting, visuals and editorial framing are presentation only and may not alter issued status, price, fair value, play-to or risk.

## Production governance

The authoritative production contract is [`BETTING_EDGE_CONTRACT.md`](BETTING_EDGE_CONTRACT.md), **v1.0 OPERATIONAL**.

Contract v1.0 is a controlled consolidation of the final operational v0.9 rule set. It preserves the inherited execution/pricing/risk baseline and the already-operational durable-history, exact-identity, fair-value-confidence, spread-lineage, PRICE WATCH and repository-controlled report-card rules. It does not introduce a new staking model, add books, increase the odds-refresh budget or alter the five report lanes. Research Library versions are promoted independently; the current v1.8 R3 promotion does not change the Contract v1.0 version or its execution/risk boundary.

The production contract continues to incorporate by fixed Git blob identity:

- [`BETTING_EDGE_CONTRACT_DRAFT_v0.8.md`](BETTING_EDGE_CONTRACT_DRAFT_v0.8.md) as the inherited execution/pricing/risk baseline;
- [`BETTING_EDGE_CONTRACT_DRAFT_v0.9.md`](BETTING_EDGE_CONTRACT_DRAFT_v0.9.md) as the durable-history/provenance design delta;
- [`BETTING_EDGE_CONTRACT_DRAFT_v0.9_PLAYER_PROP_DELTA.md`](BETTING_EDGE_CONTRACT_DRAFT_v0.9_PLAYER_PROP_DELTA.md) as the player-prop identity delta.

Those draft files remain historical design artifacts and are **not independently operational**. The v0.9 production acceptance record remains immutable historical evidence at [`BETTING_EDGE_V0.9_ACCEPTANCE_2026-08-15.md`](BETTING_EDGE_V0.9_ACCEPTANCE_2026-08-15.md). The Contract v1.0 promotion record is [`BETTING_EDGE_V1.0_ACCEPTANCE_2026-08-22.md`](BETTING_EDGE_V1.0_ACCEPTANCE_2026-08-22.md). The current Research Library promotion record is [`research/V1_8_PROMOTION_2026-08-25.md`](research/V1_8_PROMOTION_2026-08-25.md).

Every scheduled production report must resolve the production contract and current approved runner before handicapping. Research Fit resolves the active Research Library through `research/manifest.json`. If production authority cannot be resolved, the relevant layer must fail closed rather than silently falling back to a draft or superseded production version.

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

Git history is the authoritative rollback system for all repository files. Named `.old` files may be retained where they provide a useful quick backup, but they do not replace Git history. Obsolete duplicate workflow backups should not be retained merely for rollback when Git history already preserves the exact prior version.

Higher-risk files — including the runner, odds-refresh workflows, scheduler logic, research governance, production contract integration and private/public ledger boundary — receive stricter before/after comparison and validation before a change is treated as complete.

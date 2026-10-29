# Betting Edge Terminal

## Current production boundary

- **VigScope Terminal UI:** v1.5
- **Betting Edge Core:** v1.5 OPERATIONAL from 2026-09-21 06:00 America/Vancouver
- **Governance Contract:** v1.0 OPERATIONAL
- **Research Library:** v1.8 / R3 live read-only
- **Walters mode:** runtime-switchable, currently `BET_AUTHORITY` for eligible NFL spread/moneyline
- **Timezone:** `America/Vancouver`
- **Primary books:** FanDuel + DraftKings

Core v1.4 became the forward production baseline at `2026-08-25T17:20:00-07:00`. Historical Core v1.3 reports remain immutable.

Core v1.4 closeout: [`BETTING_EDGE_CORE_V1_4_CLOSEOUT_2026-08-25.md`](BETTING_EDGE_CORE_V1_4_CLOSEOUT_2026-08-25.md).

## Project documentation

Start maintenance by reading the current progress section in [PROJECT_STATE.md](docs/PROJECT_STATE.md) and the relevant [decision](docs/DECISIONS.md). Resume the existing checkpoint/readiness queue and owner. After a substantive repair or verified milestone, update that same progress entry with proof and the exact next action; distinguish deployment from live acceptance. Independent Graham research retains its market-safe task-specific entry path.

Current operating references:

- [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) — current progress, verification evidence, open work, owners and resume instructions.
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md) — report/odds schedule, recovery, Core 1.4 gate order, Result Closure, Crypto Specials and downstream boundaries.
- [`docs/PUBLIC_LEDGER_OPERATIONS.md`](docs/PUBLIC_LEDGER_OPERATIONS.md) — canonical public-ledger path, privacy boundary, upload/replacement procedure, compatibility sync and recovery.
- [`BETTING_EDGE_MAIN_SCHEDULE.md`](BETTING_EDGE_MAIN_SCHEDULE.md) — permanent Main Betting Edge timing and scheduler behavior.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — current priority pointer and historical roadmap.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — durable historical architectural decisions. Dated entries record the state when they were made; current production authority is the boundary above plus `docs/PROJECT_STATE.md`.
- [`BETTING_EDGE_CONTRACT.md`](BETTING_EDGE_CONTRACT.md) — authoritative production governance contract.

## Core production authority

Current release: `core/core-v1.5-production.json` and `core/CORE_V1_5_OPERATING_CONTRACT.md`. The 1.4 component filenames below remain deliberate compatibility dependencies, with historical semantics preserved.

Authoritative Core files include:

- `core/core-v1.4-production.json`
- `core/core-handicap-framework-v1.4.json`
- `core/walters-intelligence-interface-v1.4.json`
- `core/walters-authority-v1.4.json`
- `BETTING_EDGE_PERSONNEL_SWEEP.md`
- `tools/core-v14-publication-gate.mjs`
- `data/history/report-provenance-schema.json`

Core v1.4 adds explicit fair-value basis/model-error states, Research v1.8 uncertainty graduation, stronger personnel handling, tighter WAIT qualification and switchable Walters authority while preserving the existing execution/freshness/staking boundaries.

## Report decisions

Public odds use American format only. `assets/odds-format.js` is the shared display formatter for the terminal and generated candidate price text. Structured decimal prices retain their original precision for probability, value and settlement calculations; formatting must never rewrite issued report history. New odds displays should use this formatter and keep spreads, totals, probabilities and monetary amounts in their native units.

From September 6, every EVALUATED primary decision is published, including PASS. There is no numeric card target or maximum. Research follows the shared scheduled authority's qualified-odds → current-research → fair-value → decision process. Continue unfinished work, but publish completed, validated decisions even when other selections remain unfinished. From 18:15 September 6 the publisher adds a PARTIAL REPORT notice with exact counts, or ANALYSIS INCOMPLETE when no selections were evaluated. Genuine terminal limitations remain distinct; unfinished selections receive no fabricated fair, decision or stake.

Pizza Plays remains downstream of VigScope. If there is no suitable qualifying play, no Pizza selection is preferable to forcing a weak or extreme longshot.

## Permanent Main Betting Edge schedule

Canonical slots remain `open`, `main`, `final_morning`, `evening`, `late`.

Vancouver pulse → report pairs:

| Schedule | Pulse → report pairs |
|---|---|
| MAIN BETTING EDGE | 05:50→06:00, 07:50→08:00, 09:20→09:30, 15:05→15:15, 18:05→18:15 |

`data/main-schedule.json` is the single schedule authority. The five-primary-pull cap is unchanged.

## Odds acquisition

Each of the five Main report tasks owns its normal request through `data/odds-run-request.json` and the existing protected collector. Reuse eligible fulfilled-slot or fresh manual inputs; verify exact saved bytes, diagnostics and the durable slot receipt before research. Cloudflare odds timers and GitHub odds cron are retired. The deployed Worker retains website hosting and report routing; its old scheduled callback performs no network operations.

Primary acquisition requires matching sport and league, and preserves major-sport priority through actual requests. The independently enabled exact Crypto watch keeps its approved scope. Soccer or tennis cannot displace the primary board. A bookmaker access denial stops that book for this pull while the other approved book continues. Primary discovery/pricing failures are acquisition failures, not a completed empty-slate analysis. Partial usable coverage remains eligible for its normal selection-specific evidence gates.

The five-primary-slot cap, same-slot deduplication, provider budgets and explicit manual recovery remain. Follow [the shared authority](BETTING_EDGE_SCHEDULED_REPORT_AUTHORITY.md) and [the request protocol](docs/ODDS_RUN_REQUEST.md); no second scheduler or extra price-driven pull is introduced.

## Card grading

[CARD_GRADING_AUTHORITY.md](CARD_GRADING_AUTHORITY.md) governs the existing native 03:00 Vancouver grader and 03:30 verification/fallback task. Grade all pending previous-day and older events without the retired 20/10 quotas. Preserve issued decisions and verify observation/result-index publication and exact remaining cases. Hypothetical LEAN/WAIT/PASS outcomes never change the bankroll or betting ledger.

## Crypto Specials

Crypto Specials uses its existing independent editorial task and output paths. Its current task configuration controls timing; Main report times do not reschedule it. It does not own Core decisions, Main report History, bankrolls or stakes. Exact enabled combat watches retain their approved collector scope.

## Durable history

Issued reports:

`data/history/runs/YYYY-MM-DD/<slot>-HHMMSS.json`

Research/Core/Walters provenance:

`data/history/research-fit/YYYY-MM-DD/<slot>-HHMMSS.json`

Result/price observations:

`data/history/observations/YYYY-MM-DD/<slot>-HHMMSS.json`

`run-history.json` is the compact navigation/index layer and cannot override an issued report.

## F3 Bet History / private ledger boundary

The public terminal does not use the raw private betting ledger directly.

Current architecture:

**private master ledger → sanitization boundary → sanitized `/api/bet-history` projection → F3 Bet History + Eddie Numbers**

The stable customer-facing ledger contract is:

`data/ledger/public-ledger.json`

That file is the only public-ledger file intended to be manually replaced or supplied by a future customer upload flow. `.github/workflows/public-ledger-sync.yml` validates it and synchronizes generated compatibility copies at `data/bet-history-public.json` and `api/bet-history`.

Eddie Numbers uses the public projection, not the private ledger. Public modules must never require the private ledger path or credentials. The complete update/recovery procedure is documented in [`docs/PUBLIC_LEDGER_OPERATIONS.md`](docs/PUBLIC_LEDGER_OPERATIONS.md).

## Syndicate / hotline boundary

Character profiles, hotlines and visual framing are presentation layers. Betting Edge report data remains authoritative wherever a hotline references current recommendations.

Hotline shell versions are independent from Terminal/Core/Contract versions.

## Splash branding

Splash identity is centralized in `r.html` under `BRAND_CONFIG`. A splash rename should update `appName` and/or `companyName`, then verify GitHub Pages and splash-to-report transition. Terminal branding remains a separate change.

## Repository change safety

For direct edits:

1. fetch current `main` state first;
2. make only the intended change;
3. preserve Git as the rollback authority;
4. validate changed JSON/workflow/runtime files appropriately;
5. commit with a narrow description;
6. read the committed state back;
7. verify Pages/Actions where relevant;
8. restore the exact prior Git version on regression rather than reconstructing by hand.

Higher-risk files—runner, odds workflows, scheduler logic, production Core/Contract integration, Research governance and ledger boundaries—require stricter before/after validation.

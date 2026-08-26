# Betting Edge Terminal

## Current production boundary

- **VigScope Terminal UI:** v1.5
- **Betting Edge Core:** v1.4 OPERATIONAL
- **Governance Contract:** v1.0 OPERATIONAL
- **Research Library:** v1.8 / R3 live read-only
- **Walters mode:** runtime-switchable, currently `BET_AUTHORITY` for eligible NFL spread/moneyline
- **Timezone:** `America/Vancouver`
- **Primary books:** Bet365 + DraftKings

Core v1.4 became the forward production baseline at `2026-08-25T17:20:00-07:00`. Historical Core v1.3 reports remain immutable.

Core v1.4 closeout: [`BETTING_EDGE_CORE_V1_4_CLOSEOUT_2026-08-25.md`](BETTING_EDGE_CORE_V1_4_CLOSEOUT_2026-08-25.md).

## Project documentation

Current operating references:

- [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) — practical current production state and open operational items.
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md) — report/odds schedule, recovery, Core 1.4 gate order, Result Closure, Crypto Specials and downstream boundaries.
- [`BETTING_EDGE_SCHEDULE_PROFILE_ADDENDUM.md`](BETTING_EDGE_SCHEDULE_PROFILE_ADDENDUM.md) — seasonal profile timing and scheduler/backstop behavior.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — post-Core-1.4 observation and future work.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — durable historical architectural decisions. Dated entries record the state when they were made; current production authority is the boundary above plus `docs/PROJECT_STATE.md`.
- [`BETTING_EDGE_CONTRACT.md`](BETTING_EDGE_CONTRACT.md) — authoritative production governance contract.

## Core v1.4 production authority

Authoritative Core files include:

- `core/core-v1.4-production.json`
- `core/core-handicap-framework-v1.4.json`
- `core/walters-intelligence-interface-v1.4.json`
- `core/walters-authority-v1.4.json`
- `BETTING_EDGE_PERSONNEL_SWEEP.md`
- `tools/core-v14-publication-gate.mjs`
- `data/history/report-provenance-schema.json`

Core v1.4 adds explicit fair-value basis/model-error states, Research v1.8 uncertainty graduation, stronger personnel handling, tighter WAIT qualification and switchable Walters authority while preserving the existing execution/freshness/staking boundaries.

## Report-card target

Scheduled report lanes target **up to nine meaningful cards**. Nine is a review/presentation target, not a bet quota. Fewer cards and zero BETs are valid; weak filler must not be created merely to fill the board.

Pizza Plays remains downstream of VigScope. If there is no suitable qualifying play, no Pizza selection is preferable to forcing a weak or extreme longshot.

## Current schedule profiles

Canonical slots remain `open`, `main`, `final_morning`, `evening`, `late`.

Current Vancouver pulse → report pairs:

| Profile | Pulse → report pairs |
|---|---|
| MLB / SUMMER | 05:50→06:00, 07:50→08:00, 09:20→09:30, 15:05→15:15, 18:05→18:15 |
| NFL / FOOTBALL | 05:50→06:00, 07:50→08:00, 08:50→09:00, 12:05→12:15, 16:50→17:00 |
| NBA + NHL / WINTER | 05:50→06:00, 10:50→11:00, 13:50→14:00, 15:50→16:00, 17:50→18:00 |

The active-day profile and five-primary-pull cap are controlled by `data/schedule-state.json` and `data/schedule-profiles.json`.

## Odds scheduler

Cloudflare Worker Cron remains the **primary odds scheduler**.

After the Cloudflare→GitHub handoff missed the 18:05 MLB pulse on 2026-08-25, `.github/workflows/odds-refresh-backstop.yml` was added as a **two-minute dispatch backstop**. It checks whether the canonical slot already published and only dispatches the existing protected `odds-refresh.yml` when the slot is missing.

The odds workflow retains active-profile validation, serialization, duplicate protection and the five-primary-pull cap. Manual workflow dispatch remains the final recovery path.

The first live proof of the new backstop remains pending the next due slot. The underlying Cloudflare dispatch path still requires separate reliability diagnosis; that is infrastructure work, not a Core v1.4 methodology change.

## Result Closure

A separate daily **05:00 America/Vancouver** Result Closure task grades finished issued cards and works through unresolved backlog.

It is an audit layer only. It can process legacy Core v1.3 and current Core v1.4 reports but may write only `data/history/observations/...` sidecars. It must never mutate issued status, price, fair, playTo, stake, `coreAssessment`, Walters evidence, Research/Core/Walters provenance, or the betting ledger for hypothetical LEAN/WAIT/PASS outcomes.

Current event quotas are 20 previous-day unique events plus 10 older backlog unique events.

## Crypto Specials

Crypto Specials remains independent from Core v1.4 and runs daily at **10:30 America/Vancouver**.

It may use the useful market-information pass—current/best price, line shopping, implied/no-vig probability, disagreement, movement, maturity and target-price discipline—but does not run Core v1.4 model-error, Walters authority, VigScope publication, report history or betting-ledger workflows.

It writes only `data/crypto-specials.json`.

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

**private master ledger → Cloudflare Worker → sanitized `/api/bet-history` projection → F3 Bet History + Eddie Numbers**

Eddie Numbers uses the public projection, not the private ledger. `data/bet-history-public.json` remains a sanitized fallback.

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

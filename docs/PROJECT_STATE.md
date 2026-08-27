# Betting Edge — Project State

**Last updated:** 2026-08-26 — Cloudflare-only automatic scheduling; canonical public ledger boundary established  
**Repository:** `fhvsvzpmkw-design/-betting-edge-terminal`  
**Primary branch:** `main`

This is the practical current-state snapshot. It does not replace `BETTING_EDGE_CONTRACT.md`. Historical implementation detail remains available through Git history and dated acceptance/closeout records.

## Current production boundary

- **Governance:** `BETTING_EDGE_CONTRACT.md` — **v1.0 OPERATIONAL**.
- **Presentation:** `runner.html` — **VigScope Terminal UI v1.5**.
- **Report engine/core:** **Core v1.4 OPERATIONAL** — authority `core/core-v1.4-production.json`.
- **Core v1.4 cutover:** `2026-08-25T17:20:00-07:00`, forward-only.
- **Research Library:** **v1.8 / R3 live read-only**.
- **Research inventory:** 130 logical items / 108 sources / 30 evidence clusters.
- **Walters runtime authority:** `core/walters-authority-v1.4.json`, currently **BET_AUTHORITY**.
- **Initial Walters coverage:** NFL spread + NFL moneyline.
- **Personnel process:** Stage 1 broad current information plus mandatory Stage 2 depth/re-handicap when material.
- **Report provenance:** schema 3 with Core/Research/Walters exact provenance and structured `coreAssessment` / `waltersEvidence` after the Core 1.4 cutover.
- **Canonical public ledger:** `data/ledger/public-ledger.json`, sanitized public projection only.
- **Authoritative rollback:** Git history.

Core v1.4 preserves the proven v1.3 execution baseline but adds explicit fair-value-basis/model-error classification, fixed Research v1.8 uncertainty graduation, stronger personnel sensitivity, tighter WAIT qualification and switchable Walters authority.

Historical Core v1.3 reports remain immutable evidence.

Closeout record: `BETTING_EDGE_CORE_V1_4_CLOSEOUT_2026-08-25.md`.

## Core v1.4 decision boundary

Every current production recommendation must obey the ordinary hard gates plus the v1.4 model-error layer.

Controlled model-error states are:

- `STANDARD`
- `ELEVATED`
- `HIGH`
- `UNQUANTIFIED`

Key behavior:

- market-derived-only fair value cannot masquerade as an independent handicap;
- material supported-book disagreement raises uncertainty rather than creating edge;
- direct calibration gaps can raise the model-error floor;
- HIGH-error candidates need strong enough independent support to remain actionable;
- market/book disagreement alone is not a valid WAIT;
- UNQUANTIFIED blocks BET;
- applicable fixed Research v1.8 graduation rules may raise uncertainty but cannot create a BET or lower model error;
- Walters in BET_AUTHORITY may originate an eligible NFL spread/moneyline candidate but cannot bypass Core, identity, freshness, personnel, price, playTo, exposure or staking gates.

## First Core v1.4 production report

First post-cutover issuance:

- `data/history/runs/2026-08-25/late-182223.json`
- sidecar `data/history/research-fit/2026-08-25/late-182223.json`
- issued `2026-08-25T18:22:23.515-07:00`
- feed `2026-08-26T01:08:37.018Z`
- **BET 0 / LEAN 0 / WAIT 0 / PASS 6 / risk $0**

This first report successfully exercised Core v1.4’s conservative uncertainty handling. The exact Kelsey Plum under 1.5 threes continuation moved from the earlier v1.3 WAIT to v1.4 PASS because the large book split, market-derived fair and lack of independent under support produced HIGH model error rather than an actionable WAIT.

Post-publication Core/history verification passed.

## Report-card target

Scheduled report automations now target **up to nine meaningful cards**.

Nine is a presentation/review target only:

- do not manufacture cards to reach nine;
- do not lower BET/WAIT standards;
- fewer than nine cards is valid;
- zero BETs is valid.

Pizza Plays remains downstream of VigScope and should publish no play when the qualifying board offers no suitable choice rather than forcing a weak or extreme longshot.

## Seasonal schedule profiles

Scheduling is controlled by:

- `BETTING_EDGE_SCHEDULE_PROFILE_ADDENDUM.md`
- `data/schedule-profiles.json`
- `data/schedule-state.json`

Canonical lane identity remains `open`, `main`, `final_morning`, `evening`, `late`.

Current configured Vancouver pulse → report pairs:

| Profile | Pulse → report pairs |
|---|---|
| MLB / SUMMER | 05:50→06:00, 07:50→08:00, 09:20→09:30, 15:05→15:15, 18:05→18:15 |
| NFL / FOOTBALL | 05:50→06:00, 07:50→08:00, 08:50→09:00, 12:05→12:15, 16:50→17:00 |
| NBA + NHL / WINTER | 05:50→06:00, 10:50→11:00, 13:50→14:00, 15:50→16:00, 17:50→18:00 |

`data/schedule-state.json` defaults to `mlb`, has no queued selection, and preserves the five-primary-pull daily cap.

## Odds scheduler and recovery

- **Primary odds workflow:** `.github/workflows/odds-refresh.yml`.
- **Single automatic scheduler:** Cloudflare Worker Cron.
- **Automatic GitHub scheduler backstop:** removed 2026-08-26.
- **Manual recovery:** explicit `odds-refresh.yml` workflow dispatch when a scheduled Cloudflare handoff is missed.
- **Books:** Bet365 + DraftKings.
- **Feed freshness:** 75 minutes.
- **Executable quote freshness:** 30 minutes.
- **Daily primary-pull cap:** five.

The Cloudflare→GitHub handoff missed the 18:05 MLB pulse on 2026-08-25. A manual pull around 18:08 supplied the valid snapshot used by the first Core v1.4 18:15 report.

A temporary two-minute GitHub Actions backstop was subsequently added but removed on 2026-08-26 to keep scheduling understandable and single-source. There is now no second automatic scheduler. If Cloudflare misses a pulse, recovery is manual and deliberate.

Cloudflare authentication/dispatch reliability remains an infrastructure item to observe and repair as needed; do not treat it as a Core v1.4 regression.

## Report automation boundary

Every active seasonal report task now requires:

- schedule-profile gate first;
- Contract v1.0 OPERATIONAL;
- Core v1.4 OPERATIONAL production manifest/framework;
- Research v1.8 / R3 live read-only;
- current Walters authority mode and exact SHA;
- 75-minute feed / 30-minute executable quote limits;
- exact Bet365/DraftKings identity;
- Stage 1 current research + Stage 2 personnel where material;
- current WAIT qualification;
- structured `coreAssessment` and `waltersEvidence` for every recommendation;
- schema-3 sidecar with exact Core/Research/Walters provenance;
- immutable history publication and machine verification.

## Durable history and result closure

Issued reports are immutable under:

`data/history/runs/YYYY-MM-DD/<slot>-HHMMSS.json`

Research/provenance sidecars are under:

`data/history/research-fit/YYYY-MM-DD/<slot>-HHMMSS.json`

Result/price observations are separate under:

`data/history/observations/YYYY-MM-DD/<slot>-HHMMSS.json`

The daily **05:00 America/Vancouver Result Closure** task is an audit layer, not a handicap engine. It can process both legacy Core v1.3 and current Core v1.4 cards. It must never mutate issued status, price, fair, playTo, stake, Core assessment, Walters evidence or schema-3 provenance.

Result Closure keeps separate quotas of up to 20 previous-day unique events plus 10 older backlog events, deduplicated by exact `rec.feed.eventId`.

## Crypto Specials boundary

Crypto Specials remains separate from Core v1.4.

- Scheduled daily at **10:30 America/Vancouver**.
- Opens the configured source first and performs fresh discovery before carry-forward review.
- May use the useful Betting Edge market-information pass: price, line shopping, no-vig, disagreement, movement, market maturity and target-price discipline.
- Does **not** run the Core v1.4 model-error gate, Walters authority, VigScope approval, report-history publication or ledger workflow.
- Writes only `data/crypto-specials.json`.

The 10:30 time avoids collision with the NBA/NHL 11:00 seasonal report lane.

## Private ledger / F3 boundary

The public/customer-facing ledger contract is now anchored at:

`data/ledger/public-ledger.json`

The current architecture supports both a private-derived projection and a future customer-supplied sanitized public ledger:

**private/accounting source → sanitization boundary → canonical public ledger contract → F3 Bet History + Eddie Numbers / Muddy Numbers**

Current Cloudflare production may still build the live sanitized `/api/bet-history` projection from the private master ledger behind the server boundary. The public repository additionally maintains the stable canonical upload/static contract at `data/ledger/public-ledger.json`.

Only the canonical public-ledger file is intended for manual replacement or future customer upload. `.github/workflows/public-ledger-sync.yml` validates it, then generates byte-identical compatibility copies at `data/bet-history-public.json` and `api/bet-history`.

`tests/muddy-ledger-desk.test.mjs` enforces that the public ledger remains sanitized, compatibility files do not drift, and Eddie Numbers never becomes dependent on the raw private ledger.

The raw private ledger must not become a public runtime dependency. Full operating procedure: `docs/PUBLIC_LEDGER_OPERATIONS.md`.

## Research Library

Production Research Library is **v1.8 / R3 live read-only**.

It may provide History Fit and, through the fixed Core v1.4 graduation allowlist, raise model-error floors where applicable. It may not independently create BET, supply executable price, move the fair point estimate in normal History Fit, lower model error, set stake or override execution gates.

## Explicitly deferred beyond Core v1.4

Still deferred:

1. results / CLV feedback learning loop;
2. Shadow History activation;
3. learned player/team associations;
4. personal-ledger calibration.

Also unchanged: no paid odds API, no additional execution books, no staking-methodology change and no broad decision-process rewrite.

## Current operating posture

Core v1.4 is the forward production baseline. Near-term work is **observation and reliability**, not Core v1.5 by default:

- observe the Cloudflare scheduler across live slots;
- use manual GitHub dispatch only when a scheduled Cloudflare handoff is actually missed;
- observe a full Core v1.4 morning/day funnel;
- inspect Walters-vs-market behavior when eligible NFL boards appear;
- verify Stage 2 personnel depth on a genuinely personnel-sensitive candidate;
- keep Pizza Plays and other downstream presentation layers from forcing weak selections;
- keep the canonical public-ledger upload/sync boundary stable as customer-facing ledger support evolves.

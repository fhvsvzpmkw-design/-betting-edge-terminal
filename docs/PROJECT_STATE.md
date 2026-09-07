# Betting Edge — Project State

**Last updated:** 2026-09-07 — Graham terminal renamed The Private Line
**Repository:** `fhvsvzpmkw-design/-betting-edge-terminal`  
**Primary branch:** `main`

This is the practical current-state snapshot. It does not replace `BETTING_EDGE_CONTRACT.md`. Historical implementation detail remains available through Git history and dated acceptance/closeout records.

## September 7 Graham publication name

Graham Mercer’s terminal is now **The Private Line**, replacing The Nineteenth Hole at the user’s direction. The live masthead, browser title, directory and slot labels, character profile, shell, current publication metadata, feed builder and forward publishing references use the new name. Graham’s identity, routes, calculations, schedules and green-and-gold presentation remain unchanged. Historical rollback snapshots retain their original publication metadata.

## September 7 automatic Graham publication handoff

Numeric personnel and matchup publications can change the non-QB base beneath an unchanged QB term. Their bot-authored commits do not trigger another push-based Actions workflow, so QB validation metadata could previously remain stale even when the new fair was correct. Successful main-branch completion of the existing personnel, M4 matchup, M5 catch-up, H4 activation and research-input publishers now triggers the existing QB production workflow. Only its successful completion hands those numeric updates to terminal refresh. Failed, cancelled and non-main upstream runs do not authorize the handoff.

Every terminal publication also checks the current QB production arithmetic before market capture or feed construction. If another refresh overlaps reconciliation, the existing four-attempt publication loop waits 30 seconds between attempts and reloads main; this retains the original trigger's odds-capture behavior. Validation must succeed before publication. The existing calculator preserves the approved football change, refreshes the QB base without adding the term again, and remains byte-idempotent on replay. Odds observation and research/schedule metadata refresh paths retain their existing roles; no schedule, player value, betting gate or issued history is changed.

## September 7 Atlanta QB baseline resolution

The user-approved `atlanta-qb-baseline-2026-09-07-v1` amendment in the existing QB production contract admits Atlanta as the 32nd team. The frozen Stage 4 unresolved options both have Stage 2 prior value 7.5, so the differential reference is value-invariant. This resolves the numerical baseline without selecting an invented historical starter, inferring workload shares, or claiming to reconstruct the seed team rating. Original Stage 2–5 sources, activation audit and rollback snapshot remain immutable.

Official Atlanta reporting confirms Tua Tagovailoa as the Week 1 starter, Cooper Rush as backup and Michael Penix inactive. Tua's frozen candidate 7.5 minus the fixed 7.5 baseline gives ATL delta 0; Pittsburgh's existing Rodgers delta is −0.75. The scoped production transition removes the obsolete −0.5 starter-identity uncertainty term and applies both QB deltas: old exact PIT −4.582 → base −4.082 → revised exact PIT −3.332, displayed PIT −3.5. No other matchup needs a numerical change for this amendment. Separate unresolved personnel cases remain subject to their own evidence requirements.

The existing QB calculator generates the amended board and manifest, committed atomically with the amended contract so scheduled validators never see a partially applied scope. The production workflow verifies/reconciles the staged result and triggers terminal publication. Subsequent starters use the same fixed 7.5 Atlanta baseline. Newly unresolved starters still block fresh QB contributions and preserve the last approved fair. Scheduled tasks use the current contract and validated production binding rather than a permanent Atlanta exclusion. This scoped amendment does not change Core betting gates, wagers, stakes or review schedules.

## September 6 quote freshness correction

The provider's `updatedAt` records last market change, so using it as last observation incorrectly excluded unchanged prices returned by a fresh pull. The forward-only correction uses `quoteObservationVersion: 1`, market `observedAt`, collector `collectionStartedAt` and a completed-snapshot `generatedAt`. The existing 30-minute executable and 90-minute retention limits use observation age; the 75-minute whole-feed limit remains. Original `updatedAt` values stay available for movement provenance, and unchanged re-observations do not count as movement. Missing/suspended prices and invalid observations stay unavailable.

Contract section 4.0a, the shared scheduled authority and `docs/ODDS_OBSERVATION_FRESHNESS.md` describe the coordinated collector/validator/lineage/meter/runner correction for all five report tasks. No schedules, API budget, props scope, decision rules or issued history change. Older feeds retain their original clock and cannot be backfilled. The next ordinary refreshed feed/report must establish live recovery and successful publication; no recovered-selection count or new betting outcome is assumed.

## September 6 primary-market and evidence follow-up

The later dated authorities supersede older scope/card-count summaries below: active Betting Edge analysis is full-game primary markets only and player props are paused. From September 6, all EVALUATED primary decisions are published, including PASS; there is no numeric card target. The former preference and its synchronization workflow are retired. The September 5 15:15 report's 12 cards remain historical evidence under the former policy.

The September 6 06:00 report recorded 28 MLB moneyline reviews and 36 `CALIBRATION_UNAVAILABLE` blockers. The subsequent fair-construction clarification permitted supported market-anchored work and identified unfinished research explicitly. The 15:15 report then had 30 available selections, zero unavailable quotes and zero evaluations: all 30 were `RESEARCH_INCOMPLETE`. Its original staging bundle already contained the same incomplete receipts. The publisher succeeded without removing completed evaluations. The exposed records establish premature producer finalization and permissive validation, not a proven timeout or usage-limit cause.

PR #66 introduced an ordered qualified-odds → current-research → fair-value → decision process and the read-only `research-plan` command, but also made any RESEARCH_INCOMPLETE receipt veto the whole report. The user rejected that consequence. Before the first applicable 18:15 run, the correction removes that veto: completed, validated decisions publish unchanged while unfinished selections remain explicitly identified. The publisher derives PARTIAL REPORT with evaluated/unfinished counts, or ANALYSIS INCOMPLETE when none were evaluated. The queue and targeted research/fallback instructions remain; they are not a condition that every selection must finish before any result can be delivered.

Every issued decision still requires its own supported fair/range, sources, Core assessment and material personnel work. Unfinished work receives no fabricated fair, PASS or stake, and genuine terminal limitations remain distinguishable. Existing report/sidecar records hold the research; no new archive, betting model, odds pull or schedule is introduced. The observation-freshness correction and original price-change provenance remain unchanged.

The 15:15 archived report remains historical evidence under its original timestamp rules. Runtime/usage as the original stopping cause remains unproven. A fresh scheduled producer must still demonstrate completed source research, fair-value construction and decisions; successful partial publication by itself does not prove research recovery.

`docs/CORE_MARKET_RECOVERY_2026-09-05.md` records the exact missing/stale-market diagnosis and the bounded supplemental-request correction. `docs/REPORT_EVIDENCE_REQUIREMENTS.md` governs source and numerical fair evidence from 17:00 PT September 5, shared by all five report lanes. Existing histories, Core thresholds, staking and schedules remain unchanged. The next normal feed/report is required to measure live recovery; the 15:15 manual feed did not establish automatic scheduler reliability.

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

## Permanent Main Betting Edge schedule

Scheduling is controlled by:

- `BETTING_EDGE_MAIN_SCHEDULE.md`
- `data/main-schedule.json`

Canonical lane identity remains `open`, `main`, `final_morning`, `evening`, `late`.

Current configured Vancouver pulse → report pairs:

| Schedule | Pulse → report pairs |
|---|---|
| MAIN BETTING EDGE | 05:50→06:00, 07:50→08:00, 09:20→09:30, 15:05→15:15, 18:05→18:15 |

There are no seasonal alternatives, queued state or Preferences selector. The five-primary-pull daily cap is unchanged.

## Odds scheduler and recovery

- **Primary odds workflow:** `.github/workflows/odds-refresh.yml`.
- **Single automatic scheduler:** Cloudflare Worker Cron.
- **Automatic GitHub scheduler backstop:** removed 2026-08-26.
- **Manual recovery:** explicit `odds-refresh.yml` workflow dispatch when a scheduled Cloudflare handoff is missed.
- **Books:** Bet365 + DraftKings.
- **Feed freshness:** 75 minutes from completed snapshot to report.
- **Executable quote freshness:** 30 minutes from exact market observation to completed snapshot for version-1 feeds; legacy feeds retain their original clock.
- **Market retention:** 90 minutes on the same versioned quote clock.
- **Daily primary-pull cap:** five.

The Cloudflare→GitHub handoff missed the 18:05 MLB pulse on 2026-08-25. A manual pull around 18:08 supplied the valid snapshot used by the first Core v1.4 18:15 report.

A temporary two-minute GitHub Actions backstop was subsequently added but removed on 2026-08-26 to keep scheduling understandable and single-source. There is now no second automatic scheduler. If Cloudflare misses a pulse, recovery is manual and deliberate.

Cloudflare authentication/dispatch reliability remains an infrastructure item to observe and repair as needed; do not treat it as a Core v1.4 regression.

## Report automation boundary

Every standard Betting Edge report task now requires:

- Main schedule gate first;
- Contract v1.0 OPERATIONAL;
- Core v1.4 OPERATIONAL production manifest/framework;
- Research v1.8 / R3 live read-only;
- current Walters authority mode and exact SHA;
- 75-minute feed / 30-minute executable quote limits with Contract section 4.0a observation semantics;
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

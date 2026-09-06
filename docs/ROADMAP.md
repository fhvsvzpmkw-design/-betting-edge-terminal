# Betting Edge — Roadmap

**Last updated:** 2026-08-25 — Core 1.4 production closeout

This roadmap separates completed foundations from active near-term work. Preserve the working pipeline, prove new layers independently, and avoid turning reliability or presentation fixes into unnecessary Core-version changes.

## Completed foundations

### Production boundary

- Betting Edge Contract **v1.0 OPERATIONAL**.
- VigScope Terminal UI **v1.5**.
- Betting Edge Core **v1.4 OPERATIONAL**.
- Research Library **v1.8 / R3 live read-only**.
- Walters runtime authority switch operational, currently `BET_AUTHORITY` for eligible NFL spread/moneyline.
- Stage 1 + material Stage 2 personnel workflow operational.
- Schema-3 Core/Research/Walters provenance operational.
- Core 1.4 publication gate and model-error recomputation operational.
- First Core 1.4 production issuance completed and verified on the 2026-08-25 late lane.
- Core 1.4 closeout record: `BETTING_EDGE_CORE_V1_4_CLOSEOUT_2026-08-25.md`.

### Core 1.4 model-error layer

Operational production controls now include:

- explicit fair-value basis;
- book-dispersion, liquidity, tail-risk, calibration and personnel uncertainty;
- `STANDARD / ELEVATED / HIGH / UNQUANTIFIED` model-error states;
- fixed Research v1.8 graduation rules that may raise uncertainty only;
- tighter WAIT rules requiring independent current support/actionability;
- fail-closed BET eligibility under HIGH/UNQUANTIFIED uncertainty;
- Walters evidence/origination provenance when applicable.

The first 1.4 report demonstrated the intended effect by moving a prior market-disagreement WAIT to PASS rather than treating a large supported-book split as edge.

### Report presentation target

Scheduled report lanes now target **up to nine meaningful cards**. Nine is not a bet quota and weak filler must not be manufactured. Zero BETs and fewer than nine cards are valid.

Pizza Plays remains downstream: no qualifying VigScope play means no forced Pizza selection.

### Permanent Main Betting Edge schedule

One permanent schedule is operational with five primary odds pulls per Vancouver operating day:

- Main Betting Edge: 05:50→06:00, 07:50→08:00, 09:20→09:30, 15:05→15:15, 18:05→18:15.

Canonical lanes remain `open`, `main`, `final_morning`, `evening`, `late`.

### Odds reliability architecture

- `.github/workflows/odds-refresh.yml` remains the protected odds workflow.
- Bet365 + DraftKings remain the execution/validation pair.
- Cloudflare Worker Cron remains the primary scheduler.
- `.github/workflows/odds-refresh-backstop.yml` now provides a two-minute GitHub dispatch backstop after a missed Cloudflare→GitHub handoff on 2026-08-25.
- The target odds workflow retains serialization, active-profile gating, canonical-slot duplicate protection and the five-primary-pull cap.
- Manual workflow dispatch remains the final human fallback.
- `data/history/odds-index.json` remains compact odds provenance; full snapshots remain in Git history.

The old scheduler-canary model is no longer part of current operations.

### Durable history and closure

- Immutable issued report storage is established.
- Schema-3 research/Core/Walters sidecars are established.
- `run-history.json` remains the navigation/index layer.
- Result/price observations remain separate under `data/history/observations/`.
- Daily 05:00 Result Closure can process legacy Core v1.3 and current Core v1.4 cards without mutating issued analysis/provenance.
- Current closure quotas remain 20 previous-day unique events + 10 older backlog unique events.

### Separate desks

- Crypto Specials remains independent of Core 1.4 and now runs daily at **10:30 America/Vancouver** to avoid the NBA/NHL 11:00 report-time collision.
- Crypto may use market-information concepts but does not run Core model-error, Walters, VigScope publication or ledger writes.
- Pizza Plays remains a downstream selection/presentation layer rather than a separate handicap engine.

## Priority 0 — Observe Core 1.4 in production

The immediate phase is **observe and verify**, not Core 1.5.

### P0.1 — First full Core 1.4 morning funnel

Observe the next complete sequence:

1. 05:00 Result Closure;
2. 05:50 odds pull;
3. 06:00 Open report;
4. 07:50 odds pull;
5. 08:00 Main report;
6. 09:20 odds pull;
7. 09:30 Final Morning report.

Review whether:

- Core 1.4 preflight/provenance is exact;
- nine-card targeting does not create filler;
- WAITs resolve instead of accumulating;
- genuine independent fair construction appears where available;
- zero-BET outcomes remain acceptable when evidence is insufficient.

### P0.2 — Prove the scheduler backstop

At the next due odds slot verify:

- whether Cloudflare dispatches normally;
- whether the +2-minute GitHub backstop wakes;
- whether it correctly does nothing when the canonical slot is already present;
- or successfully dispatches the protected odds workflow when the slot is missing;
- whether only one actual Odds-API pull is consumed.

Do not call the backstop proven until a real due slot has been observed.

### P0.3 — Repair Cloudflare native dispatch

Diagnose the Worker→GitHub Actions credential/handoff separately from the backstop.

Current leading suspect is the distinction between a dedicated Actions-capable token and the Worker’s private-repository-token fallback, but the exact runtime root cause is not yet proven.

Desired end state:

- dedicated long-lived Actions dispatch credential where required;
- Worker health output distinguishes Actions dispatch credential state from private-ledger credential state;
- native Cloudflare dispatch proves reliable over multiple slots;
- backstop retained until reliability is demonstrated.

### P0.4 — Fix backstop provenance labeling

Current backstop dispatch uses scheduled target mode, so a recovered snapshot may still say `triggerSource: cloudflare-cron`.

Add a distinct fallback source/mode later so history can differentiate:

- Cloudflare primary;
- GitHub cron backstop;
- intentional manual dispatch.

Do not change this in a way that bypasses the existing duplicate/Main-schedule gates.

### P0.5 — Observe Stage 2 personnel on a real material candidate

The first Core 1.4 report did not materially exercise Stage 2 personnel depth. Capture the first serious candidate where lineup/injury/role uncertainty matters and verify:

- correct dependency identification;
- official-source-first check;
- 3–5 fallback origins where required;
- source conflict/shortfall recording;
- explicit pre/post re-handicap impact;
- fail-closed behavior when material uncertainty remains.

### P0.6 — Observe Walters-vs-market trajectory

On eligible NFL spread/moneyline boards, record more than just whether Walters creates a BET.

Watch:

- Walters fair;
- ordinary Core/market fair;
- gap between Walters and the live market;
- movement over later runs toward/away from Walters;
- whether disagreement is explainable by personnel, timing, key numbers or model error;
- whether Walters-originated candidates survive all ordinary Core gates.

The goal is to learn whether the independent Walters construction is informative, not to maximize Walters bet count.

## Priority 1 — Result / CLV feedback design

The current 05:00 Result Closure is an audit layer only. It must not become a learning loop by accident.

Future work may design a separate results/CLV feedback system covering:

- issued price vs later verified price;
- closing-line value when safely established;
- result/outcome;
- cause-of-failure classification;
- aggregate calibration by sport/market/timing/model-error state.

Any learning feedback into Core requires explicit design and promotion. It remains **deferred beyond Core 1.4**.

## Priority 2 — Shadow History

Shadow History remains **S0 / inactive**.

Before activation define:

- candidate-level collection scope;
- storage growth limits;
- evaluation cadence;
- separation from issued-report history;
- safeguards against circular self-training;
- promotion/rollback criteria.

Do not confuse durable H-track issued history with Shadow History.

## Priority 3 — Learned player/team associations

Structured odds/history may eventually support recurring player/team association learning for MLB, NFL/NCAAF/CFL, NBA/WNBA and NHL.

This remains subordinate to current authoritative participation validation and is explicitly deferred beyond Core 1.4.

## Priority 4 — Personal-ledger calibration

Personal betting history may eventually provide secondary calibration/context, but must remain separate from broad research and current market value.

Potential outputs:

- sport-specific performance;
- market-type performance;
- timing tendencies;
- stake/risk adherence;
- repeated behavioral strengths/weaknesses.

It must not become circular logic that recommends a bet merely because the user historically likes that bet type.

## Priority 5 — Research gap closure

Research v1.8 is production read-only. Current explicit direct-calibration gaps remain valuable targets for future evidence work, especially:

- WNBA closing player props;
- NFL multi-book direct player props;
- MLB doubles/stolen-base direct closing calibration;
- boxing derivatives;
- CFL broad pregame calibration;
- current-era replication of older WNBA game-market evidence.

Research promotion remains independent from Core versioning.

## Priority 6 — UI / presentation refinement

Keep presentation changes narrow and separate from pipeline reliability.

Near-term candidates:

- verify Pizza Plays quality under Core 1.4 before tightening its downstream selection rule;
- preserve no-selection state when all eligible cards are PASS/unqualified;
- finish known styling regressions without touching Core/scheduler logic;
- improve card/menu interactions only where actual use exposes friction.

## Explicit non-goals for the current phase

- No automatic Core 1.5 merely because Core 1.4 is closed.
- No loosening of Core 1.4 to increase BET count or fill nine cards.
- No Shadow History activation without separate approval.
- No results/CLV learning loop hidden inside the 05:00 closure audit.
- No Research writes during normal reports.
- No paid odds API or extra execution books by default.
- No staking-methodology change.
- No forced Pizza Play.
- No assumption that line movement proves sharp action.
- No broad multi-layer rewrite to solve a scheduler or UI problem.

## Working principle

**Stabilize → observe → validate → document → integrate.**

Core v1.4 is now the production baseline. The next evidence should come from real operation: scheduler reliability, the first full morning funnel, material personnel cases and eligible Walters boards.

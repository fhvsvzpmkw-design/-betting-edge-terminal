# Betting Edge — Operations

**Last updated:** 2026-08-25 — Core 1.4 production closeout / scheduler backstop

This is the practical operating runbook. The authoritative betting-governance file is `BETTING_EDGE_CONTRACT.md` **v1.0 OPERATIONAL**. Core methodology authority is `core/core-v1.4-production.json` **Core v1.4 OPERATIONAL**.

## Production identities

- **Contract:** v1.0 OPERATIONAL.
- **Presentation:** VigScope Terminal UI v1.5.
- **Core:** v1.4 OPERATIONAL.
- **Research Library:** v1.8 / R3 live read-only.
- **Walters authority:** runtime-switchable; currently `BET_AUTHORITY` for eligible NFL spread/moneyline.
- **Report provenance:** schema 3.
- **Timezone:** `America/Vancouver`.
- **Books:** Bet365 + DraftKings.
- **Feed freshness:** 75 minutes.
- **Executable quote freshness:** 30 minutes.
- **Primary Odds-API pull cap:** five per Vancouver operating day.

The version tracks are independent. UI, Core, Contract, Research and character/hotline versions do not automatically promote one another.

## Scheduled report gate order

Every possible seasonal report trigger performs these steps in order:

1. **Schedule profile gate.** Read `BETTING_EDGE_SCHEDULE_PROFILE_ADDENDUM.md`, `data/schedule-profiles.json` and `data/schedule-state.json`. If the trigger is not an active report time for the selected profile, exit before analysis/history.
2. **Contract/Core preflight.** Require Contract v1.0 OPERATIONAL and `core/core-v1.4-production.json` Core v1.4 OPERATIONAL. Resolve exact current Core framework and provenance identities.
3. **Research/Walters/personnel authority.** Resolve Research v1.8, `BETTING_EDGE_PERSONNEL_SWEEP.md`, Walters interface and current Walters authority mode.
4. **Live-feed validation.** Bind the exact `data/live-odds.json` snapshot and enforce scheduleMeta, feed/quote freshness and exact Bet365/DraftKings identity.
5. **Stage 1 handicap.** Perform broad current-information research and independent matchup/model work before finalizing provisional fair value.
6. **Stage 2 personnel.** Where materially personnel-sensitive, perform the required deeper source sweep and explicit re-handicap.
7. **Core 1.4 model-error pass.** Build `coreAssessment`, derive applicable fixed Research graduation IDs and recompute model-error state/eligibility. Market/book disagreement alone is not a WAIT.
8. **Walters pass.** For eligible NFL spread/moneyline, apply current Walters mode. BET_AUTHORITY may originate an auditable candidate but cannot bypass any Core/execution gate.
9. **Research Fit.** Use Research v1.8 read-only History Fit after the provisional current handicap. Normal History Fit cannot create BET or move the fair point estimate.
10. **Payload/provenance validation.** Require exact `rec.feed`, personnel fields, WAIT qualification where applicable, `coreAssessment`, `waltersEvidence`, schema-3 provenance, status/stake/risk consistency and valid serialization.
11. **Immutable publication.** Publish frozen report + matching sidecar + `run-history.json`, never rewriting prior reports.
12. **Machine verification and delivery.** Require the Report history publication verification chain to pass before treating storage as fully verified.

Production authority conflict must fail closed with:

`PREFLIGHT BLOCK — ANALYSIS NOT STARTED`

If storage fails after a valid frozen report exists:

`HISTORY SAVE FAILED — REPORT VALID`

If storage succeeds but machine verification fails:

`HISTORY VERIFY FAILED — REPORT STORED`

Do not rerun handicapping merely to repair storage/verification.

## Card-volume rule

Scheduled report lanes target **up to nine meaningful cards**.

This is not a quota. Do not:

- lower BET or WAIT standards;
- retain weak filler;
- manufacture candidates;
- force a Pizza Play.

Fewer than nine cards and zero BETs are normal valid outcomes.

## Seasonal profile times

Canonical slots remain `open`, `main`, `final_morning`, `evening`, `late`.

| Profile | Vancouver pulse → report pairs |
|---|---|
| MLB / SUMMER | 05:50→06:00, 07:50→08:00, 09:20→09:30, 15:05→15:15, 18:05→18:15 |
| NFL / FOOTBALL | 05:50→06:00, 07:50→08:00, 08:50→09:00, 12:05→12:15, 16:50→17:00 |
| NBA + NHL / WINTER | 05:50→06:00, 10:50→11:00, 13:50→14:00, 15:50→16:00, 17:50→18:00 |

The active day is immutable once underway. Alternate trigger tasks exist so each seasonal clock can be represented, but inactive clocks exit at the profile gate.

## Odds scheduling

Primary odds workflow: `.github/workflows/odds-refresh.yml`.

### Primary path

Cloudflare Worker Cron is the primary automatic clock. It resolves the active Vancouver profile and dispatches the existing odds workflow only when the configured pulse is due.

### Two-minute GitHub backstop

`.github/workflows/odds-refresh-backstop.yml` is the current dispatch-recovery layer. It wakes two minutes after currently configured possible seasonal pulses, resolves the active profile and checks the canonical slot in `data/live-odds.json.scheduleMeta`.

- Slot already published → do nothing.
- Slot missing → dispatch the existing protected odds workflow.

The target workflow retains serialization, schedule/profile validation, duplicate protection and the five-primary-pull cap. The backstop is designed to recover a missed dispatch, not create a second successful API pull.

The backstop was added after the Cloudflare→GitHub handoff missed the 18:05 MLB pulse on 2026-08-25. The first live proof remains pending the next due slot.

### Known provenance limitation

The backstop currently dispatches the target using the scheduled mode. Therefore a snapshot recovered by the GitHub backstop may still record `triggerSource: cloudflare-cron`. Until a distinct fallback source is added, do not use that field alone to prove which scheduler path dispatched the pull.

### Cloudflare follow-up

Cloudflare remains primary. The native Worker→GitHub Actions credential/dispatch path should be repaired and then observed over multiple slots before considering removal of the backstop.

## Manual odds recovery

Manual odds recovery remains available through `workflow_dispatch`.

Use it only when:

1. the scheduled pulse should have occurred;
2. there is no usable fresh snapshot for that canonical slot;
3. neither a primary refresh nor a backstop-dispatched refresh is still running;
4. a fresh pull remains useful before the report.

For the current 05:50→06:00 lane, a practical human fallback check is around **05:55** rather than immediately at 05:50, allowing the primary path and 05:52 backstop time to act first.

Never change Core or Contract merely to recover an odds pulse.

## Manual report-lane recovery

A missed report may be reissued only inside the original canonical lane when the window remains useful.

- preserve the canonical slot;
- append `— RECOVERY` to the label;
- use the actual Vancouver issue time;
- obey the same current Core v1.4 gates;
- request a fresh odds pull only when necessary;
- archive as a new immutable issuance;
- never overwrite an earlier genuine report;
- zero BETs remains valid.

## Structured identity and repricing

Every new recommendation preserves exact structured `rec.feed` identity. Player props require exact event/player/market/side/line identity.

`UPDATE ODDS / REPRICE NOW` is a client-side comparison overlay only. It cannot mutate the issued report, promote status, set stake, rewrite fair value or become issued history.

Spread repricing must respect home-side raw-hdp semantics and spread lineage. A changed handicap is a different current selection and does not inherit the old recommendation automatically.

`PRICE WATCH` remains informational PASS metadata, not a fifth status.

## Durable report history

Issued payloads:

`data/history/runs/YYYY-MM-DD/<slot>-HHMMSS.json`

Research/Core/Walters provenance sidecars:

`data/history/research-fit/YYYY-MM-DD/<slot>-HHMMSS.json`

Result/price observation sidecars:

`data/history/observations/YYYY-MM-DD/<slot>-HHMMSS.json`

`run-history.json` is navigation/index metadata and cannot override the issued payload.

Historical v0.9 / Core v1.3 / Research v1.7 reports remain valid immutable evidence.

## Result Closure — 05:00

The daily Result Closure task runs at **05:00 America/Vancouver**, before the morning odds sequence.

It is an audit layer and must handle both legacy Core v1.3 and current Core v1.4 issuance without rerunning the handicap.

It may write only matching observation sidecars. It must preserve as immutable:

- issued status/price/fair/playTo/stake;
- `rec.feed` identity;
- personnel evidence;
- Core v1.4 `coreAssessment`;
- Walters evidence;
- schema-3 Research/Core/Walters provenance;
- issued report JSON.

Current verification quotas remain:

- up to 20 unique previous-day events;
- plus up to 10 older backlog events.

Deduplicate by exact `rec.feed.eventId` so one final result can close repeated cards across several report runs.

BET results are official. LEAN/WAIT/PASS outcomes are hypothetical and never alter the betting ledger/bankroll.

## Crypto Specials — 10:30

Crypto Specials is a separate daily research/editorial pipeline scheduled for **10:30 America/Vancouver**.

It may use market-information concepts such as price, line shopping, implied/no-vig probability, disagreement, movement, maturity and target-price discipline.

It does **not** run:

- Core v1.4 production preflight/model-error gate;
- Walters authority;
- VigScope approval;
- Betting Edge report-history publication;
- betting-ledger writes.

It writes only `data/crypto-specials.json`. The 10:30 schedule deliberately avoids the NBA/NHL 11:00 report-time collision.

## Pizza Plays

Pizza Plays remains downstream of VigScope. Lou Two-Slice selects a single compelling eligible VigScope play when one exists. An all-PASS/otherwise unqualified board correctly produces no Pizza Play. Do not force a longshot merely to fill the presentation.

## Private ledger / F3 / Eddie Numbers

Current architecture:

**private master ledger → Cloudflare Worker → sanitized `/api/bet-history` projection → F3 Bet History + Eddie Numbers**

The raw private ledger is not a public runtime source. Eddie Numbers must use the public projection.

## Research v1.8 boundary

Research v1.8 is live read-only. Normal History Fit cannot create BET, supply executable price, override identity/freshness, move the fair point estimate or set stake.

Only the fixed Core v1.4 graduated Research allowlist may raise model-error floors according to the operational framework.

## Walters boundary

Current Walters mode is read at runtime from `core/walters-authority-v1.4.json`.

In `BET_AUTHORITY`, an AVAILABLE/current/arithmetic-verified NFL spread/moneyline Walters handicap may originate a candidate or contribute one independent fair input. It remains subordinate to all normal execution and Core model-error gates and cannot set stake directly.

## Deferred work

Do not fold these into ordinary Core v1.4 maintenance:

- Results/CLV feedback learning loop;
- Shadow History activation;
- learned player/team associations;
- personal-ledger calibration;
- paid odds or extra execution books;
- staking-methodology changes.

Core v1.4 closeout record: `BETTING_EDGE_CORE_V1_4_CLOSEOUT_2026-08-25.md`.

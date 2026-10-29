# Betting Edge — Operations

Updated October 27, 2026. This runbook follows the current [scheduled authority](../BETTING_EDGE_SCHEDULED_REPORT_AUTHORITY.md), [Core 1.5 contract](../core/CORE_V1_5_OPERATING_CONTRACT.md), and [project progress](PROJECT_STATE.md). Historical editions remain in Git; their scheduler, card limits and grading quotas do not control current production.

## Production identities

- Contract v1.0, Core **1.5 OPERATIONAL**, VigScope UI v1.5, Research Library v1.8 / R3 read-only.
- America/Vancouver; the permanent Main schedule is `data/main-schedule.json`.
- Execution books: FanDuel and DraftKings for new collections from the October 28, 2026 user-approved replacement; historical Bet365 snapshots remain supported. The bound feed declares its active pair. Pinnacle is the sharp benchmark, never an execution book or automatic betting instruction. Novig retains its existing comparison role.
- Primary full-game moneylines, spreads, MLB run lines, NHL puck lines and totals. Player props are paused; college soccer is excluded upstream.
- Public odds use American format. Structured decimal prices remain unchanged for arithmetic and exact history.

## Five Main report lanes and one collection owner

| Lane | Canonical pulse identity | Report task |
|---|---|---|
| open | 05:50 | 06:00 |
| main | 07:50 | 08:00 |
| final_morning | 09:20 | 09:30 |
| evening | 15:05 | 15:15 |
| late | 18:05 | 18:15 |

Each report task owns its normal odds request after lane resolution. The left column of times supplies permanent identity; it is not another running scheduler. Follow [ODDS_RUN_REQUEST.md](ODDS_RUN_REQUEST.md): inspect the current feed, exact-slot request/run and durable receipt, reuse eligible fulfilled-slot or manual inputs, or submit one governed request for an unfulfilled slot. Verify the exact request commit's collection, saved feed and matching receipt before research.

The existing collector is serialized, suppresses same-slot duplicates and retains the five-primary-slot cap and provider budgets. A queued, skipped, partial or failed pull is not proof of complete collection or permission to submit another. Check errors, concurrency and provider reset before recovery. Intentional manual recovery remains available. Main tasks use the governed scheduled request mode.

Cloudflare odds timers and GitHub odds cron are retired. The Cloudflare Worker continues website hosting/report routing; its delayed scheduled callback performs no network operations. No report task should wait for that timer or a user click.

## Acquisition and source health

Major-sport acquisition requires both sport and league identity. European soccer leagues containing “CFL” are not Canadian football. Preserve primary priority through actual odds requests, retaining the separately approved exact Crypto watch. Ancillary soccer and tennis use remaining capacity.

A bookmaker access denial stops that book for the current pull; the other approved book continues. Do not purchase a plan or introduce a new execution book as automatic recovery. Keep successful quotes, original timestamps and explicit book/source failures.

Read `report-inputs.mjs` acquisition and exact Pinnacle diagnostics before broad research. A known upcoming primary slate with no eligible prices, or failed primary discovery with no eligible prices, is an acquisition failure. It cannot be delivered as a completed empty/no-value analysis. Usable partial coverage remains eligible for its own research and publication gates; retain named unavailable markets and source gaps.

## Exact snapshot, quotes and event eligibility

Accept a same-day snapshot no older than 75 minutes at the saved actual run start. The controller pins its exact blob and acceptance time in `oddsSnapshot`; later analysis/publication duration does not expire or refresh that accepted snapshot. Actual issue time remains truthful. A snapshot stale at intake cannot be rescued by backdating or a new timestamp.

Version-1 quote freshness uses exact successful `observedAt`: 30-minute executable and 90-minute retention limits relative to the completed snapshot. Provider `updatedAt` remains the original price-change timestamp for movement. Failed requests, suspended prices and missing markets do not refresh or resurrect old quotes. Older records retain their original clock rules.

Published cards must concern unstarted events on the same Vancouver operating date at actual issuance. Apply the existing event-eligibility gate again when retiming/freezing. Tomorrow's or already-started games cannot fill a board.

## One saved research queue

Resolve the lane/current Core release and save the complete initial controller checkpoint before broad research. Use `report-run.mjs status`, `next` and `next --event-id`; resume the saved state rather than reconstructing completed work from chat.

Complete shared current event/personnel facts once, then finish supported exact moneyline, spread/run/puck-line and total assessments. Save each event and advance through the queue. Resolve captured forecast applicability, known-source follow-ups, actual model disagreement and material quarterback/goalie/pitcher dependencies. Preserve original source times and named rechecks. A missing forecast is not a universal veto on the qualified market LEAN/PASS route.

BET retains every supported-fair, uncertainty, personnel, execution, exposure and staking gate. Qualified LEAN and WAIT remain zero stake, with meaningful source support and concrete conditions. NHL forecast moneyline opinions retain their approved two-source/one-point rule and explicit Pinnacle disagreement review. A reasoned PASS requires completed assessment. Missing work remains RESEARCH_INCOMPLETE; it never becomes a fabricated PASS or WAIT.

Publish every completed validated primary decision, including PASS. There is no card minimum, target or maximum. Keep incomplete selections and source shortfalls explicit, publish unrelated completed decisions and continue eligible unfinished work. Source attempts, saved EVALUATED counts, validation, publication and analytical completion are separate facts.

## One publisher and exact recovery

The existing controller owns draft/checkpoint, preparation, actual-time retiming, freeze and staging. The existing `report-pipeline.mjs` owns the gate list. Follow [REPORT_RUN_CONTROLLER.md](REPORT_RUN_CONTROLLER.md); do not copy a fixed gate count into task prompts.

Persist the complete lossless checkpoint and exact sealed candidate. Transfer/storage failures never justify dropping cards, market families, receipts or sources. Retry exact bytes for publication infrastructure recovery. A changed analysis/feed/time requires a new eligible actual-time candidate; frozen and issued records stay immutable.

Only `.github/workflows/report-history-staged.yml` writes issued report/sidecar History and its index. It resolves the exact triggering candidate. After success, independently fetch authoritative main and run controller readback against the exact checkpoint. Use [REPORT_PUBLICATION_REQUEST.md](REPORT_PUBLICATION_REQUEST.md) for a preserved candidate lacking its publisher trigger. Never directly write History or claim publication from a queued workflow.

Keep all three VigScope meters active through the existing evidence-derived production/fallback logic. Neither a featured schedule label nor a meter value changes a decision or establishes profitability.

## Existing downstream and separate owners

- [Card Grading](../CARD_GRADING_AUTHORITY.md): native 03:00 Vancouver execution plus the existing 03:30 verification/fallback task; attempt all pending historical events without retired 20/10 quotas. Verify observation/results-index publication and exact remaining backlog. Issued analysis is immutable; hypothetical grades never alter bankroll or betting ledger.
- Graham: [weekly production](../GRAHAM_WEEKLY_PRODUCTION.md), existing readiness/coordinator and task-specific authorities. Preserve completed learning/propagation and independent market isolation. Main reliability maintenance does not change ratings, the fair-number formula or task schedules. Graham hotline comparisons use the latest validated comparison and locked fair; a market difference cannot move that fair or create BET by itself.
- Graham ATS: the existing separate historical closeout owner verifies final scores and grades saved pregame selections against their documented posted spread/comparison rules. Do not grade against Graham's predicted margin or mutate old fairs.
- Crypto Specials retains its independent existing task and editorial outputs. Its own task configuration controls timing. Exact enabled combat watches retain their approved collector scope.
- Pizza Plays remains downstream and uses eligible VigScope output; no forced filler.
- F3 and Eddie Numbers use the sanitized public ledger under [PUBLIC_LEDGER_OPERATIONS.md](PUBLIC_LEDGER_OPERATIONS.md), never the raw private ledger as a public runtime source.

Do not enable intentionally disabled tasks or change any recurring time during error cleanup. Record a substantive repair and its exact verification in the existing [progress entry](PROJECT_STATE.md) and [decision log](DECISIONS.md). Keep deployment and live acceptance distinct; preserve the next unresolved action.

## OddsPapi monthly pacing — October 28

The [approved request budget](ODDSPAPI_BUDGET.md) is in the existing collector before November 1. Preserve seven charged attempts per Vancouver day, five monthly reserve calls, full catalogue/error accounting, NHL/NBA first-batch priority, actual-preseason selection, and the separate definitions cache. Monthly allocation follows the provider account; the routine ceiling is 210 for November or 217 for a 31-day month. Read the saved usage line and explicit deferred competitions. Main reports and FanDuel/DraftKings continue at their existing times. Do not retry a budget deferral or reuse stale Pinnacle prices as fresh.

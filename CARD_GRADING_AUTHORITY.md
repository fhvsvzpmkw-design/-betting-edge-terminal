# Card Grading Authority

Authority version: 1.1
Status: OPERATIONAL
Task: Card Grading
Native execution: daily at 03:00 America/Vancouver, with PST/PDT guard
Verification and fallback owner: existing ChatGPT daily task at 03:30 America/Vancouver

## Scope

Grade the previous Vancouver calendar day's immutable issued Betting Edge cards and older unresolved cards, including older issued cards with missing observation/completion records. This is retrospective settlement, not handicapping or bet execution. The settlement, historical-price, immutable-issuance and retry rules in `data/history/observations/README.md` remain in force. The former 05:00 closure is superseded; the continuing verification task retains its 03:30 schedule.

## Reusable execution path

Use authoritative branch `main` in `fhvsvzpmkw-design/-betting-edge-terminal`.

1. Read this authority, the observation README, `tools/grade-issued-card-history.mjs`, `.github/workflows/card-grading.yml`, and the existing `data/history/grading/request.json`. Inspect any still-running grading request before submitting another; do not supersede an in-progress request.
2. Resolve the previous calendar date using America/Vancouver, not UTC. Create a unique requestId using only letters, digits, hyphens and underscores (maximum 100 characters).
3. Update `data/history/grading/request.json` with its current blob SHA. Payload: `{ "schema": 1, "state": "READY", "requestId": "<unique-id>", "targetDate": "YYYY-MM-DD", "reason": "<daily grading or user-authorized historical recovery>" }`. The push triggers `.github/workflows/card-grading.yml`. Do not create a new dated workflow for each run.
4. Inspect the workflow associated with that exact request commit. The reusable grader verifies historical results, runs the existing settlement and issued-price helpers, preserves already-complete records, attempts every pending past issued event without fixed event quotas, caches result-provider requests by league/date, and leaves ambiguous/unsupported cases unresolved. One exact event can settle multiple issued cards. A day without new cards still permits backlog processing.
5. Require workflow success and independently fetch `data/history/grading/receipts/<requestId>.json` from main. Match requestId and targetDate. The receipt reconciles observations to the results index and lists exact output blob SHAs. The workflow checks exact output blobs at the published receipt commit and reconciles historical completion against the latest main index after committing. A workflow start or an unsaved calculation is not completion.

## Daily reliability and backlog protection

The existing grading workflow also runs natively at 03:00 Vancouver. Its two UTC cron entries are guarded by Vancouver local time and a date-specific receipt, preventing duplicate PST/PDT runs. Native execution prepares and commits its request metadata together with verified historical outputs. The existing 03:30 task verifies the native receipt; if native execution failed, is missing, or left cases unresolved, it uses the same request-driven workflow for a new full recovery pass after checking concurrency. Do not submit a duplicate pass when a successful receipt has already cleared the historical backlog.

All previous-day and older pending events receive an attempt each pass. Remove the old 20/10 caps: an unresolved oldest event must never prevent newer events from being checked. Each receipt reports `historicalCoverage` through the target date, separately from current-day cards in the presentation index, and `backlogHealth` with exact unresolved reasons. Any remaining historical case must be reported with its event identity, source/retry issue and age; a partial result is not a cleared backlog.

Use ESPN FBS and FCS scoreboards, exact supported team aliases, and the official CFL scoreboard for CFL. A missing display name may be recovered from the exact immutable issued snapshot with matching event ID and start, without rewriting issuance. A true conflicting identity stays unresolved. An officially cancelled, unplayed MLB game may receive exact-selection VOID grades for supported full-game markets. For NFL/CFL full-game two-way moneylines tied after overtime, retain verified book-specific refund rules (DraftKings PUSH; Bet365 VOID); spreads and totals still use the final score. Unsupported books or market scopes remain unresolved rather than being assigned losses.

Historical identity parsing removes only a terminal middle-dot league label matching the issued row's supported league; team aliases remain exact, including Middle Tennessee State Blue Raiders / Middle Tennessee Blue Raiders. This changes matching only, never the issued report or selection key. An MLB schedule entry explicitly marked Postponed with no innings or scores may receive book-specific full-game VOID outcomes for Bet365 and DraftKings after the scheduled stadium-local date has passed. Require the original schedule start to equal the issued start and use the official venue timezone; retain each book's baseball rule URL on the settlement. Never follow a mutable live-feed game ID to transfer a later game's result to the original postponed market. Started/suspended games, unsupported books, missing timezone or start evidence remain unresolved.

Concurrent presentation-index changes must not discard verified settlements. The publisher rebases the verified observation files onto current main. An index-only conflict is resolved by rebuilding the derived index from the merged history, verifying unchanged historical population/grades and output observation hashes, and updating the receipt's index hash. Any source, observation, request or other conflict fails closed. Push retries are bounded; there is no force push. Readback verifies the immutable publication commit and the latest index's historical completion count.

## Output boundary and failure handling

The grading workflow may write only the affected historical observation files, `data/history/results-index.json`, and its historical grading receipt; native scheduled runs may additionally prepare and commit `data/history/grading/request.json`. Request/receipt metadata is not live report-production state. No live odds may be read or refreshed; no issued report, fair, status, stake, personnel evidence, report staging, bankroll or betting ledger may be changed. Existing historical snapshots alone supply price analytics.

A receipt marked COMPLETE means the target date and older backlog are complete, not that cards issued today have settled. PARTIAL_UNRESOLVED records a successful durable pass with remaining cases; report the cases and quota deferrals rather than manufacturing grades. Reports containing no BET cards are hypothetical decision-quality tracking only.

If source verification fails, retain unresolved cases. If writing, schema reconciliation, isolation, concurrency, or remote readback fails, report the exact failed stage and whether any outputs were actually persisted. Respect action safety denials; do not reroute around them. Keep the recurring task enabled after a successful run, empty day, partial result or individual failure. Only an explicit user request may pause, disable, delete or reschedule this recurring task.

## Explicit legacy identity correction — September 25, 2026

The user separately authorized cleanup of the 35 integrity warnings recorded in recovery receipt `card-grading-recovery-20260925-sep24-v1`: one conflicting August 27 observation event ID and 34 missing September 19 observation selection keys. This is a metadata repair, not routine regrading or price backfilling.

Only that authorized cleanup request may add `"identityCleanup": "legacy-identities-20260925-v1"` with targetDate `2026-09-24`. Daily requests must omit this field; never copy it forward from the previous request. `tools/repair-card-observation-identities.mjs` pins all five issued-source blobs, all five pre-correction observation blobs, the 35 exact row mappings and the single permitted event-ID correction. It rejects any changed input, wrong event, reordered row, incompatible line, grade change or replay. All inputs must validate before outputs are prepared.

The September 19 completion objects remain unchanged. The August 27 row preserves its teams, score, LOSS, timestamps and settlement source; only its observation selectionKey and completion.eventId are aligned with the immutable issued card. No issued report is altered. The script records complete before/after rows and sources in `data/history/grading/corrections/legacy-identities-20260925-v1.json`.

This opt-in adds only that historical correction audit to the existing runtime output allowance. The same workflow rebuilds the downstream index, requires unchanged affected-date grades and price analytics, confirms the targeted warnings have disappeared, commits observations/index/audit/receipt together, and verifies remote output blobs and unchanged issued-source blobs. A conflict stops the transaction rather than forcing a correction. The legacy correction remains opt-in; the version 1.1 reliability changes above supersede the earlier event quotas while preserving live-production isolation and the existing daily verification task.


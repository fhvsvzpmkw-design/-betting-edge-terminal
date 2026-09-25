# Card Grading Authority

Authority version: 1.0
Status: OPERATIONAL
Task: Card Grading
Schedule owner: existing ChatGPT daily task at 03:30 America/Vancouver

## Scope

Grade the previous Vancouver calendar day's immutable issued Betting Edge cards and older unresolved cards, including older issued cards with missing observation/completion records. This is retrospective settlement, not handicapping or bet execution. The settlement, historical-price, immutable-issuance and retry rules in `data/history/observations/README.md` remain in force. Its older 05:00 Result Closure schedule description does not change the current Card Grading task's 03:30 schedule.

## Reusable execution path

Use authoritative branch `main` in `fhvsvzpmkw-design/-betting-edge-terminal`.

1. Read this authority, the observation README, `tools/grade-issued-card-history.mjs`, `.github/workflows/card-grading.yml`, and the existing `data/history/grading/request.json`. Inspect any still-running grading request before submitting another; do not supersede an in-progress request.
2. Resolve the previous calendar date using America/Vancouver, not UTC. Create a unique requestId using only letters, digits, hyphens and underscores (maximum 100 characters).
3. Update `data/history/grading/request.json` with its current blob SHA. Payload: `{ "schema": 1, "state": "READY", "requestId": "<unique-id>", "targetDate": "YYYY-MM-DD", "reason": "<daily grading or user-authorized historical recovery>" }`. The push triggers `.github/workflows/card-grading.yml`. Do not create a new dated workflow for each run.
4. Inspect the workflow associated with that exact request commit. The reusable grader verifies historical results, runs the existing settlement and issued-price helpers, preserves already-complete records, enforces separate 20-event previous-day and 10-event older-backlog quotas, and leaves ambiguous/unsupported cases unresolved. One exact event can settle multiple issued cards. A day without new cards still permits backlog processing.
5. Require workflow success and independently fetch `data/history/grading/receipts/<requestId>.json` from main. Match requestId and targetDate. The receipt reconciles observations to the results index and lists exact output blob SHAs. The workflow also fetches remote main and checks those blobs after committing. A workflow start or an unsaved calculation is not completion.

## Output boundary and failure handling

The grading workflow may write only the affected historical observation files, `data/history/results-index.json`, and its historical grading receipt. Request/receipt metadata is not live report-production state. No live odds may be read or refreshed; no issued report, fair, status, stake, personnel evidence, report staging, bankroll or betting ledger may be changed. Existing historical snapshots alone supply price analytics.

A receipt marked COMPLETE means the target date and older backlog are complete, not that cards issued today have settled. PARTIAL_UNRESOLVED records a successful durable pass with remaining cases; report the cases and quota deferrals rather than manufacturing grades. Reports containing no BET cards are hypothetical decision-quality tracking only.

If source verification fails, retain unresolved cases. If writing, schema reconciliation, isolation, concurrency, or remote readback fails, report the exact failed stage and whether any outputs were actually persisted. Respect action safety denials; do not reroute around them. Keep the recurring task enabled after a successful run, empty day, partial result or individual failure. Only an explicit user request may pause, disable, delete or reschedule this recurring task.

## Explicit legacy identity correction — September 25, 2026

The user separately authorized cleanup of the 35 integrity warnings recorded in recovery receipt `card-grading-recovery-20260925-sep24-v1`: one conflicting August 27 observation event ID and 34 missing September 19 observation selection keys. This is a metadata repair, not routine regrading or price backfilling.

Only that authorized cleanup request may add `"identityCleanup": "legacy-identities-20260925-v1"` with targetDate `2026-09-24`. Daily requests must omit this field; never copy it forward from the previous request. `tools/repair-card-observation-identities.mjs` pins all five issued-source blobs, all five pre-correction observation blobs, the 35 exact row mappings and the single permitted event-ID correction. It rejects any changed input, wrong event, reordered row, incompatible line, grade change or replay. All inputs must validate before outputs are prepared.

The September 19 completion objects remain unchanged. The August 27 row preserves its teams, score, LOSS, timestamps and settlement source; only its observation selectionKey and completion.eventId are aligned with the immutable issued card. No issued report is altered. The script records complete before/after rows and sources in `data/history/grading/corrections/legacy-identities-20260925-v1.json`.

This opt-in adds only that historical correction audit to the existing runtime output allowance. The same workflow rebuilds the downstream index, requires unchanged affected-date grades and price analytics, confirms the targeted warnings have disappeared, commits observations/index/audit/receipt together, and verifies remote output blobs and unchanged issued-source blobs. A conflict stops the transaction rather than forcing a correction. This amendment does not change recurring activation, scheduling, event quotas or live-production isolation.

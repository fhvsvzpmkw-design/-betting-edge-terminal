# Default report-start odds workflow

All five Main report tasks launch their normal odds pull through the connected GitHub tools by committing `data/odds-run-request.json` on `main`. This is the default entry point to the existing `Refresh Betting Edge odds` collector. Do not wait for a separate odds timer or a user to press Run workflow. GitHub cron is retired and legacy Cloudflare scheduled dispatches are rejected before collection.

The five report times remain 06:00, 08:00, 09:30, 15:15 and 18:15 America/Vancouver. Canonical pulse times in `data/main-schedule.json` remain slot identity anchors; the primary pull now starts with its report task. Keep actual request, start, save and issue timestamps. This avoids GitHub cron delay; report-task start time and Actions runner availability still affect completion.

## Default first step for each report

After resolving the Main lane and before binding inputs or broad research, inspect `data/live-odds.json`, `data/odds-pull-receipts/<Vancouver-date>.json`, and the latest request and exact-slot Actions run. Reuse a normally usable feed for an already fulfilled slot, or an eligible fresh manual feed under the shared authority. Otherwise request this slot's primary pull once when it is unfulfilled and no matching request/run already exists. Do not wait to declare a missed pull first.

Use a fresh `requestedAt` and a unique `requestId`. Resolve `scheduledAt` as that date's exact canonical pulse with the actual America/Vancouver UTC offset. The existing `scheduled_recovery` enum and `report-task-recovery` provenance remain compatibility names for this default method. Replace every example value with the actual lane/date/clock:

```json
{
  "schema": 1,
  "requestId": "2026-10-19-open-primary-unique-id",
  "mode": "scheduled_recovery",
  "requestedAt": "2026-10-19T06:00:00-07:00",
  "scheduledAt": "2026-10-19T05:50:00-07:00",
  "operatingDate": "2026-10-19",
  "canonicalSlot": 1
}
```

Create the file if absent; otherwise fetch its current blob SHA and replace it with the connected GitHub file tool. The workflow validates exact request bytes from the triggering commit. Requests must be at most 10 minutes old when resolved; scheduled requests must match a current-day canonical pulse within 75 minutes. Concurrency and durable slot receipts suppress duplicate collection. Preserve the five primary slots, quote freshness, exact identity, provider budgets, research and publication gates.

Inspect the Actions run for the exact request commit and wait in bounded checks. Never submit another request while that run is queued or running. Independently verify saved feed bytes/blob SHA, actual `generatedAt`, date, canonical slot, provider errors/coverage, and matching slot receipt/workflow run ID before rebuilding report inputs. If deduplication skips collection, verify the fulfilled feed is usable. An accepted request, green skipped job or saved partial snapshot alone is not a complete pull.

If collection or publication fails, preserve the request and checkpoint and inspect the actual failed step. A partial/HTTP429 snapshot or a failed run after API spending does not authorize automatic repeat collection; inspect provider diagnostics and its returned reset. Durable receipt absence after a failed job does not prove that no API requests were spent. Do not loop requests, manufacture freshness, change lanes or ask for a routine manual pull. Report the concrete limitation and keep the report task enabled.

## An explicitly requested manual pull

An intentional on-demand pull uses `mode: "manual"`, a fresh `requestedAt` and a unique `requestId`, or the existing manual Run workflow button. It retains normal manual provenance and existing quota constraints. Report tasks use the slot-bound scheduled mode above.

## Verification status

The connected-request test started the workflow and saved a snapshot, but the October 18 test was partial after HTTP429. Tonight's existing 19:12 PT verification remains scheduled to check complete collection after the provider reset. Punctual unattended operation of the new primary path remains unverified until real scheduled report tasks exercise it. Do not claim an exact-time guarantee.

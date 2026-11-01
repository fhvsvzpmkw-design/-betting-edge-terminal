# Default report-start odds workflow

All five Main report tasks launch their normal odds pull through the connected GitHub tools by committing `data/odds-run-request.json` on `main`. This is the default entry point to the existing `Refresh Betting Edge odds` collector. Do not wait for a separate odds timer or a user to press Run workflow. GitHub cron is retired and legacy Cloudflare scheduled dispatches are rejected before collection.

The five report times remain 06:00, 08:00, 09:30, 15:15 and 18:15 America/Vancouver. Canonical pulse times in `data/main-schedule.json` remain slot identity anchors; the primary pull now starts with its report task. Keep actual request, start, save and issue timestamps. This avoids GitHub cron delay; report-task start time and Actions runner availability still affect completion.

## Default first step for each report

After resolving the Main lane and before binding inputs or broad research, inspect `data/live-odds.json`, `data/odds-pull-receipts/<Vancouver-date>.json`, and the latest request and exact-slot Actions run. Reuse a normally usable feed for an already fulfilled slot, or an eligible fresh manual feed under the shared authority. Otherwise request this slot's primary pull once when it is unfulfilled and no matching request/run already exists. Do not wait to declare a missed pull first.

Use a fresh `requestedAt` and a unique `requestId`. Resolve `scheduledAt` as that date's exact canonical pulse with the actual America/Vancouver UTC offset. The existing `scheduled_recovery` enum and `report-task-recovery` provenance remain compatibility names for this default method. Replace every example value with the actual lane/date/clock:

**November 1 timezone repair:** B.C. remains on UTC-7 after March 2026. The odds workflow now installs current Node 24 rather than relying on Ubuntu's preinstalled Node/timezone data, and the shared schedule loader verifies both the new winter clock and historical PST before provider access. Generate the exact request with `node tools/odds-run-request.mjs create --report-time <HH:MM>` using the expected Main report time, then commit its complete JSON bytes. The command uses the actual current clock and canonical pulse, validates the unchanged 10-minute/75-minute windows, and avoids manually guessing `-07:00` or `-08:00`. A stale host fails with `VANCOUVER_TIMEZONE_DATA_OUTDATED`; use the configured runtime before constructing or resolving the request. Task schedules, provider budgets, deduplication and report freshness remain unchanged.

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

The November 1 clock repair passed all eight relevant GitHub checks and live Main request [e307e31](https://github.com/fhvsvzpmkw-design/-betting-edge-terminal/commit/e307e31ffbdec13257a7c55020e5b5a91263ce30). [Workflow 41321966179](https://github.com/fhvsvzpmkw-design/-betting-edge-terminal/actions/runs/41321966179) installed the current runtime, passed the clock/request/duplicate gates, collected both books and Pinnacle with zero errors, and saved the matching slot-2 feed/receipt. The independently verified feed was generated at 08:36:51 Vancouver; 245 qualified benchmark markets and 3/250 estimated monthly OddsPapi usage were saved. This verifies acquisition recovery, not exact-time scheduling, completed analysis or report publication. The earlier October 18 HTTP429 test and November 1 Open failure remain historical failures; they are not rewritten as successful pulls.

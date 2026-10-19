# Connected odds workflow requests

The connected GitHub tools can start the existing `Refresh Betting Edge odds` workflow by committing `data/odds-run-request.json` on `main`. This is an additional entry point to `.github/workflows/odds-refresh.yml`, not another odds collector or a change to the report schedule. It avoids GitHub's delayed cron event and does not require a browser login. Actions runner availability still determines when the job starts.

## Automatic report recovery

After resolving the current Main report lane and before binding report inputs, inspect `data/live-odds.json` and `data/odds-pull-receipts/<Vancouver-date>.json`. Use a normally eligible current feed when available. If the required lane's odds are missing, stale, or bound to another automatic lane, and that slot has not been fulfilled, request its existing primary pull automatically. Do not ask the user to press Run workflow. Never pull again merely because prices or selections are unattractive.

Use a fresh `requestedAt` and a unique `requestId`. Resolve `scheduledAt` as that date's exact configured pulse in `America/Vancouver`, with its actual UTC offset. For example, the following is the request shape; all example values must be replaced with the actual lane/date/clock:

```json
{
  "schema": 1,
  "requestId": "2026-10-19-open-recovery-unique-id",
  "mode": "scheduled_recovery",
  "requestedAt": "2026-10-19T06:00:00-07:00",
  "scheduledAt": "2026-10-19T05:50:00-07:00",
  "operatingDate": "2026-10-19",
  "canonicalSlot": 1
}
```

Create the file if absent; otherwise read its current blob SHA and replace it with the connected GitHub file tools. The workflow validates the exact request bytes at the triggering commit, not a later replacement. Requests must be at most 10 minutes old. Scheduled recovery must match one controlled current-day pulse and start within 75 minutes of it. The ordinary slot receipt and workflow concurrency gates suppress duplicate collection, preserving five primary slots per operating day. Existing quote freshness, exact identity, odds-provider quota, research and publication gates remain unchanged.

Inspect the Actions run for the exact request commit. Wait for completion in bounded checks; do not issue duplicate requests while a matching run is queued or running. Success requires independent readback of the saved feed and the matching slot receipt: verify the actual `generatedAt`, blob SHA, canonical slot, date and workflow run ID. A green skipped job or accepted request alone is not fresh odds. If deduplication skips collection, verify the existing fulfilled feed is usable. Rebuild the report input inventory only after this readback, then continue the normal controller sequence.

If collection or publication fails, retain the request and checkpoint, inspect the exact failed step, and report that failure. Do not fabricate freshness, change the report's lane, claim a report completed, or ask for a routine manual pull. Do not disable or reschedule report tasks. An expired recovery window remains an explicit odds-collection limitation.

## An explicitly requested manual pull

An intentional on-demand pull uses the same validated request entry point with `mode: "manual"`, a fresh `requestedAt`, and a unique `requestId`. It has the existing manual Run workflow semantics, including valid manual provenance. This mode is reserved for an explicit on-demand request; scheduled report tasks use `scheduled_recovery` and its slot deduplication.

## Verification status

A successful connected-request test proves this trigger can start the collector and save a new snapshot. Punctual unattended operation remains unverified until actual scheduled report runs exercise the recovery without user action. This mechanism removes the need for a browser click; it does not guarantee exact report start times or repair Cloudflare dispatch authentication.

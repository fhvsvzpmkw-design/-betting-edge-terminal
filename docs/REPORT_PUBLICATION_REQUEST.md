# Recover an exact frozen report publication

The governed publisher accepts a small retry pointer at `data/history/staging/publication-request.json`. This recovers a preserved candidate when its staging push produced no publisher run, or after an identified publication infrastructure problem has been fixed. It never collects odds, retimes a report, changes frozen candidate bytes, or grants permission to write issued History directly.

## Before requesting a retry

1. Read the original staging commit and its exact `data/history/staging/report-bundle.json` blob. Confirm its frozen READY envelope, `candidateId`, pinned feed and original report timestamp. A saved frozen checkpoint can verify the byte identity.
2. Inspect the publisher runs for that candidate, including earlier request commits, and its saved recovery receipt under `data/report-production/recovery-receipts/` when present. A later recovery review may identify a candidate blocker after the original infrastructure failure. If a matching run is queued or running, wait for its result. If it succeeded, verify authoritative History and controller read-back instead of creating another request. Never claim publication from staging alone.
3. If a run failed, identify its failed step. Fix timeout, transfer, trigger or concurrent-push infrastructure before retrying. A failed candidate evidence, identity, freshness, eligibility or decision gate requires the normal draft correction and governed validation path; a retry pointer cannot repair the candidate or bypass that gate. Do not repeat the same failed candidate blindly.

## Request file

Create or replace only `data/history/staging/publication-request.json` with these six fields, following `data/report-production/publication-request.schema.json`:

```json
{
  "schema": 1,
  "requestId": "unique-recovery-id-with-real-time",
  "requestedAt": "2026-10-19T21:00:00Z",
  "candidateCommit": "<original 40-character staging commit SHA>",
  "candidateBlobSha": "<40-character Git blob SHA of its exact staged file>",
  "candidateId": "<original report.ts>|<original canonicalSlot>"
}
```

Use a new request ID for the deliberate retry and the actual request timestamp. The example timestamp is illustrative. The candidate commit must already be an ancestor of the retry commit on main. The request timestamp records the retry only; original report, source, quote and feed clocks remain unchanged. There is no short request expiry, so an Actions queue delay cannot silently switch candidates or invalidate the pointer.

Commit this small request through the connected authenticated GitHub write path. Do not replace the current staging bundle to retrieve an older candidate. Inspect the new publisher run for the request commit. If no matching run appears, retain PUBLICATION PENDING and investigate the missing trigger; do not manufacture History or repeatedly post requests.

## Publisher binding and verification

`tools/resolve-report-publication.mjs` checks the exact push's before-to-trigger commit range, reads the request from the exact triggering commit using `git show`, verifies that its referenced commit belongs to that history, hashes the exact candidate bytes, and validates the READY frozen envelope and candidate identity. This covers multi-commit pushes whose last commit changes only a checkpoint. The existing extractor then reads that resolved immutable candidate commit. The same full candidate gates, atomic issued bundle commit, complete history verification and authoritative remote read-back still apply.

A normal staging push always retains its exact triggering commit and ignores an older unchanged request file. If staging and a request change together, the direct staging commit wins only when both identify identical frozen candidate bytes. Manual workflow dispatch retains its existing behavior of publishing the staged candidate from the dispatch commit. An unrelated workflow or documentation push cannot replay a request.

After workflow SUCCESS, fetch authoritative main and execute controller `readback` against the exact original checkpoint. Verify the indexed original report timestamp, decisions, evidence and zero or nonzero risk before giving a terminal link. A recovered historical report remains historical; the retry does not turn its prices into a current betting recommendation.

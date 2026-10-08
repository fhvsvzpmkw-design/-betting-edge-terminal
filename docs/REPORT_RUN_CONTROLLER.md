# Main report controller

Operational entry point: `tools/report-run.mjs`. Analytical rules live in the shared scheduled authority and domain validators; this page documents commands only. All paths below are examples. Run from a current checkout of authoritative main with full history for pinned source blobs.

## Start or resume

Use the actual report timestamp and expected Main lane with `report-inputs.mjs`. Construct the initial report/schema-3 sidecar from exact authority, source and ledger bindings. This is still a research producer task; the controller does not invent draft evidence.

```
node tools/report-inputs.mjs --at <actual-ISO-timestamp> --report-time <HH:MM>
node tools/report-run.mjs start --checkpoint data/report-production/checkpoints/<run-id>.json --report /tmp/report.json --sidecar /tmp/sidecar.json
node tools/report-run.mjs status --checkpoint data/report-production/checkpoints/<run-id>.json
node tools/report-run.mjs next --checkpoint data/report-production/checkpoints/<run-id>.json
node tools/report-run.mjs next --checkpoint data/report-production/checkpoints/<run-id>.json --event-id <event-id>
```

Choose a unique run ID using the operating date, slot and actual issue clock. `start` refuses to overwrite an existing run. The status response gives the current revision. Mutations require `--expected-revision <current-revision>`; stale updates fail without replacing the checkpoint. The entire draft is saved atomically under one checkpoint. There is no model API call in these commands.

The initial `report-inputs` view includes `pinnacleCoverage`: exact-reference counts by sport, skipped categories and collection errors. Event detail supplies failed match reasons at each executable quote. It uses the same exact-market matcher as assessment, including NHL settlement definitions and freshness. Inspect gaps before research; acquisition coverage is not completed analysis or issuance clearance.

`next` also exposes captured forecasts awaiting actual applicability review on events with completed market cards. `next --event-id` includes the latest immutable record IDs, probabilities, native units, original observation times and exact selection questions. Review the actual exported capture and append genuine revalidations or explicit shortfalls; the queue never creates eligibility. Decision completion and outstanding forecast review counts remain separate, and completed qualified cards may still publish.

## Work one event and save

In the work plan, `completionState` describes completed decisions only. Read `reviewCompletionState` and `capturedForecastReviewsPending` separately; completed market decisions can coexist with unperformed forecast reviews. Resolve or disclose that remaining review work before describing the event as fully reviewed. `SOURCE_ORIGIN_ATTRIBUTION` in the card review flags known ESPN reporting facts attached to another publisher or labelled official; correct the source in the current draft using the actually checked reporting URL and original time.

```
node tools/report-run.mjs export --checkpoint <checkpoint> --output-dir /tmp/betting-edge-draft
# Perform real research and edit the exported draft report and sidecar.
node tools/report-run.mjs checkpoint --checkpoint <checkpoint> --expected-revision <revision> --event-id <event-id> --report /tmp/betting-edge-draft/report.json --sidecar /tmp/betting-edge-draft/sidecar.json
```

Keep event facts and their original sources together; all exact selection decisions still require their own binding. The existing evidence assembler synchronizes derived copies. Commit the checkpoint's complete serialized bytes after each event using the connected repository; verify the returned blob SHA. Read current remote checkpoint before resuming. A checkpoint commit is not a publication trigger. For new reports from the noon September 27 cutover, stored advisory audits contain counts and diagnostics rather than duplicated full research queues. Original source evidence, exact decisions and candidate assessments remain available; regenerate detailed advisory views in code. Never print the full checkpoint into conversation; commands emit compact status and event work plans.

Feed and lane are immutable within a run. Before final preparation, advance the unfrozen draft to actual issuance time with:

```
node tools/report-run.mjs retime --checkpoint <checkpoint> --expected-revision <revision> --at <actual-ISO-timestamp>
```

This advances only the report clock and derived paths; it never changes source/quote observation times. It resets preparation and validation. Reconcile the full inventory at the new time, remove newly started/ineligible events, and revalidate evidence before preparing/freezing. Backdating or moving to another operating day is rejected. A new feed binding or a frozen candidate requires a new run, with prior evidence explicitly revalidated as leads. Retain older checkpoints for audit; they do not become issued History.

## Prepare, freeze and stage

For reports from October 8, 2026 at 14:30:43 Pacific, the freeze and triggering-commit extractor require saved `checkpoint --event-id` reviews for every issued-decision event. An available board needs at least one actual saved event review. This verifies execution of the existing review loop; it does not require every selection to finish, force a decision, or prevent an empty slate. The controller supplies the trace automatically. If it identifies missing reviews, export and complete those reviews while the draft is unfrozen, checkpoint each event, retime to actual issuance, then prepare/freeze normally. Never fabricate trace entries.

From October 1, 2026 at 18:47:44 Pacific, `start` and `checkpoint` route standard typed `forecastCapture` inputs from MODEL findings/attempts or `forecastEvidence.pendingCaptures` into the immutable forecast record set. They attach current `forecastReview` metadata without changing decisions, fair or stake. See `docs/FORECAST_LEAD_ROUTING.md`. Checkpoint a newly found field, export the updated draft, then use that exact reviewed record for the producer's BET/LEAN assessment. `next --event-id` includes unresolved `forecastCaptureReviews`; known positive model points cannot disappear behind an unfavorable market screen. `prepare` repeats intake safely and checks final completion. An existing capture is idempotent; a changed immutable ID or future/wrong-event observation fails rather than being repaired silently.

`node tools/report-run.mjs diagnose --checkpoint <checkpoint>` runs all fourteen candidate gates on temporary copies and returns every failure without changing the checkpoint. `prepare` records the same diagnostics after evidence assembly and normalization. Inspect all actual failures in one pass before freezing. These diagnostics grant no publication clearance; the normal freeze, staged publisher and readback checks remain mandatory.

```
node tools/report-run.mjs prepare --checkpoint <checkpoint> --expected-revision <revision>
# Inspect reported deferrals; complete recoverable work or retain honest blockers.
node tools/report-run.mjs freeze --checkpoint <checkpoint> --expected-revision <revision>
node tools/report-run.mjs stage --checkpoint <checkpoint> --expected-revision <revision>
```

Use the new revision returned by each mutation. Preparation changes only unfrozen drafts using existing evidence assembly and normalization. Freeze runs every candidate gate in the shared pipeline and seals the exact staging bytes with a Git blob hash. Stage revalidates current history/policy and writes `data/history/staging/report-bundle.json`. Commit only those exact bytes for publication; verify the remote blob matches the seal. Persist the updated checkpoint separately or in the same commit. Frozen retries use identical bytes. Never change a frozen candidate to suppress a failed gate.

The staged publisher reads the bundle from the commit that triggered that workflow. Only it writes report History. The old `report-history.yml` publisher is retired and now verifies History only.

### Large-document transfer

The controller automatically compresses checkpoints and staging documents over 256 KiB when compression reduces their size. `BETTING_EDGE_GZIP_JSON_V1` carries gzip/base64 bytes, their original length and SHA-256. Reading a checkpoint or extracting the exact triggering staging commit verifies integrity before restoring the full ordinary document. Legacy plain JSON remains readable. Issued reports and sidecars retain their ordinary schemas.

Commit the complete file written by the controller without decoding it. Verify its Git blob SHA; `status` reports transferred `checkpointBytes` separately from `checkpointDecodedBytes`, and the frozen receipt reports the exact staging blob and byte size. Use controller `export` to inspect the full draft locally. Do not print or reconstruct large documents through the conversation. A frozen checkpoint keeps one sealed candidate copy and restores its full report/sidecar on read; retries reuse the original serialized bytes across runtimes.

A connector size/transfer failure does not authorize removing selections, decisions or evidence, or replacing the candidate with a smaller market subset. Preserve the saved checkpoint and sealed candidate; retry the exact files with authenticated Git or the Git-data API. If transfer remains unavailable, report the publication failure and retained work truthfully. Research gaps remain selection-specific and separate from transport failures.

## Confirm publication

After the staging workflow succeeds, fetch authoritative main, preserve/reload the checkpoint, then:

```
node tools/report-run.mjs readback --checkpoint <checkpoint> --expected-revision <revision>
```

Read-back requires the exact indexed report and sidecar, compares frozen decisions and research evidence, and runs the shared checks plus meter validation. Persist its receipt. Only then report successful publication and the report link. Local staging, a GitHub dispatch response or a checkpoint phase alone does not prove remote publication.

## Failures and measurement

A failed command leaves the last checkpoint intact. Its JSON error identifies the failed gate and completed gate receipts. A process crash can leave `<checkpoint>.lock`; confirm no producer is running before removing that stale lock and resuming the saved revision. Concurrent producers cannot update the same checkpoint. A stale revision or changed frozen hash requires investigation, not an overwrite.

Status distinguishes phase, decision counts, evaluated/blocked receipt counts, checkpoint byte size, per-command duration and gate timings. These are operational measurements, not model credit accounting. The tool has no access to account usage telemetry. Durable publication and settled predictive performance remain separate measures.

Roll back orchestration by reverting this release's controller/task entry-point changes and restoring the preceding task template. Do not roll back issued reports or grading. Keep the single-publisher boundary and exact candidate binding when rolling back.

# Betting Edge pipeline simplification

## Decision

Rewrite the operational pipeline incrementally around the existing tested selectors, evidence validators and single History publisher. Keep production running while replacing model-driven bookkeeping with deterministic code. Do not replace the handicapping framework wholesale or interpret more selections as proof of profitability.

## Verified September 27 findings

- All five Main task prompts use the same current operating authority. The repository task template had drifted behind those prompts; this change synchronizes it and adds compact input preparation to both.
- Main odds collection is already JavaScript run by GitHub Actions, dispatched from Cloudflare. It does not need a language model to call the sportsbook API. Five daily primary slots remain the collection budget.
- The inspected snapshot used 83 of 90 API requests. Raw odds were 19,700,732 bytes, the observer 2,319,555 bytes, the staged report bundle 10,535,983 bytes and results index 15,886,082 bytes. These are file sizes, not measured model token/credit charges.
- At the 09:45 report timestamp the compact input projection is 9,334 bytes for the same 33 eligible events and 198 available primary selections. It uses the canonical selector; event detail preserves exact quotes. No raw feed trimming or extra API requests are involved.
- Six supplemental odds requests recovered zero additional primary pairs in that snapshot. They also serve deep/prop collection, so zero primary recovery alone does not prove waste. Crypto and other shared consumers must be traced before changing collection scope.
- The daily grading task was disabled. It was restored and a September 26 plus bounded-backlog recovery request was submitted through the existing isolated grader. Completion must be checked from the resulting receipt, not inferred from dispatch.
- The repository has 116 workflow files, including historical repair workflows. File count does not establish active workload. Archive only after trigger and reference inspection.
- The live scheduler health endpoint reported its dispatch token configured. This does not explain the previously missed/delayed evening feeds; end-to-end dispatch receipts and bounded retries remain a reliability gap.

## Implemented first slice

`tools/report-inputs.mjs --at <actual-ISO-timestamp> --report-time <HH:MM>` builds a read-only overview, exact source blob bindings, schedule/release metadata, feed age and availability limitations. Add `--event-id <id>` for exact executable quotes. It performs no network requests or writes and makes no decisions. It explicitly reports `validationState=NOT_RUN`; existing feed and publication validators still own freshness and lane eligibility. Stale input inspection is not permission to issue.

Use this before draft preparation, then the existing `candidates --work-plan` and event detail while researching. Parse large raw files and histories in code instead of sending them wholesale into model context. Facts can be reviewed once per event; each decision retains its exact selection binding. The shared authority owns the sequence and task prompts are only entry points.

## Replacement architecture and cutover

1. **Collect and bind:** a deterministic controller owns the scheduled slot, immutable feed bindings and a durable run identifier. Record dispatch requested/accepted/started/completed separately; retry only a known failed dispatch with idempotency, never create uncontrolled extra pulls.
2. **Prepare:** derive the full primary inventory and reference comparisons once. Emit compact event work units, including unavailable markets and changed source bindings. Share event facts without copying clearance or grades across selections.
3. **Research and decide:** the model retrieves genuinely missing/current facts and makes supported exact-market judgments. Persist incremental completion and resume remaining events. Avoid repeated whole-board forecast searches and amendment rereads.
4. **Validate and publish:** one deterministic adapter prepares derived fields, runs existing gates, freezes the exact bundle and submits it to the existing publisher. Preserve remote read-back and one History writer. Shadow the replacement against historical and current bundles before enabling writes.
5. **Grade and measure:** preserve issued cards; the isolated grader owns settlement. Add per-run timings, request counts, input/output sizes, completed/blocked counts and telemetry where available. Compare actual completion, operational cost, calibration and settled performance separately.

Next implementation should consolidate the producer into one resumable controller, not add another parallel task chain. Remove an old path only after its replacement passes replay, failure/retry and publication identity tests. Keep an immediate rollback to the existing producer. The compact reader is the first slice, not a claim that the complete rewrite or scheduler reliability work is finished.

## Operational rewrite implemented later September 27

The resumable controller and shared gate runner replace the producer's manual phase bookkeeping. The staged publisher binds its candidate to the triggering commit. The second legacy publisher has been retired; verification remains read-only. The controller stores optimistic-revision checkpoints, prevents edits after freeze, retries exact sealed bytes, and compares decisions/evidence at indexed read-back. New advisory records retain compact derived summaries while original research remains in canonical evidence fields.

The odds workflow now has same-slot scheduled recovery and durable slot receipts, sharing one collector concurrency group. Inspection of the missed September 26 evening lane found no corresponding GitHub run; sampled successful runs were manual dispatches, including the late 18:19 refresh. The root cause of absent Cloudflare dispatch is not established. Recovery provides redundancy rather than claiming that cause was repaired. No Cloudflare deployment or secret changes are part of this release.

The Pinnacle publication adapter now validates the exact pinned observer blob, including archived snapshots, against its original report time. It does not substitute the newest observer or reset any quote clock. Existing deterministic decisions, source/evidence checks, staking rules and History schemas remain the compatibility baseline for this operational rewrite.

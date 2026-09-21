# Graham scheduled task authority

- Authority version: 1.0
- Status: OPERATIONAL
- Schedule authority: `data/walters/nfl/graham-schedule-authority-v1.json`
- Task binding authority: `data/walters/nfl/graham-task-authority-v1.json`

## Scope and precedence

This is the common execution contract for the five existing Graham tasks. Resolve the supplied TASK_KEY through the binding authority and read its exact task-specific authority/version. The schedule manifest owns days and Vancouver times; ChatGPT scheduled tasks own execution. Do not change schedules, enable retired tasks, add a task, or infer the active NFL week from the clock. The paused 90/10 task and retired Saturday task are outside this five-task consolidation. A delayed or explicitly requested recovery may run after its scheduled clock; never discard research merely because a scheduler started late.

This consolidation preserves all task-specific football scope, source methodology, numeric permissions, calculator ownership and market isolation. It clarifies durable start/completion order and source access. It does not grant BET authority, expand calibration or resolve blocked weekly rating inputs. Where copied task text says to create a run ID at the completion step, reuse the single ID created at the start instead.

## Research lifecycle — four research tasks only

Applies to TUESDAY_BASELINE, DAILY_REVIEW, DELTA_1645 and SUNDAY_PREGAME. WEEK_ROLLOVER follows the separate mechanical activation order below.

1. Before broad source loading, Library access, football research or number changes, read the active-week manifest/resolver and `data/walters/nfl/graham-research-runtime-policy-v1.json`. Require ACTIVE / GRAHAM_WEEK_ROLLOVER and OPERATIONAL / graham-research-runtime-v1, and resolve exact active paths. Use the runtime policy's task slug and actual Vancouver timestamp to create one unique runEventId.
2. Create the unique `data/walters/nfl/{season}/week-{weekPadded}-research-runtime/{runEventId}.json` with the policy's required fields: schema 1, policyId, runEventId, taskKey, season/week, ledgerPath, state RUN_STARTED, checkpoint STARTED, startedAt=lastCheckpointAt=actual start, staleAfter=start plus the policy's default lease, marketViewed=false, ledgerSweepPresent=false, and completionResult/completionReceipt/failure=null. Record taskPromptVersion from this authority and the task key. Never reuse a previous event. Require the exact start commit's runtime workflow success and remote file/blob read-back before expensive work. If this fails, report GRAHAM RUNTIME START FAILED — ANALYSIS NOT STARTED and preserve governed state.
3. Reuse the existing task-specific research and production instructions. After 30 minutes, heartbeat the same event as RESEARCH_IN_PROGRESS with current lastCheckpointAt and a policy-compliant renewed lease; verify workflow/read-back. Retain original startedAt. Re-read the active-week authority before any staging/write and at completion; an unexpected week transition blocks old-week research writes, not a guessed migration to the new week.
4. Apply the task's missed-run coverage rule using verified scheduled sweeps. A maintenance job, production batch, scheduler timestamp or blocked record is not completed information coverage. A narrow Delta establishes coverage only for its recorded teams/topics. Carry unresolved work explicitly; do not manufacture missed-day completions or replay prior numeric adjustments.
5. Append exactly one scheduled sweep for this run, including for NO_MATERIAL_CHANGE, separate from any production-batch sweeps. Preserve marketViewed=false and bind sourceTaskKey, runEventId and completionResult. Stage completion under `graham-research-completion-policy-v1.json`; inspect the exact workflow and remotely verify the matching receipt and its blob SHA.
6. Only MATERIAL_CHANGE or NO_MATERIAL_CHANGE may close the runtime as COMPLETED. Require a VERIFIED receipt matching runEventId/taskKey/season/week/ledgerPath/result, marketViewed=false, ledgerBlobSha and receiptBlobSha. Store the exact receipt evidence in the same event, set checkpoint COMPLETED, ledgerSweepPresent=true, failure=null and completedAt=lastCheckpointAt=actual completion; preserve startedAt/staleAfter. Require terminal runtime workflow success and exact remote event read-back before saying the research completed.
7. A controlled failure, including incomplete coverage, closes the same event as BLOCKED_WITH_DURABLE_RECORD / CONTROLLED_FAILURE, with completionResult BLOCKED_WITH_DURABLE_RECORD, completionReceipt=null, truthful ledgerSweepPresent, blockedAt=lastCheckpointAt=actual closure, no completedAt, and nonempty failure.phase/code/summary plus automatic=false. Preserve startedAt/staleAfter and marketViewed=false. A VERIFIED receipt for a blocked sweep proves recording only; retain it under failure.completionReceiptEvidence. Do not put it in top-level completionReceipt or advance coverage. Verify runtime workflow/read-back. Abruptly abandoned events remain subject to the existing watchdog. Report already-published governed changes truthfully if a later step fails; never undo legitimate changes or claim unverified work completed.

## Source access and numeric ownership

Use the exact source-locked Library paths/IDs and the player-values-access-v1.json shard/fallback procedure documented in section 3 and the personnel source-access paragraphs of `GRAHAM_DELTA_1645_AUTHORITY.md` for all research tasks. These access clarifications supersede ambiguous bare README lookup and loading the oversized full player registry through the ordinary contents route. They do not import Delta's narrow research scope into a baseline or broad review. Missing supplemental material is recorded and does not silently terminate research; missing required methodology or valuation evidence blocks the affected numeric change. Never substitute market-derived values or guessed replacement/committee weights.

Existing personnel, M4, QB, H4 and carried-rating permissions remain exactly task-specific. Production code owns permitted arithmetic and idempotency. Temporary overlays never enter carried ratings; current fair decomposition and home-field terms must survive unrelated changes. Resolve material information through the correct existing staging workflow, require success and remote board/ledger read-back. Reviewed information may legitimately leave a number unchanged; unresolved numeric inputs remain disclosed. Do not consult sportsbooks or rebuild the hotline in these research tasks.

## Mechanical rollover

WEEK_ROLLOVER does not use the research-runtime lifecycle or pretend to be a full research sweep. Follow `GRAHAM_WEEK_ROLLOVER_AUTHORITY.md`: verify the actual active-week completion gate, preserve prior-week history, prepare and verify every required next-week file, then activate the manifest last and advance only one week. Verify the active resolver, H4, QB-production workflow and remote reconciled board. Pending games mean ROLLOVER SKIPPED — ACTIVE WEEK NOT COMPLETE. Never force a rollover merely to close Stage 3.

## Verification boundary

`tools/graham-task-authority.mjs` checks a freshly retrieved automation snapshot against the schedule/binding manifests and canonical loaders. A checked-in snapshot is dated evidence, not proof of later scheduler state. Schedule synchronization cannot prove football coverage or scheduler punctuality. State these separately from completed research, applied numeric changes and unresolved valuation work.

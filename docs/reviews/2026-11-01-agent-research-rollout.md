# Approved Main research rollout — baseline and deployment record

Date: November 1, 2026, America/Vancouver.
Status: CONFIGURATION DEPLOYED / MAIN LIVE ACCEPTANCE PENDING.

## Subsequent user instruction and deployment

After this initial blocked review, the user identified the circular dependency and explicitly instructed agent setup. D-046 supersedes the activation hold below: the shared authority, task template and all five existing Main prompts now request the approved team with a 60-second in-run acknowledgment test and coordinator fallback. See [the execution guide](../REPORT_RESEARCH_AGENTS.md). Advance capability inspection is no longer a deployment prerequisite. Each Main task must still provide actual launch/returned-work evidence before live agent use is claimed. The remaining sections preserve the original review and exact published baseline; their earlier hold/disposition is historical and is not a current instruction.
This is a review record, not a new operating authority, tracker, model or production task.

## Prerequisite verified

The exact November 1 evening report is `data/history/runs/2026-11-01/evening-153940.json`, timestamp `2026-11-01T15:39:40-07:00`, report blob `ce4e68abc77b44acaebb827627327a9f4933c325`, sidecar blob `3857e4f4ab26c1b2f83143e34dd54b06c0fed17e`. Both original blobs were retrieved and their exact UTF-8 bytes independently Git-hashed. The matching index entry binds these paths and feed `56d2389a828bdaf5febae748784056bd538c34dd`.

Existing checkpoint `data/report-production/checkpoints/20261101-evening-1515-152834.json`, blob `c8bb972972acf0a433810dc69165ea31ea375970`, is PUBLISHED revision 20. Its durable readback at `2026-11-01T22:56:41.595Z` names those exact blobs. Staged publisher [41358482988](https://github.com/fhvsvzpmkw-design/-betting-edge-terminal/actions/runs/41358482988) completed successfully for staging commit `bdefb23e288703c54f89adc0bb89da0dc045dd81`; the frozen staged blob is `c482f60f3df6914b824fa9a81f741d12418a684a`. The Evening task's matching last run `48689353-1460-8324-8e06-9f2b276b9c2b` ended at `2026-11-01T22:58:20.711471Z`. This satisfies the exact prerequisite; no baseline rerun or checkpoint mutation was performed.

## Capability blocker and exact exit condition

The existing Main producer is the hosted report task, not the GitHub staged publisher or the Node controller. The controller explicitly makes no model calls. Read access to the current task prompt, status and result does not expose its tool inventory, delegation API or concurrency setting. The available task-management controls expose lookup, update and immediate execution, but no attach-to-running-task, arbitrary capability probe or runtime tool inspection. An immediate execution would rerun the report, not perform an isolated runtime test.

Delegation exposed in this separate rollout Work runtime cannot prove that the five actual Main task runtimes support it. No six-worker Main-runtime probe receipt or capacity evidence was found in the inspected authorities, controller, task template or repository tree. This is a definitive blocker to activation **in this implementation session**, not proof that the platform inherently cannot support agents. Merely amending the task prompt would not resolve it. Production remains unchanged.

Required unblock evidence: from an actual scheduled Main producer, record its task/run identity and tools, successfully launch four research workers and two review workers with distinct IDs while the coordinator remains active, and receive six bounded read-only acknowledgments. Record launch/finish clocks, overlap/capacity and errors. Probe workers must not fetch odds, change shared files or perform a second handicap. Do not create a new recurring task, rerun/backdate this baseline, silently reduce the team or migrate production as a substitute. Capability evidence must precede an operational authority amendment. Existing ordinary report continuation must remain available if delegation fails.

## Exact bounded integration prepared for that gate

Reuse `tools/report-inputs.mjs`, `tools/report-run.mjs next/export/checkpoint`, `tools/event-research-plan.mjs`, the current shared scheduled authority and staged publisher. Add an agent execution section to that authority and command guidance to `docs/REPORT_RUN_CONTROLLER.md` only after capacity is demonstrated. No publisher or decision-threshold change is needed. Any helper should be a pure assignment/validation function consumed by the existing producer, never a separate orchestrator service.

1. Coordinator loads the bound inventory and current checkpoint revision. At normal fresh-source intake, run the existing `guy-daily-selection.mjs --shortlist`. Keep his eligible NHL shortlist in the earliest NHL assignments alongside kickoff urgency; do not delay his separate handoff until Main freeze/publication.
2. Partition complete games into four bounded disjoint assignments, preserving the existing `nextEventId` / `scheduleUrgency` ordering and early-NFL priority. Assign all available market families for a game to its owner. Reassign unfinished games only after cancelling/releasing the old assignment. A sparse slate may leave an acknowledged worker idle, not duplicate a game.
3. Every worker input binds run/candidate, checkpoint revision, snapshot SHA, original clocks, exact event/start/league/team identity and all selection/market/line/settlement keys. Workers receive read-only source material and a bounded queue. They return event/personnel/forecast/market/contrary findings with original URLs, observations, timestamps, applicability, confidence limits and exact unanswered questions. Distinguish no source found, source unavailable, inapplicable and work not attempted. No fabricated PASS, fair, clearance or refreshed timestamp.
4. Two reviewers take disjoint actionable-selection/disagreement queues. Each receives original evidence and exact identity; challenge pricing, identity, settlement, attribution and consequential contrary findings. Report agreement as a check, never independent evidence. Return errors and unresolved questions with source bindings.
5. Coordinator checks identity, source provenance, original clocks and current applicability; reconciles contradictions; exports the current draft and merges one complete event at a time through the existing expected-revision checkpoint. On a stale revision, reload and reconcile rather than overwrite. Workers never mutate shared checkpoint, staging, Guy submission, Graham inputs or issued History.
6. Coordinator completes Guy's existing governed submission and verifies his matching publisher while his separate price/game windows remain eligible. Market-aware Main workers never feed Graham's independent market-free fair-number pipeline; independent Graham work requires a clean context and its existing owner.
7. Keep bounded event-specific follow-up and actual source shortages separate. Preserve completed work, remaining queue and current partial-publication/continuation semantics. Coordinator alone prepares/freezes/stages; existing staged publisher alone issues and reads back History. No extra odds request, new task, schedule change, shadow system, fair/stake change or threshold relaxation.

Before activation validate disjoint assignment and exhaustive queue coverage, exact-identity/clock rejection, reassignment ownership, source conflicts, stale-revision rejection, serial event merging, immutable frozen bytes and single-publisher behavior with meaningful existing controller/publication regressions. Then verify a normal scheduled run live; offline tests alone cannot establish deployment success.

## Published baseline and comparison

| Measure | November 1 evening baseline |
|---|---|
| Initial saved controller start | 15:28:36.695 Vancouver |
| First saved event review | 15:33:54.341; 317.646 seconds after start |
| Initial five event saves | 15:33:54.341 through 15:35:13.278; later event rechecks retained |
| Issued timestamp / eligible starts | 15:39:40; all five retained games were still pregame (earliest 16:00) |
| Durable readback | 15:56:41.595; 1,684.900 seconds after controller start |
| Decisions | 30 available; 28 evaluated PASS; 2 source-blocked spreads; zero BET/LEAN/WAIT; zero new risk |
| Unfinished versus source shortage | Issued candidate reports zero producer-unfinished; Toronto–Lakers spread sides lack exact qualified reference or independent calibrated cover fair |
| Remaining research limits | Preparation still lists unattempted alternate-source routes across five events. Zero candidate-unfinished is not proof of exhaustive source coverage. Preserve this distinction |
| Errors/conflicts | Preparation warns of conflicting source ID `73719482:slot4-current-review`; the source was not shared. No recorded checkpoint revision rejection. No measured count of independently discovered factual errors |
| Publication | Successful exact staged publisher and durable readback; producer ended 15:58:20.711 |
| Usage | Model/token/credit baseline unavailable through controller and task metadata; command duration is not account usage |

Guy's separate ledger independently contains research `guy-20261101T152940-nyr-home`, publication `53d5a279818846e7dc9dc0950cb9f22b77809804ee40b8d4826830abfa88332c`, first published 15:32:15.207: Rangers ML, DraftKings -125. Preserve this completed handoff and its original observations; do not create another call as rollout validation.

For the first supported normal agent run compare the same measures using actual checkpoint traces and kickoff clocks, slate size/market mix, real retrieval attempts, review error findings, conflicts and publisher receipt. Distinguish saved event review from completed selection, issue timestamp from actual durable availability, and source gaps from unperformed work. Capture worker timings and available usage telemetry honestly; mark unavailable usage unknown. These measure execution and evidence quality, not prospective betting profitability.

## Disposition

No operational authority, checkpoint, staging, History, Main task prompt, activation, timing or odds budget was changed. Prepared documentation is saved on main. Pause only the temporary rollout follow-up after reporting this capability-verification blocker. Resume scoped implementation when actual Main-runtime evidence resolves the gate.

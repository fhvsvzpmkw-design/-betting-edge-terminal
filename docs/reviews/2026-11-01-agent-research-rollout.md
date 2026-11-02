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


## Hosted scheduled capability test — passed

The existing temporary rollout task `6ae7c1f19d408191acd8b1490aa23073` completed the user-authorized read-only probe in execution `b0c28aca-6198-8330-a078-c99cd99bbde8`. Its task result reports AGENTS_READY: six distinct launches and six role/nonce-matching returns within 31 seconds, using actual `collaboration.spawn_agent`, `collaboration.list_agents` and `collaboration.wait_agent` tools. Returned canonical identifiers were `/root/researcher_1`, `/root/researcher_2`, `/root/researcher_3`, `/root/researcher_4`, `/root/reviewer_1` and `/root/reviewer_2`. Launches were observed at 23:20:48–23:21:08 UTC November 1; all six responses were observed by 23:21:19 UTC. Individual child timestamps, separate UUIDs and simultaneous-compute telemetry were not captured. The execution ID here comes from the task-manager readback, not from a guessed worker identity.

The matching completed result was created at 23:21:26.334102Z, within execution start 23:20:37.438482Z and completion 23:21:26.655390Z. [Test conversation](https://chatgpt.com/c/6ae7a0a4-5d94-83e8-8e76-1cdcc4934bb8). The temporary task is read back paused; its saved schedule was preserved. No odds, research or publication ran in the probe.

Configuration commit [bd724737](https://github.com/fhvsvzpmkw-design/-betting-edge-terminal/commit/bd72473732422e98261dd7c67d13a83032e3e42b) is exactly read back for all seven files. All five enabled Main task prompts are independently read back with the agent instruction and their original schedules/timezones intact. The existing shared-authority test and an outside-amendment content comparison pass. Producer/publication regressions were triggered by this commit; their results are separate from the capacity test. This proves six-worker support in the tested hosted task and deployed configuration in all five Main tasks. Per-Main startup launches, real returned research/reviews and durable publication remain the first normal-run acceptance criteria; do not rerun the baseline or pull odds for acceptance.

## Quality groups and adaptive coordinator amendment — November 1

The user prioritized deeper/better analysis and authorized the recommended additional groups plus coordinator-directed expansion. D-047 and research-agent-groups-v2 now govern the useful pool and maximum six open workers; the preserved fixed-six baseline/probe above is historical capacity evidence. The updated guide adds independent fresh-context Graham researchers/reviewer, Meat Desk discovery/challenge, exception-only grading and explicitly manual Crypto source review. Startup/returned-work/final activity-save attempts are required informational records, and retries must read the original evidence or state UNVERIFIED use.

November 1 Late controller start was 01:20:52.433Z November 2; staging 01:28:39.079Z; publisher commit c356843a414bc852f36cd86317c08e5ddd62bc53 at 01:39:13Z; durable readback 01:43:06.558Z. It retained two NBA games / twelve selections, eight evaluated PASS and four source-blocked spread sides. The task result, checkpoint/frozen bundle and repository contained no worker activity receipt/IDs or fallback mode. Agent use and quality improvement for that run remain UNVERIFIED, not a claimed absence of launches. Alternate-source routes remained pending in preparation. Preserve the original report and sidecar unchanged.

Configuration implementation/checks and task readback are recorded below when verified. No normal Main/Graham/Meat/grading production is rerun for this rollout, and no extra odds are collected.

### Adaptive configuration verification

Local shared-report authority regression, Graham task/schedule/prompt regression and prompt-builder syntax checks passed. Additional bounded checks passed for all normal/max worker counts, coordinator-only spawning, fresh-context Graham, exception-only grading, explicitly manual Crypto analysis and the unchanged-no-op receipt exemption. A concurrent local Git expected-head claim test allowed exactly one baseline claimant and rejected the stale claimant; actual scheduled connector execution remains a separate acceptance condition.

Two fresh-context read-only implementation reviewers examined the quality/ownership contracts. Their material findings were corrected before deployment: grading findings are explicit exception diagnoses unless independently verified through supported deterministic paths; unchanged no-delegation checks create no timestamp-only activity receipt; baseline ownership uses one conditional expected-head RUN_STARTED claim covering all nonterminal checkpoints and requires durable watchdog/control termination before replacement. A terminated owner must stop its workers and cannot revive/merge/stage. No production source retrieval, odds collection or numerical changes occurred in this QA.

The implementation updates only operating instructions, the group policy, the existing Graham prompt builder, task template and documentation. Exact repository readback, twelve task prompt readbacks, unchanged schedules/activation and relevant CI results are recorded in the deployment follow-up.

### Deployed configuration and exact task readback

Configuration commit [99e675f0](https://github.com/fhvsvzpmkw-design/-betting-edge-terminal/commit/99e675f0052265247b525990e2063b0774eed4dd) was accepted on authoritative main with an expected-head ref update. All fourteen modified/new files were fetched at that immutable commit and compared with the complete intended UTF-8 content; all matched. Policy blob: f9b96a84cf336113a12a23de3dbe9b15c649f08f.

After the twelve prompt-only updates, a fresh task lookup verified all twenty-five known task IDs: twelve prompts matched the intended group instructions, thirteen other prompts matched their originals, and every title, schedule, activation, timezone and timing mode remained unchanged. The real five-task Graham snapshot also passed tools/graham-task-authority.mjs --snapshot against the updated builder and authoritative schedule, including unchanged mechanical rollover.

| Existing task | Automation ID | Group | Schedule / activation |
|---|---|---|---|
| Morning Betting Edge — Main | 6a7b3e283f088191af11ffd569fe7f32 | main | unchanged |
| Betting Edge — Evening | 6a7b3f1426288191a2c7361eab3f63ff | main | unchanged |
| Betting Edge — Late | 6a7b3f251b248191b1ae5ae92ece6ea4 | main | unchanged |
| Morning Betting Edge — Open | 6a7b332b41208191afbf9b4583ddefee | main | unchanged |
| Morning Betting Edge — Final | 6a7b3e34848c81919349d8944e3512e4 | main | unchanged |
| Meat Desk Daily | 6a8bc631a66881919e2f81b6bfdbcc4f | meat-desk | unchanged |
| Graham Walters 90/10 | 6aa07e219f608191bf225f56ddf5bb20 | graham | unchanged |
| Card Grading | 6a903fccabf08191b60c8dd7d04e798a | grading | unchanged |
| Graham 16:45 Delta | 6a94a085e124819197674a10e963ddc4 | graham | unchanged |
| Graham Daily Review | 6a94a072cb4481918fbdf96bb03cfcfd | graham | unchanged |
| Graham Tuesday Baseline | 6a94a06c26c08191b2f8caf0b2ac139d | graham | unchanged |
| Graham Sunday Pregame | 6a94a07fab248191aaad210a4ce0ad4c | graham | unchanged |

Crypto source review is manual-only policy, not another scheduled task. The temporary capability-test task stays paused. Neither ATS closeout nor mechanical rollover received a research team. No production odds/research/report/grading run was manually requested for verification.

Live acceptance remains per ordinary execution: actual tool availability, clean context where required, worker IDs/returned findings and their quality impact must appear in its execution output and informational receipt. The earlier startup probe and these configuration tests cannot establish real scheduled research or improved betting results.

### Relevant GitHub checks — all passed

- [Graham task authority validation](https://github.com/fhvsvzpmkw-design/-betting-edge-terminal/actions/runs/41379896941) — success.
- [Major sport market coverage](https://github.com/fhvsvzpmkw-design/-betting-edge-terminal/actions/runs/41379896938) — success.
- [Game Day coverage regression](https://github.com/fhvsvzpmkw-design/-betting-edge-terminal/actions/runs/41379896943) — success.
- [Guy daily researched selection](https://github.com/fhvsvzpmkw-design/-betting-edge-terminal/actions/runs/41379896982) — success.
- [Card evidence application review](https://github.com/fhvsvzpmkw-design/-betting-edge-terminal/actions/runs/41379896908) — success.
- [Report publication reliability](https://github.com/fhvsvzpmkw-design/-betting-edge-terminal/actions/runs/41379896937) — success.
- [Core 1.4 production validation](https://github.com/fhvsvzpmkw-design/-betting-edge-terminal/actions/runs/41379896952) — success.
- [Report producer transfer and recovery](https://github.com/fhvsvzpmkw-design/-betting-edge-terminal/actions/runs/41379896963) — success.

These checks validate the configuration's existing operational boundaries and regressions; they do not establish substantive scheduled agent research. The next ordinary task must provide its actual worker/quality evidence. No additional recurring monitor was created.

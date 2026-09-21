# Graham Stage 3 — schedule and task-authority closure

Implementation scope: five existing Graham tasks, one schedule authority, versioned operating instructions, live-configuration drift detection and verified historical execution traces. This is separate from personnel calibration Stage 3 and from Core 1.5 forecast-to-card work.

## Findings and changes

All five live schedules already matched the controlled manifest: Tuesday rollover 04:30; Tuesday baseline 11:00; Daily Review Monday/Wednesday/Thursday/Friday/Saturday 11:30; Delta Tuesday–Saturday 16:45; Sunday Pregame 07:00, all America/Vancouver. No timing change was needed.

Delta used a versioned authority loader, while the other four tasks retained copied instructions. The three research prompts referenced completion policy but did not explicitly start RUN_STARTED before expensive source loading. Their prior successful runtime records demonstrate that this was an instruction-consistency gap, not proof that every earlier run omitted a start.

The binding registry and shared authority now give each task one loader. Four task-specific documents preserve the prior instructions verbatim beneath the common clarifications. Delta keeps its v2.1 authority and specialized controls. Rollover stays mechanical and does not acquire a research-runtime requirement. The common lifecycle makes durable start, heartbeat, exact scheduled sweep, receipt and terminal read-back explicit; blocked receipts verify recording, not successful research.

The schedule validator now rejects disagreement between declared days/time and RRULE, invalid days/times and wrong execution authority. Cadence weekday labels derive from the manifest; existing outputs remain byte-equivalent at the current schedule. The live-task validator detects duplicate/wrong identities, disabled tasks, timezone/clock drift and stale prompts from a newly retrieved snapshot. CI validates repository bindings and regression cases; it does not pretend a saved snapshot is a live scheduler poll.

## End-to-end record review

Five completed Week 2 research events were checked against their exact receipt and ledger Git blobs. Every matching scheduled sweep remains unchanged in the current weekly ledger. The abandoned September 15 Delta remains blocked and is excluded from completed coverage. Existing runtime validation passed all 23 events: 20 completed, 3 blocked, zero open starts.

- MIN–CHI: Saturday's governed QB change is recorded from exact home fair -4.332 to -6.232, displayed Chicago -6; the current board retains that result.
- WAS–DAL: Saturday Delta applied +0.300 to the home-spread coordinate, moving exact Dallas fair -3.082 to -2.782 while the displayed Dallas -3 stayed unchanged. A stable display did not mean the update was lost.
- NYG–LAR: Sunday's newly recorded personnel issue remained unresolved and did not move the exact -9.742/displayed -9.5 fair. Research completion and numeric eligibility are distinct.

Saturday's broad review explicitly caught up the missed Wednesday–Friday windows. Sunday's record distinguishes the narrow Delta's coverage from the broad baseline. These are records of the actual coverage claimed and verified, not a new independent football-source audit.

Active authority remains 2026 Week 2. Rollover must still establish that the full active slate has completed; Stage 3 closure does not force an early week change. The weekly 90/10 inputs remain PARTIAL_BLOCKED and the separate 90/10 task remains paused.

## Acceptance and rollback

Passed locally: task migration preservation, live identity/schedule/prompt negative cases, schedule projections, terminal automation, Delta authority, all runtime records, runtime fixture and fair-decomposition regressions. No ratings, fairs, source sweeps, runtime events, histories or Main schedules are changed by this build.

Deployment acceptance requires: merge after CI; update only the five existing Graham prompt fields to the canonical loaders; retrieve live tasks again and verify exact prompts, unchanged schedules, timezone and enabled state. Retain that dated snapshot as installation evidence. A future scheduled cycle remains a separate observation; this closure cannot guarantee scheduler punctuality or erase unresolved valuation work.

Rollback: restore only the five original prompt fields from `graham-stage3-tasks-before.json`, preserving current enabled states and schedules, then revert the scoped authority/checker code if needed. No governed numeric or historical rollback is needed or permitted. The runtime and production calculators were not altered.

Next progression build: Graham/Walters NFL spread forecast-to-card handoff, carrying source timing, native fair units and unresolved-input limitations into Betting Edge candidate review.

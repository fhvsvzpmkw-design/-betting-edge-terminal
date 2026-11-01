# Graham and November 1 production bug review

Reviewed October 31, 2026, America/Vancouver. Scope: active-week resolution, weekly learning and inventory, baseline recovery, numerical writers, publication, task coordination, odds quota and the five report slots. This is a production review, not a new prediction formula or parallel system.

## Findings and corrections

| Finding | Effect | Correction |
| --- | --- | --- |
| Pending baseline recovery was described primarily after historical completion and next rollover. | A failed Tuesday baseline could remain pending through the open active week. | The existing coordinator now treats pending current baseline recovery as independent, checks for a competing runtime, and executes the full review under the existing partial-input policy. |
| Baseline recovery required exactly the active matchup teams. | A genuine 32-team baseline was rejected on a 28-team bye week. | Require all 32 known teams for Tuesday baseline, exact active matchup coverage, truthful counts, and no unknown or duplicate findings. |
| Baseline recovery rewrote started-game metadata and special failed-closed statuses. | Late research could alter issued prediction timestamps or remove the H4 null-fair guard. | Preserve whole started-game records and unresolved numerical statuses. |
| Personnel, M4 and rating refresh coerced missing values with `Number(null)`. | An explicitly withheld shared-venue fair could become a spurious numeric fair; malformed normal inputs could look like zero. | Strict missing-value checks, explicit shared-venue preservation, and decomposition validation before publication. |
| Personnel/M4 staging lacked complete team/side, duplicate event and begun-game guards. | Malformed staging could assign a loss to the wrong side or change an issued prediction. | Validate identities and chronology before writing; retain idempotency and numerical ownership. |
| Shared GitHub concurrency allowed only one pending producer. | New queued workflows canceled earlier required producers even with running-job cancellation disabled. | Keep numerical serialization and enable `queue: max`; baseline metadata recovery keeps its own queued group with fresh-input publication retries. |
| Recovery workflow swallowed every adapter error as successful execution. | Green workflow status concealed an incomplete baseline. | Surface the exact failed gate and fail the recovery attempt without changing the pending board. |
| Readiness triage ignored the actual injury-boundary-method blocker code. | Unavailable timing work could starve actionable replacement reconciliation. | Classify method-only waits and prioritize actionable role/value work, including its next action. |
| Applied paired history retained an obsolete blocked checklist entry. | The work queue contradicted the applied transaction. | Project the verified paired history with source binding and retain superseded provenance. |
| Current readiness required latest ratings and availability for already-started games. | A late legitimate rating update could leave readiness impossible without rewriting history. | Assess current propagation and availability for unstarted games; expose frozen issued limitations separately. Historical learning and final-fact gates remain required. |
| Stage 5 verifier still required active Week 1 and exactly 16 games. | Later valid active slates failed an obsolete verification target. | Verify the manifest-resolved slate and its source facts, including explicit withheld fairs. Separate production integrity from football readiness. |
| Research-event sync rewrote boards from older events and treated receipt wrappers as new research. | Timestamps could regress, started-game metadata could change, and malformed duplicate sweeps could append. | Ledger-only append transport, typed-sweep filtering, immutable existing prefix, chronological clocks, and fetch/recompute publication retries. |
| Provider account counters could lag charged local attempts. | Reconciliation erased pending monthly usage and could over-allocate later credits. | Preserve conservative local usage until the provider catches up or an actual reset is observed. |
| The failed October 27 FPI lookup used a broad search exposing adjacent market information. | Supplemental comparison interrupted the baseline lifecycle. | Use the known official power-index endpoint directly with a football-only projection; retain truthful market-isolation boundaries. |
| Early gamebook inventories omitted play-level injury annotations. | Available injury boundaries were described as unavailable. | Preserve a new additive original-source audit and require play annotations, status notices, participation and snap-count reconciliation. |
| Saved current-value captures were not reused before declaring a value unavailable. | Henderson and Slaughter remained blocked despite eligible existing source material. | Use the existing source-bound supplement adapter and document the exact lookup procedure. |
| New production could supersede a completed baseline's exact ledger binding. | A legitimate later personnel publication made a genuine completed review unusable. | Read and hash the receipt-bound Git blob, require its unchanged sweep prefix, and verify only supported production follow-ups against exact ledger events, staging and arithmetic endpoints. Preserve original reviewed fairs and the follow-up proof. |
| Older queued personnel inputs could replace newer case decisions or regress clocks. | Delayed production risked reviving obsolete availability and timestamps. | Reject stale/conflicting same-case inputs, preserve monotonic timestamps, and retain processed-batch idempotency. |
| Personnel and M4 left the cached pre-QB fair inconsistent until another workflow ran. | Valid personnel publication temporarily failed the terminal's QB arithmetic gate. | Maintain the pre-QB arithmetic cache from the new fair and unchanged approved QB term; a separate reconciliation still verifies the governed term. |

## Football evidence and remaining limits

The original-gamebook audit is `data/walters/nfl/2026/week-07-weekly-evidence/2026-10-31-play-injury-annotation-audit.json`. It records recovered source facts and distinguishes injury-play clocks from adjacent status-notice placement. It creates no READY pair or rating change.

TB–CAR also had an incomplete final-inactive inventory despite a complete-inventory description. Correcting a timing annotation alone cannot complete a pair when newly identified absences, replacement duties or specialist treatment remain unresolved. Existing facts and supported cases must be assembled into complete evaluator-form paired team sections, validated, and applied through the existing updater.

Chargers–Rams still requires an explicit shared-stadium H4 method. This review does not invent a home-field value. Townsend's current specialist treatment and the other unresolved replacement/cluster cases retain their separate requirements.

Completion-receipt binding remains strict. The adapter verifies the original Git blob and unchanged research prefix before accepting an intervening governed personnel/M4 publication. Unknown sweeps, manual fair drift, changed prefixes, unrecorded batches or mismatched staging remain rejected. This is a proof of already-published work, not a new football calculation or permission to relabel a partial review complete.

The first recovery attempt reshaped a completed review to fit the later personnel publication. The restorative source audit preserves that altered record and its differences, restores the original completed sweep/runtime/receipt, and regenerates only baseline metadata through the verified production-follow-up proof. All fair numbers and started-game records stay unchanged. Future runs explicitly reuse the original source instead of rewriting completed research.

The targeted official EA recheck is `data/walters/nfl/2026/week-08-weekly-evidence/2026-10-31-current-missing-values-official-ea-recheck.json`: all 20 current pages contained 1,946 unique players; exact Herbert/Runyon searches across eight advertised iterations returned no eligible rows. This is a genuine source gap, not a zero value. The record retains URLs, response excerpts and hashes.

## Validation and execution evidence

- November 1 tests exercise all five report/pull slots, request/feed/receipt identity, duplicate suppression, UTC-date crossover and Vancouver's winter UTC−7 behavior.
- The 12 odds suites and four additional report health/publication suites pass without live API consumption.
- Graham suites cover baseline scope and chronology, strict missing values, frozen games, side/event identity, paired learning, fair handoff, source isolation, queue retention and publication readback.
- Personnel/M4 to QB to terminal integration: 20 checks pass, including validation before separate QB reconciliation. Stage 4: six checks pass. Writer regressions cover withheld fairs, staleness, chronology, identity and pre-write rejection.
- The combined Henderson/Slaughter candidate passed closure review, both numerical writers' relevant checks, all 14 decompositions and QB reconciliation against fresh main. Expected change: New England −10 to −9.5; Pittsburgh remains −4.5. A staged candidate is not publication until the exact batch and deployed feed are verified.
- The immediate full Tuesday baseline review completed and its receipt/runtime were verified under `graham-tuesday-baseline-2026-w08-20261031T193536-0700`. Its 28 active-team findings and four explicit bye-team findings cover all 32 teams and 14 matchups. Customer baseline metadata/publication has its separate adapter and readback boundary.

All five Betting Edge schedules and the Sunday 07:00 Vancouver pregame task remain enabled. Read the current receipts and readiness queue for final status; this review does not declare incomplete football inputs ready.

The five live Graham task identities, exact canonical prompts, schedules and activation flags were independently validated against current connected-task state at 02:57:39 UTC November 1 (19:57:39 Vancouver October 31).

GitHub queue semantics: https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency

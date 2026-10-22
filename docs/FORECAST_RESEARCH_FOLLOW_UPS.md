# Known forecast research follow-ups

Operational for new reports at/after `2026-10-22T16:50:00-07:00` in all five Main lanes. This closes the Islanders research handoff failure described in [the correction review](reviews/2026-10-22-islanders-follow-up-correction.md).

A source not captured is unfinished research when a known current-event lead still needs review. It is not proof that the source cannot corroborate. Existing LEAN thresholds, source criteria, opinion-only authority, BET requirements, personnel checks and staking remain in force.

## Carry known research into the next review

When a permitted original-provider lookup discovers a probability requiring later follow-up, record it in `data/report-production/forecast-follow-ups.json`, or append the same typed record to the draft's `forecastEvidence.followUps`. Keep the full observation in its original review/capture as well. Do not leave the only actionable handoff in prose or a standalone review document.

The store uses `{schema:1, kind:"KNOWN_FORECAST_FOLLOW_UPS", leads:[...]}`. Each lead requires `leadId`, `sport`, `eventId`, `startTime`, `marketDetail`, `period:FULL_GAME`, `side`, `line`, `sourceId`, original-provider `url`, original `observedAt`, actual `createdAt`, original `probability`, `finding` and repository-relative `originPath`. IDs are immutable; a changed observation gets a new ID. The point is a research lead and never supplies eligible forecast evidence or a grade by itself.

Shared draft capture and preparation load known leads independently of the submitted receipt, merge same-day carried leads, and pin the applicable records under `forecastEvidence.followUpInputs`. The publisher reconstructs the work from current as-of known records and the pinned original leads, so deleting a receipt source or omitting an older pin cannot hide known work. Exact sport, event, kickoff, market, period, side and line constrain each lead. Future observations/entries and started games are excluded; original clocks are preserved. Known work appears in the existing event plan's `forecastCaptureReviews`.

## Complete the specific follow-up

Capture the current original-provider point through the existing typed forecast import, with its real observation and current report applicability, personnel and settlement review. A newer point may have changed or become contrary; that finishes the lookup without automatically assigning LEAN, WAIT or PASS. Keep the earlier lead and the actual current point separately.

If the known source is unusable, add `candidateAssessment.forecastLeadDispositions` for its `leadId`, with `state:REJECTED`, current `checkedAt`, linked current original-provider `MODEL`/`REPORTING` `sourceIds`, an existing valid `objectionKind`, factual `rationale`, specific `directionalImpact` and `directionalReview:{state:REJECTED,rationale}`. The current provider observation must support the stated failure or rejection. “No second point attached,” a source registry notice, and a failed BET requirement do not establish that research was performed.

## NHL insufficient-corroboration PASS

For a positive NHL moneyline forecast retained as PASS with `reasonKind:INSUFFICIENT_CORROBORATION`, the forward completion check also requires evidence that another approved provider was actually checked. Either:

- Bind a currently applicable second-provider forecast in the directional review's `forecastRecordIds` and its original-provider MODEL evidence in `sourceIds`. The publisher independently replays the original sidecar record; a displayed eligibility flag is insufficient.
- Record an actual unsuccessful second-provider lookup in `forecastEvidence.attempts`, using the existing fields: `attemptId`, exact `selectionId`, approved `sourceId`, original-provider `url`, actual current `checkedAt`, an existing unsuccessful `outcome` and factual `finding`. Link its ID in `candidateAssessment.decision.directionalReview.corroborationAttemptIds` and its matching MODEL source in `sourceIds`. It must match the event/selection and pregame clock. `FOUND` without a captured point does not finish the review.

This is a specific second-source follow-up, not a requirement to exhaust every source or obtain a third source. A known lead from another provider still requires its own disposition. Generic `sourceReviewPending` remains advisory for broader discovery.

The existing candidate finalizer retains only the affected unfinished assessment as `RESEARCH_INCOMPLETE`. Completed unrelated decisions continue through publication. Historical report bytes and decisions are immutable; this repair cannot manufacture a retrospective pick.

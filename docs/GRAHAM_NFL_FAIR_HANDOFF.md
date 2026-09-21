# Graham NFL fair-to-card handoff

Status: OPERATIONAL. Version: 1.0. Effective for reports at/after `2026-09-21T06:00:00-07:00`.

This amendment connects the active Graham board to the shared Main candidate review for NFL full-game primary spreads. It supplies a dated native fair, a comparison in points, source lineage and unresolved-input disclosures before a producer has attached a fair to a card. The producer still owns the decision. Moneylines, totals, other sports, props, model calibration, stakes and schedules are outside this amendment.

## Producer sequence

1. Load the current Main authority and normal bound feed. Run `node tools/report-evidence-repair.mjs candidates --report DRAFT_REPORT --sidecar DRAFT_SIDECAR --details`. Inspect each NFL spread's `grahamFairHandoff` under `options`, including opposing/contrary selections; do not use only the shortlist. Exact event, ordered teams, kickoff, selected side and primary market must agree. An old week's matching teams are insufficient.
2. Run shared draft preparation to retain `sidecar.grahamFairHandoffInputs` before recording the final review. Preparation may defer unfinished decisions into `candidateDraft`; finish the actual research and explicitly restore the affected receipt to EVALUATED only when complete. The binding retains exact Git blob IDs for active week, authority mode and current-numbers board. Ensure these objects exist in the publication checkout; never fabricate or replace a pinned blob. A failed source load instead retains an explicit unavailable snapshot. To intentionally retry source acquisition, create a new unissued draft without the old binding and redo every affected disposition against its new record IDs. Frozen or issued snapshots cannot be rebound.
3. Keep `sourceAsOf` and `boardUpdatedAt` unchanged. Revalidate current event information against actual official/reporting sources within the feed-to-report window. An unchanged fair's source timestamp is not a new research check. Inspect `unresolvedInputs`, all listed limitations, readiness and arithmetic. Preserved/unready or unresolved-production numbers are UNAVAILABLE; ready partial-input numbers retain their limitation and require explicit treatment.
4. Complete the normal `receipt.candidateAssessment` from `docs/CANDIDATE_ASSESSMENT.md`, including personnel, any other forecasts, the status rationale, BET eligibility and price condition. Add `grahamFairReview` below and copy that exact object to `receipt.decision.grahamFairReview`, the corresponding report card and evidence sidecar. Use the handoff from the option matching the actually assessed book/quote. A different book, handicap or price produces a different record ID.
5. Run shared `prepare` again, inspect the audit and complete normal publication validation. An EVALUATED NFL spread with an unfinished handoff cannot freeze. Preparation defers only the affected selection when it has genuine event-specific source attempts; it preserves other completed decisions. Missing source attempts remain an explicit work failure. BLOCKED is not a PASS. Publish through the existing staged workflow and verify exact report/sidecar read-back.

## Disposition object

All fields shown below are producer-authored except the copied record and selection IDs. Example placeholders are not evidence.

```json
{
  "recordId": "COPY_EXACT_HANDOFF_RECORD_ID",
  "selectionKey": "COPY_ASSESSED_QUOTE_SELECTION_KEY",
  "disposition": "CONTEXT",
  "checkedAt": "ACTUAL_CURRENT_REVIEW_TIME",
  "status": "PASS",
  "rationale": "Explain acceptance or rejection of this fair and its assumptions.",
  "decisionImpact": "Explain specifically how the fair affected or failed to change this card's final decision.",
  "currentSourceIds": ["ACTUAL_EVENT_SOURCE_ID"],
  "limitationsAddressed": [
    {"code": "COPY_EACH_HANDOFF_LIMITATION", "explanation": "State the evidence and resulting treatment of this limitation."}
  ]
}
```

| Disposition | Required treatment |
| --- | --- |
| ADOPTED_FAIR | BET_AUTHORITY mode; bind `fairValueEvidence.unit=selection_spread_points`, exact `estimate`, `selectionKey` and `grahamHandoffRecordId`. Retain a MODEL source with the handoff's exact immutable `sourceUrl`, original `asOf`, event ID and finding; reference that source ID in `fairValueEvidence.inputs`. Walters evidence must be AVAILABLE with CORE_FAIR_INPUT or BET_ORIGINATOR contribution. All existing fair, personnel, uncertainty and BET gates still apply. |
| CONTEXT | Explain its relevance and why the adopted decision basis remains appropriate. Revalidate current information and address every limitation. It cannot be recorded as the adopted Graham fair simultaneously. |
| REJECTED | Explain the specific conflicting evidence or inadequate assumptions and their decision impact. Revalidate and address limitations. A rejected fair cannot remain bound as the adopted Graham input. |
| UNAVAILABLE | Only for an unavailable handoff; retain its reason and explain the impact. Normal market or independently sourced decision routes remain possible. Never invent a fair, source check or range. |

Current source IDs resolve to the card's event-specific OFFICIAL/REPORTING `sourceEvidence`, with actual URL, finding and checkedAt between feed generation and report time. All listed limitations must have an explanation. Status must match the card; a metadata-only disposition cannot silently alter a betting decision.

## Units and authority

The feed's spread line is the home handicap. For home, selected fair and line retain their sign; for away, both signs reverse. `pointMargin = selectedLinePoints - selectedFairPoints`. A positive margin is a research lead in spread points, not calibrated cover probability, EV or an executable BET threshold. Exact decimals are retained for arithmetic; dashboard rounding is presentation only.

The handoff supplies no uncertainty interval or cover distribution. For adoption, source and defend any additional uncertainty treatment required by the existing decision path. Do not create a default band, convert points to probabilities without an authorized supported method, or use incomplete BET support as an automatic PASS. OFF disables the fair; ADVISORY permits context/rejection but no adoption. Unresolved material inputs pass through existing Core handling and cannot be hidden by declaring a review complete.

The candidate panel displays the dated selected-side fair, offered line, point margin, limitations and explicit disposition. Issued cards display the producer's Graham decision impact. Saved audits and blob bindings preserve what was available for that report; later board updates do not rewrite history.

## Verification and live acceptance

The regression suite covers exact identity and sign, preserved/unready source rejection, source clocks and lineage, authority modes, disposition/decision binding, candidate discovery without a pre-attached fair, independent selection deferral and frozen snapshot replay. Synthetic fixtures are never issued or presented as current research. The first populated post-cutover NFL spread report remains the live acceptance check: verify its pinned board, exact option disposition, visible card impact and unchanged wagering gates. An empty slate cannot satisfy populated acceptance.

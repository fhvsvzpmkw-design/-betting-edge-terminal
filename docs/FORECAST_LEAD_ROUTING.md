# Captured forecasts must reach directional review

Operational for new drafts at/after **2026-10-01T18:47:44-07:00** through the shared authority and all five Main lanes. Issued History is unchanged.

The October 1 18:15 report contained DRatings moneyline probabilities in MODEL findings and source-attempt prose, but `forecastEvidence.records` was empty. Edmonton's recorded 69.4% supported its 1.47 decimal quote as a raw point; candidate ranking never saw it. Chicago's 35% was another positive source lead, with its market/reference research still unfinished. These observations require actual source/applicability review; they do not establish a retrospective LEAN or BET.

## Capture once, then make the decision

Save the **standard existing capture schema** from `docs/FORECAST_EVIDENCE.md` either:

- As `sourceEvidence[].forecastCapture` on the actual MODEL finding, or `forecastEvidence.attempts[].forecastCapture` on its real source attempt.
- In `forecastEvidence.pendingCaptures` for a capture covering several exact selections in the event.

Each capture has `schema:1`, `records`, `attempts` and optional `revalidations`. Keep original URL, source excerpt, exact event/start/period/side/line, original observed/model times and real settlement/applicability judgments. For unknown model time, keep `forecastAt:null` and use the existing observed-pregame contract only when its actual evidence supports it. Never invent a goalie-incorporation claim, confidence interval, field, timestamp or settlement convention to import a record. Partial capture with no justified current applicability can remain contextual; it cannot clear a positive directional lead.

`report-run start` and `checkpoint` call shared capture intake before saving the draft. `prepare` repeats it idempotently before candidate completion. The importer validates exact inventory mapping, source binding and immutable IDs, then existing forecast attachment recomputes the exact price comparison. Export the captured draft before using `createForecastLean`; the helper requires the reviewed original record. Producer judgment is still mandatory: assess BET first, then source-backed LEAN/provisional LEAN under `docs/FORECAST_DIRECTIONAL_LEANS.md`. Record dispositions and checkpoint the final card/receipt/sidecar together. Capturing changes no status, stake or adopted fair.

## Prose cannot silently bypass review

The transition reader recognizes the explicitly named DRatings team-win percentages in saved source notes, on moneyline selections only. They are **unverified source-field leads**, never forecast records or independent fair. It does not convert goals, generic percentages, sportsbook odds or a win probability into spread/total probabilities. `next --event-id` exposes lead IDs, source URL, original observation and field; a positive lead routes to `FORECAST_CAPTURE_REVIEW` even when Pinnacle is unfavorable.

A matching eligible exact captured record resolves intake; the existing candidate gate then requires BET/LEAN assessment and a substantive separate directional rejection before PASS. A genuine source/applicability failure can instead be recorded in `receipt.candidateAssessment.forecastLeadDispositions`:

```json
{
  "leadId": "the-exact-lead-id-from-the-work-plan",
  "state": "REJECTED",
  "checkedAt": "actual-current-review-time",
  "sourceIds": ["the-model-source-id", "the-conflicting-current-source-id"],
  "objectionKind": "PERSONNEL_CONFLICT",
  "rationale": "The real source finding and its concrete effect on applicability.",
  "directionalReview": {
    "state": "REJECTED",
    "rationale": "Why the actual conflict defeats this directional preference at this price."
  }
}
```

Other supported objection kinds are `EVENT_OR_MARKET_MISMATCH`, `STALE_ASSUMPTIONS`, `SETTLEMENT_UNRESOLVED`, `SOURCE_UNVERIFIABLE` and `NO_DIRECTIONAL_PREFERENCE`. Link the MODEL lead and actual same-event evidence; preserve unresolved facts. Missing model time, missing published interval, Pinnacle disagreement or failure to qualify BET alone is not a source rejection. Complete the capture and directional review instead of relabelling those limitations as failed retrieval.

The shared completion gate defers an unfinished **positive** lead's selection, preserves its draft and names the missing work. Negative point leads are visible for capture/review but do not veto an otherwise completed unfavorable-price PASS. No whole-report forecast quota, extra odds pull, forced pick, automatic fair adoption, or change to staking is added.

## Verification

`tests/forecast-lead-routing.test.mjs` covers capture intake, source/event/time/immutable identity rejection, current applicability, checkpoint-facing work queues, forward/frozen protection and the saved 18:15 source-routing gap. Existing exact-forecast, candidate and provisional-LEAN publication regressions verify decision authority. Saved-input replay diagnoses the original omission; simulated applicability fixtures do not claim new live research or revise the issued report.

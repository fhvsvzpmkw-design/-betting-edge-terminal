# Game Day coverage and opinion review

Effective for new decisions at/after `2026-10-03T11:34:58-07:00`. Issued reports and observations keep their original eligibility and bytes.

## October 3 evidence

| Actual Pacific issue time | BET | LEAN | PASS | Primary evaluated | Primary blocked |
| --- | ---: | ---: | ---: | ---: | ---: |
| 06:27:47 | 0 | 2 | 78 | 80 | 28 |
| 08:18:24 | 0 | 2 | 85 | 87 | 33 |
| 09:46:24 | 0 | 0 | 18 | 18 | 118 |

The final morning report completed only MLB selections. All 46 available NCAAF selections were blocked. Dodgers and Rays moneylines became PASS at the same executable prices as their earlier LEANs, while eligible supporting forecast points remained. Generic unfinished lineup language did not explain why a separately qualified provisional opinion had lost its direction.

Florida–Missouri was absent from all three bound primary feeds, but present in the corresponding Pinnacle fixture snapshots. Its full-game under 57.5 was 1.99, 2.00 and 1.943, respectively; paired no-vig under probabilities were approximately 48.43%, 48.11% and 49.56%. An unpaired sharp quote is a discovery lead, not an executable recommendation or proof of an under edge. No captured game-specific handicap in those runs supported upgrading the tip automatically.

## Acquisition

The provider's `/events` contract uses `limit` and `skip`. The former collector sent `page`, causing repeated first-page discovery. Discovery now uses pages of up to 5,000 with explicit completion/stop diagnostics and an odds-request reserve. Primary major sports receive core capacity before ancillary games; the NCAAF minimum of 30 is no longer its effective Saturday cap. Finite-capacity omissions remain named under `diagnostics.primaryEventsNotPriced`.

College soccer is excluded using the soccer sport plus NCAA/college/NAIA/NJCAA league identity. It is removed before selection and odds pricing, including women's competitions. NCAA American football is a different sport and remains eligible. A full page of excluded college soccer does not hide later professional soccer fixtures.

Primary `/odds/multi` and gap-recovery `/odds` requests use `markets=ML,Spread,Totals`. Complete primary games trigger no supplemental player-prop request. Provider-returned extra markets are discarded, and `baseballProps` remains empty. The separately enabled exact Crypto fight watch retains combat deep-market acquisition, observation freshness and duplicate quarantine. The existing 90-request ceiling, reserve and five daily schedule slots remain in force.

Provider contracts: [events](https://docs.odds-api.io/api-reference/events/get-events), [odds](https://docs.odds-api.io/api-reference/odds/get-odds), [machine-readable API reference](https://docs.odds-api.io/llms.txt).

## Directional review fields

Record these under the exact receipt's `candidateAssessment.decision.directionalReview` when an eligible exact positive forecast becomes PASS or an earlier exact LEAN becomes PASS:

```json
{
  "state": "REJECTED",
  "checkedAt": "CURRENT_ACTUAL_REVIEW_TIME",
  "reasonKind": "PERSONNEL_DEPENDENCY",
  "rationale": "Actual directional objection, separate from BET eligibility",
  "sourceIds": ["exact-event-source-id"],
  "forecastRecordIds": ["supporting-exact-record-id"],
  "provisionalAlternative": {
    "considered": true,
    "rationale": "Why a visible zero-stake provisional opinion is or is not defensible"
  },
  "dependency": "Named decision-sensitive personnel input",
  "forecastAssumption": "The actual assumption affected",
  "directionalImpact": "How the sourced finding changes the directional preference",
  "previousDecision": {
    "reportTs": "EXACT_EARLIER_REPORT_TIME",
    "selectionKey": "EXACT_SELECTION_KEY",
    "status": "LEAN",
    "priceDecimal": 1.47
  },
  "changedFinding": "New information or an honest correction of the earlier reasoning"
}
```

This is a field example, never a source finding or a prefilled decision. `previousDecision` and `changedFinding` apply only to an earlier exact LEAN. Personnel-specific fields apply to `PERSONNEL_DEPENDENCY`, which must cite OFFICIAL or REPORTING evidence. Bind every positive current comparison's record ID. Other allowed reason kinds are `CONTRARY_EVIDENCE`, `FORECAST_ASSUMPTION_CONFLICT`, `PRICE_NO_LONGER_SUPPORTED`, `REFERENCE_CHANGE`, and `CORRECTED_PRIOR_ASSESSMENT`. An unchanged price cannot be the stated price-change reason. Earlier completed PASS decisions supersede earlier LEANs; an intervening incomplete receipt does not erase the latest real opinion.

`tools/opinion-review.mjs` creates no status. Missing work is routed to `DIRECTIONAL_OPINION_REVIEW` and deferred only for the affected draft selection. Publication independently checks forecast-supported PASS and exact prior LEAN continuity. Genuine reviewed rejection can remain PASS; qualified opinions can remain LEAN with $0 and NO BET. There is no card quota or relaxed BET/staking requirement.

## Saturday completion

The event plan and compact work plan expose `sports` with available, completed, pending and event counts. Zero completed NCAAF decisions on a Saturday with available selections produces an explicit unfinished-coverage warning. Finish current event facts, the supported exact market route, already captured forecast applicability and material dependencies incrementally. Reuse applicable event research; do not restart a whole-slate search or wait universally for final lineups. If work genuinely remains incomplete, expose its named coverage gaps and next steps in the report; do not call it a completed rejection of every opportunity.

Regression checks use production worker extraction plus its Crypto overlay, simulated network responses, original immutable morning reports and pinned historical replay inputs. They consume no live odds quota.

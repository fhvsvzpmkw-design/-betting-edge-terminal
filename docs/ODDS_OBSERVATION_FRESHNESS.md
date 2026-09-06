# Odds observation freshness

**Effective:** September 6, 2026, forward-only for newly collected `quoteObservationVersion: 1` snapshots.
**Authority:** `BETTING_EDGE_CONTRACT.md` section 4.0a and the shared scheduled report authority.

Odds-API.io says `updatedAt` records the last market change. An unchanged price returned in a current response can therefore have an old `updatedAt`. [Provider explanation](https://odds-api.io/blog/compare-odds-multiple-bookmakers-api#keeping-the-table-fresh)

## Feed fields

| Field | Meaning | Use |
|---|---|---|
| `quoteObservationVersion: 1` | Collector declares explicit observation provenance | Select observation-based semantics; never silently fall back to change time |
| `collectionStartedAt` | Local time collection began | Collection timing/provenance |
| `generatedAt` | Local time the completed snapshot was finalized | Bound report snapshot and unchanged 75-minute whole-feed limit |
| `event.bookmakerObservedAt[book]` | Latest successful response receipt for that requested event/book scope, including an empty result | Prevent older supplemental copies from reviving markets removed by the current response; never substitute for a quote observation |
| `market.observedAt` | Local receipt time of that exact successful, identity-checked market response | Unchanged 30-minute eligibility and 90-minute retention limits, measured at `generatedAt` |
| `market.updatedAt` | Original provider last-change timestamp | Movement provenance; preserve the supplied value |

An observation means the provider returned this exact market. It is not independent confirmation inside the sportsbook. Each book/market retains its own observation; a successful response for one book, market or event cannot refresh another.

Only new response data may receive the response-receipt observation. Copying a saved row, rebuilding a report, completing a failed request or writing a newer snapshot cannot manufacture an observation. New observations are recorded within collection; all usable observation timestamps must be valid and no later than the finalized snapshot. Version-1 quotes with missing, invalid or future observations are unavailable even when their provider change time is recent.

## Replacement and movement

The latest successful response controls the scope actually requested and identity-checked. Replace that scope rather than merging older sides/lines back into it. Missing books or markets, empty rows, removed sides and suspension cannot be rescued from older copies. Requests that fail or return mismatched identity produce no new observation. Data outside the requested scope must not be marked newly observed.

For an unchanged price observed at 09:20 that last changed at 07:00, keep `updatedAt=07:00` and `observedAt=09:20`. Freshness comes from 09:20. A subsequent unchanged observation is `PRICE UNCHANGED`; actual matching price/line differences supply movement. Market-change timestamps are market-level provenance and do not prove every individual side moved.

All report gates, coverage summaries, meters, lineage/repricing and price-observation consumers use the bound feed's versioned clock. Pinnacle/OddsPapi has its own benchmark timestamp policy and is outside this provider-specific correction.

## Historical boundary and verification

Feeds without `quoteObservationVersion` retain the old `updatedAt` freshness interpretation for historical replay. Do not label them version 1 or fabricate `observedAt` from `generatedAt`, archived Git time or a diagnostic timestamp. Issued recommendations, sidecars, history and original movement data stay immutable.

Required regression cases:

- A fresh exact observation with a change timestamp older than both age limits remains eligible and retains the original change timestamp.
- Observations older than 30 minutes fail eligibility; observations older than 90 minutes fail retention. The 75-minute whole-feed limit is unchanged.
- Missing, invalid or future observations fail closed; identity mismatch and request failure never restamp data.
- Latest successful empty, missing-book, missing-side or suspended scope cannot revive an older quote, including across supplemental collections.
- Unchanged repeated observations create no line/price movement; changed exact prices/lines retain real movement.
- Legacy snapshots reproduce their original validation/meter behavior without backfilling observations.

The next ordinary refresh/report supplies live acceptance: verify ordered collection/observation/completion timestamps, exact selection availability and limitations, meter/lineage agreement and normal durable publication. Recovery counts come from that run. This correction adds no task, schedule, paid API, request budget, prop analysis or betting-policy change.

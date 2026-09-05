# Report source and fair-value evidence

**Status:** OPERATIONAL from `2026-09-05T17:00:00-07:00` report timestamps.  
**Authority:** Contract v1.0 section 6.4; Core v1.4 remains unchanged.  
**Applies to:** all five Betting Edge report lanes, all active full-game primary markets.

## Purpose and historical boundary

The September 5 15:15 review found five college-football PASS cards citing generic MLB sources, and a LEAN whose exact fair, uncertainty range and confidence were insufficiently traceable. The LEAN also used ambiguous wager and Pinnacle-comparison language. The issued report remains immutable. These requirements prevent those defects in new reports; they do not retrospectively certify or change the earlier opinion.

## Checked sources on every displayed card

Retain `sourceEvidence` in the recommendation and its matching sidecar record. Each source has:

| Field | Meaning |
|---|---|
| `id` | Unique source identifier within this card; referenced by numeric inputs. |
| `url`, `title` | Actual source URL and descriptive title. |
| `sport`, `eventId` | Exact sport and event to which the extracted finding applies. |
| `checkedAt` | Actual check time, no later than the report timestamp. |
| `finding` | Specific relevant fact; distinguish confirmed information, projections and opinion. |
| `kind` | `OFFICIAL`, `REPORTING`, `MODEL` or `MARKET`. |

Read the source before recording it. A valid URL, matching labels or a publisher success does not establish that a fact is true. Do not relabel another sport's page or use a generic citation in place of the research. A team-level source may support multiple cards when the findings actually apply to their exact event. BET/LEAN/WAIT must include support distinct from market quotes.

If sources genuinely cannot be verified, an appropriately unavailable zero-stake PASS may record `sourceEvidence: []` and `sourceShortfall: {reason, missing, impact}`. Allowed reasons are `SOURCE_UNAVAILABLE`, `MARKET_UNAVAILABLE`, `QUOTE_STALE`, `IDENTITY_UNRESOLVED`, and `EVENT_INELIGIBLE`. State what could not be verified and how it affects the decision. This exception does not authorize an unsupported value-based PASS or a fabricated fair number. Do not retain an otherwise ineligible card unless the existing continuity/availability rules require its explicit resolution.

## Numerical fair evidence for serious candidates

Every BET/LEAN/WAIT has `fairValueEvidence`, copied identically to the sidecar:

| Field | Meaning |
|---|---|
| `selectionKey` | Exact current recommendation identity. |
| `unit` | `selection_spread_points`, `home_spread_points`, `total_points`, `selection_probability` or `selection_american_odds`. |
| `estimate`, `displayValue` | Numeric fair and its display token; explicit signed orientation for spreads. |
| `range.low`, `range.high` | Numerical uncertainty range in the same units, containing the result. |
| `method`, `calculation` | Actual method and reproducible derivation used, including any subjective adjustment and its rationale. |
| `inputs` | Array of `{name, value, unit, sourceIds}`; numeric values tied to the checked source records. |
| `result` | Final numeric result, consistent with the estimate and displayed fair. |
| `limitations` | Specific model, calibration, translation, evidence and uncertainty limitations. |
| `personnelBasis` | `{sensitive, rationale}` explaining personnel materiality. |

This is an audit record of existing Core/Walters work, not a new model. Use actual inputs and a derivation a reviewer can follow. A prose assertion that the fair is “independent” or has a “conservative range” is insufficient. Favorable editorial score predictions do not by themselves demonstrate calibration or STRONG independent evidence. Numerical agreement of stored fields is not proof that the method is sound; the report author must still perform and explain the analysis.

Use `home_spread_points` only when the issued selection is the home team. For an away selection, convert a home-based model result to `selection_spread_points` and record that conversion. Empty-source shortfall PASS cards must have zero stake, a nonnumeric unavailable fair and no `fairValueEvidence`. A permitted explicitly recorded shortfall PASS may retain incomplete identity only under that unavailable-PASS exception, with no qualified benchmark. Any retained partial sources still require a nonempty exact event ID and matching sport; a fully missing event ID therefore requires empty sources. Existing eligibility and continuity gates still govern whether that card belongs in the report.

When personnel work is material, preserve the existing `personnelRequired` / `personnelEvidence` process, including Stage 2, re-handicap, fallback depth and closing authoritative checks when required. A `sensitive:false` label requires an actual decision-specific rationale, not a shortcut around personnel research.

## Decision and benchmark language

LEAN means zero stake and no wager. Explain the directional interest and the reason BET strength is absent. A `playTo` condition is informational and does not automatically promote LEAN to BET. Avoid affirmative “is playable” language on a zero-stake LEAN.

For every QUALIFIED Pinnacle comparison retain `benchmarkComparison` with:

- `executableImpliedProbability` calculated from the displayed executable price;
- `benchmarkNoVigProbability` from the exact qualified benchmark;
- `edgeProbabilityPoints` equal to 100 times benchmark probability minus executable implied probability;
- `direction`: `FAVORABLE`, `UNFAVORABLE` or `NEUTRAL`.

This comparison is the relationship of the execution price to the benchmark, not the independent Core edge, expected return or a new BET trigger. The benchmark remains non-executable. For example, −109 execution against approximately +103 no-vig fair is unfavorable; an independently supported LEAN may still disagree with that benchmark, but the text must say so accurately.

## Validation and publication

Before freeze, run:

```sh
node tools/report-evidence-gate.mjs validate --report report.json --sidecar sidecar.json
node tools/report-publication.mjs validate --report report.json --sidecar sidecar.json
```

Mirror `sourceEvidence`, `sourceShortfall`, `fairValueEvidence` and `benchmarkComparison` between report and sidecar. The publisher validates again on retries and remote read-back. Validation does not fetch sources, calculate a new handicap, change decision/stake, request odds or rewrite archived reports. Failed validation requires a genuinely supported candidate before freeze; an already-frozen candidate cannot be repaired merely to force publication.

Every visible report summary must distinguish unavailable primary selections from selections actually evaluated. Include exact evaluated and unavailable counts when the coverage receipt records limitations. The phrase “complete coverage” refers to accounted-for inventory, not universal quote availability.

From the same 17:00 PT cutoff, include the exact clause `Primary selections: N evaluated; M unavailable.` whenever the unavailable count is nonzero. Replace N and M with the receipt totals; the coverage validator enforces the match.

# Report source and fair-value evidence

**Status:** OPERATIONAL from `2026-09-05T17:00:00-07:00` report timestamps.  
**Authority:** Contract v1.0 section 6.4; Core v1.4 remains unchanged.  
**Applies to:** all five Betting Edge report lanes, all active full-game primary markets.

## Purpose and historical boundary

The September 5 15:15 review found five college-football PASS cards citing generic MLB sources, and a LEAN whose exact fair, uncertainty range and confidence were insufficiently traceable. The LEAN also used ambiguous wager and Pinnacle-comparison language. The issued report remains immutable. These requirements prevent those defects in new reports; they do not retrospectively certify or change the earlier opinion.

## Primary evaluation receipts — from September 6

**Effective report timestamp:** `2026-09-06T00:00:00-07:00`. This extends the existing coverage/evidence gates; it does not change handicapping methods or execution standards. Earlier issued reports retain their original payloads and validation.

The coverage gate's `derivePrimarySelectionInventory(report, feed, policy)` returns each available logical side and its exact supported-book quotes. The sidecar must retain `primaryAnalysis: {schema: 1, feedGeneratedAt, receipts: [...]}` with one receipt per available `selectionId` (`sport|eventId|marketDetail|side`). Copy one actual inventory `quote` exactly, including book, event, market, side, line, selection key, decimal price and quote timestamp.

- **EVALUATED:** `{selectionId, quote, state: 'EVALUATED', checkedAt, decision, evidence}`. `decision` uses the existing full recommendation structure; `evidence` uses its matching sidecar recommendation structure. Include actual source evidence, numeric fair derivation/range even for a value-based PASS, matching Core assessment and personnel evidence when material. Opposing sides of the same exact market must share a coherent fair/range. A documented model limitation is not permission to fabricate a numeric estimate. Every EVALUATED decision must also appear unchanged in the published cards, including BET, LEAN, WAIT and PASS. There is no numeric card target or maximum from this cutoff.
- **BLOCKED:** `{selectionId, quote, state: 'BLOCKED', blocker: {reason, missing, impact, checkedAt, attempts}}`. Reasons: `SOURCE_UNAVAILABLE`, `FAIR_MODEL_UNAVAILABLE`, `PERSONNEL_UNRESOLVED`, `CALIBRATION_UNAVAILABLE`, `CONFLICTING_EVIDENCE`, `RESEARCH_INCOMPLETE`. Each actual attempt records `{eventId, checkedAt, url, finding}`. Record the decision review within the report cycle; source checks can predate the feed where genuinely reused. No betting decision or fair may be invented for a blocked receipt.

**Source-first fair-value amendment — forward from `2026-09-07T18:15:00-07:00`:** follow Contract section 4.1 and shared scheduled authority section 6. Retrieve and assess an applicable current published forecast or existing governed fair record before assigning a blocker. An external independent model may directly supply the point estimate; the producer need not build or reproduce that model. A source's documented market-anchored method remains eligible when substantive independent inputs are present. Pure sportsbook/no-vig comparisons remain market evidence. Preserve the numeric fair, source-linked adoption/conversion, coherent opposing sides, explained uncertainty, independent-support and personnel requirements for every EVALUATED decision, including PASS. This supersedes the earlier instruction to construct a new estimate from raw statistics during the run. `directCalibration=GAP` alone is not a blocker.

Blocker attempts must explain the relevant source/research work actually attempted and the specific obstacle. `CALIBRATION_UNAVAILABLE` means an identified calibration limitation prevents a defensible estimate or uncertainty range; name that limitation and explain why the permitted approach could not resolve it. `FAIR_MODEL_UNAVAILABLE` means no defensible applicable fair remained after the actual forecast lookup, verification and alternatives, not merely that no in-house model was found. Use `RESEARCH_INCOMPLETE` for unfinished work and identify the remaining research; continue it before delivery, and retain any unfinished remainder honestly in the published receipts. Record only real checks; a template that changes the event/market name while saying a schedule or pitcher page supplied no distribution is not a sufficient explanation. These distinctions use the existing receipt fields and reason codes; they do not convert blocked sides into decisions.

**Partial research publication — forward from `2026-09-06T18:15:00-07:00`:** unfinished research limits that selection and does not prevent other completed, validated decisions from publishing. Run `node tools/major-sport-market-coverage-gate.mjs research-plan --report <report.json> --sidecar <sidecar.json>` to identify and continue pending work using shared scheduled authority section 6. This read-only queue is a working aid, not a whole-report publication gate. Every available selection still needs its exact receipt; unfinished receipts retain actual attempts, missing inputs, the observed stopping reason and next step, with no invented fair, betting decision or stake. A genuine terminal blocker remains distinct and requires the applicable attempted work/fallbacks. An odds-file check is price evidence, not an independent research fallback.

The publisher derives `coverageSummary.researchCompletion` and a leading `PARTIAL REPORT: N evaluated; M unfinished.` notice in `report.summary`. If none were evaluated, it instead publishes `ANALYSIS INCOMPLETE: 0 evaluated; M unfinished.` without manufacturing decision cards or claiming a no-value board. The summary notice is publisher-owned display metadata; all completed decision content and evidence remain unchanged. Preflight, publication, retries and read-back preserve this behavior. The complete card/quote/Core/evidence checks still apply to every issued decision. Partial publication is not permission to stop research early. No new per-game archive is created, and earlier issued reports retain their original payloads and rules.

Receipts are authored from the research, never generated from quote availability. The validator checks exact binding, evidence structure, arithmetic and Core consistency; it cannot establish source truth or model quality. Existing unavailable zero-stake continuity PASS resolutions stay governed by their original evidence/lineage rules and receive no evaluation credit.

For each sport record `primary.available`, `primary.evaluated`, `primary.blocked`, `primary.unavailable`, and `primary.required`. Require `evaluated + blocked = available` and `available + unavailable = required`; board totals have corresponding `primaryAvailable`, `primaryEvaluated`, `primaryBlocked`, `primaryUnavailable`, `primaryRequired`. Existing `gamesEvaluated` is inventory bookkeeping only, not proof of completed handicapping.

Always include `Primary selections: N available; N evaluated; N evidence-blocked; N unavailable.` using the actual four counts. Do not describe blocked research as a completed handicap or a PASS. The publisher derives the visible `coverageSummary` from verified receipts and the bound feed, including actual decision counts, blockers and acquisition causes. The displayed BET/LEAN/WAIT/PASS counters count the complete published EVALUATED decision set plus any separately governed unavailable continuity resolutions. Publisher retries and stored read-back validate the same receipt and derived summary.

## Research handoff within the existing sidecars

### Source lookup completion — September 7 source-first reports

Use the sport/market lookup order in shared scheduled authority section 6. A missing in-house model is not a missing published forecast. Read the exact current source field and pursue the applicable alternative when access, identity, personnel assumptions, settlement or uncertainty prevents adoption. Do not interpret the lookup table as a guarantee of coverage or a new pricing-source quota.

Keep the evidence in the existing records. For an EVALUATED selection, retain the adopted source point and numerical fair/range in its normal `sourceEvidence` and `fairValueEvidence`. If a published point has been found but the selection remains BLOCKED, record that exact point, units, side/line, forecast time, current applicability and source URL in the relevant `blocker.attempts[].finding`; explain the remaining obstacle in `missing` and `impact`. An attempted URL with no extracted number is not a found forecast. A stale/mismatched forecast that was rejected does not count as applicable. Preserve an unfinished task's concrete `progress.nextStep`; use the existing reason codes rather than inventing a new state.

In `report.summary`, add one compact source-completion sentence stating how many distinct available primary selections have an applicable published point estimate, alongside the existing evaluated/evidence-blocked counts. Count by exact `selectionId`, not source URLs, book rows or articles. Opposing sides count separately only when the extracted forecast and documented settlement treatment support each side. The sourced-point count includes an applicable point retained in a BLOCKED receipt when, for example, its uncertainty or exact-line probability is still unresolved; it is not an evaluation or BET count. Existing governed fairs may support additional evaluated selections without being counted as newly retrieved public forecasts. Do not manufacture a point or receipt to increase either count.

Summarize the remaining evidence-blocked selections by their actual reason and specific missing input, distinguishing unfinished research from terminal limitations. Name the missing current source, exact-line probability/settlement treatment, numerical uncertainty basis, personnel fact or source-conflict resolution as applicable. Retain the full event-specific detail in the receipts. Keep publisher-owned coverage counts and notices unchanged; this source-completion sentence is factual report prose using existing evidence, not a new schema, meter, gate or scheduled task. After publication, recompute/check the sentence against the durable report/sidecar before repeating it to the user. Do not report improvement over an earlier run solely from raw counts when the eligible slate or primary lines changed; compare like-for-like selection identities when describing a graduation.

The `research-plan` command reads earlier indexed same-day report/sidecar pairs and matches their latest receipts to the current available selections. Its `priorResearch` is historical context only; old decisions, terminal blockers, sources and quotes do not become current receipts. The planner retains original source times and deduplicates checked findings/attempts into event-level `sharedResearch`. Recheck material changing facts, preserve current quote binding, and perform the current market-specific calculation and normal validation before issuing a decision. Full prior calculations remain at the returned sidecar path and blob hash.

For new unfinished work, use the existing `blocker` object's optional `progress = {stage, nextStep, stoppingReason}` to make the handoff precise. Stages are `EVIDENCE_COLLECTION`, `FAIR_CONSTRUCTION`, `PERSONNEL_RECHECK` and `DECISION_VALIDATION`. Record a concrete next step and the observed stopping reason. This progress metadata does not certify evidence or add a publication veto. Older missing progress remains explicitly `UNSPECIFIED`; it is not inferred from narrative or from the presence of a URL. Shared scheduled authority section 6 governs the slate-wide initial scan and subsequent targeted work.

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

This is an audit record of source adoption and existing Core/Walters work, not a new model. Use actual inputs and a derivation a reviewer can follow. A prose assertion that the fair is “independent” or has a “conservative range” is insufficient. Favorable editorial score predictions do not by themselves demonstrate calibration or STRONG independent evidence. Numerical agreement of stored fields is not proof that the method is sound; the report author must still verify applicability and explain the analysis.

### Recording a published fair estimate in the existing schema

- Record the exact provider page as `sourceEvidence.kind=MODEL` only after checking that its number is a forecast rather than a quoted price, market-implied probability, public betting percentage or historical hit rate. In `finding`, retain the source/model name, published update time (or explicitly unavailable), game/date, full-game market, side, exact line and stated personnel assumptions. `checkedAt` is the actual retrieval time, not the model's update time. Unknown source timing or inputs require an explicit relevance assessment; do not claim a forecast incorporates today's lineup merely because it was fetched today.
- Store the published numeric probability or fair line in `inputs` with its MODEL `sourceIds`. `method` may be direct adoption of the named external model; `calculation` states the source value and conversion. For a published percentage `q`, use `p=q/100`, `unit=selection_probability`, and identical `estimate=result=p`; `displayValue` and displayed `fair` must agree. Fair decimal odds are `1/p`; American odds are `100*(1-p)/p` below 50% and `-100*p/(1-p)` above 50%, with even money at 50%. Prefer probability units for ranges that cross even money. This arithmetic does not require rebuilding the provider's model.
- At a two-outcome no-push line, the opposite fair is `1-p` and its bounds are `[1-high, 1-low]`. Use the same source version and exact betting line for both sides. At integer lines or markets with a draw, retain the source's win/push/loss or draw treatment; a conditional no-push probability is not an unconditional win probability. Obtain the required settlement probabilities before computing expected return/staking. Do not interpolate another line or convert a predicted score into a betting probability without a supported source method.
- Ground `range` in source-published model/parameter uncertainty, applicable quantified source scenarios, or an explicitly explained judgmental sensitivity range across suitable current forecasts. Record numerical endpoint inputs with source links and explain which facts/assumptions they represent. Provider outcome variability, Monte Carlo sampling precision and disagreement between forecasts are not automatically calibrated uncertainty about the true probability. Preserve those limits in `limitations` and the Core uncertainty statement. A single accepted source can establish the point; a defensible range still needs its own basis, with no fixed invented margin or automatic multi-source quota.
- Assess source independence, current applicability and support on the actual evidence; a provider brand or simulation count does not automatically confer MODERATE/STRONG support or DIRECT calibration. Retain the normal Core calibration/error rules. Keep Stage 1 and required Stage 2 roster/lineup research, source conflicts, closing checks and pre-/post-sweep evidence. Replacing a stale personnel assumption with an updated sourced projection is a valid re-assessment; an unchanged source fair may be retained with a justified `NO MATERIAL CHANGE`. Do not add an injury adjustment already present in that forecast.

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

From the same 17:00 PT cutoff, include the exact clause `Primary selections: N evaluated; M unavailable.` whenever the unavailable count is nonzero. Replace N and M with the receipt totals; the coverage validator enforces the match. From the September 6 documented-evaluation cutoff, the four-count available/evaluated/evidence-blocked/unavailable clause supersedes this two-count form.

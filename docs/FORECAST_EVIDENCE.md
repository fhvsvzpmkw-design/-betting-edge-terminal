# Forecast retrieval, applicability and coverage

The September 12, 2026 source review is implemented as a retrieval registry and an advisory coverage layer. It covers all 21 primary combinations: MLB, NFL, NCAAF, CFL, NBA, WNBA and NHL, each with full-game moneyline, spread/run line/puck line and total. Source capability is different from current usable coverage. CFL exact-cover and total probabilities remain unverified; free articles and historical examples do not establish whole-slate availability.

`research/forecast-source-registry.json` supplies the ordered exact-probability, provisional and score-context routes. `tools/forecast-evidence.mjs` applies those routes to the complete bound available-selection inventory, including `BLOCKED` and unassessed selections. It does not scrape, fabricate a source result, adopt a fair value or change a decision. Qualified existing Pinnacle assessments and partial publication retain their existing authority.

## Source routing and retrieval

| Sport | Moneyline lookup order | Primary line lookup | Total lookup |
|---|---|---|---|
| MLB | FanGraphs dated scores; DRatings; public Cipher pages | Stats Insider public articles; Dimers | Public Cipher; ATS.io/OddsTrader provisional |
| NFL | Dimers public tabs; nfelo | Dimers public tabs; nfelo | Dimers public tabs/articles |
| NCAAF | DRatings; Dimers | Dimers-origin exact percentages; DRatings/Talisman Red score context | Dimers-origin exact percentages; DRatings/Talisman Red score context |
| CFL | DRatings; Cleanup Hitter score context | Exact probability unverified; DRatings/Cleanup Hitter score context | Exact probability unverified; DRatings/Cleanup Hitter score context |
| NBA | Dunks & Threes; public Dimers; DRatings as additional candidate | Public Dimers exact-line articles | Public Dimers exact-line articles |
| WNBA | ESPN; DRatings; public Dimers | Public Dimers exact-line articles | Public Dimers exact-line articles |
| NHL | DRatings; eligible publicly readable MoneyPuck; public Dimers | Public Dimers exact-line articles | Public Dimers exact-line articles; check pushes |

The source-specific qualifications remain in the registry. NBA/NHL examples require an in-season access check. A WNBA article last updated after tip is evidence of publisher capability, not a frozen pregame value. MoneyPuck public reading does not establish commercial automated reuse rights or a documented forecast API. A source's score projection, sportsbook price, Bet Value component, historical ATS percentage or postgame metric must not be entered as an outcome probability.

Use existing event research across related selections to limit repeated retrieval. The per-selection attempt record still identifies the exact side/line question answered, or why the source did not answer it. When a route fails, try the suitable configured alternative. `nextRoutes` is a queue of unattempted sources, never a claim that a search happened. A failed page is not proof that no forecast exists.

## Structured input

New or revalidated findings live in the candidate sidecar:

```json
{
  "forecastEvidence": {
    "schema": 1,
    "records": [],
    "attempts": [],
    "revalidations": []
  }
}
```

Each record is immutable under its `recordId`. All probabilities are numeric fractions in `[0,1]`, not percentages from 0 to 100. Keep its actual source excerpt or permitted snapshot and explicit limitation.

| Field | Meaning |
|---|---|
| `recordId`, `sourceId`, `url`, `excerpt` | Stable record identity, registry publisher ID, actual inspected page and relevant accessible source evidence. |
| `modelFamily`, `marketDependence` | Optional stored copies of registry classifications. Conflicting claims are rejected; the registry supplies canonical output. |
| `eventId`, `sourceEventId`, `sport`, `startTime` | Canonical feed event ID plus publisher event ID, actual league and exact event start in ISO time. Resolve Australian/UTC/local date differences first. |
| `marketDetail`, `period`, `side`, `line` | Existing exact `full_game_*` market, `FULL_GAME`, selected `home`/`away`/`over`/`under`, selected-side handicap or total. Moneyline line is null. |
| `kind` | `OUTCOME_PROBABILITY` or `SCORE_CONTEXT`. Projected scores belong in optional `projection`; no probability is generated from them. |
| `probability`, `probabilityBasis`, `pushProbability` | Selected outcome probability; `UNCONDITIONAL` or `CONDITIONAL_ON_NO_PUSH`; actual push probability if published/justified. Unknown push probability stays absent. |
| `forecastAt`, `observedAt`, `state` | Original model calculation/update time, original retrieval time, `PRE_GAME`. A page refresh does not replace the model timestamp. Missing model time is explicit and cannot count as an eligible exact forecast. |
| `settlement` | `{ "includesOvertime": true/false, "pushRule": "NO_PUSH"/"REFUND" }`; verify against this selected market's actual rules. |
| `personnelAssumptions`, `limitation` | Named pitchers, goalies, players, projected roles or known model assumptions, with their material limitation. |
| `applicability` | Initial per-run review described below. Never rewrite it on an older record. |

Feed spread `quote.line` and `selectionKey` store the **home team's line for both sides**. Forecast record `line` always means the **selected team's handicap**. `forecastCandidate()` negates the home line for the away side before matching. The forecast record does not reuse an away feed line without conversion. It does not infer opposite-side probabilities.

For a current observation, store this actual review in the record's `applicability`. For a prior observation, preserve the record verbatim and append it separately in `revalidations`, with `recordId`:

```json
{
  "recordId": "existing-immutable-record-id",
  "forReportAt": "EXACT_CURRENT_REPORT_TS",
  "checkedAt": "ACTUAL_CURRENT_CHECK_TIME",
  "eventMatch": true,
  "freshnessStatus": "CURRENT",
  "freshnessRationale": "Explain the original forecast age and why its information remains applicable.",
  "personnelStatus": "SUITABLE_PROJECTION",
  "personnelRationale": "Name the relevant starter/role assumptions and explain their current suitability.",
  "settlementMatch": true,
  "settlementRationale": "Explain the matching period, overtime and push treatment."
}
```

`personnelStatus` may be `CONFIRMED`, `SUITABLE_PROJECTION` or `NOT_MATERIAL` with a specific rationale. Material unresolved personnel cannot count as an eligible forecast; a missing final lineup alone does not require that conclusion. `provisionalUseRationale` is also required if a provisional source is used for an exact probability. This is a source applicability review, not certification of independent calibration or BET eligibility.

`forecastAt <= observedAt <= checkedAt <= report.ts < startTime` must hold for an eligible pregame observation. `forReportAt` binds the review to the current report. There is no invented universal forecast-age cutoff and no silent freshness reset. Rechecking an older record preserves `forecastAt` and `observedAt`. When the source value or model assumptions change, create a new record ID and preserve the earlier one.

`attachForecastCoverage()` copies explicitly revalidated prior records into the current sidecar verbatim, so their IDs resolve after a restart. Root preparation loads prior same-day sidecars; no extra scheduled task is needed. Duplicate equivalent JSON records are deduplicated regardless of property order. Conflicting content under one immutable ID is excluded and reported.

An attempt has `attemptId`, `selectionId`, `sourceId`, `url`, `checkedAt`, `outcome`, `finding`, and optional `recordIds`/`nextAction`. Allowed outcomes are `FOUND`, `INACCESSIBLE`, `STALE`, `WRONG_LINE`, `WRONG_MARKET`, `MISSING_PROBABILITY`, `INELIGIBLE` and `NOT_FOUND`. The finding states the actual result, including a concrete failed-access or mismatch reason. Missing attempts remain `NOT_ATTEMPTED`; a forecast record may demonstrate actual found evidence without a duplicate attempt. A `FOUND` label alone does not count as eligible coverage.

## Applicability and price calculations

`evaluateForecast()` produces `ELIGIBLE_EXACT`, `CONTEXT_ONLY` or `INELIGIBLE`, with reasons. It checks canonical event and start, league, pregame times, current review, material personnel suitability, exact period/side/line, provider capability and settlement. A correct team-win forecast on a run-line card is contextual and has no cover-probability/price comparison. Different lines and missing calculation time remain visibly limited. Invalid numbers, source identity conflicts, late observations and stale/unresolved reviews do not count as context accepted for the current card.

`forecastPriceComparison()` recomputes at the candidate's actual decimal price `d`:

- No push: `EV = p * (d - 1) - (1 - p)`; break-even `1/d`.
- Unconditional win `p` and push `q`: `EV = p * (d - 1) - (1 - p - q)`; required win probability `(1-q)/d`.
- Conditional on no push: `conditionalEvPerResolvedUnit = p*d - 1`. Without `q`, `evPerUnit` stays null. With known `q`, unconditional EV is `(1-q)*(p*d-1)`.

The comparison reports `SUPPORTS_PRICE`, `OPPOSES_PRICE` or `NEUTRAL`. It does not replace the forecast or choose a status. For example, 56.6% opposes a −141 price requiring approximately 58.5%, regardless of the market-reference comparison or eventual result. Integer line forecasts cannot be treated as no-push probabilities without resolving the refund convention. Invalid probability mass is rejected.

## Coverage, assembly and audit identity

`buildForecastCoverage({report, sidecar, universe, feed, policy, priorRecords, registry, now})` is read-only. Supply `universe` from `derivePrimarySelectionInventory(report, feed, policy)`, or supply feed and policy so the module derives it. It never substitutes published cards for the full available universe. Missing inventory produces `UNIVERSE_UNAVAILABLE` with no denominator or rate.

Coverage counts selection-level exact eligible, context-only, gaps, all blocked selections and blocked selections with eligible exact evidence. These are disjoint coverage populations over all available primary selections. Retrieved record count, unique eligible record IDs, external model-family count and explicitly adopted fair-value IDs remain separate. To identify an actual adoption, the governed assessment may reference `fairValueEvidence.forecastRecordIds`; attaching metadata does not create this field.

Older `MODEL` source findings in decisions or blockers are retained as `legacyModelLeads` and counted separately. Review those recorded findings first instead of repeating discovery. A missing new structured record does not mean no forecast was previously found; no probability or original model timestamp is reconstructed from a generic legacy statement. `LEGACY_MODEL_REVIEW_REQUIRED` makes this transition explicit.

Dimers, Stats Insider and syndicated copies share `CIPHER`. `externalModelFamilyCount` is not an independent-model count; the latter remains unknown. Market regression/influence and incomplete input disclosures stay attached to each reviewed record.

`attachForecastCoverage()` adds derived `report.forecastCoverage`, full `sidecar.forecastCoverage`, and exact-matched `forecastEvidenceIds`/`forecastReview` on draft cards and their receipt decisions. Matching recommendation/receipt evidence retains the same IDs. Raw records, original times, prices, statuses and stakes remain intact. If no current row can be established, old draft derived eligibility is replaced with an explicit unavailable review; it cannot silently carry into current prose.

Call attachment/assembly before freezing the candidate or creating fingerprints. Issued-history review uses the read-only builder. The publication tool retains its current gates and never treats this advisory warning count or incomplete forecast coverage as a report-wide blocker. Current card prose and performance tracking can reference the same frozen record IDs; source retrieval is not evidence of calibrated predictive skill.

## Commands and verification

```sh
node tools/forecast-evidence.mjs coverage --report candidate.json --sidecar candidate-research.json --root . --summary
node --test tests/forecast-evidence.test.mjs
```

Without `--feed`, the CLI loads the exact Git blob in `sidecar.provenance.feedBlobSha`. `--feed FILE` is for explicitly supplied bound/test inputs. Coverage commands print an advisory unavailable state on failure and perform no writes. Production preparation and assembly use `tools/report-evidence-repair.mjs` before immutable bundle publication.

Focused tests cover the Padres price conflict, moneyline-versus-run-line scope, away-spread sign, CFL exact-probability gaps, push EV, missing/time-invalid values, prior revalidation, family deduplication, blocked/unassessed denominator, failed retrieval, immutable identity, persistence and stale-derived-metadata clearing. They do not claim a live forecast was retrieved or that a subsequent normal report has already adopted the repair.

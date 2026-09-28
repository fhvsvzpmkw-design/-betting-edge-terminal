# Betting Edge game intelligence

Operational for Main reports issued from September 27, 2026 at noon Pacific. This is the shared source and game view for Core 1.5, not a second selection engine.

## The product

`games.html` opens the current game board. Every upcoming primary-sport event in the executable inventory can show external models, the internal Graham/Walters family, available Bet365/DraftKings prices, game research and relevant research-library principles. Open a game to inspect the actual fields and clocks. New issued reports embed the same game dossier they used, so later source refreshes cannot rewrite an earlier report.

Agreement is described by exact event, period, side, line and probability/settlement convention. The displayed median and range count one observation per model family. These are descriptive statistics, not a calibrated fair value, confidence interval, independent-signal count or automatic betting rule. A moneyline forecast is not a spread forecast. A native margin remains points. Sources with unknown probability conventions remain visible without invented EV.

## Shared collection

`node tools/collect-game-intelligence.mjs` collects once per board or event and writes an immutable compact capture plus `data/game-intelligence/current.json`. It reads the existing feed to identify events. It never requests sportsbook odds or calls a language model. ESPN game summaries are cached for one hour, or 15 minutes within two hours of kickoff; nfelo's board is cached for 30 minutes. All selections and report lanes share these observations. Request receipts show actual collection cost. A failed request preserves the original observation and its age, and reports the failure.

The `Game intelligence aggregation` workflow runs after a successful odds workflow and once at 03:40 Vancouver time for source-result recovery. It builds the board and prospective source scorecard. Concurrency and current-snapshot time checks prevent an older collection from overwriting a newer one. Publication retries reuse captured bytes. This workflow writes only `data/game-intelligence/**`.

| Source | Connected data | Limitations |
| --- | --- | --- |
| nfelo | Public maintainer CSV; current NFL projected home spread, home win probability, exact home/away cover and push probabilities | Schedule, season/week and ordered teams must match. Market-regressed family. No invented model calculation timestamp or moneyline tie convention. |
| ESPN | Existing public scoreboard and game-summary routes for active NFL, NCAAF, CFL, MLB, NBA, WNBA and NHL inventory; published predictor fields when present, injuries, venue and recent-game context | Coverage is measured per event; some sports/games have no predictor. NFL/tie-bearing probability conventions remain unknown. For verified no-draw games, raw full-game probabilities retain no-push semantics and still require applicability review. Injury lists are observations, not personnel clearance. |
| Graham / Walters | Exact active-week game fair, decomposition, adjustments, unresolved-input status and original sources | One related internal family. Existing governed adoption and personnel checks still apply. |
| Research Library | Sport-relevant guidance, findings, research IDs and provenance | Guidance requires explicit game applicability. A general historical principle is not another forecast vote. |
| Other registered sources | Existing source research and permitted structured capture imports | Dimers terms restrict automation and redistribution. DRatings direct verification returned HTTP 403. No paywall or access-control bypass; no claim of a verified automated feed for these sources. |

## Producer sequence

1. Use the ordinary `report-inputs.mjs` inventory. `--event-id` includes the full combined dossier.
2. `report-run start` binds source records and internal/research inputs into `sidecar.gameIntelligenceInputs`. `report-run next --event-id` presents the combined game evidence with the existing work plan. Export, assess and checkpoint using the established controller.
3. Source observation is not current applicability review. Captured probability rows are already available in `forecastEvidence.records`. Record genuine event, freshness, personnel and settlement reviews in `forecastEvidence.revalidations`; follow `docs/FORECAST_EVIDENCE.md`. Preserve unknown fields rather than setting optimistic flags. Record exact-source dispositions in the existing candidate assessment.
4. Complete coherent paired-market decisions using qualified evidence. Keep material disagreements visible. Unavailable external sources do not create a new publication veto. Run normal preparation and freeze; preparation embeds the dossier in `report.gameIntelligence`.

Freshness badges on the descriptive board indicate source age. They do not override the established quote or report eligibility rules. For a newer source snapshot, start a newly bound actual-time run; do not silently swap inputs inside a frozen report.

## Additional source captures

The common schema is deliberately provider-neutral. An authorized source/export supplies `schema:1`, actual `collectedAt`, and `records`. Each record includes registered `sourceId`/`modelFamily`, canonical event ID and exact kickoff, actual pregame `observedAt`, original `forecastAt` or null, URL, source field, excerpt, market/side/selected-side line, original probability or projection, probability basis and settlement when known. Use the rows produced by the collector as examples. Retain exact source fields and original clocks. Never create a complementary probability or convert a predicted score into a probability without a validated source method.

`node tools/collect-game-intelligence.mjs --import <capture.json>` validates a permitted capture for shared reuse. Existing draft-only `import-forecast-evidence.mjs` remains available for a source already reviewed for one report. New source registration must describe its model family and acquisition access, not merely add a brand name. Automated adapters must have an actual verified data shape and acquisition route before activation.

## Prospective source results

`node tools/grade-game-intelligence.mjs` reads immutable pregame captures and verified final ESPN scoreboards. It retains the last genuinely observed pregame forecast per source/game/market, using one orientation so opposite sides and repeated pulls cannot multiply the sample. It grades the actual captured line. Brier scoring is supplied only with a known probability convention; pushes and ties are separate. It never retrofits an old forecast from a postgame page, changes card grades or touches the betting ledger. There is no automatic source weighting or profitability claim.

## Verification

`node --test tests/game-intelligence.test.mjs` covers event identity, reversed sides, differing kickoffs, line orientation, unknown tie semantics, source-family deduplication, stale/future observations, source failure/cache reuse, exact comparison and prospective scoring. Existing report controller, evidence, forecast and publication regressions continue to test the original decision contract.


## Targeted personnel news

`data/game-intelligence/personnel-news.json` retains concise timestamped football-news findings from targeted research separately from automatic forecast collection. New dossiers pin only exact sport/event/kickoff/ordered-team matches observed before issue time. The collector cannot erase these leads. They retain `requiresCurrentApplicabilityReview:true`; use `docs/QUARTERBACK_FOLLOW_UP.md` to record an actual current review. They never automatically update a forecast, starter binding, fair or grade.

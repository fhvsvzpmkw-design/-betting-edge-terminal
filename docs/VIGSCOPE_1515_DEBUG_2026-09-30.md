# September 30 15:15 fault correction

Authoritative starting main: `e3d8243ea9825108b4a7b3fb40a73c5c1619a65a`. This continues the earlier September 30 repair. Issued reports, sidecars, checkpoints, grading and numbers are preserved.

## Issued run

Report `data/history/runs/2026-09-30/evening-152500.json`, same-named research sidecar, checkpoint `20260930-evening-1515.json` revision 21/PUBLISHED. The report clock is 15:25; the history publication commit was at 15:33 and Pages completed at 15:36 Pacific. The earlier actual odds snapshot was generated at 15:08:57.689 Pacific. Staging workflow `36785890631` and Pages `36786431839` succeeded. All fifteen readback gates were replayed successfully without changing issued bytes.

| Population | Count |
|---|---:|
| Available primary selections | 42 |
| Evaluated / PASS | 24 |
| Unfinished NHL selections | 18 |
| BET / LEAN / WAIT | 0 / 0 / 0 |
| New risk | $0 |
| Captured current forecast probability records | 8 |
| Current forecast revalidations | 0 |

Twenty-three published executable prices were unfavorable versus their exact paired Pinnacle reference. Atlanta–Washington Over 165.5 at decimal 1.9 was +0.804 percentage points, with unresolved participation/roles. This is a weak market comparison, not a missed proved BET. The zero-stake PASS remains issued evidence.

## Verified faults and forward repairs

1. **NHL acquisition was never attempted.** `categoryKey` did not classify NHL and `TOURNAMENTS` lacked it. The bound observer requested NFL, NFL preseason, Boxing, MLB and WNBA, with no NHL category, no NHL request and no explicit skipped-category diagnostic. Eighteen NHL selections were therefore blocked on a missing reference whose acquisition path was absent. Add NHL tournament 234, retain five-ID request batching, one-second pacing, the 25-request reserve and the existing primary-pull cap.
2. **Hockey settlement needs an explicit clock.** NHL regulation and overtime markets share handicap values and may share Pinnacle suffixes. Obtain and retain the official market definitions; admit only full-game two-way `period:result` moneyline, handicap and total game markets. Unknown catalogue semantics fail closed for NHL while unrelated sports can continue. Report-time references from 16:00 Pacific require the matching definition. No regulation price can stand in for an overtime/penalty contract. Definitions are reused for up to thirty days from their original retrieval time. This is metadata acquisition, not an invented odds model.
3. **Captured forecasts disappeared from the compact work queue.** The sidecar held eight current ESPN probabilities across Atlanta–Washington, Golden State–Dallas, Boston–New York and Chicago–San Diego. None had a current applicability revalidation. The compact work plan filtered to events with pending decisions, hiding those four completed market-card events. It now separately exposes the latest captured source fields awaiting review, their original times and exact selection questions. Revalidation or concrete shortfalls remain producer judgments. MLB ESPN fields can remain context-only; capture does not establish exact capability, independent calibration, adoption or BET authority.
4. **Originating-source attribution was mixed.** The Atlanta personnel finding attached an ESPN injury listing to an official WNBA URL. The forward operating instructions require the actual reporting URL and REPORTING type for a reporting fact. Checking an official event page does not transfer another publisher's fact into it. Historical source text remains unchanged.

The revised shared authority and all five Main task prompts require operating revision `2026-09-30.2`. Run times, report lanes, Core status rules and staking stay fixed. The full decision queue and outstanding captured-forecast work remain separate populations; an advisory review queue is not a publication veto.

## Live verification and remaining work

The one-time `Verify Pinnacle NHL recovery` workflow refreshes only the observer using the existing primary feed, stores an exact source-binding receipt, and refuses to overwrite a newer feed/observer. It makes no primary odds request and writes no report History. A request accepted by the provider and an actually qualified price are separate results. Record the resulting fixture/market counts after completion; no forecast review is marked completed by this workflow.

Remaining analytical work: actual current forecast/personnel/settlement applicability judgments, NHL goalie/lineup checks and any genuine source limitations. New NHL prices cannot retroactively amend the 15:15 report. Weeks 1–3 historical personnel gaps and Week 4 starter limitations retain the prior audit's scope.

## Reproduction and verification

- `node tests/pinnacle-nhl-coverage.test.mjs`: acquisition category, tournament, batching and full-game overtime settlement; rejects regulation and unknown definitions.
- `node tests/event-research-plan.test.mjs --integration`: latest captured points on completed market cards, real-review shortfalls, identity isolation and unchanged historical source/decision counts.
- `node tests/oddspapi-retention-horizons.test.mjs`: existing horizon, reserve and pacing checks.
- Forecast evidence/import, game intelligence, candidate, report controller and pipeline regression batch: 41 tests passed, zero failed; includes a populated immutable publication/readback replay.
- Exact alternate total, retention, freshness and market-assessment checks preserve existing non-NHL references.
- `node tools/report-pipeline.mjs readback --report data/history/runs/2026-09-30/evening-152500.json --sidecar data/history/research-fit/2026-09-30/evening-152500.json`.

Official provider references: https://oddspapi.io/sports/ice-hockey/nhl (tournament 234 / sport 15); https://oddspapi.io/blog/nhl-regulation-overtime-markets/ (regulation versus result clock); https://oddspapi.io/en/docs/get-markets (catalogue fields). These establish provider schema, not current price availability.

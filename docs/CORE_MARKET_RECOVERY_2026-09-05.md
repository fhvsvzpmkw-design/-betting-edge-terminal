# Core market availability — September 5 follow-up

## September 6 correction to timestamp interpretation

The historical findings below reproduce the then-current `updatedAt` age rule. Odds-API.io subsequently clarified that this field records last market change, not last observation. Therefore the earlier statements that age-based exclusions proved stale quotes, and that no clock correction was justified, are superseded by Contract section 4.0a and `docs/ODDS_OBSERVATION_FRESHNESS.md`. The archived numerical receipts remain unchanged and must not be reclassified using invented observations.

New feeds declaring `quoteObservationVersion: 1` measure the existing 30-minute eligibility and 90-minute retention horizons from exact response `observedAt`, preserve provider `updatedAt` and finalize `generatedAt` after collection. Missing/suspended responses still invalidate older prices within their requested scope. The next normal pull determines the actual recovery; neither the September 5 nor September 6 09:30 saved feed proves a recovered-selection count under the new semantics.

## Observed 15:15 baseline

Exact report: `data/history/runs/2026-09-05/evening-152600.json`.  
Exact feed blob: `8a758d9f9baae0bb55c39984c246b17e654a676e`, generated at 15:07:51 PT.  
Report timestamp: 15:26 PT. These artifacts remain unchanged.

| Sport | Games | Evaluated selections | Missing from retained feed | Stale selections |
|---|---:|---:|---:|---:|
| MLB | 11 | 46 | 8 | 12 |
| NCAAF | 30 | 64 | 78 | 38 |
| Total | 41 | 110 | 86 | 50 |

The 246 required selections represent both sides of each game's moneyline, primary handicap and total. Only five games had all six selections available. Seven college-football games had no fresh primary selection. Replaying the existing coverage resolver reproduced the receipt; no overlooked fresh primary alias was found in the retained/merged feed.

The 50 stale selections were correctly excluded under the 30-minute quote-age rule measured at feed generation. A fresh feed timestamp does not make every market quote fresh. The separate 75-minute feed gate and contractual quote-age clock remain unchanged.

Missing-from-feed is not proof that a book never offered a market. The old worker removed 4,097 markets beyond its 90-minute retention horizon, but only retained aggregate filter counts. It selected 340 event candidates, attempted 330 and retained 175; the earlier diagnostics could not adequately explain each omitted event or market.

## Acquisition correction

The worker's supplemental single-event requests could return primary markets but retained only props. Reuse the existing maximum six supplemental request slots to prioritize incomplete or stale major-sport primary markets and retain usable primary results. Preserve the shared feed, supported books, exact Crypto fight priority, broad discovery, hard 90-request budget, optional-stop threshold and reserve. No additional scheduled pull or paid provider is introduced.

Whole canonical market snapshots must be reconciled by their real timestamps, without combining an old side/line into a newer unavailable market. No timestamp is refreshed merely because a request completed. A newer suspended/empty primary market cannot be rescued from an older available copy. Exact event/book/market/selection identity and normal freshness remain necessary.

Retain bounded per-selected-major-event acquisition diagnostics, including attempted/omitted/failed/identity/budget outcomes and raw primary timestamps/retention states. This allows the next report review to separate a provider response gap from a market filtered as stale or an event not requested within budget. Diagnostic records confer no execution authority.

## Next live acceptance

The correction cannot recreate missing quotes in the archived snapshot. The next normal refresh must establish how many markets are actually recovered. Check:

1. request count remains within the existing budget and supplemental cap;
2. any recovered primary quotes have real supported-book identities and timestamps;
3. acquisition diagnostics explain remaining unavailable markets and events;
4. the report coverage receipt reconciles against the exact new feed;
5. the visible summary reports evaluated/unavailable counts and props paused;
6. all normal price, Core, personnel, evidence and publication checks pass.

The 15:15 cycle used a manual odds refresh. It proved report publication and meter fallback, but did not prove the automatic Cloudflare odds-dispatch path. This follow-up changes acquisition/evidence behavior, not the scheduler. No extra automatic checker or backstop is added.

Source and numeric-fair safeguards are specified separately in `REPORT_EVIDENCE_REQUIREMENTS.md`, effective for reports from 17:00 PT onward. Regression results and the published change are recorded in Git history and the major-sport coverage validation workflow.

## 18:15 acceptance result and coordinated closeout

Exact report: `data/history/runs/2026-09-05/late-182130.json`; feed blob `1d0fa8a4a4af89d9bfdc4d722991c81b3f17f25c`, generated 18:08:53 PT. Its ten retained same-day pregame events account for 60 primary sides: 26 usable and 34 unavailable. This issued report and its all-zero card/meter receipt remain unchanged.

The 34 exclusions reconcile to six sides with quotes 30–90 minutes old, 22 with provider quotes older than the 90-minute retention limit, and six with genuinely absent moneylines. The old coverage reason `MARKET_NOT_RETURNED` combines the last two groups. The new publisher coverage explanation distinguishes them using timestamps already retained in the bound acquisition diagnostics; it does not make those quotes executable.

The refresh used 83/90 requests. Six supplemental responses merged with identical before/after timestamps and availability, recovering zero primary pairs. Three other affected events had initial requests but fell outside the six-event supplemental cap. No fresh-quote resolver defect, API error, retry or identity rejection was found. **No additional collector, budget, scheduler, retention or freshness change is justified by this run.** The feed records a manual refresh; this is not acceptance of the automatic Cloudflare dispatch path.

One additional discovered event, `72854572`, returned no event from either book and is absent from `feed.events`. It is disclosed as an acquisition omission, outside the ten-event/60-side retained-feed count. Inventory completeness must not imply discovery-wide coverage.

The report's `26 evaluated` was an availability reconciliation, not proof of 26 documented handicaps; its source evidence gate checked zero displayed cards. From September 6, the existing coverage/bundle gates require per-available-side EVALUATED or BLOCKED receipts and derive a separate coverage display. Version-3 meters measure the verified primary market independently of card curation, with directional pressure explicitly unavailable when no stance exists. These changes are documented in the existing evidence and meter references; no new task, forced card or looser evidence rule is introduced.

The diagnostic version-3 replay used the original report timestamp, feed, coverage policy and all four eligible pinned snapshots. It found 30 verified quotes across eight games, ten comparable selections and two changed selections. Heat was 10/100 at 29% confidence; agreement was 59/100 from two pairs at 8% confidence. Pressure was unmeasured with `NO_DIRECTIONAL_REFERENCE`. The original version-2 telemetry reproduced exactly; archived report blob `e541958e5508521e4f7dc8961bbfbc9e7c3e1458` remained unchanged. These are diagnostic results, not a replacement historical report.

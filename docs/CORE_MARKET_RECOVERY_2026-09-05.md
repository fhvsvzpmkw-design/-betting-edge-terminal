# Core market availability — September 5 follow-up

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

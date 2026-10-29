# OddsPapi monthly request budget

Approved October 28, 2026 and deployed before the November 1 free-quota reset. The existing collector owns this policy; no report time or recurring task changes.

## Request allocation

- Keep the five Main reports and their FanDuel/DraftKings collections.
- Limit automated OddsPapi spending to seven charged attempts per America/Vancouver day, including catalogue requests and HTTP failures. At most two attempts are additional tournament batches. An optional batch cannot consume the allowance reserved for later Main reports or the remaining month's five daily base calls.
- Preserve five requests from the provider's actual monthly allowance. All external/manual account usage is reconciled from `/account`; it reduces the remaining allowance rather than creating another pool.
- Seven routine requests per day means at most 210 in November's 30 days or 217 in a 31-day month. The remaining allowance covers deliberate recovery and reserve; manual calls still count toward the provider's total.
- A date change never grants provider credits. Resume monthly spending only when the provider account count actually reflects renewed allowance. A provider reset before Vancouver midnight does not grant a second daily allocation.

## Competition selection and truthful coverage

Select upcoming primary events within 30 hours with fresh, active, two-sided game prices from the bound primary feed. Drop completed, stale, suspended, unpriced and unrelated categories. Preserve regular-season NFL's existing 384-hour Graham runway. NFL preseason's 192-hour retention remains available only when actual relevant preseason events select it; regular-season NFL no longer automatically requests preseason.

Pack at most five competition IDs per request. NHL and NBA are first in the main batch, followed by relevant football/baseball competitions. The second batch is optional under the daily and monthly budget. Requested, candidate and deferred competitions are listed separately. Successful acquisition of the requested subset may have `status:ok` with `acquisitionComplete:false` and `coverageStatus:PARTIAL_BUDGET`; this does not claim full-slate coverage. `report-inputs.mjs` exposes the deferrals and exact missing references. No deferred or cached price is relabelled as fresh. All existing benchmark identity, settlement, observation and publication validators continue to apply.

## Accounting and catalogue cache

`data/oddspapi-budget-state.json` saves confirmed provider usage, estimated pending charged attempts, daily spending and extra batches. Each billed attempt is recorded before transport, so timeouts and HTTP errors cannot create an automatic free retry. On first deployment with existing provider usage, an unknown current-day total is conservatively reserved and labelled estimated. The next normal day can open its daily allocation without clearing monthly usage.

`data/oddspapi-market-cache.json` saves validated NHL overtime market definitions and their original observation time for up to 30 days. It contains definitions, never reusable live odds. Blocked/error observers do not discard this cache. A required refresh is included in the planned and recorded charged request total.

The existing odds publication step preserves these state files even when a newer primary snapshot wins a publication collision or an earlier validation stage fails. Publication retries use saved bytes and never repeat collection. The existing shared odds-workflow concurrency remains the single-writer boundary.

## Usage line and verification

The existing workflow summary prints monthly usage, remaining allowance, today's spending and a projected month-end total. Pending or unattributed spending is labelled estimated. The projection is a conservative seven-per-day ceiling, not a promise that every remaining allocation will be spent.

Tests use fake transport, frozen clocks and local Git remotes. They cover the complete 31-day ceiling, actual November reset, provider/local-day boundaries, charged failures and catalogue requests, deferred exact references, cache retention and collision-safe publication. No live request is needed to verify reset handling. The first normally scheduled post-reset pull provides live acceptance.

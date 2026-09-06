# Main Betting Edge Schedule

**Status:** OPERATIONAL — SCHEDULING LAYER  
**Effective:** 2026-08-19  
**Updated:** 2026-09-06 — permanent Main Betting Edge schedule
**Timezone:** `America/Vancouver`  
**Betting methodology authority:** `BETTING_EDGE_CONTRACT.md` v1.0 + Core v1.4 production manifest  
**Schedule definition:** `data/main-schedule.json`

## Scope

This authority governs trigger timing, report-lane clock labels, featured VigScope checkpoints, required scheduled-sweep market coverage and report-card event-date eligibility. It does not change Betting Edge pricing, identity, freshness, fair-value, model-error, decision, staking, risk, Research Fit, Walters authority, immutable-history or delivery rules.

The canonical slot keys remain `open`, `main`, `final_morning`, `evening` and `late`, preserving historical compatibility. Production scheduling reads the one permanent schedule from `data/main-schedule.json` before analysis.

## Daily operating rule

Every Vancouver operating day uses the permanent Main Betting Edge schedule. There is no seasonal selection, queued schedule state or terminal schedule control.

The Main schedule supplies exactly five primary odds pulses and five report windows. The Odds-API spending target remains five primary pulls per operating day. Every configured primary odds pulse is scheduled 10 minutes before its corresponding report window.

The schedule is repository-controlled and is not exposed as a Preferences option.

## Same-day report-card eligibility

`data/report-event-eligibility-v1.json` is the controlled authority for event-date eligibility, and `tools/report-event-eligibility.mjs` is its deterministic validator.

For every scheduled Betting Edge report, a recommendation is eligible for the published card board only when all of the following are true:

1. `report.ts` is a valid timestamp;
2. `rec.feed.eventDate` is a valid event-start timestamp;
3. the event start is strictly later than `report.ts`; and
4. the event start and `report.ts`, each converted to `America/Vancouver`, fall on the same Vancouver calendar date.

This is an additional hard subset of the normal active horizon. Whenever a scheduled-task prompt says to consider every supported major-sport market inside the normal active horizon, candidate evaluation for the report card is limited to events that also satisfy this same-day rule. Tomorrow's games may remain in `data/live-odds.json` and may remain available for non-publication research, but they are outside today's report-card candidate pool. Games that have already started are also outside the candidate pool.

Apply the rule before deep candidate research/card selection and again immediately before freeze/staging. Do not backfill an undersized board with next-day events. Nine remains a hard maximum and never a quota; a same-day slate may legitimately produce fewer cards or zero cards.

The staged publisher independently enforces the same rule and fails closed on `EVENT_ALREADY_STARTED`, `EVENT_OUTSIDE_REPORT_DATE` or invalid timestamp state. Historical issued reports remain immutable evidence and are not retroactively rewritten or invalidated.

## Automatic odds scheduling

Cloudflare Worker Cron remains the **single automatic odds scheduler**. It wakes at the configured minute marks, reads the permanent Vancouver-local Main schedule and dispatches the existing GitHub odds workflow only when that exact minute is a configured pulse. The Worker does not perform the quota-heavy odds collection itself.

The target odds workflow retains its serialization, canonical-slot duplicate protection and five-primary-pull cap. `workflow_dispatch` remains the intentional manual recovery path after a missed scheduled dispatch.

## Permanent Main Betting Edge timing

- 05:50 odds → 06:00 report
- 07:50 odds → 08:00 report
- 09:20 odds → 09:30 report
- 15:05 odds → 15:15 report
- 18:05 odds → 18:15 report

## NFL / NCAAF primary-market coverage

Every scheduled Betting Edge report that includes an NFL or NCAAF game must treat the three standard full-game markets as independent primary candidates whenever an executable market is available:

- spread;
- moneyline;
- total.

For each covered football game, each available primary market must be independently handicapped and independently passed through the normal Betting Edge decision gates. The resulting market-level decision is independently `BET`, `LEAN`, `WAIT` or `PASS` under the existing contract/Core rules.

A decision in one market never substitutes for evaluation of another. In particular:

- a moneyline BET/LEAN/WAIT/PASS does not satisfy the spread requirement;
- a spread BET/LEAN/WAIT/PASS does not satisfy the moneyline requirement;
- neither side-market decision satisfies the total requirement;
- discovering or citing an external spread or total during matchup research is not equivalent to handicapping that market through the Betting Edge gate.

The sweep must compare the independently evaluated markets before selecting the report's meaningful cards. A game may therefore produce more than one meaningful card when separate markets independently qualify. The nine-card presentation target remains a presentation target, not a reason to suppress a stronger football market or manufacture filler.

If a normally expected primary football market cannot be evaluated because no executable market is available in the supported feed, the run should preserve that as an availability limitation rather than silently treating another market as its substitute.

This requirement applies to NFL and NCAAF games on the Main Betting Edge schedule. It changes market-coverage completeness only; all existing freshness, identity, personnel, model-error, price, staking, risk, Walters and publication requirements remain authoritative.

## Canonical History identity

Canonical slot identity remains permanent:

1. `open`
2. `main`
3. `final_morning`
4. `evening`
5. `late`

History continues to use these same slot identities. This simplification never rewrites actual issued timestamps, feed timestamps, report payloads, odds snapshot SHAs or archived files. Planned pulse/report times are metadata; actual timestamps remain historical truth.

New report-history/index records should retain, when available:

- `scheduleProfileId`
- `scheduleProfileLabel`
- `scheduleProfileSchema`
- `canonicalSlot`
- `scheduledPulseTime`
- `scheduledReportTime`
- `scheduledLabel`
- `featuredVigScope`

The legacy `scheduleProfileId`, `scheduleProfileLabel` and `scheduleProfileSchema` field names remain compatibility metadata for new report-history/index records; their Main schedule values are `main`, `MAIN BETTING EDGE` and `1`. Existing historical values remain untouched.

Odds snapshots use `scheduleMeta` for corresponding schedule/pulse provenance. Existing automatic snapshots may identify `triggerSource: cloudflare-cron`; intentional manual refreshes identify `triggerSource: manual`.

## VigScope

The Main schedule marks exactly three canonical slots as featured VigScope checkpoints. This does not choose or improve the VigScope state. The displayed state remains derived from actual Market Heat, Price Pressure and Market Agreement inputs. Schedule metadata controls only which three daily readings receive featured checkpoint treatment in the terminal and History.

## Report automation gate

Every standard report task matches its expected Vancouver time against the permanent Main schedule. If that trigger clock is not one of `06:00`, `08:00`, `09:30`, `15:15` or `18:15`, it exits before handicapping and before any history write.

When the trigger matches, the report must require:

- `BETTING_EDGE_CONTRACT.md` v1.0 OPERATIONAL;
- VigScope Terminal UI v1.5;
- `core/core-v1.4-production.json` Core v1.4 OPERATIONAL;
- Research Library v1.8 / R3 live read-only;
- current Walters authority mode and exact provenance;
- the normal freshness, identity, personnel, model-error, price, stake/risk and immutable-history gates;
- same-day report-card event eligibility under `data/report-event-eligibility-v1.json`, applied before candidate research and again before staging;
- for NFL/NCAAF, complete independent spread + moneyline + total primary-market evaluation as specified above.

Scheduled report lanes target up to **nine meaningful cards**. Nine is a presentation/review target, not a quota: reports may contain fewer cards and zero BETs, and weak filler or next-day backfill must not be manufactured to reach nine.

Historical report tasks and issued reports remain immutable evidence under the contract/core/research state that governed them at issuance.

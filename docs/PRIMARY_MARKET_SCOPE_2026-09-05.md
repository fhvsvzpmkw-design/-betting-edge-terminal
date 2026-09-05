# Primary-market report scope — 2026-09-05

Status: OPERATIONAL after the scope-change commit is applied to main.
Effective report timestamp: 2026-09-05T13:00:00-07:00 (America/Vancouver).
User authorization: pause player-prop analysis and focus the five standard Betting Edge reports on core full-game markets.

## Active coverage

MLB, NHL, NBA, WNBA, NFL, NCAAF and CFL retain both moneyline sides, both primary spread/run-line/puck-line sides, and both primary game-total sides. Every in-scope game contributes six primary selections, each evaluated or explicitly unavailable. Core 1.4 fair-value, personnel, uncertainty, execution and staking rules continue to apply.

Player-prop screening, prop-specific research, fair estimation and every new or carried prop BET/LEAN/WAIT/PASS card are paused. Broad odds acquisition and archived reports/results remain available. The report summary identifies the pause.

The authoritative scope is in data/major-sport-market-coverage-v1.json. All five standard tasks inherit BETTING_EDGE_SCHEDULED_REPORT_AUTHORITY.md (authority interface version 1.1). Their prompt descriptions reflect the pause; task schedules and enabled states are preserved.

## Receipt and publication

New coverage receipts copy reportScope id, effectiveFrom and playerProps into coverageAudit.scope. Every sport records props.state=PAUSED_BY_SCOPE, its actual fresh returned inventory, screened=0, seriousDeepReviewed=0 and excludedByScope=returned. Totals include propsExcludedByScope.

Inventory counting is deterministic bookkeeping, not prop screening. The coverage gate still verifies primary coverage and exact returned counts. Both the bundle validator/publisher and the coverage gate reject out-of-scope recommendation markets. Report and sidecar scope context must agree. Prior tracked props may record PAUSED_BY_SCOPE in continuity diagnostics; primary-market continuity remains enforced.

Reports before the cutover retain their original screening rules and do not require the new additive receipt fields. No issued report, sidecar, decision or grade was rewritten for this change.

## Validation

- Seven-sport regression: all 42 primary selections remain available from one fresh supported book; 14 returned test props are excluded with zero analysis.
- Every prop status is rejected across all seven sports; conflicting report/sidecar scope, disguised prop identities, missing pause receipts and fabricated zero inventory are rejected.
- Stale primary quotes still require explicit unavailability. Legitimate labeled primary rows and unverified primary PASS identities retain their existing handling.
- The cutover preserves historical receipts. Paused prop continuity does not relax primary selection continuity.
- Bundle validation and attempted publication reject a prop before writing History; existing bundle, personnel and historical-publication regressions pass.
- Hypothetical scope replay of the archived 2026-09-05 09:36:53 report: 20 games, 120 required primary selections, 78 available, 42 unavailable; 6,103 returned props excluded and zero screened/deep-reviewed. The original report, sidecar and replay inputs were unchanged.

## Deferred work

Prop identity conflicts, cross-book matching and screening-to-research traceability remain an investigation. Reintroduce one exact prop category within one sport only after its identity, quote matching, independent research and decision process are validated and a scope amendment is explicitly authorized. enabledPropMarkets is empty; changing that list alone cannot activate a prop.

The separate review of freshness explanations, one-book blockers and uncertainty handling in primary markets remains outstanding. This scope change does not claim those analytical issues are repaired or guarantee a future BET.

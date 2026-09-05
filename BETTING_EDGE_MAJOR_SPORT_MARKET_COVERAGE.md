# Betting Edge Major-Sport Market Coverage — Operational Addendum

**Status:** OPERATIONAL  
**Authority:** `data/major-sport-market-coverage-v1.json`  
**Effective:** 2026-09-02
**Primary-market scope amendment:** 2026-09-05 13:00 America/Vancouver  
**Scope:** MLB, NHL, NBA/WNBA, NFL, NCAAF and CFL scheduled Betting Edge reports.

This addendum governs **coverage breadth and evaluation order only**. It does not loosen Contract v1.0, Core 1.4, exact identity, freshness, personnel, Pinnacle, exposure, staking or publication gates.

## 1. Evaluate first, select cards second

For every in-scope major-sport game present in the bound fresh odds snapshot, complete the required market evaluation before choosing which recommendations deserve report cards.

Do not preselect an underdog, favorite, home side, away side, over or under as the candidate merely because it looks interesting. Do not use one market as a substitute for another and do not use one league as a substitute for another.

A zero-BET report remains valid after a complete sweep.

## 2. Required primary-market sweep

### MLB
- Full-game moneyline: home and away.
- Primary full-game run line: home and away.
- Primary full-game total: over and under.

### NHL
- Full-game moneyline: home and away.
- Primary full-game puck line: home and away.
- Primary full-game total: over and under.

### NBA / WNBA
- Full-game moneyline: home and away.
- Primary full-game spread: home and away.
- Primary full-game total: over and under.

### NFL / NCAAF / CFL
- Full-game moneyline: home and away.
- Primary full-game spread: home and away.
- Primary full-game total: over and under.

When an expected primary market is absent, stale, identity-unsafe or otherwise unusable, record the availability limitation instead of silently skipping the market or substituting another line.

When any primary selections are unavailable, the visible report summary states the exact evaluated and unavailable selection counts. Checking an unavailable market completes the inventory audit but does not make that market usable for handicapping. `MARKET_NOT_RETURNED` describes the retained snapshot, not proven sportsbook non-offering; upstream acquisition/retention diagnostics distinguish those causes when available.

## 3. Player props are paused by scope

At or after `2026-09-05T13:00:00-07:00`, `reportScope` in the JSON authority controls `PRIMARY_FULL_GAME_ONLY`. Player props are `PAUSED_BY_SCOPE` across all covered sports, with `enabledPropMarkets: []`.

Stop prop screening, prop-specific deeper research, fair estimation and all new/carried prop BET/LEAN/WAIT/PASS recommendations. A pause is a scope decision, not an analytical PASS and not an availability failure. Core primary-market personnel research remains required. Selection continuity may explicitly record a prior prop as `PAUSED_BY_SCOPE`; primary selections retain normal continuity requirements.

Reintroduce one exact prop category within one sport only through an explicit scope amendment after verifying identity, book matching/freshness, independent research, screening and publication behavior. The existing Contract prop identity requirements remain available for that work and for historical records.

## 4. Feed inventory and historical scope

`data/live-odds.json` acquisition continues to retain its broad markets. `events` is the primary collection; `deepMarkets` and `baseballProps` remain supplemental. Pausing analysis does not change collection, odds refresh timing, API budgets or archived history.

Fresh returned prop keys are counted mechanically as feed inventory. Counting is not screening. For each sport retain the true `returned` count, record `state: PAUSED_BY_SCOPE`, `screened: 0`, `seriousDeepReviewed: 0` and `excludedByScope` equal to `returned`. Do not replace a nonzero inventory with a fabricated zero or describe paused props as unavailable.

Reports before the scope amendment retain the original requirement that every fresh returned prop be screened, with deeper work where serious or materially personnel-dependent. Their stored payloads and grading remain unchanged.

## 5. Card target and overflow

`data/preferences.json` module `report_card_target` remains the presentation authority. The current target of nine is **soft**, not a hard ceiling.

Complete market evaluation happens before card curation. A qualifying BET, LEAN or WAIT may not be discarded solely to keep the report at nine cards. PASS cards may be curated after the complete sweep. Existing tracked/actionable overflow protection remains mandatory.

## 6. Completion standard

A scheduled report may claim complete coverage of its active full-game primary markets only when:
1. every in-scope game had all required primary selections evaluated or explicitly recorded as unavailable/unverifiable;
2. the report applies its timestamp-appropriate scope: original prop screening before the amendment, or an explicit paused-prop inventory receipt at/after it;
3. serious/personnel-sensitive candidates received the required deeper research and re-handicap;
4. final card selection happened only after those evaluations;
5. no actionable recommendation was suppressed by the presentation target.

## 7. Durable coverage receipt — mandatory from 08:00 PT September 2, 2026

For report timestamps at or after `2026-09-02T08:00:00-07:00`, the schema-3 sidecar must include the exact top-level `coverageAudit` receipt controlled by `data/major-sport-market-coverage-v1.json`.

The receipt records, for MLB, NHL, NBA/WNBA, NFL, NCAAF and CFL:
- games in scope and games evaluated;
- required, evaluated and unavailable primary selections;
- fresh exact prop selections returned, screened and excluded by scope;
- serious props receiving deeper research;
- explicit event/market/selection availability limitations;
- the active soft card target and overflow-protection result;
- reconciled board-wide totals.

Every in-scope game contributes six required primary selections: two moneyline selections, two primary spread/run-line/puck-line selections and two primary-total selections. Evaluated plus explicitly unavailable selections must reconcile exactly to that requirement. Before the scope amendment, every returned supported prop must be counted as screened. At/after the amendment, every sport has `props.state=PAUSED_BY_SCOPE`, zero screened/deep-reviewed props and `excludedByScope=returned`. The additive `coverageAudit.scope` records the authority's id, effectiveFrom and playerProps values; `totals.propsExcludedByScope` reconciles to all returned props. Older receipts do not require these additive fields. Every unavailable primary selection must be represented exactly once in `availabilityLimitations`.

The receipt carries the exact current Git blob SHA of the market-coverage authority and the exact report `feedGeneratedAt`. `tools/major-sport-market-coverage-gate.mjs` validates the receipt before permanent History is written. The staged publisher repeats the gate during publication and on remote read-back.

A missing, incomplete, internally inconsistent, stale-authority, hard-nine-card, or suppressed-actionable receipt fails closed. It does not become issued History.

This addendum changes **coverage completeness and auditability**, not BET threshold or risk tolerance.

At/after the scope amendment, report summaries explicitly state that player-prop analysis is paused. New recommendations are restricted to the primary market definitions above in both the report and sidecar. The publication checks reject every out-of-scope card, regardless of status.

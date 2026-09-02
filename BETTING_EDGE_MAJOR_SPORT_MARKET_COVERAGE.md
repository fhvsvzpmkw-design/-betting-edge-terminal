# Betting Edge Major-Sport Market Coverage — Operational Addendum

**Status:** OPERATIONAL  
**Authority:** `data/major-sport-market-coverage-v1.json`  
**Effective:** 2026-09-02  
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

## 3. Props are part of the major-sport sweep

For every in-scope game, inspect the bound feed's fresh exact supported player props and screen every returned prop selection before card selection. Deep research is then concentrated on serious candidates and personnel-sensitive props rather than performing maximum-depth research on every quoted prop.

Examples include:
- MLB: pitcher strikeouts, hits, total bases, home runs, RBI.
- NHL: shots, goals, assists, points, goalie saves.
- NBA/WNBA: points, rebounds, assists, three-pointers.
- NFL/NCAAF/CFL: passing, rushing and receiving yards, receptions, touchdowns and other exact supported player props.

Props must obey the existing Contract player-prop identity invariant. No prop can become actionable unless exact event, player, market, line, side, team/game context and executable sportsbook price are validated.

League/book prop absence is an availability result, not permission to substitute a different event or player.

## 4. Feed inspection rule

`data/live-odds.json` is the bound source. Inspect `events` as the primary market collection. `deepMarkets` and `baseballProps` are supplemental discovery collections and must not be treated as the sole evidence that a prop exists or does not exist.

The odds worker's normal multi-event response may already contain player-prop markets inside `events`; therefore report generation must inspect fresh markets there before declaring props unavailable.

## 5. Card target and overflow

`data/preferences.json` module `report_card_target` remains the presentation authority. The current target of nine is **soft**, not a hard ceiling.

Complete market evaluation happens before card curation. A qualifying BET, LEAN or WAIT may not be discarded solely to keep the report at nine cards. PASS cards may be curated after the complete sweep. Existing tracked/actionable overflow protection remains mandatory.

## 6. Completion standard

A scheduled report may claim complete major-sport coverage only when:
1. every in-scope game had all required primary selections evaluated or explicitly recorded as unavailable/unverifiable;
2. every fresh exact supported player prop returned by the bound feed was screened;
3. serious/personnel-sensitive candidates received the required deeper research and re-handicap;
4. final card selection happened only after those evaluations;
5. no actionable recommendation was suppressed by the presentation target.

## 7. Durable coverage receipt — mandatory from 08:00 PT September 2, 2026

For report timestamps at or after `2026-09-02T08:00:00-07:00`, the schema-3 sidecar must include the exact top-level `coverageAudit` receipt controlled by `data/major-sport-market-coverage-v1.json`.

The receipt records, for MLB, NHL, NBA/WNBA, NFL, NCAAF and CFL:
- games in scope and games evaluated;
- required, evaluated and unavailable primary selections;
- fresh exact prop selections returned and screened;
- serious props receiving deeper research;
- explicit event/market/selection availability limitations;
- the active soft card target and overflow-protection result;
- reconciled board-wide totals.

Every in-scope game contributes six required primary selections: two moneyline selections, two primary spread/run-line/puck-line selections and two primary-total selections. Evaluated plus explicitly unavailable selections must reconcile exactly to that requirement. Every returned supported prop must be counted as screened. Every unavailable primary selection must be represented exactly once in `availabilityLimitations`.

The receipt carries the exact current Git blob SHA of the market-coverage authority and the exact report `feedGeneratedAt`. `tools/major-sport-market-coverage-gate.mjs` validates the receipt before permanent History is written. The staged publisher repeats the gate during publication and on remote read-back.

A missing, incomplete, internally inconsistent, stale-authority, hard-nine-card, or suppressed-actionable receipt fails closed. It does not become issued History.

This addendum changes **coverage completeness and auditability**, not BET threshold or risk tolerance.

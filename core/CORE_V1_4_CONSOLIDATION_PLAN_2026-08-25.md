# Betting Edge Core 1.4 — Consolidation Plan

**Date:** 2026-08-25  
**State:** SCOPE FROZEN — BUILD / INTEGRATION PLAN  
**Current production core:** v1.3  
**Target production core:** v1.4  
**Research authority:** Research Library v1.8 R3 LIVE READ-ONLY  
**Walters source design:** `research/staging/BILLY_WALTERS_SPREAD_BOX_SPEC_2026-08-15.md`

## Purpose

Core 1.4 is the consolidation release built from what production Core 1.3 taught us.

It is not a rewrite and it is not a container for every future Betting Edge idea. It preserves the proven 1.3 execution/identity/freshness/staking/report foundations and replaces reactive patches with cleaner underlying analytical principles.

> **1.3 was the system we learned with. 1.4 is the system built from what we learned.**

For each production patch or failure case, Core 1.4 preserves the lesson rather than mechanically preserving the patch.

---

# 1. Included in Core 1.4

## 1.1 Proven Core 1.3 foundation

Retain without loosening:

- exact event / market / selection identity;
- exact player-prop identity;
- 75-minute feed freshness;
- 30-minute executable quote freshness;
- Bet365 + DraftKings execution-book boundary;
- fair-value-before-BET requirement;
- conservative `playTo` construction;
- only BET carries non-zero stake;
- existing exposure/staking controls;
- immutable issued reports and non-mutating repricing;
- source-backed report/history provenance.

## 1.2 Fair-value quality classification

Every serious candidate distinguishes:

- `INDEPENDENT_MODEL`;
- `MARKET_ANCHORED_MODEL`;
- `MARKET_DERIVED_ONLY`;
- `UNAVAILABLE`.

A two-book no-vig benchmark is useful market information but is not silently treated as an independently modeled true price.

## 1.3 Model-error / fragility framework

Graduate the tested Core 1.3 R1 candidate into Core 1.4 with ordered states:

- `STANDARD`;
- `ELEVATED`;
- `HIGH`;
- `UNQUANTIFIED`.

Initial Research Library graduation remains one-way: approved research may raise the model-error floor or prevent false precision. It may not lower model error or directly move the fair-value point estimate in the first 1.4 release.

## 1.4 Book disagreement as uncertainty

Material Bet365/DraftKings disagreement is price-quality/model uncertainty unless separate current evidence resolves it. A one-book outlier is not itself an independent handicap signal.

## 1.5 Tail and liquidity awareness

Extreme prices, thin competitions and fragile derivative markets receive wider uncertainty treatment where approved research or current market structure supports it. There is no arbitrary American-odds cutoff.

## 1.6 Exact-market calibration awareness

Mechanism knowledge and sportsbook price calibration are separate layers. MLB doubles/stolen bases, WNBA props, NFL props, boxing derivatives and CFL pregame markets do not automatically inherit confidence from broader neighboring markets.

## 1.7 Personnel uncertainty inside the handicap

Stage 1 / Stage 2 personnel work remains operational, but Core 1.4 incorporates the analytical lesson directly: unresolved participation, batting order, starter, role, minutes or effectiveness uncertainty can widen the candidate distribution/model-error state.

## 1.8 Movement interpretation

Market movement remains relevant current evidence but is not synonymous with sharp/informed action. Movement alone cannot become an independent handicap signal.

## 1.9 WAIT as a real analytical state

WAIT means a genuinely live candidate that could become materially closer to actionable if a named blocker resolves. A sportsbook outlier, book gap, no-vig residual, stale comparison or unresolved personnel fact alone does not earn WAIT.

## 1.10 Research Library v1.8 as controlled calibration knowledge

Core 1.4 may use a fixed approved allowlist of v1.8 findings to raise uncertainty/model-error floors or enforce transportability/calibration boundaries. Runtime History Fit grades do not control the core.

## 1.11 Walters Intelligence Engine — REQUIRED 1.4 CAPABILITY

Core 1.4 must expose and resolve a stable Billy Walters-derived handicapping engine for eligible NFL spread/moneyline work.

Initial methodology includes:

- neutral-field power ratings;
- incremental rating changes;
- player/injury point values and cluster effects;
- home-field calibration;
- rest/travel/weather/venue/situational factors;
- transparent fair-spread arithmetic;
- NFL key-number context;
- spread-versus-moneyline comparison;
- line-shopping/execution context.

Canonical interface: `core/walters-intelligence-interface-v1.4.json`  
Runtime authority switch: `core/walters-authority-v1.4.json`

### Walters runtime modes

Core 1.4 ships with three switchable modes that can be changed without rebuilding/re-versioning 1.4:

- `OFF` — Walters is not ingested for current handicapping.
- `ADVISORY` — Walters is visible/comparable and may trigger re-review, but cannot directly create a recommendation.
- `BET_AUTHORITY` — an eligible Walters handicap can influence Core fair value, count as one independent handicap input, and **originate a BET recommendation itself**.

The default initial mode is `BET_AUTHORITY`. This is a runtime setting, not a permanent authority requirement; it can be switched immediately to `ADVISORY` or `OFF` for future reports if monitoring shows the Walters package needs adjustment.

### Meaning of Walters BET authority

When `BET_AUTHORITY` is enabled, Walters does not need the ordinary Core handicap to nominate the wager first. A complete/current/arithmetic-verified Walters build may originate an exact spread or moneyline BET candidate based on its own power-rating + personnel + game-factor fair.

That candidate can become an issued BET only after the normal Core 1.4 hard gates pass:

- exact event/market/selection identity;
- feed and executable-quote freshness;
- current personnel/information requirements;
- price-quality and model-error boundary;
- conservative `playTo` validation;
- exposure and staking policy.

Walters BET authority therefore means **handicap/recommendation authority**, not permission to bypass execution safety.

Walters still may not:

- fabricate or supply an executable sportsbook quote;
- bypass identity/freshness/personnel/price-quality/exposure gates;
- erase model-error/calibration/liquidity uncertainty merely because Walters likes the wager;
- set final stake directly;
- increase odds API calls or change execution books;
- rewrite an issued historical report.

Walters counts as at most one independent current handicap input. Its chapters, factors and component adjustments cannot be split into multiple independent votes.

### Page 270 / spread-versus-moneyline correction

The previously identified Page 270 Moneyline-vs-Spread anomaly/correction is part of Walters source provenance. Core 1.4 must not use an unverified or internally inconsistent historical chart. If corrected conversion logic cannot be resolved from the approved/user-supplied source package, return `SPREAD_VS_ML_UNAVAILABLE` rather than guess.

---

# 2. Explicitly NOT part of Core 1.4

The following are consciously deferred and must not block 1.4 promotion:

1. **Results / CLV feedback learning loop** — later observation/calibration work.
2. **Shadow History activation** — S-track remains separate/inactive until separately designed and approved.
3. **Learned player/team associations and personal-ledger calibration** — later secondary learning/context work.

Also excluded:

- new paid odds subscriptions;
- new execution books;
- higher odds/API request volume;
- staking-methodology changes;
- report-lane/schedule changes;
- broad UI redesign;
- automatic Research Library writes during reports.

---

# 3. 1.3 lesson → 1.4 solution matrix

| 1.3 production lesson | Clean 1.4 solution | Regression requirement |
|---|---|---|
| Two-book no-vig looked more precise than it was | Explicit `fairValueBasis` | Market-derived-only case cannot behave like independent model |
| Large book splits generated apparent edge | Material dispersion raises model-error floor | Long-price / large-split regression |
| WAIT drifted toward book-gap longshots | Model-error + independent-support rules underneath WAIT | Market-only longshot fails; strong-model longshot survives |
| Thin soccer derivatives were hard to trust | Liquidity/transportability state | Thin + dispersed soccer case HIGH |
| Player-prop evidence transported too broadly | Exact-market `directCalibration` boundary | WNBA/NFL/MLB rare-prop tests |
| Lineup/role uncertainty lived too far outside fair-value confidence | Personnel sensitivity contributes to uncertainty | Unresolved role/lineup raises floor |
| Movement language could imply sharp proof | Movement/order-flow separation | Movement-primary case cannot count as independent support |
| Research was descriptive only | Fixed v1.8 allowlist may raise model-error floor | Research can raise, never lower, first-release floor |
| Stage 2 and WAIT required late machine patches | Core carries their analytical principles earlier | Publication gates remain backstops |
| Walters existed as separate staging design | Switchable Walters engine inside Core 1.4 | OFF / ADVISORY / BET_AUTHORITY cases |

---

# 4. Core 1.4 build sequence

## Gate A — Scope and interfaces

- freeze this consolidation plan;
- validate the model-error R1 candidate as the 1.4 uncertainty foundation;
- validate Walters interface + runtime authority switch;
- define structured per-candidate provenance fields.

## Gate B — Production integration candidate

- create Core 1.4 machine-readable configuration from the tested R1 framework + Walters interface/authority config;
- add structured model-error/fair-value-basis evidence to new sidecars;
- add Walters mode/availability/contribution/origination evidence where applicable;
- allow Walters-originated candidate generation only in `BET_AUTHORITY` mode;
- keep historical reports immutable;
- preserve Stage 2 and WAIT publication gates as backstops.

## Gate C — Regression

Run the full 1.3/1.4 case bank, including:

- mainstream liquid game market;
- market-derived-only fair;
- extreme-tail book-gap case;
- strong independently modeled longshot;
- thin soccer derivative;
- WNBA prop;
- NFL prop;
- MLB doubles and stolen-base props;
- unresolved personnel case;
- movement-primary case;
- unavailable fair-value case;
- boxing derivative;
- CFL pregame;
- college-football direct-evidence case;
- Walters OFF;
- Walters ADVISORY aligned/conflicting;
- Walters BET_AUTHORITY eligible BET originator;
- Walters BET_AUTHORITY rejected by stale/identity/personnel/model-error gate;
- Walters unavailable;
- Walters spread-vs-moneyline conversion unavailable.

## Gate D — Promotion

Promote only after:

- regression PASS;
- production provenance can record Core 1.4 + Walters mode;
- future reports resolve Core 1.4 and Walters authority before handicapping;
- governance explicitly permits one-way v1.8 model-error influence and switchable Walters BET authority;
- no staking, schedule, book or API-budget regression occurs.

The first eligible post-cutover lane becomes the initial Core 1.4 live observation. Historical Core 1.3 reports remain immutable.

---

# 5. Promotion success definition

Core 1.4 succeeds when it behaves like a cleaner version of the system we already trust:

- fewer ad-hoc exceptions;
- clearer distinction between fair value and confidence in fair value;
- less false precision in fragile markets;
- personnel uncertainty affects the handicap coherently;
- research affects uncertainty only through approved rules;
- Walters can be switched OFF, used as advisory intelligence, or empowered to originate BETs without rebuilding the core;
- all proven hard execution safeguards survive unchanged.

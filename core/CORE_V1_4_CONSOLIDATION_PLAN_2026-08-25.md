# Betting Edge Core 1.4 — Consolidation Plan

**Date:** 2026-08-25  
**State:** SCOPE FROZEN — BUILD / INTEGRATION PLAN  
**Current production core:** v1.3  
**Target production core:** v1.4  
**Research authority:** Research Library v1.8 R3 LIVE READ-ONLY  
**Walters source design:** `research/staging/BILLY_WALTERS_SPREAD_BOX_SPEC_2026-08-15.md`

## Purpose

Core 1.4 is the consolidation release built from what production Core 1.3 taught us.

It is not a rewrite and it is not a container for every future Betting Edge idea. It preserves the proven 1.3 execution/identity/freshness/staking/report foundations and replaces a set of reactive patches with cleaner underlying analytical principles.

Working principle:

> **1.3 was the system we learned with. 1.4 is the system built from what we learned.**

For each production patch or failure case, Core 1.4 should preserve the lesson rather than mechanically preserve the patch.

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

Every serious candidate must distinguish:

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

Extreme prices, thin competitions and fragile derivative markets receive wider uncertainty treatment where the approved research or current market structure supports it. There is no arbitrary American-odds cutoff.

## 1.6 Exact-market calibration awareness

Mechanism knowledge and sportsbook price calibration are separate layers. Examples:

- MLB doubles and stolen-base mechanics can be modeled without pretending direct closing-price calibration exists;
- WNBA player props do not inherit NBA prop calibration;
- NFL player props do not inherit NFL game-market calibration;
- boxing derivatives do not inherit fight-winner confidence;
- CFL pregame does not automatically inherit NFL calibration.

## 1.7 Personnel uncertainty inside the handicap

Stage 1 / Stage 2 personnel work remains operational, but Core 1.4 incorporates the analytical lesson directly: unresolved participation, batting order, starter, role, minutes or effectiveness uncertainty can widen the candidate distribution/model-error state.

Personnel evidence remains current evidence, not historical Research Library evidence.

## 1.8 Movement interpretation

Market movement remains relevant current evidence but is not synonymous with sharp/informed action. Order flow, demand, inventory and information can all move prices. Movement alone cannot become an independent handicap signal.

## 1.9 WAIT as a real analytical state

Carry forward the principle behind the current WAIT publication gate:

> WAIT means a genuinely live candidate that could become materially closer to actionable if a named blocker resolves.

A sportsbook outlier, book gap, no-vig residual, stale comparison or unresolved personnel fact alone does not earn WAIT. The core model-error/fair-value layer should make this behavior natural rather than relying only on a late publication backstop.

## 1.10 Research Library v1.8 as controlled calibration knowledge

Core 1.4 may use a fixed, approved allowlist of v1.8 findings to raise uncertainty/model-error floors or enforce transportability/calibration boundaries.

Runtime History Fit grades do not control Core 1.4. The Research Library remains versioned and independently governed.

## 1.11 Walters Intelligence Access Layer — REQUIRED 1.4 CAPABILITY

Core 1.4 must expose a stable interface for Billy Walters-derived intelligence.

Initial focus is NFL point-spread handicapping using the already-defined workflow:

- neutral-field power ratings;
- incremental rating changes;
- player/injury point values and cluster effects;
- home-field calibration;
- rest/travel/weather/venue/situational factors;
- transparent fair-spread arithmetic;
- NFL key-number context;
- spread-versus-moneyline comparison;
- line-shopping/execution context.

The canonical interface is `core/walters-intelligence-interface-v1.4.json`.

### Initial 1.4 Walters authority

Walters is **available intelligence, not automatic betting authority** in the first 1.4 release.

It may:

- provide a separately identified predicted spread / fair-spread build;
- provide power-rating, personnel and situational factor context;
- provide key-number and spread-vs-moneyline context when the required source logic is available;
- be compared with the Core 1.4 fair value and current market;
- be recorded as `ALIGNED`, `MIXED`, `CONFLICT`, or `UNAVAILABLE` relative to the core;
- trigger explicit re-review when material disagreement exists;
- be preserved in provenance for later calibration of whether/how much weight it deserves.

It may **not initially**:

- create a BET;
- count as an automatic independent current signal;
- directly overwrite the Core 1.4 fair-value point estimate;
- lower the model-error floor;
- set `playTo` or stake;
- override identity, freshness, personnel or exposure gates;
- turn historical Walters factor tables into permanent numerical constants without current calibration.

Any future promotion of Walters from advisory/context into a weighted core-model input requires a separate tested activation with explicit weighting/calibration rules.

### Page 270 / spread-versus-moneyline correction

The previously identified Page 270 Moneyline-vs-Spread anomaly/correction must be treated as part of Walters source provenance. Core 1.4 must not use an unverified or internally inconsistent historical chart. If the corrected conversion logic cannot be resolved from the approved/user-supplied source package, the interface must return `SPREAD_VS_ML_UNAVAILABLE` rather than guess.

---

# 2. Explicitly NOT part of Core 1.4

The following are consciously deferred and must not block the 1.4 promotion:

1. **Results / CLV feedback learning loop** — later observation/calibration work.
2. **Shadow History activation** — S-track remains separate/inactive until separately designed and approved.
3. **Learned player/team associations and personal-ledger calibration** — later secondary learning/context work.

Also excluded from the 1.4 scope:

- new paid odds subscriptions;
- new execution books;
- higher odds/API request volume;
- staking-methodology changes;
- report-lane/schedule changes;
- broad UI redesign;
- automatic Research Library writes during reports;
- automatic Walters weighting before calibration.

---

# 3. 1.3 lesson → 1.4 solution matrix

| 1.3 production lesson | Clean 1.4 solution | Regression requirement |
|---|---|---|
| Two-book no-vig looked more precise than it was | Explicit `fairValueBasis` | Market-derived-only case cannot behave like independent model |
| Large book splits generated apparent edge | Material dispersion raises model-error floor | +long-price / large-split regression |
| WAIT drifted toward book-gap longshots | Model-error + independent-support rules underneath WAIT | Longshot market-only case fails; strong-model longshot survives |
| Thin soccer derivatives were hard to trust | Liquidity/transportability state | Thin + dispersed soccer case HIGH |
| Player-prop evidence transported too broadly | Exact-market `directCalibration` boundary | WNBA/NFL/MLB rare-prop tests |
| Lineup/role uncertainty lived too far outside fair-value confidence | Personnel sensitivity contributes to uncertainty | Unresolved role/lineup raises floor |
| Movement language could imply sharp proof | Movement/order-flow separation | Movement-primary case cannot count as independent support |
| Research was descriptive only | Fixed v1.8 allowlist may raise model-error floor | Research can raise, never lower, first-release floor |
| Stage 2 and WAIT required late machine patches | Core carries their analytical principles earlier | Publication gates remain backstops, not primary intelligence |
| Walters work existed as a separate staging design | Stable Walters input interface inside 1.4 | Full / unavailable / conflicting Walters interface cases |

---

# 4. Core 1.4 build sequence

## Gate A — Scope and interfaces

- freeze this consolidation plan;
- validate the model-error R1 candidate as the 1.4 uncertainty foundation;
- create and validate the Walters Intelligence interface;
- define structured per-candidate provenance fields.

## Gate B — Production integration candidate

- create Core 1.4 machine-readable configuration from the tested R1 framework plus the Walters interface reference;
- add structured model-error/fair-value-basis evidence to new sidecars;
- add Walters availability/comparison evidence where applicable;
- keep all historical reports immutable;
- preserve publication Stage 2 and WAIT gates as safety backstops.

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
- Walters available/aligned;
- Walters available/conflicting;
- Walters unavailable;
- Walters spread-vs-moneyline conversion unavailable.

## Gate D — Promotion

Promote only after:

- regression PASS;
- production provenance can record Core 1.4 framework identity;
- future reports resolve Core 1.4 before handicapping;
- the governance boundary explicitly permits the one-way v1.8 model-error influence and Walters advisory access;
- no staking, schedule, book or API-budget regression occurs.

The first eligible post-cutover lane becomes the initial Core 1.4 live observation. Historical Core 1.3 reports remain immutable.

---

# 5. Promotion success definition

Core 1.4 is successful when it behaves like a cleaner version of the system we already trust:

- fewer ad-hoc exceptions;
- clearer distinction between fair value and confidence in fair value;
- less false precision in fragile markets;
- personnel uncertainty affects the handicap coherently;
- research affects uncertainty only through approved rules;
- Walters intelligence is immediately accessible and auditable without being given unearned authority;
- all proven hard execution safeguards survive unchanged.

# Betting Edge Core 1.3 — Handicap / Model-Error Framework R1

**State:** STAGING CANDIDATE — NOT RUNTIME AUTHORITY  
**Core family:** 1.3  
**Candidate:** `core-1.3-model-error-r1-2026-08-25`  
**Research basis:** Production Research Library v1.8 R3 live read-only

## Purpose

This is the first controlled step toward moving approved research findings out of a purely descriptive History Fit role and into the Betting Edge core handicap/model-error framework.

The R1 design is deliberately one-way:

> approved research may raise the model-error floor or prevent false precision; it may not lower the model-error floor, directly change the fair-value point estimate, manufacture independent current evidence, create a BET, or set stake.

That boundary is intentional. The immediate production problem was not that Betting Edge lacked enough reasons to make bets. It was that thin, dispersed and poorly calibrated markets could look artificially precise because a two-book/no-vig calculation produced a positive residual.

## Core classifications

Every serious candidate is described along these dimensions:

- `fairValueBasis`
  - `INDEPENDENT_MODEL`
  - `MARKET_ANCHORED_MODEL`
  - `MARKET_DERIVED_ONLY`
  - `UNAVAILABLE`
- `bookDispersion`
  - `NONE`
  - `MODERATE`
  - `MATERIAL`
- `liquidityRisk`
  - `NORMAL`
  - `THIN`
  - `UNKNOWN`
- `tailRisk`
  - `NORMAL`
  - `ELEVATED`
  - `EXTREME`
- `directCalibration`
  - `DIRECT`
  - `LIMITED`
  - `GAP`
  - `UNKNOWN`
- `personnelSensitivity`
  - `NONE`
  - `RESOLVED`
  - `UNRESOLVED`
- `independentCurrentSupport`
  - `NONE`
  - `WEAK`
  - `MODERATE`
  - `STRONG`

These inputs produce a model-error state:

1. `STANDARD`
2. `ELEVATED`
3. `HIGH`
4. `UNQUANTIFIED`

The states are ordered floors, not pseudo-precise percentages. R1 intentionally avoids inventing a universal numerical error margin that the research does not support.

## Why no fixed percentage yet

Research Library v1.8 contains strong evidence about market structure, transportability, prop-specific mechanisms and direct-calibration gaps. It does **not** provide one defensible cross-sport statement such as “add exactly 3.2 probability points of error to every thin prop.”

A fixed percentage would therefore recreate the same problem this framework is meant to solve: false precision.

R1 instead makes model error explicit and consistent. Later local calibration / Shadow work can justify numeric ranges by sport and market family if the data support them.

## First graduated research findings

R1 uses a fixed allowlist from v1.8. Runtime History Fit grades do not control the core.

The initial graduated findings cover:

- extreme-longshot fixed-odds caution;
- soccer liquidity and price-dispersion caution;
- bookmaker order flow versus informed-move interpretation;
- failure of a universal MLB prop recalibration on forward holdout;
- WNBA player-prop direct-calibration gap;
- NFL player-prop direct-calibration gap;
- MLB doubles/stolen-base direct-price calibration gap;
- boxing derivative calibration gap;
- CFL pregame calibration gap;
- era-sensitive WNBA game-market evidence.

The exact allowlist and rule conditions are machine-readable in `core-handicap-framework-v1.3-r1.json`.

## Decision meaning

### STANDARD

Normal Core 1.3 process. A serious candidate still needs a defensible uncertainty range and all ordinary Betting Edge gates.

### ELEVATED

A wider uncertainty allowance is required. At least moderate independent current support is required before model error itself permits BET consideration. A market-derived-only case with weak/no independent current support is blocked from BET.

### HIGH

The candidate is fragile enough that only strong independent current support plus conservative-bound clearance can pass the model-error layer. Market-derived-only fair construction is blocked from BET. WAIT remains appropriate only when a real actionable blocker exists and the underlying handicap already has at least moderate independent current support.

### UNQUANTIFIED

The core cannot responsibly bound the error. BET is blocked and the threshold remains unavailable until the missing model/fair-value information is resolved.

## Relationship to the new WAIT rule

The recent WAIT publication gate is a safety backstop. This framework is the more fundamental analytical layer underneath it.

Under R1, a +800 or +1200 candidate is not rejected simply because of its American odds. Instead the core asks:

- Is the fair value independently modeled or merely de-vigged from the same books?
- Are the books materially dispersed?
- Is the exact market well calibrated or a known gap?
- Is the market thin?
- Is there real independent current support?

A longshot with a strong independent model can survive the model-error layer. A longshot whose apparent edge is mostly a book disagreement cannot.

## Production examples represented in the regression suite

The test suite includes shapes based on the production drift seen on 2026-08-25:

- an extreme-tail soccer/book-gap case;
- a thin soccer derivative with material dispersion;
- a WNBA three-point prop with direct-calibration gap;
- an MLB doubles prop with a market-derived fair and large book gap;
- an MLB doubles prop with a genuinely strong independent model;
- an NFL prop with mechanism support but direct-price calibration gap.

The goal is to distinguish these cases analytically rather than add another arbitrary American-odds cutoff.

## Promotion boundary

R1 is not yet live. Promotion requires:

1. framework structural/self-test PASS;
2. review of the regression cases against recent issued reports;
3. confirmation that research only raises uncertainty in this first phase;
4. explicit integration into production contract/report sequence;
5. forward-only provenance/publication support so historical reports remain immutable.

No runner UI, staking rule, odds-refresh rule, book list, schedule, or Research Library version changes merely because this candidate exists.

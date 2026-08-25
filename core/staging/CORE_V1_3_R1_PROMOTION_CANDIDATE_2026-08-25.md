# Betting Edge Core 1.3 — Model-Error Framework R1 Promotion Candidate

**Date:** 2026-08-25  
**Framework:** `core-1.3-model-error-r1-2026-08-25`  
**State:** READY FOR EXPLICIT PRODUCTION INTEGRATION — NOT YET RUNTIME AUTHORITY  
**Research authority:** Research Library v1.8 R3 live read-only

## Candidate result

The first research-to-core graduation pass is complete as a staging candidate.

R1 introduces four ordered model-error states:

- STANDARD
- ELEVATED
- HIGH
- UNQUANTIFIED

The first phase is one-way only: approved fixed research findings may raise the model-error floor or prevent false precision. They may not lower model error, directly change the fair-value point estimate, create current independent support, create a BET, or set stake.

## Automated validation

GitHub Actions workflow `Core 1.3 model-error framework R1` run `32912475003` completed successfully on 2026-08-25.

Validated:

- candidate JSON parses;
- active Research Library is v1.8;
- pinned Research Library and manifest Git blob SHAs match;
- every graduated research prior resolves in the active v1.8 library;
- model-error state ordering is valid;
- first-phase research boundaries prohibit model-error compression and fair-value movement;
- all 14 regression cases pass.

## Regression coverage

The 14-case suite includes:

- mainstream MLB moneyline with independent current model;
- market-derived-only fair value with weak support;
- extreme-tail market-only/book-gap case;
- thin soccer derivative with material dispersion;
- WNBA player-prop calibration gap with and without material dispersion;
- NFL player-prop calibration gap;
- MLB doubles market-only drift shape;
- MLB doubles with a genuinely strong independent model;
- fair-value unavailable / unquantified state;
- boxing derivative gap;
- CFL pregame gap;
- order-flow/movement-primary evidence;
- college-football direct evidence that does not automatically compress model error.

## 15:15 shadow result

`core/staging/CORE_V1_3_R1_SHADOW_2026-08-25_1515.md` applies R1 to the immutable 15:15 report.

Key result:

- Brian Navarreto doubles: HIGH model error; market-only/book-gap thesis blocked.
- Kelsey Plum threes: HIGH; book disagreement and WNBA prop calibration gap prevent ordinary confidence.
- Luis Lara stolen base: HIGH; +1000/+750 dispersion is not independent support.
- Awak Kuier threes: ELEVATED; role context alone is not independent price-edge support.
- Alek Thomas doubles: HIGH; identity remains a higher-order hard gate and exact doubles calibration is a gap.

The framework therefore addresses the observed WAIT drift without adding an arbitrary American-odds cutoff.

## Production integration still required

R1 is intentionally not active merely because the tests passed. Production integration should be a separate forward-only step that:

1. makes the framework an explicit Core 1.3 analytical dependency in the production report sequence;
2. records the exact framework path/blob in new report provenance;
3. records each recommendation's fair-value basis and model-error state in structured sidecar evidence;
4. leaves historical issued reports immutable;
5. preserves current staking, books, freshness, scheduling, Research Library R3 boundaries and runner presentation.

The production contract remains authoritative until that integration is deliberately made.

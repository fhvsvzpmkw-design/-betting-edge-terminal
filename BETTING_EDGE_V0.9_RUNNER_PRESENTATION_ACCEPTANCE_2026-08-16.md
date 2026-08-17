# Betting Edge v0.9 — Runner Presentation Acceptance — 2026-08-16

**Status:** ACCEPTED — PRESENTATION-ONLY RUNNER WRAPPER  
**Production contract:** `BETTING_EDGE_CONTRACT.md` v0.9 OPERATIONAL  
**Terminal/UI family:** v1.3  
**Deployment commit:** `0ec8c45f0e938bb365a0432547dd1d2d5cb6c764`

## Scope

This acceptance records the approved addition of the VigWire Labs V2 second splash screen to the existing short-link boot sequence.

Boot order on every short-link refresh:

1. existing `r.html` VigScope splash;
2. `runner.html` presentation wrapper displaying `assets/splash-02-vigwire-labs-v2.webp`;
3. preserved v1.3 runner logic in `runner-core.html`;
4. VigScope Terminal UI v1.3.

## Runner continuity

The pre-deployment production `runner.html` blob was:

`bdb023355bacf89fc0fcf8006f8a50cf4b1f5f2a`

The deployed `runner-core.html` blob is exactly:

`bdb023355bacf89fc0fcf8006f8a50cf4b1f5f2a`

Therefore the runner application logic used before this presentation deployment is preserved byte-for-byte under `runner-core.html`.

The new `runner.html` is a thin presentation wrapper only. Its production blob is:

`4e49a302d4538e83ea4804a64d6cbeb4744b7869`

The locked Screen 2 asset is:

`assets/splash-02-vigwire-labs-v2.webp`  
Git blob: `515341e1e288bd6c25895cc37226c683891f8239`

## Contract boundary check

The deployment does not modify:

- `BETTING_EDGE_CONTRACT.md` or Contract 0.9 rules;
- report-generation logic;
- recommendation status, fair value, `playTo`, stake, or risk rules;
- executable-price freshness or identity gates;
- `data/live-odds.json` or the odds-refresh workflow;
- scheduler/canary workflows;
- issued report payloads, `run-history.json`, or durable-history semantics;
- Research Library production/staging behavior;
- browser history/storage keys;
- repricing logic contained in the preserved v1.3 runner core.

The deployment changes only the user-facing boot presentation before the preserved v1.3 runner core is revealed.

## Preflight interpretation

For Contract 0.9 section 3, `runner.html` remains the production runner entry point and is approved as the v1.3 presentation wrapper. The expected v1.3 runner behavior is supplied by the byte-identical preserved `runner-core.html` noted above.

A production preflight resolving the current `runner.html` may therefore treat this wrapper + preserved core pair as the approved v1.3 runner surface for this deployment.

## Result

**PASS — APPROVED FOR PRODUCTION PRESENTATION USE UNDER CONTRACT 0.9.**

This acceptance does not promote a new terminal version and does not amend Contract 0.9. Terminal/UI version remains **v1.3**.

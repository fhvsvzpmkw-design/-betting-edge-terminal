# Betting Edge v0.9 — Runner Presentation Acceptance — 2026-08-16

**Status:** ACCEPTED — PRESENTATION-ONLY RUNNER WRAPPER  
**Production contract:** `BETTING_EDGE_CONTRACT.md` v0.9 OPERATIONAL  
**Terminal/UI family:** v1.3  
**Current production wrapper blob:** `b2b328c12cc70f887667ca90eef11d453e188287`

## Scope

This acceptance records the approved VigWire Labs V2 second splash screen and its Safari visibility hardening in the existing short-link boot sequence.

Boot order on every short-link refresh:

1. existing `r.html` VigScope splash;
2. `runner.html` presentation wrapper displaying `assets/splash-02-vigwire-labs-v2.webp`;
3. preserved v1.3 runner logic in `runner-core.html`;
4. VigScope Terminal UI v1.3.

## Runner continuity

The pre-presentation production `runner.html` blob was:

`bdb023355bacf89fc0fcf8006f8a50cf4b1f5f2a`

The deployed `runner-core.html` blob remains exactly:

`bdb023355bacf89fc0fcf8006f8a50cf4b1f5f2a`

Therefore the runner application logic used before the presentation deployment remains preserved byte-for-byte under `runner-core.html`.

The current `runner.html` is a thin presentation wrapper only. Its production blob is:

`b2b328c12cc70f887667ca90eef11d453e188287`

The locked Screen 2 asset remains:

`assets/splash-02-vigwire-labs-v2.webp`  
Git blob: `515341e1e288bd6c25895cc37226c683891f8239`

## Safari paint-gate revision

A live Safari refresh showed that the first wrapper implementation could reach the terminal without visibly presenting Screen 2. The presentation wrapper was therefore hardened without changing runner-core behavior.

Screen 2 now cannot advance until:

1. the Screen 2 image has loaded and, where supported, decoded;
2. the wrapper iframe is actually visible after Screen 1;
3. two browser paint frames have completed;
4. the full Screen 2 display window has elapsed; and
5. the preserved runner core has loaded.

The Screen 2 minimum display window is **3000 ms**, beginning only after the paint gate. If the artwork asset fails, the wrapper shows an explicit VigWire Labs fallback instead of silently bypassing Screen 2.

## Contract boundary check

This revision does not modify:

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

The revision changes only the user-facing timing/paint gate before the preserved v1.3 runner core is revealed.

## Preflight interpretation

For Contract 0.9 section 3, `runner.html` remains the production runner entry point and is approved as the v1.3 presentation wrapper. The expected v1.3 runner behavior is supplied by the byte-identical preserved `runner-core.html` noted above.

A production preflight resolving the current `runner.html` may treat this wrapper + preserved core pair as the approved v1.3 runner surface.

## Result

**PASS — APPROVED FOR PRODUCTION PRESENTATION USE UNDER CONTRACT 0.9.**

This acceptance does not promote a new terminal version and does not amend Contract 0.9. Terminal/UI version remains **v1.3**.
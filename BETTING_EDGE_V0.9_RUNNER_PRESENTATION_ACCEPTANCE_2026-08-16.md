# Betting Edge v0.9 — Runner Presentation Acceptance — 2026-08-16

**Status:** ACCEPTED — PRESENTATION-ONLY RUNNER WRAPPER  
**Production contract:** `BETTING_EDGE_CONTRACT.md` v0.9 OPERATIONAL  
**Terminal/UI family:** v1.3  

## Scope

The short-link boot sequence is intentionally simple and presentation-only:

1. existing `r.html` VigScope splash;
2. `runner.html` displays the repository-local VigWire Labs V2V2 PNG for about three seconds;
3. unchanged v1.3 application logic runs from `runner-core.html`;
4. VigScope Terminal UI v1.3 is revealed.

Screen 1, report resolution, report payloads and Betting Edge analysis are outside this presentation wrapper.

## Runner continuity

The pre-presentation runner application remains preserved in `runner-core.html`. `runner.html` is only a thin display wrapper and must not contain Betting Edge recommendation, pricing, history or repricing logic.

Approved Screen 2 asset:

`assets/splash-02-vigwire-labs-v2v2.png`

The asset is loaded from the same repository/site as the runner. No remote image host, immutable raw-GitHub asset URL or separate splash delivery service is required.

## Display behavior

Screen 2 has only three responsibilities:

- show the local V2V2 PNG after Screen 1;
- remain visible for approximately 3000 ms;
- reveal `runner-core.html` when the hold has elapsed and the core is ready.

If the PNG fails to render, a minimal loading fallback is shown so the presentation layer cannot trap the user. No duplicate terminal composition is maintained as a second artwork implementation.

## Contract boundary check

This presentation layer does not modify:

- `BETTING_EDGE_CONTRACT.md` or Contract 0.9 rules;
- report-generation or recommendation logic;
- fair value, `playTo`, stake or risk rules;
- executable-price freshness or identity gates;
- `data/live-odds.json` or odds-refresh workflows;
- scheduler/canary workflows;
- issued report payloads, `run-history.json` or durable-history semantics;
- Research Library behavior;
- browser history/storage keys; or
- repricing logic contained in `runner-core.html`.

Splash presentation must remain subordinate to valid report delivery and should not grow into an independent subsystem.

## Result

**PASS — APPROVED SIMPLE TWO-STAGE PRESENTATION UNDER CONTRACT 0.9.**

This acceptance does not promote a new terminal version and does not amend Contract 0.9. Terminal/UI version remains **v1.3**.
# VigScope Terminal UI v1.4 — Release Record

**Date:** 2026-08-17  
**Release type:** presentation / product-surface minor release  
**Runner:** `runner.html` — **v1.4**  
**Report engine/core:** `runner-core.html` + `index.html` — **v1.3 unchanged**  
**Production governance:** `BETTING_EDGE_CONTRACT.md` — **v0.9 OPERATIONAL unchanged**

## Release basis

UI v1.4 promotes the known-good v1.3.2 runner after the F5 Syndicates feature family matured into an active product surface. The promotion changed only the four explicit runner version declarations from `1.3.2` to `1.4`; no runner behavior was rewritten as part of the version bump.

Rollback point before promotion: runner blob `80dabd9085a002c1e9088ad3b684e9add732ca25`.

Promotion commit: `26bf385e46adc54607a99a7c097c3c7a7df4ee33`.

## Headline v1.4 capability — F5 Syndicates

F5 loads a dedicated Syndicate workspace inside the terminal. The workspace is driven by external `data/syndicates.json`, so profile identity, headshots, display labels, status, accents and linked feed pages can evolve without rebuilding the report engine.

### Durable architecture: slots, not fixed personalities

The durable v1.4 product feature is **four configurable Syndicate slots**. The personalities loaded into those slots are build content, not permanent runner architecture. A future build may rename, restyle, replace or repurpose any slot through the external manifest and linked feed assets without requiring a runner-version change solely because the personality changed.

The current four active presentation identities are:

- **Eddie “Muddy” Numbers / Muddy’s Number** — modern cutting-edge Vegas sportsbook presentation and straight Betting Edge retelling.
- **Larry Lombardo** — deliberately retro personal-site / GeoCities-style reaction feed.
- **Bill Weston** — private Las Vegas fax/sheet presentation; in the current build, Weston is the personality assigned to Walters-intelligence output.
- **Jesse Bains / The Delphoria Sheet** — Hotel Delphoria underground sporting newspaper/backroom presentation.

The current Weston assignment does not permanently bind a named character or a numbered slot to Walters intelligence. If a future build changes that persona, the Walters-specialist role may be deliberately reassigned while preserving the same separation between Walters output and ordinary Syndicate presentation.

All Syndicate personalities are presentation layers. They do not independently change Betting Edge recommendation authority, executable-price rules, fair-value rules, stake semantics, archive schemas or issued-report immutability.

## Preserved v1.3.1 / v1.3.2 presentation work

v1.4 retains the accepted responsive runner hierarchy that preceded the Syndicate release:

- F1–F4 remain directly beneath the terminal header;
- the duplicated upper Bankroll/New Risk/Bet/Lean/Wait-Pass strip remains removed;
- bankroll remains a compact header readout;
- New Risk remains nested inside the BET counter;
- iPad/iPhone responsive navigation behavior remains intact;
- F5 Syndicates remains a separate presentation workspace rather than a report-engine rewrite.

## Explicit non-changes

This release does **not** change:

- report engine/core v1.3;
- Contract v0.9 operational authority;
- Research Library production authority;
- odds-refresh workflow or API budget;
- scheduler/canary behavior;
- five report-lane model;
- durable history or provenance schemas;
- repricing semantics;
- BET / LEAN / WAIT / PASS definitions;
- stake/risk rules;
- issued payload structure or immutability.

## Versioning rule

Runner presentation versions may advance independently from engine/core and governance versions. A future UI release must not be interpreted as an engine or contract promotion unless those components are separately changed, tested and explicitly promoted.

Changing Syndicate names, artwork, presentation themes or linked feed content through the external configuration is ordinary content/configuration work and does not by itself require a runner version increase.

## Verification expectation

After deployment, verify:

1. splash transitions normally into the runner;
2. terminal header reports **VIGSCOPE TERMINAL UI v1.4**;
3. F1–F4 continue to function normally;
4. F5 loads and disconnects the Syndicate workspace normally;
5. all four configured Syndicate tabs load from the external manifest;
6. report display, repricing and history behavior remain unchanged outside Syndicate mode.

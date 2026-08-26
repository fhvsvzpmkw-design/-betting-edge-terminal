# Betting Edge Core v1.4 — Production Closeout

**Date:** 2026-08-25  
**Timezone:** America/Vancouver  
**State:** OPERATIONAL — production integration closed  
**Forward cutover:** 2026-08-25T17:20:00-07:00

## Production authority

Core v1.4 is the current Betting Edge report-engine authority under **Betting Edge Contract v1.0 OPERATIONAL** and **VigScope Terminal UI v1.5**.

Authoritative production files:

- `core/core-v1.4-production.json`
- `core/core-handicap-framework-v1.4.json`
- `core/walters-intelligence-interface-v1.4.json`
- `core/walters-authority-v1.4.json`
- `BETTING_EDGE_PERSONNEL_SWEEP.md`
- `research/manifest.json` / Research Library v1.8 R3 live read-only
- `data/history/report-provenance-schema.json` schema 3
- `tools/core-v14-publication-gate.mjs`

Walters launched in switchable `BET_AUTHORITY` mode for eligible NFL spread and moneyline markets. Walters may originate a candidate only when its handicap is complete/current/auditable and the resulting recommendation passes all ordinary Core v1.4 execution, model-error, personnel, price, playTo, exposure and staking gates.

## What Core v1.4 changed

Core v1.4 preserves the proven v1.3 execution baseline while adding explicit production control for:

1. fair-value basis classification;
2. model-error state (`STANDARD`, `ELEVATED`, `HIGH`, `UNQUANTIFIED`);
3. fixed Research Library v1.8 uncertainty-graduation rules;
4. Stage 2 personnel sensitivity and re-handicapping when material;
5. tighter WAIT qualification requiring independent current support and a plausible path to action;
6. switchable Walters authority with exact report provenance;
7. machine-recomputed `coreAssessment` and `waltersEvidence` on post-cutover recommendations.

Core v1.4 does **not** loosen identity, freshness, pricing, staking or risk requirements.

## First production issuance

The first post-cutover production report was:

- report: `data/history/runs/2026-08-25/late-182223.json`
- sidecar: `data/history/research-fit/2026-08-25/late-182223.json`
- report time: 2026-08-25T18:22:23.515-07:00
- feed generated: 2026-08-26T01:08:37.018Z
- result: **BET 0 / LEAN 0 / WAIT 0 / PASS 6 / risk $0**

The report demonstrated the intended Core v1.4 behavior: market-derived fair values, major supported-book disagreement, direct-calibration gaps and weak/no independent support were not allowed to masquerade as actionable edge. The exact Kelsey Plum under 1.5 threes continuation moved from the earlier Core v1.3 WAIT to Core v1.4 PASS under the new model-error/actionability rules.

The matching schema-3 sidecar records exact Contract, runner, feed, Research v1.8, Core v1.4 framework and Walters authority provenance. Post-publication Core v1.4/history verification passed.

## Presentation target

Scheduled report lanes now target **up to nine meaningful cards**. Nine is a review/presentation target, not a betting quota. A report may contain fewer than nine cards and may contain zero BETs. Weak selections must not be retained or manufactured merely to fill the board.

Pizza Plays remains downstream of VigScope. If the qualifying VigScope board contains no suitable play, Pizza Plays may correctly publish no selection rather than force a longshot or low-quality candidate.

## Scheduling boundary

Core v1.4 does not own the clock. Seasonal report timing remains controlled by `data/schedule-profiles.json` and `data/schedule-state.json` with a five-primary-pull daily cap.

The current MLB/Summer sequence is:

- 05:50 odds → 06:00 report
- 07:50 odds → 08:00 report
- 09:20 odds → 09:30 report
- 15:05 odds → 15:15 report
- 18:05 odds → 18:15 report

Cloudflare remains the primary odds scheduler. After a missed 18:05 dispatch on 2026-08-25, `.github/workflows/odds-refresh-backstop.yml` was added as a two-minute GitHub backstop. It checks whether the canonical slot already published and dispatches the existing protected odds-refresh workflow only when the slot is missing. This is infrastructure protection, not a Core v1.4 methodology change. The first live backstop proof remains pending the next due slot.

## Separate scheduled products

- Result Closure remains a separate 05:00 audit layer. It can grade legacy Core v1.3 and current Core v1.4 issued cards but must never mutate the issued report, Core assessment, Walters evidence or schema-3 provenance.
- Crypto Specials remains a separate editorial/research pipeline. It does not run Core v1.4, Walters authority or VigScope publication gates. Its daily schedule is 10:30 America/Vancouver to avoid seasonal report-time collisions.

## Explicitly deferred beyond Core v1.4

The following remain outside this production closeout:

- results / CLV feedback learning loop;
- Shadow History activation;
- learned player/team association layer;
- personal-ledger calibration;
- paid odds sources or additional execution books;
- staking-methodology changes.

These require separate design/promotion and must not be slipped into Core v1.4 maintenance.

## Closeout rule

Core v1.4 is now the forward production baseline. Historical Core v1.3 reports remain immutable evidence. Future fixes should first identify whether the issue belongs to Core, scheduling, odds transport, UI, Research, personnel verification, history, or a separate desk before changing the Core version.

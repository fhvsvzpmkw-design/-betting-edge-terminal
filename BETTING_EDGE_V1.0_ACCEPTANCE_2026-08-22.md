# Betting Edge v1.0 Production Promotion Acceptance — 2026-08-22

**Status:** ACCEPTED FOR CONTROLLED PRODUCTION PROMOTION  
**Promotion type:** governance/version consolidation; no new betting methodology  
**Repository:** `fhvsvzpmkw-design/-betting-edge-terminal`  
**Branch:** `main`  
**Production contract:** Betting Edge Contract v1.0  
**Presentation release:** VigScope Terminal UI v1.5  
**Report engine/core:** v1.3 — unchanged  
**Research Library:** v1.7 — unchanged

This record authorizes the deliberate promotion of the final operational v0.9 governance state to Contract v1.0 and the declaration of the accumulated presentation surface as VigScope Terminal UI v1.5. It is a consolidation boundary, not a change to the Betting Edge handicapping or staking philosophy.

---

## Exact rollback boundary

Immediately before this promotion:

- authoritative `main` commit: `9de8bf2b5a6e95dc2545fa8011f493d46aedc93f`;
- final v0.9 `BETTING_EDGE_CONTRACT.md` blob: `59d8dda8d8e491255d5792329a9446eb01960a34`;
- VigScope UI v1.4 `runner.html` blob: `999a1e00261cb05b9b5045bda1285310df168efb`;
- report engine/core v1.3 `runner-core.html` blob: `d2dc6dda3c9c7fd2512c51478df641ffc17fe9a2`;
- core `index.html` blob: `fe666b38267c4711186e9075562aace168d63b56`;
- Research Library v1.7 manifest blob: `2dfd959ef73bb77f3c61a892657de5f49908e473`;
- report provenance schema-3 blob: `5955aa8840b154007ca3fb20d9f0edd5e75f41f5`.

Git history remains the authoritative rollback system. No historical v0.8/v0.9 draft, preflight, acceptance, issued report or sidecar is relabeled or rewritten by this promotion.

---

## Promoted boundary

The promoted production identities are:

- `BETTING_EDGE_CONTRACT.md` — **v1.0 OPERATIONAL**, blob `815a511301bd7a5aa3770baf0e32a00a28e2f548`;
- `runner.html` — **VigScope Terminal UI v1.5**, blob `8d3dd16e1f77c415e267064d6ced3ceec371dc29`;
- `runner-core.html` / `index.html` — **report engine/core v1.3**, unchanged;
- `research/manifest.json` — Research Library **v1.7**, production compatibility advanced to Contract v1.0;
- `data/history/report-provenance-schema.json` — schema remains **3**, with new sidecars requiring Contract v1.0 provenance and historical v0.9 schema-3 sidecars remaining valid.

Hotline shells retain independent shell versions and are not renumbered by the terminal or governance promotion.

---

## What v1.0 consolidates

Contract v1.0 formalizes the operating rule set already proven under final v0.9, including:

- inherited execution, pricing, freshness, status, staking and risk gates;
- durable issued-report history and provenance;
- exact player-prop identity;
- fair-value benchmark confidence/labeling;
- spread-lineage reconciliation when a tracked spread disappears;
- PRICE WATCH as informational PASS metadata only;
- repository-controlled report-card soft target;
- the existing five report lanes and existing odds-refresh budget boundary.

The v1.0 contract does **not** add a sportsbook, raise risk tolerance, change staking methodology, activate Shadow History, promote Research Library v1.8, increase Odds-API request volume, change the five-lane schedule, or change the report engine/core version.

---

## Regression / equivalence declaration

The production promotion is accepted only on the following equivalence basis:

1. `BET`, `LEAN`, `WAIT`, and `PASS` semantics remain unchanged.
2. Only `BET` may carry non-zero stake; total new risk remains the sum of BET stakes only.
3. Feed freshness remains 75 minutes and exact executable quote freshness remains 30 minutes.
4. Primary executable pricing books remain Bet365 and DraftKings.
5. Fair-value, identity, uncertainty and model-error gates are not loosened.
6. Report payload/history immutability and Reprice-as-overlay behavior remain unchanged.
7. The five production report slots remain `open`, `main`, `final_morning`, `evening`, and `late`.
8. Research Library remains v1.7 read-only and cannot create or directly alter a bet.
9. Contract v1.0 changes the production authority/version identity and new-report provenance expectation, not the outcome of a report when supplied the same valid inputs and analytical conclusions under final v0.9.

The 2026-08-22 `18:15 LATE / WEST COAST` issuance remains immutable Contract v0.9 historical evidence. It is the final same-day v0.9 reference point and is not regenerated merely for the v1.0 promotion.

---

## First post-promotion observation

The first eligible scheduled report after this promotion is to be checked for:

- successful Contract v1.0 / VigScope UI v1.5 preflight;
- normal odds/feed validation;
- unchanged betting decision and staking guardrails;
- exact issued-payload archive;
- schema-3 sidecar carrying the exact v1.0 contract blob SHA;
- `run-history.json` linkage and normal compact-share delivery.

That live observation is post-promotion verification. It is not a prerequisite for the v1.0 file to be authoritative and it is not permission to change the contract silently if the observation exposes a problem; any regression must use normal rollback/change control.

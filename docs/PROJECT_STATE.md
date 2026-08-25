# Betting Edge — Project State

**Last updated:** 2026-08-25 — Research Library v1.8 R3 promotion checkpoint
**Repository:** `fhvsvzpmkw-design/-betting-edge-terminal`  
**Primary branch:** `main`

This file is the practical current-state snapshot. It is not a replacement for `BETTING_EDGE_CONTRACT.md`. Historical implementation detail remains available through Git history, acceptance records and the durable decision/operations documents.

## Current version boundary

- **Production governance:** `BETTING_EDGE_CONTRACT.md` — **v1.0 OPERATIONAL**.
- **Current Contract v1.0 blob:** `8bb1756a573d50d03ef99cd24eedb228d08d7632`.
- **Promotion acceptance:** `BETTING_EDGE_V1.0_ACCEPTANCE_2026-08-22.md`.
- **VigScope presentation:** `runner.html` — **Terminal UI v1.5**.
- **UI v1.5 runner blob at promotion:** `8d3dd16e1f77c415e267064d6ced3ceec371dc29`.
- **Report engine/core:** `runner-core.html` + `index.html` — **v1.3**, unchanged by the v1.0/v1.5 promotion and v1.8 Research Library promotion.
- **Research Library:** **v1.8**, R3 live read-only production authority.
- **Research inventory:** **130 logical items / 108 sources / 30 evidence clusters**.
- **Report provenance:** schema **3**; new reports record Contract v1.0 provenance and active Research Library version, historical sidecars remain immutable.
- **Authoritative rollback system:** Git history.
- **Night-lock checkpoint:** branch `night-lock-2026-08-24` at main commit `1e1551baa6bf5dfc4104ad21e33424969466402b` — historical Contract v1.0 / Terminal UI v1.5 / core v1.3 / Research Library v1.7 checkpoint.

The pre-promotion rollback boundary is main commit `9de8bf2b5a6e95dc2545fa8011f493d46aedc93f`, final Contract v0.9 blob `59d8dda8d8e491255d5792329a9446eb01960a34`, and UI v1.4 runner blob `999a1e00261cb05b9b5045bda1285310df168efb`.

Contract v1.0 is a consolidation of the final proven v0.9 rule set. It did not itself introduce a new sportsbook, staking model, risk tolerance, freshness rule, Odds-API budget, report-engine version or Research Library version. Research Library v1.8 was promoted independently on 2026-08-25 while preserving the Contract v1.0 execution/risk boundary.

## Production report governance

All enabled Betting Edge report automations perform the active schedule-profile gate first and, when the trigger is active, require:

- **Contract v1.0 OPERATIONAL**;
- **VigScope UI v1.5**;
- **Betting Edge core v1.3**;
- Research Library **v1.8 / R3 live read-only** with validation PASS;
- 75-minute live-feed freshness;
- 30-minute executable-quote freshness;
- exact event/market/selection identity;
- exact player-prop identity when applicable;
- fair-value work before BET;
- normal BET / LEAN / WAIT / PASS and stake/risk invariants;
- mandatory Stage 1 / Stage 2 personnel handling where material;
- current WAIT qualification rules requiring a genuinely live candidate rather than a sportsbook outlier alone;
- immutable report + schema-3 sidecar + `run-history.json` publication.

The 2026-08-22 `18:15 LATE / WEST COAST` report remains the final same-day Contract v0.9 issuance and is not rewritten. Historical v1.7-issued reports remain immutable after the v1.8 Research Library promotion.

## Seasonal schedule profiles

Scheduling is controlled by:

- `BETTING_EDGE_SCHEDULE_PROFILE_ADDENDUM.md`;
- `data/schedule-profiles.json`;
- `data/schedule-state.json`.

Canonical lane identity is permanent: `open`, `main`, `final_morning`, `evening`, `late`.

Current profile definitions are:

| Profile | Vancouver pulse → report pairs |
|---|---|
| MLB / SUMMER | 05:45→06:00, 07:45→08:00, 09:15→09:30, 14:55→15:15, 17:55→18:15 |
| NFL / FOOTBALL | 05:45→06:00, 07:45→08:00, 08:45→09:00, 12:00→12:15, 16:45→17:00 |
| NBA + NHL / WINTER | 05:45→06:00, 10:45→11:00, 13:45→14:00, 15:45→16:00, 17:45→18:00 |

`data/schedule-state.json` currently has `defaultProfileId: "mlb"`, no queued selections, and a five-primary-pull daily cap. Alternate report-time automations exist for the other profiles but exit before handicapping/history unless the active profile matches that trigger.

## Odds pipeline

- **Live feed:** `data/live-odds.json`.
- **Primary workflow:** `.github/workflows/odds-refresh.yml`.
- **Primary executable books:** Bet365 and DraftKings.
- **Post-refresh provenance index:** `.github/workflows/odds-history-index.yml` → `data/history/odds-index.json`.
- **Manual fallback:** workflow dispatch when a scheduled active-profile pull is missed or unusable and a fresh pull remains useful.
- **History authority for a report:** the exact odds snapshot bound to that report; prefer exact blob provenance where available.

Stale or non-profile-matching wake-ups must not spend odds quota merely because GitHub dispatched them.

## Durable report history

Issued report payloads are immutable and stored under:

`data/history/runs/YYYY-MM-DD/<slot>-HHMMSS.json`

Research/provenance sidecars are stored under:

`data/history/research-fit/YYYY-MM-DD/<slot>-HHMMSS.json`

`run-history.json` is the compact index/navigation layer. It cannot override an issued payload.

New Contract v1.0 schema-3 sidecars record the exact Contract v1.0 blob SHA resolved before handicapping and the active Research Library version. Historical v0.9 schema-3, v1.7-era schema-3 and older schema-2 sidecars remain valid immutable evidence.

Result/price observations live separately under `data/history/observations/...` and never rewrite the issued decision.

## Runner and repricing

The issued report is immutable. `UPDATE ODDS / REPRICE NOW` remains a client-side comparison overlay.

Current principles:

- exact structured `rec.feed` identity first;
- title/text parsing only as a fail-closed compatibility fallback for older cards;
- a different player-prop line is a different selection;
- a changed spread handicap is a new current selection and requires spread-lineage reconciliation before declaring the old market unavailable;
- repricing cannot silently create a BET, change stake, rewrite fair value or mutate the stored issued report;
- `PRICE WATCH` is informational PASS metadata only, not a fifth status.

## Private ledger and F3 Bet History

The raw master betting ledger is outside the public repository runtime surface.

Current architecture:

**private master ledger → Cloudflare Worker → sanitized `/api/bet-history` projection → F3 Bet History + Eddie Numbers**

The private master is `data/betting-ledger.json` in the private repository `fhvsvzpmkw-design/betting-edge-private`. The public repo no longer treats a raw `data/betting-ledger.json` as the runtime source.

The public projection provides:

- sanitized wager rows;
- exact aggregate cash summary values;
- no private IDs;
- sportsbook reference row field at public row index 2 as null;
- public row index 14 meaning **boosted**, not free bet.

`data/bet-history-public.json` is the sanitized public fallback.

### F3 Bet History

F3 is a public-facing performance/ledger view with tabs:

**SUMMARY | SPORTS | BET TYPES | BOOKS | TIME | LEDGER**

The performance layer distinguishes exact public summary aggregates from row-derived public analytics. It does not infer exact cash/free-bet/bonus cohort membership from sanitized rows.

The current All-In Performance presentation uses a premium gold four-box block for Overall ROI, Promo/Non-Cash Profit, Pregame Single Wagers and All-In Advantage.

## Syndicates and hotline shells

`data/syndicates.json` schema 5 currently defaults to:

1. Eddie Numbers
2. Lou Vega
3. empty
4. empty

Available character profiles include Eddie Numbers, Lou Vega, Larry Lombardo, Bill Weston and Jesse Bains.

Hotline shells have independent versioning and are not renumbered by Contract v1.0 or Terminal UI v1.5.

Current notable shell state:

- **Eddie Numbers:** public Bet History authority; private raw ledger forbidden. Live page reads sanitized public performance information.
- **Lou Vega:** `Vegas by the Slice` **v2** default shell; historical v1 preserved.
- **Larry Lombardo:** `Lizard Line` **v1** with restored original embedded animated-GIF layer and a guardrail test.
- **Bill Weston:** Walters-intelligence presentation boundary; presentation does not replace Betting Edge authority.
- **Jesse Bains:** Hotel Delphoria / Police Quest-inspired character layer, presentation only.

Hotline archives remain immutable per character/date/edition.

## Research Library

Production Research Library is **v1.8** in **R3 live read-only History Fit** mode.

`research/manifest.json` is the production compatibility pointer and records `activeLibraryVersion: "1.8"`, Contract v1.0 compatibility and R3 live read-only runtime state.

Current inventory is:

- **130 logical items**;
- **108 source records**;
- **30 evidence/conflict clusters**;
- **104 primary-prior retrieval items**;
- **25 synthesis items**;
- **1 inference item**.

The v1.8 base candidate had already passed 15/15 narrative History Fit cases and 9/9 hard-boundary cases. The 2026-08-25 R3 gap-closure pass added focused evidence for extreme longshots, soccer liquidity/book dispersion, college football, WNBA game markets and MLB doubles/stolen-base/runs-scored mechanisms while preserving explicit calibration gaps where evidence remains insufficient.

Research Library v1.8 remains read-only. It does not create BETs, count as an extra BET-confirmation vote, provide executable sportsbook prices, override identity/freshness/fair-value gates, or directly rewrite fair value, model error, play-to, status, stake or risk.

Promotion record: `research/V1_8_PROMOTION_2026-08-25.md`. Validation record: `research/tests/V1_8_R3_VALIDATION_2026-08-25.json`.

## Governance tracks

- **C-track:** Contract v1.0 operational.
- **R-track:** R3 — live read-only Research Fit using production Research Library v1.8.
- **H-track:** H3 — live immutable issued-report/provenance history.
- **S-track:** S0 — Shadow History inactive.

Contract v1.0 governs the production execution boundary, including fair-value confidence labeling, spread-lineage reconciliation, PRICE WATCH guardrails, repository-controlled report-card targeting and the operational two-stage personnel-information process. Research Library versions remain independently promoted within that boundary.

## Current rollback / acceptance checkpoints

### 2026-08-15 — Contract v0.9 acceptance

The Evening/Late acceptance pair validated report archive, schema-3 provenance, same-day lineage/navigation and non-mutating repricing before v0.9 promotion.

### 2026-08-16 — same-lane recovery evidence

Evening and Late recovery runs demonstrated that missed report coverage can be restored inside the existing canonical lane without relaxing freshness, identity, fair-value or zero-risk safeguards.

### 2026-08-22 — private-ledger cutover and public projection

Current runtime architecture moved the betting master to the private repository and made the Cloudflare Worker sanitized projection the public F3/Eddie source. Public raw-ledger runtime dependency was removed.

### 2026-08-22 — Contract v1.0 / UI v1.5 consolidation

The final v0.9 governance state was promoted to Contract v1.0, accumulated presentation work was declared VigScope UI v1.5, core stayed v1.3 and Research Library remained v1.7 at that historical checkpoint.

### 2026-08-25 — Research Library v1.8 R3 promotion

The previously tested 120-item v1.8 candidate was reopened after sufficient v1.7 live-production soak. A focused R3 gap-closure pass added 10 logical items, 8 sources and 4 evidence clusters, producing the active 130-item / 108-source / 30-cluster v1.8 library. Validation passed all ID, source, cluster, market-boundary and R3 hard-boundary checks. The active manifest was switched to v1.8 without changing core v1.3, Contract v1.0, supported books, staking/risk rules, report lanes or Odds-API budget.

# Betting Edge — Project State

**Last updated:** 2026-08-24 — VigScope UI v1.5 night-lock checkpoint
**Repository:** `fhvsvzpmkw-design/-betting-edge-terminal`  
**Primary branch:** `main`

This file is the practical current-state snapshot. It is not a replacement for `BETTING_EDGE_CONTRACT.md`. Historical implementation detail remains available through Git history, acceptance records and the durable decision/operations documents.

## Current version boundary

- **Production governance:** `BETTING_EDGE_CONTRACT.md` — **v1.0 OPERATIONAL**.
- **Contract v1.0 blob:** `815a511301bd7a5aa3770baf0e32a00a28e2f548`.
- **Promotion acceptance:** `BETTING_EDGE_V1.0_ACCEPTANCE_2026-08-22.md`.
- **VigScope presentation:** `runner.html` — **Terminal UI v1.5**.
- **UI v1.5 runner blob at promotion:** `8d3dd16e1f77c415e267064d6ced3ceec371dc29`.
- **Report engine/core:** `runner-core.html` + `index.html` — **v1.3**, unchanged by the v1.0/v1.5 promotion.
- **Research Library:** **v1.7**, read-only production authority.
- **Report provenance:** schema **3**; new reports record Contract v1.0 provenance, historical sidecars remain immutable.
- **Authoritative rollback system:** Git history.
- **Night-lock checkpoint:** branch `night-lock-2026-08-24` at main commit `1e1551baa6bf5dfc4104ad21e33424969466402b` — Contract v1.0 / Terminal UI v1.5 / core v1.3 / Research Library v1.7.

The pre-promotion rollback boundary is main commit `9de8bf2b5a6e95dc2545fa8011f493d46aedc93f`, final Contract v0.9 blob `59d8dda8d8e491255d5792329a9446eb01960a34`, and UI v1.4 runner blob `999a1e00261cb05b9b5045bda1285310df168efb`.

Contract v1.0 is a consolidation of the final proven v0.9 rule set. It does not introduce a new sportsbook, staking model, risk tolerance, freshness rule, Odds-API budget, report-engine version or Research Library version.

## Production report governance

All enabled Betting Edge report automations now perform the active schedule-profile gate first and, when the trigger is active, require:

- **Contract v1.0 OPERATIONAL**;
- **VigScope UI v1.5**;
- **Betting Edge core v1.3**;
- Research Library **v1.7** with validation PASS;
- 75-minute live-feed freshness;
- 30-minute executable-quote freshness;
- exact event/market/selection identity;
- exact player-prop identity when applicable;
- fair-value work before BET;
- normal BET / LEAN / WAIT / PASS and stake/risk invariants;
- immutable report + schema-3 sidecar + `run-history.json` publication.

The 2026-08-22 `18:15 LATE / WEST COAST` report remains the final same-day Contract v0.9 issuance and is not rewritten. The first eligible report after the promotion is the live v1.0 observation checkpoint.

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

New Contract v1.0 schema-3 sidecars record the exact Contract v1.0 blob SHA resolved before handicapping. Historical v0.9 schema-3 and older schema-2 sidecars remain valid immutable evidence.

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

The raw master betting ledger is now outside the public repository runtime surface.

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

Production Research Library remains **1.7** in `R1_CANONICAL_READ_ONLY` / R3 live read-only History Fit mode.

The v1.8 candidate remains staging/evaluation only. Its existence does not alter Contract v1.0, production fair value, play-to, status, stake or executable price.

`research/manifest.json` is the production compatibility pointer and now identifies Contract v1.0 compatibility while retaining `activeLibraryVersion: "1.7"`.

## Governance tracks

- **C-track:** Contract v1.0 operational.
- **R-track:** R3 — live read-only Research Fit using production Research Library v1.7.
- **H-track:** H3 — live immutable issued-report/provenance history.
- **S-track:** S0 — Shadow History inactive.

Contract v1.0 formalizes the final v0.9 operating rules already in production, including fair-value confidence labeling, spread-lineage reconciliation, PRICE WATCH guardrails and repository-controlled report-card targeting.

## Current rollback / acceptance checkpoints

### 2026-08-15 — Contract v0.9 acceptance

The Evening/Late acceptance pair validated report archive, schema-3 provenance, same-day lineage/navigation and non-mutating repricing before v0.9 promotion.

### 2026-08-16 — same-lane recovery evidence

Evening and Late recovery runs demonstrated that missed report coverage can be restored inside the existing canonical lane without relaxing freshness, identity, fair-value or zero-risk safeguards.

### 2026-08-22 — private-ledger cutover and public projection

Current runtime architecture moved the betting master to the private repository and made the Cloudflare Worker sanitized projection the public F3/Eddie source. Public raw-ledger runtime dependency was removed.

### 2026-08-22 — Contract v1.0 / UI v1.5 consolidation

The final v0.9 governance state was promoted to Contract v1.0, accumulated presentation work was declared VigScope UI v1.5, core stayed v1.3, Research Library stayed v1.7, and enabled report automations were advanced to the new production boundary.

The next verification point is the first eligible scheduled report under Contract v1.0. Verify successful v1.0/v1.5 preflight, normal feed handling, immutable publication, exact v1.0 sidecar provenance and compact-link delivery before treating the cutover observation as complete.

# Betting Edge — Operations

**Last updated:** 2026-08-22 — Contract v1.0 / VigScope UI v1.5 production cutover

This document is the practical operating runbook. The authoritative betting-governance file is `BETTING_EDGE_CONTRACT.md` **v1.0 OPERATIONAL**. Historical v0.8/v0.9 drafts and v0.9 issued reports remain immutable historical evidence and are not current scheduler authority.

## Production version boundary

Current production identities are:

- **Contract:** `BETTING_EDGE_CONTRACT.md` — v1.0 OPERATIONAL.
- **Presentation:** `runner.html` — VigScope Terminal UI v1.5.
- **Report engine/core:** `runner-core.html` and `index.html` — v1.3.
- **Research Library:** v1.7, read-only production authority.
- **Report provenance schema:** schema 3.
- **Timezone:** `America/Vancouver`.

The version boundary is deliberate. A UI release does not automatically promote the report engine, Research Library or betting methodology.

## Mandatory report gate order

Every scheduled report trigger must run these gates in order:

1. **Schedule profile gate.** Read `BETTING_EDGE_SCHEDULE_PROFILE_ADDENDUM.md`, `data/schedule-profiles.json` and `data/schedule-state.json`. Resolve the active Vancouver profile and confirm that the trigger clock is an active report time for that operating day. If it is not, exit before handicapping and before any history write.
2. **Production contract preflight.** Read `BETTING_EDGE_CONTRACT.md` from `main`, verify Contract **1.0 OPERATIONAL**, and retain the exact contract blob SHA for provenance.
3. **Runner authority.** Resolve `runner.html` and verify VigScope UI **v1.5** with Betting Edge core **v1.3**.
4. **Live-feed validation.** Read `data/live-odds.json`; enforce the contract's 75-minute feed freshness and 30-minute executable-quote freshness, plus exact event/market/selection identity.
5. **Handicap and Research Fit.** Form the independent current handicap first, then apply approved Research Library v1.7 History Fit as a read-only layer.
6. **Payload validation.** Validate status/stake/risk, timestamps, exact `rec.feed` identity, JSON serialization and Base64URL round trip.
7. **Immutable publication.** Store the exact report payload, matching schema-3 sidecar and `run-history.json` entry without rewriting prior reports.
8. **Delivery.** Prefer the deterministic compact `r.html?id=` link after history success; retain the long `runner.html#run=` fallback.

If contract or runner authority fails, stop before analysis and surface exactly:

`PREFLIGHT BLOCK — ANALYSIS NOT STARTED`

If history publication fails after the report itself has already validated, do not rerun odds or handicapping. Deliver the frozen long fallback and surface exactly:

`HISTORY SAVE FAILED — REPORT VALID`

## Schedule profiles

The scheduler retains five canonical lanes: `open`, `main`, `final_morning`, `evening`, and `late`. Clock times move by sports season while canonical lane identity remains stable.

| Profile | Pulse → report pairs, Vancouver |
|---|---|
| MLB / SUMMER | 05:45→06:00, 07:45→08:00, 09:15→09:30, 14:55→15:15, 17:55→18:15 |
| NFL / FOOTBALL | 05:45→06:00, 07:45→08:00, 08:45→09:00, 12:00→12:15, 16:45→17:00 |
| NBA + NHL / WINTER | 05:45→06:00, 10:45→11:00, 13:45→14:00, 15:45→16:00, 17:45→18:00 |

`data/schedule-state.json` currently defaults to the MLB profile. Profile selection is locked for the active Vancouver operating day; switching the terminal display must not change today's schedule.

The ChatGPT production report tasks include the five MLB/Summer clocks plus alternate seasonal trigger clocks. Every trigger performs the profile gate first, so inactive clocks exit without handicapping or writing History. All enabled report tasks now verify **Contract v1.0 / UI v1.5 / core v1.3**.

## Odds refresh

Primary workflow: `.github/workflows/odds-refresh.yml`.

Operational boundaries remain:

- source API: Odds-API.io v3;
- primary executable books: Bet365 and DraftKings;
- maximum five primary profile-matched pulls per Vancouver operating day;
- stale scheduled wake-ups must exit before spending Odds-API quota;
- a manual workflow dispatch is the fallback when a scheduled pull is missed or unusable and a fresh pull still has practical value;
- an invalid refresh must not replace a previously valid live snapshot.

The odds-history workflow `.github/workflows/odds-history-index.yml` is a separate provenance/indexing layer. Failure of that index must not invalidate an already-published good `data/live-odds.json` snapshot or trigger a fresh odds pull by itself.

## Manual odds recovery

Use manual odds recovery only when the active profile's scheduled pulse failed to produce a usable snapshot and a fresh pull still has practical value.

1. Confirm there is not already a fresh valid snapshot for the lane.
2. Confirm the scheduled run is actually missed, failed, stale or unusable.
3. Trigger `Refresh Betting Edge odds` manually if a new pull is required.
4. Confirm the workflow completed and `data/live-odds.json` is valid.
5. Treat odds-history indexing separately.
6. Reprice/open the report only after a genuinely newer valid feed exists.

Do not change the production contract or runner merely to recover an odds pulse.

## Manual report-lane recovery

Report recovery remains inside the original canonical lane; it is not a sixth report session.

- preserve the canonical slot;
- append `— RECOVERY` to the lane label;
- use the actual recovery issue time in Vancouver, never a backdated scheduled time;
- run the same Contract v1.0 schedule/preflight/freshness/identity/fair-value/status/stake/risk gates as a normal report;
- use a fresh odds pull only when one is actually required;
- archive the recovery as a new immutable report plus schema-3 sidecar and `run-history.json` entry;
- never overwrite a missed or earlier genuine issuance;
- zero BETs is a valid recovery result.

The observed 2026-08-16 Evening/Late recovery pair remains historical evidence from Contract v0.9 and is not relabeled.

## Structured identity and repricing

Every newly issued recommendation should preserve the exact structured `rec.feed` identity used for issuance. For player props, exact player, market, side and line identity are mandatory under the contract.

`UPDATE ODDS / REPRICE NOW` is a comparison overlay only. It must not mutate the issued report, silently promote a recommendation, change stake, rewrite fair value or become centrally archived decision-time history.

For a tracked spread whose old handicap disappears, use the Contract v1.0 spread-lineage reconciliation rules before declaring `MARKET UNAVAILABLE`. A changed handicap is a new current selection and does not inherit the prior recommendation's stake or qualification automatically.

`PRICE WATCH` remains informational metadata on a `PASS` only. It is not a fifth status and crossing a watch target during repricing does not create a BET.

## Durable report history

Authoritative issued payload path:

`data/history/runs/YYYY-MM-DD/<slot>-HHMMSS.json`

Research/provenance sidecar path:

`data/history/research-fit/YYYY-MM-DD/<slot>-HHMMSS.json`

`run-history.json` is the compact index/navigation layer; it does not override the stored issued payload.

For new Contract v1.0 reports, schema-3 sidecars record at minimum:

- `productionContractVersion: "1.0"`;
- `productionContractOperational: true`;
- `productionContractPath: "BETTING_EDGE_CONTRACT.md"`;
- exact Contract v1.0 blob SHA resolved before handicapping;
- runner/feed/Research Library provenance where available.

Historical v0.9 schema-3 and earlier schema-2 sidecars remain valid immutable evidence and must not be rewritten merely to show the current contract version.

## Report link delivery

Build the long self-contained fallback first:

`runner.html#run=<validated payload>`

After exact payload + required sidecar + index publication succeeds, use the deterministic compact resolver:

`r.html?id=<shortId>`

Short-ID lane suffixes remain:

- `open = o`
- `main = m`
- `final_morning = f`
- `evening = e`
- `late = l`

Short-link hydration may load valid same-day sibling lanes for navigation, but it may not change the active report or pull a different date into the active same-day strip.

## Private ledger / public Bet History boundary

The raw betting master ledger is no longer a public-repository runtime source. Current architecture is:

**private master ledger → Cloudflare Worker → sanitized `/api/bet-history` public projection → F3 Bet History and Eddie Numbers**.

Operational rules:

- never restore a raw private ledger file as a public runtime dependency;
- F3 Bet History is a public-facing performance view, not a private ledger viewer;
- Eddie Numbers must read the public sanitized projection, not the raw private ledger;
- exact cash aggregate totals may come from the public API summary;
- public rows must not be treated as exposing exact row-level cash/free-bet/bonus classification;
- public row index 14 means **boosted**, not free bet.

The repository fallback `data/bet-history-public.json` remains sanitized.

## Syndicate/hotline operations

Syndicate profiles are presentation layers and never become betting authority. `data/syndicates.json` currently defaults to Eddie Numbers in slot 1 and Lou Vega in slot 2, with slots 3 and 4 open.

Hotline shell versions are independent from terminal, engine and contract versions. Current examples include Vegas by the Slice v2 and Lizard Line v1. Historical hotline archives remain immutable.

## Research Library

Production Research Library remains **v1.7 read-only**. The v1.8 candidate remains staging/evaluation only until separately promoted. Research cannot create a bet, supply an executable price, override identity/freshness, or directly change fair value, play-to, status or stake.

## Version-promotion verification

The Contract v1.0 promotion boundary is recorded in `BETTING_EDGE_V1.0_ACCEPTANCE_2026-08-22.md`.

Rollback boundary immediately before promotion:

- main commit `9de8bf2b5a6e95dc2545fa8011f493d46aedc93f`;
- final Contract v0.9 blob `59d8dda8d8e491255d5792329a9446eb01960a34`;
- VigScope UI v1.4 runner blob `999a1e00261cb05b9b5045bda1285310df168efb`.

Promoted identities:

- Contract v1.0 blob `815a511301bd7a5aa3770baf0e32a00a28e2f548`;
- VigScope UI v1.5 runner blob `8d3dd16e1f77c415e267064d6ced3ceec371dc29`;
- core v1.3 unchanged;
- Research Library v1.7 unchanged.

The first eligible post-promotion scheduled report should be inspected for successful v1.0/v1.5 preflight, normal feed validation, immutable report publication, schema-3 sidecar carrying the v1.0 contract blob, `run-history.json` linkage and normal compact-share delivery. A failure is a regression to investigate or roll back, not permission to silently change the contract.

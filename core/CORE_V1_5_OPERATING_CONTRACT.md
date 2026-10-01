# Core 1.5 current operating contract

Status: OPERATIONAL for report timestamps at/after `2026-09-21T06:00:00-07:00`.
Governance Contract remains v1.0; scheduled report authority remains v1.2; Research Library remains v1.8; outer VigScope UI remains v1.5. These are independent version tracks.

This document defines current status and release semantics. The consolidated `BETTING_EDGE_SCHEDULED_REPORT_AUTHORITY.md` owns the producer sequence; dated review documents are rationale, not parallel operating instructions. For new Core 1.5 reports it supersedes conflicting legacy Core version labels, universal numerical-fair/support requirements, and numeric card targets. It does not supersede identity, source, freshness, personnel, BET eligibility, exposure, staking or publisher-ownership gates. Detailed evidence schemas remain in the linked authorities below.

## Preflight and version provenance

Read this file, `BETTING_EDGE_CONTRACT.md`, `BETTING_EDGE_SCHEDULED_REPORT_AUTHORITY.md`, `BETTING_EDGE_MAIN_SCHEDULE.md`, and `core/core-v1.5-production.json` from current main before analysis. Resolve the expected lane against `data/main-schedule.json`. Run `node tools/core-release.mjs <report-timestamp>` before handicapping and retain the returned exact `coreVersion`, `coreProductionPath` and `coreProductionBlobSha` in sidecar provenance. For post-cutover reports these must identify Core 1.5. Also record `runnerCoreVersion: "1.5"` when supplying that field.

Core 1.5 deliberately reuses the versioned 1.4 model-error, liquidity, Walters and Pinnacle components. Their filenames/framework IDs are component versions, not stale report release labels. Resolve their current pinned blobs and the switchable Walters authority exactly as before. Never rename an assessment enum or framework ID to 1.5. The existing `tools/core-v14-publication-gate.mjs` entrypoint validates both releases by report timestamp. Older issued reports and sidecars retain their original provenance and semantics.

## Status-specific decisions

| Status | Required decision basis |
| --- | --- |
| BET | Supported exact fair/range, required independent support, conservative-bound and model-error clearance, current exact executable quote, personnel, playTo, exposure and staking clearance. Market-assessment-only cannot issue BET. |
| LEAN | Completed favorable directional/price assessment with zero stake. A documented numerical fair may use the status-specific support rules; a qualified exact paired Pinnacle assessment may use the governed market LEAN route without an independent model. BET-bound failure does not automatically mean PASS. |
| WAIT | Completed zero-stake assessment with a real actionable condition and independent current signal. The existing HIGH-error support rule still applies, including on the qualified market-assessment route. |
| PASS | Completed, specifically reasoned rejection with the evidence required by the selected evaluation route. Never a placeholder for unfinished work. |
| RESEARCH_INCOMPLETE | Missing or unfinished source-to-decision work; retain the selection in receipts/queue, and publish other completed decisions. This is not an issued card status. |

Screen the whole eligible primary-market inventory, then complete event-level research and exact paired-market decisions incrementally using the shared work plan. Do not make whole-slate forecast retrieval a prerequisite to completing a supported market decision. Review recorded source-linked native spreads/totals in point units and probabilities in probability units. A point margin is a research lead, never an invented cover probability or EV. Select forecasts for evidential quality, preserve genuine disagreement and source-grounded uncertainty, and do not invent universal uncertainty widths or numerical streak adjustments.

From **2026-10-01T12:00:00-07:00**, `docs/FORECAST_DIRECTIONAL_LEANS.md` adds a reviewed exact-forecast opinion to the qualified market-assessment route. A zero-stake LEAN can prefer the published model point despite an unfavorable Pinnacle comparison, with source-linked current applicability, explicit unquantified forecast uncertainty and visible conflict review. A completed unresolved personnel review may support a visibly provisional opinion with its named recheck. The forecast is not adopted independent fair, and cannot authorize BET or stake. All actual source/identity/freshness/personnel/publication requirements still apply. Review BET and then LEAN explicitly before rejecting a promising exact point.

## Evidence and publication

Use the consolidated shared scheduled authority for ordering and `docs/CANDIDATE_ASSESSMENT.md` / `docs/REPORT_CARD_EVIDENCE.md` for evidence schemas. Revalidate prior evidence against the current exact event, side, line, source timing and personnel. Bind each card, sidecar recommendation and EVALUATED receipt to its own selection key. Use `report-run.mjs` to checkpoint event work, advance the unfrozen issue clock, prepare and inspect deferrals/taxonomy repairs, then freeze and stage through the shared `report-pipeline.mjs` gates. The controller calls the existing evidence preparation internally; do not maintain another producer sequence. Resolve conflicts from the selection's own sources; leave genuinely unfinished selections incomplete.

Publish every completed BET/LEAN/WAIT/PASS; there is no numeric minimum, target or maximum and no forced status quota. Empty eligible boards may publish zero cards and zero risk. Empty publication is not a populated grading acceptance test. Only the staged publisher may write issued History. Verify the successful workflow and read back the exact indexed report/sidecar before claiming publication.

Main times remain 06:00, 08:00, 09:30, 15:15 and 18:15 America/Vancouver. Props remain paused. Bet365/DraftKings execution, quote clocks, odds budget, stakes, immutable history, and the hypothetical-only market-method shadow remain unchanged. The base Core 1.5 release does not itself activate forecast-to-card expansion. The separately approved NFL spread handoff is governed by `docs/GRAHAM_NFL_FAIR_HANDOFF.md` from its stated cutover. Automated wagers, results/CLV learning and personal-ledger calibration remain outside this release.

## Game intelligence aggregation — operational from September 27 noon Pacific

All Main producers use the shared game dossiers described in `docs/GAME_INTELLIGENCE.md`. This activates source aggregation and comparison within the existing Core 1.5 decision routes. Original forecast observations, internal native fair lines, prices and research guidance remain separately attributable. The descriptive source range is not a new fair-value model. The collector and prospective source grader use no additional odds API requests or language-model calls.

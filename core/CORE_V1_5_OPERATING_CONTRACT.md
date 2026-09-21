# Core 1.5 current operating contract

Status: OPERATIONAL for report timestamps at/after `2026-09-21T06:00:00-07:00`.
Governance Contract remains v1.0; scheduled report authority remains v1.2; Research Library remains v1.8; outer VigScope UI remains v1.5. These are independent version tracks.

This document consolidates the active amendments through September 20. For new Core 1.5 reports it supersedes conflicting legacy Core version labels, universal numerical-fair/support requirements, and numeric card targets. It does not supersede identity, source, freshness, personnel, BET eligibility, exposure, staking or publisher-ownership gates. Detailed evidence schemas remain in the linked authorities below.

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

Evaluate the whole eligible primary-market inventory; complete decision-changing candidates first. Review recorded source-linked native spreads/totals in point units and probabilities in probability units. A point margin is a research lead, never an invented cover probability or EV. Select forecasts for evidential quality, preserve genuine disagreement and source-grounded uncertainty, and do not invent universal uncertainty widths or numerical streak adjustments.

## Evidence and publication

Use `docs/CANDIDATE_ASSESSMENT.md`, `docs/REPORT_CARD_EVIDENCE.md`, and the September 20 decision-path amendment in the shared scheduled authority. Revalidate prior evidence against the current exact event, side, line, source timing and personnel. Bind each card, sidecar recommendation and EVALUATED receipt to its own selection key. Run shared `report-evidence-repair.mjs prepare` on unfrozen drafts, inspect deferrals and taxonomy repairs, then run evidence, Core and publication gates on the exact resulting files. Resolve conflicts from the selection's own sources; leave genuinely unfinished selections incomplete.

Publish every completed BET/LEAN/WAIT/PASS; there is no numeric minimum, target or maximum and no forced status quota. Empty eligible boards may publish zero cards and zero risk. Empty publication is not a populated grading acceptance test. Only the staged publisher may write issued History. Verify the successful workflow and read back the exact indexed report/sidecar before claiming publication.

Main times remain 06:00, 08:00, 09:30, 15:15 and 18:15 America/Vancouver. Props remain paused. Bet365/DraftKings execution, quote clocks, odds budget, stakes, immutable history, and the hypothetical-only market-method shadow remain unchanged. Core 1.5 does not close Graham Stage 3 or activate forecast-to-card expansion, automated wagers, results/CLV learning or personal-ledger calibration.

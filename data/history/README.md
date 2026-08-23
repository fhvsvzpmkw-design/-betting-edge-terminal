# Betting Edge Durable History

This directory is the repository-backed history layer for Betting Edge under the operational `BETTING_EDGE_CONTRACT.md` v1.0.

## Goals

Preserve enough information to reconstruct what Betting Edge knew, what it recommended, what historical research it consulted, what production governance/runner state applied, and what price information was available at each decision point — without allowing later history collection to rewrite the decision.

## Odds snapshots

`data/live-odds.json` is intentionally not duplicated into this directory. The file is large, and each successful odds refresh is already committed to Git. Git history therefore remains the authoritative full-fidelity archive for historical odds snapshots.

`data/history/odds-index.json` is the compact lookup layer. The isolated `.github/workflows/odds-history-index.yml` workflow runs after a successful `Refresh Betting Edge odds` workflow and records lightweight snapshot provenance without modifying the production refresh workflow. Entries may include:

- exact `generatedAt` and Vancouver generation time;
- the Git commit that stored the snapshot;
- the exact Git blob SHA for `data/live-odds.json`;
- SHA-256 of the full snapshot bytes;
- schema/identity schema;
- source and event count;
- available request/sport summary metadata.

The full snapshot remains authoritative in Git. The compact index is a navigation/provenance aid and must never replace or duplicate the large feed.

## Betting Edge report runs

Validated issued report payloads are stored under:

`data/history/runs/YYYY-MM-DD/<slot>-<timestamp>.json`

Each stored payload is the exact validated JSON object used to build the Betting Edge Terminal runner delivery before Base64URL encoding. It preserves the issued recommendation state and should not be enlarged solely for historical-analysis metadata.

It preserves, where available:

- report slot and label;
- `run.ts` in America/Vancouver context;
- feed generation timestamp used by the analysis;
- bankroll and total new risk;
- BET / LEAN / WAIT / PASS counts;
- recommendation title;
- exact `rec.feed` machine identity for every displayed moneyline, spread, game total and player prop issued after the 2026-08-16 identity hardening;
- sportsbook and issued price;
- `playTo` threshold;
- fair price / edge;
- movement;
- concise History Fit display text;
- stake;
- support / contrary evidence;
- source and analysis text;
- exact player label and line identity when the issued recommendation is player-specific.

Older immutable game-market reports issued without `rec.feed` remain valid historical evidence and use the runner's fail-closed fallback matching when repriced. They are not rewritten merely to adopt structured identity.

`/run-history.json` is the compact repository index for these payload files. The full stored issued payload is authoritative if an index summary and payload ever disagree.

## Research Fit / provenance sidecars

Structured historical-analysis detail is stored separately so it does not enlarge or mutate the runner payload:

`data/history/research-fit/YYYY-MM-DD/<slot>-<timestamp>.json`

The format is governed by `data/history/report-provenance-schema.json`.

### Production schema 3

Schema 3 remains the production sidecar format under Contract v1.0 and is keyed to the exact issued `slot` and `run.ts`. It preserves:

- production contract version/path and exact contract blob SHA resolved before handicapping;
- runner version/blob SHA;
- feed blob SHA;
- Research Library version and exact blob SHAs;
- exact primary prior IDs and optional synthesis/inference IDs consulted;
- evidence-cluster IDs after deduplication;
- History Fit grade;
- directness and era/transportability assessment;
- historical mechanism and strongest limitation;
- the exact concise History Fit text shown in the issued report;
- optional non-authoritative historical draft provenance.

The issued payload remains authoritative for what Betting Edge actually recommended. The sidecar is authoritative only for the structured research/provenance record associated with that issuance.

Historical schema-2 sidecars issued before the original v0.9 production cutover remain valid immutable evidence. Existing schema-3 sidecars issued under v0.9 also remain immutable historical evidence and are not rewritten merely because Contract v1.0 is now operational.

## Live integration state

The original 15:15 EVENING + 18:15 LATE / WEST COAST durable-history acceptance pair passed on 2026-08-15 and remains recorded as historical evidence in `BETTING_EDGE_V0.9_ACCEPTANCE_2026-08-15.md`.

Contract v1.0 is now the current production authority. All five scheduled report lanes remain configured for the same durable-history behavior:

- `open` — 06:00;
- `main` — 08:00;
- `final_morning` — 09:30;
- `evening` — 15:15;
- `late` — 18:15.

The next production observation is the first report issued under Contract v1.0, confirming that its sidecar records the exact v1.0 contract authority while preserving the existing immutable history/share behavior.

## Same-day session history

`r.html` resolves compact report IDs through `run-history.json`, fetches the authoritative stored active report, and may hydrate the newest valid archived run for other session lanes on the active Vancouver date.

Repository-backed same-day history is presentation/navigation context. It must not:

- change the active issued recommendation;
- hydrate a different betting date;
- turn earlier same-day reports into additional Research Library votes;
- depend on device-local browser history.

`CLEAR LOCAL HISTORY` removes only browser-local runner history. It must never delete repository-backed issued reports or `run-history.json`.

## Immutability

A stored issued report or Research Fit/provenance sidecar is historical evidence and should not be silently rewritten after delivery. Corrections should create a new run/correction record with a new timestamp and explicit relationship to the earlier record.

Player-prop `rec.feed` identity is part of the issued historical payload and remains unchanged even if the player later changes teams or a later sportsbook line differs.

## Repricing

Runner-side `UPDATE ODDS / REPRICE NOW` remains a comparison overlay and does not mutate the issued report. Browser/device-local reprice history is not a durable repository write. Durable reprice-event capture is a future extension and must be implemented without exposing repository credentials to the client.

Newly issued game-market and player-prop cards use exact structured `rec.feed` identity first. Older cards without that object may use title/team/time fallback; ambiguous fallback results remain unresolved rather than being forced into a match.

For player props, a later different line is a different selection and must not be treated as an exact reprice of the issued line.

## Safety

History collection must never block the primary live odds snapshot or replace a validated report solely because history indexing or sidecar storage fails.

After a report has passed the core analysis/payload gates, a later history write failure must not cause odds to be pulled again, the handicap to be rerun, or a replacement recommendation set to be generated. Deliver the unchanged validated long fallback and surface:

`HISTORY SAVE FAILED — REPORT VALID`

The production contract remains the governing authority; history artifacts are evidence and indexing layers, not a mechanism for silently changing betting decisions.

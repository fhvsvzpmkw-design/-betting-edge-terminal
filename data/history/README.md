# Betting Edge Durable History

This directory is the repository-backed history layer for Betting Edge.

## Goals

Preserve enough information to reconstruct what Betting Edge knew, what it recommended, what historical research it consulted, and what price information was available at each decision point.

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

Each stored payload is the exact JSON object used to build the Betting Edge Terminal runner link, before Base64URL encoding. It preserves the issued recommendation state and should not be enlarged solely for historical-analysis metadata.

It should preserve, where available:

- report slot and label;
- `run.ts` in America/Vancouver context;
- feed generation timestamp used by the analysis;
- bankroll and total new risk;
- BET / LEAN / WAIT / PASS counts;
- recommendation title and structured identity when available;
- sportsbook and issued price;
- `playTo` threshold;
- fair price / edge;
- movement;
- concise History Fit display text;
- stake;
- support / contrary evidence;
- source and analysis text.

`/run-history.json` is the compact repository index for these payload files. The full stored issued payload is authoritative if an index summary and payload ever disagree.

## Research Fit / provenance sidecars

Structured historical-analysis detail is stored separately so it does not enlarge or mutate the runner payload:

`data/history/research-fit/YYYY-MM-DD/<slot>-<timestamp>.json`

The format is governed by `data/history/report-provenance-schema.json`.

A sidecar is keyed to the exact issued `slot` and `run.ts` and may preserve:

- Research Library version and exact blob SHAs;
- exact primary prior IDs and optional synthesis/inference IDs consulted;
- evidence-cluster IDs after deduplication;
- History Fit grade;
- directness and era/transportability assessment;
- historical mechanism and strongest limitation;
- the exact concise History Fit text shown in the issued report;
- feed blob SHA;
- runner version/blob SHA;
- non-operational governance-draft provenance.

The issued payload remains authoritative for what Betting Edge actually recommended. The sidecar is authoritative only for the structured research/provenance record associated with that issuance.

The first live sidecar integration is intentionally limited to the 15:15 EVENING lane as an R2 pilot. Other report lanes remain unchanged until that live chain is verified.

## Immutability

A stored issued report or Research Fit sidecar is historical evidence and should not be silently rewritten after delivery. Corrections should create a new run/correction record with a new timestamp and explicit relationship to the earlier record.

## Repricing

Runner-side `UPDATE ODDS / REPRICE NOW` remains a comparison overlay and does not mutate the issued report. Browser/device-local reprice history is not yet a durable repository write because GitHub Pages has no embedded write credential. Durable reprice-event capture is a future extension and must be implemented without exposing repository credentials to the client.

## Safety

History collection must never block the primary live odds snapshot or report delivery solely because history indexing or sidecar storage fails. A failed history write should be surfaced clearly and repaired, but it must not corrupt or replace the live source data or cause a different recommendation to be rebuilt merely for storage.

# Betting Edge Durable History

This directory is the repository-backed history layer for Betting Edge.

## Goals

Preserve enough information to reconstruct what Betting Edge knew, what it recommended, and what price information was available at each decision point.

## Odds snapshots

`data/live-odds.json` is intentionally not duplicated into this directory. The file is large (currently tens of megabytes), and each successful odds refresh is already committed to Git. Git history therefore remains the authoritative full-fidelity archive for historical odds snapshots.

A historical odds snapshot can be reconstructed by reading `data/live-odds.json` at the corresponding `Refresh Betting Edge live odds` commit. The snapshot itself contains its generation timestamps, bookmakers, request usage, event/market/selection identity, market update timestamps, and prices.

Future compact indexes may point to those commits for easier analysis, but they must not duplicate the full feed unnecessarily.

## Betting Edge report runs

Validated report payloads are stored under:

`data/history/runs/YYYY-MM-DD/<slot>-<timestamp>.json`

Each stored payload is the exact JSON object used to build the Betting Edge Terminal runner link, before Base64URL encoding. It should preserve, where available:

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
- historical-fit context;
- stake;
- support / contrary evidence;
- source and analysis text.

`/run-history.json` is the compact repository index for these payload files. The full stored payload is authoritative if an index summary and payload ever disagree.

## Immutability

A stored issued report is historical evidence and should not be silently rewritten after delivery. Corrections should create a new run/correction record with a new timestamp and explicit relationship to the earlier run.

## Repricing

Runner-side `UPDATE ODDS / REPRICE NOW` remains a comparison overlay and does not mutate the issued report. Browser/device-local reprice history is not yet a durable repository write because GitHub Pages has no embedded write credential. Durable reprice-event capture is a future extension and must be implemented without exposing repository credentials to the client.

## Safety

History collection must never block the primary live odds snapshot or report delivery solely because optional history indexing fails. A failed history write should be surfaced clearly and repaired, but it must not corrupt or replace the live source data.

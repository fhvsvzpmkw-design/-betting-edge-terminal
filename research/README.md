# Betting Edge Research Library — Canonical v1.7

**Status:** R1 canonicalization complete — read-only — not yet linked to scheduled Betting Edge reports  
**Contract compatibility:** Betting Edge Contract draft v0.7  
**Built:** 2026-08-14T20:06:13Z

## Purpose

This folder consolidates the seven Betting Edge Research Prior Library passes (`v1.0` through `v1.6`) into one stable, versioned, machine-readable research source for History Fit.

The source set contains **96 logical items**:

- 78 primary research priors
- 10 targeted question resolutions
- 8 final gap resolutions

The 18 resolution records are retained as synthesis/audit items. In addition, three v1.3 entries explicitly labeled `SYNTHESIS` and one explicitly labeled `INFERENCE` retain those non-independent roles. They are **not additional independent evidence votes**.

## Active files

- `manifest.json` — stable version/pointer file for later read-before-run integration.
- `research-library.json` — all 96 normalized logical items and their runtime boundaries.
- `source-registry.json` — deduplicated source/provenance registry.
- `history-fit-policy.json` — R1/R2 retrieval, grading, conflict and failure rules.
- `taxonomy.json` — controlled values and evidence/conflict clusters.
- `source-package-manifest.json` — exact source-package counts and SHA-256 hashes.
- `CANONICALIZATION_REPORT.md` — build/audit summary.

## Runtime boundary

At the first read-only integration stage, the Research Library is an **independent historical interpretation layer**.

It does not:

- create a BET;
- count as an extra BET-confirmation vote;
- supply an executable sportsbook quote;
- override identity/freshness/fair-value gates;
- directly rewrite fair value or model-error parameters;
- directly rewrite `playTo`, status or stake;
- blend personal-ledger or same-day market evidence into the History Fit grade;
- require runtime write access.

The current handicap is formed first from current evidence. Research is then applied as the History Fit lens.

## Conflict handling

The library intentionally keeps disagreements and era changes visible instead of deleting them. `taxonomy.json` defines evidence clusters for known overlap/tension, including:

- movement information versus short-run overreaction;
- old NBA totals thresholds versus later era replication;
- historical NFL anomalies versus efficiency/edge decay;
- old NHL reverse-FLB evidence versus modern transportability;
- boxing and CFL areas where later research narrows an earlier broad research-gap statement;
- player-prop practitioner evidence versus the peer-reviewed calibration gap.

History Fit should synthesize the cluster, not count each member as a separate vote.

## Evidence tiers

This canonicalization is deliberately conservative. Where the original package explicitly assigned an A/B tier, that tier is retained. Legacy records without an explicit tier are not automatically promoted to A; they are normalized conservatively using their original status/source type. See `taxonomy.json`.

## Updating the library

Normal Betting Edge reports remain read-only.

When worthwhile new research is found:

1. review and classify it;
2. determine whether it adds, replicates, contradicts, supersedes or narrows an existing prior;
3. update the canonical library and source registry;
4. increment the Research Library version independently from the Betting Edge contract version;
5. manually upload the approved files;
6. verify the uploaded hashes/content;
7. only then allow later reports to use the new approved version.

## Source-package audit

`source-package-manifest.json` records the original seven package names, counts, sizes and SHA-256 hashes. A separate full-audit bundle can retain the extracted legacy packages; they are not required for the normal repo upload or runtime read path.

## Next step

This package is intended for **R2 manual read testing**. Uploading it alone must not change the scheduled 06:00/08:00/09:30/15:15/18:15 Betting Edge reports.

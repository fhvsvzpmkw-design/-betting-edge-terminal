# Betting Edge Research Library — Canonical v1.7

**Status:** R2 manual read validation passed — read-only — R3 staged across all five scheduled report lanes; live verification pending  
**Contract compatibility:** Betting Edge Contract draft v0.9  
**Built:** 2026-08-14T20:06:13Z

## Purpose

This folder consolidates the seven Betting Edge Research Prior Library passes (`v1.0` through `v1.6`) into one stable, versioned, machine-readable research source for History Fit.

The source set contains **96 logical items**:

- 78 primary research priors
- 10 targeted question resolutions
- 8 final gap resolutions

The 18 resolution records are retained as synthesis/audit items. In addition, three v1.3 entries explicitly labeled `SYNTHESIS` and one explicitly labeled `INFERENCE` retain those non-independent roles. They are **not additional independent evidence votes**.

## Active files

- `manifest.json` — authoritative current version/compatibility pointer for read-before-run integration.
- `research-library.json` — all 96 normalized logical items and their runtime boundaries.
- `source-registry.json` — deduplicated source/provenance registry.
- `history-fit-policy.json` — R2/R3 retrieval, grading, conflict and failure rules.
- `taxonomy.json` — controlled values and evidence/conflict clusters.
- `source-package-manifest.json` — exact source-package counts and SHA-256 hashes.
- `CANONICALIZATION_REPORT.md` — build/audit summary.

## Compatibility authority

`research-library.json` preserves the contract version recorded when the canonical v1.7 library was originally built. That build-time header is historical provenance and is not rewritten solely to advance contract compatibility.

`manifest.json` is the authoritative pointer for the library's **current tested contract compatibility**. The active manifest records compatibility with Betting Edge Contract draft v0.9, the passed R2 manual-read test, and the current staged live-validation state.

## Runtime boundary

The Research Library is an **independent historical interpretation layer**.

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

Structured Research Fit/provenance may be written to `data/history/research-fit/` by the report-history layer. That is a history write, not a Research Library write: normal reports remain prohibited from mutating `research/*`.

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

Normal Betting Edge reports remain read-only with respect to `research/*`.

When worthwhile new research is found:

1. review and classify it;
2. determine whether it adds, replicates, contradicts, supersedes or narrows an existing prior;
3. update the canonical library and source registry;
4. increment the Research Library version independently from the Betting Edge contract version;
5. commit the approved files through the verified repository write path;
6. verify the committed hashes/content;
7. only then allow later reports to use the new approved version.

## Source-package audit

`source-package-manifest.json` records the original seven package names, counts, sizes and SHA-256 hashes. A separate full-audit bundle can retain the extracted legacy packages; they are not required for the normal repo upload or runtime read path.

## Validation and next step

The R2 manual read suite is stored at `research/tests/R2_MANUAL_READ_TEST_2026-08-15.json` and validates direct/mixed evidence, era-conflict handling and explicit research-gap behavior without changing live recommendation fields.

All five scheduled report lanes are now staged to perform the same read-only Research Fit process and preserve structured Research Fit/provenance in separate history sidecars while keeping the runner payload compact.

The next acceptance step is to verify the **15:15 and 18:15 live chains**: authoritative Research Library read, correct `hist` rendering, exact issued-payload archive, matching Research Fit sidecar, correct `run-history.json` linkage, and no regression in price/stake/risk/runner behavior.

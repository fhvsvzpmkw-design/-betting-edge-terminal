# Betting Edge Research Library — Canonical v1.8

**Status:** R3 LIVE READ-ONLY across all scheduled report lanes  
**Contract compatibility:** Betting Edge Contract v1.0 OPERATIONAL  
**Promoted:** 2026-08-25

## Purpose

This folder contains the approved Betting Edge Research Library v1.8: the canonical v1.7 base, the tested v1.8 R2 candidate, and the focused 2026-08-25 R3 gap-closure overlay. It remains a stable, versioned, machine-readable research source for History Fit.

The active v1.8 source set contains **130 logical items** with these runtime retrieval roles:

- **104 primary research priors**
- **25 synthesis records**
- **1 inference record**

The active source registry contains **108 deduplicated source records** and the taxonomy contains **30 evidence/conflict clusters**. Synthesis and inference records are never additional independent evidence votes.

## Active files

- `manifest.json` — authoritative current version/compatibility pointer for read-before-run integration.
- `research-library.json` — all 130 normalized logical items and their runtime boundaries.
- `source-registry.json` — 108 deduplicated source/provenance records.
- `history-fit-policy.json` — R3 retrieval, grading, conflict and failure rules.
- `taxonomy.json` — controlled values and 30 evidence/conflict clusters.
- `source-package-manifest.json` — original source-package audit information.
- `CHECKSUMS.json` — active v1.8 research artifact checksums.
- `V1_8_PROMOTION_2026-08-25.md` — production-promotion record.
- `tests/V1_8_R3_VALIDATION_2026-08-25.json` — v1.8 R3 production validation.
- `CANONICALIZATION_REPORT.md` — historical v1.7 canonicalization/build summary.

## Compatibility authority

`manifest.json` is the authoritative pointer for the library's current tested contract compatibility and runtime state. It records `activeLibraryVersion: "1.8"`, Contract v1.0 compatibility, and R3 live read-only operation.

The active `research-library.json`, source registry, taxonomy and History Fit policy are materialized for v1.8. Older v1.7 and staged v1.8 artifacts remain historical/audit evidence and do not override the active manifest.

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
- player-prop mechanism evidence versus direct sportsbook-calibration gaps;
- extreme-longshot pricing, liquidity, order flow and cross-book dispersion;
- direct college-football market evidence with current-era caveats;
- WNBA game-market evidence versus the still-open WNBA player-prop calibration gap;
- rare MLB batter-prop mechanisms versus exact-market price calibration.

History Fit should synthesize a cluster, not count each member as a separate vote.

## Evidence tiers

The library remains deliberately conservative. Evidence tier reflects source strength and applicability, while directness/transportability and conflicts are handled separately. A strong mechanism paper is not automatically direct sportsbook-calibration evidence, and a research gap remains `GAP`/NR rather than being filled by analogy.

Current v1.8 evidence-tier inventory is recorded in `tests/V1_8_R3_VALIDATION_2026-08-25.json`.

## Updating the library

Normal Betting Edge reports remain read-only with respect to `research/*`.

When worthwhile new research is found:

1. review and classify it;
2. determine whether it adds, replicates, contradicts, supersedes or narrows an existing prior;
3. update the canonical library and source registry;
4. increment the Research Library version independently from the Betting Edge contract version;
5. commit the approved files through the verified repository write path;
6. verify IDs, source references, clusters, boundaries and committed hashes/content;
7. only then allow later reports to use the new approved version.

## v1.8 validation and promotion basis

The original v1.8 R2 candidate contained **120 logical items, 100 sources and 26 clusters**. It passed:

- **15/15** narrative History Fit cases;
- **9/9** hard-boundary cases;
- structural and source/cluster validation.

Promotion was originally held for live v1.7 soak rather than because of a failed research test. Multiple subsequent production days supplied that soak and exposed specific knowledge gaps, particularly extreme-tail/book-gap WAIT drift and exact player-prop mechanism gaps.

The 2026-08-25 R3 pass then added **10 focused logical items, 8 sources and 4 clusters**. Production validation confirmed:

- unique logical and source IDs;
- all source references resolve;
- all cluster references and members resolve;
- WNBA game evidence does not leak into player-prop calibration;
- the WNBA direct player-prop gap remains explicit;
- MLB mechanism evidence is not mislabeled as direct sportsbook calibration;
- all R3 hard boundaries remain preserved.

## v1.8 R3 gap closure

The R3 pass targeted the live-production holes that mattered most:

- extreme-longshot / one-book-outlier interpretation;
- low-liquidity soccer and large quote dispersion;
- direct college-football market evidence;
- direct but era-limited WNBA game-market evidence;
- MLB doubles contact-quality mechanics;
- MLB stolen-base opportunity/success mechanics;
- MLB runs-scored batting-order opportunity;
- explicit direct-price calibration boundaries for rare MLB props.

See `staging/V1_8_GAP_AUDIT_R3_2026-08-25.md`, `staging/V1_8_GAP_CLOSURE_R3_2026-08-25.json`, and `V1_8_PROMOTION_2026-08-25.md`.

## Remaining explicit gaps

v1.8 deliberately preserves these unresolved areas rather than manufacturing confidence:

- WNBA direct closing player-prop calibration;
- NFL multi-book direct player-prop calibration;
- MLB direct closing calibration for doubles and stolen-base props;
- boxing derivative-market calibration;
- CFL broad pregame calibration;
- current-era replication of older WNBA game-market findings.

These are research targets, not permission to substitute generic cross-sport evidence.

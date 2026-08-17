# Betting Edge Report-History Publication

**Status:** Operational beginning with the next production lane after the 2026-08-17 09:30 report  
**Workflow:** `.github/workflows/report-history.yml`  
**Publisher/validator:** `tools/report-publication.mjs`

## Purpose

Report-history publication is one bounded repository transaction. It is not a betting engine, a second scheduler, or a runner feature.

The report-generation layer still finishes and validates the Betting Edge report first. After that, the publisher receives two already-complete JSON objects:

1. the exact issued report payload;
2. the matching schema-3 Research Fit/provenance sidecar.

The publisher then derives the canonical paths, validates the cross-references, writes the report and sidecar, merges the matching `run-history.json` entry, and commits all three artifacts together.

## Required publication path

For a normal scheduled or recovery report, use the `Report history publication` workflow in `publish` mode instead of issuing three independent repository updates.

Inputs:

- `report_json_b64` — Base64 or Base64URL encoding of the validated issued report JSON;
- `sidecar_json_b64` — Base64 or Base64URL encoding of the matching schema-3 sidecar JSON.

The workflow:

1. decodes both inputs;
2. verifies slot, timestamp, label, feed timestamp, counts and recommendation alignment;
3. verifies production-contract and feed provenance in the sidecar;
4. derives the report path, sidecar path and deterministic short ID;
5. writes the report, sidecar and `run-history.json` entry in one Git commit;
6. retries safely if another repository update races the push;
7. fetches the resulting `main` branch and performs a remote read-back check;
8. exposes the compact short ID only after read-back succeeds.

Existing immutable files may be submitted again only when their JSON content is identical. Conflicting rewrites fail closed.

## Continuous integrity check

The same workflow runs in verification mode whenever report payloads, sidecars, `run-history.json`, the publisher, or the workflow itself changes.

The verifier checks that:

- every stored issued report is indexed exactly once;
- every index entry resolves to the correct immutable payload;
- deterministic short IDs are unique;
- counts and recommendation totals agree;
- every linked sidecar resolves and matches its report reference;
- every production run at or after `2026-08-17T15:15:00-07:00` has a matching schema-3 sidecar and index linkage;
- `run-history.json.updated_at` matches the newest indexed report.

## Historical boundary

The August 17 08:00 and 09:30 reports remain valid issued reports. Their missing sidecars are not reconstructed after the fact. The 09:30 index omission was repaired separately without changing its issued payload.

Strict complete-bundle enforcement begins with the next standard lane, `2026-08-17T15:15:00-07:00` and later.

## Failure behavior

A history-publication failure does not invalidate or regenerate an already-validated Betting Edge report. The unchanged long fallback remains valid and the operational message remains:

`HISTORY SAVE FAILED — REPORT VALID`

Do not pull odds again, re-handicap, mutate recommendations, or alter the runner solely because report-history publication failed.

## Scope boundary

This implementation does not modify:

- `BETTING_EDGE_CONTRACT.md` or Contract 0.9 betting rules;
- the odds-refresh workflow or request budget;
- report analysis, fair value, status, staking or risk logic;
- `r.html`, `runner.html`, `runner-core.html`, splash screens or repricing;
- previously issued report payloads or sidecars.

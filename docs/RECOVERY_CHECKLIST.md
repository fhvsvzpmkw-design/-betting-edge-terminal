# Betting Edge — Recovery Completion Checklist

This checklist is the mandatory completion gate for any manual report-lane recovery. It supplements `docs/OPERATIONS.md` and does not replace `BETTING_EDGE_CONTRACT.md` v0.9.

A recovery is not complete when the odds pull finishes or when the analysis has been drafted. It is complete only after the issued recovery report has been generated, archived, published, read back, and its short link has been verified.

## Recovery sequence

1. Confirm the scheduled report lane failed to produce a usable issued report and recovery still has practical betting value.
2. Resolve production contract and runner authority before handicapping.
3. Use the newest valid odds feed. Run a manual odds refresh only when production freshness/executable-price gates require it.
4. Handicap the remaining relevant window under normal production rules. Never relax value, identity, freshness, stake, risk, or Research Fit gates because the lane is a recovery.
5. Preserve the canonical lane and append `— RECOVERY` to the display label. Use the actual recovery issuance time in `America/Vancouver`; never backdate to the scheduled time.
6. Validate the recovery payload, counts, status/stake/risk, structured identities, timestamps, serialization and Base64URL round trip.
7. **Generate the issued recovery artifact.** Build the long fallback from the validated recovery payload.
8. **Archive and publish the complete recovery bundle.** Store the immutable report payload under `data/history/runs/YYYY-MM-DD/<slot>-HHMMSS.json`, store the matching schema-3 Research Fit/provenance sidecar under `data/history/research-fit/YYYY-MM-DD/<slot>-HHMMSS.json`, and append the matching entry to `run-history.json`.
9. **Read back the publication.** Confirm the archived payload, sidecar, `run-history.json` entry, exact `run.ts`, `feedGeneratedAt`, feed blob provenance, and lane all match. If any required history component is missing, the recovery is not finished.
10. **Verify delivery.** Derive the deterministic short ID from the actual recovery timestamp, verify `r.html?id=<shortId>` resolves the archived recovery, and retain the long fallback. Do not report the recovery as complete or provide the short link before this gate passes.
11. If archive/publication fails after the report payload is valid, surface `HISTORY SAVE FAILED — REPORT VALID`, deliver only the validated long fallback, and repair history separately without rerunning odds or re-handicapping solely for the history failure.

## Completion rule

**RECOVERY COMPLETE = analysis generated + recovery payload issued + sidecar archived + run-history indexed + remote read-back passed + short link verified.**

An odds snapshot by itself is not a recovered Betting Edge report.

# Reusing existing current personnel value sources

October 31, 2026. This lookup procedure uses the existing `CURRENT_EA_SUPPLEMENT` adapter. It adds no player registry, valuation curve, numerical writer or automatic rating selection.

The frozen registry remains the first value source. Follow its manifest-authorized team shard and exact full-registry fallback. If an identity is absent, inspect previously committed official EA captures before concluding that the value is unavailable. A source-bound supplemental identity can be consumed through `tools/graham-current-value-estimates.mjs` under the existing current-week production policy.

## Existing capture locations

| Capture | Git blob | Relevant identities already available |
|---|---|---|
| `data/walters/nfl/2026/week-01-weekly-evidence/2026-09-21-ea-week1-missing-player-capture.json` | `7bd98ecfd85aee88630be9f1204cc0b09379d494` | Corey Kiner, EA `15039`, RB, OVR 67, Week 1 Ratings |
| `data/walters/nfl/2026/week-03-weekly-evidence/2026-10-04-ea-missing-player-capture.json` | `6fc13b03177ec7688ab574246d45e374b94489a1` | Doneiko Slaughter, EA `4832`, CB, OVR 64; Bishop Fitzgerald, EA `16351`, FS, OVR 62; Week 3 Ratings |
| `data/walters/nfl/2026/week-07-weekly-evidence/2026-10-20-ea-current-missing-identity-capture.json` | `82d2a67a14f58ea21b9174f8d9622ac78e9d7a9d` | Doneiko Slaughter, EA `4832`, CB, OVR 64; Nate Lynn, EA `4834`, EDGE, OVR 63; Bishop Fitzgerald, EA `16351`, FS, OVR 62; Week 5 Ratings |

This table is a navigation aid. Verify the capture's actual bytes, exact immutable identity, iteration, recorded time and locked-registry binding. It is not authority to substitute a later capture for an identity already in the frozen registry. Historical use retains its separate timing and evidence rules.

## Staging and verification

1. Establish current availability and role from current official football sources. An EA capture supplies an identity and value input, not present-day team membership or a replacement assignment.
2. Add the selected capture to the batch's `valueSupplements` with its exact `path`, `blobSha`, selected `eaPlayerIds`, `estimateAcknowledged:true` and rationale. Bind the capture path in every consuming case's `sourceRefs`. Include only the identities consumed by this batch; duplicate or unbound rows fail validation.
3. Use the existing `RESOLVED_MODEL_ESTIMATE` and approved replacement method. Preserve `CURRENT_EA_SUPPLEMENT` provenance, the frozen conversion curve, baseline-duty safeguards and uncertainty. Do not assign a missing value to zero.
4. A source-bound supplemental value that converts to exactly zero may qualify for the existing `ZERO_CALIBRATED_LOSS` invariant. This does not claim the absence has no football impact and does not resolve another player's role or cluster case.
5. Preview through the existing personnel writer in an isolated copy, inspect every changed game and retained unresolved case, then publish through the existing staging workflow. Verify the live personnel ledger and board. Do not label a targeted personnel recovery as a completed scheduled baseline or research sweep.

If no valid capture exists, keep the exact value gap explicit. If a valid capture exists but role, availability, cluster or displaced-duty evidence remains unresolved, report that remaining gap rather than repeating the obsolete missing-value blocker.

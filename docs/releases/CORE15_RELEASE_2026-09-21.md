# Core 1.5 release — first progression build

Scope: consolidate the live amendments through September 20 into a versioned operating contract, enforce forward release provenance and align the five Main task instructions. The next builds are Graham Stage 3 schedule-authority closure, then Graham/Walters NFL spread forecast-to-card handoff.

Release cutover: `2026-09-21T06:00:00-07:00`. Governance Contract v1.0, shared authority v1.2 and Research Library v1.8 remain their own version tracks. Core 1.5 retains the 1.4 component framework/IDs and wagering semantics; no numerical decision threshold was changed in this release.

The September 20 18:15 acceptance artifact is `2026-09-20T18:15:38-07:00|late`: zero cards, zero risk. Its exact report and sidecar are indexed in main. This verifies empty-board publication, not populated grading or predictive performance. Populated forward Core 1.5 acceptance remains pending.

## Validation

- Forward timestamp boundary, old-history immutability, stale version/path/SHA rejection, missing-manifest rejection, component-drift rejection and populated BET model-error rejection: `node tests/core15-release.test.mjs`.
- September 20 status-specific evidence correction and retained BET protections: `node tests/core14-review.test.mjs --integration`.
- Operational model-error and publication self-tests; market-price assessment replay; evidence-repair integration; exact card identity; candidate assessment; Main schedule and shared-authority regressions.
- Full issued-report verification passed for 146 runs; Core history verification passed for 95 post-Core-1.4 bundles. CI repeats the release tests in the existing Core validation workflow.

## Task synchronization

Use `core/main-report-task-template.txt`, substituting each existing task's time for `{{REPORT_TIME}}`. Only the prompt field changes. Preserve all task IDs, enabled state, timezone, schedules and other settings. The five original prompts and schedules are retained in `docs/releases/core15-main-tasks-before.json`. This file is rollback evidence, not live authority. Check live tasks after updates; do not infer synchronization from the template alone.

## Rollback

Before the cutover and before any Core 1.5 issuance: revert this scoped release commit and restore only the five prior prompt fields. Preserve current task schedules/enabled state and all odds, staged candidates and History.

After any Core 1.5 report has been issued: retain Core 1.5 historical validation, its manifest and immutable sidecars. Use a forward corrective release for any problem; a blind revert of the version-aware validator would reject valid Core 1.5 history. No rollback may rewrite prior grades, sources, prices or provenance. The previous decision components remain available unchanged.

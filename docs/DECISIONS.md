# Betting Edge — Decision Log

**Last updated:** 2026-08-15

This file records durable project decisions and the reasoning behind them. It exists so future changes do not accidentally undo choices that were already made intentionally.

## D-001 — Git history is the authoritative rollback system

**Status:** Active

Every direct repository change should preserve a clear before/after history in Git. Named `.old` files may remain where they are useful for fast recovery, but Git history is the definitive source for restoring any repository file.

**Reason:** Avoid accumulating ad hoc backups while retaining exact, auditable rollback points.

## D-002 — Direct GitHub writes are allowed, but must be narrow and verified

**Status:** Active as of 2026-08-15

The connected GitHub integration may create, update, commit, read back, and delete files directly on `main`.

Required safeguards are documented in the root `README.md`: fetch current state first, record rollback information, make narrow edits, compare before/after, validate, commit clearly, read back, and verify Pages/Actions where relevant.

**Reason:** Direct write access removes the error-prone manual upload step while retaining a controlled change process.

## D-003 — Keep the live Betting Edge pipeline modular

**Status:** Active

The odds refresh, runner UI/repricing, research library, history/provenance layer, and governance contract should remain separable components unless a deliberate integration is approved.

**Reason:** A failure in one layer should not force changes in unrelated layers. Modularity makes diagnosis and rollback safer.

## D-004 — Bet365 and DraftKings are the primary live pricing books

**Status:** Active

The odds-refresh workflow currently requests Bet365 and DraftKings.

**Reason:** They provide a practical two-book validation/repricing base within the existing no-paid-subscription approach.

The project may evaluate additional free sources later, but expansion should not destabilize the working refresh pipeline.

## D-005 — Avoid paid odds-data subscriptions for the current build

**Status:** Active project constraint

Betting Edge is being developed around sources that do not require adding a recurring paid odds-data subscription.

**Reason:** Cost discipline and proof-of-concept reliability come before expanding data-provider spend.

## D-006 — Use redundant scheduled attempts rather than a single cron trigger

**Status:** Active

Important odds windows use paired or backup scheduled attempts around the intended refresh slot.

**Reason:** GitHub Actions scheduling can be delayed or occasionally miss a dispatch. A second trigger improves reliability.

The backup design must be paired with quota protection so redundancy does not automatically double API use.

## D-007 — Kill stale scheduled jobs before they spend quota

**Status:** Active

A scheduled odds-refresh job arriving more than 25 minutes after its target slot is treated as a zombie and exits before making odds API requests.

**Reason:** Old odds data is no longer useful for the intended report window and should not consume quota or overwrite a good feed.

## D-008 — Keep scheduler diagnostics independent of the odds API

**Status:** Active

Scheduler Canary and Scheduler Canary v2 are read-only diagnostic workflows with no odds API calls and no repository writes.

**Reason:** This creates a clean signal for distinguishing GitHub scheduler behavior from errors inside the odds workflow.

## D-009 — Issued reports are immutable; repricing is an overlay

**Status:** Active

The runner must not rewrite the original issued recommendation when fresh odds are checked. Repricing produces comparison state over the issued report.

**Reason:** The project needs an auditable record of what was originally recommended versus what the market did afterward.

## D-010 — Identity matching comes before title parsing

**Status:** Active

Structured event, market, and selection identity is the preferred basis for matching live odds to a recommendation. Title/text parsing is a fallback only.

**Reason:** Text matching is inherently more ambiguous and can create false repricing matches.

## D-011 — Equal best-price ties are deterministic

**Status:** Active in runner v1.3; specified in contract draft v0.8 and inherited by v0.9

When multiple books share the best live price:

1. retain the issued book if it is one of the tied books;
2. otherwise use configured book priority, currently Bet365 then DraftKings.

**Reason:** Equal-price comparisons should produce stable, explainable results rather than arbitrary book switching.

## D-012 — Freshness gates are hard safeguards

**Status:** Active

The runner applies freshness limits to feeds/quotes rather than treating any available number as valid. Current repricing quote age is capped at 30 minutes.

The odds workflow also rejects stale scheduled execution and limits acceptable market age.

**Reason:** A precise stale price can be more dangerous than an explicit `UNVERIFIED` state.

## D-013 — Unresolved is better than a guessed match

**Status:** Active

Identity mismatches, unavailable markets, unverified prices, and started/closed events should remain explicit unresolved states.

**Reason:** Betting Edge should fail closed on price verification rather than manufacture confidence.

## D-014 — Research Library remains read-only during staged scheduled integration

**Status:** Active; R2 manual read passed, R3 staged across all five report lanes, live verification pending

Research Library 1.7 remains canonical/read-only and requires no runtime research writes. The R2 manual-read suite passed on 2026-08-15. All five scheduled report lanes are now staged to read the library after the provisional current handicap is formed, render concise History Fit in the existing `hist` field, and preserve structured Research Fit/provenance in a separate history sidecar.

**Reason:** The library has passed controlled retrieval tests. Staging the same bounded read-only behavior across all upcoming lanes avoids configuration drift while keeping the actual live-acceptance gate explicit. Research still cannot create a BET or directly change fair value, `playTo`, status, stake, identity, or price freshness.

## D-015 — User betting history is a separate secondary context

**Status:** Planned architecture

The user's personal ledger/history may eventually interact with the historical research model, but it should remain conceptually separate from broad historical evidence.

**Reason:** Population-level historical evidence and one user's betting performance answer different questions. Combining them too early risks circular reasoning and overfitting.

## D-016 — Contract draft v0.9 is not operational by existence alone

**Status:** Active; supersedes the v0.8-only draft reference

`BETTING_EDGE_CONTRACT_DRAFT_v0.9.md` is governance/specification only and explicitly inherits v0.8 except for its history/provenance additions and overrides. It is not the authoritative production contract merely because it exists or because scheduled sidecars record its blob SHA. Scheduled provenance must record `governanceDraftOperational=false` until a separate contract cutover is deliberately approved and tested.

`BETTING_EDGE_CONTRACT_DRAFT_v0.8.md` remains untouched as the immutable v0.9 baseline/reference draft.

**Reason:** Governance changes can materially alter decision behavior and therefore require deliberate preflight, integration, equivalence testing, and rollback even when related mechanisms are already staged independently in scheduled prompts.

## D-017 — Preserve adaptive handicapping inside hard guardrails

**Status:** Design principle

The contract principle is: **hard-code the guardrails; keep the handicapper adaptive.**

Hard gates such as feed freshness, exact market identity, valid stake/status relationships, and payload integrity should be deterministic. Analytical judgment may remain adaptive within those boundaries.

**Reason:** Betting Edge should reduce execution variability without turning handicapping into a brittle fixed-score model.

## D-018 — Do not perform broad UI redesign while diagnosing pipeline reliability

**Status:** Active operating preference

The 2026-08-11 known-good checkpoint established that manual odds pulling and terminal propagation were working, and UI/layout work was intentionally paused while reliability issues were investigated.

**Reason:** Changing presentation and data flow simultaneously makes regressions harder to isolate.

## D-019 — Preserve a known-good feed when a refresh fails validation

**Status:** Active

A malformed or unusable refresh should not replace the existing valid `data/live-odds.json` snapshot.

**Reason:** Failed freshness is preferable to publishing structurally bad data and losing the last known-good state.

## D-020 — `UNCATEGORIZED` must be traced to its source layer before fixing

**Status:** Active debugging rule

The current runner comparison vocabulary and upstream odds category logic do not intentionally rely on a literal `UNCATEGORIZED` result. If it appears in an actual report, inspect the specific run/report payload and trace its origin before changing runner or workflow code.

**Reason:** Fixing the wrong layer can hide the symptom while damaging a component that was already behaving correctly.

## D-021 — Full odds snapshots stay in Git; use a compact provenance index

**Status:** Active

Do not duplicate the large `data/live-odds.json` file into the history directory for every refresh. Git history is the full-fidelity snapshot archive. `data/history/odds-index.json` provides compact lookup/provenance using generation time, commit/blob identity, hashes and summary metadata.

The index is maintained by a separate `.github/workflows/odds-history-index.yml` workflow rather than by modifying the production odds-refresh workflow.

**Reason:** This preserves exact historical data without multiplying repository storage or adding failure risk to the production refresh path.

## D-022 — Structured Research Fit belongs in a sidecar, not the long runner payload

**Status:** Active architecture

The issued runner payload keeps its existing compact shape. Structured Research Fit/provenance is stored separately under `data/history/research-fit/...` and linked by exact slot/run timestamp.

The issued payload remains authoritative for the recommendation. The sidecar records the research/provenance context and must not rewrite issued status, price, fair value, `playTo`, stake or analysis.

**Reason:** This captures richer audit data without making already-long `#run=` links larger or risking runner compatibility.

## D-023 — All five upcoming lanes are pre-staged; live acceptance is still incremental

**Status:** Supersedes the earlier 15:15-only rollout rule on 2026-08-15

The initial plan was to change only the 15:15 lane and wait before configuring the other four. The project owner deliberately chose to configure all five upcoming scheduled report lanes now so the Research Fit/history behavior would not be forgotten or drift between lanes.

This does **not** declare the integration proven. The 15:15 and 18:15 live chains remain the first acceptance pair, followed by observation of the morning lanes.

**Reason:** Configuration consistency and live acceptance are different questions. Pre-staging all lanes reduces administrative drift while preserving a clear evidence gate before calling R3/H3 verified.

## D-024 — v0.9 adds an H-track separate from Shadow History

**Status:** Active architecture; H2 configured, H3 pending live verification

Contract draft v0.9 introduces a dedicated **H-track** for durable issued-report and market provenance. It covers exact issued report archives, Research Fit/provenance sidecars, `run-history.json`, and compact Git-backed odds-snapshot indexing.

H-track history records what Betting Edge actually issued. It is intentionally separate from the S-track / Shadow History concept, which remains inactive and would concern broader prospective candidate-level calibration if later justified.

**Reason:** Durable auditability of real issued reports is useful now and can be implemented safely without activating a more complex candidate-level Shadow History collector.

---

When a durable architectural or operational choice changes, append or amend the relevant decision here and update `docs/PROJECT_STATE.md` if the active system state also changed.

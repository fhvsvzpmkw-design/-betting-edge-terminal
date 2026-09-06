# Betting Edge — Decision Log

**Last updated:** 2026-08-25 — Core 1.4 production closeout

This file records durable project decisions and the reasoning behind them. It exists so future changes do not accidentally undo choices that were already made intentionally.

## Current production boundary

Current production authority is **Betting Edge Contract v1.0 OPERATIONAL**, **VigScope Terminal UI v1.5**, **Betting Edge Core v1.4 OPERATIONAL**, and **Research Library v1.8 / R3 live read-only**. Walters is runtime-switchable and currently operates in `BET_AUTHORITY` for eligible NFL spread/moneyline. Earlier decision entries describe the state that existed when those decisions were made; they remain historical evidence but do not override this current boundary or `docs/PROJECT_STATE.md`.

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

## D-006 — Use one scheduled odds refresh per window with manual fallback

**Status:** Superseded by D-031 on 2026-08-25

This decision records the 2026-08-18 state in which each important odds window used one scheduled trigger and manual `workflow_dispatch` was the explicit recovery path. At that time the active MLB refresh slots were 05:45, 07:45, 09:15, 14:55 and 17:55 Vancouver.

The scheduler history is documented in D-031; current timing authority is `BETTING_EDGE_MAIN_SCHEDULE.md`.

**Reason:** The historical single-trigger design simplified quota control and removed paired automatic attempts. The later Cloudflare-primary/two-minute-backstop architecture preserves the same duplicate/quota discipline while adding dispatch recovery.

## D-007 — Kill stale scheduled jobs before they spend quota

**Status:** Active

A scheduled odds-refresh job arriving more than 25 minutes after its target slot is treated as a zombie and exits before making odds API requests.

**Reason:** Old odds data is no longer useful for the intended report window and should not consume quota or overwrite a good feed.

## D-008 — Keep scheduler diagnostics independent of the odds API

**Status:** Superseded by D-031 on 2026-08-25

Scheduler canary workflows were previously used as read-only diagnostic signals and made no odds API calls. Those canaries are no longer part of current operations.

**Reason:** The canaries were useful during the earlier GitHub-scheduler diagnostic phase. Current scheduler reliability is instead observed through Cloudflare primary dispatch, the protected odds workflow, the two-minute GitHub backstop and actual canonical-slot publication.

## D-009 — Issued reports are immutable; repricing is an overlay

**Status:** Active

The runner must not rewrite the original issued recommendation when fresh odds are checked. Repricing produces comparison state over the issued report.

**Reason:** The project needs an auditable record of what was originally recommended versus what the market did afterward.

## D-010 — Identity matching comes before title parsing

**Status:** Active

Structured event, market, and selection identity is the preferred basis for matching live odds to a recommendation. Title/text parsing is a fallback only.

**Reason:** Text matching is inherently more ambiguous and can create false repricing matches.

## D-011 — Equal best-price ties are deterministic

**Status:** Active principle; originated in runner v1.3 / Contract v0.9

When multiple books share the best live price:

1. retain the issued book if it is one of the tied books;
2. otherwise use configured book priority, currently Bet365 then DraftKings.

**Reason:** Equal-price comparisons should produce stable, explainable results rather than arbitrary book switching.

## D-012 — Freshness gates are hard safeguards

**Status:** Active

The runner applies freshness limits to feeds/quotes rather than treating any available number as valid. Current repricing quote age is capped at 30 minutes. The production report contract retains the 75-minute feed freshness limit and 30-minute exact-quote limit.

The odds workflow also rejects stale scheduled execution and limits acceptable market age.

**Reason:** A precise stale price can be more dangerous than an explicit `UNVERIFIED` state.

## D-013 — Unresolved is better than a guessed match

**Status:** Active

Identity mismatches, unavailable markets, unverified prices, and started/closed events should remain explicit unresolved states.

**Reason:** Betting Edge should fail closed on price verification rather than manufacture confidence.

## D-014 — Research Library remains read-only in production R3

**Status:** Superseded by D-032 on 2026-08-25

This entry records the original v1.7 R3 live-read acceptance state. Research remained read-only, ran after the provisional current handicap and could not create a BET or directly change fair value, `playTo`, status, stake, identity or price freshness.

The current production Research authority is v1.8 / R3 live read-only under D-032.

**Reason:** Research can enrich auditability and calibration without becoming unconstrained betting authority.

## D-015 — User betting history is a separate secondary context

**Status:** Planned architecture

The user's personal ledger/history may eventually interact with the historical research model, but it should remain conceptually separate from broad historical evidence.

**Reason:** Population-level historical evidence and one user's betting performance answer different questions. Combining them too early risks circular reasoning and overfitting.

## D-016 — Draft existence is not production authority; explicit contract promotion is required

**Status:** Historical safeguard satisfied; remains a standing change-control rule

The presence of `BETTING_EDGE_CONTRACT_DRAFT_v0.8.md`, `BETTING_EDGE_CONTRACT_DRAFT_v0.9.md`, or any future draft does not make that draft operational. On 2026-08-15 the v0.9 draft assumptions were live-tested, an explicit acceptance record was created, and `BETTING_EDGE_CONTRACT.md` was deliberately created as the operational v0.9 production authority.

The draft files remain historical design artifacts incorporated by fixed blob identity; scheduled reports now resolve `BETTING_EDGE_CONTRACT.md` rather than treating draft provenance as authority.

**Reason:** Governance changes can materially alter decision behavior and require deliberate preflight, equivalence/regression testing, explicit promotion and rollback information.

## D-017 — Preserve adaptive handicapping inside hard guardrails

**Status:** Active production principle

The contract principle is: **hard-code the guardrails; keep the handicapper adaptive.**

Hard gates such as feed freshness, exact market identity, valid stake/status relationships, and payload integrity should be deterministic. Analytical judgment may remain adaptive within those boundaries.

**Reason:** Betting Edge should reduce execution variability without turning handicapping into a brittle fixed-score model.

## D-018 — Do not perform broad UI redesign while diagnosing pipeline reliability

**Status:** Active operating preference

The 2026-08-11 known-good checkpoint established that manual odds pulling and terminal propagation were working, and UI/layout work was intentionally paused while reliability issues were investigated. The later meter-only v1.3 UI patch was deliberately isolated and passed the 18:15 live regression.

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

The issued runner payload remains compact. Structured Research Fit/provenance is stored separately under `data/history/research-fit/...` and linked by exact slot/run timestamp.

Player-specific recommendations may additionally carry the narrow runner-supported `rec.feed` identity object required by production governance. That identity object is execution provenance, not bulky Research Fit metadata.

The issued payload remains authoritative for the recommendation. The sidecar records research/provenance context and must not rewrite issued status, price, fair value, `playTo`, stake or analysis.

**Reason:** This captures richer audit data without making already-long `#run=` links unnecessarily larger or risking runner compatibility.

## D-023 — Configure all five lanes consistently; accept behavior incrementally

**Status:** Active principle; original acceptance completed

The project owner deliberately chose to configure all five scheduled report lanes consistently so Research Fit/history behavior would not be forgotten or drift between lanes. The 15:15 and 18:15 live chains were used as the first acceptance pair in the earlier v0.9/v1.7 phase.

The same principle now applies to Core v1.4: configure every possible seasonal report trigger consistently, then judge actual behavior through live operating evidence rather than assuming configuration alone proves success.

**Reason:** Configuration consistency and live acceptance are different questions. Preconfiguring all lanes reduces administrative drift while live evidence verifies the actual path.

## D-024 — H-track issued history is separate from Shadow History

**Status:** Active

The H-track records what Betting Edge actually issued: immutable report archives, Research/Core/Walters provenance sidecars, `run-history.json`, compact Git-backed odds-snapshot indexing, same-day lineage and archive-backed navigation.

H-track history remains intentionally separate from the S-track / Shadow History concept, which is still inactive and would concern broader prospective candidate-level calibration if later approved.

**Reason:** Durable auditability of issued reports is useful without activating a more complex candidate-level Shadow History collector.

## D-025 — v0.9 operational contract promotion

**Status:** Superseded by Contract v1.0 on 2026-08-22

`BETTING_EDGE_CONTRACT.md` was deliberately promoted as version 0.9 operational on 2026-08-15. This entry records that historical promotion; current production authority is Contract v1.0.

**Reason:** Production authority should be explicit, auditable and fail closed rather than depend on conversational memory or an implicitly promoted draft.

## D-026 — Exact player-prop identity is a hard production invariant

**Status:** Active; inherited into Contract v1.0 / Core v1.4

Every displayed player-specific prop must validate exact event, player, market, side, line and approved-book quote. When feed context is insufficient, current player/team/game participation is validated with authoritative current information.

Every displayed player prop preserves exact machine-readable `rec.feed` identity in the issued payload. Ambiguous identity forces zero stake, and a later different prop line is treated as a different selection rather than an exact reprice.

**Reason:** Player props are especially vulnerable to fuzzy identity and line-substitution errors. Exact structured identity allows safe issuance, durable auditability and exact repricing.

## D-027 — Preserve structured identity for every displayed game market

**Status:** Active

All scheduled report lanes preserve exact machine-readable `rec.feed` identity for every displayed moneyline, spread and game total, regardless of BET / LEAN / WAIT / PASS status. The identity is copied from the exact live-odds event, market and selection used for issuance and is not reconstructed from display text.

Existing immutable reports without `rec.feed` remain valid and use fail-closed fallback matching.

**Reason:** Exact structured identity prevents ordinary game cards from depending on lossy title parsing while preserving compatibility with archived reports.

## D-028 — Report recovery stays in the original lane

**Status:** Active operating decision

When a standard report lane fails to produce a usable issued report but the relevant betting window can still be meaningfully recovered, the recovery is a new issuance in the **same canonical lane**. It is not a sixth report lane.

The recovery keeps the original slot, appends `— RECOVERY`, uses the actual issue time and must pass the same current production gates as a normal report. It requests another odds pull only when necessary and still useful. Every recovery is archived as a separate immutable issuance and never overwrites earlier genuine reports.

**Reason:** Recovery should restore report coverage without relaxing confidence, pricing or identity requirements or creating a parallel report architecture.

## D-029 — Runner UI patch versions may advance independently

**Status:** Active principle; v1.3.1 example is historical

The earlier v1.3.1 presentation patch demonstrated that the UI version can advance independently from the report engine/core and governance contract. Current production now uses VigScope UI v1.5 and Core v1.4, still on independent version tracks.

A presentation-only version change must not be treated as a Core or Contract promotion and must not migrate issued payloads/history or change decision semantics unless explicitly designed to do so.

**Reason:** Independent presentation versioning preserves an accurate audit trail without implying analytical or governance changes that did not occur.

## D-030 — Core v1.4 is the forward production baseline

**Status:** Active as of 2026-08-25

Core v1.4 became operational forward-only at `2026-08-25T17:20:00-07:00`. It preserves the proven v1.3 execution baseline while adding explicit fair-value-basis/model-error classification, fixed Research v1.8 uncertainty graduation, Stage 2 personnel sensitivity, tighter WAIT discipline and switchable Walters authority.

Post-cutover reports require structured `coreAssessment` and `waltersEvidence` and are machine-checked by the Core v1.4 publication gate. Historical Core v1.3 reports remain immutable.

Scheduled lanes target up to **nine meaningful cards**. Nine is a review/presentation target, not a BET quota; weaker standards or filler are forbidden merely to reach nine.

**Reason:** Core v1.4 makes uncertainty and independent-support requirements explicit without loosening the hard execution/risk boundary.

## D-031 — Cloudflare is primary; GitHub provides a two-minute odds dispatch backstop

**Status:** Active as of 2026-08-25

Cloudflare Worker Cron remains the primary odds scheduler. After the Cloudflare→GitHub handoff missed the 18:05 MLB pulse on 2026-08-25, `.github/workflows/odds-refresh-backstop.yml` was added as a narrow two-minute recovery layer.

The backstop wakes after currently configured possible seasonal pulses, resolves the active profile and checks whether the operating-date/profile/canonical slot already published. If present it does nothing; if missing it dispatches the existing protected odds workflow.

The target workflow retains serialization, profile validation, canonical-slot duplicate protection and the five-primary-pull daily cap. Manual dispatch remains the final human fallback.

Scheduler canaries are retired and are not part of this architecture.

The native Cloudflare dispatch path still requires reliability diagnosis. The backstop remains until that path proves dependable over multiple slots.

**Reason:** Recover a missed scheduler handoff without reintroducing paired Odds-API pulls or weakening quota/duplicate safeguards.

## D-032 — Research Library v1.8 is production read-only authority

**Status:** Active as of 2026-08-25

Research Library v1.8 / R3 is the production Research authority. Normal History Fit remains read-only and cannot create BET, supply executable price, directly move the fair point estimate, lower model error or set stake.

Core v1.4 has a fixed graduated Research allowlist that may **raise** the model-error floor when a documented uncertainty/calibration rule applies. That controlled uncertainty effect is part of Core v1.4, not an unconstrained Research vote.

**Reason:** Preserve evidence-based calibration and explicit gaps without allowing Research to become a hidden second betting engine.

## D-033 — Result Closure is a separate version-tolerant audit layer

**Status:** Active as of 2026-08-25

The daily 05:00 Result Closure task may process both legacy Core v1.3 and current Core v1.4 issued cards. It grades the issued selection under the historical issuance record and writes only observation sidecars.

It must never mutate issued status, price, fair, `playTo`, stake, `coreAssessment`, Walters evidence, personnel evidence or schema-3 Core/Research/Walters provenance.

Current verification quotas remain 20 previous-day unique events plus 10 older backlog unique events, deduplicated by exact event identity.

**Reason:** Outcome auditing should remain useful across Core versions without turning retrospective results into a silent re-handicap or learning loop.

## D-034 — Crypto Specials remains independent from Core v1.4

**Status:** Active as of 2026-08-25

Crypto Specials is a separate editorial/research pipeline scheduled at 10:30 America/Vancouver. It may use market-information concepts such as current/best price, line shopping, no-vig probability, book disagreement, movement, market maturity and target-price discipline.

It does not run Core v1.4 model-error, Walters authority, VigScope publication, Betting Edge report-history publication or betting-ledger writes. It writes only `data/crypto-specials.json`.

The 10:30 schedule avoids the NBA/NHL 11:00 seasonal report-time collision.

**Reason:** Preserve the value of the Crypto Specials workflow without contaminating Core production governance or creating unnecessary schedule contention.

## D-035 — One permanent Main Betting Edge schedule replaces seasonal profiles

**Status:** Active as of 2026-09-06

Betting Edge permanently uses the former MLB/Summer clock as its Main schedule: 06:00, 08:00, 09:30, 15:15 and 18:15 report runs in `America/Vancouver`, with their existing ten-minute-prior odds pulses.

The unused NFL and NBA/NHL seasonal clocks, daily profile state, profile-switch workflow and Preferences schedule module are removed. Canonical lane names and established schedule compatibility metadata remain so current report generation and immutable History do not require migration.

Cloudflare remains the single automatic odds scheduler, the protected odds workflow remains serialized and duplicate-gated, and the five-primary-pull daily cap is unchanged. This decision does not change pricing, odds collection, report analysis, publication, Graham/Walters tasks, Crypto Specials or any canary.

**Reason:** Remove unused choice and resolution layers while preserving the schedule and operational boundaries already in use.

---

When a durable architectural or operational choice changes, append or amend the relevant decision here and update `docs/PROJECT_STATE.md` if the active system state also changed.

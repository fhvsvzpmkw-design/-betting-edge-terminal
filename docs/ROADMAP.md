# Betting Edge — Roadmap

**Last updated:** 2026-08-15

This roadmap separates completed foundations from active near-term work and later integration. It is intentionally conservative: preserve the working pipeline, prove each new layer independently, then integrate deliberately.

## Completed foundations

### Repository and deployment

- GitHub repository is the active project source.
- Direct GitHub create/update/delete capability has been tested successfully.
- Repository safety policy is documented in `README.md`.
- Git history is the authoritative rollback system.
- GitHub Pages deployment is part of the verification path for web changes.

### Runner / terminal

- Runner is at **v1.3**.
- Static shell is aligned to v1.3.
- `runner.html.old` remains as a convenient quick backup.
- Device-local prior-run history exists.
- Session switching exists for the five standard report windows.
- Repricing is implemented as an overlay over the immutable issued report.
- Bet365 / DraftKings best-price selection and deterministic equal-price tie handling are implemented.
- Structured identity matching is preferred over text fallback.

### Odds reliability

- Odds-API.io refresh workflow exists.
- Bet365 and DraftKings are the active pricing books.
- Paired/backup schedule attempts exist for report windows.
- Zombie protection rejects badly delayed scheduled runs before quota use.
- Hard request budgeting and safety reserve exist.
- Invalid refreshes are designed to preserve the prior good feed.
- Scheduler Canary v1 and v2 provide independent diagnostic signals.

### Data / research / governance

- Betting ledger is in repository data.
- Research Library **1.7** is canonical and read-only.
- Research manifest is compatible with contract draft **0.8** for planned R2 manual-read testing.
- Contract draft v0.8 exists and is explicitly non-operational.
- Research and contract are intentionally isolated from normal scheduled report execution.

## Priority 0 — Preserve and prove operational reliability

These items come before deeper architectural integration.

### P0.1 — Observe the full 18:15 chain

Run/observe a complete late-session sequence:

1. scheduled odds refresh around the 17:55 target;
2. resulting live feed;
3. 18:15 Betting Edge report;
4. runner load;
5. reprice operation;
6. comparison categorization.

**Success condition:** all layers complete without manual repair and the output states are explainable.

### P0.2 — Trace any remaining `UNCATEGORIZED` output

If an actual run still shows `UNCATEGORIZED`:

- capture the exact run payload;
- determine whether the value originated in report generation, payload normalization, runner rendering, or upstream odds categorization;
- patch only the producing layer;
- compare the result against the known-good runner/workflow state.

Do not make a speculative runner change without reproducing the source.

### P0.3 — Continue scheduler observation

Use odds-refresh runs plus both canaries to determine whether GitHub scheduled dispatch remains reliable over multiple windows.

**Goal:** reduce unnecessary manual refreshes while retaining a clear manual recovery path.

## Priority 1 — History and historical evidence

### P1.1 — Develop the History box

Expand the terminal's History area from basic prior-run storage into useful decision context without turning it into clutter.

Candidate outputs:

- prior same-day report evolution;
- recommendation status changes;
- price movement history;
- relevant historical-fit context;
- compact links/summaries rather than dumping raw history.

The UI should remain secondary to the live decision card.

### P1.2 — Run Research Library R2 manual-read testing

Next manifest stage: `R2_MANUAL_READ_TEST`.

Test whether Research Library evidence can improve analysis when deliberately read by the report process **without runtime writes and without automatic scheduled linkage**.

Questions to answer:

- Is the retrieved evidence relevant to the current market?
- Does it improve explanation or calibration?
- Does it introduce hindsight leakage or false precision?
- Is the taxonomy/canonicalization sufficient for MLB, NHL, NBA, NFL and other major leagues?
- Can historical evidence be summarized compactly enough for terminal output?

### P1.3 — Build History Fit carefully

History Fit should calibrate a current recommendation against relevant historical evidence rather than act as a simplistic win-rate score.

Potential dimensions:

- sport / league;
- market type;
- price band;
- favorite/underdog profile;
- timing / market movement;
- historical sample quality;
- similarity confidence.

Hard rule: weak or non-comparable history must be allowed to say **insufficient fit** rather than forcing a score.

## Priority 2 — Personal ledger integration

The personal betting ledger is useful but should remain separate from broad research evidence.

### P2.1 — Define the user-history interface

Design how a user's uploaded/persisted ledger can provide secondary context such as:

- sport-specific performance;
- market-type performance;
- timing tendencies;
- repeated behavioral strengths/weaknesses;
- risk/stake adherence.

### P2.2 — Prevent circular decision logic

Personal history should not become a reason to recommend a bet merely because the user has historically liked that type of bet.

Use it as calibration/context, not as a replacement for current market value and matchup analysis.

### P2.3 — Support per-user ledgers later

Longer-term architecture should allow different users to supply their own ledger while the canonical Research Library remains shared and read-only.

## Priority 3 — Contract activation

Contract draft v0.8 should remain non-operational until the prior stages are stable.

### P3.1 — Preflight current production state

Before activation:

- verify repository/branch;
- verify current runner version and checksum/state;
- verify odds-refresh workflow state;
- verify report timestamp semantics;
- verify deterministic sportsbook tie handling;
- verify Research Library compatibility metadata;
- verify rollback commit.

### P3.2 — Connect contract deliberately

Create a controlled integration step rather than simply renaming the draft.

**Required:** a clear before/after diff, test run, and rollback procedure.

### P3.3 — Promote only after validation

Only after successful integration testing should a production contract filename/state be considered.

## Priority 4 — Broader refinement

These are lower priority than reliability/history integration.

### Market/source coverage

- Evaluate whether additional free books/sources provide enough incremental value to justify added request complexity.
- Improve DraftKings coverage diagnostics where markets are absent.
- Preserve no-paid-subscription constraint unless the project owner deliberately changes it.

### Terminal clarity

- Continue improving explanatory language and category naming.
- Keep visual changes incremental and separate from pipeline debugging.
- Preserve compact terminal-style presentation.

### Automated project health

Potential future health checks:

- Pages deployment failure;
- odds-refresh workflow failure;
- repeated zombie/missed schedule behavior;
- canary failure;
- stale live feed near a report window;
- research/checksum integrity failure.

Automation should notify only on meaningful health changes rather than producing routine noise.

## Explicit non-goals for the current phase

- No broad rewrite of Betting Edge's live decision process.
- No automatic Research Library writes during normal reports.
- No automatic production activation of contract v0.8.
- No unnecessary paid data subscription.
- No speculative fixes across multiple layers when one layer has not been proven faulty.
- No replacement of the issued report during repricing.

## Working principle

**Stabilize → observe → validate → document → integrate.**

When an item becomes active or complete, update this file and `docs/PROJECT_STATE.md` together so the roadmap and current-state documentation do not drift apart.

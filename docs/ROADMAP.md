# Betting Edge — Roadmap

**Last updated:** 2026-08-15 — v1.8 candidate frozen; v1.7 production soak active

This roadmap separates completed foundations from active near-term work and later integration. Preserve the working pipeline, prove each new layer independently, and keep unrelated change families separate.

## Completed foundations

### Repository and deployment

- GitHub repository is the active project source.
- Direct GitHub create/update/delete capability has been tested successfully.
- Repository safety policy is documented in `README.md`.
- Git history is the authoritative rollback system.
- GitHub Pages deployment remains part of the verification path for web changes.

### Runner / terminal

- Runner is at **v1.3**.
- Static shell is aligned to v1.3.
- `runner.html.old` remains a convenient quick backup.
- Device-local prior-run history exists as a fallback/cache.
- Repository-backed same-day session switching exists for the five standard report windows through `r.html` + `run-history.json`.
- Repricing is an overlay over the immutable issued report.
- Bet365 / DraftKings best-price selection and deterministic equal-price tie handling are implemented.
- Structured identity matching is preferred over text fallback.
- Player-prop `rec.feed` exact identity is supported by the current runner.
- Meter-only terminal UI patch passed the 18:15 live regression.

### Odds reliability and provenance

- Odds-API.io refresh workflow exists.
- Bet365 and DraftKings are the active pricing books.
- Paired/backup schedule attempts exist for report windows.
- Zombie protection rejects badly delayed scheduled runs before quota use.
- Hard request budgeting and safety reserve exist.
- Invalid refreshes are designed to preserve the prior good feed.
- Scheduler canaries provide independent diagnostic signals.
- `data/history/odds-index.json` exists as a compact snapshot-provenance index.
- `.github/workflows/odds-history-index.yml` is an isolated post-refresh indexing workflow; it does not modify the production odds-refresh workflow.
- Full odds snapshots remain authoritative in Git history and are not duplicated into the history directory.

### Data / research / governance

- Betting ledger is in repository data.
- Durable issued-run storage and `run-history.json` are established.
- Research Library **1.7** is canonical and read-only.
- Research Library **1.8** promotion candidate is fully built/tested in staging only: 120 logical items, 100 source records, 26 evidence clusters; Candidate Freeze R2 24/24, narrative tests 15/15, hard-boundary tests 9/9.
- v1.8 promotion is explicitly **ON HOLD** while production v1.7 completes an operational soak and shadow comparison period.
- R2 manual Research Library read testing passed for direct/mixed evidence, era conflict and explicit research-gap handling.
- `data/history/report-provenance-schema.json` is now **schema 3** for post-cutover production sidecars; schema-2 historical sidecars remain valid.
- All five scheduled report lanes are configured for exact issued-payload archive plus read-only Research Fit/provenance sidecars.
- 15:15 + 18:15 live archive/index/lineage acceptance passed on 2026-08-15.
- `BETTING_EDGE_CONTRACT.md` **v0.9 is OPERATIONAL**.
- All five scheduled report lanes now perform production-contract/runner preflight before handicapping.
- Player-prop executable identity tightening is operational as v0.9 Invariant 23.
- v0.8/v0.9 draft files remain preserved historical design artifacts.

## Priority 0 — Verify the first post-cutover full day

v0.9 is active. The next goal is operational observation, not another contract change.

### P0.1 — Verify 06:00 production preflight and archive

On the first post-cutover 06:00 run verify:

1. `BETTING_EDGE_CONTRACT.md` resolves as operational v0.9 before analysis;
2. current runner v1.3 resolves;
3. fresh odds feed is used normally;
4. exact issued payload is archived;
5. schema-3 sidecar records exact production contract blob SHA;
6. `run-history.json` receives the correct `open` entry;
7. compact short link resolves normally;
8. long fallback remains equivalent and available.

### P0.2 — Verify 08:00 and 09:30 source-backed morning lineage

Confirm later morning lanes can hydrate/use the actual archived earlier morning reports while preserving date boundaries and without treating same-day report history as an extra Research Library vote.

### P0.3 — Verify 15:15 and 18:15 under production contract

Repeat the already-accepted history/share behavior with schema-3 production-contract provenance.

### P0.4 — Fresh-device / late-arrival history test

After multiple same-day lanes have archived, open Betting Edge on a browser/device with no local runner history.

**Success condition:** successfully archived earlier same-day lanes appear through repository-backed history. `CLEAR LOCAL HISTORY` must not remove repository-backed reports.

### P0.5 — Continue scheduler observation

Use odds-refresh runs plus scheduler canaries to determine whether scheduled dispatch remains reliable over multiple windows.

Goal: reduce unnecessary manual refreshes while retaining a clear manual recovery path.

### P0.6 — Trace any remaining `UNCATEGORIZED` output

If an actual run still shows `UNCATEGORIZED`:

- capture the exact run payload;
- determine whether the value originated in report generation, payload normalization, runner rendering, or upstream odds categorization;
- patch only the producing layer;
- compare the result against the known-good runner/workflow state.

Do not make a speculative runner change without reproducing the source.

### P0.7 — Complete v1.7 History Fit soak before any v1.8 promotion

Production Research Library **v1.7** remains the runtime authority. The completed v1.8 candidate stays frozen in staging.

Minimum gate before reopening promotion:

1. observe at least one complete five-lane production day on v1.7;
2. review real History Fit retrieval relevance, grade reasonableness, explanation quality, NR handling and deduplication;
3. shadow-compare v1.8 against the same real candidates without changing issued reports;
4. confirm no R3 hard-boundary regression;
5. require explicit promotion approval.

The frozen v1.8 candidate may be used for shadow evaluation only. It must not alter fair value, play-to, status, model error, stake, executable price, runner output, production manifest or scheduled-report authority.

## Priority 1 — History and learning evidence

### P1.1 — Develop the lower History box

Expand the terminal's History area from basic same-day navigation into useful repository-backed decision context without turning it into clutter.

Candidate outputs:

- prior same-day report evolution;
- recommendation status changes;
- prior issued price and `playTo`;
- relevant Research Fit evolution;
- later result/CLV context when available;
- compact links/summaries rather than raw-history dumps.

Keep this separate from the v0.9 production cutover and from odds-refresh workflow changes.

### P1.2 — Add result / CLV observation history

After the full five-lane archive behavior is observed reliably, add a later observation layer for:

- subsequent verified prices;
- closing price / CLV;
- result/outcome;
- whether the thesis failed because of price, handicap, information timing or normal variance.

Do not rewrite the original issued report when adding later observations.

### P1.3 — Shadow History remains separate

Shadow History remains **S0 / inactive**. Before activation it needs explicit design for candidate-level prospective calibration, storage growth, evaluation cadence and separation from actual issued-report history.

Durable H-track report history is not Shadow History.

## Priority 2 — Player-prop identity and learning

### P2.1 — Observe v0.9 player-prop identity in live reports

The first live player-specific recommendation after cutover should be checked for:

- exact event/player/market/side/line identity;
- complete `rec.feed` fields;
- correct zero-stake failure behavior on ambiguity;
- unchanged identity in the archived issued payload;
- exact-line repricing rather than silent line substitution.

### P2.2 — Grow player/team association evidence from existing odds history

Use accumulated structured odds snapshots/history to learn recurring player/team associations for MLB, NFL/NCAAF/CFL, NBA/WNBA and NHL without making a separate roster database mandatory for execution.

Any learned association layer must remain subordinate to current authoritative participation validation when identity is uncertain.

### P2.3 — Review odds-refresh player-prop coverage

Continue reviewing `.github/workflows/odds-refresh.yml` for sport-specific player-prop coverage, identity completeness and request efficiency. Do not increase request volume merely to collect redundant identity information.

## Priority 3 — Personal ledger integration

The personal betting ledger is useful but should remain separate from broad research evidence.

### P3.1 — Define the user-history interface

Design how a user's uploaded/persisted ledger can provide secondary context such as:

- sport-specific performance;
- market-type performance;
- timing tendencies;
- repeated behavioral strengths/weaknesses;
- risk/stake adherence.

### P3.2 — Prevent circular decision logic

Personal history should not become a reason to recommend a bet merely because the user has historically liked that type of bet.

Use it as calibration/context, not as a replacement for current market value and matchup analysis.

### P3.3 — Support per-user ledgers later

Longer-term architecture should allow different users to supply their own ledger while the canonical Research Library remains shared and read-only.

## Priority 4 — Contract evolution

v0.9 activation is complete. Future governance work is now **post-v0.9 evolution**, not activation.

Potential future contract work must follow explicit versioned change control and live regression testing. Likely candidates include:

- formal result/CLV observation governance;
- Shadow History activation rules if approved;
- learned player/team association governance;
- any future authenticated central persistence of browser-side repricing;
- major changes to supported books, freshness gates, staking methodology or report payload architecture.

Do not edit v0.9 merely to make a failing implementation appear compliant. Diagnose the failing layer first.

## Priority 5 — Broader refinement

### Market/source coverage

- Evaluate whether additional free books/sources provide enough incremental value to justify added request complexity.
- Improve DraftKings coverage diagnostics where markets are absent.
- Preserve the no-paid-subscription constraint unless the project owner deliberately changes it.

### Terminal clarity

- Continue improving explanatory language and category naming only when a real output exposes a need.
- Keep visual changes incremental and separate from pipeline debugging.
- Preserve compact terminal-style presentation.
- Current meter design is a known-good UI checkpoint.

### Automated project health

Potential future health checks:

- Pages deployment failure;
- odds-refresh workflow failure;
- odds-history-index workflow failure;
- repeated zombie/missed schedule behavior;
- canary failure;
- stale live feed near a report window;
- production-contract preflight failure;
- research/checksum integrity failure;
- missing issued-report or schema-3 sidecar archive after a scheduled report.

Automation should notify only on meaningful health changes rather than producing routine noise.

## Explicit non-goals for the current phase

- No broad rewrite of Betting Edge's live decision process.
- No automatic Research Library writes during normal reports.
- No Shadow History activation without separate approval.
- No bulky structured research metadata inside long runner URLs.
- No unnecessary paid data subscription.
- No speculative fixes across multiple layers when one layer has not been proven faulty.
- No replacement of the issued report during repricing or later result/CLV enrichment.
- No claim that individual browser reprice clicks are centrally archived.
- No weakening of production-contract preflight to hide scheduler/history failures.

## Working principle

**Stabilize → observe → validate → document → integrate.**

v0.9 has completed the integration step. The immediate cycle now returns to **observe → validate** on the first full post-cutover day.

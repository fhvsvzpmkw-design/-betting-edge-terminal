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

### Odds reliability and provenance

- Odds-API.io refresh workflow exists.
- Bet365 and DraftKings are the active pricing books.
- Paired/backup schedule attempts exist for report windows.
- Zombie protection rejects badly delayed scheduled runs before quota use.
- Hard request budgeting and safety reserve exist.
- Invalid refreshes are designed to preserve the prior good feed.
- Scheduler Canary v1 and v2 provide independent diagnostic signals.
- `data/history/odds-index.json` now exists as a compact snapshot-provenance index.
- `.github/workflows/odds-history-index.yml` is an isolated post-refresh indexing workflow; it does not modify the production odds-refresh workflow.
- Full odds snapshots remain authoritative in Git history and are not duplicated into the history directory.

### Data / research / governance

- Betting ledger is in repository data.
- Durable issued-run storage and `run-history.json` schema 2 are established.
- Research Library **1.7** is canonical and read-only.
- Research metadata is aligned to contract draft **0.8** while preserving the library's original build-time header as historical provenance.
- R2 manual Research Library read testing passed for direct/mixed evidence, era conflict and explicit research-gap handling.
- `data/history/report-provenance-schema.json` defines a separate Research Fit/provenance sidecar so structured history does not enlarge the runner link.
- Contract draft v0.8 exists and remains explicitly non-operational.

## Priority 0 — Preserve and prove operational reliability

These items come before broader architectural integration.

### P0.1 — Verify the 15:15 durable-history pilot

The 15:15 EVENING lane is the first controlled live integration of read-only Research Fit plus a durable sidecar.

Observe the complete chain:

1. scheduled odds refresh around the 14:55 target;
2. resulting `data/live-odds.json` snapshot;
3. post-refresh `odds-history-index.yml` run and compact odds-index entry;
4. 15:15 Betting Edge report;
5. exact issued payload saved under `data/history/runs/...`;
6. matching structured sidecar saved under `data/history/research-fit/...`;
7. `run-history.json` entry links both records;
8. runner link loads normally with no payload-shape/URL regression.

**Success condition:** the full chain completes without altering recommendation logic, runner payload shape, production odds refresh, or report delivery.

### P0.2 — Observe the full 18:15 chain

After the 15:15 history pilot is verified, continue the previously planned late-session sequence:

1. scheduled odds refresh around the 17:55 target;
2. resulting live feed;
3. 18:15 Betting Edge report;
4. runner load;
5. reprice operation;
6. comparison categorization.

**Success condition:** all layers complete without manual repair and the output states are explainable.

### P0.3 — Trace any remaining `UNCATEGORIZED` output

If an actual run still shows `UNCATEGORIZED`:

- capture the exact run payload;
- determine whether the value originated in report generation, payload normalization, runner rendering, or upstream odds categorization;
- patch only the producing layer;
- compare the result against the known-good runner/workflow state.

Do not make a speculative runner change without reproducing the source.

### P0.4 — Continue scheduler observation

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

### P1.2 — Research Library R2 manual-read testing — COMPLETE

Stored test: `research/tests/R2_MANUAL_READ_TEST_2026-08-15.json`.

Validated behaviors:

- direct/mixed MLB movement evidence remained independent rather than automatically supporting a prior pick;
- NBA historical totals evidence preserved era drift and later-replication conflict;
- an explicit boxing-derivative evidence gap returned **NR** rather than a forced analogy;
- research did not create a BET, provide an executable price, or directly change fair value, `playTo`, status or stake.

### P1.3 — Verify structured History Fit sidecars

Active pilot: **15:15 EVENING only**.

For each displayed recommendation, preserve separately from the runner payload:

- Research Library version;
- primary prior IDs and optional synthesis/inference ID;
- evidence-cluster IDs after deduplication;
- A/B/C/D/NR History Fit grade;
- directness and transportability;
- mechanism and strongest limitation;
- exact History Fit display text used in the report;
- feed/runner/research provenance blob SHAs where available.

Hard rule: the issued report remains authoritative for the recommendation; the sidecar is an audit/context record and may not rewrite it.

### P1.4 — Roll structured capture to all report lanes

Only after the 15:15 pilot is verified:

- apply the same read-only Research Fit/sidecar behavior to 06:00, 08:00, 09:30 and 18:15;
- mark scheduled Research Library linkage in the manifest;
- verify at least one complete five-lane day.

### P1.5 — Add result / CLV observation history

After issued reports and odds snapshots are reliably linked, add a later observation layer for:

- subsequent verified prices;
- closing price / CLV;
- result/outcome;
- whether the thesis failed because of price, handicap, information timing or normal variance.

Do not rewrite the original issued report when adding later observations.

### P1.6 — Short shareable runner links

Once real archived report payloads exist reliably, add a runner lookup path such as `?id=<short-id>` that loads the stored report from repository-backed history while preserving the existing `#run=` long-link behavior as backwards compatibility.

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

## Priority 3 — Contract evolution and activation

Contract draft v0.8 remains non-operational while the new history/provenance system is being proven.

### P3.1 — Draft v0.9 after the live history chain is proven

Use the working implementation—not an untested design—to formalize:

- issued-report immutability;
- compact odds-snapshot provenance;
- Research Fit retrieval boundaries;
- structured Research Fit/provenance sidecars;
- history-save failure behavior;
- later CLV/result observations without hindsight rewriting.

### P3.2 — Preflight current production state

Before any production contract activation:

- verify repository/branch;
- verify current runner version and checksum/state;
- verify odds-refresh workflow state;
- verify report timestamp semantics;
- verify deterministic sportsbook tie handling;
- verify Research Library compatibility metadata;
- verify durable-history behavior;
- verify rollback commit.

### P3.3 — Connect contract deliberately

Create a controlled integration step rather than simply renaming a draft.

**Required:** a clear before/after diff, test run, and rollback procedure.

### P3.4 — Promote only after validation

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
- odds-history-index workflow failure;
- repeated zombie/missed schedule behavior;
- canary failure;
- stale live feed near a report window;
- research/checksum integrity failure;
- missing issued-report or sidecar archive after a scheduled report.

Automation should notify only on meaningful health changes rather than producing routine noise.

## Explicit non-goals for the current phase

- No broad rewrite of Betting Edge's live decision process.
- No automatic Research Library writes during normal reports.
- No automatic production activation of contract v0.8.
- No bulky structured research metadata inside long runner URLs.
- No rollout of the sidecar pilot to all five lanes before live verification.
- No unnecessary paid data subscription.
- No speculative fixes across multiple layers when one layer has not been proven faulty.
- No replacement of the issued report during repricing.

## Working principle

**Stabilize → observe → validate → document → integrate.**

When an item becomes active or complete, update this file and `docs/PROJECT_STATE.md` together so the roadmap and current-state documentation do not drift apart.

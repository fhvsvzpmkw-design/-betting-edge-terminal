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
- `data/history/odds-index.json` exists as a compact snapshot-provenance index.
- `.github/workflows/odds-history-index.yml` is an isolated post-refresh indexing workflow; it does not modify the production odds-refresh workflow.
- Full odds snapshots remain authoritative in Git history and are not duplicated into the history directory.

### Data / research / governance

- Betting ledger is in repository data.
- Durable issued-run storage and `run-history.json` schema 2 are established.
- Research Library **1.7** is canonical and read-only.
- R2 manual Research Library read testing passed for direct/mixed evidence, era conflict and explicit research-gap handling.
- `data/history/report-provenance-schema.json` schema 2 defines a separate Research Fit/provenance sidecar so structured history does not enlarge the runner link.
- All five scheduled report lanes are configured for exact issued-payload archive plus read-only Research Fit/provenance sidecars.
- Research metadata is aligned to contract draft **0.9**, with R3 behavior staged and live verification pending.
- Contract draft **v0.9** exists as a non-operational durable-history/provenance successor that inherits v0.8 in full except for explicit additions/overrides.
- v0.8 remains untouched as the v0.9 baseline/reference.

## Priority 0 — Verify the staged live chain

These items come before broader UI or production-contract activation.

### P0.1 — Verify the 15:15 durable-history chain

Observe the complete chain:

1. scheduled odds refresh around the 14:55 target;
2. resulting `data/live-odds.json` snapshot;
3. post-refresh `odds-history-index.yml` run and compact odds-index entry;
4. 15:15 Betting Edge report using candidate-first, read-only Research Fit;
5. exact issued payload saved under `data/history/runs/...`;
6. matching structured sidecar saved under `data/history/research-fit/...`;
7. `run-history.json` entry links both records;
8. runner link loads normally with no payload-shape/URL regression.

**Success condition:** the full chain completes without altering recommendation logic, runner payload shape, production odds refresh, stake/risk invariants, or report delivery.

### P0.2 — Verify the 18:15 chain and same-day lineage

Repeat the full archive/provenance checks around the 17:55/18:15 window and additionally verify that later analysis can use the actual archived 15:15 record when the same candidate persists.

Check:

- earlier status/price/`playTo`/History Fit comes from stored evidence where available;
- current movement remains distinct from Research Fit;
- same-day lineage is not counted as an extra historical-research vote;
- runner reprice/comparison still behaves normally.

**Success condition:** 15:15 + 18:15 together satisfy the first preferred H3/R3 live-acceptance pair.

### P0.3 — Verify the next morning lanes

Because all five schedules are already staged, observe the next 06:00, 08:00 and 09:30 runs after the late-day acceptance pair.

**Goal:** confirm the same bounded Research Fit/history behavior works across every lane without schedule, payload, pricing, or risk regression.

### P0.4 — Trace any remaining `UNCATEGORIZED` output

If an actual run still shows `UNCATEGORIZED`:

- capture the exact run payload;
- determine whether the value originated in report generation, payload normalization, runner rendering, or upstream odds categorization;
- patch only the producing layer;
- compare the result against the known-good runner/workflow state.

Do not make a speculative runner change without reproducing the source.

### P0.5 — Continue scheduler observation

Use odds-refresh runs plus both canaries to determine whether GitHub scheduled dispatch remains reliable over multiple windows.

**Goal:** reduce unnecessary manual refreshes while retaining a clear manual recovery path.

## Priority 1 — History and historical evidence

### P1.1 — Develop the History box

Expand the terminal's History area from basic prior-run storage into useful repository-backed decision context without turning it into clutter.

Candidate outputs:

- prior same-day report evolution;
- recommendation status changes;
- prior issued price and `playTo`;
- relevant Research Fit evolution;
- later result/CLV context when available;
- compact links/summaries rather than raw-history dumps.

The UI should remain secondary to the live decision card. Treat this as a separate runner/UI change family after the current live history chain is verified.

### P1.2 — Research Library R2 manual-read testing — COMPLETE

Stored test: `research/tests/R2_MANUAL_READ_TEST_2026-08-15.json`.

Validated behaviors:

- direct/mixed MLB movement evidence remained independent rather than automatically supporting a prior pick;
- NBA historical totals evidence preserved era drift and later-replication conflict;
- an explicit boxing-derivative evidence gap returned **NR** rather than a forced analogy;
- research did not create a BET, provide an executable price, or directly change fair value, `playTo`, status or stake.

### P1.3 — Structured History Fit sidecars — CONFIGURED, LIVE VERIFICATION PENDING

All five scheduled lanes are configured to preserve separately from the runner payload:

- Research Library version;
- primary prior IDs and optional synthesis/inference ID;
- evidence-cluster IDs after deduplication;
- A/B/C/D/NR History Fit grade;
- directness and transportability;
- mechanism and strongest limitation;
- exact History Fit display text used in the report;
- feed/runner/research/governance-draft provenance blob SHAs where available.

Hard rule: the issued report remains authoritative for the recommendation; the sidecar is an audit/context record and may not rewrite it.

### P1.4 — Establish H3 and then observe a complete five-lane day

After the 15:15/18:15 live pair passes:

- mark H3 only if payload + sidecar + odds index + run index + runner behavior are all verified;
- observe 06:00, 08:00 and 09:30 under the same configuration;
- reconcile any missing history entries without rewriting genuine issued reports;
- update `research/manifest.json`, `docs/PROJECT_STATE.md` and this roadmap to the proven state.

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

Contract draft v0.9 now exists but remains explicitly non-operational.

### P3.1 — Draft v0.9 durable-history/provenance governance — COMPLETE

`BETTING_EDGE_CONTRACT_DRAFT_v0.9.md` now formalizes:

- issued-report immutability;
- exact issued-payload authority;
- compact odds-snapshot provenance;
- Research Fit retrieval/persistence boundaries;
- structured Research Fit/provenance sidecars;
- history-save failure behavior;
- H-track activation states;
- separation between durable issued history and Shadow History;
- later CLV/result observations without hindsight rewriting.

v0.9 inherits v0.8 in full except where its delta explicitly adds or overrides history/provenance rules.

### P3.2 — Validate v0.9 assumptions with live H3/R3 evidence

Use the 15:15 and 18:15 live chains to test the architecture documented in v0.9.

Do not change v0.9 merely to make a failing implementation appear compliant. Diagnose whether a failure is in configuration, storage, index logic, Research Fit retrieval, or contract design.

### P3.3 — Preflight current production state

Before any production contract activation:

- verify repository/branch;
- verify current runner version and checksum/state;
- verify odds-refresh workflow state;
- verify report timestamp semantics;
- verify deterministic sportsbook tie handling;
- verify Research Library compatibility metadata;
- verify durable-history behavior;
- verify rollback commit.

### P3.4 — Connect contract deliberately

Create a controlled integration step rather than simply renaming a draft or treating sidecar provenance as authority.

**Required:** a clear before/after diff, test run, equivalence comparison and rollback procedure.

### P3.5 — Promote only after validation

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
- No automatic production activation of contract v0.9.
- No bulky structured research metadata inside long runner URLs.
- No claim that all-five-lane staging is already proven live integration.
- No unnecessary paid data subscription.
- No speculative fixes across multiple layers when one layer has not been proven faulty.
- No replacement of the issued report during repricing or later result/CLV enrichment.
- No claim that individual browser reprice clicks are centrally archived.

## Working principle

**Stabilize → observe → validate → document → integrate.**

When an item becomes active or complete, update this file and `docs/PROJECT_STATE.md` together so the roadmap and current-state documentation do not drift apart.

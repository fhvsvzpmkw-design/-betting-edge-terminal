# Betting Edge Governance & Report-Generation Contract — v0.9 Durable History / Provenance Delta

**Document status:** DRAFT — governance/specification only  
**Draft version:** 0.9  
**Prepared:** 2026-08-15  
**Baseline contract:** `BETTING_EDGE_CONTRACT_DRAFT_v0.8.md`  
**Baseline contract Git blob SHA:** `7c4780aba635a6f8d1ccc38e45e8a780b94ae1e4`  
**Repository target:** `fhvsvzpmkw-design/-betting-edge-terminal`  
**Approved branch for preflight:** `main`  
**Research Library version at preparation:** `1.7`  
**R2 manual read validation:** `research/tests/R2_MANUAL_READ_TEST_2026-08-15.json`  
**Proposed production filename after future approval:** `BETTING_EDGE_CONTRACT.md`

> **NOT YET OPERATIONAL**
>
> This v0.9 document is a governance draft. It does **not** become the authoritative production contract merely because it exists in the repository. Existing scheduled report prompts and history infrastructure may already implement some behaviors described here, but those implementations exist independently of this draft. A future production-contract cutover still requires explicit approval and equivalence/regression testing.
>
> v0.9 inherits **all v0.8 rules in full except where this document explicitly overrides or extends them**. In particular, v0.9 does not change the 75-minute feed-freshness rule, the 30-minute exact-quote freshness rule, Bet365/DraftKings pricing rules, deterministic equal-price behavior, BET/LEAN/WAIT/PASS semantics, `playTo`, stake/risk invariants, current runner payload shape, or report times.

---

# 1. Why v0.9 Exists

v0.8 established strong execution and Research Library guardrails but intentionally left persistence secondary. Betting Edge now has a concrete, low-complexity reason to preserve more evidence:

- exact issued report payloads can be stored without changing the runner payload;
- the large `data/live-odds.json` feed is already preserved by Git history on every successful refresh;
- a compact odds index can point to exact Git snapshots without duplicating tens of megabytes per refresh;
- Research Library History Fit can be preserved in a separate sidecar with exact prior IDs and provenance;
- same-day report lineage can be reconstructed from actual issued evidence instead of memory;
- compact share links can resolve immutable archived reports without embedding the full payload in the public URL;
- this creates the foundation for later CLV, result, calibration, and History-box work.

The governing v0.9 principle is:

> **Preserve what Betting Edge knew and issued at decision time without allowing history collection to rewrite the decision.**

A second principle is equally important:

> **Auditability may become richer without making the runner payload larger or the live report more fragile.**

A third delivery principle is:

> **Shareability may improve without making the share layer a new source of betting authority.**

---

# 2. v0.9 Surgical Delta Summary

v0.9 adds the following governance to the inherited v0.8 contract:

1. **Issued Report & Market Provenance Integrity** becomes a formal invariant family.
2. Exact validated issued report payloads are preserved under `data/history/runs/`.
3. Structured Research Fit and production provenance are preserved in a separate sidecar under `data/history/research-fit/`.
4. `run-history.json` is the compact index for issued-report history; the stored issued payload remains authoritative.
5. Full odds snapshots remain authoritative in Git history for `data/live-odds.json`; they are not copied repeatedly into the history directory.
6. `data/history/odds-index.json` provides compact snapshot provenance including exact Git commit/blob identity and SHA-256.
7. `.github/workflows/odds-history-index.yml` is an independent post-refresh indexer. Its failure must not prevent or invalidate a successful odds refresh.
8. A new **H-track** governs durable issued-report/provenance history independently from the existing C-, R-, and S-tracks.
9. Durable issued-report history is **not Shadow History**. It records what was actually issued; Shadow History remains the optional future candidate-level/prospective calibration layer.
10. History and sidecar storage failures must never silently alter, rebuild, or suppress an otherwise valid issued report.
11. Research Library retrieval remains read-only. History-sidecar writes do not grant permission to mutate `research/*`.
12. Browser/client repricing remains a comparison overlay and is **not yet centrally archived**.
13. The visible runner History box is not automatically changed by this contract; UI readback remains a separate later change family.
14. A validated traditional `runner.html#run=` URL is the self-contained emergency delivery fallback and must exist independently of repository-history success.
15. After exact report archive, sidecar, and `run-history.json` indexing succeed, a compact `r.html?id=<shortId>` URL becomes the normal primary share/delivery link.
16. Short-link and long-link delivery must resolve the same issued report content; the share mechanism cannot alter the decision.
17. The short-link resolver may preload archived lane reports only from the active report's same Vancouver betting date for the five session buttons.
18. A short-link resolver failure is a presentation/discovery failure, not betting authority and not grounds to rebuild or suppress the validated report.

No other v0.8 rule changes unless explicitly stated below.

---

# 3. Additional Formal System Invariants

These invariants extend v0.8 Section 3.

## Invariant 9 — Issued report immutability

Once a validated report has been delivered, its stored issued payload is historical evidence.

> A later odds move, reprice, result, correction, Research Library update, contract revision, or share-link change must not silently rewrite the original issued payload.

Corrections must create a new explicitly related record with a new timestamp or correction identifier.

Routine report generation must never overwrite or delete a prior genuine issued payload.

---

## Invariant 10 — Exact issued-payload authority

For an archived report:

> The JSON object stored under `data/history/runs/YYYY-MM-DD/<slot>-HHMMSS.json` must be the same validated payload object used to construct the delivered runner link.

Readable JSON formatting may differ from compact serialization whitespace, but recommendation values and issued fields must not be changed for storage.

If `run-history.json`, a short-link resolver, and the stored payload disagree, the stored issued payload is authoritative.

---

## Invariant 11 — Research sidecar referential integrity

A Research Fit/provenance sidecar must identify the exact issued report it enriches.

Required relationship:

- same `slot`;
- same `run.ts`;
- exact stored report path;
- exact `feedGeneratedAt` used by the issued report.

The sidecar is supplementary audit evidence. It cannot replace the issued payload as decision authority.

---

## Invariant 12 — Research independence survives persistence

Saving Research Fit does not expand Research Library decision authority.

Research still may not by itself:

- create a BET;
- supply an executable sportsbook quote;
- override event/market/selection identity failure;
- override feed or quote freshness;
- directly rewrite fair value;
- directly rewrite `playTo`;
- directly rewrite recommendation status;
- directly rewrite stake.

The provisional current handicap remains current-evidence-first.

---

## Invariant 13 — History failure isolation

History collection is subordinate to valid live report delivery.

If an issued-report archive, Research Fit sidecar, or history-index write fails after the report has already passed all core validation gates:

> Do not rebuild a different report solely for storage and do not suppress the validated report.

Deliver the validated long fallback report link and surface `HISTORY SAVE FAILED` so history can be repaired later.

A history failure must not mutate `data/live-odds.json`, the Research Library, governance files, or the validated issued recommendation.

---

## Invariant 14 — Full odds snapshot recoverability

For every successfully indexed odds snapshot, the compact index must contain enough provenance to resolve the exact historical `data/live-odds.json` Git object.

At minimum this means exact snapshot commit SHA and blob SHA.

The Git object is authoritative. `odds-index.json` is an index, not a replacement for the full snapshot.

---

## Invariant 15 — No unnecessary full-feed duplication

The full `data/live-odds.json` file must not be copied into a separate history file on every refresh merely to create history.

Git already stores the exact version of the file changed by a successful refresh.

Compact metadata and Git identity are the preferred history mechanism unless a later evidence-backed storage requirement justifies duplication.

---

## Invariant 16 — Same-day lineage must be source-backed

When a later lane describes what an earlier Betting Edge lane issued, the comparison should use the actual archived earlier report where available.

Do not invent prior status, price, `playTo`, fair value, stake, or History Fit from memory when the repository history is readable.

If earlier history is unavailable, disclose that limitation rather than fabricating lineage.

---

## Invariant 17 — Browser repricing is not falsely represented as durable central history

Runner-side `UPDATE ODDS / REPRICE NOW` remains a client-side comparison overlay.

Until a safe authenticated persistence service is deliberately implemented:

- individual browser reprice clicks are not guaranteed to be stored centrally;
- local browser comparison state must not be represented as repository-backed history;
- the original issued report remains immutable.

---

## Invariant 18 — Validated long-link fallback exists before history-dependent delivery

Before durable-history success is assumed, the exact validated payload must be capable of opening through the traditional self-contained form:

`runner.html#run=<validated Base64URL payload>`

This long link is the emergency delivery path.

> A report must never depend on successful archive/index publication merely to remain deliverable after its core payload has passed validation.

The long fallback must not be enlarged with full same-day archived reports merely to imitate repository-backed navigation.

---

## Invariant 19 — Primary short-link delivery requires resolvable archive/index success

The normal compact share form is:

`r.html?id=<shortId>`

It may be delivered as the primary report link only after the exact issued payload has been stored and the corresponding `run-history.json` entry is successfully present. Scheduled lanes may additionally require successful sidecar storage as part of their declared history-success condition.

> Never deliver a short link as the only report link when the index state required to resolve it is known to have failed.

When history success is incomplete, use the validated long fallback and surface `HISTORY SAVE FAILED`.

---

## Invariant 20 — Short-link / long-link issued-content equivalence

The delivery path cannot change the report.

For a given `run.ts` + `slot`:

- the long fallback decodes to the validated issued payload;
- the short link resolves the authoritative stored issued payload;
- recommendation content, bankroll, risk, counts, summary, feed provenance, and issued timestamp must agree.

A resolver may hydrate navigation-only `prior_runs` for display, but it must not mutate the active issued report fields.

> If the delivery paths disagree on the active issued content, treat that as a link/history integrity defect, not as permission to choose a preferred betting answer.

---

## Invariant 21 — Short ID determinism and uniqueness

Current compact run ID format:

`YYMMDD + slotCode + HHMMSS`

Current slot codes:

- `open = o`;
- `main = m`;
- `final_morning = f`;
- `evening = e`;
- `late = l`.

The ID is derived from the issued report's Vancouver-local timestamp components and slot.

Example:

`2026-08-15T15:15:23-07:00` + `evening` → `260815e151523`.

A short ID must resolve to exactly one indexed run. A collision or multiple-match condition is a hard resolver error and must not silently choose one report.

---

## Invariant 22 — Same-day session hydration boundary

When `r.html` hydrates the runner's five session buttons from durable history:

- the active report's Vancouver date is the boundary;
- only archived runs with that exact date may be considered;
- at most the newest valid archived run for each lane is hydrated;
- the active run itself is not duplicated as a prior run;
- a prior-run payload must match its index `ts`, `slot`, and available `feedGeneratedAt` before hydration;
- a failed optional prior-run fetch must not prevent the active report from opening.

> Yesterday's or another date's card must not leak into today's five-button session strip merely because it exists in repository history or browser history.

Repository-backed same-day navigation is presentation/session context. It does not make prior lanes Research Library evidence.

---

# 4. Authoritative Historical Artifact Hierarchy

v0.9 defines the following historical artifacts and authority order.

## 4.1 Issued report payload

Path:

`data/history/runs/YYYY-MM-DD/<slot>-HHMMSS.json`

Purpose:

- exact issued report evidence;
- current bankroll/risk/counts as issued;
- recommendation status/price/book/`playTo`/fair/edge/movement/History Fit/stake/support/contrary/source/analysis as issued.

Authority:

> **Primary authority for what Betting Edge issued.**

---

## 4.2 Research Fit / provenance sidecar

Path:

`data/history/research-fit/YYYY-MM-DD/<slot>-HHMMSS.json`

Schema authority:

`data/history/report-provenance-schema.json`

Purpose:

- identify exact research priors/clusters consulted;
- preserve Research Fit grade/directness/transportability/mechanism/limitation;
- preserve the exact concise History Fit display text used in the issued card;
- identify the relevant live-odds, runner, Research Library, policy, manifest, and R2 validation artifacts by Git blob SHA where available;
- record a non-operational governance-draft reference without falsely claiming the draft was production authority.

Authority:

> **Primary authority for the structured historical/research explanation attached to the issued report.**

It is not authority for the recommendation itself.

---

## 4.3 Run history index

Path:

`run-history.json`

Purpose:

- compact discovery/index layer;
- report path;
- Research Fit sidecar path;
- report time/slot;
- feed provenance summary;
- bankroll/risk/counts/rec count;
- deterministic discovery support for compact share links.

Authority rule:

> If an index summary disagrees with the stored issued payload, the issued payload wins.

An index error should be repaired without rewriting genuine issued payloads.

---

## 4.4 Full odds history

Source:

Git history of `data/live-odds.json`.

Purpose:

- exact full market snapshot;
- events/books/markets/prices/timestamps;
- request/selection metadata present in that historical feed version;
- exact input provenance for report reconstruction.

Authority:

> **Git blob at the indexed historical commit.**

---

## 4.5 Compact odds snapshot index

Path:

`data/history/odds-index.json`

Purpose:

- make historical feed discovery deterministic without copying the full feed.

Current indexer records, where present:

- `generatedAt`;
- `generatedAtVancouver`;
- `snapshotCommitSha`;
- `snapshotBlobSha`;
- SHA-256 of the exact raw feed bytes;
- feed schema;
- identity schema;
- source;
- event count;
- indexing timestamp;
- selected sports/request-usage fields when available.

Authority rule:

> If the compact index and Git object disagree, the Git object wins and the index requires repair.

---

## 4.6 Research Library

Current canonical root:

`research/`

The Research Library remains a curated read-only report input. Its own manifest remains the authority for the current tested library compatibility state.

Historical report sidecars may point to an exact Research Library blob/policy/manifest version so later library updates do not rewrite what evidence was used at issuance.

---

## 4.7 Share-link resolver

Current path:

`r.html`

Purpose:

- accept a compact run ID;
- resolve that ID through `run-history.json`;
- fetch and validate the authoritative stored issued payload;
- optionally hydrate valid same-day lane reports as navigation-only `prior_runs`;
- pass the resulting display payload to the unchanged runner.

Authority:

> **No betting authority.**

The resolver is a presentation/discovery layer. It cannot override the stored issued payload, live-price rules, Research Library rules, or decision semantics.

---

# 5. Durable Report Archival and Delivery Procedure

This extends the v0.8 payload-validation sequence.

## 5.1 Decision and payload first

The live recommendation must be fully formed and pass every inherited v0.8 hard gate before history storage can be treated as the archive of an issued report.

History storage must not be used to repair an invalid recommendation.

---

## 5.2 Build and validate the self-contained long fallback

After the report object passes all inherited content/stake/timestamp gates:

1. serialize the payload with a proper JSON serializer;
2. parse it successfully;
3. Base64URL-encode the exact UTF-8 serialization without padding;
4. decode and parse it again;
5. re-verify required payload identity/invariants;
6. construct the traditional `runner.html#run=` URL from that validated encoding;
7. retain that URL as the emergency fallback even when short-link delivery later succeeds.

The long fallback is part of report delivery resilience. It is not a historical authority and it does not need repository history in order to render the active issued card.

---

## 5.3 Store exact issued payload

After validation:

1. derive the Vancouver date and HHMMSS from the fresh validated `run.ts`;
2. create the lane-specific history path;
3. write the same payload object used for the long fallback as readable UTF-8 JSON;
4. never mutate recommendation fields merely to make storage easier;
5. never overwrite an already existing genuine issued payload at that path.

If a genuine collision occurs, fail the history write rather than silently replacing evidence. A deliberate correction record may be created separately.

---

## 5.4 Store structured Research Fit sidecar

When the approved Research Library is available for the run:

1. preserve the exact library version used;
2. preserve exact primary `priorId` values normally limited to the smallest relevant set;
3. preserve any synthesis/inference IDs separately so they are not mistaken for independent evidence votes;
4. preserve deduplicated cluster IDs;
5. preserve grade, directness, transportability, mechanism, limitation, and exact display text;
6. preserve available blob-level provenance;
7. link the sidecar to the exact issued report path and timestamp.

If the library is unavailable:

- do not fabricate prior IDs;
- preserve the failure/degraded state if a sidecar can still be written;
- the current report may still proceed when inherited core gates pass.

---

## 5.5 Update `run-history.json`

The index update must:

- fetch the latest version first;
- append, not replace, existing genuine runs;
- avoid duplicate entries for the same exact `run.ts` + slot;
- use the latest Git blob SHA for update;
- on a write conflict, re-fetch/merge/retry once;
- preserve prior history.

A failed index update does not authorize deletion or rewriting of the already stored issued payload.

---

## 5.6 Build the compact primary share link after history success

Only after the current run is resolvable through the durable history/index path:

1. derive `shortId = YYMMDD + slotCode + HHMMSS` from the issued `run.ts` and slot;
2. verify the lane uses the defined slot code;
3. construct `r.html?id=<shortId>` on the approved GitHub Pages origin;
4. use that compact URL as the normal primary clickable report link.

The short URL must not embed the report payload.

The resolver is expected to retrieve the exact archived report and may hydrate same-day lane navigation under Invariant 22.

---

## 5.7 Delivery failure isolation

If payload archive, required sidecar storage, or `run-history.json` indexing fails after payload validation:

- preserve the already validated report object in memory;
- do not re-handicap merely because Git history storage failed;
- do not deliver a known-unresolvable short link as the sole report path;
- deliver the validated self-contained `runner.html#run=` fallback;
- surface `HISTORY SAVE FAILED`.

If a previously generated short link later encounters GitHub Pages publication lag, the resolver may retry for a bounded period. Publication lag or resolver failure must not mutate the report.

This is a history/share-system incident, not a reason to alter price or recommendation logic.

---

# 6. Odds Snapshot Indexing Contract

## 6.1 Independent post-refresh workflow

The odds history indexer is intentionally separate from the production odds-refresh workflow.

Current path:

`.github/workflows/odds-history-index.yml`

Current workflow name:

`Index Betting Edge odds history`

It runs after completion of `Refresh Betting Edge odds` when that workflow succeeds, and also supports manual dispatch.

The production odds-refresh workflow remains responsible for publishing the validated full `data/live-odds.json` snapshot.

The history indexer must not become a prerequisite for that publication.

---

## 6.2 Index only valid historical snapshots

The indexer must refuse to create a normal snapshot entry when required provenance such as `generatedAt` is absent.

It must avoid duplicate indexing by exact snapshot commit/blob identity.

---

## 6.3 Exact snapshot provenance

For each indexed snapshot, preserve exact Git identity and a content digest.

This allows a later historical analysis to answer:

- which exact feed existed at that decision point;
- when it was generated;
- which schema produced it;
- how many events it contained;
- which request-usage context was recorded;
- whether later code/library changes are irrelevant to reconstructing that feed.

---

## 6.4 Indexer failure behavior

If the odds-history indexer fails:

- do not roll back a successful odds refresh;
- do not modify the validated full snapshot merely to satisfy the index;
- treat the problem as missing compact metadata that can be repaired from Git history.

Because full feed versions remain in Git, the index is recoverable.

---

# 7. Research Fit Persistence Contract

## 7.1 Candidate-first requirement remains unchanged

For each displayed recommendation:

1. form the provisional current handicap from current evidence first;
2. only then retrieve Research Library evidence;
3. use the smallest materially relevant retrieval set;
4. preserve conflicts and gaps;
5. render concise History Fit in the existing `hist` field;
6. preserve the richer structured research record in the sidecar rather than bloating the runner payload.

---

## 7.2 Sidecar fields

The active schema is `data/history/report-provenance-schema.json` schema 2.

A recommendation-side Research Fit record should preserve:

- issued recommendation ordinal/identity/title;
- issued status;
- grade (`A/B/C/D/NR`, optional communication modifier);
- primary prior IDs;
- synthesis/inference IDs;
- cluster IDs;
- directness (`direct|related|analogy|gap`);
- transportability (`high|medium|low|not_applicable`);
- concise mechanism;
- strongest limitation;
- exact History Fit display text used in the issued payload.

---

## 7.3 Governance draft provenance is descriptive, not activation

Until a production contract is deliberately activated, a sidecar may record:

- `governanceDraftVersion`;
- current draft blob SHA;
- `governanceDraftOperational=false`.

That record means the draft was an audit/reference artifact. It must not falsely imply that the draft was already the authoritative production contract.

---

# 8. New H-Track — Durable History / Provenance Activation

The existing C-, R-, and S-tracks remain, but v0.9 adds a fourth independent track:

- **C-track:** contract authority;
- **R-track:** Research Library readback;
- **H-track:** durable issued-report/market provenance and archive-backed delivery;
- **S-track:** optional future Shadow History candidate calibration.

H-track is deliberately separate from S-track.

## H0 — NO REPOSITORY-BACKED ISSUED HISTORY

- reports may exist only in runner/browser/conversation state;
- no durable issued-payload archive.

## H1 — SCHEMA / INDEX FOUNDATION

- history directories and documentation defined;
- `run-history.json` schema established;
- Research Fit sidecar schema established;
- compact odds index established;
- no requirement that a real scheduled run has yet populated them.

## H2 — SCHEDULED ARCHIVE / COMPACT DELIVERY CONFIGURED

- scheduled report lanes are configured to save exact issued payloads;
- scheduled lanes are configured to save Research Fit/provenance sidecars;
- scheduled lanes build and retain a validated self-contained long fallback;
- scheduled lanes are configured to deliver compact short links only after durable history/index success;
- `r.html` compact resolver is present;
- history/share failures are isolated from report delivery;
- odds-history index workflow is active;
- live acceptance may still be pending.

## H3 — LIVE CHAIN VERIFIED

At least one full live chain demonstrates:

- successful odds refresh;
- corresponding compact odds index entry;
- successful scheduled report;
- exact issued report archive;
- Research Fit/provenance sidecar;
- matching `run-history.json` entry;
- compact short link resolves the exact archived active report;
- same active issued content can be recovered through the validated long fallback;
- normal runner delivery/rendering;
- no regression in stake/risk/payload rules.

For stronger acceptance, verify at least two different report lanes, including one later same-day lane capable of using prior lineage and archive-backed session navigation.

## H4 — MATURE HISTORICAL READBACK

Potential later stage:

- outcome settlement links;
- closing-line/CLV observations;
- robust same-day lineage queries;
- richer History-box UI readback;
- calibration summaries;
- repair/reconciliation tooling.

H4 requires separate change control and must not rewrite H2/H3 issued evidence.

---

# 9. H-Track vs Shadow History

Durable issued-report history does **not** mean Shadow History is now active.

## H-track stores

- reports that were actually issued;
- exact feed provenance used by those reports;
- exact Research Fit audit information for displayed recommendations;
- compact index metadata;
- deterministic discovery information needed to resolve archived reports.

## S-track would store

- potentially broader candidate observations not necessarily issued;
- prospective candidate-level quote/decision observations;
- later enrichment for proprietary calibration;
- potentially large local-calibration datasets.

Therefore:

> **H2/H3 may be active while S0 remains inactive.**

This is the correct current architecture.

---

# 10. Same-Day Lineage Under v0.9

v0.8 correctly classified same-day lineage as current-session evidence rather than Research Library evidence.

v0.9 makes that lineage durable when prior issued reports are successfully archived.

A later report may compare against earlier archived lanes for the same exact candidate and describe states such as:

- BET remains actionable;
- VALUE HOLDS;
- VALUE IMPROVED;
- PRICE MOVED beyond `playTo`;
- FAIR VALUE CHANGED;
- WAIT resolved;
- market became unavailable;
- price can no longer be verified.

The comparison must preserve the controlled-vocabulary rules inherited from v0.8.

Earlier Betting Edge opinions are still **not Research Library evidence** and do not increase the History Fit grade merely because they are now stored.

Repository-backed same-day session navigation follows the active report date. It must not pull another betting date into the five session buttons.

---

# 11. History Box, Session Buttons, and Runner Boundary

v0.9 does not require an immediate modification to the working `runner.html` implementation merely to enable archive-backed compact links.

Current boundary:

- report analysis may read repository-backed historical evidence where available;
- `runner.html` continues to render the issued payload and its existing `prior_runs` session-navigation mechanism normally;
- `r.html` may resolve the archived active payload and hydrate only validated same-date lane reports into `prior_runs` before passing the display payload to the runner;
- the five session buttons represent the active Betting Edge date only;
- the newest valid archived run for a lane may represent that lane when multiple same-day runs exist;
- optional failure to load an earlier lane does not block the active card;
- the traditional long fallback remains self-contained and may rely on embedded/local history rather than repository hydration;
- the existing lower History box may remain visually unchanged until a separate richer UI integration is approved;
- structured sidecars remain outside both link formats so audit data does not bloat the issued payload.

A future richer History-box change should be treated as a separate change family and tested for:

- exact candidate identity matching;
- prior-lane ordering;
- concise display;
- no stale local-history leakage;
- no cross-date session leakage;
- no mutation of issued reports;
- mobile/iPad/iPhone usability;
- short-link and long-fallback compatibility.

---

# 12. Read / Write Responsibility Matrix — v0.9 Override

This section overrides the narrower persistence assumptions in v0.8 Section 61 where necessary.

| Component | Routine read | Routine write | v0.9 rule |
|---|---:|---:|---|
| authoritative production contract | yes if C2+ | no | governance changes remain deliberate |
| draft contracts | optional audit/test | no by routine report | recording draft provenance is not activation |
| live odds | yes | no by report generator | odds-refresh workflow publishes full snapshot |
| odds history index | yes as needed | yes by dedicated post-refresh index workflow | failure isolated from odds refresh |
| Research Library | yes when R3 staged/active | **no** | remains curated/read-only during reports |
| personal ledger | yes when approved/available | no by normal report | separate user history |
| issued report history | yes | **append-only write by scheduled report history step** | exact issued payload evidence |
| Research Fit sidecar | yes | **append-only write by scheduled report history step** | supplementary provenance only |
| `run-history.json` | yes | append/repair | compact index; cannot override stored payload authority |
| `r.html` share resolver | yes | no | archive discovery/presentation only; same-day hydration boundary |
| `runner.html` | read/use | no central history write | presentation/client repricing; long fallback target |
| scheduler/task definitions | trigger/config | no routine self-mutation | deliberate updates only |
| Shadow History | optional future | only S2+ | remains S0 unless separately approved |
| workflows/governance code | no routine mutation | no | change control required |

History write permission is therefore **scoped by purpose**. It does not grant broad authority to mutate Research Library or governance artifacts.

---

# 13. v0.9 Current Preparation State

At the current v0.9 preparation state:

## Contract track

- **C0 — documentation only.**
- v0.9 is not authoritative production policy.

## Research track

- canonical Research Library version 1.7 exists;
- R2 manual read test has passed;
- scheduled read-only Research Fit configuration has been staged across the five report lanes;
- live scheduled acceptance remains to be verified before calling the R3 behavior proven.

## History / delivery track

- H1 foundations exist;
- all five scheduled report lanes are configured for exact issued-report archive plus Research Fit/provenance sidecars;
- all five lanes retain validated traditional long fallback delivery;
- all five lanes are configured for primary compact short-link delivery after successful archive/index work;
- `r.html` exists as the archive-backed compact resolver and same-day session hydrator;
- odds-history index workflow is active;
- `run-history.json` and `odds-index.json` may still be empty until a genuine qualifying live run/refresh populates them;
- therefore the preparation state is **H2 configured, H3 pending live-chain verification**.

## Shadow track

- **S0 — inactive.**
- no candidate-level Shadow History collector is activated by v0.9.

---

# 14. v0.9 Live Acceptance Tests

v0.9 is intentionally documented before the next qualifying live reports so the tests validate a written architecture rather than retroactively describing success.

## 14.1 Next successful odds-refresh acceptance

Verify:

1. production odds refresh succeeds under its existing safeguards;
2. `data/live-odds.json` is published normally;
3. post-refresh history index workflow runs independently;
4. one new `odds-index.json` entry points to the exact snapshot commit/blob;
5. SHA-256 and `generatedAt` correspond to the historical feed;
6. no duplicate full-feed history copy is created;
7. failure of the indexer, if any, does not damage the full snapshot.

---

## 14.2 15:15 Evening live-chain and compact-link acceptance

Verify:

1. current feed/price hard gates still work;
2. Research Library version 1.7 reads successfully or degrades explicitly;
3. provisional current handicap remains candidate-first;
4. concise History Fit appears only through the existing `hist` payload field;
5. runner payload shape remains compatible;
6. exact issued payload is saved under `data/history/runs/`;
7. matching schema-2 Research Fit sidecar is saved under `data/history/research-fit/`;
8. sidecar `slot`, `ts`, `reportPath`, and `feedGeneratedAt` match the issued payload;
9. `run-history.json` receives the matching compact entry;
10. the compact `r.html?id=` link resolves exactly one run and opens normally;
11. the active report resolved by the compact link matches the archived issued payload;
12. the prebuilt traditional long fallback opens the same active issued report content;
13. the compact link does not contain the encoded report payload;
14. only same-date archived session lanes are eligible for hydration;
15. all non-BET stakes remain zero and risk reconciles exactly;
16. a history-write failure would force long-link fallback rather than change the recommendation.

---

## 14.3 18:15 Late / West Coast live-chain acceptance

Repeat the 15:15 checks and additionally verify:

- later-lane same-day comparison can use the actual earlier archived report when relevant;
- 15:15 can be hydrated into the late card's session buttons when its archive is valid;
- no prior-date lane is hydrated into the current day's strip;
- no prior status/price/History Fit is invented from memory;
- current-price movement remains distinct from Research Fit;
- same-day lineage does not get double-counted as historical research evidence.

---

## 14.4 H3 acceptance decision

H3 should be declared only after live evidence demonstrates the chain, not merely because prompts and files exist.

A successful 15:15 plus 18:15 sequence is the preferred first acceptance pair because it tests archive creation, compact delivery, long fallback equivalence, and later same-day lineage/navigation.

---

# 15. Regression Requirements

v0.9 history/provenance/share work must not regress inherited v0.8 behavior.

Minimum checks:

- 75-minute feed freshness unchanged;
- 30-minute exact quote freshness unchanged;
- exact market identity unchanged;
- best fresh supported price unchanged;
- equal-price tie determinism unchanged;
- fresh Vancouver `run.ts` gate unchanged;
- `status != BET => stake = $0` unchanged;
- risk equals BET stakes unchanged;
- zero BETs remains valid;
- `playTo` required on every recommendation;
- runner Base64URL round-trip validation unchanged;
- long fallback remains capable of opening the active validated payload without repository history;
- short and long delivery paths preserve identical active issued content;
- compact share-link adoption does not enlarge the runner payload;
- only same-date archived lanes are hydrated by the short resolver;
- optional prior-lane hydration failure does not block the active report;
- runner repricing remains a comparison overlay;
- Research Library cannot manufacture a BET;
- Research Library failures do not become FEED STALE errors;
- history/share failures do not become betting-analysis failures;
- scheduled report times unchanged;
- production odds-refresh workflow logic unchanged by history indexing.

---

# 16. Correction / Repair Rules

## 16.1 Genuine issued history

Routine automation must never delete or overwrite genuine issued report history or sidecars.

If an issued historical record is later found to contain an error:

- preserve the original evidence;
- create an explicit correction record;
- identify the original record;
- state what was corrected and why;
- do not pretend the corrected information was known at original issuance.

---

## 16.2 Test artifacts

Synthetic test artifacts must be clearly identifiable as tests.

They may be cleaned up deliberately after validation when they are not genuine issued evidence.

Test cleanup authority must not be generalized into permission to delete genuine issued history.

---

## 16.3 Index / share-resolution repair

Because indexes and compact-link lookup are derivative conveniences, they may be repaired from authoritative stored payloads/Git history.

Repair must:

- preserve genuine report payloads;
- preserve genuine sidecars;
- preserve exact Git snapshot identity;
- avoid duplicate entries;
- preserve deterministic short-ID-to-run identity;
- document material reconciliation if needed.

A repair to `run-history.json` or `r.html` must not rewrite the issued report merely to make a link resolve.

---

# 17. Future Outcomes / CLV Layer

v0.9 deliberately stops short of declaring outcome/CLV enrichment operational.

A future H4 layer may add separate observations for:

- closing price;
- closing-line value;
- final result;
- settled P/L;
- timing/execution quality;
- recommendation-resolution reason;
- calibration summaries by sport/market/grade.

These must be later observations linked to the issued report.

They must **never rewrite decision-time price, fair value, Research Fit, status, or stake**.

This prevents hindsight leakage.

---

# 18. Report Link & Share Integrity

Compact report delivery is now part of the staged v0.9 architecture rather than merely a future possibility.

## 18.1 Traditional long link — mandatory emergency fallback

The traditional form is:

`runner.html#run=<Base64URL validated payload>`

Contract role:

- built from the validated issued payload before history-dependent delivery is assumed;
- self-contained for the active card;
- retained even when the normal compact link is delivered;
- used when required durable-history/index work fails;
- accompanied by `HISTORY SAVE FAILED` when that failure caused fallback.

The long fallback is intentionally not expanded with the full same-day archived card set. Its purpose is resilient active-card delivery, not archive-backed discovery.

---

## 18.2 Compact short link — normal primary share/delivery path

Current form:

`r.html?id=<shortId>`

Current approved Pages base:

`https://fhvsvzpmkw-design.github.io/-betting-edge-terminal/`

Contract role:

- normal primary clickable report link after durable archive/index success;
- compact enough for ordinary text, messaging, email, and public sharing contexts;
- contains only deterministic report identity rather than the encoded full payload;
- resolves through `run-history.json` to the exact archived issued report;
- does not gain authority to change report analysis.

---

## 18.3 Deterministic short ID

Current format:

`YYMMDD<slotCode>HHMMSS`

Example:

`260815e151523`

means an Evening (`e`) report dated 2026-08-15 with issued local timestamp 15:15:23.

The resolver must require exactly one indexed match.

---

## 18.4 Same-day session navigation

For a compact-link report, the resolver may preload the newest valid archived run for each of the five lanes:

- 06:00 OPEN / OVERNIGHT;
- 08:00 MAIN;
- 09:30 FINAL MORNING;
- 15:15 EVENING;
- 18:15 LATE / WEST COAST.

The active report date is the hard boundary.

> Only that date's archived cards are eligible for the session strip.

Prior-day or future-day reports remain in durable history for analysis/audit but must not appear as today's session cards.

The resolver may omit an unavailable lane rather than blocking the active report.

---

## 18.5 Link equivalence

The compact link and long fallback are different transport/discovery mechanisms for the same active issued report.

They must not produce different active recommendations.

Navigation hydration may make the compact-link experience richer because it has archive-backed same-day lane access. That difference is permitted only as presentation/navigation context.

---

## 18.6 Publication lag and resolver retry

Because GitHub Pages publication may lag a repository commit, `r.html` may retry index/report retrieval for a bounded window.

Current implementation target is a short retry cadence with a maximum wait of approximately 90 seconds.

A retry mechanism:

- must use no-store/cache-busting reads where practical;
- must not change the requested short ID;
- must not substitute a different run;
- must end with a clear resolver error rather than fabricating a report.

---

## 18.7 Public-share consequence

The approved GitHub Pages repository is public. A compact link shared publicly can therefore expose the corresponding archived Betting Edge report to anyone who can access the URL.

This is a distribution/privacy characteristic of the share layer, not a change to betting logic.

---

## 18.8 Repository-backed lower History box remains separate

Compact-link same-day session hydration is not the same feature as a future richer lower History box.

A future lower History box may display prior lanes/results/CLV/Research Fit from repository history and requires separate exact-identity/UI testing.

That future UI work is not required for H3 so long as compact-link active-report resolution and same-day session navigation pass their defined acceptance tests.

---

# 19. v0.9 Change Record — 2026-08-15

## Problem

Betting Edge had strong current-analysis rules and a canonical Research Library, but durable evidence of each issued decision was incomplete. The same-day analytical sequence could be understood in-session, yet future reconstruction depended too heavily on browser-local history, conversation context, or manually locating Git commits. Full-payload runner URLs were also unnecessarily cumbersome for ordinary sharing.

## Decision

Create a lightweight durable-history architecture that preserves exact issued reports and provenance without duplicating the large odds feed and without expanding Research Library decision authority, then use that archive to support deterministic compact report links while retaining the validated self-contained long URL as an emergency fallback.

## Implemented/staged infrastructure at current draft preparation

- `run-history.json` schema 2;
- `data/history/README.md`;
- `data/history/report-provenance-schema.json` schema 2;
- `data/history/odds-index.json`;
- `.github/workflows/odds-history-index.yml`;
- R2 manual Research Library validation artifact;
- five scheduled report lanes configured for exact issued-payload archive and Research Fit/provenance sidecars;
- five scheduled report lanes configured to retain the validated traditional long fallback;
- five scheduled report lanes configured to deliver compact `r.html?id=` links after history/index success;
- `r.html` compact resolver with bounded publication-lag retry;
- `r.html` same-date archive hydration for the existing five session buttons without requiring a working-runner rewrite.

## Intentionally unchanged

- live odds source workflow logic;
- supported books;
- price freshness thresholds;
- identity requirements;
- fair-value methodology;
- recommendation statuses;
- `playTo` rules;
- stake/risk contract;
- issued runner payload shape;
- core `runner.html` decision/reprice behavior;
- lower runner History-box UI;
- client-side reprice persistence;
- Shadow History activation state;
- production contract authority.

---

# 20. v0.9 Positive-Effect Test

The history/provenance/share layer earns continued use only if it produces a net positive effect.

Evaluate:

## Reliability

Does it make it easier to reconstruct exactly what Betting Edge knew and issued?

## Integrity

Can later prices/results be added without rewriting decision-time evidence?

## Analytical clarity

Can same-day changes and Research Fit be explained from source-backed records rather than memory?

## Operational burden

Do archive writes/indexing add unacceptable latency, failure rate, or repository churn?

## Runner stability

Does keeping structured audit data in sidecars protect payload compatibility, while the long fallback still opens independently?

## Shareability

Does compact report identity materially improve practical sharing without weakening fallback delivery or report immutability?

## Session clarity

Do archive-backed session buttons stay limited to the active betting date and avoid stale cross-date leakage?

## Research discipline

Does preserved Research Fit provenance reduce cherry-picking and make conflicts/gaps auditable?

If the history/share layer harms live-report reliability, narrow or redesign the persistence/share layer rather than weakening the core betting gates.

---

# 21. v0.9 Audit Checklist

For a run operating under the staged v0.9 history/share design, verify where applicable:

1. inherited v0.8 preflight/current-feed/price rules passed;
2. provisional current handicap formed before Research Library interpretation;
3. Research Library version and validation state were resolved;
4. History Fit was concise and did not mechanically determine status/stake;
5. exact issued runner payload passed round-trip validation;
6. traditional `runner.html#run=` fallback was constructed from that validated payload;
7. exact issued payload history path was created;
8. Research Fit sidecar refers to the same slot/`run.ts`/feed/report path;
9. sidecar prior IDs and cluster IDs came from authoritative Research Library reads, not memory;
10. `run-history.json` entry refers to the correct payload/sidecar;
11. relevant odds snapshot can be resolved by Git commit/blob identity;
12. compact `r.html?id=` link was used only when the indexed run was successfully resolvable under the scheduled history-success rule;
13. the short ID was deterministically derived from the issued date/slot/time and resolves exactly one run;
14. compact-link active issued content matches the archived payload and the long fallback;
15. compact-link session hydration contains only the active report date and at most the newest valid run per lane;
16. no full-feed duplicate history copy was created unnecessarily;
17. no history/share write modified Research Library, runner decision logic, contract authority, scheduler timing, or live odds;
18. no history/share failure changed the recommendation;
19. a history/index failure results in long-link fallback plus `HISTORY SAVE FAILED`, not a dead short link as sole delivery;
20. prior-lane analytical comparisons came from actual archived evidence when available;
21. no browser reprice click was falsely claimed to be centrally archived;
22. all inherited v0.8 stake/risk/price/identity invariants still passed.

---

# 22. Final v0.9 Review Rule

Before any v0.9 contract activation test, read v0.8 and this v0.9 delta together and check specifically for:

- any accidental weakening of v0.8 hard gates;
- any ambiguity between H-track issued history and S-track Shadow History;
- any path where sidecar history rewrites the issued report;
- any path where Research Fit becomes an extra BET vote;
- any requirement to duplicate the entire odds feed unnecessarily;
- any history/share failure that can suppress an otherwise valid report;
- any broad write authority granted merely because history files require persistence;
- any claim that current browser repricing is centrally archived when it is not;
- any short-link path that can resolve more than one run or silently substitute another run;
- any difference in active issued report content between short and long delivery paths;
- any path that mixes a different betting date into the active five-button session strip;
- any path that sends a known-unresolvable short link instead of the validated long fallback after history/index failure;
- any claim that v0.9 is operational merely because scheduled prompts implement related behavior;
- any richer runner/History-box UI change hidden inside the history/share contract without separate testing.

Correct contradictions before contract activation rather than relying on interpretation during live use.

---

# 23. Closing Principle

v0.9 retains the v0.8 execution discipline and the v0.7 Research Library separation while adding a durable evidence trail and compact archive-backed report delivery:

> **Current market truth decides the live bet; the Research Library explains historical fit; the archive preserves exactly what was issued and why; the share layer only transports that evidence; later observations remain separate; and history must never rewrite decision-time reality.**

For persistence and delivery specifically:

> **Store exact issued reports, index exact odds snapshots, keep research provenance in sidecars, build the self-contained fallback first, prefer the compact resolver only when history can resolve it, keep session navigation on the active betting date, fail history safely, and reserve Shadow History for future candidate-level calibration only if it earns its complexity.**
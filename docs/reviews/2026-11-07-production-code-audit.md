# Betting Edge production code review — November 7, 2026

Baseline: authoritative main `e4844b06962ea5b72b65409d6603553b5d91030e`. Review the actual Main path against the current shared authority, adaptive research amendment and reduced staffing policy. The five enabled Main task prompts already resolve current main and that authority; their schedules and staffing were retained.

Status: DEPLOYED to authoritative main. All 67 targeted tests passed across 21 suites, and all six final-head repository checks succeeded. [PR #138](https://github.com/fhvsvzpmkw-design/-betting-edge-terminal/pull/138) merged as `57795b24d5754c4bacd0cd5924236a26e54acad6`; all 19 reviewed file hashes were read back exactly. The original report blob `ad64d01de9ec91f1833396d23fe65800aa814b7e` and research blob `55b2fe0c18a0d141ce287f4ca00c3ecff7c43620` remain unchanged. The next ordinary producer's actual game-review follow-through remains the live acceptance item.

## Scope and method

Mapped collection and slot ownership, primary-sport identity and exact prices, shared game intelligence, current forecast/opinion routes, candidate planning, controller completion, partial publication, immutable retry/readback and shared runner presentation. Inspected the production handoffs and tests against the issued November 7 09:30 report and its exact feed/sidecar. Syntax checks covered 238 JavaScript files; all 129 workflow YAML files parsed. The only pull-request workflow job selecting main explicitly is the Graham audit apply job, which is guarded against pull-request execution.

This is an execution and contract review of the shared Main path, including its interfaces with Graham, grading and bankroll data. Syntax checks are a broad screen; the behavior findings below come from tracing the active code and replaying its inputs. Successful publication and candidate discovery are distinct from completed game research.

| Expected behavior | Code and evidence reviewed | Result |
| --- | --- | --- |
| One normal odds intake per lane; observed quote freshness, exact identity, primary markets and request budget | Main schedule/request/slot entry; worker extraction and recovery; quote observation; primary feed health | Existing controls retained. The bound 09:30 feed completed with no provider errors; its unreturned markets are not expired odds. |
| Correct league scope | Shared primary-sport identity; worker major-league priority/category; feed-health and inventory reproduction | G League was matching the word NBA. Corrected for new intake with historical report-time semantics preserved. |
| Current event facts and original model points before judgment | Shared intelligence binding; forecast eligibility/replay; source-led opinion and candidate inspectors; actual Main prompts | Current source-led route is implemented. It still needs the producer's actual event-specific judgment and personnel/materiality review. |
| Candidate findings reach execution and completion | Candidate assessment, event work plan, controller health/status | Required reviews could disappear behind generic source/personnel labels. Corrected with exact current bindings and queue priority. |
| Publish finished work and disclose unfinished work | Coverage summary, evidence audit, publisher ordering, immutable retries | Completion was calculated before the publisher's fresh candidate assessment. Corrected for new reports; partial publication stays available. |
| Useful names and consistent instructions | Primary selection inventory and controller guide | Added bound matchup labels to unassessed selections and removed the obsolete four-researcher/two-reviewer default. |

## Findings and corrections

1. **High: false completion and an incorrect stopping signal.** `describeResearchCompletion` counted only the literal `RESEARCH_INCOMPLETE` blocker. `reportRunHealth` could classify a generic source/personnel blocker as a documented shortfall while the same exact quote still had an unfinished required candidate assessment. The new shared read-only completion helper checks report/feed binding, assessment time, unique selection identity, receipt state, side/line/book/price and both quote clocks. Controller status and continuation use this work too; source-gap labels no longer hide it. Duplicate report/sidecar views count once. Stale or mismatched diagnostics supply no work or clearance.
2. **High: publisher metadata was assembled in the wrong order.** Coverage/completion was attached before `attachPublicationEvidenceAudit` derived fresh candidates. A missing or stale producer cache could therefore yield a COMPLETE headline followed by an unfinished candidate list. For new reports, attach the completion disclosure after the publisher's actual assessment. A forward synthetic publication test supplies a real positive paired-reference case with no cached candidate assessment: publication, retry and verification now retain the unfinished notice and all six original blocked receipts. No decision is fabricated.
3. **High: remaining candidate work could be hidden in queue routing.** The planner preferred a nonempty recorded blocker description over the candidate's actual missing review fields. It now recognizes the same exact-current required review used by completion, orders those reviews before repeat terminal-shortfall checks, and keeps Sunday early NFL first. Generic stale placeholders retain their older priority behavior. Start-time order is retained within each group. The action text covers source-led opinions as well as the qualified market/fair route.
4. **Medium: NBA development games inflated primary NBA coverage.** Both the collector and shared matcher admitted NBA G League. New collection classifies these as other basketball; new primary coverage excludes that NBA misclassification. Old report-time inventory semantics remain reproducible. Supported college football, including its honestly unreturned markets, remains in scope.
5. **Medium: unassessed games often reached the candidate queue as numeric event labels.** Inventory now carries the bound feed's away/home matchup label. This improves the existing work plan without transferring a grade or source finding.
6. **Medium: controller documentation retained superseded staffing.** It now resolves current reduced counts from the current guide/policy, matching the enabled tasks.

## Actual failed-run replay

The immutable research sidecar is `data/history/research-fit/2026-11-07/final_morning-101206.json`, Git blob `55b2fe0c18a0d141ce287f4ca00c3ecff7c43620`. Its feed is `30e2d0d5aeffc7046fbcbfa377cd2e527c1e7f33`.

| Measure | Issued record / corrected diagnostic |
| --- | --- |
| Required / priced / unavailable betting sides | 1,668 / 660 / 1,008; historical inventory unchanged |
| Issued decisions | 4: three LEANs and one PASS; unchanged |
| Required candidate reviews unfinished | 46: 36 NCAAF, five NBA and five NHL |
| Older completion metadata | COMPLETE; zero unfinished; retained for exact historical reproduction |
| Current read-only controller diagnosis | Continuation required; 46 producer reviews unfinished; 610 other recorded shortfalls |
| Unreturned prices | 978 NCAAF sides and 30 G League sides; no NHL or actual NBA primary sides missing |

The 610 figure describes the existing receipt classification, not independent confirmation that every attempted investigation was adequate. Some recorded prose describes PASS work while the actual receipt remains BLOCKED. The producer must finish the supported exact-selection judgment; a code change cannot invent that judgment, a personnel confirmation, a fair number or a pick.

## Validation and acceptance

The regression reads the actual saved sidecar by its exact blob identity, reproduces 660 priced/1,008 unavailable sides, exposes all 46 required reviews and verifies unchanged input research. It rejects stale report/feed/state/quote bindings and preserves old metadata semantics. Existing tests cover Sunday scheduling, stale-diagnostic precedence, current source-led LEANs without a Pinnacle prerequisite, original point replay, negative/contrary sources, and unchanged wagering controls. Offline collector execution verifies NBA/G League separation without live odds requests. Partial-publication and forward publisher tests exercise publish/retry/verify, quote-clock integrity and misleading-metadata rejection.

The forward metadata/identity cutoff is `2026-11-07T20:10:00Z` (13:10 Pacific). Issued History remains unchanged. New CI paths run the completion replay and forward publication cases in the existing workflows; no service, task, worker, odds request, betting threshold or report-wide completion gate is added.

Deployment proof and the next ordinary run's actual execution are separate acceptance items. The existing next producer must use its normal fresh intake, inspect the current required-review queue, complete eligible source-led/market/fair judgments, retain genuine named shortfalls, publish completed work and verify the derived completion notice. The earlier count of 46 is diagnostic evidence, not a quota or permission to reuse started games or old prices.

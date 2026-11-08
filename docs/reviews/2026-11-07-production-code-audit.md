# Betting Edge production code review — November 7, 2026

Baseline: authoritative main `e4844b06962ea5b72b65409d6603553b5d91030e`. Review the actual Main path against the current shared authority, adaptive research amendment and reduced staffing policy. The five enabled Main task prompts already resolve current main and that authority; their schedules and staffing were retained.

Status: **15:15 LIVE ACCEPTANCE FAILED.** The initial repair was deployed, but its passing checks did not establish actual analytical follow-through. [PR #138](https://github.com/fhvsvzpmkw-design/-betting-edge-terminal/pull/138) merged as `57795b24d5754c4bacd0cd5924236a26e54acad6`; its 67 targeted tests and six final-head checks passed and all 19 reviewed file hashes matched. The next ordinary run nevertheless issued only three opinions and retained 213 blocks. The additional missed paths and forward repair are documented below. Neither review claims that all repository defects have been found.

## Actual 15:15 acceptance failure and correction

The November 7 Evening issue is stamped `2026-11-07T16:09:07-07:00`: 42 events, 216 available selections, three evaluated provisional LEANs, 213 blocks and 36 unavailable selections. It recorded zero producer-unfinished. Exact issued report blob: `7e7c430a2c2eb7299c8c8247ed41dea8b192f42c`; research blob: `860c9fdbce0dac3cbd83538e52c6f6f71c05a6c6`; saved checkpoint blob: `f81e64ff67aa06c38e5c93d92a4a5990f356c838` at `data/report-production/checkpoints/20261107-evening-1515.json`.

1. **Captured positive points could vanish from the research queue.** Of 92 retained original forecast records, 89 final revalidations used the same unresolved-personnel/settlement-false context rationale. Twenty blocked moneyline sides still had original exact outcome points above the offered break-even price. The lead router considered prose captures and eligible forecasts but did not independently route those original typed records after the applicability label removed eligibility. New routing preserves structurally exact, pregame, registered-provider fields as unverified research leads regardless of that label. It neither changes eligibility nor issues a grade. A current source-linked directional rejection can close the lead; saying no calibrated fair was adopted does not identify a settlement-rule mismatch.
2. **Completed assessment paperwork did not become complete decisions.** Four BLOCKED receipts had COMPLETE candidate reviews and proposed PASS drafts labelled `UNISSUED_COMPLETED_CANDIDATE_REVIEW_ONLY`. These were skeletons missing marketAssessment/cardEvidence and complete Core evidence, so promoting them would be incorrect. The first repair only counted an UNFINISHED candidate flag and missed these false-completion labels. Current exact-quote proposed decisions still in BLOCKED drafts now require `FINAL_DECISION_HANDOFF_REQUIRED`, regardless of custom authority string. The controller can expose the remaining work; the producer must finish the existing valid route or disclose it unfinished.
3. **BET qualification was being used as an opinion stopping rule.** Eighty-seven blocks repeated the absence of a calibrated probability/interval. Existing market PASS and reviewed source-led provisional LEAN routes do not universally require an independent calibrated fair or BET interval. Shared authority and the existing Late task now require an actual selection-specific judgment through the supported route. No fair, interval, personnel clearance or opinion is synthesized by this repair.

The actual-checkpoint regression exposes **20 required applicability reviews plus four missing decision handoffs**, preserves all three issued opinions, keeps exact-eligible forecasts at three, and verifies unchanged source/receipt inputs. Additional cases cover forward activation, stale/wrong identity and clock rejection, unsafe URLs, genuine personnel objections and genuine regulation/overtime mismatches. Original publisher metadata before `2026-11-08T00:20:00Z` remains reproducible. This forward cutoff preserves issued History; read-only health diagnoses the older unfinalized drafts. The earlier 09:30 report and research blobs also remain unchanged.

The [Late handoff](2026-11-07-late-opportunity-handoff.md) and existing typed follow-up queue contain the captured observations, prepared game-specific judgments and named remaining checks. Deploying this repair and a later ordinary producer actually issuing supported decisions remain separate acceptance items.

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

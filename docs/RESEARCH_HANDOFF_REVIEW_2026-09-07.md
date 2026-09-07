# September 7 research handoff verification

Implementation review and non-issued evidence-collection exercise, completed during the 08:00 review. This document is not a report, a decision source, or a new production evidence store. Issued reports remain unchanged. Subsequent tasks use indexed report sidecars through the existing research planner.

## Morning replay

The 06:00 report has 54 available primary selections: 18 evaluated and 36 unfinished. The 08:00 report has 60 available: the same 18 evaluated, those 36 unfinished, and six newly available NCAAF selections. All unfinished receipts say RESEARCH_INCOMPLETE and omit a concrete stopping reason or next calculation.

The revised planner, run against an empty 08:00 draft and the actual indexed 06:00 sidecar, returns 36 RESUME_PRIOR_RESEARCH, 18 REVALIDATE_PRIOR_RESEARCH and six START_STAGE_1. It gives none of the 60 current evaluation credit. On the already-issued 08:00 artifacts, it continues to report their actual 18 evaluated / 42 unfinished. Compact output retains full-inventory counts; event filtering changes only displayed detail.

Regression checks cover original source timestamps, matching indexed report/sidecar identity, changed primary lines, current quote availability, shared source findings, explicitly recorded unfinished stages, duplicate receipts, mismatched history, and read-only operation. Existing partial-publication and primary-decision validation tests remain applicable.

## Angels–Red Sox collection exercise

Exact feed event: MLB / 63303323, September 7 at Fenway Park. Starting point: six generic unfinished receipts in `data/history/research-fit/2026-09-07/main-080700.json`. This synthesis was recorded at 15:51 UTC after the source checks in the current review. These are later findings, not evidence available at the 08:07 issue time.

| Subject | Checked finding | Source and limitation |
| --- | --- | --- |
| Exact fixture, starters and lineup availability | MLB lists Grayson Rodriguez versus Brayan Bello and posts both starting batting orders. Boston is 79–65; Los Angeles is 54–89. | [MLB September 7 lineups](https://www.mlb.com/starting-lineups/2026-09-07). The official current listing supersedes the older Sandoval projection. Late changes still require a current recheck. |
| Angels lineup | Neto, Trout, Meckler, Grissom, Ballesteros, Moore, Lowe, Paris and Heineman are listed. | Same official lineup check; reused across relevant markets. |
| Boston lineup | Anthony, Gasper, Rutschman, Abreu, Story, Durbin, Duran, Kiner-Falefa and White are listed. | Same official lineup check; a posted order does not establish a quantitative batting contribution. |
| Starter conflict | A September 5 series preview projected Patrick Sandoval for Monday. | [Older series preview](https://www.bleachernation.com/picks/2026/09/05/boston-red-sox-vs-los-angeles-angels-series-sept-7-9-odds-starting-pitchers-predictions/), retrieved search excerpt. Retained as a stale projection, not used as the current starter. |
| Angels recent workload and form | Ureña pitched all eight defensive innings in Sunday's 1–0 loss; AP reports 11 losses in 13 games. | [AP recap](https://apnews.com/article/angels-pirates-score-04e106b233c7a281b93d9840ad893689) and [box score](https://www.baseball-almanac.com/box-scores/boxscore.php?boxid=202609060PIT), both opened. The box score establishes zero Angels bullpen innings that day, not universal reliever availability. |
| Boston relief usage | Chapman pitched to finish Sunday's 3–1 win. | [Official MLB clip](https://www.mlb.com/video/bos-bal-a9aa30), retrieved text. This is an appearance check, not a complete multi-day bullpen availability assessment. |
| Conditions | The forecast lists 76°F, no precipitation and a 10 mph crosswind at the scheduled afternoon start. | [RotoWire weather](https://www.rotowire.com/baseball/weather.php), opened and exact Boston fixture checked. This is a forecast; the page's EST wording does not override MLB's event time. |

Official injury/transaction pages and the full Boston preview/Reuters recap were not retrievable through the lookup route used here. Their access failures were not treated as absence of all information. The official lineup, AP report, box score and weather page supplied concrete event facts through available alternatives. Search excerpts were not represented as full-page reads.

## Calculation boundary and honest next step

For a reproducible historical price check only, the 08:00 Bet365 receipt prices are:

| Market | Opposing decimal prices | Proportional no-vig benchmark |
| --- | --- | --- |
| Moneyline | Angels 2.45 / Boston 1.58 | 39.2060% / 60.7940% |
| Run line | Angels +1.5 at 1.64 / Boston −1.5 at 2.30 | 58.3756% / 41.6244% |
| Total 8 | Over 1.80 / Under 2.05 | 53.2468% / 46.7532%, conditional on no push |

Calculation: `(1 / side decimal price) / sum(1 / each opposing decimal price)`. The feed's run-line `hdp=-1.5` is home-oriented; the away displayed handicap is +1.5. These historical prices are bound to 14:53:54.381 UTC. They must not be relabeled as a later live quote.

The exercise obtained substantive facts and reproduced the three distinct market baselines. It did not establish a defensible independent numerical adjustment, uncertainty range, or the probability of exactly eight runs needed for a total with push potential. Raw ERA or team record alone cannot supply all of those quantities. No arbitrary blend, probability adjustment or uncertainty band was added to turn the exercise into a PASS.

The actionable handoff is **FAIR_CONSTRUCTION**, with targeted workload/statistical follow-up as needed: calculate the current moneyline and run-margin distribution from the checked starters, batting orders and relief context; separately estimate the scoring distribution including the total-eight push; explain the supported adjustment and uncertainty. Record which additional numerical input is needed while attempting that calculation. Recheck current odds and material personnel before a decision. A draft receipt can retain the collected source attempts plus `progress.stage=FAIR_CONSTRUCTION`, this concrete next step, and the actual reason the calculation remains incomplete.

This is a successful handoff/collection check, not proof that the six selections have cleared all evidence or fair-value gates. A later scheduled run still needs to demonstrate additional supported evaluations and publish them through the normal owner workflow.

# Sharp Sports Betting: first application to the research process

**Date:** September 7, 2026. **Result:** price/probability arithmetic reproduced; the archived evidence does not establish the adjustment magnitude or uncertainty endpoints. No replacement current fair or betting decision is issued.

This retrospective trial applies the [Wong methodology notes](source-material/sharp-sports-betting-methods.md) to Angels–Red Sox, event `63303323`, at the 09:30 report's actual 09:44 Pacific issue time. The trial uses the archived record as evidence of what was reported. It does not certify that every external source claim was true or available at the claimed time, and does not use the game's outcome.

## Frozen inputs

- Report: `data/history/runs/2026-09-07/final_morning-094400.json`
- Evidence: `data/history/research-fit/2026-09-07/final_morning-094400.json`
- Read revision: `6cfc9970b3f910b9778e4daf16d3efe826074dde`
- Bound odds revision: `84276bf21c41fa683652a78a96bedb05185ae6d1`
- Bound feed generated: `2026-09-07T16:23:42.202Z`
- Market: full-game moneyline, Bet365, Angels 2.45 and Boston 1.58. These are historical prices, not current executable quotes.

## Numerical work completed

Remove the pair's margin proportionally: `p_A = (1/2.45) / ((1/2.45) + (1/1.58)) = 0.39205955335`. Boston's complement is `0.60794044665`. These are market baselines, not independently established forecasts.

The report subtracts 0.015 from the Angels baseline, adds it to Boston, and applies a band of ±0.08 to each. Using the report's stored rounded estimates:

| Quantity | Angels | Boston |
| --- | ---: | ---: |
| Executable decimal price in archive | 2.45 | 1.58 |
| Paired no-vig baseline | 39.205955% | 60.794045% |
| Issued probability | 37.705955% | 62.294045% |
| Issued range | 29.705955–45.705955% | 54.294045–70.294045% |
| Zero-EV probability at that price | 40.816327% | 63.291139% |
| EV using issued probability | −7.620410% | −1.575409% |
| EV at reported lower/upper bounds | −27.220410% / +11.979590% | −14.215409% / +11.064591% |

The central probabilities add to one; each side's lower bound complements the other's upper bound. Both central expected returns are negative. This arithmetic is consistent, but it does not establish that the underlying probabilities or ranges are supportable.

### What an adjustment must accomplish

At the archived prices, the Angels need an increase of 1.610371 percentage points above their no-vig baseline merely to reach zero EV. Boston needs an increase of 2.497095 percentage points above its baseline. Core action thresholds and uncertainty requirements apply in addition.

Let `delta` denote an Angels probability adjustment above the market baseline. The exact payoff sensitivity is `EV_A(delta) = 2.45 × (0.39205955335 + delta) − 1`. Each added probability percentage point increases expected return by 2.45 percentage points. Boston's probability must decrease correspondingly in this two-outcome calculation.

| Assumed Angels adjustment | Resulting Angels EV |
| --- | ---: |
| −1.5 percentage points | −7.620409% |
| 0 | −3.945409% |
| +1 percentage point | −1.495409% |
| +2 percentage points | +0.954591% |

These adjustments are diagnostic assumptions, not research-derived estimates. The table identifies the numerical question the current evidence must answer; it is not a way to pick an adjustment that creates a bet.

## Attempts to establish the fair's basis

| Route inspected | Evidence available in the record | Remaining dependency |
| --- | --- | --- |
| Reproduce the issued market-anchored estimate | The paired odds, −0.015 adjustment and ±0.08 band are explicit. | No derivation explains why these magnitudes follow from the linked facts. |
| Reconstruct a quantitative matchup adjustment | The record names starters and ERAs, batting-order leaders, team records, injuries and recent form. | It gives no numerical comparison/scenario translating the combined facts into a 1.5-point change, nor evidence separating information already reflected in the price from an additional effect. |
| Reconstruct the range | The record names bullpen, weather, scratches and model error as limitations. | It gives no quantified scenarios, measured error or other supported endpoint construction producing ±0.08. Confirmed personnel alone does not resolve those uncertainties. |
| Reuse existing MLB calibration work | `research/staging/V1_8_MLB_SOURCE_HOLDOUT_RESULTS.md` reports player-prop calibration, with explicit scope and authority limitations. | That evidence cannot supply an adjustment or error band for this full-game moneyline. |
| Import a Wong numerical rule | Chapter 9 supplies a forecast-to-distribution technique; chapters 12–15 contain historical NFL material. | The book supplies neither this game's forecast inputs nor a validated MLB full-game transformation/range. NFL tables cannot fill that gap. |

This is a bounded reconstruction of the archived evidence and applicable local methods, not an exhaustive current-source search. It identifies missing work, not a newly proven terminal blocker.

## Concrete continuation

**Remaining stage:** `FAIR_CONSTRUCTION`.

**Next action:** establish a defensible numerical comparison or model translating the relevant game inputs into a full-game moneyline probability. For a pitching/run-based route, obtain or substantiate the expected starter workload, opponent-adjusted starter/bullpen contribution and lineup/park contribution used by that route; document how those combine and map to win probability. For the permitted judgmental market-anchored route, show the quantitative comparisons or scenarios used to select the incremental adjustment and range, including any supported no-change finding. Direct calibration is not a universal prerequisite.

**Observed limitation of this trial:** the saved source findings and inspected methods do not contain that translation or endpoint construction. The trial therefore cannot validate the stored −0.015/±0.08 choices. No timeout, usage cap or source outage was inferred.

Any historical reconstruction must use information demonstrably available by the archived cutoff, with later discoveries labeled separately. A current application must use current evidence and fresh exact quotes. Run-line and total calculations are separate follow-on work; the integer total also needs explicit push treatment.

The operational improvement is to retain the quantitative explanation and unfinished dependency in the existing evidence fields. The archived report remains immutable; no selection has been newly cleared by this trial.

## Reproduction

From the repository root, this read-only Python calculation reproduces the price/probability results directly from the issued file:

```python
import json
from pathlib import Path

report = json.loads(Path(
    'data/history/runs/2026-09-07/final_morning-094400.json'
).read_text())
keys = ['63303323|ml|away||', '63303323|ml|home||']
cards = [next(r for r in report['recs']
              if r['feed']['selectionKey'] == key) for key in keys]
raw = [1 / r['feed']['priceDecimal'] for r in cards]
for card, implied in zip(cards, raw):
    odds = card['feed']['priceDecimal']
    fair = card['fairValueEvidence']
    baseline = implied / sum(raw)
    print(card['title'], {
        'baseline': baseline,
        'zero_ev_probability': 1 / odds,
        'zero_ev_change_pp': 100 * (1 / odds - baseline),
        'issued_ev': odds * fair['estimate'] - 1,
        'issued_ev_range': [odds * fair['range'][k] - 1
                            for k in ['low', 'high']],
    })
```


## Midday follow-up — September 7, 2026

**Work performed now, before the 15:15 run. Research snapshot assembled at 2026-09-07T19:22:07.884406+00:00.** This section advances the actual remaining games using current sources and numerical comparisons. It does not backdate evidence into the 09:44 report or count a source check as a completed fair.

### Triage of the original 42 selections

| Event ID | Game | Start, Pacific | Midday treatment |
|---|---|---|---|
| 68385832 | Toronto Argonauts at Hamilton | 11:30 | Scheduled pregame deadline passed; do not manufacture a later pregame evaluation. |
| 63301027 | Minnesota at Detroit | 12:10 | MLB's retrieved schedule reports In Progress; exclude from new pregame work. |
| 63301093 | Washington at San Diego | 14:10 | Research now; this game starts before 15:15. |
| 70900780 | SMU at Florida State | 16:30 | Six selections still eligible by scheduled start time. |
| 63301511 | St. Louis at San Francisco | 17:10 | Six selections still eligible by scheduled start time. |
| 63303773 | Cincinnati at Los Angeles Dodgers | 18:10 | Six selections still eligible by scheduled start time. |
| 63301939 | Toronto Blue Jays at Athletics | 19:05 | Six selections still eligible by scheduled start time. |

There are **30 selections across five games still before their scheduled starts** in this review, rather than the original 42. The other 12 are elapsed pregame windows, **not research-cleared selections**. By 15:15, Washington–San Diego's six will also be beyond their scheduled start unless a delay is verified. The next run must build its own current inventory.

The bound stored feed is still `2026-09-07T16:23:42.202Z`, with historical Bet365 prices. Its 75-minute feed window ended at `17:38:42.202Z`. This is an observed pricing limitation under the existing Contract, not a research stopping rule. Current research can continue; a new executable decision requires a valid current feed and exact prices. No extra odds pull or timestamp replacement was performed.

### Probability-to-price work completed for both moneyline sides

The five ESPN matchup predictors were opened for the exact fixtures: [Washington–San Diego](https://www.espn.com/mlb/game/_/gameId/401816852/nationals-padres), [SMU–Florida State](https://www.espn.com/college-football/game/_/gameId/401858212/smu-florida-st), [St. Louis–San Francisco](https://www.espn.com/mlb/game/_/gameId/401816850/cardinals-giants), [Cincinnati–Los Angeles](https://www.espn.com/mlb/game/_/gameId/401816849/reds-dodgers), and [Toronto–Athletics](https://www.espn.com/mlb/game/_/gameId/401816851/blue-jays-athletics). The table records their numerical comparisons, not an adopted Core forecast. These pages do not disclose a game-specific uncertainty interval or the exact personnel inputs used by the predictor.

`break_even = 1 / decimal_price`; `conditional_ROI = external_probability × decimal_price − 1`. Both opposing probabilities sum to one. Prices are the archived morning receipt prices, not current offers.

| Selection | Archived decimal | External predictor | Break-even probability | ROI if that predictor is correct |
|---|---:|---:|---:|---:|
| Washington Nationals | 2.65 | 33.6% | 37.7358% | -10.9600% |
| San Diego Padres | 1.50 | 66.4% | 66.6667% | -0.4000% |
| SMU Mustangs | 1.64 | 54.9% | 60.9756% | -9.9640% |
| Florida State Seminoles | 2.30 | 45.1% | 43.4783% | +3.7300% |
| St. Louis Cardinals | 2.10 | 42.7% | 47.6190% | -10.3300% |
| San Francisco Giants | 1.76 | 57.3% | 56.8182% | +0.8480% |
| Cincinnati Reds | 2.40 | 38.6% | 41.6667% | -7.3600% |
| Los Angeles Dodgers | 1.60 | 61.4% | 62.5000% | -1.7600% |
| Toronto Blue Jays | 1.48 | 57.6% | 67.5676% | -14.7520% |
| Athletics | 2.70 | 42.4% | 37.0370% | +14.4800% |

Positive numbers here identify research questions, not BET/LEAN/WAIT decisions. Florida State's comparison loses its positive EV if its true chance is 1.6217 percentage points below the displayed predictor; San Francisco's has only 0.4818 points of room. The Athletics comparison has 5.3630 points of room, but its model/market disagreement needs explanation. These are **break-even sensitivities**, not measured uncertainty ranges or confidence intervals. A supported current fair/range and personnel review remain necessary even for a final PASS.

### Starter workload and relief research

Official MLB API records were retrieved for the exact games, season team statistics, individual season/game logs, and the preceding three days' box scores. Failed detail requests were retried successfully. Statistical descriptions are not assumed to be opponent-adjusted projections.

The current pitching inputs are:

| Pitcher | MLB ID | Season runs / outs | RA9 from runs and outs | Starts | Season innings per start | Most recent MLB start in log |
|---|---|---:|---:|---:|---:|---|
| [Jake Irvin](https://statsapi.mlb.com/api/v1/people/663623/stats?stats=season,gameLog&group=pitching&season=2026) | 663623 | 57 / 257 | 5.988327 | 18 | 4.7593 | 2026-09-01 |
| [Nick Pivetta](https://statsapi.mlb.com/api/v1/people/601713/stats?stats=season,gameLog&group=pitching&season=2026) | 601713 | 8 / 48 | 4.500000 | 4 | 4.0000 | 2026-04-12 |
| [Michael McGreevy](https://statsapi.mlb.com/api/v1/people/700241/stats?stats=season,gameLog&group=pitching&season=2026) | 700241 | 69 / 442 | 4.214932 | 27 | 5.4568 | 2026-09-01 |
| [Logan Webb](https://statsapi.mlb.com/api/v1/people/657277/stats?stats=season,gameLog&group=pitching&season=2026) | 657277 | 73 / 449 | 4.389755 | 25 | 5.9867 | 2026-09-01 |
| [Chase Burns](https://statsapi.mlb.com/api/v1/people/695505/stats?stats=season,gameLog&group=pitching&season=2026) | 695505 | 50 / 436 | 3.096330 | 26 | 5.5897 | 2026-08-30 |
| [Brandon Williamson](https://statsapi.mlb.com/api/v1/people/682227/stats?stats=season,gameLog&group=pitching&season=2026) | 682227 | 22 / 100 | 5.940000 | 7 | 4.7619 | 2026-09-02 |
| [Dylan Cease](https://statsapi.mlb.com/api/v1/people/656302/stats?stats=season,gameLog&group=pitching&season=2026) | 656302 | 44 / 469 | 2.533049 | 26 | 6.0128 | 2026-09-02 |
| [Jacob Lopez](https://statsapi.mlb.com/api/v1/people/682052/stats?stats=season,gameLog&group=pitching&season=2026) | 682052 | 58 / 315 | 4.971429 | 20 | 5.2500 | 2026-09-02 |

The workload checks resolved a material issue in each of the two earliest MLB research priorities:

- **Washington–San Diego:** Pivetta's MLB log contains only four starts and ends April 12. The season average of four innings is not a current healthy-starter workload forecast. A [Reuters search excerpt](https://www.reuters.com/sports/baseball/nick-pivetta-returns-rotation-padres-host-nationals--flm-2026-09-07/) reports 64 pitches in his last rehab outing and an approximately 75-pitch possibility for this return; the full page was inaccessible, so that remains reported guidance, not a confirmed manager limit. [Separate return reporting](https://www.si.com/mlb/padres/onsi/padres-announce-starting-pitchers-nationals-including-exciting-nick-pivetta-return) corroborates the return from the injured list. Irvin's last five starts total 71 outs and 16 runs: 4.7333 innings/start and 6.0845 RA9. Neither starter's season ERA alone supplies the full-game fair.
- **Cincinnati–Dodgers:** Burns will precede Williamson; MLB says the innings limit is undisclosed. This resolves the differing role labels. [MLB report](https://www.mlb.com/reds/news/chase-burns-faces-dodgers-in-los-angeles). From the verified season totals, transferring one inning from Burns to Williamson changes the simple observed-rate burden by `(5.94 − 3.096330275)/9 = 0.315963303` runs. A two-inning transfer would be 0.631926606. This is a **workload sensitivity**, not a forecast adjustment: the actual split, opponent/park effects, uncertainty, and what is already priced still need support. Do not apply it on top of a market already reflecting the piggyback. The Dodgers' official game feed still lacks a named probable starter; projected Sheehan bulk work and Ohtani availability need a closing confirmation.

For the later games, Webb's last five starts total 74 outs and 18 runs, versus McGreevy's 81 outs and 20 runs. Cease's last five total 90 outs and seven runs, versus Lopez's 90 outs and nine runs. These comparisons prevent treating a season average as the only available numerical input, but five-start changes are not automatically a change in true ability. No arbitrary recency blend was used.

Relief usage was reconstructed from pitcher appearances with `gamesStarted=0`, retaining integer outs and pitch counts. Each row links to its actual box-score inputs:

| Team | Relief outs Sep 4 / 5 / 6 | Source game IDs, in date order |
|---|---|---|
| Washington | 9 / 6 / 11 | [823905](https://statsapi.mlb.com/api/v1/game/823905/boxscore), [823904](https://statsapi.mlb.com/api/v1/game/823904/boxscore), [823903](https://statsapi.mlb.com/api/v1/game/823903/boxscore) |
| San Diego | 15 / 20 / 9 | [823256](https://statsapi.mlb.com/api/v1/game/823256/boxscore), [823257](https://statsapi.mlb.com/api/v1/game/823257/boxscore), [823253](https://statsapi.mlb.com/api/v1/game/823253/boxscore) |
| St. Louis | 12 / 11 / 19 | [824311](https://statsapi.mlb.com/api/v1/game/824311/boxscore), [824310](https://statsapi.mlb.com/api/v1/game/824310/boxscore), [824309](https://statsapi.mlb.com/api/v1/game/824309/boxscore) |
| San Francisco | 15 / 12 / 6 | [823579](https://statsapi.mlb.com/api/v1/game/823579/boxscore), [823577](https://statsapi.mlb.com/api/v1/game/823577/boxscore), [823578](https://statsapi.mlb.com/api/v1/game/823578/boxscore) |
| Cincinnati | 15 / 15 / 12 | [824471](https://statsapi.mlb.com/api/v1/game/824471/boxscore), [824468](https://statsapi.mlb.com/api/v1/game/824468/boxscore), [824469](https://statsapi.mlb.com/api/v1/game/824469/boxscore) |
| Dodgers | 9 / 9 / 18 | [823905](https://statsapi.mlb.com/api/v1/game/823905/boxscore), [823904](https://statsapi.mlb.com/api/v1/game/823904/boxscore), [823903](https://statsapi.mlb.com/api/v1/game/823903/boxscore) |
| Toronto | 21 / 10 / 10 | [824067](https://statsapi.mlb.com/api/v1/game/824067/boxscore), [824066](https://statsapi.mlb.com/api/v1/game/824066/boxscore), [824065](https://statsapi.mlb.com/api/v1/game/824065/boxscore) |
| Athletics | 19 / 6 / 12 | [823093](https://statsapi.mlb.com/api/v1/game/823093/boxscore), [823094](https://statsapi.mlb.com/api/v1/game/823094/boxscore), [823091](https://statsapi.mlb.com/api/v1/game/823091/boxscore) |

Examples relevant to the remaining workload decisions: San Diego's Miller threw 22 pitches on September 4 and 21 on September 6; Morejon threw 14 and 19 on those dates. Washington's Lord and Dion threw 39 and 40 pitches on September 6. Cincinnati's Burke and Pagán appeared on September 5 and 6. Toronto's Rogers and Varland appeared September 5 and not September 6. Appearance history measures use; it does not certify availability, establish a universal fatigue penalty, or justify a fixed win-probability adjustment.

### Current offense and lineup inputs

The retrieved [MLB team hitting data](https://statsapi.mlb.com/api/v1/teams/stats?sportId=1&season=2026&stats=season&group=hitting) and [team pitching data](https://statsapi.mlb.com/api/v1/teams/stats?sportId=1&season=2026&stats=season&group=pitching) supply these descriptive checks. These are the snapshot's exact values, not a claim that they stay current after this review.

| Team | Runs / games | Runs per game | Team runs allowed / outs | Team RA9 |
|---|---:|---:|---:|---:|
| Washington | 748 / 145 | 5.158621 | 739 / 3858 | 5.171851 |
| San Diego | 602 / 143 | 4.209790 | 594 / 3799 | 4.221637 |
| St. Louis | 657 / 144 | 4.562500 | 666 / 3850 | 4.670649 |
| San Francisco | 603 / 144 | 4.187500 | 678 / 3804 | 4.812303 |
| Cincinnati | 605 / 143 | 4.230769 | 710 / 3807 | 5.035461 |
| Dodgers | 705 / 143 | 4.930070 | 553 / 3800 | 3.929211 |
| Toronto | 580 / 144 | 4.027778 | 618 / 3841 | 4.344181 |
| Athletics | 631 / 144 | 4.381944 | 819 / 3819 | 5.790259 |

The [Washington–San Diego game feed](https://statsapi.mlb.com/api/v1.1/game/823254/feed/live) had a San Diego batting order but no Washington order in the retrieved response. The [St. Louis–San Francisco](https://statsapi.mlb.com/api/v1.1/game/823175/feed/live), [Cincinnati–Dodgers](https://statsapi.mlb.com/api/v1.1/game/823902/feed/live), and [Toronto–Athletics](https://statsapi.mlb.com/api/v1.1/game/824958/feed/live) responses did not yet provide batting orders. Public expected lineups were treated as projections. The San Diego game feed gave 87°F and wind in from left field at 14 mph; this is an observed page value, not an inferred park/temperature run adjustment.

Team totals and the supplied matchup probabilities do not derive run-line or total probabilities. Attempting a starter-only nine-inning Poisson calculation would omit relief, matchup, lineup and full-game settlement effects. In particular, the Washington total of eight needs actual push mass; the SMU spread of three needs margin-three mass. The book's NFL key-number table cannot fill that college-football input. Half-integer lines avoid refunded pushes but still require supported outcome probabilities.

### SMU–Florida State personnel and numerical boundary

The [SMU official preview](https://smumustangs.com/news/2026/9/3/untitled-story.aspx) confirms this is SMU's opener, while Florida State has one game. It reports Jennings' continuity and Daniels' 202-yard opener. A single Florida State result and SMU's prior-season averages cannot identify a current opponent-adjusted scoring mean or uncertainty band by themselves.

[Current reporting of the availability list](https://www.tomahawknation.com/florida-state-football/136253/probable-question-smu-availability-report-mike-norvell-acc-injury-tallahassee) lists Florida State linebacker Nichelson out and defensive lineman Desir doubtful, and SMU safeties Moses and Milliner-Jones out. Singleton is questionable. The [earlier availability report](https://www.si.com/college/fsu/florida-state-seminoles-college-football/fsu-football-vs-no-19-smu-mustangs-initial-acc-availability-report-) establishes that the reported lists changed; do not reuse its earlier statuses as the closing check. The ACC's [official availability portal](https://theacc.com/sports/2025/8/28/availability-reporting-football.aspx) returned an embedded frame without readable player rows through web lookup and 404 through the direct retrieval attempt. That is a recorded primary-source limitation, not confirmation of the secondary list. The reported final update is due two hours before kickoff, 14:30 Pacific.

The FSU probability comparison is only 1.6217 points above zero EV at the old price. Assigning an unmeasured defensive-injury correction could erase it. The attempted numerical alternative therefore retains the external predictor and exact sensitivity but leaves the personnel-to-points/probability translation and range unresolved. It does not substitute a pundit's final-score prediction or a fan poll for a quantified fair.

### Work retained for the next execution

| Game | Work completed in this pass | Specific next work |
|---|---|---|
| Washington–San Diego | Both moneyline calculations; return/workload evidence; three-day relief reconstruction; offense rates; partial official lineup. | Confirm return workload and Washington batting order; translate matchup and relief scenarios to a supported fair/range, including total-eight push. Requires fresh pricing before its 14:10 start for any pregame decision. |
| SMU–Florida State | Both moneyline calculations and break-even sensitivity; official preview; changing defensive-availability evidence. | Obtain closing ACC list, quantify replacement/usage effects and range; derive the exact spread/total probabilities independently of the moneyline predictor. |
| St. Louis–San Francisco | Both moneyline calculations; both starter logs; relief use and offense rates. | Confirm batting orders and relevant absences; explain the current matchup estimate/range and distinct margin/total distributions. The small positive external-model comparison is particularly sensitive to uncertainty. |
| Cincinnati–Dodgers | Both moneyline calculations; piggyback resolved; per-inning sensitivity calculated; relief and offense data. | Resolve innings split, Dodgers starter/bulk plan and Ohtani role; quantify scenarios without double-counting known information in prices. |
| Toronto–Athletics | Both moneyline calculations; both starter logs; relief use and offense rates; external-model/market discrepancy identified. | Confirm batting orders and current injury/return status; explain the large predictor/market gap using the actual Cease–Lopez matchup and supported uncertainty. Do not adopt the external probability automatically. |

The existing progress stage is **FAIR_CONSTRUCTION**, with targeted **PERSONNEL_RECHECK** and source work as specified. No current-game estimate or uncertainty interval has yet been promoted into `fairValueEvidence`. No selection has been newly marked EVALUATED; the 09:44 report retains 36 evaluated / 42 blocked. The positive comparison rows are research leads only. A later task should resume these exact calculations and dependencies, recheck changing facts and prices, and retain its work in the existing report/sidecar evidence fields.

### Source provenance and reproduction

API response SHA-256 hashes (the source timestamps below are retrieval-start/check timestamps recorded by the collector; the analysis assembly time above is later):

| Source | SHA-256 |
|---|---|
| schedule_today; 2026-09-07T19:09:08.883122+00:00 | `16c7159e1794a9bb58b397bea1d4fd62e9475dae5bd8cdb1a03762cf3490def4` |
| pitching_teams; 2026-09-07T19:09:08.884764+00:00 | `17dec9d669e9b02bb4653e272971da51b1850197e6d6a88e7f9271d93351df8a` |
| hitting_teams; 2026-09-07T19:09:08.886451+00:00 | `285987b95a6158bbf590f28fd18bf9949286e10d1a4702c9f8cbf6d927816a2a` |
| game_823254; 2026-09-07T19:10:27.531977+00:00 | `43597d9577295b653aabb1100723b9579ceab5d48f2a8bf9c7fefc11aff96448` |
| game_823175; 2026-09-07T19:10:27.537070+00:00 | `3f8718a4169693587570e0c884f287330ee80c27163eb983117496a12e11ad43` |
| game_823902; 2026-09-07T19:13:30.357416+00:00 | `e723cfedb6c31153799d334dc7a12d0ae23ceb23099ab34d9d8560a27dbf82cb` |
| game_824958; 2026-09-07T19:10:58.851756+00:00 | `f072c2b7f0dbff1445621aebd8fe511725e6cf77c78f2909c9c6a62af6cc4bbf` |

To reproduce the ten price comparisons, read the existing `final_morning-094400.json` sidecar receipts, filter the five event IDs above to `marketKey=ml`, and calculate `p × priceDecimal − 1` with the displayed external probability. Reproduce RA9 as `27 × runs / outs`, innings/start as `outs / (3 × starts)`, and the workload derivative as the difference in two RA9 values divided by nine. All numerical inputs used in those calculations are retained above. No probability range was reverse-engineered from a desired decision.

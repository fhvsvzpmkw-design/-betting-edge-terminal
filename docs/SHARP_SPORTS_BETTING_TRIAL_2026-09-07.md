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

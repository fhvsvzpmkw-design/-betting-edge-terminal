# Graham replacement formula study

October 26, 2026. Retrospective research; no production change.

The clearest finding is that stronger restraint on current-season updates helped. The unchanged preseason baseline beat every adaptive candidate on both mean absolute error (MAE) and root mean squared error (RMSE). The primary ridge-4 candidate failed its declared screen because RMSE increased. A replacement has therefore not been established as superior to the simplest control.

The specific adaptive candidate nominated for a prospective parallel trial is opponent-adjusted ridge ratings with penalty strength 8 toward the original preseason ratings. This nomination follows inspection of the sensitivity results; it is not a preregistered winning model or a production promotion.

## Exact candidate

Before week k, solve all 32 team ratings together:

    minimize over r:
      sum over games with week < k:
        [(home score - away score - venue advantage)
         - (r_home - r_away)]^2
      + 8 * sum over teams: (r_team - preseason_seed_team)^2

Then:

    home fair spread = r_away - r_home - venue advantage

A negative home fair favors the home team. Use the existing location allowance: 2.082 points at domestic home venues and zero at scheduled neutral venues. Keep full internal precision and round to the nearest half point for display, with exact ties rounded away from zero. Refit from unique completed games once each week. Do not recursively update prior fitted ratings or add the October 22 manual corrections to the original seeds.

Equivalently, each team's simultaneous rating equation is:

    r_team = [8 * seed_team
              + sum(opponent rating + scoring margin - location effect)]
             / (8 + games played)

Seeds and fitted ratings share a common center; subtracting a common constant does not change any spread. The coefficient 8 is a regularization strength, not eight literal rating points.

## Matched retrospective comparison

The study uses 93 canonical final scores from Weeks 1–6. Weeks 1–3 are warm-up. Every Week 4 forecast uses only Weeks 1–3; Week 5 uses Weeks 1–4; Week 6 uses Weeks 1–5. All prior-week final-fact verification timestamps precede the first kickoff of the tested week. The same 45 games are used for forecast-error comparisons.

| Formula | MAE, points | RMSE, points | ATS, zero-edge skipped | No-edge games |
|---|---:|---:|---:|---:|
| Existing Graham | 8.467 | 10.623 | 19–23–1 | 2 |
| Original preseason seeds + location | **7.900** | **9.980** | 23–18–1 | 3 |
| Ridge 2 | 8.544 | 11.724 | 20–20–1 | 4 |
| Ridge 4, primary | 8.322 | 11.077 | 22–20–1 | 2 |
| Ridge 8, adaptive candidate | 8.078 | 10.580 | 21–21–1 | 2 |
| Huber 14 / ridge 4 | 8.322 | 10.921 | 21–20–1 | 3 |
| Saved Pinnacle benchmark | 8.111 | 10.223 | Not a selection strategy | — |

ATS uses the same saved pregame Pinnacle spread for each game, never the formula's fair spread. It describes mechanical numerical comparisons, not authorized or executed bets. Equal formula and market lines produce NO_EDGE. The original published comparison is preserved, including its forced equal-line selections. The archived Weeks 4–6 record including those selections was 20–24–1.

Ridge 8 improves MAE by 0.389 points and RMSE by only 0.043 points over existing Graham. It has worse RMSE than the saved Pinnacle benchmark and worse MAE and RMSE than the preseason control. There is no demonstrated superiority to the market or reliable betting advantage.

Weekly MAE for the candidate is 6.469 / 9.900 / 7.964 in Weeks 4 / 5 / 6; existing Graham is 6.406 / 10.867 / 8.250. Improvement is not uniform. The static baseline remains a required control; these results do not authorize resetting production ratings to preseason seeds.

## Injury and quarterback treatment

This core estimates strength as teams actually played. Absolute current injury deductions or an additional QB performance layer would mix baselines and risk counting the same weakness twice. The base study deliberately applies neither.

A coherent injury extension must normalize historical results and forecast current availability with the same loss definition and coefficient. If d_g is historical home injury loss minus away injury loss, fit targets `margin - HFA + alpha*d_g`, then use `home fair = r_away - r_home - HFA + alpha*d_current`. Missing historical losses cannot be filled with zero. After a forecast has a documented roster baseline, a newly verified availability change can update the spread by the home loss change minus the away loss change, using the same coefficient once.

The October 22 paired-injury diagnostic covers only 83 of 93 games and includes retrospective recovery material. It does not establish what injury inputs were available before each historical kickoff. This study therefore identifies a replacement core for testing, not a ready full roster-sensitive recommendation system. No arbitrary injury cap or coefficient was selected to repair the losing weeks.

## Evidence boundaries

- The candidate set and screen were saved before calculating candidate metrics, but the investigation began after observing the Week 6 collapse. This remains retrospective development research, not an untouched holdout.
- Week 7 is excluded: the pinned repository snapshot has no canonical committed final facts for that week.
- The September 1 H4 manifest establishes the 2.082/zero coefficient before the season. Per-game venue assignments are inherited from the preserved archive and treated as scheduled locations; no venue effect is fitted from test outcomes.
- Prices never enter the candidate fitting function. Market comparisons are joined after all forecasts are calculated. Saved Pinnacle observations are not verified closing lines.
- The original seeds, source files, published predictions, grading records, production formula, tasks and live site remain unchanged.
- The next useful evidence is a frozen prospective comparison of ridge 8, existing Graham and the preseason control, plus separate validation of a consistent availability baseline. No deployment or recurring task is created by this study.

## Reproduction and verification

The source manifest pins repository commit `842944f85adf3908d3cb2e708dfdd51392e5c3cc` and exact Git blob hashes. Run from this research branch, whose unchanged source files match that commit:

    python tools/study-graham-replacement.py --write
    python -m unittest discover -s tests -p 'test_graham_replacement_study.py' -v

Python with NumPy is required. The script rejects source drift, duplicate games, identity mismatches and training facts unavailable at the weekly origin. Six tests cover an analytical two-team solution, home/away signs, symmetric rounding, future-outcome isolation, market isolation, fact timing and reference metrics. An independent review also reproduced the ridge solution with augmented-system least squares.

`results.json` preserves every fitted rating, training game key and comparison row. `protocol.json` preserves the declared candidates, including the failed primary screen. The general methods follow [rolling-origin forecast evaluation](https://otexts.com/fpp3/tscv.html) and [regularized score-based sports prediction](https://doi.org/10.3233/MAS-180428); those sources do not validate this particular candidate or its parameters.

# Stanford Wong — Sharp Sports Betting: applied research notes

**Source review:** September 7, 2026. **Role:** methodology reference for the existing current-research process; not a new fair-value model or Research Library graduation.

Stanford Wong, *Sharp Sports Betting*, Pi Yee Press, ISBN 9780935926446. The user-supplied EPUB lists copyright years 2001, 2006, 2009 and 2011. The source SHA-256 is `505a64f62592c191a1918276c64a447e3ce9819a938cb1afcf45417d918b9746`. These are original derived notes. The full EPUB remains outside this public repository.

## Research sequence

Chapter 5, “Getting an Edge” and “Attitude While Handicapping,” emphasizes probability and information processing. Chapter 9, “Three-Step Process,” separates a forecast, outcome probabilities and price comparison. Apply that sequence in the existing report/sidecar:

1. **Collect facts once per game.** Extract actual performance, matchup, personnel and conditions findings, with the sources and original check times. Keep material unknowns explicit. A checked lineup identifies who plays; translating that lineup into a probability is additional work.
2. **Explain the numerical estimate.** Identify the baseline, measured inputs, units, orientation and transformation. For a market-anchored estimate, explain the additional information or processing and why it warrants the adjustment beyond the baseline. Public information is not automatically worthless, but avoid counting the same information twice. For a judgmental adjustment, show the relevant numerical comparisons or scenarios and explain the chosen magnitude and limitations; a prebuilt model or direct calibration is not universally required. A supported no-change finding is valid when explained.
3. **Explain the range.** Identify the evidence and assumptions behind the endpoints, such as validation errors or quantified input scenarios. Distinguish a sensitivity range from a calibrated confidence interval. A Core error category does not itself prescribe an eight-point band or another universal margin.
4. **Calculate each exact market.** Derive both opposing selections coherently, including push/refund outcomes where applicable. A moneyline probability does not establish a run-line or total distribution. Compare expected returns at the exact executable prices, then apply existing Core, personnel, playTo and staking rules.
5. **Retain the actual unfinished step.** If evidence is incomplete, pursue the missing fact. If the transformation is incomplete, attempt it and record which numerical input, mapping or range remains unsupported. Use the existing `blocker.progress` fields with a specific next action and observed stopping reason. Keep completed research available for the next run.

### Use the existing fields

| Work | Existing record |
| --- | --- |
| Checked event facts and changing personnel | `sourceEvidence`, `personnelEvidence` |
| Source-linked numerical inputs and transformation | `fairValueEvidence.inputs`, `.method`, `.calculation` |
| Numerical estimate and supported endpoints | `fairValueEvidence.result`, `.range`, `.limitations` |
| Actual attempts and unfinished calculation | `blocker.attempts`, `.missing`, `.progress` |

Describe the basis for an adjustment and range in the existing method/calculation/limitations text. No additional receipt schema, archive, publication gate or automated decision rule is introduced.

## Expected-value arithmetic

Chapter 4, “Expected Value,” weights each settlement payoff by its probability. For one unit risked at decimal odds `D`, with a push returning the stake:

`EV = p_win × (D − 1) − p_loss`, where `p_win + p_push + p_loss = 1`.

With no push, `EV = p_win × D − 1` and the zero-EV probability is `1 / D`. With a push, the zero-EV condition is `p_win / (1 − p_push) = 1 / D` when a decisive result is possible. Handle other settlement terms explicitly. Positive expected value is not by itself authorization for BET under Core.

**Source correction:** In chapter 4's “Example Calculating Expected Ticket Price,” an intermediate line treats `0.10 × $110` as `$110`; it should be `$11`. Recalculation gives a $126.50 expected ticket value and $16.50 expected profit on $110 risked. The final total in the book is correct. Recompute examples instead of importing them unchecked.

## Scope and validation

Chapter 7 requires a defined hypothesis and separate testing data, and discusses the false positives produced by trying many systems. For Betting Edge, validate any new numerical method on data not used to tune it, preserve forecast versions and timing, and assess returns at actual prices as well as probability quality. Related selections from one game are not independent observations. A significance result does not guarantee future profit.

Chapters 12, 14 and 15 contain historical NFL estimates for home advantage, scoring margins and totals. Chapter 14 explicitly limits its conversion tables to the NFL. Revalidate empirical values for the relevant period and sport before use; do not transfer NFL numbers to MLB, CFL or NCAAF. Chapter 9's Poisson examples supply a possible modeling technique, not proof that a proposed distribution fits today's full-game market. Check assumptions and fit before using it.

The book is a methodology source, not independent current-event support. Do not cite it as today's personnel evidence or use it to originate a fair, stake or BET. Props remain paused; current Core/Walters/Graham authorities and Research Library graduation rules continue to govern.

## Source locations and first application

Locators are relative to `OEBPS/` inside the supplied EPUB; pagination varies by reader.

| Topic | EPUB locator |
| --- | --- |
| Estimating an edge | `html/09_chap2.html#c2j` |
| Break-even and expected value | `html/11_chap4.html#c4d`, `#c4e` |
| Information, movement and probability | `html/12_chap5.html#c5c`, `#c5d`, `#c5e` |
| Hypothesis and testing | `html/14_chap7.html#c7a`, `#c7b`, `#c7c` |
| Forecast → probability → price | `html/16_chap9.html#c9a`, `#c9b` |
| Historical home advantage | `html/19_chap12.html#c12c`, `#c12d` |
| Spread/moneyline relationships | `html/21_chap14.html#c14a`, `#c14b`, `#c14f` |
| Pushes on totals | `html/22_chap15.html#c15b` |

The focused reading covered these methods and selected supporting discussion, not a full audit of every chapter/table. The [Angels–Red Sox application](../SHARP_SPORTS_BETTING_TRIAL_2026-09-07.md) reproduces both moneylines and identifies the remaining numerical dependency. It is historical research, not an issued recommendation.

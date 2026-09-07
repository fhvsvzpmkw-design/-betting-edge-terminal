# Stanford Wong, Sharp Sports Betting — full review and quantitative audit

Reviewed September 7, 2026. This supersedes the depth assessment of the September 7 first pass. It is a research reference, not a new production model, betting recommendation, or Research Library graduation.

**Conclusion:** Wong provides a valuable framework for turning a defensible forecast into a correctly priced bet. His strongest contributions are payoff arithmetic, shopping between alternative bets, preserving pushes, and separating hypothesis development from testing. The book does not supply a complete process for estimating today's MLB team strength, scoring distribution, or uncertainty. Several formulas, examples, statistical thresholds, and historical summaries need correction before implementation. The existing Core and Walters/Graham authorities remain the decision authorities.

The improvement for the 42 evidence-blocked selections is to finish and retain the numerical research between source collection and market evaluation. Additional source links alone will not complete a fair. Conversely, an unsupported adjustment or uncertainty band must not turn an unfinished market into a documented PASS.

## 1. What was reviewed

The source is the supplied Stanford Wong EPUB, Pi Yee Press, ISBN 9780935926446. Its copyright page lists 2001, 2006, 2009 and 2011. These findings apply to this file; they are not a claim that every edition has identical errors.

Source SHA-256: `505a64f62592c191a1918276c64a447e3ce9819a938cb1afcf45417d918b9746`.

| Coverage | Work completed |
|---|---|
| All 17 chapters | Read all body text, including chapter 17's HTML game tables; assessed every chapter's application and limitations. |
| Appendices A, B and C | Read explanations, reconstructed probability calculations, and examined the image tables and their coverage limits. See the cell-audit result below. |
| Front and back matter | Read title, copyright, dedication, author note, preface, contents, table list, glossary, bibliography and publisher contact information. |
| Source inventory | 31 EPUB spine documents; approximately 76,656 body words; 126 image placements, including the cover and decorative image. All 124 substantive image placements were extracted and processed. |
| Mathematical exercises | Recomputed the numerical exercises in chapters 2, 4, 7, 9, 10, 11 and 14, including cases that cannot be solved from the supplied assumptions. Also checked the worked parlay, middle, teaser and bankroll examples. |
| Significance table | Compared all 138 cells in Table 4 with exact one-sided binomial thresholds, including “not possible” cells. |
| Historical record consistency | Regraded 388 side entries and 143 total entries in chapter 17 from the printed lines and scores. Checked summary discrepancies separately. |
| Project fit | Compared the conclusions with Core's fair-value contract, the first application, the active HFA release, and the current non-operational BW6 state. |

This is a complete source review with a quantitative audit. It does **not** certify every historical score, old sportsbook quote, anecdote, or legal statement against its original external record. Those are explicitly distinguished from reproducible mathematics. The bibliography was reviewed as a source list; the works it cites were not all read. Historical performance tables have not been promoted into current predictive evidence.

EPUB locators below are relative to `OEBPS/`. Chapters run from `html/08_chap1.html` through `html/24_chap17.html`; appendices are `html/25_appendixa.html` through `html/27_appendixc.html`. Image locators use `html/docimages/`. Reader page numbers vary.

## 2. Chapter-by-chapter assessment

| Chapter | Useful contribution | Assessment and application |
|---|---|---|
| 1 — How to place bets | Exact terms, line shopping, ticket confirmation, and the difference between a price and a point spread. | Adopt the discipline of matching event, market, line, side and settlement. Historical book procedures and the claimed general value of shopping are not current constants. Wong explicitly does not promise a formula that predicts tomorrow's winners. |
| 2 — Money management | Distinguishes desired winnings from dollars risked; relates stake size to an estimated edge. | Correct the reversed scaling instruction. Interpret the proposal against Kelly's assumptions, not as a new Core staking policy. A losing bankroll does not prove a negative underlying edge. |
| 3 — Internet betting | Counterparty reliability, confirmation, bonus settlement, and comparing offers. | Treat provider, payment, legal and account practices as historical. Free-bet value depends on the probability and whether the stake is returned. Account camouflage is not part of our research workflow. |
| 4 — Straight-bet mathematics | Expected payoff, break-even probability, odds conversion and vig. | The primary reusable mathematical foundation. Repair the intermediate arithmetic typo and use full precision. Separate hit rate, probability edge, expected ROI, hold and overround. |
| 5 — Handicapping | Probability-first thinking; information collection and processing; understanding what prices already reflect. | The strongest operational chapter. Translate checked facts into an explained estimate. Motivation, recent form and public narratives are hypotheses until their numerical effect is supported. The chapter supplies ideas, not a calibrated adjustment table. |
| 6 — Fan money | Examples of price differences, local bias and arbitrage. | Useful as a search hypothesis and payoff lesson. Selected winning anecdotes do not establish a general “fade the public” rule. Arbitrage requires compatible, exhaustive settlement outcomes. |
| 7 — Testing records | Write a hypothesis, separate development from testing, and retain unfavorable outcomes. | Adopt that research discipline. Replace the printed rarity thresholds and the four-standard-error heuristic. Test profitability at actual prices and account for selection, repeated testing and dependence. |
| 8 — Parlays | Decimal-odds products, payout schedules and joint probability. | Correct a payout multiplication error and the covariance discussion. Multiplication of marginal probabilities requires independence; a higher percentage EV need not mean better bankroll growth. No scope change to parlays or props follows. |
| 9 — Poisson props | Forecast a mean, choose a distribution, calculate settlement probabilities, compare price. | Reusable mathematics conditional on a suitable model. A mean and a count do not establish Poisson behavior. Reject Table 7's scale-free extrapolation and compute shifted comparisons exactly. MLB full-game settlement needs more than two independent regulation Poisson counts. |
| 10 — Season wins | Liquidity, contract duration, middles and distributional valuation. | Binomial assumptions need examination. Heterogeneous game probabilities and dependence change the distribution even at the same expected season wins. Calculate actual boundaries and payout states rather than treating half a middle as a literal probability. |
| 11 — Tournament props | Bracket recursion and adding team expectations. | A useful structural idea, but arbitrary seed strengths and Poisson conference totals are not validated predictions. Correct the Big 12 push error and conflicting Big East line/price. Expected conference wins alone do not determine a tail probability. |
| 12 — NFL home field | Separates aggregate home advantage from game-specific effects. | Historical descriptive evidence, not a fixed three-point prescription. Our governed HFA work already addresses current calibration and excludes unqualified venue adjustments. Do not add a second home-field credit. |
| 13 — NFL ATS results | Historical tables segmented by spread and year. | Useful for understanding sample size and constructing tests. Sparse cells and many possible cuts make blanket dog/favorite rules unreliable. Tables are historical data, not independent current signals. |
| 14 — NFL spread versus moneyline | Conditional key-number mass, half-point value, sides/middles and alternative ways to bet a team. | Very useful after replacing percentage shortcuts with payoff-state arithmetic. A fair spread and a push index are different inputs. The historical conversion table cannot serve as a current universal moneyline model. |
| 15 — NFL totals | Separates unconditional scoring totals from conditional push frequencies. | Preserve this distinction. Reprice the exact cutoff and use a supported distribution. The width of a middle alone does not establish value. Historical NFL totals do not value MLB totals. |
| 16 — NFL teasers | Key-number crossings, payout comparison, correlation and settlement rules. | Correct the claim that 69.9% decisive leg accuracy suffices for a two-leg -110 teaser. Reconcile the six-point subgroup counts. Published profitable subsets require fresh testing at actual terms. |
| 17 — Facing the champion | A stated pre-publication versus post-publication test. | Valuable as a case study in research design and record integrity. Listed game inputs, grades and summaries conflict in places. Combined observations are not all independent. Do not adopt an automatic champion-fade rule. |

## 3. Corrected mathematical foundation

### Define the quantities before comparing them

For decimal odds `D`, let `b = D − 1`, the net win per unit risked. Let `pW`, `pP` and `pL` be unconditional probabilities of win, refunded push and loss, with sum one.

- Expected return per unit risked: **`e = pW × b − pL`**.
- With no pushes: **`e = pW × D − 1`**; zero-EV probability is `1/D`.
- With pushes: zero EV requires **`pW/(1−pP) = 1/D`**, provided a decisive outcome is possible.
- Fair decimal odds are **`(1−pP)/pW`**.
- Profit in dollars is risk multiplied by expected ROI; winning-ticket return includes the refunded stake.

At -110, the no-push break-even hit rate is **52.380952%**. An actually 50/50 bet has **−4.545455% expected ROI**. These are different quantities. A percentage-point change in probability changes no-push ROI by `D` times that amount. Book hold and implied-probability overround also have different denominators.

For American odds `−a`, `D = 1 + 100/a`; for `+a`, `D = 1 + a/100`. Preserve full precision until presentation. A paired proportional no-vig calculation supplies a market baseline; it is not proof of an independently estimated true probability.

### Model the settlement, including pushes and altered prices

At the same odds, moving an outcome with probability `r`:

| Settlement change | Increase in expected ROI per unit risk |
|---|---:|
| Loss → push | `r` |
| Push → win | `r × b` |
| Loss → win | `r × D` |

If buying the half point also changes the price, recalculate **all** states at the new payout. The three rows above are not a universal “cents per half point” rule.

For example, assume a genuinely balanced fair NFL spread of -3, a 10% probability of winning by exactly three, and equal decisive chances on either side of that fair spread. This is an illustrative assumption, not a current game forecast.

| Offered bet | Win | Push | Loss | Expected ROI |
|---|---:|---:|---:|---:|
| -3 at -110 | 45% | 10% | 45% | −4.090909% |
| -2.5 at -110 | 55% | 0% | 45% | +5.000000% |
| -2.5 at -120 | 55% | 0% | 45% | +0.833333% |

The exact fair price for the last two no-push outcomes is **-122.222222**, not exactly -120. Wong's shortcut is approximate. Its usefulness depends on an appropriate, independently supported key-number probability.

For a two-bet middle, enumerate the joint payoff. At -110 on both sides, risking $110 each, both wins produce +$200, a win and loss produce −$10, and a win plus push produces +$100. Weight those dollar outcomes by their respective probabilities, then divide by the actual $220 risk. Unequal prices require separate left and right tails.

### Compare moneyline and spread at the same forecast

A lower break-even threshold in a lookup table does not imply a constant ROI advantage at every possible true probability. Under Wong's illustrative masses of 2%, 2% and 10% for favorite margins 1, 2 and 3, respectively, and negligible ties:

- At a 59% favorite straight-up probability, -155 moneyline yields **−2.645161%** ROI and -3 at -110 yields **−4.090909%**.
- At a 70% straight-up probability with those same margin masses, -155 yields **+15.161290%**, while -3 at -110 yields **+16.909091%**.

The preferred expression changes. Calculate the actual expected payouts; do not merely rank approximate break-even percentages or assume each probability point is worth two ROI points.

### Poisson: a mathematical model, not a consequence of knowing the mean

For `X ~ Poisson(λ)`, `P(X=k) = exp(−λ) λ^k/k!`; its mean and variance are both `λ`. A count can have that mean and a different variance or dependence structure. Exposure, changing game states, clustered events and uncertainty in the mean matter. These distribution identities are documented by [NIST](https://www.itl.nist.gov/div898/handbook/eda/section3/eda366j.htm).

For independent Poisson variables, calculate `P(A−B > h)`, `P(A−B = h)` and `P(A−B < h)` from their joint distribution. Subtracting a handicap from a mean is not the same as subtracting it from a random variable: it changes the variance if treated as a new Poisson distribution. A half-integer cutoff has no tie; it does not require splitting the ties from an unrelated integer table.

Table 7 is particularly unsafe outside an unstated scale. For the same expected difference of two, exact independent-Poisson probabilities of A winning **conditional on no tie** are:

| Means A, B | Conditional A-win probability |
|---|---:|
| 12, 10 | 67.831506% |
| 22, 20 | 62.843708% |
| 102, 100 | 55.752017% |

A single approximately 65% answer cannot describe all three. The difference variance is `λA + λB` under independence; the sum of the means matters.

### Season totals and tournaments need their own distributions

The ordinary binomial model uses a fixed number of independent trials with the same success probability. Its probability and variance formulas are described by [NIST](https://www.itl.nist.gov/div898/handbook/eda/section3/eda366i.htm). Independent games with unequal win probabilities instead require convolution of the individual Bernoulli distributions; common season shocks or changing team strength introduce additional dependence.

An exact counterexample shows why expected wins alone is insufficient: in 16 independent games, eight 90% games and eight 10% games have the same expected eight wins as sixteen 50% games. But the probability of exactly eight wins is **35.497068% versus 19.638062%**. The two season middles are not worth the same amount.

Wong's bracket recursion is reproducible in principle: enumerate potential opponents and propagate each possible winner's probability through the tree. However, he does not disclose a complete strength vector that independently reproduces Table 12. With monotone exponential seed strengths `2^(a×(16−seed))`, changing `a` from 0.05 to 0.25 to 1 changes the number-one seed's expected wins from **1.380 to 2.720 to 4.106** in the same bracket. These are mathematical counterexamples, not NCAA forecasts. Bracket topology alone does not establish a ±0.1-win error band.

Conference win distributions must also respect shared opponents, elimination and the fixed number of tournament wins. Poisson may be tested as an approximation; it is not established by adding team expectations.

### Bankroll and statistical validation

For a known no-push binary probability, full Kelly maximizes expected logarithmic growth at `f = (b×pW−pL)/b`, when the optimal fraction is positive and feasible. With refunded pushes the denominator becomes `b×(1−pP)`. Kelly's original objective differs from maximizing expected dollar wealth; the distinction is explicit in [Kelly's 1956 paper](https://www.princeton.edu/~wbialek/rome/refs/kelly_56.pdf).

Wong's MinWin is a target **profit**, not a risk amount. Under no-push assumptions, a 5% expected ROI and target profit of 1.5–2.5% of bankroll correspond to roughly 30–50% of full Kelly. This interpretation is conditional on known edge, payout and portfolio assumptions; it does not authorize a production staking change.

A positive underlying edge can still lose over hundreds of bets. For 300 independent, equal-risk -110 bets with true hit rate 55%, expected ROI is 5%, but the exact probability of finishing with a net loss is **19.193097%**. A realized drawdown is not proof that the true hit rate is below break-even.

For model validation, preserve the forecast before the outcome, use chronological holdouts, evaluate probability calibration and expected/realized returns at actual prices, and retain every tested variant. A p-value is not the probability that an edge is real. Related sides, totals and run lines from one event are not independent research confirmations.

## 4. Findings that require correction or qualification

“Confirmed” below means the supplied source and independent arithmetic conflict. It does not mean that an unverified historical input is true.

| ID | Source location | Finding and correct treatment |
|---|---|---|
| W01 | Ch. 2, varying bets | The prose says divide by the edge/MinEdge ratio; its example doubles the bet when the ratio is two. The internally consistent instruction is **multiply**. |
| W02 | Ch. 2, bankroll/edge discussion | Losing money does not establish an underlying hit rate below 52.4%, and a few hundred bets do not guarantee realization of the stated edge. See the exact loss probability above. |
| W03 | Ch. 3, free bets | A stake-not-returned -110 free bet is worth 45.4545% of face value at a 50% win chance; 47.6190% uses a different 52.38095% assumption. Do not compare offers using inconsistent probabilities or stake-return rules. |
| W04 | Ch. 4, expected ticket example | `0.10 × $110` is $11, not $110. The book's final $126.50 ticket value is correct; net expected profit is $16.50 on $110 risk. |
| W05 | Ch. 4 and glossary | “Win rate” sometimes means expected return and elsewhere means hit rate. Replace the ambiguity with named quantities and units. |
| W06 | Ch. 7, Table 4; images 114–115 | **30 of 138 thresholds are too permissive** for the stated exact upper-tail rarity. Examples: 8–1 has probability 1.953125%, not ≤1%; 12–1 has probability 0.170898%, not ≤0.1%. Each deficient entry needs one additional win at the same sample size. |
| W07 | Ch. 7, inference | A 50% null is not the no-profit null at -110. For 65–35, one-sided p is 0.001759 at 50%, but 0.007247 at 52.380952%. Four standard errors is not a general correction for hypothesis selection. |
| W08 | Ch. 8, moneyline parlay | `$5 × 1.625 × 2.70 = $21.9375` total return, not $13.81. At 55% per independent leg, a three-leg 6:1 parlay has 16.4625% ROI, rather than the printed 16.3%. |
| W09 | Ch. 8, correlation | Perfect negative correlation is −1, not +1. Covariance is not a standardized coefficient bounded by ±1. Zero correlation is not a general independence test; pairwise independence does not establish joint independence for three or more legs. |
| W10 | Ch. 9, Poisson applicability | Counting in ones and knowing a mean do not establish a Poisson distribution. The model and joint independence need support. The book's “precise” answers are conditional on those assumptions. |
| W11 | Ch. 9, shifted means and Table 7 | Do not subtract the handicap from a Poisson mean or extrapolate comparison probability from the mean difference alone. Use the actual integer difference distribution. |
| W12 | Ch. 9, rounding | Under five sacks at mean 4.7 and -120 has exact model ROI **8.061247%**, versus the rounded 8.7%. Problem 10 gives **18.777350%**, versus approximately 24% from the shortcut. Rounding can matter around an action threshold. |
| W13 | Ch. 10, middle ROI formula | `P` is introduced as a percentage while the displayed formula uses it as though already converted. Use `p=P/100`. Unequal-price tails and positive American odds require actual payouts, not a universal negative-vig shortcut. |
| W14 | Ch. 10, Table 11 | Some integer-gap entries give half credit to boundary mass. For 16 50/50 games and over seven wins, true win probability is 59.8190%, push probability 17.4561%; the table's 68.5% is not literal win probability. Use all settlement states. |
| W15 | Ch. 11, Big 12 problem 4 | The offered total is 7.5, yet the solution treats seven wins as a push. With the book's assumed Poisson mean 7.1, under 7.5 at -115 has **+9.148410%** ROI. The erroneous integer-total calculation produces −3.799189%. This reverses the mathematical decision under the assumed model. |
| W16 | Ch. 11, Big East problem 5 | Question total 7.5 becomes 5.5 in the solution; under -105 is calculated as -125. At mean 4.7, the three distinct calculations yield 74.9394%, 30.5047% and 20.3189% ROI. Preserve the stated scenario instead of silently choosing one. |
| W17 | Ch. 12 | “Three points” describes an old aggregate pattern, not a certainty for every future season or venue. Raw point differences and balancing straight-up wins estimate different features of the distribution. |
| W18 | Ch. 14, point value and conversion | Probability points are not ROI points. Push-to-win and loss-to-push gains have different payoffs; some prose reverses which amount is gained. Recompute the precise offered bet and any price change. |
| W19 | Ch. 15, total middle example | The cited Table 25 assigns 3% each to totals 44 and 45. That is 6% both-win mass for over 43.5/under 45.5, or 12 weighted percentage points under the chapter's shortcut—not the stated 14. Exact two-bet ROI at -110 is **1.181818%** under those assumed masses. |
| W20 | Ch. 16, broad -9 to +3 subset | A 69.9% decisive leg rate is below the **72.374686%** equal-leg threshold for a two-leg -110 teaser. Using the printed 68.0% win/29.3% loss/2.7% push rates, expected ROI is **−6.396536%** if any push refunds, or **−7.978736%** if a loss plus push loses. The claimed positive edge is not supported by its own numbers. |
| W21 | Ch. 16, six-point raw data | Table 29's home-dog rows yield **119–41–1**, not the prose's 120–42–2. Across the four stated subgroups the raw rows yield **460–168–4**, versus 461–169–5 in the prose. Both are historical descriptions; neither establishes current profitability. |
| W22 | Ch. 16, seven-point visiting dogs | 218–78 gives **73.648649%** decisive covers, not 76%. The combined 679–236 record gives 74.207650%. |
| W23 | Ch. 17, listed games | Five entries have conflicts between printed inputs and grades. Three additional later-year summary entries conflict with the detailed listing. The historical tables need source reconciliation before statistical reuse. |
| W24 | Ch. 17, combined significance | The printed 86–57 is a 0.944557% upper-tail event under independent 50/50 bets, but 3.760426% under the -110 break-even null. Duplicate/related games and inconsistent rollups further prevent treating it as a clean 1:100 profitability test. |

NIST's definition distinguishes covariance from the standardized correlation coefficient and gives the −1 sign for a perfect negative linear relationship: [correlation reference](https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/correlat.htm).

Other source problems are less central but should be retained in the record: chapter 1 labels a Braves–Yankees World Series example “2000,” whereas MLB records their 1999 series; chapter 7's 65–35 problem briefly changes to 66–35; the SEC question includes an extra conference-ineligible team that disappears in the solution, and calls eight a push at a nine-win total; the ACC answer labels its other teams SEC. Table C5's “B is 12 to 3” title is inconsistent with its 2.2–3.0 headers. C10 and C12 also extend beyond their descriptive title ranges; use the actual headers. The correct baseball year is supported by [MLB's 1999 record](https://www.mlb.com/postseason/history/1999).

## 5. Appendix and table audit

Across **42 appendix tables**, the image audit compared **10,280 displayed probability positions** with independently calculated Poisson probabilities rounded to the nearest integer percent. **10,260 matched; 20 differed.** Each remaining difference was checked visually against the supplied image. All 20 printed values are one percentage point below the correctly rounded value.

The process used table geometry and digit templates trained on visually read cells. Automatic matches are not a manual transcription of every cell. The optional source audit reproduces this image comparison, and its source hash check prevents applying the layout assumptions to a different EPUB. The formulas were also cross-checked against SciPy's probability distributions independently of the image-reading method.

| Table | Inputs | Probability | Printed | Recomputed, rounded |
|---|---|---|---:|---:|
| A15 | Count 46, mean 33 | Exact count | 0% | 1% |
| C2 | A mean 1, B mean 1 | B > A | 34% | 35% |
| C2 | A mean 1.2, B mean 0.9 | A = B | 29% | 30% |
| C2 | A mean 1.2, B mean 1 | B > A | 30% | 31% |
| C2 | A mean 1.9, B mean 0.6 | A > B | 68% | 69% |
| C2 | A mean 3, B mean 1 | A > B | 77% | 78% |
| C3 | A mean 3.8, B mean 1.5 | A > B | 78% | 79% |
| C4 | A mean 2.2, B mean 1.8 | A > B | 47% | 48% |
| C4 | A mean 3, B mean 2 | A > B | 58% | 59% |
| C4 | A mean 3.1, B mean 2 | B > A | 23% | 24% |
| C4 | A mean 3.3, B mean 1.6 | A > B | 70% | 71% |
| C4 | A mean 3.5, B mean 1.7 | A > B | 71% | 72% |
| C4 | A mean 3.6, B mean 1.6 | A > B | 74% | 75% |
| C4 | A mean 3.6, B mean 1.8 | B > A | 15% | 16% |
| C4 | A mean 3.9, B mean 1.7 | A > B | 76% | 77% |
| C4 | A mean 4, B mean 1.9 | A > B | 74% | 75% |
| C11 | A mean 23, B mean 12.5 | A > B | 95% | 96% |
| C11 | A mean 24.5, B mean 13 | A > B | 96% | 97% |
| C12 | A mean 22.5, B mean 15.5 | A > B | 85% | 86% |
| C12 | A mean 24.5, B mean 15 | A > B | 92% | 93% |

Exact image/row/column locations and per-table counts are retained in the [audit JSON](../research/audits/sharp-sports-betting-2026-09-07.json). Use full-precision calculations for decisions; fixing a rounded cell does not validate the forecast mean or the distribution assumption.

The printed appendix ranges also matter. A3 stops at six even though larger counts have nonzero probability. B13 stops at 20 with cumulative probabilities below 100%. Missing tails cannot all be explained by rounding. A printed 0% is not an impossible event, and a printed 100% is not certainty. Recompute the CDF or survival probability when the needed threshold lies outside the displayed rows.

| Table family | Review result |
|---|---|
| 1–2: break-even and odds ratios | Formula and interpretation reviewed; use exact odds conversions rather than rounded price limits. |
| 3: 1988 horse-racing payouts | Historical illustration of different pools, not a current bias estimate; no claim of external recertification of each location's payout. |
| 4: statistical rarity | All 138 thresholds compared; 108 agree exactly and 30 are too lenient under the stated exact interpretation. |
| 5–6: parlay payouts/conversion | Distinguish the historical offered payout grid from a literal product of per-leg odds. Decimal conversions and worked examples recomputed. |
| 7: high-count comparison | General scale-free use rejected; variance and tie mass must be included. |
| 8–11: season wins | Binomial calculations, middle placement, fractional boundary treatment and actual payoff consequences reviewed. Same mean need not imply the same distribution. |
| 12: tournament seeds | Expected-win sum can be made 63; that accounting identity does not validate arbitrary strengths or a conference tail distribution. |
| 13–15: home advantage | Period is 1990–2010. The Table 13 aggregate is 13,888 excess home points in 5,114 games, or 2.715682 points/game. Table 14 lists 2,981 home wins, 2,129 away wins and four ties. Table 15 balances 2,331 versus 2,343 after adding three to visitors, with 440 ties. |
| 16, 22: ATS and straight-up records | Read all component images; spread orientation, sparse sample sizes, neutral-site exclusions and differences between straight-up and ATS targets retained. No universal favorite/dog rule inferred. |
| 17–18 | Explicitly omitted by the EPUB publisher; their absence is not an extraction gap. |
| 19–21: margins and pricing | ±2-point conditioning, overlapping denominators, duplicated pick'em orientations and subjective rounded indexes reviewed. Conditional push mass is not unconditional frequency of either team winning by a number. |
| 23–25: NFL totals | Table 23 excludes Super Bowls; Table 24 includes them and conditions on a nearby quoted total. These populations cannot be exchanged silently. |
| 26–29: teasers | Historical payout schedules separated from the 16 mathematical break-even entries. Actual push rules and the raw/prose discrepancies are recorded. |
| 30 and chapter 17 summaries | Historical results and scenario definitions reviewed; internal grade and aggregation checks completed. Original external lines/scores are not all recertified. |
| A1–A15, B1–B15, C1–C12 | Every displayed probability position was included in the appendix audit. The comparison uses the actual row/column headers and full-precision probability calculations. |

### Chapter 17 reconciliation

The five printed-input/grade conflicts are:

1. 1989 week 6: Dallas–San Francisco total 47, listed score 14–31, labeled Over; 45 points is Under that printed total.
2. 1994 week 6: Washington -13 with score 17–21, labeled W; those printed inputs grade L.
3. The opposite Philadelphia +13 entry, score 21–17, is labeled L; those inputs grade W.
4. 1997 week 3: Miami–Green Bay total 42, listed score 18–23, labeled Over; 41 points is Under.
5. 2000 week 3: San Francisco +17, listed score 41–24, labeled push; the displayed score orientation does not produce a push.

The last case may be a reversed score and the 1994 pair may have reversed signs. The audit identifies inconsistency; it does not silently decide which historical field is wrong. A 1987 entry also labels an unknown total Under, which cannot be verified from the listing.

For the 2001–2010 “next opponent” category, detailed entries produce **27–21**, while the summary claims **29–20**. Three summary discrepancies explain the change: Seattle's 2003 week-6 next-opponent bet is L in the listing and W in the summary; a 2004 week-3 bye becomes L in the summary; Dallas's 2006 week-1 entry is L in the listing and W in the summary. Combined detailed category grades are **84–58–3**, not the claimed 86–57–3. Neither rollup is a clean set of independent bets.

## 6. Worked-exercise results worth retaining

These calculations accept the book's specified probabilities or hypothetical Poisson means solely to audit the mathematics. They do not endorse those inputs as forecasts.

| Chapter 9 exercise | Exact result under stated assumptions |
|---|---|
| 1 — Under five tackles, mean 4.8, even money | Win 47.625875%, push 17.474768%, loss 34.899356%; ROI **12.726519%**. |
| 2 — Goals 2.5 versus touchdowns 1.6, −0.5 at -115 | Win 57.366774%; ROI **7.250925%**. Apply the paired half-point spread once. |
| 3 — Completions 12 versus misses 7.3, −2 at -115 | Win 69.063152%, push 7.649025%, loss 23.287823%; ROI **36.767092%**. |
| 4 — Passing yards versus basketball points | The proposed Poisson method is inappropriate; no numerical solution is established. |
| 5 — No fourth-down conversion, mean 0.4, -200 | Win 67.032005%; ROI **0.548007%**. Slightly positive in the model, but below Wong's example 5% minimum; not exactly break-even. |
| 6 — Any tie after 0–0 | Requires a scoring-path model; the supplied count method does not solve it. |
| 7 — Fewer than three passers | Under the stated independence assumption, `0.9×0.7=0.63`; even-money ROI **26%**. |
| 8 — Over 10.5 made threes, mean 10.6, +120 | Win 49.159119%; ROI **8.150061%**. |
| 9 — Over 19.5 assists, mean 20, even money | Win 52.974273%; ROI **5.948547%**. |
| 10 — 26.6 attempts versus 18, −6.5 at -110 | Win 62.216707%; ROI **18.777350%**. |
| 11 — Free throws 15.4 versus 12.4, −1.5 at -120 | Win 61.140399%; ROI **12.090731%**. |

Other exercise checks are in the [reproducible audit results](../research/audits/sharp-sports-betting-2026-09-07.json). Examples include the six MinWin stake calculations; all ten chapter-4 problems; chapter-7 exact tails; season-middle payouts; every chapter-11 conference example; and chapter-14 alternative-price comparisons.

Chapter 7's 150–100 record is indeed below a 0.1% tail under a 50% null; 250 is the first multiple-of-five sample size reaching that threshold at exactly 60% wins. This correct worked example should not be discarded merely because other entries are wrong. Likewise, most basic odds, expectation and independent-count mathematics survives recomputation.

## 7. Comparison with current Core and Walters/Graham

| Topic | Wong contribution | Current project treatment |
|---|---|---|
| Numerical fair | Explains how to value a bet once forecast probabilities exist. | Core requires a supported estimate, range and substantive current evidence. A de-vigged quote alone is insufficient for an evaluated PASS. |
| Judgment and uncertainty | Encourages informed estimation but gives no universal calibrated band. | Supported quantitative comparisons or scenarios can justify a judgmental market-anchored estimate; a prebuilt model is not universally required. Arbitrary fixed adjustments and ±8-point bands do not become supported because a book is cited. |
| Home advantage | Historical “around three” and game-specific hypotheses. | H4 already activates **2.082 points** for eligible domestic home games and zero base HFA for resolved neutral games. Team/venue blanket and selective venue adjustments remain disabled. Wong creates no second location adjustment. |
| Key numbers | Historical conditional margin frequencies and payout logic. | BW6 remains **non-operational**, with no production fair, stake or BET authority. Its model-oriented distribution is a different target from Wong's close-to-market conditional push estimates. Do not substitute or average the tables. |
| Spread versus moneyline | Compare alternative expressions of the same team view. | Walters' source table and Wong's source table have different numeric trade-offs. Neither agreement nor disagreement between two books is an independent current signal. Use the governed forecast and appropriate payoff distribution. |
| Market movement | Prices may respond to information, liabilities, customers or other books. | Movement alone does not prove public or sharp causation. Preserve exact quotes and their observation times; current evidence and pricing have separate freshness needs. |
| Staking and scope | MinWin, Kelly-like scaling, props, parlays and teasers. | Existing staking, exposure and scope rules remain authoritative. This review does not unpause props or authorize new risk. |

The pinned HFA snapshot supplies a useful modern comparison, with market fields excluded from this calculation:

| Sample in existing snapshot | Eligible regular-season home games | Mean home-minus-away points |
|---|---:|---:|
| 2021–2024 | 1,068 | 2.029026 |
| 2025 | 265 | 2.184906 |
| 2021–2025 pooled | 1,333 | 2.060015 |

These are descriptive results from the repo's snapshot, not causal venue estimates or a replacement calibration. Filter: `REG`, `location=Home`, both scores present, specified seasons. The pooled standard error is 0.389431 points. The independently governed 2.082 release has its own estimation and acceptance process.

Snapshot: `data/walters/nfl/home-field/source/nflverse-schedules-hfa-snapshot-2026-09-01.csv`; SHA-256 `5c3f02dfe4357d8debfa95ed923a79a622fcaabfc9f098a1d71c10a45d277bc7`. The source release identifies the [nflverse schedules asset](https://github.com/nflverse/nflverse-data/releases/tag/schedules).

Historical structures also require care. The NFL moved to 17 regular-season games in 2021; the book's 16-game examples are historical. [NFL announcement](https://www.nfl.com/news/nfl-season-to-feature-17-regular-season-games-per-team). The NCAA states that its tournaments expand from 68 to 76 teams in 2027, retaining a 64-team first round after the opening games. Thus Wong's 63-win accounting only covers the specified 64-team stage, not every game of an expanded event. [NCAA explanation](https://www.ncaa.org/championships/march-madness/expansion-what-to-know/).

## 8. What changes in research execution

The full review supports a focused improvement to the existing workflow, not another collection of independent gates.

1. **Resume by game and unfinished step.** Reuse checked facts with their original source IDs and timestamps. Recheck changing inputs. A repeated read is not new independent evidence.
2. **Complete the numerical bridge.** State the baseline, relevant numerical inputs, units, orientation, and how they become an estimate. If using a market anchor, explain the incremental information or processing and its magnitude; a supported no-change result is legitimate.
3. **Construct the range.** Derive endpoints from documented input scenarios, observed model error, or a justified quantitative comparison. Label a sensitivity range as such; do not call it a calibrated confidence interval.
4. **Price every actual settlement.** Produce each market's win/push/loss probabilities or other appropriate settlement outcomes at the exact offered line and odds. Moneyline support does not automatically establish run-line or total support.
5. **Keep the remaining work specific.** If the missing element is a starter workload, lineup run contribution, dependence assumption, or range endpoint, name it and retain the attempted calculation. Use the existing `sourceEvidence`, `fairValueEvidence`, and `blocker.progress` fields.
6. **Publish completed decisions through current authority.** A supported PASS is a useful completed result. An unresolved fair remains research-incomplete. The goal is completed defensible evaluations, not a target count of bets or an artificially lower blocked count.

The earlier [Angels–Red Sox trial](SHARP_SPORTS_BETTING_TRIAL_2026-09-07.md) remains a valid diagnosis: the archived arithmetic can be reproduced, but the supplied facts do not derive its −1.5-percentage-point Angels adjustment or ±8-point band. Wong does not supply those missing numbers.

### A concrete full-game modeling distinction

Suppose, **only as a mathematical demonstration**, independent regulation run counts have means 4.2 and 4.8. The regulation tie probability is 13.243626%. If an additional, unsupported-for-any-real-game 50/50 extra-innings assumption resolves ties, the first team's moneyline probability becomes 42.181024%.

That calculation still does not establish the full-game total or run line. An integer regulation total of nine has 13.175564% push probability in this model. Extra innings, home-team game-ending rules and unequal innings played can change the full-game score distribution. Calling these regulation probabilities full-game MLB evidence would introduce a settlement error even if the Poisson arithmetic is perfect.

A usable scoring route must therefore support the expected starter/bullpen workloads and contributions, opponent/lineup and park/conditions effects, the scoring distribution and dependence, and the actual settlement horizon. A usable judgmental route must show the quantitative comparison or scenarios used to choose the adjustment and range. Either route can use Wong's corrected pricing mathematics once its inputs are defensible.

## 9. Adoption decision and reproducibility

**Use now as research methods:** precise payoff/odds arithmetic; event and settlement identity; probability-first evaluation; quantitative explanations of adjustments and ranges; independent test data; specific progress records.

**Research hypotheses requiring their own evidence:** Poisson scoring/count models; current conditional NFL key-number mass; venue and motivation adjustments; market-bias claims; season/tournament distributions; teaser profitability and champion-fade rules.

**Do not adopt from the book as defaults:** a fixed three-point home advantage, its old moneyline/spread conversion prices, its significance table, Table 7's difference-only extrapolation, a universal win-rate threshold, or a claim that short-run losses prove no edge.

The audit is research-only. It has not cleared any of the archived 42 blocked selections, changed an issued report, changed live odds or model values, or issued a stake. Clearing a selection still requires the actual current-game work.

Recompute the portable calculations from the repository root with:

```bash
python3 tools/audit-sharp-sports-betting.py --output /tmp/wong-review-audit.json
```

Verification completed: all 138 significance thresholds and all 10,280 rounded appendix calculations agree with independent SciPy calculations. Another 792 full-precision probability comparisons had a maximum absolute difference below `9×10⁻¹⁵`. The saved results reproduce from the audit code, and the existing scheduled-authority and research-progress tests pass.

The generated [audit JSON](../research/audits/sharp-sports-betting-2026-09-07.json) retains exact results and the full Table 4 threshold comparison. The appendix image audit and chapter-17 consistency check can be repeated against a local copy of the supplied EPUB using `--epub /absolute/path/to/book.epub`; this optional mode requires Pillow and NumPy. The default calculation mode uses the Python standard library and the pinned repository snapshot. The saved JSON includes both source audits; default mode deliberately omits source-dependent results. The full book and its image tables remain outside the public repository; this review and the code are original derived work.

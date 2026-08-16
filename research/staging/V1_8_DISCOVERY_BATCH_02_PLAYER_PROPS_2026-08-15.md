# Betting Edge Research Library v1.8 — Discovery Batch 02: Player Props

**Date:** 2026-08-15  
**State:** STAGING ONLY — NOT RUNTIME AUTHORITY  
**Active production library remains:** Research Library v1.7  
**Production manifest remains:** `research/manifest.json`

## Hard boundary

Nothing in this file is approved canonical research. Normal Betting Edge reports must continue reading Research Library v1.7 only. This staging batch must not be referenced by the production manifest, report prompts, runner, odds workflows, contract, or live History Fit runtime until a later explicit review/promotion step.

This batch is dedicated to the largest known v1.8 gap: **player-prop calibration, player-level forecasting, participation uncertainty, price quality and market-specific transportability across the major sports.**

## Evidence classes used in this batch

To prevent player-performance research from being mistaken for sportsbook-calibration evidence, every candidate is labeled by directness:

- **DIRECT PROP MARKET** — explicitly studies sportsbook/DFS proposition lines, proposition pricing, or EV against posted player markets.
- **PROP-ADJACENT MARKET** — studies a closely related player pricing/DFS/Pick’em market but is not equivalent to a regulated sportsbook prop.
- **PLAYER FORECAST MECHANISM** — predicts the player statistic or event underlying a prop but does not validate sportsbook prices.
- **INTEGRITY / PARTICIPATION CONTEXT** — informs uncertainty, availability or manipulation risk; not a predictive betting edge.
- **EXPLICIT GAP** — targeted search did not find adequate direct evidence; History Fit should prefer NR over cross-market invention.

## Coverage snapshot after Batch 02

| Sport | Direct / near-direct prop evidence found | Mechanism evidence found | Current staging assessment |
|---|---:|---:|---|
| NFL | Yes | Yes | **Moderate and improving** — strong Pick’em/pricing work plus player forecasting; direct sportsbook single-player calibration still needs more. |
| NBA | Yes | Yes | **Best-covered major sport so far** — direct FanDuel prop-line study plus modern player-stat forecasting. |
| WNBA | No strong scholarly direct prop study found in targeted search | Limited | **Explicit gap remains** — do not silently inherit NBA prop calibration. |
| NHL | Yes | Yes | **Strong focused evidence for anytime goalscorer**; shots/points/goalie prop calibration still needs expansion. |
| MLB | No strong direct sportsbook player-prop calibration study found in targeted search | Yes | **Mechanism-rich, market-calibration thin** — good event/player models, but sportsbook strikeout/hit/total-base/HR prop pricing remains a gap. |

## Candidate set

### NFL

#### V18-PROP-NFL-001 — Predictive Analytics for NFL Pick’em Contests

- **Source:** Dan Wu (2025), UCLA/eScholarship thesis, *Predictive Analytics for NFL Pick’em Contests: A Comparative Study of Gradient Boosting Models*.
- **Directness:** PROP-ADJACENT MARKET.
- **Data / surface:** 2023–2024 NFL play-by-play data supplied by WagerWire; models support real-time pricing of DFS Pick’em entries.
- **Prop relevance:** Explicitly forecasts player metrics used in Pick’em-style propositions; CatBoost is reported as especially effective for Passing Yards, with XGBoost and LightGBM also compared.
- **Why it matters:** One of the closest current academic sources to an NFL player-prop pricing engine. Useful for model architecture, real-time repricing and uncertainty, but DFS/Pick’em pricing must not be treated as identical to sportsbook over/under pricing.
- **Provisional History Fit role:** methodology / player-forecast architecture.
- **Review status:** DEEP REVIEW.

#### V18-PROP-NFL-002 — Method and Validation for Optimal Lineup Creation for Daily Fantasy Football

- **Source:** Mahoney & Paniak (2023), arXiv `2309.15253`.
- **Directness:** PLAYER FORECAST MECHANISM.
- **Data / surface:** NFL player fantasy-point forecasting using supervised learning and DraftKings comparison context.
- **Why it matters:** Provides a reproducible baseline for player-performance forecasting under uncertainty and demonstrates that player projections can be validated prospectively rather than by anecdotal hit rate.
- **Limitation:** Fantasy-point aggregation is not a sportsbook prop line and can hide stat-specific calibration error.
- **Provisional History Fit role:** methodology / caution.
- **Review status:** REVIEW.

#### V18-PROP-NFL-003 — A Statistical Theory of Optimal Decision-Making in Sports Betting

- **Source:** Dmochowski (2023), PLOS ONE, DOI `10.1371/journal.pone.0287601`.
- **Directness:** PROP-ADJACENT METHODOLOGY.
- **Data / surface:** Sportsbook propositions framed as thresholds on outcome distributions; empirical NFL analysis on spreads/totals.
- **Why it matters for props:** Establishes the distinction between estimating a median outcome and knowing enough of the distribution/quantiles to decide whether a quoted proposition offers positive expected profit. This is directly useful for player over/under architecture even though the empirical section is game-level.
- **Provisional History Fit role:** methodology.
- **Review status:** DEEP REVIEW.

#### V18-PROP-NFL-GAP-01 — Direct regulated-sportsbook single-player prop calibration

- **Finding:** Targeted discovery found useful Pick’em/DFS pricing work and extensive NFL game-market efficiency literature, but not yet a strong peer-reviewed study that evaluates modern regulated sportsbook player props such as passing yards, receiving yards, receptions, rushing yards or anytime TD across multiple books.
- **Required behavior:** Until direct evidence is added, NFL prop History Fit must distinguish player-forecast mechanism from sportsbook-price calibration.
- **Status:** EXPLICIT GAP — KEEP SEARCHING.

### NBA

#### V18-PROP-NBA-001 — Betting on Performance: NBA Player Performance Relative to Sportsbook Expectations

- **Source:** Benjamin Wornow (2026), Claremont McKenna College senior thesis, *Betting on Performance: Sports Betting Legalization and NBA Player Performance Relative to Sportsbook Expectations*.
- **Directness:** DIRECT PROP MARKET.
- **Data / surface:** FanDuel closing over/under prop lines linked to actual outcomes for 178 NBA players across five statistical categories, covering 2022–2025.
- **Key finding for review:** The study reports greater absolute deviation from prop-line expectations in legalized markets but no consistent directional bias; the points market showed the strongest reported effect.
- **Why it matters:** This is unusually direct evidence using actual player proposition lines rather than generic game odds.
- **Limitations:** Undergraduate thesis, restricted full text, one prominent sportsbook, and the research question is legalization/player behavior rather than pure market calibration.
- **Provisional History Fit role:** direct / mixed / caution depending on market.
- **Review status:** HIGHEST PRIORITY DEEP REVIEW.

#### V18-PROP-NBA-002 — Accurate NBA Player Performance Forecasting and DFS Optimization

- **Source:** Papageorgiou, Sarlis & Tjortjis (2024/2025), *International Journal of Data Science and Analytics*, DOI `10.1007/s41060-024-00523-y`.
- **Directness:** PLAYER FORECAST MECHANISM.
- **Data / surface:** Individual models for 203 NBA players; points, rebounds, assists, steals, blocks and turnovers are modeled directly or through fantasy-point construction; multi-season validation is included.
- **Why it matters:** Gives v1.8 sport-specific evidence about which player statistics can and cannot be forecast stably, and about the danger of treating aggregate fantasy accuracy as equivalent to each component prop.
- **Provisional History Fit role:** methodology / mechanism.
- **Review status:** DEEP REVIEW.

#### V18-PROP-NBA-003 — Comparative Machine-Learning Performance Forecasting in Basketball

- **Source:** *Evaluating the effectiveness of machine learning models for performance forecasting in basketball: a comparative study* (2024), Knowledge and Information Systems, DOI `10.1007/s10115-024-02092-9`.
- **Directness:** PLAYER FORECAST MECHANISM.
- **Data / surface:** 90 high-performance players; forecasts individual PTS, REB, AST, STL, BLK and TOV and compares 14 ML models with unseen-data evaluation.
- **Why it matters:** Directly maps to common prop stat families and provides error-oriented model comparison rather than simple recent-hit-rate reasoning.
- **Provisional History Fit role:** methodology / mechanism.
- **Review status:** DEEP REVIEW.

#### V18-PROP-NBA-004 — Calibration vs Accuracy in Sports Betting

- **Source:** Walsh & Joshi (2024), *Machine Learning with Applications* 16, 100539, DOI `10.1016/j.mlwa.2024.100539`.
- **Directness:** BETTING METHODOLOGY; already staged in Batch 01.
- **Why cross-linked here:** Uses NBA data and published odds to show why probability calibration is more relevant to wagering decisions than classification accuracy. This should become a governing methodological prior for player-prop models as well as game markets.
- **Review status:** BATCH-01 CROSS-LINK — DO NOT DUPLICATE AS INDEPENDENT EVIDENCE.

### WNBA

#### V18-PROP-WNBA-GAP-01 — Direct WNBA player-prop calibration

- **Finding:** Targeted search found current commercial/industry prop tooling and increasing WNBA prop availability, but no strong peer-reviewed or thesis-level study directly calibrating regulated sportsbook WNBA points, rebounds, assists or combination prop lines.
- **Why it matters:** WNBA rotations, sample size, expansion, player availability and market depth differ from the NBA. NBA player-prop evidence must not automatically be promoted as direct WNBA evidence.
- **Required behavior:** Use NR or clearly labeled cross-league analogy until direct WNBA evidence is found.
- **Status:** EXPLICIT GAP — HIGH PRIORITY.

#### V18-PROP-WNBA-001 — Network prediction in competitive women’s basketball

- **Source:** Bonato & Hinds (2026), arXiv `2601.23193`, *Network analysis and link prediction in competitive women's basketball*.
- **Directness:** PLAYER FORECAST MECHANISM — INDIRECT.
- **Data / surface:** Includes WNBA player-level passing and shot-blocking interaction prediction.
- **Why it matters:** Demonstrates that player interaction structure can contain predictive information, but it does not validate sportsbook prop lines and should not be used to manufacture a points/rebounds/assists betting prior.
- **Provisional History Fit role:** methodology / indirect context only.
- **Review status:** LOW-WEIGHT REVIEW.

### NHL

#### V18-PROP-NHL-001 — Machine Learning for NHL Anytime Goalscorer Betting

- **Source:** Vanderbilt University Data Science capstone case study (2025), *Developing Machine Learning Solutions for NHL Sports Betting*.
- **Directness:** DIRECT PROP MARKET.
- **Data / surface:** DraftKings anytime goalscorer odds plus Hockey Reference and Rotowire; 250+ features; random forest, XGBoost and neural-network approaches; profitability and binary cross-entropy considered.
- **Key result:** None of the tested models achieved profitability against DraftKings; XGBoost was the best-performing among the tested models. The project also identifies odds shopping as material.
- **Why it matters:** This is exceptionally useful cautionary evidence because it directly tests an NHL player prop and fails to beat the book despite a large feature set.
- **Provisional History Fit role:** direct caution / market-efficiency guardrail.
- **Review status:** HIGHEST PRIORITY DEEP REVIEW.

#### V18-PROP-NHL-002 — Shooter- and Goaltender-Skill-Adjusted Expected Goals

- **Source:** J. T. P. Noel (2025), arXiv `2511.07703`, *Expected by Whom? A Shooter and Goaltender Skill-adjusted Expected Goals Model for the NHL*.
- **Directness:** PLAYER FORECAST MECHANISM.
- **Data / surface:** NHL spatiotemporal shot data; LightGBM; player- and goalie-skill features; evaluated with log loss, Brier score and AUC.
- **Why it matters:** Directly informs goal/scoring probability architecture and demonstrates that shooter and goalie identity can improve event probabilities beyond baseline xG.
- **Limitation:** Does not test sportsbook prop prices or shots-on-goal lines.
- **Provisional History Fit role:** mechanism / methodology.
- **Review status:** DEEP REVIEW.

#### V18-PROP-NHL-003 — Daily Fantasy Hockey Player Pricing

- **Source:** Benjamin Goldman (2014), Macalester College, *Do Expected Marginal Revenue Products for National Hockey League Players Equal Their Price in Daily Fantasy Games?*
- **Directness:** PROP-ADJACENT MARKET.
- **Key finding for review:** Reports home/weak-opponent undervaluation and recent-performance overvaluation in the studied daily-fantasy pricing environment, while emphasizing substantial randomness in performance.
- **Why it matters:** Useful historical evidence for recency-bias questions, but it is old and DFS pricing is not a modern sportsbook prop market.
- **Provisional History Fit role:** historical caution / low transportability.
- **Review status:** REVIEW WITH STRONG ERA/MARKET CAVEAT.

#### V18-PROP-NHL-004 — Weighted Shots and Future Player Performance

- **Source:** Macdonald, Lennon & Sturdivant (2012), arXiv `1205.1746`, *Evaluating NHL Goalies, Skaters, and Teams Using Weighted Shots*.
- **Directness:** PLAYER FORECAST MECHANISM.
- **Why it matters:** Provides player/goalie shot-quality modeling and explicitly tests whether advanced weighted-shot measures improve future-performance indication; useful for shots/goals prop mechanism and as a warning against assuming a sophisticated metric automatically forecasts better.
- **Provisional History Fit role:** methodology / caution.
- **Review status:** REVIEW.

#### V18-PROP-NHL-GAP-01 — Shots, points and goalie props

- **Finding:** Direct goalscorer evidence is now present, but strong direct sportsbook calibration for shots-on-goal, points, assists and goalie saves props remains thin.
- **Status:** EXPLICIT GAP — KEEP SEARCHING.

### MLB

#### V18-PROP-MLB-001 — Bayesian Batter/Pitcher Matchup Event Probabilities

- **Source:** Doo & Kim (2018), PLOS ONE, DOI `10.1371/journal.pone.0204874`, *Modeling the probability of a batter/pitcher matchup event: A Bayesian approach*.
- **Directness:** PLAYER FORECAST MECHANISM.
- **Data / surface:** Hierarchical log5 event-probability modeling for batter/pitcher matchups.
- **Why it matters:** Player props such as hits, total bases, HR and strikeout-related markets are built from repeated batter/pitcher events. The hierarchical treatment of sparse matchup samples is directly relevant to avoiding naive batter-vs-pitcher overfitting.
- **Transportability caveat:** Empirical data are KBO rather than MLB; mechanism can inform architecture but not MLB prop calibration directly.
- **Provisional History Fit role:** methodology.
- **Review status:** DEEP REVIEW.

#### V18-PROP-MLB-002 — Forecasting and Analysis of MLB Player Performance

- **Source:** Christopher Watkins (2020), Chapman University PhD dissertation, DOI `10.36837/chapman.000139`, *Novel Statistical and Machine Learning Methods for the Forecasting and Analysis of Major League Baseball Player Performance*.
- **Directness:** PLAYER FORECAST MECHANISM.
- **Data / surface:** Statcast-based work includes game-level pitcher effectiveness, pitch-sequence prediction, outs/hits/strikeouts and player-performance projection.
- **Why it matters:** Provides MLB-specific evidence on event prediction and dynamic pitcher form while avoiding reliance on a simple recent-game average.
- **Provisional History Fit role:** mechanism / methodology.
- **Review status:** DEEP REVIEW.

#### V18-PROP-MLB-003 — Personnel-Adjusted Home Run Park Effects

- **Source:** Osborne & Levine (2025), arXiv `2506.22350`, *Personnel-adjustment for home run park effects in Major League Baseball*.
- **Directness:** PLAYER FORECAST MECHANISM.
- **Data / surface:** 13 seasons; generalized linear mixed effects; controls hitter/pitcher personnel and handedness when estimating HR park effects.
- **Why it matters:** Directly challenges naive park-factor use in HR props and shows that observed park HR rates can materially differ after personnel adjustment.
- **Provisional History Fit role:** methodology / caution.
- **Review status:** HIGHEST PRIORITY DEEP REVIEW FOR HR PROPS.

#### V18-PROP-MLB-004 — MLB Home Run Performance Prediction with LSTM

- **Source:** Sun, Lin & Tsai (2022), arXiv `2206.09654`, *Performance Prediction in Major League Baseball by Long Short-Term Memory Networks*.
- **Directness:** PLAYER FORECAST MECHANISM.
- **Data / surface:** MLB home-run performance prediction compared with other ML models and a traditional projection system.
- **Why it matters:** Useful player-power forecasting evidence, but the target is not a single-game sportsbook HR probability.
- **Provisional History Fit role:** mechanism only.
- **Review status:** REVIEW.

#### V18-PROP-MLB-005 — Neural Sabermetrics World Model

- **Source:** Ahn, Du, Zhang & Kang (2026), arXiv `2602.07030`, *Neural Sabermetrics with World Model: Play-by-play Predictive Modeling with Large Language Model*.
- **Directness:** PLAYER / MICRO-EVENT FORECAST MECHANISM.
- **Data / surface:** More than ten years of MLB tracking data, over seven million pitch sequences; predicts next pitch and batter swing decisions.
- **Why it matters:** Shows the growing predictive potential of pitch-level sequence modeling and could inform future batter/pitcher event models.
- **Integrity boundary:** Micro-event predictive research is especially sensitive and must not be treated as permission to expand Betting Edge into manipulable pitch-by-pitch wager classes.
- **Provisional History Fit role:** methodology / integrity-sensitive context.
- **Review status:** REVIEW — NOT A PRODUCTION PROP PRIOR.

#### V18-PROP-MLB-GAP-01 — Direct sportsbook player-prop calibration

- **Finding:** Targeted search found substantial MLB player/event forecasting literature but did not identify a strong scholarly modern study directly evaluating multi-book sportsbook strikeout, hits, total bases or HR proposition prices and their calibration/closing behavior.
- **Required behavior:** Do not label sophisticated Statcast/player prediction work as proof that MLB prop markets are inefficient.
- **Status:** EXPLICIT GAP — HIGH PRIORITY.

## Cross-sport rules emerging from Batch 02

1. **A forecast is not a price edge.** Player-performance accuracy cannot be promoted to History Fit support for a bet unless the research also connects the forecast to market probability/price or is clearly labeled mechanism-only.
2. **Exact market class matters.** NBA points research is not direct evidence for NBA rebounds; NHL goalscorer research is not direct evidence for shots; MLB HR mechanism is not strikeout calibration.
3. **League transportability is not automatic.** NBA evidence does not become WNBA evidence merely because the stat names match.
4. **Single-book evidence gets a book-concentration caveat.** Direct DraftKings/FanDuel studies are valuable but do not establish multi-book calibration.
5. **Participation uncertainty is first-class.** Minutes, starting role, scratches, pitcher workload, ice time, targets and lineup position can dominate player-prop distributions and must be verified separately from historical fit.
6. **Props require distributions, not just means.** A projection centered near a sportsbook threshold is insufficient without variance/tail information and a de-vigged price comparison.
7. **Combination and parlay props require dependence modeling.** Component-level calibration cannot simply be multiplied when outcomes are correlated.
8. **Micro-prop integrity risk remains a separate caution layer.** Predictability and market availability do not imply that increasingly granular single-action wagers should be treated as normal production targets.

## What this batch changes about the v1.8 plan

The player-prop research lane is now materially deeper, but it is **not ready for canonical promotion**. The evidence is uneven by sport:

- NBA has a credible direct prop-line candidate and multiple modern player-stat forecasting papers.
- NHL has a valuable direct anytime-goalscorer study with a negative profitability result, plus strong goal-probability mechanism research.
- NFL has strong prop-adjacent/Pick’em forecasting and general proposition methodology, but still needs direct multi-book sportsbook player-prop calibration.
- MLB has deep player/event modeling but still needs direct sportsbook prop-market studies.
- WNBA remains a genuine direct-evidence gap and should be treated as such rather than borrowing NBA confidence.

## Batch 03 research priorities

1. Search specifically for **sportsbook closing-line calibration** in NFL passing/rushing/receiving props.
2. Search specifically for **MLB pitcher strikeout, hits, total bases and HR odds histories** in scholarly repositories, theses and reproducible datasets.
3. Search for **NHL shots-on-goal and goalie-save** market studies.
4. Continue targeted WNBA search; if scholarly evidence remains absent, build a formal WNBA research-gap record instead of lowering admission standards.
5. Locate datasets or replication packages that contain **actual historical player-prop prices**, especially multi-book or opening/closing prices.
6. Deep-review the strongest Batch 02 direct candidates and assign provisional evidence tier, transportability, directness and conflict-cluster membership.

## Promotion boundary

No Batch 02 candidate enters `research/research-library.json`, `research/source-registry.json`, `research/taxonomy.json`, `research/history-fit-policy.json`, or `research/manifest.json` until citation verification, deduplication, full-method review and explicit approval are complete.

# Betting Edge Research Library v1.8 — Discovery Batch 03: NHL Props Deep Dive

**Date:** 2026-08-15  
**State:** STAGING ONLY — NOT RUNTIME AUTHORITY  
**Active production library remains:** Research Library v1.7  
**Production manifest remains:** `research/manifest.json`

## Hard boundary

Nothing in this file is approved canonical research. Normal Betting Edge reports must continue reading Research Library v1.7 only. This staging batch must not be referenced by the production manifest, report prompts, runner, odds workflows, contract, or live History Fit runtime until a later explicit review/promotion step.

This pass focuses on NHL player props, with **shots on goal (SOG)** as the primary market, followed by goalie saves, goals, points/assists and usage/context factors that materially affect those props.

## Executive assessment

After this pass, NHL prop research is materially stronger than it was after Batch 02.

- **Shots on goal:** mechanism evidence is now **strong** and directly targeted to the exact statistic. A recent master's thesis predicts individual NHL SOG using 2017-18 through 2024-25 game-level data. Modern practitioner modeling also isolates player, teammate, opponent, score, zone, fatigue and coaching effects on shot rates. Public shot data are deep enough for independent validation.
- **Direct sportsbook SOG calibration:** still **moderate, not complete**. A public research/code project documents roughly 5,000 historical SOG odds from multiple betting sites, but it is not peer-reviewed and should be treated as dataset/methodology evidence rather than a production prior by itself.
- **Goalscorer props:** direct sportsbook evidence already exists from Batch 02; shooter/goalie skill-adjusted xG adds strong mechanism support.
- **Goalie saves:** strong mechanism/caution evidence now includes a multilevel NHL playoff study finding no positive goalie hot-hand effect after controlling for shot/game context. Direct sportsbook saves-line calibration remains thin.
- **Points/assists:** player-performance/context evidence exists, but direct modern sportsbook calibration remains thin.
- **Data quality:** rink-recording effects are a real historical issue for NHL event counts and deserve explicit caution in any SOG/hits/blocks-type research using older event data.

The practical conclusion for v1.8 is that NHL SOG should no longer be treated as a generic player-prop gap. It should become its own evidence cluster with a clear distinction between **forecastability of shots** and **proof that sportsbook SOG prices are miscalibrated**.

## Candidate set

### V18-NHL-SOG-001 — Korkee 2025/2026: direct NHL SOG forecasting thesis

- **Source:** Lauri Korkee, Aalto University master's thesis, *Using machine learning for player performance prediction in ice hockey games*; dated 2025-11-21, permanent identifier `URN:NBN:fi:aalto-202601071106`.
- **Directness:** PLAYER FORECAST MECHANISM — **EXACT STATISTIC MATCH**.
- **Target:** individual NHL **shots on goal** per game.
- **Data:** game-by-game player and team data from 2017-18 through 2024-25, converted to historical rolling features.
- **Design:** five machine-learning algorithms, four sample-filtering approaches and five feature-count settings, producing 100 model configurations.
- **Key reported result:** XGBoost was the most generally suitable model and least prone to overfit; LightGBM produced some best individual models but overfit more readily. Excessive feature counts often hurt generalization. Playing-time sample filtering weakened model performance in this study.
- **Why it matters:** This is the strongest academic mechanism source found so far for the exact NHL SOG prop outcome.
- **Limitation:** It predicts SOG outcomes but does **not** establish sportsbook line efficiency, hold, closing-price calibration or betting profitability.
- **Provisional History Fit role:** methodology / direct SOG forecastability.
- **Review status:** HIGHEST PRIORITY DEEP REVIEW.

### V18-NHL-SOG-002 — Public historical SOG odds research codebase

- **Source:** Rasmus Rynell, `RasmusRynell/Predicting-NHL` public GitHub repository.
- **Directness:** DIRECT MARKET DATASET / NON-PEER-REVIEWED.
- **Documented data:** repository README states a local database contains about **5,000 historical odds for NHL shots-on-goal props from different betting sites**, plus NHL player/team/opponent data and tools for evaluation against bookmakers.
- **Why it matters:** This is one of the few located public projects explicitly joining NHL SOG forecasting to historical posted prop odds.
- **Limitation:** Research quality, provenance completeness, bookmaker list, timestamp semantics, closing-line status and out-of-sample evaluation require audit. Do not treat the existence of the database as proof of an edge.
- **Provisional History Fit role:** dataset/methodology context only unless independently validated.
- **Review status:** SOURCE/DATA AUDIT.

### V18-NHL-SOG-003 — Magnus 8 individual shot-rate model

- **Source:** Micah Blake McCurdy, HockeyViz, *The Magnus Prediction Model, version 8* (2024).
- **Directness:** PLAYER SHOT-RATE MECHANISM / PRACTITIONER MODEL.
- **Surface:** individual impact on NHL 5v5 shot rates.
- **Important modeled context:** teammates, opponents, score state, zone starts, coaching, fatigue, home advantage, game state and player aging/history.
- **Useful findings for SOG architecture:** trailing teams generate higher shot rates; tired states are associated with weaker results; offensive-zone starts boost shot rates but the effect decays through the shift; opponent and teammate quality are explicitly separated from individual player impact.
- **Why it matters:** SOG props are volume markets. This source directly supports moving beyond last-5 hit rates toward role/context-adjusted shot opportunity.
- **Limitation:** 5v5 shot-rate modeling includes attempts rather than only official SOG and is not a sportsbook calibration study; practitioner rather than peer-reviewed academic evidence.
- **Provisional History Fit role:** mechanism / context / caution against naive rolling averages.
- **Review status:** DEEP REVIEW WITH SOURCE-CLASS CAVEAT.

### V18-NHL-SOG-004 — MoneyPuck historical shot-data infrastructure

- **Source:** MoneyPuck public NHL data downloads.
- **Directness:** DATA INFRASTRUCTURE.
- **Coverage:** historical shot data from 2007-08 onward, with 2025-26 updated nightly; the published download page describes more than 1.8 million historical shots through 2024-25 plus current-season data.
- **Fields:** player and goalie identity, shot distance/angle, prior-event context, player time-on-ice at the shot, xG, rebound probability, miss probability, freeze probability and arena-adjusted coordinates.
- **Why it matters:** Provides a realistic foundation for independent SOG/goal/saves mechanism testing and for validating whether proposed features actually add out-of-sample information.
- **Limitation:** Does not itself contain sportsbook prop prices; use restrictions/licensing must be respected.
- **Provisional History Fit role:** data provenance / methodology.
- **Review status:** ACCEPT AS RESEARCH INFRASTRUCTURE CANDIDATE, NOT PREDICTIVE PRIOR.

### V18-NHL-SOG-005 — Historical rink-recording effects

- **Source:** Michael Schuckers & Brian Macdonald (2014), *Accounting for Rink Effects in the National Hockey League's Real Time Scoring System*, arXiv `1412.1035`.
- **Directness:** DATA-QUALITY CAUTION.
- **Finding:** NHL event recording showed significant and persistent rink-to-rink effects for multiple recorded events; the authors propose reweighting event counts to improve comparability.
- **Why it matters for props:** SOG, hits and blocks are official event-count markets. Historical player thresholds can be distorted if venue scoring practices differ materially.
- **Transportability:** Must be rechecked against modern NHL tracking/scoring practices before applying a numerical rink adjustment in 2026.
- **Provisional History Fit role:** caution / data quality / era transportability.
- **Review status:** DEEP REVIEW + MODERN REPLICATION SEARCH.

### V18-NHL-GOAL-001 — Shooter and goaltender skill-adjusted xG

- **Source:** J. T. P. Noel (2025), *Expected by Whom? A Shooter and Goaltender Skill-adjusted Expected Goals Model for the NHL*, arXiv `2511.07703`.
- **Directness:** PLAYER FORECAST MECHANISM.
- **Design:** LightGBM shot-outcome model using NHL spatiotemporal data with shooter and goaltender skill features, including overall, locational and situational skill.
- **Finding:** Skill-adjusted variants improved log loss, Brier score and AUC versus baselines, with reported gains up to roughly 5% in some comparisons.
- **Why it matters:** Goal/anytime-goalscorer props should account for **who is shooting and who is in goal**, not only generic xG or recent shooting percentage.
- **Limitation:** Does not calibrate sportsbook goalscorer prices.
- **Provisional History Fit role:** goalscorer mechanism / methodology.
- **Review status:** DEEP REVIEW.

### V18-NHL-GOAL-002 — Latent NHL player shooting ability

- **Source:** James Kierans (2021), Concordia University master's thesis, *Isolation of Latent Player Shooting Ability in the National Hockey League*.
- **Directness:** PLAYER FORECAST MECHANISM.
- **Data:** privately tracked pre-shot movement combined with contextual factors such as location and game state.
- **Why it matters:** Separates shot quality/context from latent shooter ability and warns that public event data can omit important pre-shot information.
- **Limitation:** Shooting-talent estimation is not sportsbook goal-prop calibration and private data reduce reproducibility.
- **Provisional History Fit role:** mechanism / data-quality caution.
- **Review status:** DEEP REVIEW.

### V18-NHL-SAVES-001 — Goalie hot-hand study

- **Source:** Ding, Cribben, Ingolfsson & Tran (2021), *Do NHL goalies get hot in the playoffs? A multilevel logistic regression analysis*, arXiv `2102.09689`.
- **Directness:** GOALIE SAVE MECHANISM / CAUTION.
- **Data:** 48,431 playoff shots faced by 93 goaltenders across 2008-2016.
- **Design:** multilevel logistic regression using multiple recent-performance windows, controlling for game score, home/away, rebounds, manpower strength, shot type and shot position.
- **Finding:** no positive goalie hot-hand effect; the paper reports some evidence that unusually good recent save performance is followed by worse next-shot save probability rather than persistence.
- **Why it matters for save props:** Strong caution against treating a recent high save percentage or short hot streak as a stand-alone reason to project higher future save efficiency.
- **Important distinction:** Save **volume** and save **probability** are different. A saves-over can still be supported by expected shot volume even if recent goalie save percentage is not persistent.
- **Limitation:** playoff-only historical sample and not a sportsbook saves-line study.
- **Provisional History Fit role:** caution / goalie recency-bias control.
- **Review status:** HIGHEST PRIORITY FOR GOALIE-SAVES CLUSTER.

### V18-NHL-SOG/SAVES-006 — Weighted shots / future performance

- **Source:** Macdonald, Lennon & Sturdivant (2012), *Evaluating NHL Goalies, Skaters, and Teams Using Weighted Shots*, arXiv `1205.1746`.
- **Directness:** PLAYER/GOALIE MECHANISM.
- **Finding:** shot-quality-weighted measures were useful, but did not generally outperform traditional statistics as future-performance indicators; the authors recommend complementary rather than replacement use.
- **Why it matters:** A more complex metric should not automatically displace stable shot-volume baselines unless it proves incremental predictive value.
- **Provisional History Fit role:** methodology / complexity caution.
- **Review status:** REVIEW WITH ERA CAVEAT.

## Proposed NHL SOG evidence cluster for v1.8

**Working cluster ID:** `nhl_player_sog_volume_context_and_price_calibration`

### Canonical interpretation candidate

NHL shots on goal are sufficiently forecastable to justify a dedicated History Fit mechanism layer, but forecasting a player's shot count is not equivalent to demonstrating sportsbook mispricing. Stronger SOG analysis should separate:

1. **Opportunity / usage:** expected ice time, line role, power-play role and lineup confirmation.
2. **Individual shot-generation rate:** player-specific history adjusted for regression and role.
3. **Teammate / opponent context:** quality of linemates, defensive opposition and expected matchup.
4. **Game state:** score effects, home/away, zone starts and likely game script.
5. **Rest/fatigue:** use only where validated; do not overfit short schedules.
6. **Venue/event-recording effects:** historical rink bias is a data-quality concern; modern applicability must be validated.
7. **Exact prop line and juice:** a 2.5 and a 3.5 are different bets; price and line must stay attached to the identity.
8. **Book/market comparison:** best price and line shopping matter; do not infer value from hit rate alone.
9. **Closing-price benchmark:** still a research gap for strong direct NHL SOG evidence.

### History Fit behavior candidate

A future v1.8 NHL SOG message should be allowed to say, for example:

- **B / supportive mechanism:** player shot volume is supported by stable usage and context-adjusted shot-generation evidence, but direct sportsbook SOG calibration remains limited.
- **C / mixed:** recent hit rate is positive, but role, opponent, game state or line movement makes the historical comparison less transportable.
- **D / caution:** the case relies mainly on recent streaks or an unadjusted hit-rate threshold without role/context support.
- **NR / price-calibration gap:** if the question is specifically whether a posted SOG line is historically mispriced and no verified direct price study applies.

Research must never turn a strong SOG projection into a BET without current executable price, exact-line identity and normal Betting Edge gates.

## Goalie saves architecture candidate

For goalie saves, future research should explicitly decompose:

`expected saves ≈ expected shots on goal faced × expected save probability`,

while recognizing that the two pieces have different drivers.

- **Shots faced:** opponent shot volume, team defensive suppression, game state, special teams and goalie start/playing time.
- **Save probability:** shot quality, shooter mix, rebound context, goaltender skill and game conditions.
- **Do not use:** recent save percentage alone as a hot-hand proxy.

Direct sportsbook saves-line calibration remains a Priority-0 gap.

## Remaining NHL prop gaps after Batch 03

### P0 — Direct historical sportsbook SOG prices

Need a research-grade dataset with:

- opening and/or closing SOG line;
- over and under juice;
- sportsbook identity;
- timestamp;
- exact player/game identity;
- final official SOG result;
- preferably multiple books;
- enough seasons for walk-forward/out-of-sample validation.

The public ~5,000-odds project is promising but requires provenance audit before use as evidence.

### P0 — Goalie saves prop prices

Still need direct work comparing predicted saves distributions with sportsbook lines/juice and closing prices.

### P1 — Points and assists props

Need direct price calibration, particularly around power-play role, line changes, expected ice time and correlation with teammate props.

### P1 — Modern rink/event-scoring replication

Historical rink effects should not be mechanically carried into 2026. Search for modern replication under current NHL data collection/scoring practices.

### P1 — Distributional SOG modeling

A prop decision needs a probability of clearing a line, not just a point estimate for expected shots. Deep review should favor models that produce or can support predictive distributions, quantiles or calibrated threshold probabilities.

## Promotion rule

This batch should improve v1.8 only after candidate-level source verification and deduplication against v1.7/Batch 02. In particular:

- Do not promote practitioner or code repositories to high evidence tiers solely because they are directly about betting.
- Do not convert player-performance forecasting into sportsbook-price evidence.
- Do not use historical rink effects without a modern transportability check.
- Do not use short-term goalie or shooter streaks as causal evidence without controlling for context and regression.
- Preserve exact prop line, side, player, event and book identity whenever market evidence is eventually accepted.

## Current NHL coverage judgment

**Shots on goal:** `MECHANISM STRONG / DIRECT MARKET CALIBRATION MODERATE`  
**Anytime goalscorer:** `DIRECT EVIDENCE MODERATE / MECHANISM STRONG`  
**Goalie saves:** `MECHANISM MODERATE-STRONG / DIRECT MARKET CALIBRATION THIN`  
**Points/assists:** `MECHANISM MODERATE / DIRECT MARKET CALIBRATION THIN`

This is a meaningful improvement over the Batch-02 state. The next highest-value hockey research is no longer generic player-performance literature; it is **historical posted SOG and saves prices with timestamps, juice and results**, so Betting Edge can test calibration and closing-line behavior directly.

# Betting Edge Research Library v1.8 — Discovery Batch 06: Basketball Props Deep Dive

**Date:** 2026-08-15  
**State:** STAGING ONLY — NOT RUNTIME AUTHORITY  
**Active production library remains:** Research Library v1.7  
**Production manifest remains:** `research/manifest.json`

## Hard boundary

Nothing in this file is approved canonical research. Normal Betting Edge reports must continue reading Research Library v1.7 only. This staging batch must not be referenced by the production manifest, report prompts, runner, odds workflows, contract, or live History Fit runtime until a later explicit review/promotion step.

This pass focuses on **NBA and WNBA player props**, especially points, rebounds, assists, three-pointers, combination props and participation/role uncertainty. The central distinction remains: **forecasting a player statistic is not the same as proving a posted sportsbook prop is mispriced.**

## Executive assessment

After this pass, basketball prop coverage is materially stronger.

- **NBA:** currently the best-covered basketball prop environment. Direct FanDuel closing-line research exists, modern player-stat forecasting is substantial, opening prop data are available across major books, and player-absence/injury evidence gives a useful participation/role layer.
- **WNBA:** no longer a pure data gap. Current and historical opening player-prop data are available from multiple major books, and public player box-score/impact infrastructure is strong. However, rigorous published sportsbook-calibration studies remain thin, so WNBA should still be treated more cautiously than NBA.
- **Points / rebounds / assists:** mechanism evidence is strong enough for separate stat-family treatment; different models can perform differently by target statistic, so one generic “player form” score is not sufficient.
- **Combination props:** must be modeled jointly or with dependence acknowledged. Points+rebounds+assists cannot be treated as three independent legs.
- **Participation / minutes:** injuries, absences, rotation changes and role shifts can materially alter expected volume. Research supports treating minutes/usage as a first-class uncertainty input rather than merely adjusting per-minute talent.
- **Direct closing-price calibration:** NBA has one unusually direct study tying actual FanDuel closing props to realized player outcomes. WNBA still lacks an equivalent strong scholarly study.

## Candidate set

### V18-NBA-PROP-001 — Wornow 2026: NBA performance relative to FanDuel closing props

- **Source:** Benjamin Wornow (2026), Claremont McKenna College senior thesis, *Betting on Performance: Sports Betting Legalization and NBA Player Performance Relative to Sportsbook Expectations*.
- **Directness:** **DIRECT PROP MARKET**.
- **Data:** FanDuel closing over/under lines linked to player-game outcomes for **178 NBA players across five statistical categories**, spanning 2022–2025.
- **Design:** player-game panel; difference-in-differences around staggered sports-betting legalization.
- **Key finding:** player performance in legalized markets deviated farther from closing prop expectations in absolute terms, but without a consistent over/under directional bias; the strongest reported effect was in points.
- **Why it matters:** this is one of the strongest located pieces of direct NBA player-prop evidence because it uses actual closing prop lines rather than fantasy projections or game-level odds.
- **Limitations:** undergraduate thesis, one sportsbook, restricted full text, and research question is legalization/player behavior rather than full market-calibration testing.
- **Provisional History Fit role:** direct / mixed / calibration-context.
- **Review status:** HIGHEST PRIORITY DEEP REVIEW.

### V18-NBA-PROP-002 — Papageorgiou, Sarlis & Tjortjis 2024: stat-specific player forecasting

- **Source:** *Evaluating the effectiveness of machine learning models for performance forecasting in basketball: a comparative study*, Knowledge and Information Systems 66 (2024), DOI `10.1007/s10115-024-02092-9`.
- **Directness:** PLAYER FORECAST MECHANISM.
- **Data:** 90 high-performance NBA players, seasons 2019-20 through 2021-22; unseen validation included.
- **Targets:** points, rebounds, assists, steals, blocks, turnovers and multiple advanced KPIs.
- **Key relevance:** model performance differs by statistic; no single model dominates every target. The study concludes that forecasting component statistics separately can improve composite performance prediction.
- **Why it matters:** Betting Edge should not use one undifferentiated player-form model for points, rebounds and assists. Prop families deserve target-specific modeling/error assumptions.
- **Limitation:** not a sportsbook price study; MAPE on player stats is not wagering calibration.
- **Provisional History Fit role:** methodology / target-specific forecastability.
- **Review status:** DEEP REVIEW.

### V18-NBA-PROP-003 — Papageorgiou, Sarlis & Tjortjis 2024/2025: individualized NBA daily forecasting

- **Source:** *An innovative method for accurate NBA player performance forecasting and line-up optimization in daily fantasy sports*, International Journal of Data Science and Analytics 20 (2025), DOI `10.1007/s41060-024-00523-y`.
- **Directness:** PLAYER FORECAST MECHANISM / DFS-ADJACENT.
- **Data:** individualized models for 203 NBA players using multiple seasons of standard and advanced statistics.
- **Finding:** individual player models, different lookback windows and ensemble/model selection materially affect forecast accuracy.
- **Why it matters:** reinforces that player props should be modeled at player/stat level rather than by generic league-average recent-hit rules.
- **Limitation:** fantasy-point objective and older training era; not direct sportsbook calibration.
- **Provisional History Fit role:** player-specific methodology / transportability caution.
- **Review status:** DEEP REVIEW.

### V18-NBA-PROP-004 — Döpke, Köhler & Tegtmeier 2024: professional NBA forecasts only modestly beat naive projections

- **Source:** *Are they worth it? – An evaluation of predictions for NBA Fantasy Sports*, Journal of Economics and Finance 48 (2024), DOI `10.1007/s12197-023-09646-7`.
- **Directness:** PLAYER FORECAST / FORECAST-EFFICIENCY CAUTION.
- **Data:** 1,658 NBA player projections from four professional forecast providers collected in February 2022.
- **Finding:** professional projections reduced naive forecast error only moderately; some forecasts were inefficient or biased, and provider differences were relatively small.
- **Why it matters:** external projections should not be treated as independent “sharp” evidence merely because they are professional or sophisticated.
- **Provisional History Fit role:** methodology / forecast-quality caution.
- **Review status:** DEEP REVIEW.

### V18-NBA-ABSENCE-001 — player absence and line adjustment

- **Source:** Dare, Dennis & Paul (2015), *Player absence and betting lines in the NBA*, Finance Research Letters 13, 130–136, DOI `10.1016/j.frl.2015.02.004`.
- **Directness:** GAME-MARKET INFORMATION / PARTICIPATION CONTEXT.
- **Finding:** opening lines show meaningful error around player absences, but closing markets tend to absorb that information sufficiently that a profitable closing-line strategy was not found.
- **Why it matters for props:** late player availability/role news can be materially important, while the market may also reprice quickly. History Fit should recognize both the underlying participation shock and the danger of assuming stale value remains after repricing.
- **Limitation:** game-level spread research, not player props; older market regime.
- **Provisional History Fit role:** participation / information-speed caution.
- **Review status:** CROSS-LINK EXISTING V1.7 SOURCE; DO NOT DOUBLE-COUNT.

### V18-NBA-INJURY-001 — severe lower-extremity injuries and performance/minutes

- **Source:** *Return to performance following severe ankle, knee, and hip injuries in National Basketball Association players* (2023), open-access clinical/performance study.
- **Directness:** PARTICIPATION / PERFORMANCE CONTEXT.
- **Data:** 196 severe lower-extremity injuries with pre/post NBA playing-time and box-score performance.
- **Finding:** minutes and several performance measures declined after severe injury, and fewer than half returned to pre-injury performance levels by two years in many comparisons.
- **Why it matters:** return-from-injury status can affect minutes and volume props even when a player is technically active.
- **Limitation:** long-horizon severe-injury evidence; not a same-day injury adjustment or prop-price study.
- **Provisional History Fit role:** participation caution.
- **Review status:** REVIEW.

### V18-NBA-METRIC-001 — 2025-26 NBA Heave Rule structural break

- **Source:** Kemper & Liptack (2026), *Overcoming Misaligned Incentives: Evidence from the NBA Heave Rule*, SSRN working paper, DOI `10.2139/ssrn.7073018`.
- **Directness:** STRUCTURAL-BREAK / STAT-DEFINITION CONTEXT.
- **Data:** play-by-play 2015-16 through 2025-26.
- **Finding:** player behavior around end-of-quarter heaves changed sharply after the 2025-26 rule removed the individual field-goal statistical penalty.
- **Why it matters:** historical stat distributions can shift when official stat/accounting rules change. Prop history must track rule-era compatibility rather than blindly pooling all seasons.
- **Limitation:** narrow shot-behavior mechanism, not prop calibration.
- **Provisional History Fit role:** era/definition transportability caution.
- **Review status:** REVIEW.

### V18-NBA-DATA-001 — BALLDONTLIE NBA opening player-prop data

- **Source:** BALLDONTLIE NBA API documentation.
- **Directness:** DIRECT MARKET DATA INFRASTRUCTURE.
- **Coverage:** historical **opening player props** for the most recently completed and ongoing seasons where available.
- **Fields:** game, player, sportsbook vendor, prop type, line, market type/odds and opening timestamp.
- **Prop families:** points, rebounds, assists, threes, combinations and additional player markets depending on book/game.
- **Why it matters:** provides a reproducible path to study opening-line differences, book dispersion and subsequent movement when paired with current snapshots/results.
- **Limitation:** premium access; opening data alone are not closing-price calibration and this must not become a paid production dependency.
- **Provisional History Fit role:** research infrastructure only.
- **Review status:** DATA PATH — NOT PREDICTIVE PRIOR.

## WNBA candidate set

### V18-WNBA-DATA-001 — BALLDONTLIE WNBA player-prop data

- **Source:** BALLDONTLIE WNBA API documentation.
- **Directness:** DIRECT MARKET DATA INFRASTRUCTURE.
- **Current vendors:** BetRivers, Caesars, DraftKings, Fanatics and FanDuel for player props; broader game odds also include BetMGM.
- **Supported prop families:** points, rebounds, assists, threes, points+assists, points+rebounds, rebounds+assists, points+rebounds+assists, double-double and triple-double markets where offered.
- **Historical opening props:** available for the most recently completed and ongoing seasons where available.
- **Why it matters:** WNBA is no longer an unobservable prop market. We can build direct opening-price research and collect current prices going forward.
- **Limitation:** premium historical access and limited historical depth; no direct proof of market inefficiency.
- **Provisional History Fit role:** research infrastructure / gap reduction.
- **Review status:** HIGH-PRIORITY DATA PATH.

### V18-WNBA-DATA-002 — SportsDataverse / wehoop player-level WNBA data

- **Source:** SportsDataverse `wehoop` and `sportsdataverse-data` repositories/releases.
- **Directness:** PLAYER PERFORMANCE DATA INFRASTRUCTURE.
- **Coverage:** WNBA schedules, play-by-play, player box scores, shots, season stats and player-impact datasets are published in machine-readable formats.
- **Why it matters:** provides the outcome/usage side needed to join sportsbook prop prices to player minutes, points, rebounds, assists and shot context.
- **Limitation:** no sportsbook prices in the core player-stat releases.
- **Provisional History Fit role:** research infrastructure only.
- **Review status:** ACCEPT AS DATA-INFRASTRUCTURE CANDIDATE.

### V18-WNBA-MECH-001 — Bonato & Hinds 2026: WNBA player interaction prediction

- **Source:** Bonato & Hinds (2026), *Network analysis and link prediction in competitive women's basketball*, arXiv `2601.23193`.
- **Directness:** PLAYER FORECAST MECHANISM — INDIRECT.
- **Surface:** WNBA shot-blocking and passing networks; predictive signals from higher-order player interaction structure.
- **Why it matters:** assists/usage/defensive counting stats depend on player interaction structure, not just isolated recent averages.
- **Limitation:** not a points/rebounds/assists forecast study and not sportsbook calibration.
- **Provisional History Fit role:** low-weight mechanism / interaction context.
- **Review status:** REVIEW.

### V18-WNBA-GAP-001 — direct scholarly WNBA sportsbook-prop calibration

- **Finding:** this search did not identify a strong peer-reviewed or thesis-level study equivalent to the Wornow NBA work that directly compares WNBA sportsbook player-prop lines with realized outcomes across a substantial sample.
- **Required behavior:** WNBA may use direct market data infrastructure and player-performance models, but History Fit should not inherit NBA calibration grades automatically.
- **Status:** **EXPLICIT GAP — KEEP SEARCHING / BUILD OUR OWN AUDIT DATASET.**

## Proposed basketball prop evidence clusters for v1.8

### `nba_player_points_usage_efficiency_and_price_calibration`

Separate:
1. expected minutes / availability;
2. usage and shot volume;
3. shot quality/efficiency and free-throw volume;
4. teammate absences / role redistribution;
5. opponent pace/defense and game script;
6. full outcome distribution;
7. exact line + over/under juice;
8. opening/closing and multi-book price comparison.

### `nba_player_rebounds_minutes_role_matchup_and_price_calibration`

Separate:
1. minutes and lineup role;
2. rebound chances / positional role;
3. opponent shot profile and miss opportunities;
4. teammate rebound competition;
5. pace/game environment;
6. exact line/price and distribution.

### `nba_player_assists_ballhandling_teammate_conversion_and_price_calibration`

Separate:
1. expected minutes;
2. primary-ballhandler role / touches;
3. teammate availability;
4. potential assists / teammate shooting conversion;
5. opponent scheme/pace;
6. full assist distribution;
7. exact line/price.

### `basketball_player_combo_props_dependence_and_price_calibration`

Points, rebounds and assists are not independent. For PRA/PR/PA/RA markets, use a joint or empirically calibrated distribution where possible. Do not approximate a combo prop by multiplying independent over probabilities.

### `wnba_player_props_market_depth_and_transportability`

Track NBA analogy separately from WNBA-direct evidence. Market depth, schedule, roster concentration, expansion, player roles and data volume can differ enough that NBA priors require an explicit transportability discount.

## History Fit behavior candidate

Future v1.8 basketball-prop messages should be able to distinguish:

- **A/B direct:** direct sportsbook evidence plus strong stat-specific mechanism and high current-era applicability.
- **B supportive mechanism:** minutes/usage/matchup and stat-specific forecasting support the projection, but direct market calibration is limited.
- **C mixed:** role or stat forecast is plausible but injury, minutes, teammate availability, era change or market movement creates material uncertainty.
- **D caution:** case relies mainly on recent hit rate, season average, narrative streaks, or a fantasy projection without distribution/price validation.
- **NR calibration gap:** no reliable direct price evidence applies, especially in thinner WNBA or niche combo/alternate markets.

Research must never convert a projection into a BET without current identity, availability, executable price, exact line, fair-value and staking gates.

## Remaining basketball prop gaps after Batch 06

### P0 — WNBA direct calibration

Build or locate a dataset pairing opening/closing WNBA points/rebounds/assists/combo props with sportsbook, timestamp, line, juice and settled result across enough games for walk-forward testing.

### P0 — NBA multi-book closing calibration

The FanDuel closing-line thesis is valuable but single-book. Seek a broader multi-book historical dataset and compare line vs juice movement, book dispersion, closing Brier/log loss and calibration by stat family.

### P0 — minutes / same-day availability modeling

Need short-horizon research on how late scratches, questionable tags, minutes restrictions, back-to-backs and teammate absences change player-stat distributions. Long-horizon injury studies are context, not enough for same-day prop adjustments.

### P1 — combination and alternate props

Need direct work on PRA/PR/PA/RA, alternate milestones and correlation/hold. These markets should not inherit single-stat calibration automatically.

### P1 — WNBA structural change / expansion transportability

Track rule, roster, expansion, schedule and market-liquidity changes so older WNBA samples are not assumed stationary.

## Promotion rule

This batch is discovery/staging only. Before any v1.8 promotion, sources must be citation-verified, deduplicated against v1.7 and Batches 01–05, assigned evidence tiers, grouped into conflict/overlap clusters and exercised in representative History Fit retrieval tests for NBA and WNBA player props.

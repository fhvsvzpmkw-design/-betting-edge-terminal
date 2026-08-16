# Betting Edge Research Library v1.8 — Discovery Batch 04: NFL Props Deep Dive

**Date:** 2026-08-15  
**State:** STAGING ONLY — NOT RUNTIME AUTHORITY  
**Active production library remains:** Research Library v1.7  
**Production manifest remains:** `research/manifest.json`

## Hard boundary

Nothing in this file is approved canonical research. Normal Betting Edge reports must continue reading Research Library v1.7 only. This staging batch must not be referenced by the production manifest, report prompts, runner, odds workflows, contract, or live History Fit runtime until a later explicit review/promotion step.

This pass focuses on NFL player props, especially passing yards, rushing yards, receiving yards/receptions and anytime-touchdown markets. The central distinction is between **forecasting the player statistic** and **proving that a posted sportsbook prop is mispriced**.

## Executive assessment

After this pass, NFL player-prop mechanism coverage is strong enough to support a dedicated v1.8 evidence cluster, but direct multi-book sportsbook prop calibration remains incomplete.

- **Passing yards:** strong player-forecast mechanism evidence and direct Pick’em/pricing-adjacent work; direct regulated-sportsbook line-calibration evidence remains thin.
- **Rushing yards:** strong tracking-based distributional modeling. The NFL’s official Expected Rushing Yards framework and academic conditional-density work support modeling a distribution rather than relying on a simple recent average.
- **Receiving yards / receptions:** strong target/catch/defender-context mechanism evidence. High-resolution tracking work supports separating opportunity, catch probability and yards after catch.
- **Anytime TD:** mechanism is tractable through touchdown/opportunity probabilities, but rigorous public sportsbook calibration evidence is still scarce. A current practitioner model with a held-out real-bookmaker sample is worth auditing, not promoting automatically.
- **Participation/injury:** return-to-play research shows that role and position matter and that recent injury can alter snap volume/performance. These sources are context/caution only, not automatic prop adjustments.
- **Direct historical sportsbook price data:** still the largest gap. Public/commercial APIs confirm that opening/current NFL player-prop lines are collectable, but broad research-grade historical closing-price datasets are not yet established in this staging work.

The practical v1.8 conclusion should be: **NFL props are forecastable enough for sport-specific History Fit, but a strong projection is not itself evidence of sportsbook mispricing.**

## Candidate set

### V18-NFL-PROP-001 — Wu 2025: NFL Pick’em pricing and player-stat forecasting

- **Source:** Dan Wu (2025), UCLA/eScholarship thesis, *Predictive Analytics for NFL Pick’em Contests: A Comparative Study of Gradient Boosting Models*.
- **Identifier:** eScholarship item `9x33j0fz`.
- **Directness:** PROP-ADJACENT MARKET / PLAYER FORECAST MECHANISM.
- **Data:** 2023–2024 NFL regular-season play-by-play supplied by WagerWire.
- **Surface:** real-time pricing of DFS Pick’em entries using player performance forecasts.
- **Key relevance:** evaluates XGBoost, LightGBM and CatBoost across player statistics; CatBoost is highlighted for Passing Yards while XGBoost is broadly consistent.
- **Why it matters:** closest academic source found so far to an NFL player-prop pricing engine.
- **Limitation:** DFS/Pick’em secondary-market pricing is not equivalent to regulated sportsbook over/under pricing, vig, line movement or closing-price calibration.
- **Provisional History Fit role:** methodology / player-stat forecastability.
- **Review status:** HIGHEST PRIORITY DEEP REVIEW.

### V18-NFL-PROP-002 — Dmochowski 2023: distributions and sportsbook propositions

- **Source:** Jacek P. Dmochowski (2023), PLOS ONE 18(6): e0287601, *A statistical theory of optimal decision-making in sports betting*.
- **DOI:** `10.1371/journal.pone.0287601`.
- **Directness:** BETTING METHODOLOGY / NFL EMPIRICAL GAME-MARKET EVIDENCE.
- **Data:** 5,412 NFL regular-season games from 2002–2022 with sportsbook spreads/totals and payouts.
- **Key principle for player props:** deciding whether a posted threshold offers positive EV requires more than a mean/median forecast; relevant outcome quantiles/distribution are required.
- **Why it matters:** this is directly applicable to yardage/reception props. A model predicting 247 passing yards is not enough to price Over 244.5 without uncertainty/distribution information.
- **Limitation:** empirical testing is game spreads/totals, not player props.
- **Provisional History Fit role:** methodology / distributional decision rule.
- **Review status:** DEEP REVIEW; cross-link rather than duplicate if already promoted elsewhere.

### V18-NFL-REC-001 — Deshpande & Evans: Expected Hypothetical Completion Probability

- **Source:** Deshpande & Evans (2019), arXiv `1910.12337`, *Expected Hypothetical Completion Probability*.
- **Directness:** PLAYER FORECAST MECHANISM.
- **Data:** high-resolution NFL player tracking from the 2019 Big Data Bowl.
- **Mechanism:** Bayesian non-parametric catch-probability model incorporating receiver speed and distances to ball/nearest defender, including uncertainty for hypothetical targets.
- **Why it matters for receptions/receiving yards:** receiving props should separate target opportunity from catch probability rather than infer future receptions from a rolling catch count alone.
- **Limitation:** play-level catch probabilities do not establish sportsbook prop calibration.
- **Provisional History Fit role:** receiving opportunity / catch-probability mechanism.
- **Review status:** DEEP REVIEW.

### V18-NFL-REC-002 — NFL Ghosts 2024: defender context and receiving-yard distributions

- **Source:** Yurko, Nguyen & Pelechrinis (2024), arXiv `2406.17220`, *NFL Ghosts: A framework for evaluating defender positioning with conditional density estimation*.
- **Directness:** PLAYER FORECAST MECHANISM.
- **Mechanism:** conditional-density modeling of receiver yards gained and baseline defender positioning using high-dimensional tracking data.
- **Why it matters:** receiver production is not independent of coverage quality, defender positioning and route context. This supports opponent/context adjustment rather than simple defense-vs-position averages.
- **Provisional History Fit role:** receiving-yard mechanism / matchup context.
- **Review status:** DEEP REVIEW.

### V18-NFL-RUSH-001 — NFL Next Gen Stats Expected Rushing Yards

- **Source:** NFL Next Gen Stats Analytics Team, *Expected Rushing Yards* framework.
- **Directness:** OFFICIAL LEAGUE PLAYER-FORECAST MECHANISM.
- **Data:** NFL player-tracking locations, speeds and directions of all 22 players.
- **Key design:** produces a **distribution of rushing outcomes**, not only a point estimate, and derives expected rushing yards, yards over expected, first-down probability and touchdown probability.
- **Why it matters:** a distributional rushing model is structurally appropriate for O/U rushing-yard props and alternate thresholds.
- **Limitation:** official performance metric, not sportsbook price-calibration research.
- **Provisional History Fit role:** rushing distribution / methodology.
- **Review status:** DEEP REVIEW WITH SOURCE-CLASS NOTE.

### V18-NFL-RUSH-002 — Going Deep: conditional density for ball-carrier yards

- **Source:** Yurko et al. (2019), arXiv `1906.01760`, *Going Deep: Models for Continuous-Time Within-Play Valuation of Game Outcomes in American Football with Tracking Data*.
- **Directness:** PLAYER FORECAST MECHANISM.
- **Mechanism:** LSTM ball-carrier model with conditional-density estimation from player locations and trajectories.
- **Why it matters:** supports modeling yardage as a conditional distribution influenced by blockers/defenders and play state rather than treating yards-per-carry as stationary.
- **Provisional History Fit role:** rushing/receiving yard distribution methodology.
- **Review status:** DEEP REVIEW.

### V18-NFL-REC-003 — NFL Next Gen Stats Expected Yards After Catch

- **Source:** NFL Next Gen Stats Analytics Team, *Expected Yards After Catch*.
- **Directness:** OFFICIAL LEAGUE PLAYER-FORECAST MECHANISM.
- **Design:** estimates expected YAC using receiver speed/direction/acceleration, nearest defender, blockers/defenders in path and open-space context.
- **Validation:** NFL reports out-of-sample validation using a held-out sample of 1,962 completions from 2016–2017 data.
- **Why it matters:** receiving-yard props should decompose air-yard/target opportunity, completion probability and post-catch opportunity instead of treating all prior receiving yards as equally repeatable.
- **Limitation:** not a sportsbook study and older underlying validation period requires transportability review.
- **Provisional History Fit role:** receiving-yard mechanism.
- **Review status:** DEEP REVIEW.

### V18-NFL-SCRIPT-001 — Ötting 2020: play-call predictability

- **Source:** Marius Ötting (2020), arXiv `2003.10791`, *Predicting play calls in the National Football League using hidden Markov models*.
- **Directness:** GAME-SCRIPT / USAGE MECHANISM.
- **Data:** 289,191 NFL play-by-play observations; out-of-sample test on 2018 season.
- **Finding:** reported 71.5% play-call prediction accuracy.
- **Why it matters:** passing/rushing volume props depend on run/pass tendency and game state. Usage should be modeled, not assumed from season averages.
- **Limitation:** older data and no sportsbook testing.
- **Provisional History Fit role:** usage / game-script mechanism.
- **Review status:** REVIEW WITH ERA CAVEAT.

### V18-NFL-INJURY-001 — ACL return-to-play and performance by position

- **Source:** *Return to Play and Performance After Anterior Cruciate Ligament Reconstruction in National Football League Players* (2022), PMCID `PMC8905068`, PMID `35284583`.
- **Directness:** PARTICIPATION / PERFORMANCE CONTEXT.
- **Data:** 312 NFL players undergoing ACL reconstruction, 2013–2018 cohort, with snap counts/games/performance before and after injury.
- **Key result:** only 55.8% returned to play; post-return performance and snap counts declined overall, with strong position differences. Quarterbacks returned more successfully than several other positions; running backs showed particularly large performance declines.
- **Why it matters:** injury history can alter expected participation and role, especially for RB/WR-style volume props.
- **Limitation:** long-horizon surgical injury evidence is not a same-week injury model and must never substitute for current practice/injury status.
- **Provisional History Fit role:** participation caution / position-specific transportability.
- **Review status:** REVIEW.

### V18-NFL-INJURY-002 — ankle injury and offensive skill-player production

- **Source:** *Fantasy football points capture performance declines in National Football League offensive skill players following an ankle injury* (2024), PMID `38596620`.
- **Directness:** PARTICIPATION / PERFORMANCE CONTEXT.
- **Data:** 303 NFL players with ankle injuries.
- **Finding:** fantasy output and position-specific performance declined in the following season, with significant decreases among running backs, tight ends and wide receivers; quarterbacks were less affected on most metrics.
- **Why it matters:** player-prop models should not assume a uniform injury-recovery penalty across positions/stat families.
- **Limitation:** season-level post-injury evidence, not a current-week sportsbook calibration study.
- **Provisional History Fit role:** injury/role caution.
- **Review status:** REVIEW.

### V18-NFL-TD-001 — practitioner anytime-TD holdout candidate

- **Source:** SportSphere NFL methodology page (2026), public practitioner model.
- **Directness:** DIRECT MARKET / NON-PEER-REVIEWED.
- **Method:** role-aware touchdown priors, team-total adjustment, opponent factor and isotonic calibration; page states that 2023 is used for calibration and 2024 is a permanent holdout.
- **Reported audit sample:** page reports 261 real-bookmaker lines in the 2024 holdout and publishes role-level results.
- **Why it matters:** one of the few public current sources located that explicitly claims a held-out test against real NFL anytime-touchdown prices.
- **Critical limitation:** independent data/line provenance, timestamp semantics, selection policy, de-vig method and reported EV calculations must be audited before any canonical use. Practitioner self-report is not high-tier evidence.
- **Provisional History Fit role:** direct market audit candidate / caution.
- **Review status:** SOURCE/DATA AUDIT ONLY.

## Proposed NFL player-prop evidence clusters for v1.8

### `nfl_player_passing_volume_distribution_and_price_calibration`

Separate:

1. expected dropbacks / pass attempts;
2. completion probability;
3. depth-of-target and yards after catch;
4. opponent pressure/coverage context;
5. quarterback/receiver availability;
6. game script and pace;
7. full yardage distribution/quantiles;
8. exact posted line and juice;
9. multi-book comparison and closing-price benchmark.

A passing-yard projection without uncertainty should not receive a high History Fit grade merely because its mean clears the posted number.

### `nfl_player_rushing_usage_distribution_and_price_calibration`

Separate:

1. expected carries/snap share;
2. designed runs versus scramble volume where relevant;
3. offensive-line/blocking and defender geometry;
4. game script / score state;
5. goal-line role;
6. player health/return-to-play uncertainty;
7. outcome distribution, not only yards-per-carry;
8. exact prop line/juice and book.

### `nfl_player_receiving_opportunity_catch_yac_and_price_calibration`

Separate:

1. routes/snap share;
2. target probability/share;
3. route/depth-of-target distribution;
4. defender/coverage context;
5. catch probability;
6. expected yards after catch;
7. teammate availability and role shifts;
8. game script;
9. full reception/yardage distribution;
10. exact line/juice and closing benchmark.

### `nfl_player_anytime_td_opportunity_and_price_calibration`

Separate:

1. red-zone/goal-line opportunity;
2. team implied scoring environment;
3. rushing versus receiving TD mechanism;
4. player role and snap uncertainty;
5. touchdown probability distribution;
6. vig/hold, which is often materially larger than standard sides/totals;
7. exact book and price.

Do not infer an anytime-TD edge from scoring streaks alone.

## History Fit behavior candidate

Future v1.8 NFL prop messages should be able to distinguish:

- **B / supportive mechanism:** usage, player-skill and context-adjusted evidence support the projected stat distribution, but direct sportsbook calibration is limited.
- **C / mixed:** projection mechanism is plausible, but injury/role/game-script or distributional uncertainty makes the line comparison fragile.
- **D / caution:** case is driven mainly by last-N hit rate, scoring streaks, raw yards-per-game or unadjusted defense-vs-position splits.
- **NR / calibration gap:** if the question is whether a particular posted player-prop line is historically mispriced and no verified direct price study applies.

Research must never convert a player projection into a BET without normal identity, freshness, executable-price, fair-value and staking gates.

## Remaining NFL prop gaps after Batch 04

### P0 — research-grade historical sportsbook prop prices

Need opening/closing line + over/under juice + sportsbook + timestamp + exact player/game identity + result across multiple seasons/books for:

- passing yards / completions / passing TDs;
- rushing yards / attempts;
- receiving yards / receptions;
- combined rush+receive yards;
- anytime TD.

### P0 — direct calibration studies

Need rigorous work comparing predicted probabilities/distributions against actual sportsbook player-prop lines, ideally walk-forward or untouched holdout and multi-book.

### P1 — same-week participation uncertainty

Long-term return-to-play literature is useful context but not enough. Seek direct evidence on snap/route/carry changes when a player is questionable, returning from short absence, limited in practice or affected by teammate injury.

### P1 — line movement / price discovery in props

Need opening-to-closing player-prop movement research: whether early prop movement contains information, how quickly role/injury news is incorporated, and whether a moved line versus moved juice should be interpreted differently.

### P1 — correlation / same-game parlays

Player props are strongly dependent within a game. Future work should distinguish marginal prop calibration from correlation pricing in same-game parlays.

## Promotion rule

This batch is discovery/staging only. Candidate sources must be verified, deduplicated against v1.7 and Batches 01–03, assigned evidence tiers, grouped into overlap/conflict clusters, and tested in a broader manual retrieval suite before any v1.8 promotion.

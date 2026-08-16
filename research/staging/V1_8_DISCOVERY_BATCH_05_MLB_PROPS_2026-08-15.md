# Betting Edge Research Library v1.8 — Discovery Batch 05: MLB Props Deep Dive

**Date:** 2026-08-15  
**State:** STAGING ONLY — NOT RUNTIME AUTHORITY  
**Active production library remains:** Research Library v1.7  
**Production manifest remains:** `research/manifest.json`

## Hard boundary

Nothing in this file is approved canonical research. Normal Betting Edge reports must continue reading Research Library v1.7 only. This staging batch must not be referenced by the production manifest, report prompts, runner, odds workflows, contract, or live History Fit runtime until a later explicit review/promotion step.

This pass focuses on MLB player props, especially **pitcher strikeouts, batter hits, total bases and home runs**, with secondary attention to walks, RBIs/runs and pitcher workload/outs because those mechanisms materially interact with the primary prop markets.

## Executive assessment

After this pass, MLB prop research is materially stronger and—unlike the earlier pass—now has a plausible route to **direct market calibration**, not only player-performance modeling.

- **Pitcher strikeouts:** mechanism evidence is strong. A peer-reviewed strikeout matchup model uses nearly one million observations, and newer pitch-sequence work provides modern Statcast-based context for K generation. A public 2026 dataset also supplies time-ordered starting-pitcher K context and threshold outcomes.
- **Hits / total bases:** mechanism evidence is strong through Statcast expected statistics, batter/pitcher event models and modern player forecasting. Direct price calibration is now feasible because a large public 2026 prop-odds dataset includes hits and total bases with line, side, book, timestamp and settled result.
- **Home runs:** mechanism evidence is strong through Statcast quality-of-contact, personnel-adjusted park effects and player HR forecasting. Direct market calibration is also feasible from the same public odds dataset because home-run prop quotes and results are included.
- **Direct sportsbook price data:** this is the major improvement. A public CC-BY-4.0 dataset advertises roughly **621 million rows** of minute-level 2026 MLB player-prop quotes across about 75 sportsbooks, exchanges and prediction markets, covering total bases, hits, RBIs, home runs, strikeouts and batting walks, with outcomes attached for settled games.
- **Historical depth remains limited:** the large direct dataset is 2026 only. It can support modern price-quality, closing-line, line-movement and cross-book calibration work, but not long-run era conclusions by itself.
- **Paid historical path exists but is not required for staging:** The Odds API documents historical event-level player props from May 3, 2023 at five-minute snapshots on paid plans. This is a possible external validation source, not a production dependency.

The practical v1.8 conclusion should be: **MLB props now have strong mechanism coverage and a serious direct-market research dataset, but canonical conclusions require a reproducible audit of that dataset before any betting-market prior is promoted.**

## Candidate set

### V18-MLB-K-001 — Healey 2015: batter/pitcher strikeout probability

- **Source:** Glenn Healey (2015), *Modeling the Probability of a Strikeout for a Batter/Pitcher Matchup*, IEEE Transactions on Knowledge and Data Engineering 27(9), 2415–2423.
- **DOI:** `10.1109/TKDE.2015.2416735`.
- **Directness:** PLAYER FORECAST MECHANISM — EXACT EVENT MATCH.
- **Data:** nearly one million batter/pitcher matchup observations.
- **Method:** evaluates log5 and constrained logistic-regression formulations and tests additional matchup descriptors.
- **Key finding:** batter/pitcher event rates are predictive of strikeout probability; a ground-ball-rate interaction also contributes. The study reports batters account for a large share of variation in predicted strikeout rate.
- **Why it matters:** Pitcher-K props should not be modeled from pitcher K/9 alone. Opposing hitter strikeout tendency and matchup structure materially matter.
- **Limitation:** plate-appearance strikeout probability is only one component of a game-level pitcher-K distribution. Expected batters faced, pitch count, innings/manager hook and lineup identity must also be modeled.
- **Provisional History Fit role:** strikeout mechanism / matchup calibration.
- **Review status:** HIGHEST PRIORITY DEEP REVIEW.

### V18-MLB-K-002 — modern pitch-sequence / swing-out modeling

- **Source:** Takamido & Nakamoto (2026), *Counterfactual Optimization of Baseball Pitch Sequences and Estimation of Its Impact on Season-Level Statistics*, arXiv `2606.17345`.
- **Directness:** PLAYER FORECAST MECHANISM.
- **Data:** MLB Statcast pitch-sequence data.
- **Method:** Transformer-based model estimates in-play versus swing-out outcomes under counterfactual pitch sequences.
- **Why it matters:** Supports the idea that strikeout ability is conditional on pitch mix, location and sequence rather than a stationary season K rate.
- **Limitation:** not a sportsbook study and does not directly forecast a starter's game-level strikeout total.
- **Provisional History Fit role:** modern K mechanism / context.
- **Review status:** DEEP REVIEW.

### V18-MLB-K-003 — starting-pitcher strikeout research dataset

- **Source:** Karmane, *MLB Starting Pitcher Strikeout Prop Dataset for Historical K Research*, Hugging Face.
- **Directness:** PROP-RESEARCH DATASET / NO POSTED BOOK PRICES.
- **Documented full coverage:** 16,808 starting-pitcher game rows, 110 columns, 2023-03-30 through 2026-06-18.
- **Pregame context:** rolling strikeout form, pitch-count workload, rest, opponent-team strikeout environment and related time-ordered variables.
- **Outcomes:** actual strikeouts and threshold flags for 5+, 6+, 7+ and 8+.
- **Why it matters:** Provides a useful infrastructure candidate for walk-forward threshold modeling and workload/opponent-K analysis.
- **Limitation:** threshold outcomes are not sportsbook line/juice data; full dataset access/provenance must be audited. The free sample is only a preview.
- **Provisional History Fit role:** data infrastructure / mechanism.
- **Review status:** SOURCE/DATA AUDIT.

### V18-MLB-MARKET-001 — SmartStake 2026 MLB player-prop odds and results

- **Source:** SmartStake, *MLB Player Prop Odds and Results (2026)*, Hugging Face, CC BY 4.0.
- **Directness:** DIRECT PLAYER-PROP MARKET DATASET.
- **Documented scale:** dataset viewer reports approximately **621 million rows**.
- **Odds coverage:** late March through early July 2026; settled outcomes available through June in the published export.
- **Markets:** total bases, hits, RBIs, home runs, strikeouts and batting walks.
- **Books/sources:** roughly 75 sportsbooks, exchanges and prediction markets, including Bet365, DraftKings, FanDuel, Fanatics, Pinnacle and others.
- **Schema:** stable game identity, scheduled start, player, market, line, side, book, minute timestamp, decimal odds, final result and win/loss flag.
- **Why it matters:** This is the strongest direct MLB-prop research infrastructure found so far. It should permit:
  - closing-price calibration by market and book;
  - Brier/log-loss style probability calibration after de-vigging;
  - cross-book dispersion and line shopping;
  - opening-to-closing movement analysis;
  - line-versus-juice movement separation;
  - exact-line analysis (e.g. 0.5 vs 1.5 hits; 1.5 vs 2.5 total bases);
  - time-to-first-pitch information incorporation;
  - book/source sharpness comparison;
  - market-specific favorite/longshot/hold analysis.
- **Critical audit requirements:** verify collection provenance, source identity mapping, exchange versus sportsbook separation, void/push grading, timestamp semantics, duplicated unchanged quotes, market-name normalization, player/game identity, and whether the latest pregame quote is a defensible closing-price proxy.
- **Provisional History Fit role:** direct market calibration candidate.
- **Review status:** **TOP PRIORITY DATA AUDIT FOR MLB v1.8**.

### V18-MLB-MARKET-002 — The Odds API historical player-prop snapshots

- **Source:** The Odds API historical event odds documentation.
- **Directness:** DIRECT MARKET DATA SOURCE / COMMERCIAL.
- **Coverage:** historical additional markets, including player props, from May 3, 2023; five-minute snapshots.
- **Why it matters:** Could independently verify selected dates/books/markets from public datasets and provides exact historical event snapshots.
- **Limitation:** historical access is paid; this should not become a required runtime dependency for Betting Edge or a prerequisite to the public-data audit.
- **Provisional History Fit role:** external validation source only.
- **Review status:** OPTIONAL VALIDATION.

### V18-MLB-MARKET-003 — BALLDONTLIE current MLB player-prop endpoint

- **Source:** BALLDONTLIE MLB API documentation.
- **Directness:** CURRENT DIRECT MARKET DATA SOURCE.
- **Book coverage documented:** BetMGM, BetRivers, Caesars, DraftKings, Fanatics and FanDuel.
- **Why it matters:** Useful as a future current-market cross-check or collection route for exact player/market identity and multi-book quotes.
- **Limitation:** current endpoint documentation does not itself establish historical depth or calibration quality.
- **Provisional History Fit role:** future data acquisition / identity cross-check, not research evidence.
- **Review status:** INFRASTRUCTURE CANDIDATE.

### V18-MLB-HIT-001 — Statcast expected statistics

- **Source:** MLB Baseball Savant / Statcast Expected Statistics.
- **Directness:** OFFICIAL LEAGUE PLAYER-PERFORMANCE MECHANISM.
- **Mechanism:** batted-ball exit velocity and launch angle are mapped to historical comparable outcomes to produce hit probability; those outcomes feed xBA/xSLG/xwOBA alongside strikeouts, walks and HBP.
- **Why it matters for hit/total-base props:** Raw batting average and recent hit streaks should not be the sole basis for a hit projection. Quality of contact and expected outcome distributions provide a better regression anchor.
- **Limitation:** season-level expected statistics do not directly provide a single-game probability of 1+ hits or 2+ total bases and do not calibrate sportsbook prices.
- **Provisional History Fit role:** hit/total-base mechanism / regression-to-skill.
- **Review status:** HIGHEST PRIORITY OFFICIAL-MECHANISM REVIEW.

### V18-MLB-HIT-002 — Bayesian batter/pitcher matchup event model

- **Source:** Doo & Kim (2018), *Modeling the probability of a batter/pitcher matchup event: A Bayesian approach*, PLOS ONE 13(10): e0204874.
- **DOI:** `10.1371/journal.pone.0204874`.
- **Directness:** PLAYER FORECAST MECHANISM.
- **Method:** Bayesian hierarchical log5 model designed to stabilize sparse batter/pitcher matchup samples.
- **Key relevance:** illustrates why tiny batter-vs-pitcher samples should be shrunk rather than treated as literal predictive truth; produces posterior predictive distributions and can be adapted to events such as strikeouts/home runs.
- **Limitation:** empirical sample is KBO, not MLB; use as methodology/architecture evidence rather than direct MLB market calibration.
- **Provisional History Fit role:** methodology / sparse-matchup caution.
- **Review status:** DEEP REVIEW WITH TRANSPORTABILITY CAVEAT.

### V18-MLB-HIT-003 — Watkins 2020 Statcast player-performance dissertation

- **Source:** Christopher Watkins (2020), Chapman University PhD dissertation, *Novel Statistical and Machine Learning Methods for the Forecasting and Analysis of Major League Baseball Player Performance*.
- **DOI:** `10.36837/chapman.000139`.
- **Directness:** PLAYER FORECAST MECHANISM.
- **Data/surface:** MLB Statcast; dynamic pitcher effectiveness, pitch sequencing and player projection work.
- **Relevant outcomes:** outs, hits and strikeouts appear in the pitch-sequence work; future wOBA projection is also studied.
- **Why it matters:** Supports dynamic player/pitcher state and pitch-sequence context rather than relying exclusively on season averages.
- **Limitation:** not a sportsbook prop-pricing study.
- **Provisional History Fit role:** player-state / pitch-sequence mechanism.
- **Review status:** DEEP REVIEW.

### V18-MLB-HR-001 — personnel-adjusted home-run park effects

- **Source:** Osborne & Levine (2025), *Personnel-adjustment for home run park effects in Major League Baseball*, arXiv `2506.22350`.
- **Directness:** PLAYER FORECAST MECHANISM / PARK CONTEXT.
- **Data:** 13 MLB seasons.
- **Method:** generalized linear mixed-effects models controlling batter HR ability, pitcher HR tendency and handedness combinations.
- **Finding:** personnel-adjusted HR park frequencies can differ materially from raw observed park rankings.
- **Why it matters:** HR props should not simply attach a generic historical park multiplier to every hitter. Handedness and the personnel that generated the observed park rates matter.
- **Provisional History Fit role:** HR park-context methodology / caution.
- **Review status:** HIGHEST PRIORITY HR REVIEW.

### V18-MLB-HR-002 — MLB Statcast park factors

- **Source:** MLB Baseball Savant Statcast Park Factors.
- **Directness:** OFFICIAL LEAGUE CONTEXT DATA.
- **Mechanism:** compares each batter/pitcher performance in a park versus elsewhere, controlling for handedness; exposes HR, hits, run and related venue effects.
- **Why it matters:** provides a current official venue-context anchor and can be compared against the personnel-adjusted academic approach.
- **Limitation:** observed park factor is contextual evidence, not a single-game HR probability or sportsbook calibration result; small one-year samples can be noisy.
- **Provisional History Fit role:** current park context / methodology.
- **Review status:** DEEP REVIEW; prefer multi-year/handedness-aware use.

### V18-MLB-HR-003 — LSTM home-run performance forecasting

- **Source:** Sun, Lin & Tsai (2022), *Performance Prediction in Major League Baseball by Long Short-Term Memory Networks*, arXiv `2206.09654`.
- **Directness:** PLAYER FORECAST MECHANISM.
- **Target:** player home-run performance.
- **Why it matters:** supports sequential/time-dependent player-power modeling rather than fixed career rates.
- **Limitation:** target is broader player performance/home-run totals, not a single-game anytime-HR probability and not sportsbook market calibration.
- **Provisional History Fit role:** HR forecasting mechanism only.
- **Review status:** REVIEW.

### V18-MLB-WORLD-001 — Neural Sabermetrics world model

- **Source:** Ahn, Du, Zhang & Kang (2026), *Neural Sabermetrics with World Model: Play-by-play Predictive Modeling with Large Language Model*, arXiv `2602.07030`.
- **Directness:** PLAYER/GAME EVENT FORECAST MECHANISM.
- **Data:** more than ten years of MLB tracking data, over seven million pitch sequences.
- **Reported evaluation:** includes out-of-distribution postseason tests; predicts next pitch and batter swing decisions among multiple sequence tasks.
- **Why it matters:** demonstrates that rich sequential baseball state can be modeled at pitch level and may eventually support coherent joint distributions for batter/pitcher props.
- **Limitation:** not a sportsbook study, and large-model complexity must prove incremental calibration over simpler baselines before it deserves practical weight.
- **Provisional History Fit role:** future architecture / methodology.
- **Review status:** DEEP REVIEW WITH COMPLEXITY CAUTION.

## Proposed MLB prop evidence clusters for v1.8

### `mlb_pitcher_strikeout_matchup_workload_and_price_calibration`

Separate:

1. per-PA strikeout probability from pitcher, batter and handedness/context;
2. expected opposing lineup and lineup confirmation;
3. expected batters faced;
4. pitch-count/innings workload and manager hook risk;
5. recent velocity/pitch-mix changes only when validated;
6. opponent contact/strikeout environment;
7. game-level K distribution / alternate thresholds;
8. exact line and over/under juice;
9. book/source identity and closing benchmark.

A high pitcher K-rate does not automatically imply value on an Over if workload, opponent contact, price or line have already absorbed it.

### `mlb_batter_hits_total_bases_contact_quality_and_price_calibration`

Separate:

1. lineup slot and confirmed participation;
2. expected plate appearances;
3. batter contact quality / xBA/xSLG-style skill;
4. opposing starter and bullpen quality;
5. handedness/platoon effects;
6. park and environment;
7. event distribution across 0/1/2/3+ hits or bases;
8. exact prop line and juice;
9. cross-book dispersion and closing movement.

Do not infer a hit/total-base edge from a last-N hit rate alone.

### `mlb_batter_home_run_skill_park_pitcher_and_price_calibration`

Separate:

1. batter HR skill / quality of contact;
2. pitcher HR susceptibility and pitch mix;
3. handedness;
4. park effects adjusted for personnel where possible;
5. expected plate appearances;
6. weather/roof only if reliably sourced and validated;
7. home-run probability, not season HR pace alone;
8. large vig/hold and cross-book price dispersion;
9. exact anytime-HR price and closing benchmark.

Do not treat a favorable park or recent HR streak as an independent edge.

## Direct-market audit plan — priority work before v1.8 promotion

The SmartStake dataset changes the MLB research opportunity enough that it deserves its own validation project.

### A. Integrity checks

- Verify unique `game_id` mapping against official MLB schedule/box scores.
- Normalize player names to MLB identifiers where possible.
- Inspect void/ungraded rows, scratches and late lineup changes.
- Separate sportsbooks, exchanges and prediction markets.
- Confirm decimal odds convention and side/line semantics.
- Determine whether each minute is a true changed quote or a repeated snapshot.

### B. Closing-line construction

For each book/player/market/line:

- choose the final valid quote before scheduled/actual first pitch;
- flag stale books and quotes with excessive age;
- preserve both line and price, never price alone;
- record whether movement was line movement, juice movement or both;
- avoid mixing alternate lines with the main market.

### C. De-vig and calibration

For two-sided O/U markets:

- pair Over and Under on the exact same player, market, line, book and timestamp where possible;
- compute raw implied probability;
- remove hold with the production-approved no-vig method or compare multiple methods in research;
- evaluate Brier score, log loss and calibration bands;
- stratify by market (K, hits, TB, walks, RBI) and by book/source class.

For one-sided HR markets:

- do not pretend a single quoted yes-price gives a complete fair probability without a defensible complement/margin model;
- compare across books and use explicit caution around hold estimation.

### D. Price discovery / movement

Study:

- early versus late quote calibration;
- whether movement toward the closing line improves calibration;
- whether moved juice behaves differently from moved line;
- whether cross-book dispersion narrows near first pitch;
- whether lineup announcements and pitcher changes create observable structural breaks.

### E. Walk-forward testing

No random train/test split for time-varying market claims. Use chronological training/validation windows and preserve entire future dates as holdouts.

## History Fit behavior candidate

Future v1.8 MLB prop messages should be able to distinguish:

- **A/B / direct supportive:** modern direct-market calibration plus player-mechanism evidence both align for the exact prop class, line type and timing, with no major unresolved data-quality concern.
- **B / mechanism supportive:** player-level research supports the statistical mechanism, but direct sportsbook calibration is limited or not yet validated for that exact market.
- **C / mixed:** mechanism is plausible, but price, workload, lineup, park, bullpen or distributional uncertainty weakens transportability.
- **D / caution:** case relies mainly on recent hit rate, batter-vs-pitcher anecdote, raw park factor, HR streak, pitcher K/9 or other unadjusted descriptive statistics.
- **NR / calibration gap:** no verified direct price evidence exists for the exact market/line structure.

Research must never convert a player projection into a BET without normal identity, freshness, executable-price, fair-value and staking gates.

## Remaining MLB prop gaps after Batch 05

### P0 — audit the 2026 direct-market dataset

This is now more important than finding another generic forecasting paper. Until provenance and closing-line construction are tested, the 621M-row dataset is **promising infrastructure, not canonical evidence**.

### P0 — multi-season direct prop prices

2026 is excellent for current-regime calibration but insufficient for long-run claims. Seek legitimate multi-season MLB prop prices from 2023–2026 or earlier with exact line/juice/book/timestamp semantics.

### P0 — game-level pitcher-K distribution

The literature strongly supports matchup-level K probability, but v1.8 still needs a strong, reproducible game-level starter strikeout distribution model incorporating expected batters faced and workload/hook risk.

### P1 — total bases distribution

Need direct research on translating batted-ball quality and matchup context into 0/1/2/3/4+ total-base probabilities rather than using a mean slugging estimate.

### P1 — bullpen exposure for batter props

A hitter's game prop spans the starter and bullpen. Research should quantify how much a batter's expected plate appearances and later-pitcher quality change hit/TB/HR probabilities.

### P1 — same-game correlation

MLB player props are correlated through pitcher performance, lineup turnover and game environment. Marginal prop calibration must remain separate from SGP correlation pricing.

## Promotion rule

This batch is discovery/staging only. Candidate sources must be verified, deduplicated against v1.7 and Batches 01–04, assigned evidence tiers, grouped into overlap/conflict clusters, and tested in a broader manual retrieval suite before any v1.8 promotion.

The **SmartStake direct-market dataset must not be promoted as evidence merely because it is large**. Its value comes only after identity, timestamp, market normalization, de-vig, closing-line and outcome-grading audits pass reproducibly.

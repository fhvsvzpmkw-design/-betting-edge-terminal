# Betting Edge Research Library v1.8 — Phase 2 Audit Tranche 03: Batch 01 + Market-Data Reproducibility

**Date:** 2026-08-15  
**State:** STAGING / AUDIT ONLY — NOT RUNTIME AUTHORITY  
**Active production library remains:** Research Library v1.7  
**Production manifest remains:** `research/manifest.json`

## Purpose

This tranche completes the first source-level disposition pass on Discovery Batch 01 and tightens the reproducibility requirements for direct player-prop market datasets, especially SmartStake MLB 2026.

Nothing in this tranche changes the production Research Library, History Fit policy, report prompts, contract, runner, odds workflows, scheduled reports, or any v1.7 canonical record.

## Batch 01 disposition summary

### V18-001 — Walsh & Joshi 2024, calibration vs accuracy

- Original DOI: `10.1016/j.mlwa.2024.100539`.
- Corrigendum DOI: `10.1016/j.mlwa.2025.100627`.
- Authors' public repository states implementation errors were discovered during modularisation/unit testing and corrected code is now published.
- **Disposition:** `HOLD_CORRIGENDUM_RECONCILIATION` for exact ROI/result magnitudes. Retain only as a methodology candidate until corrected claims are reconciled.
- **Independent predictive vote:** no.

### V18-002 — Fodor, Patterson & Shank 2025, NFL anchoring

- DOI verified: `10.1016/j.econlet.2025.112288`.
- Direct NFL betting-market evidence: preseason Super Bowl odds are associated with bettor behavior and remain related to sportsbook closing prices through the season.
- Data are not shareable by the authors, limiting reproducibility.
- **Disposition:** `KEEP_WITH_CAUTION` as modern NFL market-behavior/price-formation evidence.
- **Transportability:** high for current NFL market behavior; not a player-prop calibration result.

### V18-003 — Borghesi et al. 2026, parlay adoption and sportsbook margins

- DOI verified: `10.1016/j.frl.2026.110218`.
- Sample verified at 547 million regular-season NFL wagers from one large regulated U.S. sportsbook, 2018–2023.
- Directly documents within-bettor migration toward multi-leg wagers and materially higher sportsbook margins on parlays.
- **Disposition:** `KEEP_PRIMARY_CAUTION` for parlay contract structure and margin.
- **Limitation:** one operator; does not by itself calibrate same-game-parlay correlation pricing or establish a universal margin schedule.

### V18-004 — Hegarty & Whelan 2025, soccer 1X2 vs Asian handicap

- DOI verified: `10.1016/j.ijforecast.2024.06.013`.
- Sample verified at 84,230 European matches, 2011/12–2021/22, using average closing odds.
- Traditional 1X2 prices show strong favorite-longshot bias while Asian handicap prices are much closer to efficient forecasts in the same match sample.
- Data/code availability is explicitly documented by the paper.
- **Disposition:** `KEEP_PRIMARY` for market-structure transportability.
- **Canonical implication:** Betting Edge must not transfer a favorite/longshot conclusion from one price architecture to another without an explicit market-structure match.

### V18-005 — Clegg & Cartlidge 2025, correction/replication of tennis “buzz” strategy

- DOI verified: `10.1016/j.ijforecast.2024.06.012`.
- Reproduces the original result, identifies a single erroneous long-odds observation that materially inflated out-of-sample profit, and finds the surviving strategy did not continue to profit after 2020.
- Code/data are published by the authors.
- **Disposition:** `KEEP_PRIMARY_CAUTION` as a replication/data-quality/transportability prior.
- **Canonical implication:** isolated high-return observations and stale post-period failure must lower confidence in historical strategy claims.

### V18-006 — Montone 2021, optimal pricing in online betting

- DOI verified: `10.1016/j.jebo.2021.04.007`.
- Uses real-time online-bookmaker odds and tests price adjustment, order-flow shocks, demand elasticity and arbitrage implications.
- **Disposition:** `KEEP_PRIMARY_METHODOLOGY` for movement/microstructure interpretation.
- **Limitation:** broad bookmaker microstructure; not a sport-specific directional betting rule.

### V18-007 — Nofsinger & Shank 2023, NFL momentum trading

- DOI verified: `10.1016/j.frl.2023.104006`.
- Uses NFL opening/closing lines and betting percentages from 2003–2017.
- Finds bettor momentum behavior in totals, but mixed trading outcomes and an overall interpretation consistent with market efficiency.
- **Disposition:** `KEEP_ERA_CAVEAT` as behavioral evidence, not a modern automatic NFL totals signal.
- **Transportability:** medium-low to 2026 because the betting-access/book environment is older.

### V18-008 — Fodor, Onuk & Shank 2026, key-number quote differences

- DOI verified: `10.1016/j.frl.2026.110193`.
- More than 5.5 million bettor contracts across 4,140 NFL/NCAA games, 2020–2024.
- Crossing football key numbers 3 and 7 produces large demand discontinuities but no corresponding return discontinuity; Bayes factors strongly favor no return predictability.
- **Disposition:** `KEEP_PRIMARY_CAUTION` for key-number movement interpretation.
- **Canonical implication:** a mechanically meaningful line move across 3 or 7 is not automatically evidence of private information or predictive edge.

### V18-009 — Baker et al. 2026, Retail Betting Markets

- NBER Working Paper 35520, DOI `10.3386/w35520`.
- Current market-design synthesis covering sports betting, prediction markets and retail options.
- **Disposition:** `CONTEXT_ONLY`.
- **Independent predictive vote:** no.

### V18-010 — Pitcan 2026, structural model vs closing price

- arXiv `2608.11505`, 7,220 Serie A matches across nineteen seasons.
- Directly tests incremental information after conditioning on margin-free closing prices; the structural goals model receives zero pooling weight against the market in the reported tests.
- **Disposition:** `KEEP_PREPRINT_METHODOLOGY`.
- **Canonical implication:** compare model information to the closing market, not merely to an accuracy baseline.
- **Limitation:** very recent preprint; no independent predictive vote until replication/peer review.

### V18-011 — Clegg, Song & Cartlidge 2026, market-calibrated in-play football model

- arXiv `2605.16066`.
- Evaluated on 140 EPL matches at minute intervals; market calibration is reported as the dominant driver of predictive accuracy.
- The paper also reports a profitable in-play betting simulation.
- **Disposition:** `KEEP_PREPRINT_METHODOLOGY`; **quarantine reported ROI as non-canonical** pending independent replication and careful treatment of repeated, correlated within-match bets.
- **Canonical implication:** pregame market information and in-play state updates should be separated explicitly.

### V18-012 — Moshrefi 2026, sports prediction-market calibration

- arXiv `2607.14430`.
- Uses 23 million Kalshi moneyline trades; reports calibration varying with time-to-expiry and systematic parlay overpricing relative to contemporaneous leg prices.
- **Disposition:** `KEEP_PREPRINT_TRANSPORTABILITY_CAUTION`.
- **Independent sportsbook vote:** no. Prediction-market structure must not be silently treated as sportsbook structure.

## SmartStake MLB 2026 direct-market dataset audit

### What is verified

The public dataset card currently documents:

- **621,391,637 rows**;
- **901 MB** of parquet data;
- late March through early July 2026 quote coverage;
- settled outcomes through June, with July outcomes null at export time;
- markets including total bases, hits, RBIs, home runs, strikeouts and batting walks;
- approximately 75 sportsbooks, exchanges and prediction markets;
- fields: `game_id`, `start_time`, `player`, `market`, `line`, `side`, `book`, `ts`, `odds`, `result`, `won`;
- game-key “de-drift” and within-minute identity collapsing described by the publisher;
- CC BY 4.0 release.

### Material row-level observation from the public viewer

The dataset card says `ts` is the minute a quote was live and describes “one row per changed minute.” The public viewer, however, visibly contains long runs of **identical odds repeated across many different minutes** for the same game/player/market/line/side/book before the price changes.

This does **not** invalidate closing-price extraction, because selecting the final pregame quote with `arg_max(odds, ts)` remains well-defined. It **does** mean:

1. the 621M row count must not be interpreted as 621M independent price changes;
2. quote-frequency analysis must not weight repeated unchanged minutes as independent market decisions;
3. intraday movement work should run-length-compress unchanged quotes or otherwise use event-time changes;
4. calibration should be performed on one defined closing observation per exact selection, not raw quote rows.

### Additional reproducibility constraints

Before any direct MLB price finding is promoted, the audit must verify:

- uniqueness of `(game_id, player, market, line, side, book, minute)`;
- consistency of `won` with `result`, `line`, and `side`;
- pushes/voids remain null and are not silently graded;
- quotes with `ts >= start_time` are excluded;
- sensitivity to 0/5/15/60-minute pre-first-pitch closing cutoffs;
- exact over/under pairing at the same book/game/player/market/line;
- invalid/one-sided price pairs are excluded;
- sportsbooks are separated from exchanges/prediction markets before book comparisons;
- alternate lines are not allowed to dominate sample counts;
- the “main line” is selected using market information only, never the realized result;
- proportional no-vig is the baseline and alternate margin allocation is used as a sensitivity check where relevant;
- Brier/log loss/calibration are calculated on one event probability per paired market rather than counting both sides as independent observations;
- uncertainty is clustered at least at player-game-market level when multiple books/lines observe the same underlying result;
- any learned recalibration uses a forward holdout rather than same-period fitting and evaluation.

### Provenance limitation

The release explains that fragmented source game keys were mapped through a crosswalk into stable `game_id` values, but the public release does not expose the underlying source keys/crosswalk in the visible schema. Therefore the de-drift procedure is **documented but not independently reconstructible from the released table alone**. This lowers the dataset from “verified direct evidence” to `DIRECT_DATASET_AUDITABLE_WITH_PROVENANCE_LIMITATION` until cross-checks are completed.

### Current disposition

`V18-MLB-MARKET-001` remains **DATA_AUDIT_REQUIRED**, but the audit is now sufficiently specified for reproducible execution. The associated SQL protocol is stored separately in staging.

No bookmaker-sharpness ranking, calibration edge, movement edge, or profitable player-prop conclusion is canonical yet.

## Canonical-admission policy after this tranche

A candidate can now enter the v1.8 candidate overlay only when:

1. source identity is verified;
2. duplication against v1.7 and staging is resolved;
3. evidence role is explicit;
4. direct-market versus mechanism evidence is separated;
5. correction/corrigendum status is resolved or quarantined;
6. strongest limitation is written into the record;
7. current-era transportability is assigned;
8. no infrastructure source is counted as a predictive vote;
9. no unreplicated profitability claim is promoted solely because the reported ROI is positive.

## State after Tranche 03

Phase 2 has now reached the point where a **canonical candidate overlay** can be built safely without touching v1.7. The overlay is still staging-only and is not sufficient for promotion.

Remaining promotion blockers are:

- execute and preserve the SmartStake reproducibility audit outputs;
- reconcile the Walsh/Joshi corrigendum before using corrected quantitative claims;
- preserve direct-price gaps for WNBA, NFL and several NHL prop families where closing calibration remains weak;
- construct the v1.8 source registry and deduplicated canonical logical items;
- generate checksums;
- run a broad manual History Fit retrieval suite across MLB, NFL, NBA/WNBA, NHL, soccer and player props;
- re-prove all R3 hard boundaries;
- receive explicit approval before changing `research/manifest.json` from v1.7 to v1.8.

# Betting Edge Research Library v1.8 — Discovery Batch 01

**Date:** 2026-08-15  
**State:** STAGING ONLY — NOT RUNTIME AUTHORITY  
**Active production library remains:** Research Library v1.7  
**Production manifest remains:** `research/manifest.json`  

## Hard boundary

Nothing in this file is approved canonical research. Normal Betting Edge reports must continue reading v1.7 only. This staging file must not be referenced by the production manifest, report prompts, runner, odds workflows, contract, or History Fit runtime until a later explicit review/promotion step.

The purpose of v1.8 discovery is to make the Research Library both **larger** and **smarter** without diluting evidence quality. New material should add at least one of: direct evidence, replication, contradiction, modern transportability, methodology, structural-break evidence, or an explicit research gap.

## v1.7 baseline being extended

The current canonical v1.7 snapshot contains 96 logical items, 78 primary research priors, 18 question/gap resolution records, 73 deduplicated source records and 16 evidence/conflict clusters. v1.8 must preserve v1.7 provenance rather than rewriting it in place.

## v1.8 research thesis

The main upgrade is **modern calibration + transportability**.

Every accepted v1.8 prior should eventually answer more than “was this finding statistically interesting?” It should also record, where available:

- sample years and market regime;
- exact sport and market class;
- pregame/live and opening/intermediate/closing timing;
- single-book, multi-book, exchange or prediction-market source;
- average market price versus best executable price;
- vig / margin-removal methodology;
- replication or correction status;
- out-of-sample evidence;
- applicability to the modern regulated/mobile multi-book environment;
- directness to Betting Edge's actual decision surface;
- current-era transportability and strongest limitation.

## Discovery Batch 01 — high-value candidates

These are candidates for deep review, not automatic additions.

| Candidate | Source | Why it matters for v1.8 | Provisional role | Review status |
|---|---|---|---|---|
| V18-001 | Walsh & Joshi (2024), *Machine learning for sports betting: Should model selection be based on accuracy or calibration?*, Machine Learning with Applications 16, 100539. DOI `10.1016/j.mlwa.2024.100539` | Direct modern NBA wagering evidence that distinguishes probability calibration from classification accuracy; highly relevant to fair-probability/model evaluation. | methodology / calibration | DEEP REVIEW |
| V18-002 | Fodor, Patterson & Shank (2025), *Anchoring bias in the NFL gambling market*, Economics Letters 250, 112288. DOI `10.1016/j.econlet.2025.112288` | Modern NFL behavioral/price-formation evidence; tests whether preseason information continues to affect bettors and sportsbook closing prices. | NFL market behavior / caution | DEEP REVIEW |
| V18-003 | Borghesi, Salaga, Williams & Mondello (2026), *Contract choice, parlay adoption, and sportsbook margins*, Finance Research Letters 105, 110218. DOI `10.1016/j.frl.2026.110218` | Very large regulated-sportsbook transaction sample; directly informs parlay/SGP margin and bettor-contract-choice context. | parlay structure / margin caution | DEEP REVIEW |
| V18-004 | Hegarty & Whelan (2025), *Forecasting soccer matches with betting odds: A tale of two markets*, International Journal of Forecasting 41(2), 803–820. DOI `10.1016/j.ijforecast.2024.06.013` | Large modern soccer sample comparing traditional 1X2 with Asian handicap odds; directly tests whether efficiency and favorite-longshot behavior depend on market structure. | soccer market structure / transportability | DEEP REVIEW |
| V18-005 | Clegg & Cartlidge (2025), *Not feeling the buzz: Correction study of mispricing and inefficiency in online sportsbooks*, International Journal of Forecasting 41(2), 798–802. DOI `10.1016/j.ijforecast.2024.06.012` | Replication/correction evidence showing how a single erroneous odds observation and post-period failure can materially weaken a claimed tennis betting edge. This is a strong template for v1.8 replication/transportability policy. | replication / data-quality caution | DEEP REVIEW |
| V18-006 | Montone (2021), *Optimal pricing in the online betting market*, Journal of Economic Behavior & Organization 186, 344–363. DOI `10.1016/j.jebo.2021.04.007` | Real-time online-bookmaker pricing evidence linking price adjustment, demand elasticity, order-flow shocks and arbitrage opportunities. | market microstructure / movement interpretation | DEEP REVIEW |
| V18-007 | Nofsinger & Shank (2023), *Momentum trading in the NFL gambling market*, Finance Research Letters 55, 104006. DOI `10.1016/j.frl.2023.104006` | Modern NFL totals/spread behavioral evidence; useful for separating observed momentum/herding from robust predictive edge. | NFL totals / behavioral caution | DEEP REVIEW |
| V18-008 | Fodor, Onuk & Shank (2026), *Do economically meaningful quote differences convey private information?*, Finance Research Letters 104, 110193. DOI `10.1016/j.frl.2026.110193` | Modern football key-number evidence: economically important spread thresholds can drive bettor demand without necessarily carrying return-predictive information. Highly relevant to interpreting line movement around 3 and 7. | NFL/NCAAF key numbers / microstructure | DEEP REVIEW |
| V18-009 | Baker, Balthrop, Johnson, Kotter & Pisciotta (2026), *Retail Betting Markets*, NBER Working Paper 35520. DOI `10.3386/w35520` | Current market-design review connecting technology, bettor behavior and rapidly changing retail betting structures. Useful as architecture/context, not as a stand-alone predictive prior. | market-regime synthesis | REVIEW — CONTEXT ONLY |
| V18-010 | Pitcan (2026), *Does a Structural Model Add Anything to the Closing Price?*, arXiv `2608.11505` | Directly asks whether a calibrated structural soccer model contains incremental information beyond de-vigged closing market prices; a strong framework for testing whether a model adds information rather than merely achieving accuracy. | closing-price benchmark / methodology | PREPRINT — DEEP REVIEW |
| V18-011 | Clegg, Song & Cartlidge (2026), *A market-calibrated accelerated failure time model for in-play football forecasting*, arXiv `2605.16066` | Tests market-calibrated in-play forecasting and explicitly separates pregame market information from in-play state updates. | live market / calibration | PREPRINT — DEEP REVIEW |
| V18-012 | Moshrefi (2026), *Prices, Probabilities, and Parlays: Systematic Bias in Sports Prediction Markets*, arXiv `2607.14430` | Large sports prediction-market trade sample examining calibration by time-to-expiry and product type, including parlays. Relevant to Betting Edge only with explicit market-structure caveats because prediction markets are not sportsbooks. | prediction-market calibration / parlay context | PREPRINT — TRANSPORTABILITY REVIEW |

## Immediate source-registry audit flag

During discovery, the current v1.7 registry entry for Shank's 2022 NFL information-asymmetry paper should be audited in the v1.8 build process. The canonical registry currently stores DOI `10.1016/j.jbef.2022.100742`; current publisher metadata identifies *Information asymmetry in the NFL gambling market: Inside information versus informed bettors* as article 100758 with DOI `10.1016/j.jbef.2022.100758`.

**Do not repair v1.7 in place.** Verify the citation and carry the correction, if confirmed, into the v1.8 source-registry build with an explicit provenance note.

## Priority discovery lanes for Batch 02+

### P0 — Direct player-prop calibration

This is the largest known gap and should receive the most aggressive search effort.

Search separately for:

- NFL passing, rushing, receiving, anytime-TD and derivative props;
- NBA/WNBA points, rebounds, assists and combination props;
- NHL shots, points, goals and goalie props;
- MLB strikeouts, hits, total bases, home runs and pitcher props;
- sportsbook margin/hold and price calibration by prop class;
- participation/lineup uncertainty and late information;
- opening-to-closing prop movement and exact-line substitution;
- multi-book versus single-book prop price quality;
- same-game-parlay dependence/correlation pricing.

Direct player-performance forecasting papers may be useful as mechanism/architecture evidence, but they must not be promoted as sportsbook-prop calibration evidence unless they actually test betting prices or market probabilities.

### P0 — Calibration, vig and closing-price benchmarks

Expand work on:

- calibration versus accuracy;
- Brier/log-loss/RPS evaluation;
- proportional no-vig versus Shin/power/book-aware methods;
- closing price as an information benchmark;
- best available price versus average market price;
- whether model information remains incremental after conditioning on market prices.

### P1 — Modern sport/market transportability

Target post-2019 evidence for:

- NFL spread, moneyline and totals efficiency;
- NBA/WNBA totals and player absence/availability;
- NHL moneyline/totals and modern favorite-longshot transportability;
- MLB moneyline/run-line/totals and intraday movement;
- soccer 1X2, Asian handicap and totals;
- tennis market corrections/replications;
- combat-sport winner versus derivative-market separation;
- CFL pregame calibration versus live methodology.

### P1 — Structural breaks

Actively look for rule, schedule, scoring, market-access and regulation changes that can make an older prior non-transportable. Examples include clock/rules changes, overtime formats, roster/usage changes, rapid sportsbook legalization, new product types and changes in bookmaker competition.

## Candidate acceptance rules

A candidate should not enter canonical v1.8 merely because it is recent or reports a profitable strategy.

Before promotion, record:

1. exact citation/DOI or durable identifier;
2. source type and peer-review status;
3. sample period and sample size;
4. sport/market/timing scope;
5. odds source and execution-price definition;
6. de-vig/margin method;
7. whether the test is in-sample, holdout, replicated or corrected;
8. whether transaction costs/vig are respected;
9. whether the result is independent evidence or synthesis;
10. overlap/conflict cluster membership;
11. directness to Betting Edge;
12. 2026 transportability;
13. strongest limitation;
14. whether the correct History Fit role is support, caution, mixed, methodology or gap.

## Promotion gates for v1.8

Do not change `research/manifest.json` to v1.8 until all of the following are complete:

- candidate deduplication against the v1.7 source registry;
- full citation/provenance verification;
- conflict/replication clustering;
- explicit transportability assessment;
- new canonical IDs and source registry generated without altering v1.7 history;
- checksum generation;
- a new manual retrieval suite substantially broader than R2, including representative MLB, NFL, NBA/WNBA, NHL, soccer and player-prop cases;
- explicit proof that research still cannot create a bet, set an executable price, override identity/freshness/fair-value gates, or directly change `playTo`, status or stake;
- explicit approval to promote v1.8.

## Expected output of the full v1.8 project

The goal is not a predetermined item count. A larger library is desirable only when each added record improves coverage or interpretation. Discovery can be broad; canonical admission stays selective.

The desired end state is a library that can say not only **what historical research found**, but also **how directly it matches this market, how modern the evidence is, whether later work replicated it, and how much of it still transports to the current Betting Edge environment**.

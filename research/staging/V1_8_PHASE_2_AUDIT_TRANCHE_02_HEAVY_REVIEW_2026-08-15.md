# Betting Edge Research Library v1.8 — Phase 2 Audit Tranche 02: Heavy Review

**Date:** 2026-08-15  
**State:** STAGING / AUDIT ONLY — NOT RUNTIME AUTHORITY  
**Active production library remains:** Research Library v1.7  
**Production manifest remains:** `research/manifest.json`

## Purpose

This tranche moves the v1.8 project from discovery notes toward an evidence-qualified candidate set. It verifies primary-source identity where possible, separates market evidence from player-performance mechanism evidence, records transportability limits, resolves several duplicate/citation issues, and defines the first candidate dispositions for major player-prop clusters.

No live report, History Fit policy, manifest, contract, runner, odds workflow or v1.7 canonical record is changed by this file.

## Audit dimensions

Each candidate is reviewed on five separate dimensions rather than receiving one vague quality label:

1. **Source verification** — publisher/institutional/official source or reproducible dataset identity.
2. **Market directness** — direct sportsbook prop evidence versus adjacent/player-performance evidence.
3. **Method quality** — peer review, holdout/out-of-sample design, sample size, reproducibility and correction status.
4. **2026 transportability** — current era, league/market match, book structure, stat-definition compatibility and data regime.
5. **Canonical role** — independent prior, mechanism, caution, infrastructure, cross-link, or explicit gap.

## Material audit corrections discovered

### 1. Existing v1.7 Shank NFL DOI is wrong

The current v1.7 source registry stores `10.1016/j.jbef.2022.100742` for Corey A. Shank's *Information asymmetry in the NFL gambling market: Inside information versus informed bettors*.

Publisher metadata identifies the article as **Journal of Behavioral and Experimental Finance 36 (2022), article 100758**, DOI:

`10.1016/j.jbef.2022.100758`

**Disposition:** confirmed citation correction for the v1.8 source registry build. Do **not** rewrite v1.7 in place. Preserve a provenance note stating that v1.8 corrects a source-registry metadata error while leaving the historical v1.7 snapshot immutable.

### 2. Walsh & Joshi 2024 has a material corrigendum

Original article:

`10.1016/j.mlwa.2024.100539`

Published corrigendum:

`10.1016/j.mlwa.2025.100627`

The authors' public code repository explicitly states that errors were found while modularising and unit-testing the original implementation and that the repository now contains corrected code.

**Disposition:**

- paper identity: `VERIFIED_PRIMARY`;
- exact originally reported ROI magnitudes: **DO NOT CANONICALIZE** unless the corrected experiment is reproduced or the corrigendum text is fully reconciled;
- broader proposition that wagering model evaluation should emphasize probability calibration rather than raw classification accuracy: retain only as a **methodology candidate with correction caveat**;
- no independent predictive betting vote.

This is exactly the kind of correction v1.8 is intended to catch.

## Major-sport audit matrix

| Cluster | Best evidence currently verified | Market directness | 2026 transportability | Phase-2 disposition |
|---|---|---|---|---|
| NBA points/rebounds/assists | FanDuel closing-prop thesis + peer-reviewed stat-specific forecasting | Direct single-book + mechanism | High/medium | KEEP, but direct thesis capped by single-book/thesis design |
| WNBA points/rebounds/assists | live/opening multi-book prop infrastructure + player data | Infrastructure, not calibrated findings | High current data, low scholarly depth | PRESERVE GAP; build own audit dataset |
| NHL shots on goal | exact-stat ML thesis + direct SOG odds project + official/current prop infrastructure | Strong mechanism; moderate direct data | High mechanism, incomplete closing calibration | KEEP SOG cluster; direct-price conclusion remains limited |
| NHL goalie saves | goalie hot-hand study + player/shot data + current saves prop feeds | Mechanism/caution | Medium/high | KEEP caution cluster; price calibration gap remains |
| NFL passing/rushing/receiving | tracking/distribution research + Pick'em-adjacent pricing | Strong mechanism, weak direct sportsbook calibration | High mechanism | KEEP sport-specific mechanism; preserve direct-price gap |
| NFL anytime TD | role/opportunity modeling + low-tier practitioner holdout | Limited direct market | Medium | SOURCE AUDIT ONLY; no profitability prior yet |
| MLB pitcher strikeouts | peer-reviewed matchup model + modern pitch context + 2026 direct quote dataset | Strong mechanism + direct dataset | High for 2026 | HIGH-PRIORITY canonical candidate after dataset audit |
| MLB hits/total bases | Statcast expected-stat mechanism + 2026 direct quote dataset | Strong mechanism + direct dataset | High for 2026 | HIGH-PRIORITY canonical candidate after dataset audit |
| MLB home runs | park/personnel/Statcast mechanism + 2026 direct quote dataset | Strong mechanism + direct dataset | High for 2026 | HIGH-PRIORITY canonical candidate after dataset audit |

## NBA audit

### Wornow 2026 — direct FanDuel closing props

Institutional repository metadata verifies:

- Claremont McKenna College senior thesis, submitted April 2026;
- 178 NBA players;
- five statistical categories;
- 2022–2025 seasons;
- FanDuel **closing** over/under player-prop lines joined to realized game outcomes;
- difference-in-differences design focused on legalization and deviation from sportsbook expectations;
- no consistent directional over/under bias reported in the repository abstract.

**Audit judgment:**

- source verification: `VERIFIED_WITH_CAUTION`;
- market directness: **high**;
- evidence quality: **medium** because it is an undergraduate thesis, single book, restricted full text, and not designed as a full calibration/CLV study;
- transportability: **high current-era relevance**;
- canonical role: direct market context / mixed evidence, not proof of a stable exploitable bias.

Do not transform the finding "performance can deviate materially from the closing prop" into an over/under system. The absence of consistent direction is itself an important caution.

### Papageorgiou / Sarlis / Tjortjis comparative player forecasting

The peer-reviewed *Knowledge and Information Systems* paper is verified as open access, published 2024, comparing 14 ML approaches on 90 high-performance basketball players and multiple player statistics.

**Audit judgment:**

- source verification: `VERIFIED_PRIMARY`;
- market directness: low (player forecasting, not sportsbook prices);
- method quality: medium/high;
- canonical role: **stat-family mechanism** supporting separate points/rebounds/assists error structures;
- must not count as a sportsbook-calibration vote.

### Papageorgiou / Sarlis / Tjortjis individualized DFS forecasting

The peer-reviewed *International Journal of Data Science and Analytics* paper is verified, using individualized NBA player models and multi-season validation.

**Audit judgment:**

- retain as mechanism/methodology;
- overlap cluster with the authors' comparative paper;
- do not count the two papers as two independent pieces of sportsbook evidence;
- DFS profitability language is not transferable to regulated sportsbook prop value.

### Döpke / Köhler / Tegtmeier 2024

Peer-reviewed NBA fantasy-projection evaluation verified. The paper evaluates 1,658 projections from four providers and finds that professional projections improve on naive forecasts only moderately, with some inefficiency/bias and relatively small long-run provider differences.

**Canonical use:** caution against treating a third-party projection as a separate sharp signal merely because it is commercial/professional.

## WNBA audit

Current BALLDONTLIE documentation verifies that WNBA player props are directly observable for points, rebounds, assists, threes and combinations from major books including BetRivers, Caesars, DraftKings, Fanatics and FanDuel. It also exposes historical **opening** player props for the most recently completed/ongoing season where available.

Important semantics:

- live player-prop snapshots are updated in real time;
- the provider states that it does **not** store the complete historical live snapshot stream;
- the separate opening endpoint stores historical opening props;
- opening history is not closing-line history.

**Disposition:** `DATA INFRASTRUCTURE`, not empirical market evidence.

WNBA direct scholarly sportsbook calibration remains a real gap. Do not inherit NBA direct-market grades without an explicit transportability discount.

## NHL audit

### Korkee — exact-stat shots-on-goal forecasting

Aalto institutional metadata verifies the master's thesis target is individual NHL **shots on goal**, using game-by-game player/team data from 2017-18 through 2024-25 and 100 model configurations across five algorithms, sample filters and feature counts.

**Audit judgment:**

- source verification: `VERIFIED_WITH_CAUTION`;
- statistic match: **exact**;
- sportsbook directness: none;
- transportability: high for modern SOG mechanism;
- canonical role: SOG forecastability / methodology.

### Rink effects

Schuckers & Macdonald's rink-effects work is verified as a real methodology paper using six seasons of NHL Real Time Scoring System event counts and reporting persistent rink-to-rink recording effects for multiple event types.

**Audit judgment:**

- retain as historical data-quality caution;
- do not apply a numerical rink adjustment in 2026 without modern replication;
- relevant to SOG/hits/blocks data hygiene rather than a betting edge.

### Goalie hot hand

Ding et al. is verified on 48,431 playoff shots faced by 93 goalies, 2008–2016, using multilevel logistic regression and finding no evidence of a positive hot hand in save probability.

**Audit judgment:**

- useful direct caution against recent-save-percentage streak chasing;
- not a saves-prop pricing study;
- separate expected shot volume from save probability.

### Shooter/goaltender skill-adjusted xG

Noel 2025 preprint is verified as directly modeling both shooter and goaltender skill using NHL spatiotemporal data and evaluating log loss, Brier score and AUC.

**Audit judgment:** mechanism evidence only; useful for goalscorer probability architecture but not direct anytime-goal price calibration.

### Current NHL prop-data path

BALLDONTLIE documentation verifies current NHL player-prop coverage for **shots_on_goal, saves, points, assists, goals and anytime_goal**, with current books including Caesars, DraftKings and FanDuel, plus historical opening-prop endpoint coverage where available.

**Disposition:** strong acquisition path for future own-study collection; not itself a canonical finding.

## NFL audit

### Receiving / catch probability

Deshpande & Evans 2019 is verified as an NFL Big Data Bowl player-tracking study using a Bayesian non-parametric catch-probability model incorporating receiver speed and defender/ball distances.

**Canonical role candidate:** mechanism — target opportunity and catch probability should be modeled separately.

### Receiving-yard / defender context

Yurko, Nguyen & Pelechrinis 2024 *NFL Ghosts* is verified as a tracking-data conditional-density framework modeling receiver yards gained and defender positioning.

**Canonical role candidate:** matchup/context mechanism; not sportsbook calibration.

### Injury / participation caution

A peer-reviewed NFL ACL reconstruction study is verified with 312 players from 2013–2018. It reports 55.8% return to play and substantial post-injury changes in games, snaps and approximate-value performance, with important position differences.

**Canonical role candidate:** participation/role caution only. This cannot become a fixed injury penalty and is not same-week availability evidence.

### Current NFL prop-data path

BALLDONTLIE documentation verifies live NFL player props including passing yards, rushing yards, receiving yards, receptions, rushing attempts, combined rush+receive yards and anytime TD. Historical opening player props are available for recent seasons where offered, but the provider explicitly does not preserve the complete live snapshot history.

**Disposition:** useful collection infrastructure; direct closing-calibration gap remains.

## MLB audit

### Strikeout matchup model

Healey 2015 article identity is verified through IEEE. It is a peer-reviewed batter/pitcher strikeout-probability model using a very large matchup sample.

**Canonical role candidate:** high-quality strikeout mechanism. A game-level K prop still requires expected batters faced, workload/hook risk, lineup identity and a full count distribution.

### Statcast expected statistics

MLB Baseball Savant documentation verifies that xBA/xSLG/xwOBA use exit velocity and launch angle to assign hit probabilities from comparable historical batted balls, combined with actual strikeouts/walks/HBP.

**Canonical role candidate:** official current mechanism/regression anchor for hits/total bases, not a sportsbook-price prior.

### SmartStake 2026 direct player-prop dataset — schema audit

The Hugging Face repository and viewer verify:

- approximately **621 million rows**;
- CC BY 4.0;
- minute-level 2026 quotes;
- markets include total bases, hits, RBIs, home runs, strikeouts and batting walks;
- approximately 75 sportsbooks, exchanges and prediction markets;
- columns include stable game id, start time, player, market, exact line, side, book, quote timestamp, decimal odds, result and win flag;
- March–June contain graded outcomes in the published export; July can contain ungraded/null results;
- source documentation states game-key fragmentation was crosswalked into a stable `game_id` and duplicate identical minute keys were collapsed to the latest quote.

### SmartStake audit implications

This dataset is sufficiently structured to justify a serious v1.8 direct-market study, but **the dataset card is not itself proof of a betting edge or bookmaker ranking**.

Required analysis before canonical promotion:

1. limit to `ts < start_time` for pregame closing analysis;
2. separate sportsbooks from exchanges/prediction markets/DFS products;
3. pair over/under at identical book + market + game + player + line;
4. remove null/void/push rows correctly;
5. verify that line values and result grading are internally coherent by market;
6. treat repeated quote minutes as a price path, not independent observations;
7. construct one closing quote per side/line/book/selection;
8. de-vig two-way markets before Brier/log-loss calibration;
9. do not combine milestone HR prices with two-way O/U as if they share identical probability structure;
10. report sample counts by book and market before comparing sharpness;
11. evaluate book/market performance with uncertainty intervals, not rank tables alone;
12. hold out later calendar periods for genuine temporal validation;
13. compare opening, intermediate and closing calibration separately;
14. check whether player/team lineup news creates structural discontinuities;
15. never use the same data both to discover a filter and claim untouched validation.

### New high-value adjacent dataset found during audit

SmartStake also publishes a 2026 MLB lineup-reaction dataset documenting roughly 85 million rows around 2,456 lineup posts, spanning six prop markets and 73 betting/market sources, with a -5 to +20 minute event window.

**Disposition:** promising **price-discovery / lineup-information** infrastructure candidate. It should be audited separately and must not be folded into the 621M-row dataset as an additional independent evidence vote if both originate from the same underlying odds collection system.

## Source-overlap / double-count rules established by this tranche

1. Repeated staging records of the same DOI/source count once.
2. Two papers from the same author group and methodological lineage may remain distinct but belong to one overlap cluster when they share data/objective lineage.
3. Dataset card + analysis derived from that dataset are not two independent sources.
4. Official league metric + academic model using the same underlying event feed are not automatically independent evidence of sportsbook inefficiency.
5. Opening and closing market evidence are different timing surfaces and must not be blended into one generic "sportsbook line" prior.
6. DFS/Pick'em and regulated sportsbook props remain separate market structures unless direct transportability evidence exists.
7. A correction/corrigendum reduces confidence in exact quantitative claims until corrected results are reconciled.

## First provisional candidate dispositions

### Advance toward canonical candidate construction

- NBA stat-specific player forecastability (mechanism cluster).
- NBA direct FanDuel closing-prop context, with thesis/single-book cap.
- NHL SOG forecastability and usage/context mechanism.
- NHL goalie recency/hot-hand caution.
- NFL receiving catch/opportunity and defender-context mechanisms.
- NFL position-sensitive injury/participation caution.
- MLB strikeout matchup mechanism.
- MLB Statcast contact-quality mechanism.
- MLB direct 2026 player-prop market **dataset infrastructure**, pending reproducible analysis.
- Corrected Shank NFL source metadata for the v1.8 registry build.

### Hold / do not promote exact predictive claims yet

- Walsh/Joshi original ROI magnitudes until corrigendum/corrected implementation is reconciled.
- NFL anytime-TD practitioner profitability claims until line provenance and holdout selection are independently audited.
- NHL public ~5,000 SOG-odds project as a predictive prior until dataset provenance and evaluation are audited.
- any bookmaker "sharpness" ranking from SmartStake until reproduced from the released data.
- WNBA direct calibration claims: insufficient scholarly/direct closing evidence.

## Canonical evidence architecture emerging from Phase 2

Player props should not have one global `player_props` prior. v1.8 should expose sport/stat clusters with two explicitly separate layers:

**Layer A — forecastability / mechanism**  
What makes the player's distribution move: minutes, usage, matchup, role, workload, shot generation, target probability, contact quality, goalie/shooter identity, etc.

**Layer B — market calibration / price evidence**  
Whether posted sportsbook lines/prices are calibrated, where movement occurs, how much hold exists, whether books differ, and whether any observed mispricing survives vig and out-of-sample testing.

A candidate can have strong Layer A evidence while remaining `NR` or limited on Layer B. That distinction is now a mandatory v1.8 design requirement.

## Next heavy-review tranche

Before canonical v1.8 construction, Phase 2 still needs:

- source-by-source DOI/identifier verification for remaining Batch 01 general-market additions;
- full reconciliation of the Walsh/Joshi corrigendum;
- reproducible SmartStake market audit on a manageable sample/partition;
- audit of the NHL ~5,000 SOG-odds project contents and bookmaker/timestamp provenance;
- stronger WNBA direct-price work or explicit retained gap;
- verification of NFL anytime-TD practitioner holdout claims;
- final candidate ledger with `KEEP`, `CROSS_LINK`, `INFRASTRUCTURE`, `CAUTION`, `GAP`, `REJECT` dispositions;
- candidate v1.8 source registry generated without touching the production v1.7 registry.

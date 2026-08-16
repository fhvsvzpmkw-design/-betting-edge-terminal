# Betting Edge Research Library v1.8 — Phase 2 Canonicalization Audit

**Date:** 2026-08-15  
**State:** STAGING / AUDIT ONLY — NOT RUNTIME AUTHORITY  
**Active production library remains:** Research Library v1.7  
**Production manifest remains:** `research/manifest.json`

## Purpose

Phase 1 gathered broadly. Phase 2 now determines what actually deserves canonical v1.8 status.

The work in this phase is to:

1. verify citation and source provenance;
2. deduplicate repeated candidates across discovery batches and against v1.7;
3. separate predictive evidence from methodology, infrastructure and context;
4. assign directness, evidence quality and transportability;
5. identify corrections, corrigenda and stale findings;
6. form conflict/overlap clusters so related studies cannot be double-counted;
7. define a candidate canonical item only after its strongest limitation is explicit;
8. preserve explicit research gaps where direct evidence remains insufficient.

Nothing in this audit changes live History Fit until a later explicit v1.8 promotion.

## Audit status vocabulary

- `VERIFIED_PRIMARY` — citation/identifier and key scope verified at publisher, institutional repository, official league documentation or source dataset.
- `VERIFIED_WITH_CAUTION` — source verified but evidence is indirect, single-book, thesis/practitioner, old-era or otherwise limited.
- `CORRIGENDUM_REVIEW_REQUIRED` — original source exists but a correction/corrigendum must be assessed before canonical use.
- `DATA_AUDIT_REQUIRED` — dataset/source exists, but provenance, identity, timestamp, grading or execution semantics require reproducible validation.
- `CROSS_LINK_ONLY` — useful in another cluster but not a new independent evidence vote.
- `DUPLICATE_STAGING` — same source or same logical evidence already appears elsewhere in v1.8 staging.
- `ALREADY_CANONICAL_V1_7` — source/prior already exists in v1.7; v1.8 may update transportability or interpretation but must not count it again.
- `GAP` — direct evidence still insufficient; preserve NR-capable behavior.

## Evidence-role rule

A source can be important without being an independent predictive prior.

- Direct sportsbook price/outcome evidence may qualify for a direct market prior after audit.
- Player-performance forecasting can support mechanism/forecastability but does not prove sportsbook mispricing.
- Official league metrics can support mechanism and data definition but are not sportsbook calibration studies.
- API documentation and public datasets are research infrastructure unless and until a reproducible analysis produces a validated finding.
- Practitioner models and self-reported profitability remain low-weight until independently reproducible.
- Cross-sport or cross-league analogies require an explicit transportability discount.

## First deduplication pass across Batches 01–06

### Known staging duplicates / cross-links

1. **Walsh & Joshi 2024 calibration-vs-accuracy paper**  
   - Batch 01: `V18-001`  
   - Batch 02: `V18-PROP-NBA-004`  
   - Disposition: one source, one methodological evidence vote. Batch-02 instance is `CROSS_LINK_ONLY`.

2. **Dmochowski 2023 distributional betting framework**  
   - Batch 02: `V18-PROP-NFL-003`  
   - Batch 04: `V18-NFL-PROP-002`  
   - Disposition: one source, one methodological evidence vote. Keep one canonical candidate and cross-link NFL prop clusters.

3. **Wornow 2026 NBA FanDuel closing-prop thesis**  
   - Batch 02: `V18-PROP-NBA-001`  
   - Batch 06: `V18-NBA-PROP-001`  
   - Disposition: Batch 06 is the expanded record; Batch 02 becomes `DUPLICATE_STAGING` / cross-link.

4. **Papageorgiou/Sarlis/Tjortjis NBA forecast work**  
   - Batch 02 contains both the individualized/DFS and comparative-stat forecasting studies.  
   - Batch 06 expands both as `V18-NBA-PROP-002` and `V18-NBA-PROP-003`.  
   - Disposition: retain as two distinct papers, but place in one overlap cluster because authors, basketball forecasting objective and methodological lineage overlap. They do not count as two independent sportsbook-calibration votes.

5. **Noel 2025 shooter/goaltender skill-adjusted xG**  
   - Batch 02: `V18-PROP-NHL-002`  
   - Batch 03: `V18-NHL-GOAL-001`  
   - Disposition: Batch 03 expanded record is canonical candidate; Batch 02 copy is `DUPLICATE_STAGING`.

6. **Macdonald/Lennon/Sturdivant weighted shots**  
   - Batch 02: `V18-PROP-NHL-004`  
   - Batch 03: `V18-NHL-SOG/SAVES-006`  
   - Disposition: one source; Batch 03 expanded record retained.

7. **Doo & Kim 2018 Bayesian batter/pitcher event model**  
   - Batch 02: `V18-PROP-MLB-001`  
   - Batch 05: `V18-MLB-HIT-002`  
   - Disposition: one source; Batch 05 expanded record retained.

8. **Watkins 2020 MLB Statcast dissertation**  
   - Batch 02: `V18-PROP-MLB-002`  
   - Batch 05: `V18-MLB-HIT-003`  
   - Disposition: one source; Batch 05 expanded record retained.

9. **Osborne & Levine 2025 HR park effects**  
   - Batch 02: `V18-PROP-MLB-003`  
   - Batch 05: `V18-MLB-HR-001`  
   - Disposition: one source; Batch 05 expanded record retained.

10. **Sun/Lin/Tsai 2022 MLB HR forecasting**  
    - Batch 02: `V18-PROP-MLB-004`  
    - Batch 05: `V18-MLB-HR-003`  
    - Disposition: one source; Batch 05 expanded record retained.

11. **NBA player absence / betting lines (2015)**  
    - Batch 06: `V18-NBA-ABSENCE-001`  
    - v1.7 source registry already contains DOI `10.1016/j.frl.2015.02.004`, referenced by prior `nba_player_absence`.  
    - Disposition: `ALREADY_CANONICAL_V1_7`. v1.8 may refine transportability/prop relevance but must not count this as a new study.

## Primary-source verification — tranche 1

### A. Walsh & Joshi 2024 — calibration vs accuracy

- DOI: `10.1016/j.mlwa.2024.100539`.
- Publisher record verified in *Machine Learning with Applications*, Volume 16, June 2024, article 100539.
- Scope verified: NBA data, published betting odds, betting experiments, explicit comparison of model selection by calibration versus accuracy.
- Important audit discovery: publisher also lists a 2025 corrigendum, DOI `10.1016/j.mlwa.2025.100627`.
- Status: **`CORRIGENDUM_REVIEW_REQUIRED`**.
- Canonical consequence: do not promote exact ROI/result magnitudes until the corrigendum's effect is understood. The broader methodological proposition may survive, but must be checked against the correction.

### B. Dmochowski 2023 — distributional decision theory

- DOI: `10.1371/journal.pone.0287601`.
- PLOS ONE publisher record verified; peer-reviewed publication dated 2023-06-28.
- Empirical sample verified: 5,412 NFL regular-season games, 2002–2022, spreads/totals with payouts.
- Key scope: quantiles/outcome distribution are required for optimal wager selection; empirical evidence is game-market, not player-prop calibration.
- Status: **`VERIFIED_PRIMARY`** as betting methodology; **not direct prop-market evidence**.
- Proposed role: cross-sport methodological prior on distribution/threshold decisions.

### C. Wornow 2026 — NBA performance vs FanDuel closing props

- Institutional record verified at Claremont McKenna College.
- Scope verified from institutional abstract: FanDuel closing over/under prop lines linked to realized outcomes for 178 NBA players across five stat categories, 2022–2025.
- Study reports greater absolute deviation in legalized markets but no consistent directional over/under bias; points showed the strongest reported effect.
- Full thesis is campus-restricted.
- Status: **`VERIFIED_WITH_CAUTION`**.
- Canonical consequence: strong direct-market relevance, but one-book design, undergraduate thesis status and restricted full-text access prevent automatic high-tier assignment.

### D. Korkee 2025/2026 — NHL SOG forecasting

- Institutional record verified at Aalto University; permanent identifier `URN:NBN:fi:aalto-202601071106`.
- Exact target verified: individual NHL shots on goal.
- Data period verified: 2017-18 through 2024-25.
- Design verified: five algorithms × four filtering approaches × five feature-count settings = 100 models.
- Status: **`VERIFIED_PRIMARY`** for SOG forecast mechanism; **not sportsbook calibration**.
- Canonical consequence: strong support for dedicated SOG forecastability/context cluster, but cannot by itself establish a historical edge at a posted SOG line.

### E. SmartStake 2026 MLB player-prop dataset

- Source dataset verified on Hugging Face under CC BY 4.0.
- Viewer/card reports ~621M rows.
- Schema verified: game id, scheduled start, player, market, line, side, book, timestamp, decimal odds, result and win/loss flag.
- Coverage verified: late March through early July 2026; graded outcomes through June at export time.
- Market families verified: total bases, hits, RBIs, home runs, strikeouts and batting walks.
- Source card documents ~75 sportsbooks/exchanges/prediction markets and a de-drift/dedup process for game identity and minute quotes.
- Status: **`DATA_AUDIT_REQUIRED`** — very high priority.
- Required next checks: sample-level identity audit, sportsbook/exchange separation, push/void handling, closing-quote definition, two-way pairing/de-vig coverage, stale quote handling, same-player same-line duplication and reproducible Brier/log-loss calculations.

### F. Papageorgiou/Sarlis/Tjortjis 2024 comparative basketball forecasting

- DOI `10.1007/s10115-024-02092-9` verified at Springer.
- Peer-reviewed/open-access publication verified.
- Scope verified: 90 high-performance NBA players; 14 ML models; 18 advanced statistics/KPIs; seasons 2019-20 through 2021-22; unseen-data evaluation.
- Important interpretation: model performance differs by target statistic; component-stat forecasting can outperform forecasting an aggregate fantasy metric directly.
- Status: **`VERIFIED_PRIMARY`** for stat-specific forecast mechanism; **not sportsbook calibration**.

### G. Papageorgiou/Sarlis/Tjortjis 2024/2025 individualized NBA DFS forecasting

- DOI `10.1007/s41060-024-00523-y` verified at Springer.
- Peer-reviewed/open-access publication verified.
- Scope verified: individualized models for 203 NBA players; historical data through 2020-21; DFS lineup optimization.
- Status: **`VERIFIED_PRIMARY`** for individualized forecast methodology, but DFS-adjacent and overlapping with the authors' comparative forecasting work.
- Canonical consequence: place in same methodological cluster; do not count as independent evidence that sportsbooks misprice player props.

### H. NFL Next Gen Stats Expected Rushing Yards

- Official NFL source verified.
- Model design verified to produce a full distribution of rushing outcomes rather than only a point estimate, using player-tracking context.
- Status: **`VERIFIED_PRIMARY`** as official league mechanism; **not independent sportsbook evidence**.
- Canonical consequence: supports distributional treatment of rushing-yard and milestone props.

### I. BALLDONTLIE player-prop infrastructure

- NBA, WNBA, NFL, NHL and MLB documentation verifies live player-prop endpoints.
- Documentation also provides separate historical **opening player-prop** endpoints with limited recent-season coverage where available; these require paid/GOAT access.
- Important nuance: the live endpoints state that live prop snapshots are not stored historically, while the opening endpoints preserve historical opening props. Therefore opening-line history must not be described as full historical quote history.
- Status: **`VERIFIED_WITH_CAUTION`** as research infrastructure only.
- Canonical consequence: useful for opening-line identity/book dispersion studies and future collection, but not a production dependency and not a predictive prior.

## Initial evidence-tier direction

No final tiers are assigned yet. The following is a screening direction only.

### Likely higher-value canonical candidates

- peer-reviewed direct betting methodology with clear applicability;
- direct sportsbook prop/outcome studies after source/replication review;
- rigorous sport/stat-specific forecasting with out-of-sample validation, as mechanism evidence;
- reproducible direct-market datasets after audit-derived findings are generated.

### Lower-weight / context candidates

- practitioner models without independent reproduction;
- DFS/Pick'em findings used as sportsbook analogies;
- official league metrics used as mechanism only;
- old-era findings without modern replication;
- injury/medical studies used for participation context rather than numeric same-day adjustments;
- preprints until methods/data and later publication status are reviewed.

## Proposed overlap/conflict clusters to build next

1. `calibration_accuracy_probability_quality`
2. `player_prop_forecast_vs_price_calibration`
3. `nba_stat_specific_forecasting`
4. `nba_wnba_minutes_availability_role_shift`
5. `basketball_combo_prop_dependence`
6. `nhl_player_sog_volume_context_and_price_calibration`
7. `nhl_goalscorer_shooter_goalie_quality`
8. `nhl_goalie_saves_volume_vs_save_probability`
9. `nfl_player_passing_volume_distribution_and_price_calibration`
10. `nfl_player_rushing_usage_distribution_and_price_calibration`
11. `nfl_player_receiving_opportunity_catch_yac_and_price_calibration`
12. `nfl_player_anytime_td_opportunity_and_price_calibration`
13. `mlb_pitcher_strikeout_matchup_workload_and_price_calibration`
14. `mlb_batter_hits_total_bases_contact_quality_and_price_calibration`
15. `mlb_batter_home_run_skill_park_pitcher_and_price_calibration`
16. `direct_prop_market_data_quality_opening_closing_and_book_identity`

## Phase 2 work queue

### P0 — source verification and correction review

- read/resolve the Walsh & Joshi corrigendum before assigning a v1.8 finding;
- verify all DOI/identifier metadata for remaining high-priority candidates;
- audit the suspected v1.7 Shank NFL DOI mismatch and carry a correction forward only in v1.8 provenance;
- mark preprints, practitioner work, theses and official metrics by source class.

### P0 — direct-market dataset audit

Start with SmartStake MLB because it is the richest direct-market dataset found. Produce a reproducible audit design for:

- identity integrity;
- book/source classification;
- exact line pairing;
- no-vig probability construction;
- closing-quote definition;
- push/void treatment;
- calibration by market/book;
- opening-to-closing movement;
- time-to-first-pitch information incorporation.

Do not promote dataset-card claims as canonical findings before this audit.

### P0 — deduplication against v1.7

For each v1.8 candidate:

1. DOI exact match against `research/source-registry.json`;
2. normalized citation/title match when no DOI exists;
3. determine whether it is new evidence, replication, contradiction, extension or merely a cross-link;
4. ensure one independent study gets one vote regardless of how many sport/prop clusters reference it.

### P1 — transportability scoring

For each surviving source, record:

- sample era;
- sport/league;
- exact market/statistic;
- price source if any;
- pregame/live/open/close timing;
- single-book/multi-book/exchange;
- de-vig method;
- out-of-sample/holdout/replication status;
- current 2026 applicability;
- strongest limitation.

### P1 — canonical candidate drafting

Only after verification/deduplication should a source become a proposed v1.8 logical item with:

- unique prior ID;
- source IDs;
- evidence tier;
- confidence;
- History Fit role;
- cluster IDs;
- relationship to v1.7;
- transportability;
- concise finding;
- concise guidance;
- hard runtime boundary.

## Promotion boundary

Phase 2 is complete only when every proposed v1.8 item has traceable source provenance, no duplicate independent votes, an explicit transportability judgment, conflict/overlap membership and a tested History Fit role.

`research/manifest.json`, `research/research-library.json`, `research/source-registry.json`, `research/history-fit-policy.json` and runtime report prompts remain unchanged until explicit v1.8 promotion approval.

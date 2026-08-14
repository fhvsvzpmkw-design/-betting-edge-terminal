# Betting Edge Research Library v1.7 — Canonicalization Report

Built: 2026-08-14T20:06:13Z

## Result

R1 canonicalization completed from all seven source packages.

- Logical source items: **96**
- Primary research priors: **78**
- Question-resolution syntheses: **10**
- Gap-resolution syntheses: **8**
- Deduplicated source-registry records: **73**
- Evidence/conflict clusters: **16**
- Retrieval roles: **74 primary / 21 synthesis / 1 inference**
- Independent-study-weight-eligible A/B/C primary items: **69**
- Items participating in at least one overlap/conflict cluster: **81**

No logical source item was dropped.

## Evidence-tier normalization

{
  "A": 13,
  "B": 43,
  "C": 13,
  "D": 3,
  "GAP": 2,
  "INFERENCE": 1,
  "SYNTHESIS": 21
}

Tier A was **not inferred** for legacy records that lacked an explicit A/B assignment. This prevents canonicalization itself from artificially increasing research confidence.

## History-Fit role normalization

{
  "caution": 13,
  "gap": 10,
  "methodology": 8,
  "mixed": 8,
  "support": 57
}

## Key conflict/overlap resolutions

### Favorite/longshot effects are sport-, book-, and market-dependent

- Relationship: `mixed_by_sport_and_market_structure`
- Members: 12
- Canonical interpretation: Do not apply a universal favorite/longshot correction. Use the direct sport/market evidence first; older MLB/NHL reverse-FLB findings remain historical priors requiring modern validation.

### De-vig and margin allocation

- Relationship: `methodological_progression`
- Members: 9
- Canonical interpretation: Use proportional no-vig as baseline. Where market structure warrants, compare Shin/power/book-aware alternatives. Research may flag method risk but does not silently change the current fair-value model at R3.

### Line movement can contain information and also overreact

- Relationship: `time_horizon_tension_not_binary_conflict`
- Members: 8
- Canonical interpretation: Movement is informative but non-monotonic. Interpret path, reversal, timing and current price rather than treating all steam as truth or all reversals as fades.

### NBA totals findings changed across eras

- Relationship: `later_replication_qualifies_older_thresholds`
- Members: 4
- Canonical interpretation: Older high-total and early-season findings are hypothesis/context only. Modern-era replication weakens transport of fixed historical thresholds; current-era calibration is required.

### NFL efficiency, anomaly fragility, and edge decay

- Relationship: `historically_mixed_with_modern_efficiency_prior`
- Members: 8
- Canonical interpretation: The default NFL prior is high market efficiency and anomaly decay. Older or sample-specific patterns may generate questions but require current price, replication and holdout support.

### Historical NHL reverse-FLB versus modern transportability

- Relationship: `historical_replication_with_modern_transportability_gap`
- Members: 4
- Canonical interpretation: The old NHL anomaly appears historically real, but its modern multi-book transportability is not established. History Fit should preserve both facts.

### NHL totals efficiency

- Relationship: `consistent_caution`
- Members: 2
- Canonical interpretation: NHL totals show some forecastability in historical work but limited easy profitability; treat the market as generally efficient and avoid heuristic systems.

### Boxing has some odds-based research but remains locally calibrated

- Relationship: `later_resolution_qualifies_earlier_gap_language`
- Members: 4
- Canonical interpretation: Later research resolves the strongest version of the gap: serious odds-based academic work exists, but broad boxing efficiency/calibration evidence remains too thin to replace local fight-winner calibration.

### Boxing derivative markets stay separate from fight winner

- Relationship: `consistent_gap`
- Members: 2
- Canonical interpretation: Method, round and total-round derivatives must not inherit fight-winner calibration. Direct local evidence is required.

### CFL pregame evidence gap versus supported live methodology

- Relationship: `market_phase_split`
- Members: 8
- Canonical interpretation: CFL live modeling has supported methodology using pregame market priors, while broad CFL pregame efficiency/calibration remains a local research gap. Do not merge the two.

### Player-prop practitioner evidence versus peer-reviewed research gap

- Relationship: `architecture_support_without_production_prior`
- Members: 5
- Canonical interpretation: Book-aware vig and market separation are useful design guidance, but broad production-grade peer-reviewed prop calibration remains thin. Props do not inherit game-market confidence.

### Player and micro-prop integrity sensitivity

- Relationship: `consistent_risk_evidence`
- Members: 3
- Canonical interpretation: Integrity-sensitive micro/player props deserve explicit caution and stronger verification. This is a risk modifier/context, not a predictive edge.

### Live markets: state updates, surprise response and execution

- Relationship: `complementary_live_microstructure`
- Members: 6
- Canonical interpretation: Live prices can update quickly yet still misreact to surprise; time since event, state, pregame prior and executable liquidity all matter. No static pregame calibration should be transplanted mechanically.

### Probability calibration matters more than raw pick accuracy

- Relationship: `consistent_methodological_support`
- Members: 3
- Canonical interpretation: Evaluate wagering models by probability calibration, Brier/log loss, CLV and EV rather than pick percentage alone.

### Home advantage is contextual, not a universal betting boost

- Relationship: `consistent_caution`
- Members: 3
- Canonical interpretation: Home effects belong inside sport- and matchup-specific fair value; generic home or home-dog boosts are not justified.

### Soccer market information, dispersion and bookmaker behavior

- Relationship: `complementary_market_structure`
- Members: 8
- Canonical interpretation: Soccer prices are highly informative but calibration varies by league, book and market structure. Best-price/consensus information and model-versus-market comparison are more useful than generic soccer trends.

## Important non-conflicts

Several findings that initially look contradictory are deliberately treated as conditional rather than mutually exclusive:

- Closing-line information and short-run movement overreaction can both be true at different horizons.
- Historical NHL reverse-FLB evidence can be real while modern transportability remains uncertain.
- A player-prop practitioner study can be useful architecture evidence while broad peer-reviewed prop calibration remains a research gap.
- CFL live methodology can be supported while CFL pregame efficiency remains a local-calibration gap.

## Legacy-policy handling

Archived source packages contain older configuration language, including Shadow-oriented sequencing. Those files are preserved only for provenance. They are not active R1/R2 policy.

Current research-use authority is:

1. Betting Edge Contract draft v0.7;
2. `history-fit-policy.json`;
3. the canonical Research Library and taxonomy.

## Validation gates run

- all seven expected packages present;
- package item counts equal 28 + 13 + 12 + 15 + 10 + 10 + 8 = 96;
- all 96 canonical `priorId` values unique;
- every source reference in the canonical library resolves in `source-registry.json`;
- every evidence-cluster member resolves to a canonical item;
- synthesis records are marked non-independent;
- runtime boundaries prohibit Research Library writes and direct recommendation mutation at R3;
- archived source configs are explicitly non-authoritative.

## Retrieval-role correction

The source set itself labels three v1.3 records as `SYNTHESIS` and one as `INFERENCE`. Canonical v1.7 preserves those roles rather than promoting them to independent studies. Together with the 18 v1.5/v1.6 resolution records, this prevents resolution/gap material from being double-counted against the underlying studies.

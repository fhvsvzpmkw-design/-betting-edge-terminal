#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

DATE = "2026-08-15"
FREEZE_ID = "v1.8-candidate-freeze-2026-08-15-r1"
ROOT = Path(__file__).resolve().parents[2]
STAGING = ROOT / "research" / "staging"

OVERLAY = STAGING / "V1_8_CANONICAL_CANDIDATE_OVERLAY_2026-08-15.json"
MLB_HOLDOUT = STAGING / "V1_8_MLB_SOURCE_HOLDOUT_RESULTS.json"

OUT_FREEZE = STAGING / "V1_8_CANDIDATE_FREEZE_R1_2026-08-15.json"
OUT_REGISTRY = STAGING / "V1_8_CANDIDATE_SOURCE_REGISTRY_DELTA_R1_2026-08-15.json"
OUT_CLUSTERS = STAGING / "V1_8_CANDIDATE_EVIDENCE_CLUSTERS_R1_2026-08-15.json"
OUT_CHECKSUMS = STAGING / "V1_8_CANDIDATE_FREEZE_CHECKSUMS_R1_2026-08-15.json"
OUT_README = STAGING / "V1_8_CANDIDATE_FREEZE_R1_2026-08-15.md"

BASE = {
    "researchLibrary": {
        "path": "research/research-library.json",
        "version": "1.7",
        "blobSha": "ade09ebcc4760cc4dfc06cba7dc73ba3c514980e",
    },
    "sourceRegistry": {
        "path": "research/source-registry.json",
        "version": "1.7",
        "blobSha": "58430c2f667ce0d6ded5330d3699b88643449cf7",
    },
    "taxonomy": {
        "path": "research/taxonomy.json",
        "version": "1.7",
        "blobSha": "e86e5e64089e2ab7f31f38972066de4110f5fb3d",
    },
}

# Candidate-freeze tiers are deliberately conservative. v1.7 defines A as a
# replicated/consistent body; the discovery overlay used some provisional A
# labels for very strong single studies, so those are frozen as B here.
TIER_OVERRIDE = {
    "v18_parlay_contract_choice_margin": "B",
    "v18_soccer_market_structure_1x2_vs_asian_handicap": "B",
    "v18_tennis_replication_bad_odds_transportability": "B",
    "v18_football_key_numbers_demand_not_information": "B",
}

ROLE_MAP = {
    "primary": "mixed",
    "direct_mixed": "mixed",
    "mechanism": "support",
    "mechanism_cluster": "support",
    "context": "methodology",
    "methodology": "methodology",
    "caution": "caution",
    "gap": "gap",
    "transportability_caution": "caution",
}

MARKET_MAP = {
    "game_market_behavior": ["market_structure", "line_movement"],
    "parlay_contract_structure": ["derivatives", "market_structure"],
    "1x2_asian_handicap": ["market_structure", "market_efficiency"],
    "moneyline_strategy_replication": ["market_efficiency", "data_provenance"],
    "bookmaker_microstructure": ["market_structure", "line_movement"],
    "totals_spreads_behavior": ["totals", "spread", "line_movement"],
    "point_spread_key_numbers": ["spread", "line_movement", "market_structure"],
    "market_regime": ["market_structure", "general_research"],
    "player_props": ["player_props"],
    "points_rebounds_assists": ["player_props", "model_evaluation"],
    "shots_on_goal": ["player_props", "model_evaluation"],
    "goalie_saves": ["player_props"],
    "receptions_receiving_yards": ["player_props", "model_evaluation"],
    "pitcher_strikeouts": ["player_props", "model_evaluation"],
    "hits_total_bases": ["player_props"],
}

SOURCE_DEFS = [
    ("v18src_fodor_patterson_shank_2025", "Fodor, Patterson & Shank (2025), Anchoring bias in the NFL gambling market, Economics Letters 250, 112288", "10.1016/j.econlet.2025.112288", "doi", "peer_reviewed", ["v18_nfl_anchoring_preseason_closing_prices"]),
    ("v18src_borghesi_salaga_williams_mondello_2026", "Borghesi, Salaga, Williams & Mondello (2026), Contract choice, parlay adoption, and sportsbook margins, Finance Research Letters 105, 110218", "10.1016/j.frl.2026.110218", "doi", "peer_reviewed", ["v18_parlay_contract_choice_margin"]),
    ("v18src_hegarty_whelan_2025", "Hegarty & Whelan (2025), Forecasting soccer matches with betting odds: A tale of two markets, International Journal of Forecasting 41(2), 803–820", "10.1016/j.ijforecast.2024.06.013", "doi", "peer_reviewed", ["v18_soccer_market_structure_1x2_vs_asian_handicap"]),
    ("v18src_clegg_cartlidge_2025", "Clegg & Cartlidge (2025), Not feeling the buzz: Correction study of mispricing and inefficiency in online sportsbooks, International Journal of Forecasting 41(2), 798–802", "10.1016/j.ijforecast.2024.06.012", "doi", "peer_reviewed_correction_replication", ["v18_tennis_replication_bad_odds_transportability"]),
    ("v18src_montone_2021", "Montone (2021), Optimal pricing in the online betting market, Journal of Economic Behavior & Organization 186, 344–363", "10.1016/j.jebo.2021.04.007", "doi", "peer_reviewed", ["v18_online_bookmaker_orderflow_price_adjustment"]),
    ("v18src_nofsinger_shank_2023", "Nofsinger & Shank (2023), Momentum trading in the NFL gambling market, Finance Research Letters 55, 104006", "10.1016/j.frl.2023.104006", "doi", "peer_reviewed", ["v18_nfl_totals_momentum_behavior"]),
    ("v18src_fodor_onuk_shank_2026", "Fodor, Onuk & Shank (2026), Do economically meaningful quote differences convey private information?, Finance Research Letters 104, 110193", "10.1016/j.frl.2026.110193", "doi", "peer_reviewed", ["v18_football_key_numbers_demand_not_information"]),
    ("v18src_baker_balthrop_johnson_kotter_pisciotta_2026", "Baker, Balthrop, Johnson, Kotter & Pisciotta (2026), Retail Betting Markets, NBER Working Paper 35520", "10.3386/w35520", "doi", "working_paper_review", ["v18_retail_betting_market_regime"]),
    ("v18src_wornow_2026", "Wornow (2026), Betting on Performance: Sports Betting Legalization and NBA Player Performance Relative to Sportsbook Expectations, Claremont McKenna Senior Thesis 4171", "CMC Senior Theses 4171", "institutional_thesis_id", "undergraduate_thesis", ["v18_nba_player_prop_closing_context"]),
    ("v18src_papageorgiou_sarlis_tjortjis_2024", "Papageorgiou, Sarlis & Tjortjis (2024), Evaluating the effectiveness of machine learning models for performance forecasting in basketball", "10.1007/s10115-024-02092-9", "doi", "peer_reviewed", ["v18_nba_stat_specific_forecastability"]),
    ("v18src_korkee_2026", "Korkee (2025/2026), Using machine learning for player performance prediction in ice hockey games, Aalto University master's thesis", "URN:NBN:fi:aalto-202601071106", "urn", "masters_thesis", ["v18_nhl_sog_forecastability"]),
    ("v18src_ding_cribben_ingolfsson_tran_2021", "Ding, Cribben, Ingolfsson & Tran (2021), Do NHL goalies get hot in the playoffs?", "arXiv:2102.09689", "arxiv", "academic_preprint", ["v18_nhl_goalie_hot_hand_caution"]),
    ("v18src_deshpande_evans_2019", "Deshpande & Evans (2019), Expected Hypothetical Completion Probability", "arXiv:1910.12337", "arxiv", "academic_preprint", ["v18_nfl_receiving_target_catch_context"]),
    ("v18src_yurko_nguyen_pelechrinis_2024", "Yurko, Nguyen & Pelechrinis (2024), NFL Ghosts", "arXiv:2406.17220", "arxiv", "academic_preprint", ["v18_nfl_receiving_target_catch_context"]),
    ("v18src_healey_2015", "Healey (2015), Modeling the Probability of a Strikeout for a Batter/Pitcher Matchup", "10.1109/TKDE.2015.2416735", "doi", "peer_reviewed", ["v18_mlb_pitcher_k_matchup_mechanism"]),
    ("v18src_mlb_statcast_expected_stats", "MLB Baseball Savant, Statcast Expected Statistics", "baseballsavant.mlb.com/expected_statistics", "official_web_resource", "official_league_metric", ["v18_mlb_hits_total_bases_contact_quality"]),
    ("v18src_smartstake_mlb_2026", "SmartStake MLB Player Prop Odds and Results (2026), immutable dataset revision 049dd4caeb562010a5806207c413e9f9bc012825", "SmartStake/mlb-player-props@049dd4caeb562010a5806207c413e9f9bc012825", "dataset_revision", "audited_direct_market_dataset", ["v18_mlb_no_universal_prop_recalibration", "v18_mlb_walks_rbis_limited_recalibration_signal"]),
]

DEFERRED_SOURCE_DEFS = [
    ("v18src_pitcan_2026", "Pitcan (2026), Does a Structural Model Add Anything to the Closing Price?", "arXiv:2608.11505", "arxiv", "academic_preprint", ["v18_closing_price_incremental_information_test"], "deferred"),
    ("v18src_clegg_song_cartlidge_2026", "Clegg, Song & Cartlidge (2026), A market-calibrated accelerated failure time model for in-play football forecasting", "arXiv:2605.16066", "arxiv", "academic_preprint", ["v18_inplay_market_calibration_state_update"], "deferred"),
    ("v18src_moshrefi_2026", "Moshrefi (2026), Prices, Probabilities, and Parlays: Systematic Bias in Sports Prediction Markets", "arXiv:2607.14430", "arxiv", "academic_preprint_prediction_market", ["v18_prediction_market_time_and_parlay_calibration"], "deferred"),
    ("v18src_walsh_joshi_2024", "Walsh & Joshi (2024), Machine learning for sports betting: Should model selection be based on accuracy or calibration?, Machine Learning with Applications 16, 100539", "10.1016/j.mlwa.2024.100539", "doi", "peer_reviewed_with_corrigendum", ["v18_walsh_joshi_calibration_corrigendum_hold"], "hold"),
    ("v18src_walsh_joshi_corrigendum_2025", "Walsh & Joshi (2025), Corrigendum to Machine learning for sports betting: Should model selection be based on accuracy or calibration?", "10.1016/j.mlwa.2025.100627", "doi", "peer_reviewed_corrigendum", ["v18_walsh_joshi_calibration_corrigendum_hold"], "hold"),
]

SOURCE_ID_BY_ITEM = {}
for row in SOURCE_DEFS + [x[:6] for x in DEFERRED_SOURCE_DEFS]:
    sid, _, _, _, _, refs = row
    for ref in refs:
        SOURCE_ID_BY_ITEM.setdefault(ref, []).append(sid)


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, obj):
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def sha256(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def normalize_overlay_item(item):
    role = ROLE_MAP.get(item.get("role"), item.get("role", "mixed"))
    tier = TIER_OVERRIDE.get(item["id"], item.get("provisionalTier"))
    source_ids = SOURCE_ID_BY_ITEM.get(item["id"], [])
    independent = tier in {"A", "B", "C"} and role != "gap"
    if item["id"] in {"v18_retail_betting_market_regime", "v18_mlb_hits_total_bases_contact_quality"}:
        independent = False
    return {
        "id": item["id"],
        "sport": item.get("sport"),
        "marketClassDetail": item.get("marketClass"),
        "taxonomyMarketClasses": MARKET_MAP.get(item.get("marketClass"), ["general_research"]),
        "timing": ["pregame"] if item.get("marketClass") not in {"bookmaker_microstructure", "market_regime"} else ["all"],
        "historyFitRole": role,
        "tier": tier,
        "sourceIds": source_ids,
        "directness": item.get("directness"),
        "transportability": item.get("transportability"),
        "finding": item.get("canonicalClaim"),
        "limitation": item.get("strongestLimitation"),
        "independentStudyWeightEligible": independent,
    }


def mlb_metric(holdout, market):
    for row in holdout["primaryHoldoutResults"]:
        if row["market"] == market:
            return row
    raise KeyError(market)


def build():
    overlay = load(OVERLAY)
    holdout = load(MLB_HOLDOUT)

    admitted = []
    deferred = []
    for item in overlay["items"]:
        if item.get("promotionEligible"):
            admitted.append(normalize_overlay_item(item))
        else:
            deferred.append({
                "id": item["id"],
                "sourceIds": SOURCE_ID_BY_ITEM.get(item["id"], []),
                "reason": item.get("strongestLimitation") or "Not promotion-eligible at candidate freeze.",
            })

    # The raw SmartStake dataset candidate is infrastructure, not a logical prior.
    admitted = [x for x in admitted if x["id"] != "v18_mlb_direct_market_dataset"]
    deferred = [x for x in deferred if x["id"] != "v18_mlb_direct_market_dataset"]

    no_universal = {
        "id": "v18_mlb_no_universal_prop_recalibration",
        "sport": "MLB",
        "marketClassDetail": "hits_total_bases_home_runs_strikeouts",
        "taxonomyMarketClasses": ["player_props", "market_efficiency", "model_evaluation"],
        "timing": ["pregame"],
        "historyFitRole": "caution",
        "tier": "C",
        "sourceIds": ["v18src_smartstake_mlb_2026"],
        "directness": "audited_multi_source_closing_calibration_holdout",
        "transportability": "high_2026_partial_season",
        "finding": "March-May calibration adjustments did not generalize to the untouched June holdout for total bases, hits, home runs or pitcher strikeouts; do not apply a universal historical over/under correction across MLB prop families.",
        "limitation": "One partial season, correlated cross-book observations, provider game-key crosswalk not independently reconstructible, and no next-season replication.",
        "independentStudyWeightEligible": True,
        "holdoutEvidence": {m: mlb_metric(holdout, m) for m in ["player bases", "player hits", "player home runs", "player strikeouts"]},
    }
    walks_rbi = {
        "id": "v18_mlb_walks_rbis_limited_recalibration_signal",
        "sport": "MLB",
        "marketClassDetail": "batting_walks_rbis",
        "taxonomyMarketClasses": ["player_props", "market_efficiency"],
        "timing": ["pregame"],
        "historyFitRole": "mixed",
        "tier": "C",
        "sourceIds": ["v18src_smartstake_mlb_2026"],
        "directness": "audited_multi_source_closing_calibration_holdout",
        "transportability": "high_2026_partial_season",
        "finding": "March-May logistic recalibration improved both Brier score and log loss on the untouched June holdout for batting walks and RBIs; preserve only as a limited market-specific calibration signal.",
        "limitation": "One partial season; no independent dataset or next-season replication; not an executable betting-profit result.",
        "independentStudyWeightEligible": False,
        "holdoutEvidence": {m: mlb_metric(holdout, m) for m in ["player batting walks", "player rbis"]},
    }
    admitted.extend([no_universal, walks_rbi])

    # Replace generic deferred reasons with the audited dispositions where useful.
    deferred_reason = {
        "v18_closing_price_incremental_information_test": "Recent preprint retained as methodology candidate but not promotion-eligible before replication/peer review.",
        "v18_inplay_market_calibration_state_update": "Recent preprint retained as methodology candidate; reported profitability remains quarantined pending replication and correlated-bet treatment.",
        "v18_prediction_market_time_and_parlay_calibration": "Prediction-market evidence has low-to-medium sportsbook transportability and remains deferred from canonical sportsbook evidence.",
        "v18_walsh_joshi_calibration_corrigendum_hold": "Published corrigendum and corrected implementation block unreconciled quantitative claims.",
    }
    for row in deferred:
        if row["id"] in deferred_reason:
            row["reason"] = deferred_reason[row["id"]]

    admitted.sort(key=lambda x: x["id"])
    deferred.sort(key=lambda x: x["id"])

    freeze = {
        "schema": 1,
        "freezeId": FREEZE_ID,
        "targetLibraryVersion": "1.8",
        "state": "STAGING_CANDIDATE_FREEZE_R1",
        "runtimeAuthority": False,
        "activeProductionLibrary": "1.7",
        "generatedDate": DATE,
        "baseArtifacts": BASE,
        "taxonomyExtensionsRequired": {"sports": ["WNBA"], "marketClassDetailsAreNonControlledMetadata": True},
        "freezePolicy": {
            "discoveryPhaseClosed": True,
            "newDiscoveryAfterFreeze": "Only blocking correction, replication, or provenance issue; otherwise defer to v1.9.",
            "sameSourceCountsOnce": True,
            "mechanismDoesNotProveMarketMispricing": True,
            "gapsSupportNRNotNegativePrediction": True,
            "infrastructureDoesNotCountAsPredictiveEvidence": True,
            "crossSportAndCrossMarketTransportRequiresDiscount": True,
            "runtimeWritesAllowed": False,
            "productionManifestMayChange": False,
        },
        "counts": {
            "admittedLogicalItems": len(admitted),
            "gapItems": sum(1 for x in admitted if x["tier"] == "GAP"),
            "independentStudyWeightEligibleItems": sum(1 for x in admitted if x["independentStudyWeightEligible"]),
            "deferredItems": len(deferred),
        },
        "items": admitted,
        "deferredItems": deferred,
        "nextGates": [
            "Materialize merged v1.8 candidate library from immutable v1.7 base plus this frozen delta.",
            "Materialize corrected merged v1.8 source registry from immutable v1.7 registry plus frozen source-registry delta.",
            "Run cross-sport History Fit retrieval suite against the frozen candidate build.",
            "Re-prove R3 hard boundaries and failure isolation.",
            "Generate final candidate checksums and compare against freeze checksums.",
            "Require explicit approval before changing research/manifest.json.",
        ],
    }

    source_rows = []
    for sid, citation, ident, ident_type, cls, refs in SOURCE_DEFS:
        rec = {
            "sourceId": sid,
            "canonicalCitation": citation,
            "identifier": ident,
            "identifierType": ident_type,
            "sourceClass": cls,
            "referencedBy": refs,
        }
        if sid == "v18src_smartstake_mlb_2026":
            rec["auditArtifacts"] = [
                "research/staging/V1_8_SMARTSTAKE_MLB_AUDIT_RESULTS.json",
                "research/staging/V1_8_MLB_SOURCE_HOLDOUT_RESULTS.json",
            ]
        source_rows.append(rec)
    for sid, citation, ident, ident_type, cls, refs, status in DEFERRED_SOURCE_DEFS:
        source_rows.append({
            "sourceId": sid,
            "canonicalCitation": citation,
            "identifier": ident,
            "identifierType": ident_type,
            "sourceClass": cls,
            "referencedBy": refs,
            "status": status,
        })

    registry = {
        "schema": 1,
        "freezeId": FREEZE_ID,
        "targetLibraryVersion": "1.8",
        "state": "STAGING_FROZEN_SOURCE_REGISTRY_DELTA_R1",
        "runtimeAuthority": False,
        "baseRegistry": BASE["sourceRegistry"],
        "deduplicationRule": "DOI first when present; otherwise durable identifier; same source counts once even when referenced by multiple logical items.",
        "corrections": [{
            "baseSourceId": "src_doi_8fdd5392b1f6",
            "baseIdentifier": "10.1016/j.jbef.2022.100742",
            "correctedIdentifier": "10.1016/j.jbef.2022.100758",
            "canonicalCitation": "Shank (2022), Information asymmetry in the NFL gambling market: Inside information versus informed bettors",
            "actionAtMaterialization": "Carry corrected DOI into v1.8 merged registry with provenance note; do not mutate v1.7.",
        }],
        "newSources": source_rows,
        "counts": {
            "newSources": len(source_rows),
            "corrections": 1,
            "admittedSources": len(SOURCE_DEFS),
            "deferredOrHoldSources": len(DEFERRED_SOURCE_DEFS),
        },
    }

    clusters = {
        "schema": 1,
        "freezeId": FREEZE_ID,
        "targetLibraryVersion": "1.8",
        "state": "STAGING_FROZEN_EVIDENCE_CLUSTERS_R1",
        "runtimeAuthority": False,
        "baseTaxonomy": BASE["taxonomy"],
        "clusters": {
            "v18_market_structure_transportability": {
                "title": "Market structure changes what price behavior means",
                "members": ["v18_soccer_market_structure_1x2_vs_asian_handicap", "v18_online_bookmaker_orderflow_price_adjustment", "v18_retail_betting_market_regime", "v18_football_key_numbers_demand_not_information"],
                "relationship": "structure_and_demand_can_change_calibration_without_implying_information",
                "canonicalInterpretation": "Match the historical prior to the actual price architecture and market regime. Movement, favorite/longshot behavior, and threshold demand should not be transferred mechanically across products.",
            },
            "v18_replication_data_quality": {
                "title": "Replication and data quality outrank headline profitability",
                "members": ["v18_tennis_replication_bad_odds_transportability", "v18_mlb_no_universal_prop_recalibration"],
                "relationship": "out_of_sample_and_data_quality_guardrail",
                "canonicalInterpretation": "A historical betting pattern is not transportable until data integrity and later-period behavior survive. Large samples do not rescue a correction that fails forward holdout.",
            },
            "v18_nfl_market_behavior": {
                "title": "NFL demand behavior is not equivalent to edge",
                "members": ["v18_nfl_anchoring_preseason_closing_prices", "v18_nfl_totals_momentum_behavior", "v18_football_key_numbers_demand_not_information"],
                "relationship": "behavioral_effects_with_efficiency_caution",
                "canonicalInterpretation": "Anchoring, momentum, and key-number demand can move NFL prices without providing a robust automatic betting signal. Current price and candidate-specific evidence remain primary.",
            },
            "v18_player_prop_directness_boundary": {
                "title": "Player forecastability and sportsbook calibration are separate evidence layers",
                "members": ["v18_nba_player_prop_closing_context", "v18_nba_stat_specific_forecastability", "v18_wnba_direct_prop_calibration_gap", "v18_nhl_sog_forecastability", "v18_nhl_goalie_hot_hand_caution", "v18_nfl_receiving_target_catch_context", "v18_nfl_direct_player_prop_calibration_gap", "v18_mlb_pitcher_k_matchup_mechanism", "v18_mlb_hits_total_bases_contact_quality", "v18_mlb_no_universal_prop_recalibration", "v18_mlb_walks_rbis_limited_recalibration_signal"],
                "relationship": "mechanism_does_not_imply_mispricing",
                "canonicalInterpretation": "Use mechanism evidence to judge whether a player/stat forecast is well grounded. Use direct market evidence separately to judge historical price calibration. Never promote mechanism evidence into a price edge.",
            },
            "v18_mlb_prop_calibration": {
                "title": "MLB player props are price-first and market-specific",
                "members": ["v18_mlb_pitcher_k_matchup_mechanism", "v18_mlb_hits_total_bases_contact_quality", "v18_mlb_no_universal_prop_recalibration", "v18_mlb_walks_rbis_limited_recalibration_signal"],
                "relationship": "mechanism_plus_forward_holdout_direct_market_evidence",
                "canonicalInterpretation": "Strikeouts, hits, home runs and total bases do not justify a broad historical correction after forward holdout. Walks and RBIs retain only a limited, cautious calibration signal. Candidate-specific current pricing remains decisive.",
            },
            "v18_nhl_prop_mechanisms": {
                "title": "NHL props require stat-specific mechanism evidence",
                "members": ["v18_nhl_sog_forecastability", "v18_nhl_goalie_hot_hand_caution"],
                "relationship": "stat_specific_mechanism_with_direct_price_gap",
                "canonicalInterpretation": "SOG can use role/context forecastability; goalie saves should separate volume from save efficiency and avoid hot-hand assumptions. Direct closing-price calibration remains thinner than mechanism evidence.",
            },
            "v18_nba_wnba_prop_transportability": {
                "title": "NBA player-prop evidence does not automatically transport to WNBA",
                "members": ["v18_nba_player_prop_closing_context", "v18_nba_stat_specific_forecastability", "v18_wnba_direct_prop_calibration_gap"],
                "relationship": "same_sport_family_cross_league_transport_gap",
                "canonicalInterpretation": "NBA evidence supports stat-specific basketball modeling and rejects a simple universal directional bias, but WNBA direct closing-price calibration remains an explicit gap.",
            },
            "v18_nfl_prop_transportability": {
                "title": "NFL player-stat mechanisms are stronger than direct prop calibration",
                "members": ["v18_nfl_receiving_target_catch_context", "v18_nfl_direct_player_prop_calibration_gap"],
                "relationship": "mechanism_strong_direct_market_gap",
                "canonicalInterpretation": "Target opportunity, catch probability, defender context and yardage distribution can improve receiving analysis, but History Fit should remain NR/caveated when asked for broad direct sportsbook-prop calibration.",
            },
            "v18_parlay_margin_structure": {
                "title": "Multi-leg products carry structural margin caution",
                "members": ["v18_parlay_contract_choice_margin", "v18_retail_betting_market_regime"],
                "relationship": "transaction_margin_plus_regime_context",
                "canonicalInterpretation": "Parlay/SGP products should receive explicit margin and dependence caution. Large historical hold does not itself define the fair price of a specific multi-leg wager.",
            },
        },
    }

    write_json(OUT_FREEZE, freeze)
    write_json(OUT_REGISTRY, registry)
    write_json(OUT_CLUSTERS, clusters)

    checksum_obj = {
        "schema": 1,
        "freezeId": FREEZE_ID,
        "state": "STAGING_FREEZE_CHECKSUMS_R1",
        "algorithm": "sha256",
        "files": [
            {"path": str(p.relative_to(ROOT)), "sha256": sha256(p), "bytes": p.stat().st_size}
            for p in [OUT_FREEZE, OUT_REGISTRY, OUT_CLUSTERS]
        ],
    }
    write_json(OUT_CHECKSUMS, checksum_obj)

    readme = f"""# Betting Edge Research Library v1.8 — Candidate Freeze R1

**Date:** {DATE}  
**Freeze ID:** `{FREEZE_ID}`  
**State:** STAGING CANDIDATE FREEZE — NOT RUNTIME AUTHORITY  
**Active production library remains:** v1.7

## Frozen scope

- Admitted v1.8 logical delta items: **{freeze['counts']['admittedLogicalItems']}**
- Explicit gap items: **{freeze['counts']['gapItems']}**
- Independent-study-weight-eligible delta items: **{freeze['counts']['independentStudyWeightEligibleItems']}**
- Deferred/hold logical items: **{freeze['counts']['deferredItems']}**
- New source-registry records: **{registry['counts']['newSources']}**
- Source correction records: **1**
- New v1.8 evidence clusters: **{len(clusters['clusters'])}**

## What this freeze means

Discovery is closed for v1.8 except a blocking citation/provenance correction or replication issue. New interesting research that is not required to fix the frozen build should move to v1.9 rather than silently changing this candidate set.

The freeze incorporates the completed MLB direct-market audit and forward holdout. It preserves the conclusion that no universal MLB prop recalibration survived across total bases, hits, home runs and pitcher strikeouts, while walks and RBIs retain only a limited C-tier mixed signal.

Strong single studies that carried provisional A labels during discovery are frozen conservatively at B because the v1.7 taxonomy reserves A for replicated/consistent evidence bodies.

## Files

- `research/staging/V1_8_CANDIDATE_FREEZE_R1_2026-08-15.json`
- `research/staging/V1_8_CANDIDATE_SOURCE_REGISTRY_DELTA_R1_2026-08-15.json`
- `research/staging/V1_8_CANDIDATE_EVIDENCE_CLUSTERS_R1_2026-08-15.json`
- `research/staging/V1_8_CANDIDATE_FREEZE_CHECKSUMS_R1_2026-08-15.json`

## Hard boundary

Nothing here is linked to `research/manifest.json`, scheduled report prompts, the runner, odds workflows, the production contract, or live History Fit. Production v1.7 remains authoritative until retrieval tests, R3 boundary proof, checksum verification, and explicit promotion approval are complete.

## Next gate

Materialize a merged v1.8 candidate library and corrected source registry from the immutable v1.7 base plus this frozen delta, then run the broad cross-sport History Fit retrieval suite.
"""
    OUT_README.write_text(readme, encoding="utf-8")

    print(json.dumps({
        "freezeId": FREEZE_ID,
        "admitted": freeze["counts"]["admittedLogicalItems"],
        "deferred": freeze["counts"]["deferredItems"],
        "sources": registry["counts"]["newSources"],
        "clusters": len(clusters["clusters"]),
        "outputs": [str(p.relative_to(ROOT)) for p in [OUT_FREEZE, OUT_REGISTRY, OUT_CLUSTERS, OUT_CHECKSUMS, OUT_README]],
    }, indent=2))


if __name__ == "__main__":
    build()

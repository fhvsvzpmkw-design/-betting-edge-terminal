#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

DATE = "2026-08-15"
FREEZE_ID = "v1.8-candidate-freeze-2026-08-15-r2"
ROOT = Path(__file__).resolve().parents[2]
STAGING = ROOT / "research" / "staging"

R1_FREEZE = STAGING / "V1_8_CANDIDATE_FREEZE_R1_2026-08-15.json"
R1_REGISTRY = STAGING / "V1_8_CANDIDATE_SOURCE_REGISTRY_DELTA_R1_2026-08-15.json"
R1_CLUSTERS = STAGING / "V1_8_CANDIDATE_EVIDENCE_CLUSTERS_R1_2026-08-15.json"
LEDGER = STAGING / "V1_8_PHASE_2_CANDIDATE_LEDGER_2026-08-15.json"

OUT_FREEZE = STAGING / "V1_8_CANDIDATE_FREEZE_R2_2026-08-15.json"
OUT_REGISTRY = STAGING / "V1_8_CANDIDATE_SOURCE_REGISTRY_DELTA_R2_2026-08-15.json"
OUT_CLUSTERS = STAGING / "V1_8_CANDIDATE_EVIDENCE_CLUSTERS_R2_2026-08-15.json"
OUT_RECON = STAGING / "V1_8_CANDIDATE_FREEZE_R2_RECONCILIATION_2026-08-15.json"
OUT_CHECKSUMS = STAGING / "V1_8_CANDIDATE_FREEZE_CHECKSUMS_R2_2026-08-15.json"
OUT_README = STAGING / "V1_8_CANDIDATE_FREEZE_R2_2026-08-15.md"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, obj):
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def sha256(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


ADDED_ITEMS = [
    {
        "id": "v18_nba_individualized_forecast_methodology",
        "sport": "NBA",
        "marketClassDetail": "player_specific_forecasting",
        "taxonomyMarketClasses": ["player_props", "model_evaluation"],
        "timing": ["pregame"],
        "historyFitRole": "methodology",
        "tier": "B",
        "sourceIds": ["v18src_papageorgiou_sarlis_tjortjis_2025"],
        "directness": "player_forecast_mechanism_dfs_adjacent",
        "transportability": "medium",
        "finding": "Player-specific model choice and training-window design can materially affect NBA player-stat forecasting; individualized forecast architecture may be useful, but DFS performance does not establish sportsbook prop mispricing.",
        "limitation": "Overlaps author/method lineage with the 2024 Papageorgiou/Sarlis/Tjortjis forecasting paper and is DFS-adjacent rather than direct sportsbook-price evidence.",
        "independentStudyWeightEligible": False,
    },
    {
        "id": "v18_nba_external_projection_caution",
        "sport": "NBA",
        "marketClassDetail": "third_party_player_projections",
        "taxonomyMarketClasses": ["player_props", "model_evaluation"],
        "timing": ["pregame"],
        "historyFitRole": "caution",
        "tier": "B",
        "sourceIds": ["v18src_dopke_kohler_tegtmeier_2024"],
        "directness": "forecast_quality_caution",
        "transportability": "medium",
        "finding": "Professional basketball projection providers should not be treated as automatically sharp independent signals; published evidence shows only moderate improvement over naive forecasts and heterogeneous forecast quality.",
        "limitation": "Fantasy-projection evidence, not regulated sportsbook closing-prop calibration.",
        "independentStudyWeightEligible": True,
    },
    {
        "id": "v18_nhl_rink_recording_data_quality_caution",
        "sport": "NHL",
        "marketClassDetail": "event_count_recording_effects",
        "taxonomyMarketClasses": ["player_props", "data_provenance"],
        "timing": ["all"],
        "historyFitRole": "caution",
        "tier": "C",
        "sourceIds": ["v18src_schuckers_macdonald_2014"],
        "directness": "data_quality_caution",
        "transportability": "medium_low_until_modern_replication",
        "finding": "Historical NHL real-time scoring data show rink-to-rink recording effects for event counts, so event-count prop features require venue/data-quality awareness rather than assuming perfectly uniform measurement.",
        "limitation": "Historical era; do not apply a fixed 2026 rink adjustment without modern replication.",
        "independentStudyWeightEligible": True,
    },
    {
        "id": "v18_nhl_shooter_goalie_xg_mechanism",
        "sport": "NHL",
        "marketClassDetail": "goals_anytime_goal",
        "taxonomyMarketClasses": ["player_props", "model_evaluation"],
        "timing": ["pregame"],
        "historyFitRole": "support",
        "tier": "C",
        "sourceIds": ["v18src_noel_2025"],
        "directness": "player_goal_probability_mechanism",
        "transportability": "high_current_era",
        "finding": "Goalscorer probability architecture can benefit from separating shooter and goaltender skill rather than treating expected goals as context-free, but mechanism improvement does not establish sportsbook anytime-goal mispricing.",
        "limitation": "Recent preprint and not direct goalscorer-price calibration.",
        "independentStudyWeightEligible": True,
    },
    {
        "id": "v18_nfl_injury_participation_role_caution",
        "sport": "NFL",
        "marketClassDetail": "participation_volume_props",
        "taxonomyMarketClasses": ["player_props", "injury_lineup"],
        "timing": ["pregame"],
        "historyFitRole": "caution",
        "tier": "B",
        "sourceIds": ["v18src_mody_et_al_2022"],
        "directness": "participation_context",
        "transportability": "medium",
        "finding": "Major injury history can alter later participation and performance in position-dependent ways, so volume props should treat role and expected participation as uncertain inputs rather than applying one fixed injury penalty.",
        "limitation": "Long-horizon return-to-play study, not a same-week availability model and not sportsbook prop calibration.",
        "independentStudyWeightEligible": True,
    },
]

ADDED_SOURCES = [
    {
        "sourceId": "v18src_papageorgiou_sarlis_tjortjis_2025",
        "canonicalCitation": "Papageorgiou, Sarlis & Tjortjis (2025), An innovative method for NBA player performance forecasting and line-up optimization in daily fantasy sports, International Journal of Data Science and Analytics",
        "identifier": "10.1007/s41060-024-00523-y",
        "identifierType": "doi",
        "sourceClass": "peer_reviewed",
        "referencedBy": ["v18_nba_individualized_forecast_methodology"],
        "overlapCluster": "papageorgiou_player_forecasting_lineage",
    },
    {
        "sourceId": "v18src_dopke_kohler_tegtmeier_2024",
        "canonicalCitation": "Döpke, Köhler & Tegtmeier (2024), Are they worth it? An evaluation of predictions for NBA Fantasy Sports, Journal of Economics and Finance 48",
        "identifier": "10.1007/s12197-023-09646-7",
        "identifierType": "doi",
        "sourceClass": "peer_reviewed",
        "referencedBy": ["v18_nba_external_projection_caution"],
    },
    {
        "sourceId": "v18src_schuckers_macdonald_2014",
        "canonicalCitation": "Schuckers & Macdonald (2014), Accounting for Rink Effects in the NHL Real Time Scoring System",
        "identifier": "arXiv:1412.1035",
        "identifierType": "arxiv",
        "sourceClass": "academic_preprint",
        "referencedBy": ["v18_nhl_rink_recording_data_quality_caution"],
    },
    {
        "sourceId": "v18src_noel_2025",
        "canonicalCitation": "Noel (2025), Expected by Whom? Shooter and Goaltender Skill-adjusted Expected Goals",
        "identifier": "arXiv:2511.07703",
        "identifierType": "arxiv",
        "sourceClass": "academic_preprint",
        "referencedBy": ["v18_nhl_shooter_goalie_xg_mechanism"],
    },
    {
        "sourceId": "v18src_mody_et_al_2022",
        "canonicalCitation": "Mody et al. (2022), Return to Play and Performance After Anterior Cruciate Ligament Reconstruction in National Football League Players",
        "identifier": "PMCID:PMC8905068; PMID:35284583",
        "identifierType": "pmcid_pmid",
        "sourceClass": "peer_reviewed_clinical_performance",
        "referencedBy": ["v18_nfl_injury_participation_role_caution"],
    },
]

# Every Phase-2 ledger item must have an explicit R2 disposition. Multiple ledger
# candidates may collapse into one logical History Fit item when they are one mechanism cluster.
LEDGER_DISPOSITION = {
    "V18-METHOD-CALIBRATION-001": ("HOLD", ["v18_walsh_joshi_calibration_corrigendum_hold"], "Corrigendum remains unresolved; exact quantitative claims stay out of the freeze."),
    "V18-NBA-DIRECT-001": ("INCLUDED", ["v18_nba_player_prop_closing_context"], "Direct single-book closing context retained with C-tier caution."),
    "V18-NBA-MECH-001": ("INCLUDED", ["v18_nba_stat_specific_forecastability"], "Peer-reviewed stat-specific mechanism retained; not market-calibration evidence."),
    "V18-NBA-MECH-002": ("INCLUDED_CLUSTERED", ["v18_nba_individualized_forecast_methodology"], "Distinct paper retained, but overlap lineage prevents an extra independent-weight vote."),
    "V18-NBA-CAUTION-001": ("INCLUDED", ["v18_nba_external_projection_caution"], "Projection-provider quality caution restored after being omitted from R1."),
    "V18-WNBA-DATA-001": ("INFRASTRUCTURE_ONLY", [], "Acquisition path only; not predictive or calibration evidence."),
    "V18-WNBA-GAP-001": ("INCLUDED", ["v18_wnba_direct_prop_calibration_gap"], "Explicit direct-closing calibration gap retained; supports NR."),
    "V18-NHL-SOG-001": ("INCLUDED", ["v18_nhl_sog_forecastability"], "Exact-stat SOG mechanism retained with thesis/no-price caveat."),
    "V18-NHL-SOG-002": ("DEFERRED_DATA_AUDIT", [], "Public odds project remains outside canonical evidence until book/timestamp/grading provenance is audited."),
    "V18-NHL-DATA-QUALITY-001": ("INCLUDED", ["v18_nhl_rink_recording_data_quality_caution"], "Historical rink-recording caution restored after being omitted from R1."),
    "V18-NHL-SAVES-001": ("INCLUDED", ["v18_nhl_goalie_hot_hand_caution"], "Goalie hot-hand caution retained; no saves-price claim."),
    "V18-NHL-GOAL-001": ("INCLUDED", ["v18_nhl_shooter_goalie_xg_mechanism"], "Shooter/goalie skill mechanism restored after being omitted from R1."),
    "V18-NHL-DATA-001": ("INFRASTRUCTURE_ONLY", [], "Current/opening prop data path only; no complete historical closing stream."),
    "V18-NFL-REC-001": ("INCLUDED_CLUSTERED", ["v18_nfl_receiving_target_catch_context"], "Catch-probability mechanism represented in one combined receiving logical item."),
    "V18-NFL-REC-002": ("INCLUDED_CLUSTERED", ["v18_nfl_receiving_target_catch_context"], "Defender/yardage distribution mechanism represented in the same combined receiving logical item."),
    "V18-NFL-INJURY-001": ("INCLUDED", ["v18_nfl_injury_participation_role_caution"], "Participation/role caution restored after being omitted from R1."),
    "V18-NFL-DATA-001": ("INFRASTRUCTURE_ONLY", [], "Current/opening prop data path only; not a direct calibration finding."),
    "V18-NFL-DIRECT-GAP-001": ("INCLUDED", ["v18_nfl_direct_player_prop_calibration_gap"], "Explicit direct sportsbook calibration gap retained; supports NR/caveated mechanism fit."),
    "V18-MLB-K-001": ("INCLUDED", ["v18_mlb_pitcher_k_matchup_mechanism"], "Strikeout matchup mechanism retained separately from audited price evidence."),
    "V18-MLB-HIT-001": ("INCLUDED", ["v18_mlb_hits_total_bases_contact_quality"], "Official contact-quality mechanism retained as non-independent market evidence."),
    "V18-MLB-MARKET-001": ("INCLUDED_AS_AUDITED_DERIVED_FINDINGS", ["v18_mlb_no_universal_prop_recalibration", "v18_mlb_walks_rbis_limited_recalibration_signal"], "Raw infrastructure candidate was replaced by the completed full audit and June forward-holdout findings."),
    "V18-MLB-MARKET-002": ("DEFERRED_DATA_AUDIT", [], "Lineup-reaction dataset is adjacent infrastructure from the same collection family; not required for v1.8 freeze."),
    "V18-SHANK-CITATION-CORRECTION": ("REGISTRY_CORRECTION", [], "Correct DOI is carried into the v1.8 registry delta with provenance; v1.7 remains immutable."),
}

DIRECT_MARKET_CALIBRATION_IDS = {
    "v18_nba_player_prop_closing_context",
    "v18_mlb_no_universal_prop_recalibration",
    "v18_mlb_walks_rbis_limited_recalibration_signal",
    "v18_soccer_market_structure_1x2_vs_asian_handicap",
}


def normalize_sports(item):
    original = item.get("sport")
    if original == "NFL/NCAAF":
        item["sport"] = "NFL"
        item["sports"] = ["NFL", "College Football/Basketball"]
        item["sourceSportLabel"] = original
    elif original in {"Cross-market", "Cross-sport"}:
        item["sport"] = "Cross-Sport"
        item["sports"] = ["Cross-Sport"]
        item["sourceSportLabel"] = original
    else:
        item["sports"] = [original]
    return item


def add_evidence_semantics(item):
    research_independent = bool(item.get("independentStudyWeightEligible", False))
    item["evidenceSemantics"] = {
        "independentResearchSourceEligible": research_independent,
        "directMarketCalibrationEvidenceEligible": item["id"] in DIRECT_MARKET_CALIBRATION_IDS,
        "mayCreateBetOrExecutablePrice": False,
        "mayOverrideCurrentMarketGates": False,
    }
    item["independentStudyWeightMeaning"] = "Independent research-source eligibility only; never an automatic market-mispricing vote."
    return item


def build():
    r1 = load(R1_FREEZE)
    r1_registry = load(R1_REGISTRY)
    r1_clusters = load(R1_CLUSTERS)
    ledger = load(LEDGER)

    r1_ids = {x["id"] for x in r1["items"]}
    additions = [x for x in ADDED_ITEMS if x["id"] not in r1_ids]
    items = [dict(x) for x in r1["items"]] + [dict(x) for x in additions]
    items = [add_evidence_semantics(normalize_sports(x)) for x in items]
    items.sort(key=lambda x: x["id"])

    # Complete Phase-2 reconciliation: fail closed if a ledger candidate is not mapped.
    ledger_ids = {x["candidateId"] for x in ledger["items"]}
    mapped_ids = set(LEDGER_DISPOSITION)
    if ledger_ids != mapped_ids:
        raise RuntimeError(f"Ledger reconciliation incomplete. missing={sorted(ledger_ids-mapped_ids)} extra={sorted(mapped_ids-ledger_ids)}")

    reconciliation_rows = []
    for row in ledger["items"]:
        disposition, represented_by, reason = LEDGER_DISPOSITION[row["candidateId"]]
        reconciliation_rows.append({
            "candidateId": row["candidateId"],
            "phase2Status": row["status"],
            "r2Disposition": disposition,
            "representedBy": represented_by,
            "reason": reason,
        })

    controlled_sports = {
        "Cross-Sport", "MLB", "NBA", "NFL", "NHL", "Soccer", "Tennis",
        "MMA/UFC", "Boxing", "CFL", "College Football/Basketball", "WNBA"
    }
    bad_sports = sorted({s for x in items for s in x["sports"] if s not in controlled_sports})
    if bad_sports:
        raise RuntimeError(f"Uncontrolled sport labels remain: {bad_sports}")

    freeze = {
        "schema": 2,
        "freezeId": FREEZE_ID,
        "supersedesFreezeId": r1["freezeId"],
        "targetLibraryVersion": "1.8",
        "state": "STAGING_CANDIDATE_FREEZE_R2",
        "runtimeAuthority": False,
        "activeProductionLibrary": "1.7",
        "generatedDate": DATE,
        "baseArtifacts": r1["baseArtifacts"],
        "taxonomyExtensionsRequired": {"sports": ["WNBA"], "normalizedControlledSports": True},
        "freezePolicy": {
            **r1["freezePolicy"],
            "r1Immutable": True,
            "allPhase2LedgerItemsRequireExplicitDisposition": True,
            "independentStudyWeightSemantics": "Independent research-source eligibility only; mechanism evidence never becomes a market-mispricing vote by implication.",
            "directMarketCalibrationEvidenceTrackedSeparately": True,
        },
        "counts": {
            "admittedLogicalItems": len(items),
            "addedVsR1": len(additions),
            "gapItems": sum(1 for x in items if x["tier"] == "GAP"),
            "independentResearchSourceEligibleItems": sum(1 for x in items if x["evidenceSemantics"]["independentResearchSourceEligible"]),
            "directMarketCalibrationEvidenceEligibleItems": sum(1 for x in items if x["evidenceSemantics"]["directMarketCalibrationEvidenceEligible"]),
            "deferredItems": len(r1["deferredItems"]),
            "phase2LedgerItemsReconciled": len(reconciliation_rows),
        },
        "items": items,
        "deferredItems": r1["deferredItems"],
        "nextGates": [
            "Review Candidate Freeze R2 and reconciliation report before any merged-library materialization.",
            "Define representative cross-sport History Fit retrieval cases against the frozen R2 semantics.",
            "Materialize merged v1.8 candidate library only after R2 review approval.",
            "Re-prove R3 hard boundaries and failure isolation.",
            "Require explicit approval before changing research/manifest.json."
        ],
    }

    registry = dict(r1_registry)
    registry["schema"] = 2
    registry["freezeId"] = FREEZE_ID
    registry["state"] = "STAGING_FROZEN_SOURCE_REGISTRY_DELTA_R2"
    existing_source_ids = {x["sourceId"] for x in registry["newSources"]}
    registry["newSources"] = registry["newSources"] + [x for x in ADDED_SOURCES if x["sourceId"] not in existing_source_ids]
    registry["counts"] = {
        "newSources": len(registry["newSources"]),
        "corrections": len(registry["corrections"]),
        "admittedSources": sum(1 for x in registry["newSources"] if x.get("status") not in {"deferred", "hold"}),
        "deferredOrHoldSources": sum(1 for x in registry["newSources"] if x.get("status") in {"deferred", "hold"}),
        "addedVsR1": len(ADDED_SOURCES),
    }

    clusters = dict(r1_clusters)
    clusters["schema"] = 2
    clusters["freezeId"] = FREEZE_ID
    clusters["state"] = "STAGING_FROZEN_EVIDENCE_CLUSTERS_R2"
    c = clusters["clusters"]
    c["v18_player_prop_directness_boundary"]["members"] += [
        "v18_nba_individualized_forecast_methodology",
        "v18_nba_external_projection_caution",
        "v18_nhl_rink_recording_data_quality_caution",
        "v18_nhl_shooter_goalie_xg_mechanism",
        "v18_nfl_injury_participation_role_caution",
    ]
    c["v18_nhl_prop_mechanisms"]["members"] += [
        "v18_nhl_rink_recording_data_quality_caution",
        "v18_nhl_shooter_goalie_xg_mechanism",
    ]
    c["v18_nba_wnba_prop_transportability"]["members"] += [
        "v18_nba_individualized_forecast_methodology",
        "v18_nba_external_projection_caution",
    ]
    c["v18_nfl_prop_transportability"]["members"] += ["v18_nfl_injury_participation_role_caution"]
    c["v18_external_projection_signal_caution"] = {
        "title": "Player-performance forecasts are inputs, not independent sportsbook edge signals",
        "members": [
            "v18_nba_stat_specific_forecastability",
            "v18_nba_individualized_forecast_methodology",
            "v18_nba_external_projection_caution",
            "v18_nhl_sog_forecastability",
            "v18_nfl_receiving_target_catch_context",
            "v18_mlb_pitcher_k_matchup_mechanism",
        ],
        "relationship": "forecast_mechanism_separate_from_market_calibration",
        "canonicalInterpretation": "A forecast can be useful without proving sportsbook mispricing. History Fit may use independent mechanism research while reserving direct market-calibration claims for explicitly qualified price evidence."
    }

    recon = {
        "schema": 1,
        "freezeId": FREEZE_ID,
        "r1FreezeId": r1["freezeId"],
        "state": "STAGING_R1_TO_R2_RECONCILIATION",
        "runtimeAuthority": False,
        "summary": {
            "r1Admitted": len(r1["items"]),
            "r2Admitted": len(items),
            "addedLogicalItems": [x["id"] for x in additions],
            "sportLabelsNormalized": ["NFL/NCAAF -> NFL + College Football/Basketball", "Cross-market -> Cross-Sport"],
            "phase2LedgerItems": len(reconciliation_rows),
            "phase2LedgerItemsExplicitlyReconciled": len(reconciliation_rows),
            "silentDisappearances": 0,
        },
        "ledgerReconciliation": reconciliation_rows,
        "evidenceSemantics": {
            "independentResearchSourceEligible": "May count as a distinct research source under History Fit dedup rules.",
            "directMarketCalibrationEvidenceEligible": "May support a direct historical market-calibration statement when scope/timing match; does not create a bet or executable price.",
            "mechanismRule": "Mechanism/forecastability evidence can support or caution a candidate but is not a market-mispricing vote.",
        },
    }

    write_json(OUT_FREEZE, freeze)
    write_json(OUT_REGISTRY, registry)
    write_json(OUT_CLUSTERS, clusters)
    write_json(OUT_RECON, recon)

    checksums = {
        "schema": 1,
        "freezeId": FREEZE_ID,
        "state": "STAGING_FREEZE_CHECKSUMS_R2",
        "algorithm": "sha256",
        "files": [],
    }
    for path in [OUT_FREEZE, OUT_REGISTRY, OUT_CLUSTERS, OUT_RECON]:
        checksums["files"].append({
            "path": str(path.relative_to(ROOT)),
            "sha256": sha256(path),
            "bytes": path.stat().st_size,
        })
    write_json(OUT_CHECKSUMS, checksums)

    md = f"""# Betting Edge Research Library v1.8 — Candidate Freeze R2\n\n**Date:** {DATE}  \n**Freeze ID:** `{FREEZE_ID}`  \n**State:** STAGING CANDIDATE FREEZE — NOT RUNTIME AUTHORITY  \n**Active production library remains:** v1.7\n\n## Why R2 exists\n\nR1 remains immutable. The freeze review found several Phase-2 KEEP/KEEP_WITH_CAUTION candidates that were neither admitted nor explicitly deferred, two uncontrolled sport labels, and ambiguous wording around independent-study weighting. R2 repairs those bookkeeping/semantic issues without reopening broad discovery.\n\n## R2 result\n\n- Admitted logical items: **{len(items)}** (**+{len(additions)} vs R1**)\n- Phase-2 ledger items explicitly reconciled: **{len(reconciliation_rows)}/{len(reconciliation_rows)}**\n- Silent Phase-2 disappearances: **0**\n- New source-registry records added vs R1: **{len(ADDED_SOURCES)}**\n- Explicit gap items: **{sum(1 for x in items if x['tier'] == 'GAP')}**\n- Direct market-calibration evidence is now tracked separately from independent mechanism research.\n\n## Restored from Phase-2 review\n\n- NBA individualized forecasting methodology (overlap-clustered, no extra independent vote)\n- NBA third-party projection caution\n- NHL rink-recording/data-quality caution\n- NHL shooter/goaltender skill-adjusted xG mechanism\n- NFL injury/participation/role caution\n\n## Taxonomy correction\n\n`NFL/NCAAF` is represented as controlled sports `NFL` + `College Football/Basketball`; `Cross-market` is normalized to `Cross-Sport`. WNBA remains the only new controlled sport extension required by v1.8.\n\n## Evidence semantics\n\n`independentResearchSourceEligible` means a source may be counted as distinct research after deduplication. It does **not** mean the source is an independent market-mispricing signal. `directMarketCalibrationEvidenceEligible` is tracked separately, and no research item can create a bet, executable price, stake, or override current market gates.\n\n## Hard boundary\n\nNo production manifest, live History Fit library, runner, workflow prompt, production contract, or scheduled report is changed by R2.\n\n## Next gate\n\nReview R2 and its complete reconciliation report. Only after that review should the merged v1.8 candidate library be materialized and tested.\n"""
    OUT_README.write_text(md, encoding="utf-8")

    print(json.dumps({
        "freezeId": FREEZE_ID,
        "admitted": len(items),
        "addedVsR1": len(additions),
        "ledgerReconciled": len(reconciliation_rows),
        "newSources": len(registry["newSources"]),
        "clusters": len(clusters["clusters"]),
    }, indent=2))


if __name__ == "__main__":
    build()

#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STAGING = ROOT / "research" / "staging"
RESEARCH = ROOT / "research"

BASE_LIBRARY = STAGING / "V1_8_MERGED_CANDIDATE_LIBRARY_R1_2026-08-15.json"
BASE_REGISTRY = STAGING / "V1_8_MERGED_CANDIDATE_SOURCE_REGISTRY_R1_2026-08-15.json"
BASE_TAXONOMY = STAGING / "V1_8_MERGED_CANDIDATE_TAXONOMY_R1_2026-08-15.json"
OVERLAY = STAGING / "V1_8_GAP_CLOSURE_R3_2026-08-25.json"

OUT_LIBRARY = RESEARCH / "research-library.json"
OUT_REGISTRY = RESEARCH / "source-registry.json"
OUT_TAXONOMY = RESEARCH / "taxonomy.json"
OUT_POLICY = RESEARCH / "history-fit-policy.json"
OUT_MANIFEST = RESEARCH / "manifest.json"
OUT_README = RESEARCH / "README.md"
OUT_CHECKSUMS = RESEARCH / "CHECKSUMS.json"
OUT_VALIDATION = RESEARCH / "tests" / "V1_8_R3_VALIDATION_2026-08-25.json"
OUT_PROMOTION = RESEARCH / "V1_8_PROMOTION_2026-08-25.md"

BUILD_ID = "v1.8-r3-production-2026-08-25"
OVERLAY_ID = "v1.8-gap-closure-r3-2026-08-25"
TARGET_VERSION = "1.8"
CONTRACT_VERSION = "1.0"
CONTRACT_PATH = "BETTING_EDGE_CONTRACT.md"
CONTRACT_BLOB_SHA = "8bb1756a573d50d03ef99cd24eedb228d08d7632"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def sha256(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source_key(src):
    doi = src.get("doi")
    if doi:
        return ("doi", str(doi).strip().lower())
    ident = src.get("identifier")
    if ident:
        return (src.get("identifierType", "identifier"), str(ident).strip().lower())
    return ("citation", str(src.get("canonicalCitation", "")).strip().lower())


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def main():
    built_at = now_iso()
    base_library = load(BASE_LIBRARY)
    base_registry = load(BASE_REGISTRY)
    base_taxonomy = load(BASE_TAXONOMY)
    overlay = load(OVERLAY)
    policy = load(OUT_POLICY)

    assert base_library["library"]["version"] == "1.8-candidate-r1"
    assert base_library["library"]["logicalItemCount"] == 120
    assert base_registry["libraryVersion"] == "1.8-candidate-r1"
    assert base_registry["sourceCount"] == 100
    assert base_taxonomy["libraryVersion"] == "1.8-candidate-r1"
    assert overlay["overlayId"] == OVERLAY_ID
    assert overlay["targetLibraryVersion"] == TARGET_VERSION
    assert overlay["state"] == "APPROVED_FOR_R3_MATERIALIZATION"
    assert overlay["boundaries"]["mayCreateBet"] is False
    assert overlay["boundaries"]["mayCountAsIndependentBetSignal"] is False

    library = json.loads(json.dumps(base_library))
    registry = json.loads(json.dumps(base_registry))
    taxonomy = json.loads(json.dumps(base_taxonomy))

    # Add R3 sources without allowing identifier or ID collisions.
    source_ids = {s["sourceId"] for s in registry["sources"]}
    source_keys = {source_key(s): s["sourceId"] for s in registry["sources"]}
    for src in overlay["sources"]:
        if src["sourceId"] in source_ids:
            raise RuntimeError(f"Duplicate R3 sourceId: {src['sourceId']}")
        record = {
            "sourceId": src["sourceId"],
            "canonicalCitation": src["canonicalCitation"],
            "citationVariants": [src["canonicalCitation"]],
            "sourceClass": src["sourceClass"],
            "referencedBy": src.get("referencedBy", []),
        }
        if src.get("identifierType") == "doi":
            record["doi"] = src["identifier"]
        else:
            record["identifier"] = src.get("identifier")
            record["identifierType"] = src.get("identifierType")
        key = source_key(record)
        if key in source_keys:
            raise RuntimeError(f"R3 source identifier collision {key}: {src['sourceId']} vs {source_keys[key]}")
        registry["sources"].append(record)
        source_ids.add(record["sourceId"])
        source_keys[key] = record["sourceId"]

    # Add new evidence clusters first, then validate item cluster references.
    for cid, cluster in overlay["clusters"].items():
        if cid in taxonomy["evidenceClusters"]:
            raise RuntimeError(f"R3 cluster collision: {cid}")
        taxonomy["evidenceClusters"][cid] = cluster

    item_ids = {x["priorId"] for x in library["items"]}
    next_ordinal = 1
    for item in overlay["items"]:
        if item["priorId"] in item_ids:
            raise RuntimeError(f"R3 logical item collision: {item['priorId']}")
        new_item = json.loads(json.dumps(item))
        new_item["sourcePackageOrdinal"] = next_ordinal
        next_ordinal += 1
        library["items"].append(new_item)
        item_ids.add(new_item["priorId"])

    # Validate every provenance source and evidence-cluster reference after merge.
    source_ids = {s["sourceId"] for s in registry["sources"]}
    cluster_ids = set(taxonomy["evidenceClusters"])
    missing_sources = []
    missing_clusters = []
    for item in library["items"]:
        for sid in item.get("provenance", {}).get("sourceIds", []):
            if sid not in source_ids:
                missing_sources.append((item["priorId"], sid))
        for cid in item.get("clusterIds", []):
            if cid not in cluster_ids:
                missing_clusters.append((item["priorId"], cid))
    if missing_sources:
        raise RuntimeError(f"Missing source refs: {missing_sources}")
    if missing_clusters:
        raise RuntimeError(f"Missing cluster refs: {missing_clusters}")

    # Cluster members must resolve to actual logical items.
    bad_cluster_members = []
    for cid, cluster in taxonomy["evidenceClusters"].items():
        for member in cluster.get("members", []):
            if member not in item_ids:
                bad_cluster_members.append((cid, member))
    if bad_cluster_members:
        raise RuntimeError(f"Unknown cluster members: {bad_cluster_members}")

    # Recalculate library inventory from content rather than trusting hand-edited counts.
    items = library["items"]
    retrieval_counts = Counter(x["retrievalRole"] for x in items)
    tier_counts = Counter(x["evidence"]["tier"] for x in items)
    library["library"].update({
        "version": TARGET_VERSION,
        "status": "R3_LIVE_READ_ONLY",
        "generatedAtUtc": built_at,
        "contractCompatibility": {
            "productionContractVersion": CONTRACT_VERSION,
            "productionContractPath": CONTRACT_PATH,
            "productionContractBlobSha": CONTRACT_BLOB_SHA,
            "activationState": "R3_LIVE_READ_ONLY",
        },
        "sourcePackageRange": "v1.0-v1.8-r3",
        "logicalItemCount": len(items),
        "primaryResearchPriorCount": sum(1 for x in items if x["retrievalRole"] == "primary_prior"),
        "synthesisItemCount": sum(1 for x in items if x["retrievalRole"] != "primary_prior"),
        "sourceRegistryCount": len(registry["sources"]),
        "evidenceClusterCount": len(taxonomy["evidenceClusters"]),
        "retrievalRoleCounts": dict(sorted(retrieval_counts.items())),
        "evidenceTierCounts": dict(sorted(tier_counts.items())),
        "independentStudyWeightEligibleCount": sum(1 for x in items if x["evidence"].get("independentStudyWeightEligible")),
        "directMarketCalibrationEvidenceEligibleCount": sum(1 for x in items if x["evidence"].get("directMarketCalibrationEvidenceEligible")),
        "candidateBuildId": BUILD_ID,
        "candidateFreezeId": "v1.8-candidate-freeze-2026-08-15-r2+gap-closure-r3",
        "r3OverlayId": OVERLAY_ID,
    })
    library["runtimeRules"].update({
        "readOnly": True,
        "historyFitOnlyAtR3": True,
        "researchDoesNotCreateBet": True,
        "researchDoesNotCountAsIndependentBetSignal": True,
        "researchDoesNotDirectlyRewriteFairValue": True,
        "researchDoesNotDirectlyRewriteModelErrorParameters": True,
        "researchDoesNotDirectlyRewritePlayTo": True,
        "researchDoesNotDirectlyRewriteStatus": True,
        "researchDoesNotDirectlyRewriteStake": True,
    })

    registry.update({
        "libraryVersion": TARGET_VERSION,
        "generatedAtUtc": built_at,
        "sourceCount": len(registry["sources"]),
        "candidateBuildId": BUILD_ID,
        "r3OverlayId": OVERLAY_ID,
    })
    taxonomy.update({
        "libraryVersion": TARGET_VERSION,
        "generatedAtUtc": built_at,
        "candidateBuildId": BUILD_ID,
        "r3OverlayId": OVERLAY_ID,
    })
    policy.update({
        "libraryVersion": TARGET_VERSION,
        "contractVersion": CONTRACT_VERSION,
        "mode": "R3_LIVE_READ_ONLY",
        "runtimePermission": "READ_ONLY",
    })

    # Exact regression checks for the R3 production problems.
    by_id = {x["priorId"]: x for x in items}
    required_ids = [
        "v18_extreme_longshot_fixed_odds_caution",
        "v18_soccer_liquidity_price_dispersion_caution",
        "v18_college_football_team_total_censoring_bias",
        "v18_wnba_game_market_efficiency_era_limited",
        "v18_mlb_doubles_contact_quality_mechanism",
        "v18_mlb_stolen_base_attempt_success_mechanism",
        "v18_mlb_runs_scored_batting_order_opportunity",
        "v18_mlb_doubles_stolen_base_direct_price_gap",
        "v18_extreme_tail_book_gap_synthesis",
    ]
    for rid in required_ids:
        if rid not in by_id:
            raise RuntimeError(f"Required R3 item missing: {rid}")

    # WNBA game evidence must not masquerade as player-prop calibration.
    wnba_game = by_id["v18_wnba_game_market_efficiency_era_limited"]
    if "player_props" in wnba_game["scope"]["marketClasses"]:
        raise RuntimeError("WNBA game-market item leaked into player-prop scope")
    if by_id["v18_wnba_direct_prop_calibration_gap"]["evidence"]["tier"] != "GAP":
        raise RuntimeError("WNBA direct player-prop calibration gap was lost")

    # Rare MLB prop mechanisms must not claim direct market calibration.
    for rid in [
        "v18_mlb_doubles_contact_quality_mechanism",
        "v18_mlb_stolen_base_attempt_success_mechanism",
        "v18_mlb_runs_scored_batting_order_opportunity",
    ]:
        if by_id[rid]["evidence"].get("directMarketCalibrationEvidenceEligible"):
            raise RuntimeError(f"Mechanism incorrectly promoted to direct calibration: {rid}")

    # Every item must preserve R3 hard boundaries when a runtimeBoundary object exists.
    boundary_violations = []
    for item in items:
        rb = item.get("runtimeBoundary", {})
        for key in [
            "mayCreateBet",
            "mayCountAsIndependentBetSignal",
            "mayDirectlyRewriteFairValue",
            "mayDirectlyRewriteModelErrorParameters",
            "mayDirectlyRewritePlayTo",
            "mayDirectlyRewriteStatus",
            "mayDirectlyRewriteStake",
        ]:
            if rb.get(key) is True:
                boundary_violations.append((item["priorId"], key))
    if boundary_violations:
        raise RuntimeError(f"R3 hard-boundary violation: {boundary_violations}")

    write_json(OUT_LIBRARY, library)
    write_json(OUT_REGISTRY, registry)
    write_json(OUT_TAXONOMY, taxonomy)
    write_json(OUT_POLICY, policy)

    manifest = {
        "schema": 1,
        "libraryName": "Betting Edge Research Library",
        "activeLibraryVersion": TARGET_VERSION,
        "status": "R3_LIVE_READ_ONLY",
        "generatedAtUtc": built_at,
        "contractCompatibility": {
            "productionVersion": CONTRACT_VERSION,
            "productionPath": CONTRACT_PATH,
            "productionContractBlobShaAtActivation": CONTRACT_BLOB_SHA,
            "status": "compatible_operational_R3_live_read_only_history_provenance",
        },
        "activePaths": {
            "library": "research/research-library.json",
            "sources": "research/source-registry.json",
            "policy": "research/history-fit-policy.json",
            "taxonomy": "research/taxonomy.json",
            "sourcePackages": "research/source-package-manifest.json",
        },
        "validation": {
            "lastTest": "research/tests/V1_8_R3_VALIDATION_2026-08-25.json",
            "status": "PASS",
            "baseCandidateNarrativeTests": "15/15 PASS",
            "baseCandidateBoundaryTests": "9/9 PASS",
        },
        "runtime": {
            "writeRequired": False,
            "scheduledReportsLinked": True,
            "scheduledSlots": ["open", "main", "final_morning", "evening", "late"],
            "mode": "R3_LIVE_READ_ONLY_HISTORY_FIT_WITH_HISTORY_SIDECAR",
            "nextStage": "NORMAL_PRODUCTION_OBSERVATION",
        },
        "build": {
            "buildId": BUILD_ID,
            "baseCandidate": "v1.8-merged-candidate-r1-2026-08-15",
            "r3Overlay": OVERLAY_ID,
            "logicalItems": len(items),
            "sources": len(registry["sources"]),
            "evidenceClusters": len(taxonomy["evidenceClusters"]),
        },
        "updateModel": "Curated snapshot. New approved research produces a new library version; normal report runs remain read-only.",
    }
    write_json(OUT_MANIFEST, manifest)

    validation = {
        "schema": 1,
        "validationId": "v1.8-r3-validation-2026-08-25",
        "state": "PASS",
        "builtAtUtc": built_at,
        "buildId": BUILD_ID,
        "baseCandidate": {
            "logicalItems": 120,
            "sources": 100,
            "evidenceClusters": 26,
            "priorNarrativeTests": "15/15 PASS",
            "priorBoundaryTests": "9/9 PASS",
        },
        "r3Overlay": {
            "itemsAdded": len(overlay["items"]),
            "sourcesAdded": len(overlay["sources"]),
            "clustersAdded": len(overlay["clusters"]),
            "remainingExplicitGaps": overlay["remainingExplicitGaps"],
        },
        "productionInventory": {
            "logicalItems": len(items),
            "sources": len(registry["sources"]),
            "evidenceClusters": len(taxonomy["evidenceClusters"]),
            "retrievalRoleCounts": dict(sorted(retrieval_counts.items())),
            "evidenceTierCounts": dict(sorted(tier_counts.items())),
            "independentStudyWeightEligibleCount": library["library"]["independentStudyWeightEligibleCount"],
            "directMarketCalibrationEvidenceEligibleCount": library["library"]["directMarketCalibrationEvidenceEligibleCount"],
        },
        "checks": {
            "uniqueLogicalIds": len(item_ids) == len(items),
            "uniqueSourceIds": len(source_ids) == len(registry["sources"]),
            "allSourceReferencesResolve": True,
            "allClusterReferencesResolve": True,
            "allClusterMembersResolve": True,
            "wnbaGameMarketDoesNotLeakToProps": True,
            "wnbaDirectPropGapPreserved": True,
            "rareMlbMechanismsNotPromotedToDirectCalibration": True,
            "runtimeHardBoundariesPreserved": True,
            "manifestPointsToV18": True,
        },
    }
    write_json(OUT_VALIDATION, validation)

    # Update the research README conservatively while preserving its operational guidance.
    readme = OUT_README.read_text(encoding="utf-8")
    readme = readme.replace("# Betting Edge Research Library — Canonical v1.7", "# Betting Edge Research Library — Canonical v1.8")
    readme = readme.replace("This folder consolidates the seven Betting Edge Research Prior Library passes (`v1.0` through `v1.6`) into one stable, versioned, machine-readable research source for History Fit.", "This folder now materializes the approved v1.8 Research Library: the canonical v1.7 base plus the tested v1.8 R2 candidate and the focused 2026-08-25 R3 gap-closure overlay, while preserving R3 read-only History Fit boundaries.")
    readme = readme.replace("The source set contains **96 logical items**:", f"The source set contains **{len(items)} logical items** after v1.8 R3 materialization. The original v1.7 base contained 96 logical items; v1.8 adds the tested candidate and focused gap-closure records without rewriting historical issued reports.")
    readme = readme.replace("Research Library v1.7 remains unchanged by the Contract v1.0 promotion. The next production observation is simply the first v1.0-issued report confirming that the existing Research Fit layer continues to read normally and records the new contract authority in provenance without changing price, status, stake or risk behavior.", "Research Library v1.8 is the active R3 live read-only library under Contract v1.0. It does not change executable price, fair value, model error, play-to, status, stake or risk by itself; it improves retrieval specificity, conflict handling and explicit gap recognition.")
    if "## v1.8 R3 gap closure" not in readme:
        readme += "\n## v1.8 R3 gap closure\n\nThe 2026-08-25 R3 pass used live-production soak evidence to target extreme-tail/book-gap interpretation, low-liquidity soccer, college football, WNBA game markets and exact MLB doubles/stolen-base/runs-scored mechanisms. See `research/staging/V1_8_GAP_AUDIT_R3_2026-08-25.md` and `research/V1_8_PROMOTION_2026-08-25.md`. Unresolved exact-market gaps remain explicit rather than being filled by analogy.\n"
    OUT_README.write_text(readme, encoding="utf-8")

    promotion_md = f"""# Betting Edge Research Library v1.8 — Production Promotion\n\n**Date:** 2026-08-25  \n**State:** PROMOTED — R3 LIVE READ-ONLY  \n**Build:** `{BUILD_ID}`  \n**Contract compatibility:** Betting Edge Contract v1.0 OPERATIONAL\n\n## Production inventory\n\n- Logical items: **{len(items)}**\n- Source records: **{len(registry['sources'])}**\n- Evidence clusters: **{len(taxonomy['evidenceClusters'])}**\n- Base v1.8 candidate: 120 items / 100 sources / 26 clusters\n- R3 gap closure: +{len(overlay['items'])} items / +{len(overlay['sources'])} sources / +{len(overlay['clusters'])} clusters\n\n## Promotion basis\n\nThe v1.8 R2 candidate had already passed 15/15 narrative History Fit cases and 9/9 hard-boundary cases. Its promotion hold required live v1.7 soak and representative real-candidate observation. By 2026-08-25, multiple full production days had accumulated and exposed concrete knowledge gaps, especially extreme-longshot/book-dispersion WAIT drift and exact player-prop mechanism gaps. R3 closes the highest-impact holes while preserving explicit gaps where direct calibration remains unavailable.\n\n## Hard boundaries preserved\n\nResearch Library v1.8 remains read-only History Fit. It may not create a BET, count as an independent BET signal, supply an executable price, override identity/freshness, or directly rewrite fair value, model error, play-to, status, stake or risk. Normal scheduled reports may not mutate `research/*`.\n\n## R3 focus\n\n- modern fixed-odds extreme-longshot caution;\n- soccer liquidity/book-dispersion interpretation;\n- direct college-football team-total/spread and sportsbook-behavior evidence;\n- direct but era-limited WNBA game-market evidence;\n- MLB doubles, stolen-base and runs-scored mechanism specificity;\n- explicit doubles/stolen-base direct-price calibration gap;\n- one cross-sport synthesis separating best-price execution from independent handicap support.\n\n## Remaining explicit gaps\n\n""" + "\n".join(f"- {x}" for x in overlay["remainingExplicitGaps"]) + "\n"
    OUT_PROMOTION.write_text(promotion_md, encoding="utf-8")

    # Canonical checksums after all active research files have been written.
    checksum_paths = [
        RESEARCH / "CANONICALIZATION_REPORT.md",
        OUT_README,
        OUT_POLICY,
        OUT_MANIFEST,
        OUT_LIBRARY,
        RESEARCH / "source-package-manifest.json",
        OUT_REGISTRY,
        OUT_TAXONOMY,
        OUT_PROMOTION,
        OUT_VALIDATION,
    ]
    checksums = {
        "schema": 1,
        "libraryVersion": TARGET_VERSION,
        "generatedAtUtc": built_at,
        "scope": "active_research_runtime_plus_v18_promotion_record",
        "selfHashPolicy": "CHECKSUMS.json is not included in its own files array.",
        "fileCount": len(checksum_paths),
        "files": [
            {
                "path": str(p.relative_to(ROOT)).replace("\\", "/"),
                "sizeBytes": p.stat().st_size,
                "sha256": sha256(p),
            }
            for p in checksum_paths
        ],
    }
    write_json(OUT_CHECKSUMS, checksums)

    print(f"V1.8 R3 MATERIALIZATION PASS: {len(items)} items, {len(registry['sources'])} sources, {len(taxonomy['evidenceClusters'])} clusters")


if __name__ == "__main__":
    main()

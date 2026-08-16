#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STAGING = ROOT / "research" / "staging"
DATE = "2026-08-15"
BUILD_ID = "v1.8-merged-candidate-r1-2026-08-15"
FREEZE_ID = "v1.8-candidate-freeze-2026-08-15-r2"
TEST_SUITE_ID = "v1.8-history-fit-predeclared-r1-2026-08-15"

BASE_LIBRARY = ROOT / "research" / "research-library.json"
BASE_REGISTRY = ROOT / "research" / "source-registry.json"
BASE_TAXONOMY = ROOT / "research" / "taxonomy.json"
BASE_POLICY = ROOT / "research" / "history-fit-policy.json"
R2_FREEZE = STAGING / "V1_8_CANDIDATE_FREEZE_R2_2026-08-15.json"
R2_REGISTRY = STAGING / "V1_8_CANDIDATE_SOURCE_REGISTRY_DELTA_R2_2026-08-15.json"
R2_CLUSTERS = STAGING / "V1_8_CANDIDATE_EVIDENCE_CLUSTERS_R2_2026-08-15.json"
TEST_SUITE = STAGING / "V1_8_HISTORY_FIT_TEST_SUITE_R1_2026-08-15.json"
TEST_CHECKSUMS = STAGING / "V1_8_HISTORY_FIT_TEST_SUITE_R1_CHECKSUMS_2026-08-15.json"

OUT_LIBRARY = STAGING / "V1_8_MERGED_CANDIDATE_LIBRARY_R1_2026-08-15.json"
OUT_REGISTRY = STAGING / "V1_8_MERGED_CANDIDATE_SOURCE_REGISTRY_R1_2026-08-15.json"
OUT_TAXONOMY = STAGING / "V1_8_MERGED_CANDIDATE_TAXONOMY_R1_2026-08-15.json"
OUT_MANIFEST = STAGING / "V1_8_MERGED_CANDIDATE_MANIFEST_R1_2026-08-15.json"
OUT_CHECKSUMS = STAGING / "V1_8_MERGED_CANDIDATE_CHECKSUMS_R1_2026-08-15.json"
OUT_MD = STAGING / "V1_8_MERGED_CANDIDATE_R1_2026-08-15.md"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, obj):
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def sha256(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_blob_sha(path: Path):
    data = path.read_bytes()
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def confidence_for_tier(tier: str):
    return {
        "A": "HIGH",
        "B": "MEDIUM_HIGH",
        "C": "MEDIUM",
        "D": "CONTEXT_ONLY",
        "GAP": "GAP",
    }.get(tier, "MEDIUM")


def runtime_boundary():
    return {
        "readOnlyAtR3": True,
        "mayCreateBet": False,
        "mayCountAsIndependentBetSignal": False,
        "mayDirectlyRewriteFairValue": False,
        "mayDirectlyRewriteModelErrorParameters": False,
        "mayDirectlyRewritePlayTo": False,
        "mayDirectlyRewriteStatus": False,
        "mayDirectlyRewriteStake": False,
    }


def source_identifier_key(src):
    if src.get("doi"):
        return ("doi", src["doi"].strip().lower())
    ident = src.get("identifier")
    if ident:
        return (src.get("identifierType", "identifier"), str(ident).strip().lower())
    return ("citation", src.get("canonicalCitation", "").strip().lower())


def convert_r2_item(item, cluster_map):
    role = item["historyFitRole"]
    is_gap = role == "gap" or item["tier"] == "GAP"
    cluster_ids = sorted(cluster_map.get(item["id"], []))
    relationships = [
        {"clusterId": cid, "relationship": "v1.8_frozen_evidence_cluster"}
        for cid in cluster_ids
    ]
    semantics = item.get("evidenceSemantics", {})
    return {
        "priorId": item["id"],
        "itemType": "gap_resolution" if is_gap else "research_prior",
        "retrievalRole": "synthesis" if is_gap else "primary_prior",
        "sourcePackage": "v1.8",
        "sourcePackageOrdinal": None,
        "legacyLabel": item["id"],
        "scope": {
            "legacyScope": item.get("sourceSportLabel", item.get("sport", "Cross-Sport")),
            "sports": item.get("sports") or [item.get("sport", "Cross-Sport")],
            "marketClasses": item.get("taxonomyMarketClasses", ["general_research"]),
            "timing": item.get("timing", ["all"]),
        },
        "marketClassDetail": item.get("marketClassDetail"),
        "topic": (item.get("marketClassDetail") or item["id"]).replace("_", " "),
        "evidence": {
            "tier": item["tier"],
            "tierAssignment": "v1.8_candidate_freeze_r2",
            "legacyStatus": "V1_8_FROZEN_CANDIDATE",
            "confidence": confidence_for_tier(item["tier"]),
            "independentStudyWeightEligible": bool(semantics.get("independentResearchSourceEligible", False)),
            "independentResearchSourceEligible": bool(semantics.get("independentResearchSourceEligible", False)),
            "directMarketCalibrationEvidenceEligible": bool(semantics.get("directMarketCalibrationEvidenceEligible", False)),
        },
        "finding": item["finding"],
        "guidance": "Apply only within the stated sport/market/timing scope. Preserve this limitation: " + item["limitation"],
        "historyFitRole": role,
        "provenance": {
            "sourceIds": item.get("sourceIds", []),
            "candidateFreezeId": FREEZE_ID,
            "directness": item.get("directness"),
            "transportability": item.get("transportability"),
            "r2LogicalItemId": item["id"],
        },
        "runtimeBoundary": runtime_boundary(),
        "clusterIds": cluster_ids,
        "relationshipSummary": relationships,
        "v18CandidateMetadata": {
            "buildId": BUILD_ID,
            "limitation": item["limitation"],
            "independentStudyWeightMeaning": item.get("independentStudyWeightMeaning"),
            "holdoutEvidence": item.get("holdoutEvidence"),
        },
    }


def main():
    base_library = load(BASE_LIBRARY)
    base_registry = load(BASE_REGISTRY)
    base_taxonomy = load(BASE_TAXONOMY)
    policy = load(BASE_POLICY)
    freeze = load(R2_FREEZE)
    registry_delta = load(R2_REGISTRY)
    cluster_delta = load(R2_CLUSTERS)
    suite = load(TEST_SUITE)
    test_checksums = load(TEST_CHECKSUMS)

    assert base_library["library"]["version"] == "1.7"
    assert base_registry["libraryVersion"] == "1.7"
    assert base_taxonomy["libraryVersion"] == "1.7"
    assert freeze["freezeId"] == FREEZE_ID
    assert suite["testSuiteId"] == TEST_SUITE_ID
    assert suite["predeclaredBeforeMergedCandidate"] is True

    # Prove the immutable base artifacts are exactly the blobs pinned in Freeze R2.
    for path, key in [
        (BASE_LIBRARY, "researchLibrary"),
        (BASE_REGISTRY, "sourceRegistry"),
        (BASE_TAXONOMY, "taxonomy"),
    ]:
        expected = freeze["baseArtifacts"][key]["blobSha"]
        actual = git_blob_sha(path)
        if actual != expected:
            raise RuntimeError(f"Base artifact drift: {path} expected {expected}, got {actual}")

    # Freeze and test definitions are hash pinned.
    freeze_checksum_map = {x["path"]: x["sha256"] for x in load(STAGING / "V1_8_CANDIDATE_FREEZE_CHECKSUMS_R2_2026-08-15.json")["files"]}
    if sha256(R2_FREEZE) != freeze_checksum_map[str(R2_FREEZE.relative_to(ROOT))]:
        raise RuntimeError("Freeze R2 hash mismatch")
    test_checksum_map = {x["path"]: x["sha256"] for x in test_checksums["files"]}
    if sha256(TEST_SUITE) != test_checksum_map[str(TEST_SUITE.relative_to(ROOT))]:
        raise RuntimeError("Predeclared test-suite hash mismatch")

    cluster_map = {}
    for cid, cluster in cluster_delta["clusters"].items():
        for member in cluster["members"]:
            cluster_map.setdefault(member, []).append(cid)

    converted = [convert_r2_item(x, cluster_map) for x in freeze["items"]]
    for i, item in enumerate(converted, start=1):
        item["sourcePackageOrdinal"] = i

    # No duplicate logical IDs across the immutable base and v1.8 delta.
    base_ids = {x["priorId"] for x in base_library["items"]}
    delta_ids = [x["priorId"] for x in converted]
    if len(delta_ids) != len(set(delta_ids)):
        raise RuntimeError("Duplicate IDs inside v1.8 R2 delta")
    overlap = base_ids.intersection(delta_ids)
    if overlap:
        raise RuntimeError(f"v1.8 logical IDs collide with v1.7: {sorted(overlap)}")

    merged_library = json.loads(json.dumps(base_library))
    merged_library["library"].update({
        "version": "1.8-candidate-r1",
        "status": "STAGING_MERGED_CANDIDATE_NOT_RUNTIME_AUTHORITY",
        "generatedAtUtc": "2026-08-16T03:52:00Z",
        "contractCompatibility": {
            "productionContractVersion": "0.9",
            "activationState": "STAGING_ONLY_NOT_LINKED_TO_PRODUCTION_MANIFEST",
        },
        "sourcePackageRange": "v1.0-v1.8-candidate",
        "candidateBuildId": BUILD_ID,
        "candidateFreezeId": FREEZE_ID,
        "predeclaredTestSuiteId": TEST_SUITE_ID,
    })
    merged_library["runtimeRules"]["readOnly"] = True
    merged_library["runtimeRules"]["historyFitOnlyAtR3"] = True
    merged_library["items"].extend(converted)

    # Recalculate inventory counts from actual merged content.
    items = merged_library["items"]
    retrieval_counts = Counter(x["retrievalRole"] for x in items)
    tier_counts = Counter(x["evidence"]["tier"] for x in items)
    merged_library["library"]["logicalItemCount"] = len(items)
    merged_library["library"]["primaryResearchPriorCount"] = sum(1 for x in items if x["retrievalRole"] == "primary_prior")
    merged_library["library"]["synthesisItemCount"] = sum(1 for x in items if x["retrievalRole"] != "primary_prior")
    merged_library["library"]["retrievalRoleCounts"] = dict(sorted(retrieval_counts.items()))
    merged_library["library"]["evidenceTierCounts"] = dict(sorted(tier_counts.items()))
    merged_library["library"]["independentStudyWeightEligibleCount"] = sum(
        1 for x in items if x["evidence"].get("independentStudyWeightEligible")
    )
    merged_library["library"]["directMarketCalibrationEvidenceEligibleCount"] = sum(
        1 for x in items if x["evidence"].get("directMarketCalibrationEvidenceEligible")
    )

    # Build a staging-only corrected registry. The production v1.7 registry is never written.
    merged_registry = json.loads(json.dumps(base_registry))
    merged_registry["libraryVersion"] = "1.8-candidate-r1"
    merged_registry["generatedAtUtc"] = "2026-08-16T03:52:00Z"
    merged_registry["candidateBuildId"] = BUILD_ID
    by_id = {x["sourceId"]: x for x in merged_registry["sources"]}
    for correction in registry_delta.get("corrections", []):
        sid = correction["baseSourceId"]
        if sid not in by_id:
            raise RuntimeError(f"Correction target missing: {sid}")
        record = by_id[sid]
        if record.get("doi") != correction["baseIdentifier"]:
            raise RuntimeError(f"Correction base identifier mismatch for {sid}")
        record["doi"] = correction["correctedIdentifier"]
        record["v18ProvenanceCorrection"] = {
            "priorIdentifier": correction["baseIdentifier"],
            "correctedIdentifier": correction["correctedIdentifier"],
            "reason": "Candidate Freeze R2 registry metadata correction; v1.7 remains immutable.",
        }

    existing_keys = {source_identifier_key(x): x["sourceId"] for x in merged_registry["sources"]}
    for src in registry_delta["newSources"]:
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
        for key in ("status", "overlapCluster", "auditArtifacts"):
            if key in src:
                record[key] = src[key]
        key = source_identifier_key(record)
        if key in existing_keys:
            raise RuntimeError(f"Unexpected source collision {key}: {src['sourceId']} vs {existing_keys[key]}")
        if record["sourceId"] in by_id:
            raise RuntimeError(f"Duplicate sourceId: {record['sourceId']}")
        merged_registry["sources"].append(record)
        by_id[record["sourceId"]] = record
        existing_keys[key] = record["sourceId"]
    merged_registry["sourceCount"] = len(merged_registry["sources"])

    # Build staging-only candidate taxonomy from immutable v1.7 + the frozen R2 cluster delta.
    merged_taxonomy = json.loads(json.dumps(base_taxonomy))
    merged_taxonomy["libraryVersion"] = "1.8-candidate-r1"
    merged_taxonomy["generatedAtUtc"] = "2026-08-16T03:52:00Z"
    merged_taxonomy["candidateBuildId"] = BUILD_ID
    sports = merged_taxonomy["controlledValues"]["sports"]
    if "WNBA" not in sports:
        sports.append("WNBA")
    for cid, cluster in cluster_delta["clusters"].items():
        if cid in merged_taxonomy["evidenceClusters"]:
            raise RuntimeError(f"Cluster collision: {cid}")
        merged_taxonomy["evidenceClusters"][cid] = cluster

    # Source and cluster counts after materialization.
    merged_library["library"]["sourceRegistryCount"] = merged_registry["sourceCount"]
    merged_library["library"]["evidenceClusterCount"] = len(merged_taxonomy["evidenceClusters"])

    write_json(OUT_LIBRARY, merged_library)
    write_json(OUT_REGISTRY, merged_registry)
    write_json(OUT_TAXONOMY, merged_taxonomy)

    manifest = {
        "schema": 1,
        "buildId": BUILD_ID,
        "state": "STAGING_ONLY_NOT_RUNTIME_AUTHORITY",
        "activeProductionLibrary": "1.7",
        "targetLibraryVersion": "1.8",
        "candidateFreezeId": FREEZE_ID,
        "predeclaredTestSuiteId": TEST_SUITE_ID,
        "productionManifestModified": False,
        "productionHistoryFitModified": False,
        "artifacts": {
            "library": str(OUT_LIBRARY.relative_to(ROOT)),
            "sourceRegistry": str(OUT_REGISTRY.relative_to(ROOT)),
            "taxonomy": str(OUT_TAXONOMY.relative_to(ROOT)),
            "historyFitPolicy": str(BASE_POLICY.relative_to(ROOT)),
            "testSuite": str(TEST_SUITE.relative_to(ROOT)),
        },
        "baseGitBlobSha": {
            "library": git_blob_sha(BASE_LIBRARY),
            "sourceRegistry": git_blob_sha(BASE_REGISTRY),
            "taxonomy": git_blob_sha(BASE_TAXONOMY),
            "historyFitPolicy": git_blob_sha(BASE_POLICY),
        },
        "inventory": {
            "baseLogicalItems": len(base_library["items"]),
            "r2DeltaLogicalItems": len(converted),
            "mergedLogicalItems": len(merged_library["items"]),
            "mergedSources": merged_registry["sourceCount"],
            "mergedEvidenceClusters": len(merged_taxonomy["evidenceClusters"]),
        },
    }
    write_json(OUT_MANIFEST, manifest)

    checksums = {
        "schema": 1,
        "buildId": BUILD_ID,
        "state": "STAGING_MERGED_CANDIDATE_CHECKSUMS",
        "algorithm": "sha256",
        "files": [],
    }
    for path in (OUT_LIBRARY, OUT_REGISTRY, OUT_TAXONOMY, OUT_MANIFEST):
        checksums["files"].append({
            "path": str(path.relative_to(ROOT)),
            "sha256": sha256(path),
            "bytes": path.stat().st_size,
        })
    write_json(OUT_CHECKSUMS, checksums)

    OUT_MD.write_text(
        "# Betting Edge Research Library v1.8 — Merged Candidate R1\n\n"
        f"**Build ID:** `{BUILD_ID}`  \n"
        "**State:** STAGING ONLY — NOT RUNTIME AUTHORITY  \n"
        "**Active production library:** v1.7\n\n"
        "## Materialization\n\n"
        f"- Immutable v1.7 base logical items: **{len(base_library['items'])}**\n"
        f"- Candidate Freeze R2 delta items: **{len(converted)}**\n"
        f"- Merged candidate logical items: **{len(merged_library['items'])}**\n"
        f"- Merged candidate source records: **{merged_registry['sourceCount']}**\n"
        f"- Merged candidate evidence clusters: **{len(merged_taxonomy['evidenceClusters'])}**\n"
        "- WNBA added only to the staging candidate taxonomy.\n"
        "- Shank 2022 DOI corrected only in the staging candidate registry.\n\n"
        "## Boundary\n\n"
        "`research/manifest.json`, `research/research-library.json`, `research/source-registry.json`, "
        "`research/taxonomy.json`, scheduled prompts, runner, production contract and live History Fit remain unchanged.\n\n"
        "## Next gate\n\n"
        "Run the already-frozen History Fit test suite plus the 24/24 R2 structural inventory check. "
        "Do not alter the frozen test definitions to accommodate candidate outputs.\n",
        encoding="utf-8",
    )

    print(json.dumps(manifest["inventory"], indent=2))


if __name__ == "__main__":
    main()

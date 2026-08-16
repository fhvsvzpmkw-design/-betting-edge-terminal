#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STAGING = ROOT / "research" / "staging"
PACKAGE_ID = "v1.8-promotion-candidate-r1-2026-08-15"
BUILD_ID = "v1.8-merged-candidate-r1-2026-08-15"
FREEZE_ID = "v1.8-candidate-freeze-2026-08-15-r2"
SUITE_ID = "v1.8-history-fit-predeclared-r1-2026-08-15"

FILES = [
    STAGING / "V1_8_CANDIDATE_FREEZE_R2_2026-08-15.json",
    STAGING / "V1_8_CANDIDATE_SOURCE_REGISTRY_DELTA_R2_2026-08-15.json",
    STAGING / "V1_8_CANDIDATE_EVIDENCE_CLUSTERS_R2_2026-08-15.json",
    STAGING / "V1_8_CANDIDATE_FREEZE_R2_RECONCILIATION_2026-08-15.json",
    STAGING / "V1_8_HISTORY_FIT_TEST_SUITE_R1_2026-08-15.json",
    STAGING / "V1_8_MERGED_CANDIDATE_LIBRARY_R1_2026-08-15.json",
    STAGING / "V1_8_MERGED_CANDIDATE_SOURCE_REGISTRY_R1_2026-08-15.json",
    STAGING / "V1_8_MERGED_CANDIDATE_TAXONOMY_R1_2026-08-15.json",
    STAGING / "V1_8_MERGED_CANDIDATE_MANIFEST_R1_2026-08-15.json",
    STAGING / "V1_8_MERGED_CANDIDATE_STRUCTURAL_TEST_RESULTS_R1_2026-08-15.json",
    STAGING / "V1_8_HISTORY_FIT_NARRATIVE_TEST_RESULTS_R1_2026-08-15.json",
]

PROD = [
    ROOT / "research" / "manifest.json",
    ROOT / "research" / "research-library.json",
    ROOT / "research" / "source-registry.json",
    ROOT / "research" / "taxonomy.json",
    ROOT / "research" / "history-fit-policy.json",
]

OUT = STAGING / "V1_8_PROMOTION_CANDIDATE_PACKAGE_R1_2026-08-15.json"
OUT_SUMS = STAGING / "V1_8_PROMOTION_CANDIDATE_CHECKSUMS_R1_2026-08-15.json"
OUT_MD = STAGING / "V1_8_PROMOTION_CANDIDATE_PACKAGE_R1_2026-08-15.md"


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_blob_sha(path):
    data = path.read_bytes()
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def main():
    for path in FILES + PROD:
        if not path.exists():
            raise RuntimeError(f"Missing required artifact: {path}")

    freeze = load(FILES[0])
    suite = load(STAGING / "V1_8_HISTORY_FIT_TEST_SUITE_R1_2026-08-15.json")
    merged = load(STAGING / "V1_8_MERGED_CANDIDATE_LIBRARY_R1_2026-08-15.json")
    structural = load(STAGING / "V1_8_MERGED_CANDIDATE_STRUCTURAL_TEST_RESULTS_R1_2026-08-15.json")
    narrative = load(STAGING / "V1_8_HISTORY_FIT_NARRATIVE_TEST_RESULTS_R1_2026-08-15.json")
    prod_library = load(ROOT / "research" / "research-library.json")
    prod_registry = load(ROOT / "research" / "source-registry.json")
    prod_taxonomy = load(ROOT / "research" / "taxonomy.json")

    checks = {
        "freezeIdCorrect": freeze.get("freezeId") == FREEZE_ID,
        "testSuiteIdCorrect": suite.get("testSuiteId") == SUITE_ID,
        "testSuiteWasPredeclared": suite.get("predeclaredBeforeMergedCandidate") is True,
        "mergedBuildIdCorrect": merged.get("library", {}).get("candidateBuildId") == BUILD_ID,
        "structuralTestsPass": structural.get("state") == "PASS",
        "all24R2ItemsPassInventory": structural.get("counts", {}).get("r2InventoryPassed") == 24,
        "narrativeTestsPass": narrative.get("state") == "PASS",
        "all15NarrativeCasesPass": narrative.get("summary", {}).get("retrievalCasesPassed") == 15,
        "all9BoundaryCasesPass": narrative.get("summary", {}).get("boundaryCasesPassed") == 9,
        "testDefinitionsUnmodified": narrative.get("testDefinitionsModified") is False,
        "productionLibraryStillV17": prod_library.get("library", {}).get("version") == "1.7",
        "productionRegistryStillV17": prod_registry.get("libraryVersion") == "1.7",
        "productionTaxonomyStillV17": prod_taxonomy.get("libraryVersion") == "1.7",
        "mergedCandidateNotRuntimeAuthority": merged.get("library", {}).get("status") == "STAGING_MERGED_CANDIDATE_NOT_RUNTIME_AUTHORITY",
    }
    failed = [k for k, v in checks.items() if not v]
    if failed:
        raise RuntimeError(f"Promotion-candidate package blocked by: {failed}")

    pinned = []
    for path in FILES:
        pinned.append({
            "path": str(path.relative_to(ROOT)),
            "sha256": sha256(path),
            "bytes": path.stat().st_size,
        })

    prod_pins = []
    for path in PROD:
        prod_pins.append({
            "path": str(path.relative_to(ROOT)),
            "gitBlobSha": git_blob_sha(path),
            "sha256": sha256(path),
            "bytes": path.stat().st_size,
        })

    package = {
        "schema": 1,
        "packageId": PACKAGE_ID,
        "targetLibraryVersion": "1.8",
        "state": "READY_FOR_EXPLICIT_PROMOTION_APPROVAL",
        "runtimeAuthority": False,
        "activeProductionLibrary": "1.7",
        "candidateBuildId": BUILD_ID,
        "candidateFreezeId": FREEZE_ID,
        "predeclaredTestSuiteId": SUITE_ID,
        "promotionHasOccurred": False,
        "explicitPromotionApprovalRequired": True,
        "checks": checks,
        "candidateArtifacts": pinned,
        "productionArtifactsPinnedUnchanged": prod_pins,
        "inventory": {
            "mergedLogicalItems": merged["library"]["logicalItemCount"],
            "mergedSources": merged["library"]["sourceRegistryCount"],
            "mergedEvidenceClusters": merged["library"]["evidenceClusterCount"],
            "r2DeltaItems": freeze["counts"]["admittedLogicalItems"],
            "narrativeCasesPassed": narrative["summary"]["retrievalCasesPassed"],
            "boundaryCasesPassed": narrative["summary"]["boundaryCasesPassed"],
        },
        "nonBlockingObservation": narrative.get("diagnosticObservation"),
        "promotionBoundary": {
            "doNotModifyUntilExplicitApproval": [
                "research/manifest.json",
                "research/research-library.json",
                "research/source-registry.json",
                "research/taxonomy.json",
                "scheduled report prompts",
                "runner",
                "production contract"
            ],
            "contractVersionChangeRequired": False,
            "productionContractRemainsCompatible": "0.9"
        }
    }
    OUT.write_text(json.dumps(package, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    sums = {
        "schema": 1,
        "packageId": PACKAGE_ID,
        "algorithm": "sha256",
        "files": [
            {"path": str(OUT.relative_to(ROOT)), "sha256": sha256(OUT), "bytes": OUT.stat().st_size}
        ] + pinned,
    }
    OUT_SUMS.write_text(json.dumps(sums, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    OUT_MD.write_text(
        "# Betting Edge Research Library v1.8 — Promotion Candidate Package R1\n\n"
        f"**Package:** `{PACKAGE_ID}`  \n"
        "**State:** **READY FOR EXPLICIT PROMOTION APPROVAL**  \n"
        "**Promotion performed:** NO  \n"
        "**Active production library:** v1.7\n\n"
        "## Final candidate gate\n\n"
        f"- Merged logical items: **{package['inventory']['mergedLogicalItems']}**\n"
        f"- Source records: **{package['inventory']['mergedSources']}**\n"
        f"- Evidence clusters: **{package['inventory']['mergedEvidenceClusters']}**\n"
        f"- Candidate Freeze R2 items: **{package['inventory']['r2DeltaItems']}/24**\n"
        f"- Frozen narrative tests: **{package['inventory']['narrativeCasesPassed']}/15 PASS**\n"
        f"- Hard-boundary tests: **{package['inventory']['boundaryCasesPassed']}/9 PASS**\n"
        "- Production research library/registry/taxonomy remain v1.7 and are hash-pinned unchanged.\n"
        "- Production manifest was not changed.\n\n"
        "## Approval boundary\n\n"
        "This package is a promotion candidate only. Changing the production research manifest/library remains a separate explicit approval step. Contract 0.9 does not need to change solely because Research Library v1.8 is promoted.\n",
        encoding="utf-8",
    )

    print(json.dumps({"state": package["state"], "checks": checks}, indent=2))


if __name__ == "__main__":
    main()

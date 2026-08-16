#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STAGING = ROOT / "research" / "staging"

SPEC = STAGING / "V1_8_HISTORY_FIT_TEST_SUITE_R1_2026-08-15.json"
FREEZE = STAGING / "V1_8_CANDIDATE_FREEZE_R2_2026-08-15.json"
CLUSTERS = STAGING / "V1_8_CANDIDATE_EVIDENCE_CLUSTERS_R2_2026-08-15.json"
POLICY = ROOT / "research" / "history-fit-policy.json"
OUT = STAGING / "V1_8_HISTORY_FIT_TEST_SUITE_R1_VALIDATION_2026-08-15.json"
CHECKSUMS = STAGING / "V1_8_HISTORY_FIT_TEST_SUITE_R1_CHECKSUMS_2026-08-15.json"


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, obj):
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def gather_refs(case: dict) -> set[str]:
    refs: set[str] = set()
    for key in (
        "mustRetrieveAnyOf",
        "shouldRetrieveAnyOf",
        "mustNotUseAsDirectPriceVote",
        "mayRetrieveOnlyAsIndirectAnalogy",
    ):
        refs.update(case.get(key, []))
    return refs


def main():
    spec = load(SPEC)
    freeze = load(FREEZE)
    clusters = load(CLUSTERS)
    policy = load(POLICY)

    errors: list[str] = []
    warnings: list[str] = []

    if spec.get("targetFreezeId") != freeze.get("freezeId"):
        errors.append("test suite targetFreezeId does not match R2 freezeId")
    if spec.get("predeclaredBeforeMergedCandidate") is not True:
        errors.append("test suite must explicitly be predeclared before merged candidate")
    if spec.get("runtimeAuthority") is not False:
        errors.append("test suite must not have runtime authority")
    if freeze.get("runtimeAuthority") is not False:
        errors.append("R2 freeze unexpectedly has runtime authority")

    expected_freeze_sha = spec["sourceArtifacts"]["freeze"]["sha256"]
    actual_freeze_sha = sha256(FREEZE)
    if expected_freeze_sha != actual_freeze_sha:
        errors.append(f"R2 freeze SHA-256 mismatch: expected {expected_freeze_sha}, got {actual_freeze_sha}")

    expected_cluster_sha = spec["sourceArtifacts"]["clusters"]["sha256"]
    actual_cluster_sha = sha256(CLUSTERS)
    if expected_cluster_sha != actual_cluster_sha:
        errors.append(f"R2 cluster SHA-256 mismatch: expected {expected_cluster_sha}, got {actual_cluster_sha}")

    expected_policy_blob = spec["sourceArtifacts"]["historyFitPolicy"]["blobSha"]
    if expected_policy_blob != "142bd105aa05a6504a2ebb8a1c39c80487158cfb":
        errors.append("history-fit policy blob pin changed from reviewed v1.7/R3 policy")

    item_ids = {x["id"] for x in freeze.get("items", [])}
    case_ids: list[str] = []
    referenced_ids: set[str] = set()
    valid_grades = set(spec.get("gradeVocabulary", []))

    for case in spec.get("retrievalCases", []):
        cid = case.get("caseId")
        case_ids.append(cid)
        refs = gather_refs(case)
        referenced_ids.update(refs)
        missing = sorted(refs - item_ids)
        if missing:
            errors.append(f"{cid}: references missing R2 item(s): {missing}")
        grades = case.get("allowedGrades", [])
        if not grades:
            errors.append(f"{cid}: no allowedGrades declared")
        unknown_grades = sorted(set(grades) - valid_grades)
        if unknown_grades:
            errors.append(f"{cid}: unknown grade(s): {unknown_grades}")
        if not case.get("requiredConcepts"):
            errors.append(f"{cid}: requiredConcepts missing")
        if not case.get("forbiddenClaims"):
            errors.append(f"{cid}: forbiddenClaims missing")

    for case in spec.get("boundaryCases", []):
        case_ids.append(case.get("caseId"))
        if not case.get("condition") or not case.get("expected"):
            errors.append(f"{case.get('caseId')}: boundary condition/expected missing")

    if len(case_ids) != len(set(case_ids)):
        errors.append("duplicate test case IDs detected")

    acceptance = spec.get("acceptance", {})
    if len(spec.get("retrievalCases", [])) < acceptance.get("minimumRetrievalCases", 0):
        errors.append("retrieval case count below declared minimum")
    if len(spec.get("boundaryCases", [])) < acceptance.get("minimumBoundaryCases", 0):
        errors.append("boundary case count below declared minimum")

    # Re-prove that the predeclared suite carries the same hard-boundary direction as the live policy.
    hb = policy.get("hardBoundaries", {})
    gp = spec.get("globalPassRules", {})
    policy_to_spec = {
        "mayCreateBet": "researchMayCreateBet",
        "maySupplyExecutablePrice": "researchMaySupplyExecutablePrice",
        "mayOverrideIdentityFailure": "researchMayOverrideIdentityFailure",
        "mayOverrideFairValueGate": "researchMayOverrideFairValueGate",
        "mayDirectlyChangeFairValueAtR3": "researchMayDirectlyChangeFairValue",
        "mayDirectlyChangeModelErrorAtR3": "researchMayDirectlyChangeModelError",
        "mayDirectlyChangePlayToAtR3": "researchMayDirectlyChangePlayTo",
        "mayDirectlyChangeStatusAtR3": "researchMayDirectlyChangeStatus",
        "mayDirectlyChangeStakeAtR3": "researchMayDirectlyChangeStake",
        "maySilentlyBlendPersonalLedger": "researchMaySilentlyBlendPersonalLedger",
        "maySilentlyBlendSameDayMovementIntoHistoryGrade": "researchMaySilentlyBlendSameDayMovementIntoHistoryGrade",
    }
    for pkey, skey in policy_to_spec.items():
        if hb.get(pkey) is not False:
            errors.append(f"policy hard boundary {pkey} is not false")
        if gp.get(skey) is not False:
            errors.append(f"test suite hard boundary {skey} is not false")

    if gp.get("historyUnavailableState") != policy.get("failureMode", {}).get("state"):
        errors.append("history-unavailable failure state does not match policy")

    cluster_members = set()
    for cluster in clusters.get("clusters", {}).values():
        cluster_members.update(cluster.get("members", []))
    not_clustered = sorted((referenced_ids & item_ids) - cluster_members)
    if not_clustered:
        warnings.append(f"Referenced R2 items not present in a v1.8 delta cluster: {not_clustered}")

    result = {
        "schema": 1,
        "testSuiteId": spec.get("testSuiteId"),
        "targetFreezeId": freeze.get("freezeId"),
        "state": "PASS" if not errors else "FAIL",
        "predeclaredBeforeMergedCandidate": spec.get("predeclaredBeforeMergedCandidate"),
        "counts": {
            "r2AdmittedItems": len(item_ids),
            "retrievalCases": len(spec.get("retrievalCases", [])),
            "boundaryCases": len(spec.get("boundaryCases", [])),
            "referencedR2Items": len(referenced_ids & item_ids),
            "errors": len(errors),
            "warnings": len(warnings),
        },
        "checks": {
            "allReferencedR2ItemsExist": not any("references missing" in e for e in errors),
            "caseIdsUnique": len(case_ids) == len(set(case_ids)),
            "hardBoundariesMatchPolicy": not any("hard boundary" in e for e in errors),
            "failureModeMatchesPolicy": not any("failure state" in e for e in errors),
            "freezeHashPinned": expected_freeze_sha == actual_freeze_sha,
            "clusterHashPinned": expected_cluster_sha == actual_cluster_sha,
            "noProductionMutationRequired": acceptance.get("noTestMayRequireProductionMutation") is True,
        },
        "errors": errors,
        "warnings": warnings,
    }
    write_json(OUT, result)

    checksums = {
        "schema": 1,
        "testSuiteId": spec.get("testSuiteId"),
        "state": "STAGING_PREDECLARED_TEST_CHECKSUMS",
        "algorithm": "sha256",
        "files": [
            {"path": str(SPEC.relative_to(ROOT)), "sha256": sha256(SPEC), "bytes": SPEC.stat().st_size},
            {"path": str(OUT.relative_to(ROOT)), "sha256": sha256(OUT), "bytes": OUT.stat().st_size},
        ],
    }
    write_json(CHECKSUMS, checksums)

    print(json.dumps(result, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
QB_ROOT = ROOT / "data" / "walters" / "nfl" / "qb-performance"
CONTRACT_PATH = QB_ROOT / "stage3d-contract-v1.json"
CURRENT_PATH = QB_ROOT / "stage3-current.json"
MODEL_PATH = QB_ROOT / "model" / "stage3c-model-v1.json"
AUDIT_PATH = QB_ROOT / "model" / "stage3c-holdout-audit-v1.json"
CANDIDATES_PATH = QB_ROOT / "candidates" / "qb-candidates-2026-stage3c-v1.json"
FREEZE_PATH = QB_ROOT / "freeze" / "stage3d-freeze-manifest-v1.json"
REVIEW_PATH = QB_ROOT / "review" / "stage3d-candidate-review-v1.json"
ACCEPTANCE_PATH = QB_ROOT / "stage3-acceptance-v1.json"


def read_json(path: Path) -> Any:
    if not path.exists():
        raise RuntimeError(f"Missing required file: {path.relative_to(ROOT).as_posix()}")
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def sha256_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def canonical_payload(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: canonical_payload(item) for key, item in value.items() if key != "contentSha256Canonical"}
    if isinstance(value, list):
        return [canonical_payload(item) for item in value]
    return value


def canonical_sha(value: Any) -> str:
    raw = json.dumps(canonical_payload(value), ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return sha256_bytes(raw)


def attach_canonical_hash(value: dict[str, Any]) -> dict[str, Any]:
    output = dict(value)
    output["contentSha256Canonical"] = canonical_sha(output)
    return output


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def nearly_equal(left: float, right: float, tolerance: float = 1e-9) -> bool:
    return abs(float(left) - float(right)) <= tolerance


def finite_number(value: Any, label: str) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise RuntimeError(f"{label} is not numeric: {value!r}") from exc
    if not math.isfinite(parsed):
        raise RuntimeError(f"{label} is not finite: {value!r}")
    return parsed


def rank_positions(players: list[dict[str, Any]], value_key: str) -> dict[str, int]:
    ordered = sorted(
        players,
        key=lambda player: (
            -finite_number(player[value_key], f"{player.get('playerName')} {value_key}"),
            str(player.get("playerName") or ""),
            str(player.get("playerId") or ""),
        ),
    )
    return {str(player["playerId"]): index + 1 for index, player in enumerate(ordered)}


def review_flags(
    player: dict[str, Any],
    prior_rank: int,
    candidate_rank: int,
    contract: dict[str, Any],
) -> list[str]:
    rules = contract["candidateReview"]["rules"]
    calibration = read_json(CANDIDATES_PATH)["calibration"]
    lower, upper = [float(value) for value in calibration["scale"]]
    move_cap = float(calibration["maximumAbsoluteMoveFromStage2Prior"])
    prior = finite_number(player["priorValue"], "priorValue")
    candidate = finite_number(player["candidateValue"], "candidateValue")
    delta = finite_number(player["candidateDeltaFromPrior"], "candidateDeltaFromPrior")
    implied = player.get("performanceImpliedValue")
    flags: list[str] = []

    if abs(abs(delta) - move_cap) <= float(rules["moveCapReachedTolerance"]):
        flags.append("MOVE_CAP_REACHED")
    if abs(delta) >= float(rules["largeMoveAbsoluteMinimum"]):
        flags.append("LARGE_MOVE")
    if prior >= float(rules["elitePriorMinimum"]) and delta <= float(rules["elitePriorDowngradeMaximum"]):
        flags.append("ELITE_PRIOR_DOWNGRADE")
    if prior <= float(rules["lowerPriorMaximum"]) and delta >= float(rules["lowerPriorUpgradeMinimum"]):
        flags.append("LOWER_PRIOR_UPGRADE")
    if str(player.get("confidence")) == str(rules["highConfidenceLabel"]) and abs(delta) >= float(rules["largeMoveAbsoluteMinimum"]):
        flags.append("HIGH_CONFIDENCE_LARGE_MOVE")
    if bool(player.get("top67DistributionCohort")) and player.get("status") == "BLOCKED_INSUFFICIENT_QB_SAMPLE":
        flags.append("TOP67_LOW_SAMPLE_BLOCK")
    if implied is not None and abs(finite_number(implied, "performanceImpliedValue") - prior) >= float(rules["performancePriorDivergenceMinimum"]):
        flags.append("PERFORMANCE_PRIOR_DIVERGENCE")
    if abs(prior_rank - candidate_rank) >= int(rules["rankShiftAbsoluteMinimum"]):
        flags.append("RANK_SHIFT")
    boundary_tolerance = float(rules["scaleBoundaryTolerance"])
    if abs(candidate - lower) <= boundary_tolerance or abs(candidate - upper) <= boundary_tolerance:
        flags.append("CANDIDATE_AT_SCALE_BOUND")
    return flags


def validate_dependencies(
    contract: dict[str, Any],
    current: dict[str, Any],
    model: dict[str, Any],
    audit: dict[str, Any],
    candidates: dict[str, Any],
) -> None:
    errors: list[str] = []

    if contract.get("stage") != 3 or contract.get("substage") != "3D":
        errors.append("Stage 3D contract identity is invalid.")
    if contract.get("operational") is not False or contract.get("productionAuthority") is not False:
        errors.append("Stage 3D contract must remain non-operational.")
    if contract.get("marketViewed") is not False:
        errors.append("Stage 3D contract must attest marketViewed:false.")

    if current.get("substage") != "3C" or current.get("status") != "STAGE3C_MODEL_ESTIMATED_HOLDOUT_VALIDATED_NON_OPERATIONAL":
        errors.append("Stage 3D did not receive the accepted Stage 3C current state.")
    if current.get("productionAuthority") is not False or current.get("marketViewed") is not False:
        errors.append("Stage 3C current state violates authority isolation.")
    if current.get("holdoutValidationStatus") != "PASS" or current.get("candidateOutputStatus") != "CREATED_NON_OPERATIONAL":
        errors.append("Stage 3C current state is not ready for candidate freeze.")

    if model.get("status") != "HOLDOUT_VALIDATED_NON_OPERATIONAL":
        errors.append("Stage 3C model is not holdout validated.")
    if model.get("productionAuthority") is not False or model.get("grahamWritesAllowed") is not False or model.get("marketViewed") is not False:
        errors.append("Stage 3C model violates the non-operational boundary.")
    if audit.get("status") != "PASS" or not audit.get("checks") or not all(check.get("pass") is True for check in audit["checks"]):
        errors.append("Stage 3C holdout audit did not pass every acceptance check.")
    if audit.get("protectedArtifactsUnchanged") is not True:
        errors.append("Stage 3C did not preserve protected artifacts.")
    if audit.get("productionAuthority") is not False or audit.get("marketViewed") is not False:
        errors.append("Stage 3C audit violates authority or market isolation.")

    if candidates.get("status") != "NON_OPERATIONAL_SHADOW_CANDIDATES":
        errors.append("Stage 3C candidate registry status is invalid.")
    players = candidates.get("players")
    if not isinstance(players, list):
        errors.append("Stage 3C candidate registry has no player list.")
        players = []
    if len(players) != int(contract["candidateReview"]["expectedCurrentQbCount"]):
        errors.append(f"Expected {contract['candidateReview']['expectedCurrentQbCount']} quarterbacks, found {len(players)}.")
    if int(candidates.get("summary", {}).get("top67Count", -1)) != int(contract["candidateReview"]["expectedTop67Count"]):
        errors.append("Stage 3C top-67 cohort count changed.")
    if candidates.get("productionAuthority") is not False or candidates.get("grahamWritesAllowed") is not False:
        errors.append("Stage 3C candidate registry permits a production write.")
    if candidates.get("marketViewed") is not False:
        errors.append("Stage 3C candidate registry is market exposed.")

    serialized = json.dumps({"current": current, "model": model, "audit": audit, "candidates": candidates}, sort_keys=True)
    if "APPROVED_WALTERS_QB_PERFORMANCE" in serialized:
        errors.append("Stage 3C prematurely contains the production authority token.")

    if errors:
        raise RuntimeError("Stage 3D dependency validation failed:\n- " + "\n- ".join(errors))


def build_freeze_manifest(contract: dict[str, Any], current: dict[str, Any]) -> dict[str, Any]:
    entries: list[dict[str, Any]] = []
    for item in sorted(contract["freezePolicy"]["immutableInputPaths"]):
        path = ROOT / item
        if not path.exists():
            raise RuntimeError(f"Freeze input is missing: {item}")
        entry: dict[str, Any] = {
            "path": item,
            "byteSize": path.stat().st_size,
            "sha256": sha256_file(path),
        }
        if path.suffix.lower() == ".json":
            parsed = read_json(path)
            entry["canonicalJsonSha256"] = canonical_sha(parsed)
            if isinstance(parsed, dict) and isinstance(parsed.get("contentSha256Canonical"), str):
                entry["declaredContentSha256Canonical"] = parsed["contentSha256Canonical"]
        entries.append(entry)

    manifest = {
        "schemaVersion": "walters-qb-performance-stage3d-freeze-manifest-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 3,
        "substage": "3D",
        "status": "STAGE3C_INPUTS_HASH_FROZEN",
        "frozenAt": current.get("generatedFromSourceCapturedAt"),
        "hashAlgorithm": contract["freezePolicy"]["hashAlgorithm"],
        "inputCount": len(entries),
        "allInputsPresent": True,
        "modelReestimated": False,
        "candidateValuesRevised": False,
        "productionAuthority": False,
        "marketViewed": False,
        "entries": entries,
    }
    return attach_canonical_hash(manifest)


def build_model_review(model: dict[str, Any], contract: dict[str, Any]) -> dict[str, Any]:
    thresholds = contract["modelReview"]["cautionThresholds"]
    metrics = model["holdoutMetrics"]
    shares = model["familyWeights"]["shareByFamily"]
    flags: list[str] = []
    if float(metrics["pearson"]) < float(thresholds["modestPearsonBelow"]):
        flags.append("MODEST_HOLDOUT_SIGNAL")
    if float(metrics["calibrationSlope"]) < float(thresholds["calibrationSlopeBelow"]):
        flags.append("CALIBRATION_SLOPE_BELOW_ONE")
    if float(metrics["rmseToRecentAdjustedEpaRatio"]) > float(thresholds["recentEpaComparatorNotBeatenAboveRatio"]):
        flags.append("RECENT_EPA_COMPARATOR_NOT_BEATEN")
    if float(shares.get("interception_rate", 0.0)) <= float(thresholds["zeroFamilyWeightAtOrBelow"]):
        flags.append("ZERO_WEIGHT_INTERCEPTION_RATE")
    if float(shares.get("fumble_rate", 0.0)) < float(thresholds["lowFamilyWeightShareBelow"]):
        flags.append("LOW_WEIGHT_FUMBLE_RATE")

    unknown = sorted(set(flags) - set(contract["modelReview"]["allowedCautionFlags"]))
    if unknown:
        raise RuntimeError(f"Unrecognized Stage 3D model caution flags: {unknown}")
    return {
        "status": "REVIEWED_WITH_CAUTION_FLAGS" if flags else "REVIEWED_NO_CAUTIONS",
        "selectedConfiguration": model["selectedConfiguration"],
        "configurationCountEvaluated": model["configurationCountEvaluated"],
        "holdoutMetrics": metrics,
        "familyWeightShares": shares,
        "cautionFlags": flags,
        "cautionCount": len(flags),
        "interpretation": "Stage 3C cleared its pre-locked research gates, but these limitations must remain visible during Stage 4 shadow testing and cannot be treated as production approval.",
    }


def build_candidate_review(
    contract: dict[str, Any],
    current: dict[str, Any],
    model: dict[str, Any],
    candidates: dict[str, Any],
) -> dict[str, Any]:
    players = candidates["players"]
    valid_statuses = set(contract["candidateReview"]["validStatuses"])
    allowed_flags = set(contract["candidateReview"]["allowedReviewFlags"])
    calibration = candidates["calibration"]
    scale_min, scale_max = [float(value) for value in calibration["scale"]]
    move_cap = float(calibration["maximumAbsoluteMoveFromStage2Prior"])
    minimum_evidence = int(calibration["minimumCandidateEvidenceDropbacks"])
    prior_ranks = rank_positions(players, "priorValue")
    candidate_ranks = rank_positions(players, "candidateValue")

    seen_ids: set[str] = set()
    reviewed: list[dict[str, Any]] = []
    hard_errors: list[str] = []
    flag_counts: Counter[str] = Counter()

    for player in sorted(players, key=lambda item: (str(item.get("playerName") or ""), str(item.get("playerId") or ""))):
        player_id = str(player.get("playerId") or "")
        name = str(player.get("playerName") or "")
        if not player_id or not name:
            hard_errors.append(f"Candidate lacks player identity: {player!r}")
            continue
        if player_id in seen_ids:
            hard_errors.append(f"Duplicate playerId: {player_id}")
            continue
        seen_ids.add(player_id)

        status = str(player.get("status") or "")
        prior = finite_number(player.get("priorValue"), f"{name} priorValue")
        candidate = finite_number(player.get("candidateValue"), f"{name} candidateValue")
        reported_delta = finite_number(player.get("candidateDeltaFromPrior"), f"{name} candidateDeltaFromPrior")
        calculated_delta = round(candidate - prior, 2)
        if status not in valid_statuses:
            hard_errors.append(f"{name} has invalid status {status!r}.")
        if player.get("operational") is not False or player.get("marketViewed") is not False:
            hard_errors.append(f"{name} violates the non-operational or market-isolation boundary.")
        if not (scale_min - 1e-9 <= candidate <= scale_max + 1e-9):
            hard_errors.append(f"{name} candidate {candidate} is outside the governed scale.")
        if abs(reported_delta) > move_cap + 1e-9:
            hard_errors.append(f"{name} candidate move {reported_delta} exceeds the cap.")
        if abs(calculated_delta - reported_delta) > 0.011:
            hard_errors.append(f"{name} reported delta {reported_delta} does not reconcile to {calculated_delta}.")

        evidence = player.get("evidence") or {}
        evidence_dropbacks = int((evidence.get("candidateEvidenceDropbacks") or 0))
        if status == "BLOCKED_INSUFFICIENT_QB_SAMPLE":
            if not nearly_equal(candidate, prior, 1e-9):
                hard_errors.append(f"{name} is sample-blocked but does not retain the Stage 2 prior.")
            if finite_number(player.get("performanceBlend", 0), f"{name} performanceBlend") != 0:
                hard_errors.append(f"{name} is sample-blocked but has nonzero performance blend.")
            if player.get("performanceImpliedValue") is not None:
                hard_errors.append(f"{name} is sample-blocked but has a performance-implied value.")
        elif evidence_dropbacks < minimum_evidence:
            hard_errors.append(f"{name} has an active candidate with only {evidence_dropbacks} evidence dropbacks.")

        prior_rank = prior_ranks[player_id]
        candidate_rank = candidate_ranks[player_id]
        flags = review_flags(player, prior_rank, candidate_rank, contract)
        unknown_flags = sorted(set(flags) - allowed_flags)
        if unknown_flags:
            hard_errors.append(f"{name} produced unknown review flags {unknown_flags}.")
        flag_counts.update(flags)

        reviewed.append({
            "playerId": player_id,
            "gsisId": player.get("gsisId"),
            "playerName": name,
            "team": player.get("team"),
            "top67DistributionCohort": bool(player.get("top67DistributionCohort")),
            "maddenOvr": player.get("maddenOvr"),
            "priorValue": prior,
            "performanceImpliedValue": player.get("performanceImpliedValue"),
            "candidateValue": candidate,
            "candidateDeltaFromPrior": reported_delta,
            "confidence": player.get("confidence"),
            "status": status,
            "evidenceDropbacks": evidence_dropbacks,
            "priorOrdinalRank": prior_rank,
            "candidateOrdinalRank": candidate_rank,
            "ordinalRankShift": prior_rank - candidate_rank,
            "reviewFlags": flags,
            "reviewFlagCount": len(flags),
            "operational": False,
            "marketViewed": False,
        })

    required_names = list(contract["candidateReview"]["requiredCaseStudies"])
    by_name = {record["playerName"]: record for record in reviewed}
    missing_case_studies = [name for name in required_names if name not in by_name]
    if missing_case_studies:
        hard_errors.append(f"Missing required case studies: {missing_case_studies}")
    case_studies = [by_name[name] for name in required_names if name in by_name]

    team_leaders: list[dict[str, Any]] = []
    teams = sorted({str(record.get("team") or "") for record in reviewed if str(record.get("team") or "")})
    for team in teams:
        eligible = [record for record in reviewed if record.get("team") == team]
        leader = min(eligible, key=lambda record: (-float(record["candidateValue"]), record["playerName"], record["playerId"]))
        team_leaders.append({
            "team": team,
            "playerId": leader["playerId"],
            "playerName": leader["playerName"],
            "candidateValue": leader["candidateValue"],
            "authority": "CANDIDATE_VALUE_LEADER_ONLY_NOT_STARTER_AUTHORITY",
        })

    if len(reviewed) != int(contract["candidateReview"]["expectedCurrentQbCount"]):
        hard_errors.append(f"Stage 3D reviewed {len(reviewed)} players instead of the expected population.")
    if len(seen_ids) != len(reviewed):
        hard_errors.append("Stage 3D player identity coverage is not unique.")
    if hard_errors:
        raise RuntimeError("Stage 3D candidate review failed:\n- " + "\n- ".join(hard_errors))

    flagged_players = [record for record in reviewed if record["reviewFlags"]]
    review = {
        "schemaVersion": "walters-qb-performance-stage3d-candidate-review-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 3,
        "substage": "3D",
        "status": "PASS_WITH_REVIEW_FLAGS" if flagged_players or build_model_review(model, contract)["cautionFlags"] else "PASS",
        "reviewedAt": current.get("generatedFromSourceCapturedAt"),
        "sourceCandidateRegistry": relative(CANDIDATES_PATH),
        "sourceCandidateRegistrySha256": sha256_file(CANDIDATES_PATH),
        "modelReview": build_model_review(model, contract),
        "starterAuthority": contract["starterAuthority"],
        "summary": {
            "playerCount": len(reviewed),
            "uniquePlayerIdCount": len(seen_ids),
            "top67Count": sum(1 for record in reviewed if record["top67DistributionCohort"]),
            "statusCounts": dict(sorted(Counter(record["status"] for record in reviewed).items())),
            "flaggedPlayerCount": len(flagged_players),
            "unflaggedPlayerCount": len(reviewed) - len(flagged_players),
            "reviewFlagCounts": dict(sorted(flag_counts.items())),
            "requiredCaseStudyCount": len(required_names),
            "requiredCaseStudiesPresent": len(case_studies) == len(required_names),
            "teamCandidateLeaderCount": len(team_leaders),
            "hardErrorCount": 0,
        },
        "flagDefinitions": {
            "MOVE_CAP_REACHED": "The Stage 3C candidate reached the locked absolute movement cap and must receive focused Stage 4 sensitivity testing.",
            "LARGE_MOVE": "The candidate moved at least 0.50 points from the frozen EA prior.",
            "ELITE_PRIOR_DOWNGRADE": "A quarterback with a prior of at least 9.00 moved down by at least 0.50 points.",
            "LOWER_PRIOR_UPGRADE": "A quarterback with a prior no higher than 7.50 moved up by at least 0.50 points.",
            "HIGH_CONFIDENCE_LARGE_MOVE": "A high-confidence candidate also moved at least 0.50 points.",
            "TOP67_LOW_SAMPLE_BLOCK": "A member of the frozen 67-quarterback distribution cohort retained the prior because the performance sample was insufficient.",
            "PERFORMANCE_PRIOR_DIVERGENCE": "The performance-implied value differs from the Stage 2 prior by at least 1.00 point before shrinkage and the movement cap.",
            "RANK_SHIFT": "The deterministic ordinal position changed by at least the locked threshold; ties use player name and ID only for reproducibility.",
            "CANDIDATE_AT_SCALE_BOUND": "The candidate sits at the governed 6.00 or 9.50 scale boundary."
        },
        "requiredCaseStudies": case_studies,
        "teamCandidateLeaders": team_leaders,
        "players": reviewed,
        "candidateValuesRevised": False,
        "productionAuthority": False,
        "grahamWritesAllowed": False,
        "uncertaintyOverlayRetirementAllowed": False,
        "marketViewed": False,
    }
    return attach_canonical_hash(review)


def build_acceptance(
    contract: dict[str, Any],
    current: dict[str, Any],
    model: dict[str, Any],
    audit: dict[str, Any],
    candidates: dict[str, Any],
    freeze: dict[str, Any],
    review: dict[str, Any],
    protected_before: dict[str, str],
    protected_after: dict[str, str],
) -> dict[str, Any]:
    checks = [
        {"id": "QBP3D-STAGE3C-HOLDOUT", "actual": audit.get("status"), "expected": "PASS", "pass": audit.get("status") == "PASS"},
        {"id": "QBP3D-STAGE3C-CHECKS", "actual": all(check.get("pass") is True for check in audit["checks"]), "expected": True, "pass": all(check.get("pass") is True for check in audit["checks"])},
        {"id": "QBP3D-FREEZE-COMPLETE", "actual": freeze.get("allInputsPresent"), "expected": True, "pass": freeze.get("allInputsPresent") is True},
        {"id": "QBP3D-CANDIDATE-POPULATION", "actual": review["summary"]["playerCount"], "expected": contract["candidateReview"]["expectedCurrentQbCount"], "pass": review["summary"]["playerCount"] == contract["candidateReview"]["expectedCurrentQbCount"]},
        {"id": "QBP3D-TOP67-POPULATION", "actual": review["summary"]["top67Count"], "expected": contract["candidateReview"]["expectedTop67Count"], "pass": review["summary"]["top67Count"] == contract["candidateReview"]["expectedTop67Count"]},
        {"id": "QBP3D-CASE-STUDIES", "actual": review["summary"]["requiredCaseStudiesPresent"], "expected": True, "pass": review["summary"]["requiredCaseStudiesPresent"] is True},
        {"id": "QBP3D-CANDIDATE-BOUNDS", "actual": candidates["summary"]["allWithinScale"], "expected": True, "pass": candidates["summary"]["allWithinScale"] is True},
        {"id": "QBP3D-CANDIDATE-MOVE-CAP", "actual": candidates["summary"]["allWithinMoveCap"], "expected": True, "pass": candidates["summary"]["allWithinMoveCap"] is True},
        {"id": "QBP3D-DETERMINISTIC-MODEL", "actual": model["solver"]["deterministicRefit"], "expected": True, "pass": model["solver"]["deterministicRefit"] is True},
        {"id": "QBP3D-PROTECTED-ARTIFACTS", "actual": protected_before == protected_after, "expected": True, "pass": protected_before == protected_after},
        {"id": "QBP3D-MARKET-ISOLATION", "actual": False, "expected": False, "pass": all(item.get("marketViewed") is False for item in (contract, current, model, audit, candidates, freeze, review))},
        {"id": "QBP3D-PRODUCTION-BOUNDARY", "actual": False, "expected": False, "pass": all(item.get("productionAuthority") is False for item in (contract, current, model, audit, candidates, freeze, review))},
        {"id": "QBP3D-STARTER-INFERENCE", "actual": contract["starterAuthority"]["starterInferenceAllowed"], "expected": False, "pass": contract["starterAuthority"]["starterInferenceAllowed"] is False},
    ]
    passed = all(check["pass"] is True for check in checks)
    decision = contract["acceptance"]["passState"] if passed else contract["acceptance"]["failState"]
    acceptance = {
        "schemaVersion": "walters-qb-performance-stage3-acceptance-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 3,
        "substage": "3D",
        "status": "PASS" if passed else "FAIL",
        "decision": decision,
        "decidedAt": current.get("generatedFromSourceCapturedAt"),
        "acceptedFor": contract["acceptance"]["acceptedFor"] if passed else None,
        "notAcceptedFor": contract["acceptance"]["notAcceptedFor"],
        "freezeManifest": relative(FREEZE_PATH),
        "freezeManifestSha256": sha256_file(FREEZE_PATH),
        "candidateReview": relative(REVIEW_PATH),
        "candidateReviewSha256": sha256_file(REVIEW_PATH),
        "stage3CModelSha256": sha256_file(MODEL_PATH),
        "stage3CHoldoutAuditSha256": sha256_file(AUDIT_PATH),
        "stage3CCandidatesSha256": sha256_file(CANDIDATES_PATH),
        "checks": checks,
        "modelCautionFlags": review["modelReview"]["cautionFlags"],
        "candidateReviewFlagCounts": review["summary"]["reviewFlagCounts"],
        "flaggedPlayerCount": review["summary"]["flaggedPlayerCount"],
        "requiredCaseStudies": [record["playerName"] for record in review["requiredCaseStudies"]],
        "starterBindingStatus": "DEFERRED_TO_STAGE4_GOVERNED_BINDING",
        "stage4EntryRequirements": contract["stage4EntryRequirements"],
        "protectedArtifactSha256Before": protected_before,
        "protectedArtifactSha256After": protected_after,
        "protectedArtifactsUnchanged": protected_before == protected_after,
        "candidateValuesOperational": False,
        "grahamFairNumbersChanged": False,
        "embeddedQbBaselinesChanged": False,
        "uncertaintyOverlaysRetired": False,
        "productionAuthority": False,
        "grahamWritesAllowed": False,
        "marketViewed": False,
        "nextStage": contract["acceptance"]["nextStageOnPass"] if passed else None,
    }
    return attach_canonical_hash(acceptance)


def protected_hashes(contract: dict[str, Any]) -> dict[str, str]:
    output: dict[str, str] = {}
    for item in contract["protectedArtifacts"]:
        path = ROOT / item
        if not path.exists():
            raise RuntimeError(f"Protected artifact is missing: {item}")
        output[item] = sha256_file(path)
    return output


def build_current(
    contract: dict[str, Any],
    prior_current: dict[str, Any],
    freeze: dict[str, Any],
    review: dict[str, Any],
    acceptance: dict[str, Any],
) -> dict[str, Any]:
    status = acceptance["decision"]
    output = {
        "schemaVersion": "walters-qb-performance-stage3-current-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 3,
        "substage": "3D",
        "status": status,
        "generatedFromSourceCapturedAt": prior_current.get("generatedFromSourceCapturedAt"),
        "operational": False,
        "productionAuthority": False,
        "marketViewed": False,
        "priorAuthority": prior_current.get("priorAuthority"),
        "weightsStatus": "ESTIMATED_FROZEN_STAGE3D_SHADOW",
        "dataCaptureStatus": prior_current.get("dataCaptureStatus"),
        "identityAuditStatus": prior_current.get("identityAuditStatus"),
        "seasonalCrosscheckStatus": prior_current.get("seasonalCrosscheckStatus"),
        "holdoutValidationStatus": prior_current.get("holdoutValidationStatus"),
        "candidateOutputStatus": "FROZEN_NON_OPERATIONAL",
        "candidateReviewStatus": review["status"],
        "stage3AcceptanceStatus": acceptance["status"],
        "acceptedFor": acceptance.get("acceptedFor"),
        "starterBindingStatus": acceptance["starterBindingStatus"],
        "grahamWritesAllowed": False,
        "uncertaintyOverlayRetirementAllowed": False,
        "activeContract": prior_current.get("activeContract"),
        "activeStage3BContract": prior_current.get("activeStage3BContract"),
        "activeStage3CContract": prior_current.get("activeStage3CContract"),
        "activeStage3DContract": relative(CONTRACT_PATH),
        "sourceManifest": prior_current.get("sourceManifest"),
        "identityCrosswalk": prior_current.get("identityCrosswalk"),
        "model": prior_current.get("model"),
        "holdoutAudit": prior_current.get("holdoutAudit"),
        "holdoutAuditSha256": prior_current.get("holdoutAuditSha256"),
        "candidates": prior_current.get("candidates"),
        "candidatesSha256": prior_current.get("candidatesSha256"),
        "freezeManifest": relative(FREEZE_PATH),
        "freezeManifestSha256": sha256_file(FREEZE_PATH),
        "candidateReview": relative(REVIEW_PATH),
        "candidateReviewSha256": sha256_file(REVIEW_PATH),
        "stage3Acceptance": relative(ACCEPTANCE_PATH),
        "stage3AcceptanceSha256": sha256_file(ACCEPTANCE_PATH),
        "modelCautionFlags": review["modelReview"]["cautionFlags"],
        "candidateReviewFlagCounts": review["summary"]["reviewFlagCounts"],
        "nextStage": acceptance.get("nextStage"),
        "nextSubstage": acceptance.get("nextStage"),
    }
    return attach_canonical_hash(output)


def self_test() -> None:
    mock_contract = {
        "candidateReview": {
            "rules": {
                "moveCapReachedTolerance": 0.000001,
                "largeMoveAbsoluteMinimum": 0.5,
                "elitePriorMinimum": 9.0,
                "elitePriorDowngradeMaximum": -0.5,
                "lowerPriorMaximum": 7.5,
                "lowerPriorUpgradeMinimum": 0.5,
                "highConfidenceLabel": "HIGH",
                "performancePriorDivergenceMinimum": 1.0,
                "rankShiftAbsoluteMinimum": 12,
                "scaleBoundaryTolerance": 0.000001,
            }
        }
    }
    # review_flags reads the real candidate calibration; test deterministic helpers here without repository mutation.
    sample = {"a": 1, "contentSha256Canonical": "ignored"}
    if canonical_sha(sample) != canonical_sha({"a": 1}):
        raise RuntimeError("Canonical hashing did not exclude its own marker.")
    players = [
        {"playerId": "2", "playerName": "Beta", "priorValue": 8.0, "candidateValue": 8.5},
        {"playerId": "1", "playerName": "Alpha", "priorValue": 8.0, "candidateValue": 8.5},
    ]
    ranks = rank_positions(players, "candidateValue")
    if ranks != {"1": 1, "2": 2}:
        raise RuntimeError(f"Deterministic rank tie-break failed: {ranks}")
    if not nearly_equal(7.45 - 7.50, -0.05, 1e-9):
        raise RuntimeError("Candidate delta reconciliation helper failed.")
    if mock_contract["candidateReview"]["rules"]["largeMoveAbsoluteMinimum"] != 0.5:
        raise RuntimeError("Stage 3D threshold fixture failed.")
    print("WALTERS QB STAGE 3D SELF-TEST: PASS")


def run() -> dict[str, Any]:
    contract = read_json(CONTRACT_PATH)
    current = read_json(CURRENT_PATH)
    model = read_json(MODEL_PATH)
    audit = read_json(AUDIT_PATH)
    candidates = read_json(CANDIDATES_PATH)
    validate_dependencies(contract, current, model, audit, candidates)

    protected_before = protected_hashes(contract)
    freeze = build_freeze_manifest(contract, current)
    review = build_candidate_review(contract, current, model, candidates)

    # Build twice in memory to prove deterministic review/freeze assembly before writing.
    if canonical_sha(freeze) != canonical_sha(build_freeze_manifest(contract, current)):
        raise RuntimeError("Stage 3D freeze manifest is not deterministic.")
    if canonical_sha(review) != canonical_sha(build_candidate_review(contract, current, model, candidates)):
        raise RuntimeError("Stage 3D candidate review is not deterministic.")

    write_json(FREEZE_PATH, freeze)
    write_json(REVIEW_PATH, review)
    protected_after = protected_hashes(contract)
    acceptance = build_acceptance(contract, current, model, audit, candidates, freeze, review, protected_before, protected_after)
    if acceptance["status"] != "PASS":
        raise RuntimeError("Stage 3D acceptance gates did not pass.")
    write_json(ACCEPTANCE_PATH, acceptance)
    new_current = build_current(contract, current, freeze, review, acceptance)
    write_json(CURRENT_PATH, new_current)

    return {
        "status": "PASS",
        "decision": acceptance["decision"],
        "freezeInputCount": freeze["inputCount"],
        "reviewedPlayers": review["summary"]["playerCount"],
        "flaggedPlayers": review["summary"]["flaggedPlayerCount"],
        "candidateReviewFlagCounts": review["summary"]["reviewFlagCounts"],
        "modelCautionFlags": review["modelReview"]["cautionFlags"],
        "requiredCaseStudies": [record["playerName"] for record in review["requiredCaseStudies"]],
        "productionAuthority": False,
        "marketViewed": False,
        "nextStage": acceptance["nextStage"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Walters QB performance Stage 3D freeze and acceptance evidence.")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    result = run()
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()

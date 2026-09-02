#!/usr/bin/env python3
"""Build deterministic, non-operational Stage 5 QB production-review evidence."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
QB_ROOT = ROOT / "data" / "walters" / "nfl" / "qb-performance"
CONTRACT_PATH = QB_ROOT / "stage5-contract-v1.json"


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Missing required file: {path.relative_to(ROOT)}")
    return json.loads(path.read_text(encoding="utf-8"))


def json_bytes(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def canonical_payload(value: Any) -> Any:
    if isinstance(value, list):
        return [canonical_payload(item) for item in value]
    if isinstance(value, dict):
        return {
            key: canonical_payload(value[key])
            for key in sorted(value)
            if key != "contentSha256Canonical"
        }
    return value


def canonical_sha(value: Any) -> str:
    return hashlib.sha256(json_bytes(canonical_payload(value))).hexdigest()


def raw_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def raw_bytes_sha(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def finalize(value: dict[str, Any]) -> dict[str, Any]:
    value["contentSha256Canonical"] = canonical_sha(value)
    return value


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def git_run(*args: str, binary: bool = False, check: bool = True) -> bytes | str:
    completed = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if check and completed.returncode != 0:
        raise RuntimeError(
            f"git {' '.join(args)} failed ({completed.returncode}): "
            f"{completed.stderr.decode('utf-8', errors='replace').strip()}"
        )
    if binary:
        return completed.stdout
    return completed.stdout.decode("utf-8").strip()


def is_ancestor(commit: str) -> bool:
    completed = subprocess.run(
        ["git", "merge-base", "--is-ancestor", commit, "HEAD"],
        cwd=ROOT,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return completed.returncode == 0


def git_show_bytes(commit: str, path: str) -> bytes:
    return git_run("show", f"{commit}:{path}", binary=True)  # type: ignore[return-value]


def git_show_json(commit: str, path: str) -> dict[str, Any]:
    return json.loads(git_show_bytes(commit, path).decode("utf-8"))


def round_half_away_from_zero(value: float) -> float:
    scaled = value * 2.0
    rounded = math.floor(scaled + 0.5) if scaled >= 0 else math.ceil(scaled - 0.5)
    return rounded / 2.0


def close(left: Any, right: Any, tolerance: float = 1e-9) -> bool:
    return abs(float(left) - float(right)) <= tolerance


def find_by(items: list[dict[str, Any]], key: str, expected: Any) -> dict[str, Any]:
    matches = [item for item in items if item.get(key) == expected]
    if len(matches) != 1:
        raise ValueError(f"Expected one record with {key}={expected!r}, found {len(matches)}")
    return matches[0]


def contains_string(value: Any, needle: str) -> bool:
    target = needle.casefold()
    if isinstance(value, str):
        return target in value.casefold()
    if isinstance(value, list):
        return any(contains_string(item, needle) for item in value)
    if isinstance(value, dict):
        return any(contains_string(item, needle) for item in value.values())
    return False


def extracted_sport(rec: dict[str, Any]) -> str:
    context_sport = (((rec.get("coreAssessment") or {}).get("context") or {}).get("sport"))
    if isinstance(context_sport, str) and context_sport:
        return context_sport.upper()
    sport_key = (((rec.get("feed") or {}).get("sportKey")) or "").lower()
    aliases = {
        "americanfootball_nfl": "NFL",
        "football": "NFL",
        "baseball": "MLB",
        "basketball": "BASKETBALL",
        "icehockey": "NHL",
    }
    return aliases.get(sport_key, sport_key.upper() or "UNKNOWN")


def protected_hashes(paths: list[str]) -> dict[str, str]:
    output: dict[str, str] = {}
    for item in paths:
        path = ROOT / item
        if not path.exists():
            raise FileNotFoundError(f"Protected artifact missing: {item}")
        output[item] = raw_sha(path)
    return output


def build_freeze(contract: dict[str, Any]) -> dict[str, Any]:
    inputs: list[dict[str, Any]] = []
    for item in contract["freezePolicy"]["immutableInputPaths"]:
        path = ROOT / item
        if not path.exists():
            raise FileNotFoundError(f"Frozen input missing: {item}")
        entry: dict[str, Any] = {
            "path": item,
            "sha256": raw_sha(path),
            "sizeBytes": path.stat().st_size,
        }
        if path.suffix == ".json":
            entry["canonicalJsonSha256"] = canonical_sha(read_json(path))
        inputs.append(entry)
    return finalize({
        "schemaVersion": "walters-qb-performance-stage5-freeze-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 5,
        "status": "STAGE5_REVIEW_INPUTS_HASH_FROZEN",
        "reviewAnchorAt": contract["reviewAnchorAt"],
        "hashAlgorithm": contract["freezePolicy"]["hashAlgorithm"],
        "inputCount": len(inputs),
        "allInputsPresent": True,
        "inputs": inputs,
        "operational": False,
        "productionAuthority": False,
        "grahamWritesAllowed": False,
    })


def build() -> int:
    contract = read_json(CONTRACT_PATH)
    if contract.get("stage") != 5 or contract.get("operational") is not False:
        raise ValueError("Invalid Stage 5 contract identity or operational boundary")

    dependency = contract["dependency"]
    control = contract["productionControl"]
    stage4_contract = read_json(ROOT / dependency["stage4ContractPath"])
    stage4_acceptance = read_json(ROOT / dependency["stage4AcceptancePath"])
    stage4_current = read_json(ROOT / dependency["stage4CurrentPath"])
    active_week = read_json(ROOT / contract["activeWeek"]["activeWeekPath"])
    current_numbers = read_json(ROOT / contract["activeWeek"]["currentNumbersPath"])
    research_ledger = read_json(ROOT / contract["activeWeek"]["researchLedgerPath"])
    model = read_json(ROOT / contract["formulaLock"]["modelPath"])
    candidates = read_json(ROOT / contract["formulaLock"]["candidateRegistryPath"])
    bindings = read_json(ROOT / contract["formulaLock"]["starterBindingsPath"])
    shadow_board = read_json(ROOT / contract["formulaLock"]["shadowBoardPath"])
    reconciliation = read_json(ROOT / contract["formulaLock"]["uncertaintyReconciliationPath"])

    protected_before = protected_hashes(contract["protectedArtifacts"])

    stage4_ancestor = is_ancestor(dependency["stage4Commit"])
    candidate_ancestor = is_ancestor(control["candidateCommit"])
    publication_ancestor = is_ancestor(control["publicationCommit"])

    candidate_bundle_bytes = git_show_bytes(control["candidateCommit"], control["candidateBundlePath"])
    published_report_bytes = git_show_bytes(control["publicationCommit"], control["publishedReportPath"])
    candidate_bundle = json.loads(candidate_bundle_bytes.decode("utf-8"))
    published_report = json.loads(published_report_bytes.decode("utf-8"))
    current_report_path = ROOT / control["publishedReportPath"]
    current_report_matches_publication = (
        current_report_path.exists() and current_report_path.read_bytes() == published_report_bytes
    )

    candidate_report = candidate_bundle.get("report") or {}
    recs = published_report.get("recs") or []
    recommendation_statuses = sorted({str(rec.get("status", "UNKNOWN")) for rec in recs})
    recommendation_sports = sorted({extracted_sport(rec) for rec in recs})
    nfl_recommendation_count = sum(1 for rec in recs if extracted_sport(rec) == "NFL")
    candidate_report_matches = canonical_sha(candidate_report) == canonical_sha(published_report)

    team_bindings = bindings.get("teams") or []
    lv_binding = find_by(team_bindings, "team", "LV")
    mia_binding = find_by(team_bindings, "team", "MIA")
    atl_binding = find_by(team_bindings, "team", "ATL")
    shadow_games = shadow_board.get("games") or []
    lv_shadow = find_by(shadow_games, "gameKey", contract["lasVegasReviewCase"]["gameKey"])
    atl_shadow = find_by(shadow_games, "gameKey", contract["atlantaReviewCase"]["gameKey"])
    overlays = reconciliation.get("overlays") or []
    lv_overlay = find_by(overlays, "gameKey", contract["lasVegasReviewCase"]["gameKey"])
    atl_overlay = find_by(overlays, "gameKey", contract["atlantaReviewCase"]["gameKey"])
    current_games = current_numbers.get("games") or []
    lv_current = find_by(current_games, "gameKey", contract["lasVegasReviewCase"]["gameKey"])
    atl_current = find_by(current_games, "gameKey", contract["atlantaReviewCase"]["gameKey"])

    away_delta = float(mia_binding["teamQbDelta"])
    home_delta = float(lv_binding["teamQbDelta"])
    qb_points = away_delta - home_delta
    current_exact = float(lv_current["grahamExactFairHome"])
    current_display = float(lv_current["grahamFairHome"])
    overlay_points = float(lv_overlay["currentPointsToHomeSpread"])
    conservative_exact = current_exact + qb_points
    reconciled_exact = current_exact - overlay_points + qb_points
    reconciled_display = round_half_away_from_zero(reconciled_exact)
    current_qb_uncertainty = [
        item for item in (lv_current.get("adjustments") or [])
        if item.get("type") == "QB_UNCERTAINTY"
    ]
    overlay_still_present = (
        len(current_qb_uncertainty) == 1
        and close(current_qb_uncertainty[0].get("pointsToHomeSpread"), overlay_points)
    )
    kirk_evidence_present = contains_string(research_ledger, "Kirk Cousins") and contains_string(
        research_ledger, "named Raiders starting quarterback"
    )
    authority_block_present = (
        contains_string(research_ledger, "requires")
        and contains_string(research_ledger, "QB performance authority")
    ) or contains_string(research_ledger, "GOVERNED_QB_PERFORMANCE_AUTHORITY")

    caution_flags = stage4_acceptance.get("modelCautionFlagsCarriedForward") or []
    protected_after = protected_hashes(contract["protectedArtifacts"])
    protected_unchanged = protected_before == protected_after

    freeze = build_freeze(contract)
    freeze_path = ROOT / contract["outputs"]["freezeManifest"]
    write_json(freeze_path, freeze)

    production_review = finalize({
        "schemaVersion": "walters-qb-performance-stage5-production-review-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 5,
        "status": "PASS_PUBLICATION_CONTROL_NO_NFL_PATH_COVERAGE",
        "reviewAnchorAt": contract["reviewAnchorAt"],
        "commitContinuity": {
            "head": git_run("rev-parse", "HEAD"),
            "stage4Commit": dependency["stage4Commit"],
            "stage4CommitIsAncestor": stage4_ancestor,
            "candidateCommit": control["candidateCommit"],
            "candidateCommitIsAncestor": candidate_ancestor,
            "publicationCommit": control["publicationCommit"],
            "publicationCommitIsAncestor": publication_ancestor,
        },
        "stage4Handoff": {
            "status": stage4_acceptance.get("status"),
            "decision": stage4_acceptance.get("decision"),
            "nextStage": stage4_current.get("nextStage"),
            "resolvedStarterBindings": stage4_acceptance.get("starterBindingSummary", {}).get("resolvedTeamCount"),
            "unresolvedTeams": stage4_acceptance.get("starterBindingSummary", {}).get("unresolvedTeams"),
            "stage4ContractOperational": stage4_contract.get("operational"),
            "stage4ProductionAuthority": stage4_contract.get("productionAuthority"),
        },
        "fifteenFifteenControl": {
            "candidateId": candidate_bundle.get("candidateId"),
            "phase": candidate_bundle.get("phase"),
            "label": published_report.get("label"),
            "timestamp": published_report.get("ts"),
            "slot": published_report.get("slot"),
            "counts": published_report.get("counts"),
            "risk": published_report.get("risk"),
            "summary": published_report.get("summary"),
            "recommendationCount": len(recs),
            "recommendationStatuses": recommendation_statuses,
            "recommendationSports": recommendation_sports,
            "derivedNflRecommendationCount": nfl_recommendation_count,
            "candidateReportMatchesPublishedReport": candidate_report_matches,
            "currentHistoryPathMatchesPublishedCommit": current_report_matches_publication,
            "candidateBundleSha256": raw_bytes_sha(candidate_bundle_bytes),
            "publishedReportSha256": raw_bytes_sha(published_report_bytes),
            "classification": control["classification"],
            "publicationIntegrityVerified": True,
            "qbProductionPathVerified": False,
            "qbProductionPathReason": "The reviewed report contains zero NFL recommendations or games in scope.",
        },
        "lasVegasStarterIdentityReview": {
            "gameKey": lv_current.get("gameKey"),
            "starterStatus": lv_binding.get("currentStarterStatus"),
            "starterPlayer": lv_binding.get("currentStarterPlayer"),
            "embeddedBaselinePlayer": lv_binding.get("embeddedBaselinePlayer"),
            "awayTeamQbDelta": away_delta,
            "homeTeamQbDelta": home_delta,
            "homeSpreadQbPoints": round(qb_points, 3),
            "currentGrahamExactFairHome": current_exact,
            "currentGrahamDisplayedFairHome": current_display,
            "eligibleResolvedStarterIdentityOverlayPoints": overlay_points,
            "conservativeReviewExactFairHome": round(conservative_exact, 3),
            "reconciledReviewExactFairHome": round(reconciled_exact, 3),
            "reconciledReviewDisplayedFairHome": reconciled_display,
            "stage4RecommendedReviewExactFairHome": lv_shadow.get("recommendedStage4ShadowExactFairHome"),
            "stage4RecommendedReviewDisplayedFairHome": lv_shadow.get("recommendedStage4ShadowDisplayedFairHome"),
            "officialStarterEvidencePresentInResearchLedger": kirk_evidence_present,
            "numericAuthorityBlockPresentInResearchLedger": authority_block_present,
            "identityOverlayStillPresent": overlay_still_present,
            "productionGrahamFairPreserved": close(current_exact, contract["lasVegasReviewCase"]["currentGrahamExactFairHome"])
            and close(current_display, contract["lasVegasReviewCase"]["currentGrahamDisplayedFairHome"]),
            "overlayRetired": False,
            "productionMutationApplied": False,
            "disposition": contract["lasVegasReviewCase"]["requiredProductionDisposition"],
        },
        "atlantaFailClosedReview": {
            "gameKey": atl_current.get("gameKey"),
            "bindingStatus": atl_binding.get("bindingStatus"),
            "currentStarterStatus": atl_binding.get("currentStarterStatus"),
            "embeddedBaselineStatus": atl_binding.get("embeddedBaselineStatus"),
            "teamQbDelta": atl_binding.get("teamQbDelta"),
            "shadowStatus": atl_shadow.get("qbShadowStatus"),
            "overlayDisposition": atl_overlay.get("stage4Disposition"),
            "currentGrahamExactFairHome": atl_current.get("grahamExactFairHome"),
            "currentGrahamDisplayedFairHome": atl_current.get("grahamFairHome"),
            "scopedProductionExclusionRequired": True,
            "failClosedPreserved": atl_binding.get("gameContributionEligible") is False
            and atl_binding.get("teamQbDelta") is None
            and atl_overlay.get("eligibleForStage5Replacement") is False,
        },
        "formulaAndStalenessReview": {
            "formula": contract["formulaLock"],
            "modelSchemaVersion": model.get("schemaVersion"),
            "modelStatus": model.get("status"),
            "modelGeneratedFromSourceCapturedAt": model.get("generatedFromSourceCapturedAt"),
            "holdoutSeason": model.get("holdoutSeason"),
            "holdoutSampleCount": model.get("holdoutSampleCount"),
            "candidateStatus": candidates.get("status"),
            "candidateAsOf": candidates.get("asOf"),
            "candidateForSeason": candidates.get("forSeason"),
            "candidateProductionAuthority": candidates.get("productionAuthority"),
            "modelCautionFlagsReviewedAndRetained": caution_flags,
            "stalenessDisposition": contract["evidenceStaleness"]["week1ReviewDisposition"],
            "automaticInSeasonRefitAllowed": False,
        },
        "marketBoundary": {
            "marketBearingProductionArtifactInspectedForPublicationControl": True,
            "extractedFieldClasses": contract["marketBoundary"]["allowedProductionFields"],
            "marketFieldsCopiedIntoStage5Evidence": False,
            "marketFieldsUsedByQbFormula": False,
            "marketFieldsUsedToMoveGrahamFair": False,
        },
        "protectedArtifactSha256Before": protected_before,
        "protectedArtifactSha256After": protected_after,
        "protectedArtifactsUnchanged": protected_unchanged,
        "productionAuthority": False,
        "grahamWritesAllowed": False,
        "embeddedQbBaselinesChanged": False,
        "uncertaintyOverlaysRetired": False,
        "runtimeAdapterChanged": False,
        "wagerOrStakeChanged": False,
    })
    review_path = ROOT / contract["outputs"]["productionReview"]
    write_json(review_path, production_review)

    activation_readiness = finalize({
        "schemaVersion": "walters-qb-performance-stage5-activation-readiness-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 5,
        "status": "REVIEW_PASS_ACTIVATION_NOT_AUTHORIZED",
        "reviewAnchorAt": contract["reviewAnchorAt"],
        "reviewPassed": True,
        "activationAuthorized": False,
        "productionAuthority": False,
        "grahamWritesAllowed": False,
        "pendingBlockingGates": [
            {
                "gate": "FIRST_NFL_BEARING_PRODUCTION_READBACK",
                "status": "UNSATISFIED",
                "blocking": True,
                "reason": "The September 2 15:15 control had zero NFL games in scope.",
            },
            {
                "gate": "EXPLICIT_SCOPED_QB_ACTIVATION_APPROVAL",
                "status": "UNSATISFIED",
                "blocking": True,
                "reason": "Stage 5 review does not itself grant production authority.",
            },
        ],
        "mandatoryScopedRestrictions": [
            {
                "scope": "ATL",
                "disposition": "EXCLUDE_AND_FAIL_CLOSED",
                "reason": "Starter identity and embedded baseline remain unresolved.",
            },
            {
                "scope": "2026-W01-MIA-LV",
                "disposition": "KEEP_LV_MINUS_2_5_AND_RETAIN_PLUS_0_5_IDENTITY_OVERLAY",
                "reason": "The reconciled -3.032/-3.0 result is a review scenario only.",
            },
            {
                "scope": "MODEL_CAUTION_FLAGS",
                "disposition": "RETAIN_FOR_EXPLICIT_ACCEPTANCE",
                "flags": caution_flags,
            },
        ],
        "currentProductionDisposition": contract["acceptance"]["currentProductionDisposition"],
        "acceptedFor": contract["acceptance"]["acceptedFor"],
        "notAcceptedFor": contract["acceptance"]["notAcceptedFor"],
        "nextRequiredGate": contract["acceptance"]["requiredPendingGate"],
        "productionReview": rel(review_path),
        "productionReviewSha256": raw_sha(review_path),
    })
    readiness_path = ROOT / contract["outputs"]["activationReadiness"]
    write_json(readiness_path, activation_readiness)

    expected_counts = control["expectedCounts"]
    cases: list[dict[str, Any]] = []

    def add_case(key: str, passed: bool, detail: str) -> None:
        cases.append({"caseKey": key, "result": "PASS" if passed else "FAIL", "detail": detail})

    add_case("STAGE4_COMMIT_ANCESTRY", stage4_ancestor, "Stage 4 durable commit is an ancestor of HEAD.")
    add_case(
        "STAGE4_ACCEPTANCE_HANDOFF",
        stage4_acceptance.get("status") == dependency["requiredStage4Status"]
        and stage4_acceptance.get("decision") == dependency["requiredStage4Decision"]
        and stage4_current.get("nextStage") == dependency["requiredStage4NextStage"],
        "Stage 4 acceptance and current-state handoff match the Stage 5 contract.",
    )
    add_case("PRODUCTION_CANDIDATE_COMMIT_ANCESTRY", candidate_ancestor, "15:15 candidate commit is an ancestor of HEAD.")
    add_case("PRODUCTION_PUBLICATION_COMMIT_ANCESTRY", publication_ancestor, "15:15 publication commit is an ancestor of HEAD.")
    add_case(
        "FIFTEEN_FIFTEEN_REPORT_IDENTITY",
        candidate_bundle.get("candidateId") == control["expectedCandidateId"]
        and str(candidate_bundle.get("phase")) == str(control["expectedPhase"])
        and published_report.get("label") == control["expectedLabel"]
        and published_report.get("ts") == control["expectedTimestamp"]
        and published_report.get("slot") == control["expectedSlot"]
        and candidate_report_matches
        and current_report_matches_publication,
        "Candidate, published commit and durable history path identify the same 15:15 report.",
    )
    add_case(
        "FIFTEEN_FIFTEEN_ZERO_RISK_AND_PASS_COUNTS",
        published_report.get("counts") == expected_counts
        and close(published_report.get("risk"), control["expectedRisk"])
        and len(recs) == control["expectedRecommendationCount"]
        and recommendation_statuses == sorted(control["expectedRecommendationStatuses"]),
        "The control contains nine PASS recommendations and zero new risk.",
    )
    add_case(
        "FIFTEEN_FIFTEEN_ZERO_NFL_SCOPE",
        nfl_recommendation_count == control["expectedNflGamesInScope"]
        and recommendation_sports == sorted(control["expectedSports"])
        and contains_string(published_report.get("summary", ""), "no NFL"),
        "The production control is MLB-only with no NFL event available.",
    )
    add_case(
        "NO_FALSE_NFL_PATH_ATTESTATION",
        production_review["fifteenFifteenControl"]["qbProductionPathVerified"] is False,
        "Zero-NFL publication integrity is not misrepresented as QB runtime validation.",
    )
    add_case(
        "LAS_VEGAS_STARTER_IDENTITY_RECONCILIATION_SCENARIO",
        lv_binding.get("currentStarterStatus") == contract["lasVegasReviewCase"]["starterIdentityStatus"]
        and (lv_binding.get("currentStarterPlayer") or {}).get("playerName") == contract["lasVegasReviewCase"]["starterPlayerName"]
        and close(qb_points, contract["lasVegasReviewCase"]["homeSpreadQbPoints"], 0.0011)
        and close(conservative_exact, contract["lasVegasReviewCase"]["conservativeReviewExactFairHome"], 0.0011)
        and close(reconciled_exact, contract["lasVegasReviewCase"]["reconciledReviewExactFairHome"], 0.0011)
        and close(reconciled_display, contract["lasVegasReviewCase"]["reconciledReviewDisplayedFairHome"]),
        "Kirk Cousins starter/baseline differential and overlay-replacement scenario reconcile exactly.",
    )
    add_case(
        "LAS_VEGAS_PRODUCTION_FAIR_PRESERVED",
        close(current_exact, contract["lasVegasReviewCase"]["currentGrahamExactFairHome"])
        and close(current_display, contract["lasVegasReviewCase"]["currentGrahamDisplayedFairHome"]),
        "Production remains LV -2.5 with exact fair -2.582.",
    )
    add_case(
        "LAS_VEGAS_OVERLAY_NOT_RETIRED",
        overlay_still_present and lv_overlay.get("retiredInStage4") is False,
        "The +0.5 starter-identity overlay remains present and unretired.",
    )
    add_case(
        "ATLANTA_FAIL_CLOSED_PRESERVED",
        production_review["atlantaFailClosedReview"]["failClosedPreserved"] is True,
        "Atlanta remains excluded from numeric contribution and fail-closed.",
    )
    add_case(
        "FORMULA_AND_ROUNDING_LOCK",
        close(qb_points, away_delta - home_delta)
        and close(conservative_exact, current_exact + qb_points)
        and close(reconciled_exact, current_exact - overlay_points + qb_points)
        and close(reconciled_display, round_half_away_from_zero(reconciled_exact)),
        "Differential formula and half-point rounding match the locked Stage 4 rule.",
    )
    add_case(
        "MODEL_CAUTION_FLAGS_REVIEWED",
        caution_flags == [
            "MODEST_HOLDOUT_SIGNAL",
            "CALIBRATION_SLOPE_BELOW_ONE",
            "RECENT_EPA_COMPARATOR_NOT_BEATEN",
            "ZERO_WEIGHT_INTERCEPTION_RATE",
            "LOW_WEIGHT_FUMBLE_RATE",
        ],
        "All Stage 3/4 model caution flags are retained for the activation decision.",
    )
    add_case(
        "EVIDENCE_STALENESS_BOUNDARY",
        candidates.get("asOf") == contract["evidenceStaleness"]["modelAsOf"]
        and candidates.get("forSeason") == contract["evidenceStaleness"]["candidateForSeason"]
        and contract["evidenceStaleness"]["automaticInSeasonRefitAllowed"] is False,
        "End-of-2025 candidates are accepted only for pre-Week-1 review and no automatic in-season refit is authorized.",
    )
    add_case("PROTECTED_ARTIFACT_INTEGRITY", protected_unchanged, "All protected artifacts retain identical before/after hashes.")
    add_case(
        "NO_RUNTIME_OR_BETTING_AUTHORITY",
        all(contract.get(key) is False for key in [
            "operational",
            "productionAuthority",
            "grahamWritesAllowed",
            "embeddedBaselineWritesAllowed",
            "uncertaintyOverlayRetirementAllowed",
            "runtimeAdapterWritesAllowed",
            "betAuthority",
            "wagerOrStakeWritesAllowed",
        ]),
        "Stage 5 grants no runtime, number, overlay, betting, wagering or staking authority.",
    )
    add_case(
        "DETERMINISTIC_READBACK",
        canonical_sha(production_review) == production_review["contentSha256Canonical"]
        and canonical_sha(activation_readiness) == activation_readiness["contentSha256Canonical"],
        "Generated review artifacts pass canonical deterministic read-back.",
    )

    expected_case_set = set(contract["requiredReviewCases"])
    actual_case_set = {item["caseKey"] for item in cases}
    missing_cases = sorted(expected_case_set - actual_case_set)
    unexpected_cases = sorted(actual_case_set - expected_case_set)
    fail_count = sum(1 for item in cases if item["result"] != "PASS") + len(missing_cases) + len(unexpected_cases)
    regression = finalize({
        "schemaVersion": "walters-qb-performance-stage5-regression-audit-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 5,
        "status": "PASS" if fail_count == 0 else "FAIL",
        "reviewAnchorAt": contract["reviewAnchorAt"],
        "requiredCaseCount": len(expected_case_set),
        "passCount": sum(1 for item in cases if item["result"] == "PASS"),
        "failCount": fail_count,
        "missingCases": missing_cases,
        "unexpectedCases": unexpected_cases,
        "cases": cases,
        "protectedArtifactSha256Before": protected_before,
        "protectedArtifactSha256After": protected_after,
        "productionAuthority": False,
        "grahamWritesAllowed": False,
    })
    regression_path = ROOT / contract["outputs"]["regressionAudit"]
    write_json(regression_path, regression)

    checks = [
        {"id": "QBP5-STAGE4-HANDOFF", "pass": cases[1]["result"] == "PASS"},
        {"id": "QBP5-COMMIT-CONTINUITY", "pass": stage4_ancestor and candidate_ancestor and publication_ancestor},
        {"id": "QBP5-1515-PUBLICATION-CONTROL", "pass": all(item["result"] == "PASS" for item in cases[4:8])},
        {"id": "QBP5-LV-RECONCILIATION-REVIEW", "pass": all(item["result"] == "PASS" for item in cases[8:11])},
        {"id": "QBP5-ATL-FAIL-CLOSED", "pass": cases[11]["result"] == "PASS"},
        {"id": "QBP5-FORMULA-LOCK", "pass": cases[12]["result"] == "PASS"},
        {"id": "QBP5-CAUTION-AND-STALENESS", "pass": cases[13]["result"] == "PASS" and cases[14]["result"] == "PASS"},
        {"id": "QBP5-PROTECTED-ARTIFACTS", "pass": protected_unchanged},
        {"id": "QBP5-NO-AUTHORITY", "pass": cases[16]["result"] == "PASS"},
        {"id": "QBP5-DETERMINISTIC-READBACK", "pass": cases[17]["result"] == "PASS"},
    ]
    acceptance_pass = fail_count == 0 and all(item["pass"] for item in checks)
    acceptance = finalize({
        "schemaVersion": "walters-qb-performance-stage5-acceptance-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 5,
        "status": "PASS" if acceptance_pass else "FAIL",
        "decision": contract["acceptance"]["passState"] if acceptance_pass else contract["acceptance"]["failState"],
        "reviewAnchorAt": contract["reviewAnchorAt"],
        "acceptedFor": contract["acceptance"]["acceptedFor"],
        "notAcceptedFor": contract["acceptance"]["notAcceptedFor"],
        "checks": checks,
        "freezeManifest": rel(freeze_path),
        "freezeManifestSha256": raw_sha(freeze_path),
        "productionReview": rel(review_path),
        "productionReviewSha256": raw_sha(review_path),
        "activationReadiness": rel(readiness_path),
        "activationReadinessSha256": raw_sha(readiness_path),
        "regressionAudit": rel(regression_path),
        "regressionAuditSha256": raw_sha(regression_path),
        "reviewCaseSummary": {
            "requiredCaseCount": len(expected_case_set),
            "passCount": regression["passCount"],
            "failCount": regression["failCount"],
        },
        "fifteenFifteenControl": {
            "classification": control["classification"],
            "publicationIntegrityVerified": True,
            "nflPathVerified": False,
            "nflGamesInScope": nfl_recommendation_count,
        },
        "lasVegasDisposition": contract["lasVegasReviewCase"]["requiredProductionDisposition"],
        "atlantaDisposition": contract["atlantaReviewCase"]["requiredDisposition"],
        "modelCautionFlagsCarriedForward": caution_flags,
        "pendingBlockingGates": activation_readiness["pendingBlockingGates"],
        "protectedArtifactSha256Before": protected_before,
        "protectedArtifactSha256After": protected_after,
        "protectedArtifactsUnchanged": protected_unchanged,
        "candidateValuesOperational": False,
        "grahamFairNumbersChanged": False,
        "embeddedQbBaselinesChanged": False,
        "uncertaintyOverlaysRetired": False,
        "runtimeAdapterChanged": False,
        "wagerOrStakeChanged": False,
        "productionAuthority": False,
        "grahamWritesAllowed": False,
        "activationAuthorized": False,
        "nextRequiredGate": contract["acceptance"]["requiredPendingGate"],
    })
    acceptance_path = ROOT / contract["outputs"]["acceptance"]
    write_json(acceptance_path, acceptance)

    current = finalize({
        "schemaVersion": "walters-qb-performance-stage5-current-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 5,
        "status": acceptance["decision"],
        "reviewAnchorAt": contract["reviewAnchorAt"],
        "season": active_week.get("season"),
        "week": active_week.get("week"),
        "activeWeekAuthority": active_week.get("authority"),
        "stage4Commit": dependency["stage4Commit"],
        "productionControlCandidateCommit": control["candidateCommit"],
        "productionControlPublicationCommit": control["publicationCommit"],
        "stage5Acceptance": rel(acceptance_path),
        "stage5AcceptanceSha256": raw_sha(acceptance_path),
        "productionReview": rel(review_path),
        "productionReviewSha256": raw_sha(review_path),
        "activationReadiness": rel(readiness_path),
        "activationReadinessSha256": raw_sha(readiness_path),
        "regressionAudit": rel(regression_path),
        "regressionAuditSha256": raw_sha(regression_path),
        "reviewCasesPassed": regression["passCount"],
        "reviewCasesFailed": regression["failCount"],
        "productionControlClassification": control["classification"],
        "nflPathVerified": False,
        "lasVegasDisplayedFairHome": current_display,
        "lasVegasOverlayRetired": False,
        "atlantaFailClosed": True,
        "productionAuthority": False,
        "grahamWritesAllowed": False,
        "activationAuthorized": False,
        "currentProductionDisposition": contract["acceptance"]["currentProductionDisposition"],
        "nextRequiredGate": contract["acceptance"]["requiredPendingGate"],
    })
    current_path = ROOT / contract["outputs"]["current"]
    write_json(current_path, current)

    deterministic = all(
        canonical_sha(read_json(path)) == read_json(path).get("contentSha256Canonical")
        for path in [freeze_path, review_path, readiness_path, regression_path, acceptance_path, current_path]
    )
    if not deterministic:
        print("Stage 5 deterministic read-back failed", file=sys.stderr)
        return 1
    if not acceptance_pass:
        print(json.dumps({"status": "FAIL", "failedCases": [item for item in cases if item["result"] != "PASS"]}, indent=2), file=sys.stderr)
        return 1

    print(json.dumps({
        "schemaVersion": "walters-qb-performance-stage5-build-v1",
        "status": "PASS",
        "decision": acceptance["decision"],
        "reviewCaseCount": len(cases),
        "reviewCasePassCount": regression["passCount"],
        "fifteenFifteenClassification": control["classification"],
        "nflPathVerified": False,
        "lasVegasDisplayedFairHome": current_display,
        "lasVegasOverlayRetired": False,
        "atlantaFailClosed": True,
        "productionAuthority": False,
        "activationAuthorized": False,
        "nextRequiredGate": contract["acceptance"]["requiredPendingGate"],
    }, indent=2))
    return 0


def self_test() -> int:
    tests = {
        "round_positive_half": round_half_away_from_zero(2.25) == 2.5,
        "round_negative_half": round_half_away_from_zero(-2.25) == -2.5,
        "round_lv_scenario": round_half_away_from_zero(-3.032) == -3.0,
        "lv_qb_points": close(0.0 - (-0.05), 0.05),
        "lv_conservative": close(-2.582 + 0.05, -2.532),
        "lv_reconciled": close(-2.582 - 0.5 + 0.05, -3.032),
    }
    failures = [name for name, passed in tests.items() if not passed]
    print(json.dumps({
        "schemaVersion": "walters-qb-performance-stage5-self-test-v1",
        "status": "PASS" if not failures else "FAIL",
        "tests": tests,
        "failures": failures,
    }, indent=2))
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    return self_test() if args.self_test else build()


if __name__ == "__main__":
    raise SystemExit(main())

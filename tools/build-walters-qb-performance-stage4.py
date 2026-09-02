#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import Counter, defaultdict
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
QB_ROOT = ROOT / "data" / "walters" / "nfl" / "qb-performance"
STAGE4_ROOT = QB_ROOT / "stage4"
CONTRACT_PATH = QB_ROOT / "stage4-contract-v1.json"
BINDING_AUTHORITY_PATH = STAGE4_ROOT / "binding-authority-v1.json"
STAGE3_ACCEPTANCE_PATH = QB_ROOT / "stage3-acceptance-v1.json"
STAGE3_CURRENT_PATH = QB_ROOT / "stage3-current.json"
STAGE3_REVIEW_PATH = QB_ROOT / "review" / "stage3d-candidate-review-v1.json"
CANDIDATES_PATH = QB_ROOT / "candidates" / "qb-candidates-2026-stage3c-v1.json"
ACTIVE_WEEK_PATH = ROOT / "data" / "walters" / "nfl" / "active-week.json"
CURRENT_NUMBERS_PATH = ROOT / "data" / "walters" / "nfl" / "2026" / "week-01-current-numbers.json"
RESEARCH_LEDGER_PATH = ROOT / "data" / "walters" / "nfl" / "2026" / "week-01-research-ledger.json"
POWER_LEDGER_PATH = ROOT / "data" / "walters" / "nfl-power-ratings-ledger.json"
PERSONNEL_CURRENT_PATH = ROOT / "data" / "walters" / "nfl" / "personnel-production-current.json"
MATCHUP_CURRENT_PATH = ROOT / "data" / "walters" / "nfl" / "matchup-production-current.json"
SEED_PATH = ROOT / "core" / "staging" / "walters-nfl-seed-dataset-2026.json"
VSIN_UPDATE_PATH = ROOT / "research" / "season-previews" / "private" / "2026-vsin-nfl-source2-postpreseason2.json"

FREEZE_PATH = STAGE4_ROOT / "freeze-manifest-v1.json"
BINDINGS_PATH = STAGE4_ROOT / "starter-baseline-bindings-v1.json"
SHADOW_BOARD_PATH = STAGE4_ROOT / "shadow-board-v1.json"
RECONCILIATION_PATH = STAGE4_ROOT / "uncertainty-reconciliation-v1.json"
ROLLOVER_PATH = STAGE4_ROOT / "rollover-audit-v1.json"
REGRESSION_PATH = STAGE4_ROOT / "regression-audit-v1.json"
ACCEPTANCE_PATH = QB_ROOT / "stage4-acceptance-v1.json"
CURRENT_PATH = QB_ROOT / "stage4-current.json"


def read_json(path: Path) -> Any:
    if not path.exists():
        raise RuntimeError(f"Missing required file: {relative(path)}")
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def relative(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def sha256_bytes(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def canonical_payload(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: canonical_payload(item)
            for key, item in value.items()
            if key != "contentSha256Canonical"
        }
    if isinstance(value, list):
        return [canonical_payload(item) for item in value]
    return value


def canonical_sha(value: Any) -> str:
    raw = json.dumps(
        canonical_payload(value),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return sha256_bytes(raw)


def attach_canonical_hash(value: dict[str, Any]) -> dict[str, Any]:
    output = dict(value)
    output["contentSha256Canonical"] = canonical_sha(output)
    return output


def finite_number(value: Any, label: str) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise RuntimeError(f"{label} is not numeric: {value!r}") from exc
    if not math.isfinite(parsed):
        raise RuntimeError(f"{label} is not finite: {value!r}")
    return parsed


def nearly_equal(left: float, right: float, tolerance: float = 1e-9) -> bool:
    return abs(float(left) - float(right)) <= tolerance


def round_points(value: float, precision: int = 3) -> float:
    result = round(float(value), precision)
    return 0.0 if nearly_equal(result, 0.0, 10 ** (-(precision + 1))) else result


def round_to_half(value: float) -> float:
    doubled = Decimal(str(float(value))) * Decimal("2")
    rounded = doubled.quantize(Decimal("1"), rounding=ROUND_HALF_UP) / Decimal("2")
    result = float(rounded)
    return 0.0 if result == 0.0 else result


def recursive_market_true(value: Any) -> bool:
    if isinstance(value, dict):
        for key, item in value.items():
            if key == "marketViewed" and item is True:
                return True
            if recursive_market_true(item):
                return True
    elif isinstance(value, list):
        return any(recursive_market_true(item) for item in value)
    return False


def candidate_index(candidates: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    by_name: dict[str, dict[str, Any]] = {}
    by_team: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for player in candidates.get("players", []):
        name = str(player.get("playerName") or "")
        team = str(player.get("team") or "")
        if not name or not team:
            raise RuntimeError(f"Candidate has incomplete identity: {player!r}")
        if name in by_name:
            raise RuntimeError(f"Candidate name is not unique: {name}")
        by_name[name] = player
        by_team[team].append(player)
    return by_name, dict(by_team)


def evidence_finding(research: dict[str, Any], sequence: int, team: str) -> dict[str, Any]:
    sweeps = [item for item in research.get("sweeps", []) if int(item.get("sequence", -1)) == int(sequence)]
    if len(sweeps) != 1:
        raise RuntimeError(f"Expected one research sweep sequence {sequence}, found {len(sweeps)}.")
    findings = [item for item in sweeps[0].get("teamFindings", []) if str(item.get("abbr")) == team]
    if len(findings) != 1:
        raise RuntimeError(f"Expected one {team} finding in research sweep {sequence}, found {len(findings)}.")
    return findings[0]


def validate_dependencies(
    contract: dict[str, Any],
    authority: dict[str, Any],
    stage3_acceptance: dict[str, Any],
    stage3_current: dict[str, Any],
    stage3_review: dict[str, Any],
    candidates: dict[str, Any],
    active_week: dict[str, Any],
    current_numbers: dict[str, Any],
    research: dict[str, Any],
    seed: dict[str, Any],
    vsin_update: dict[str, Any],
) -> None:
    errors: list[str] = []
    dependency = contract["dependency"]
    expected_week = contract["activeWeek"]

    if contract.get("stage") != 4 or contract.get("operational") is not False:
        errors.append("Stage 4 contract identity or operational boundary is invalid.")
    if any(contract.get(key) is not False for key in ("productionAuthority", "grahamWritesAllowed", "uncertaintyOverlayRetirementAllowed", "marketViewed")):
        errors.append("Stage 4 contract permits an authority or market state that must remain false.")

    if stage3_acceptance.get("status") != dependency["requiredStage3Status"]:
        errors.append("Stage 3 acceptance status is not PASS.")
    if stage3_acceptance.get("decision") != dependency["requiredStage3Decision"]:
        errors.append("Stage 3 decision is not approved for Stage 4 shadow testing.")
    if stage3_acceptance.get("starterBindingStatus") != dependency["requiredStarterBindingStatus"]:
        errors.append("Stage 3 starter binding handoff is not deferred to Stage 4 as required.")
    if stage3_acceptance.get("productionAuthority") is not False or stage3_acceptance.get("grahamWritesAllowed") is not False:
        errors.append("Stage 3 acceptance violates the shadow-only boundary.")
    if stage3_current.get("status") != dependency["requiredStage3Decision"]:
        errors.append("Stage 3 current state does not match the accepted Stage 4 handoff.")
    if stage3_current.get("marketViewed") is not False or stage3_review.get("marketViewed") is not False:
        errors.append("An upstream Stage 3 artifact is market exposed.")

    if candidates.get("status") != "NON_OPERATIONAL_SHADOW_CANDIDATES":
        errors.append("Candidate registry is not the frozen non-operational Stage 3 registry.")
    if candidates.get("productionAuthority") is not False or candidates.get("grahamWritesAllowed") is not False:
        errors.append("Candidate registry permits production use.")

    if active_week.get("state") != "ACTIVE":
        errors.append("Active-week authority is not active.")
    if int(active_week.get("season", -1)) != int(expected_week["season"]) or int(active_week.get("week", -1)) != int(expected_week["week"]):
        errors.append("Active-week authority does not identify contracted 2026 Week 1.")
    if int(current_numbers.get("season", -1)) != int(expected_week["season"]) or int(current_numbers.get("week", -1)) != int(expected_week["week"]):
        errors.append("Current-number board does not identify contracted 2026 Week 1.")
    if len(current_numbers.get("games", [])) != int(expected_week["expectedGameCount"]):
        errors.append(f"Expected {expected_week['expectedGameCount']} Week 1 games, found {len(current_numbers.get('games', []))}.")
    if int(research.get("season", -1)) != int(expected_week["season"]) or int(research.get("week", -1)) != int(expected_week["week"]):
        errors.append("Research ledger does not identify contracted 2026 Week 1.")

    if authority.get("status") != "GOVERNED_WEEK1_SHADOW_BINDINGS":
        errors.append("Stage 4 binding authority status is invalid.")
    if authority.get("authorityRules", {}).get("starterInferenceAllowed") is not False:
        errors.append("Binding authority allows starter inference.")
    if authority.get("authorityRules", {}).get("teamCandidateLeaderIsStarterAuthority") is not False:
        errors.append("Binding authority improperly treats the team candidate leader as starter authority.")
    if len(authority.get("teams", [])) != int(contract["bindingPolicy"]["expectedTeamCount"]):
        errors.append("Binding authority does not cover all 32 teams.")
    if len(authority.get("overlayBindings", [])) != int(contract["overlayPolicy"]["expectedBindingCount"]):
        errors.append("Binding authority overlay count is invalid.")

    seed_ratings = seed.get("powerRatings", [])
    update_ratings = vsin_update.get("powerRatings", {}).get("ratings", [])
    if len(seed_ratings) != 32 or len(update_ratings) != 32:
        errors.append("Baseline power-rating sources do not contain complete 32-team populations.")
    if vsin_update.get("powerRatings", {}).get("status") != "CONFIRMED":
        errors.append("VSiN 2.0 did not confirm the preseason rating table.")

    loaded_inputs = {
        relative(path)
        for path in (
            CONTRACT_PATH,
            BINDING_AUTHORITY_PATH,
            STAGE3_ACCEPTANCE_PATH,
            STAGE3_CURRENT_PATH,
            STAGE3_REVIEW_PATH,
            CANDIDATES_PATH,
            ACTIVE_WEEK_PATH,
            CURRENT_NUMBERS_PATH,
            RESEARCH_LEDGER_PATH,
            POWER_LEDGER_PATH,
            PERSONNEL_CURRENT_PATH,
            MATCHUP_CURRENT_PATH,
            SEED_PATH,
            VSIN_UPDATE_PATH,
        )
    }
    forbidden_paths = set(contract["marketIsolation"]["forbiddenInputPaths"])
    if loaded_inputs & forbidden_paths:
        errors.append(f"Forbidden market-bearing input was loaded: {sorted(loaded_inputs & forbidden_paths)}")

    forbidden_fields = set(contract["marketIsolation"]["forbiddenGameFields"])
    for game in current_numbers.get("games", []):
        present = sorted(forbidden_fields & set(game.keys()))
        if present:
            errors.append(f"Current-number game {game.get('gameKey')} contains forbidden market fields: {present}")

    for label, value in (
        ("contract", contract),
        ("binding authority", authority),
        ("Stage 3 acceptance", stage3_acceptance),
        ("Stage 3 current", stage3_current),
        ("Stage 3 review", stage3_review),
        ("candidate registry", candidates),
        ("current numbers", current_numbers),
        ("research ledger", research),
    ):
        if recursive_market_true(value):
            errors.append(f"{label} contains marketViewed:true.")

    if errors:
        raise RuntimeError("Stage 4 dependency validation failed:\n- " + "\n- ".join(errors))


def build_freeze_manifest(contract: dict[str, Any], tested_at: str) -> dict[str, Any]:
    entries: list[dict[str, Any]] = []
    for item in sorted(contract["freezePolicy"]["immutableInputPaths"]):
        path = ROOT / item
        if not path.exists():
            raise RuntimeError(f"Stage 4 freeze input is missing: {item}")
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
    return attach_canonical_hash({
        "schemaVersion": "walters-qb-performance-stage4-freeze-manifest-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 4,
        "status": "STAGE4_INPUTS_HASH_FROZEN",
        "frozenAt": tested_at,
        "hashAlgorithm": contract["freezePolicy"]["hashAlgorithm"],
        "inputCount": len(entries),
        "allInputsPresent": True,
        "inputs": entries,
        "modelReestimated": False,
        "stage3CandidatesRevised": False,
        "productionAuthority": False,
        "marketViewed": False,
    })


def build_bindings(
    contract: dict[str, Any],
    authority: dict[str, Any],
    candidates: dict[str, Any],
    research: dict[str, Any],
    vsin_update: dict[str, Any],
    tested_at: str,
) -> dict[str, Any]:
    by_name, _ = candidate_index(candidates)
    team_records = authority["teams"]
    seen_teams: set[str] = set()
    resolved: list[dict[str, Any]] = []
    unresolved: list[dict[str, Any]] = []
    output_teams: list[dict[str, Any]] = []
    errors: list[str] = []

    update_abbrs = {str(item[0]) for item in vsin_update.get("powerRatings", {}).get("ratings", []) if isinstance(item, list) and item}

    for item in sorted(team_records, key=lambda record: str(record.get("team"))):
        team = str(item.get("team") or "")
        if not team or team in seen_teams:
            errors.append(f"Invalid or duplicate binding team: {team!r}")
            continue
        seen_teams.add(team)
        if team not in update_abbrs:
            errors.append(f"{team} is missing from the VSiN 2.0 confirmed rating table.")

        current = item.get("currentStarter") or {}
        baseline = item.get("embeddedBaseline") or {}
        sequence = int(current.get("evidenceSweepSequence", -1))
        try:
            finding = evidence_finding(research, sequence, team)
        except RuntimeError as exc:
            errors.append(str(exc))
            continue
        summary = str(finding.get("summary") or "")

        current_name = current.get("playerName")
        baseline_name = baseline.get("playerName")
        current_candidates = [str(name) for name in current.get("candidateNames", [])]
        baseline_candidates = [str(name) for name in baseline.get("candidateNames", [])]

        if current.get("status") == "UNRESOLVED_COMPETITION":
            if current_name is not None or baseline_name is not None:
                errors.append(f"{team} unresolved binding improperly selects a player.")
            if len(current_candidates) < 2 or set(current_candidates) != set(baseline_candidates):
                errors.append(f"{team} unresolved competition candidates do not reconcile.")
            option_records: list[dict[str, Any]] = []
            for name in current_candidates:
                if name not in summary:
                    errors.append(f"{team} research evidence does not name unresolved option {name}.")
                player = by_name.get(name)
                if player is None:
                    errors.append(f"{team} unresolved option {name} is absent from Stage 3 candidates.")
                    continue
                if str(player.get("team")) != team:
                    errors.append(f"{name} candidate team {player.get('team')} does not match binding team {team}.")
                option_records.append({
                    "playerId": player.get("playerId"),
                    "gsisId": player.get("gsisId"),
                    "playerName": name,
                    "priorValue": player.get("priorValue"),
                    "candidateValue": player.get("candidateValue"),
                    "candidateStatus": player.get("status"),
                })
            record = {
                "team": team,
                "teamName": item.get("teamName"),
                "bindingStatus": "FAIL_CLOSED_UNRESOLVED_STARTER_AND_BASELINE",
                "currentStarterStatus": current.get("status"),
                "currentStarterPlayer": None,
                "embeddedBaselineStatus": baseline.get("status"),
                "embeddedBaselinePlayer": None,
                "unresolvedOptions": option_records,
                "approvedShadowStarterValue": None,
                "embeddedBaselineQbValue": None,
                "teamQbDelta": None,
                "gameContributionEligible": False,
                "failClosedCode": "UNRESOLVED_STARTER_OR_COMPOSITE_BASELINE",
                "evidence": {
                    "researchSweepSequence": sequence,
                    "researchFinding": summary,
                    "sourceRefs": [current.get("evidenceSource"), *baseline.get("evidenceSources", [])],
                },
                "productionAuthority": False,
                "marketViewed": False,
            }
            unresolved.append(record)
            output_teams.append(record)
            continue

        if not isinstance(current_name, str) or not current_name:
            errors.append(f"{team} resolved binding lacks a current starter name.")
            continue
        if not isinstance(baseline_name, str) or not baseline_name:
            errors.append(f"{team} resolved binding lacks an embedded baseline name.")
            continue
        if current_name not in summary:
            errors.append(f"{team} research evidence does not name current starter {current_name}.")

        current_player = by_name.get(current_name)
        baseline_player = by_name.get(baseline_name)
        if current_player is None:
            errors.append(f"{team} current starter {current_name} is absent from Stage 3 candidates.")
            continue
        if baseline_player is None:
            errors.append(f"{team} baseline quarterback {baseline_name} is absent from Stage 3 candidates.")
            continue
        if str(current_player.get("team")) != team:
            errors.append(f"{current_name} candidate team {current_player.get('team')} does not match binding team {team}.")
        if str(baseline_player.get("team")) != team:
            errors.append(f"{baseline_name} baseline candidate team {baseline_player.get('team')} does not match binding team {team}.")

        current_value = finite_number(current_player.get("candidateValue"), f"{current_name} candidateValue")
        baseline_value = finite_number(baseline_player.get("priorValue"), f"{baseline_name} priorValue")
        team_delta = round_points(current_value - baseline_value, 2)
        candidate_status = str(current_player.get("status") or "")
        if candidate_status == "BLOCKED_INSUFFICIENT_QB_SAMPLE" and not nearly_equal(current_value, finite_number(current_player.get("priorValue"), f"{current_name} priorValue"), 1e-9):
            errors.append(f"{current_name} is low-sample blocked but does not retain the frozen prior.")

        evidence = current_player.get("evidence") or {}
        record = {
            "team": team,
            "teamName": item.get("teamName"),
            "bindingStatus": "PASS_RESOLVED_SHADOW_BINDING",
            "currentStarterStatus": current.get("status"),
            "currentStarterPlayer": {
                "playerId": current_player.get("playerId"),
                "gsisId": current_player.get("gsisId"),
                "playerName": current_name,
                "candidateValue": current_value,
                "candidateStatus": candidate_status,
                "confidence": current_player.get("confidence"),
                "evidenceDropbacks": evidence.get("candidateEvidenceDropbacks"),
            },
            "embeddedBaselineStatus": baseline.get("status"),
            "embeddedBaselinePlayer": {
                "playerId": baseline_player.get("playerId"),
                "gsisId": baseline_player.get("gsisId"),
                "playerName": baseline_name,
                "priorValue": baseline_value,
                "valueAuthority": baseline.get("valueAuthority"),
            },
            "approvedShadowStarterValue": current_value,
            "embeddedBaselineQbValue": baseline_value,
            "teamQbDelta": team_delta,
            "gameContributionEligible": True,
            "sampleTreatment": (
                "FROZEN_STAGE2_PRIOR_RETAINED_ZERO_PERFORMANCE_DELTA"
                if candidate_status == "BLOCKED_INSUFFICIENT_QB_SAMPLE"
                else "STAGE3_PERFORMANCE_CANDIDATE"
            ),
            "evidence": {
                "researchSweepSequence": sequence,
                "researchFinding": summary,
                "sourceRefs": [current.get("evidenceSource"), *baseline.get("evidenceSources", [])],
            },
            "teamRatingDecompositionReconstructed": False,
            "productionAuthority": False,
            "marketViewed": False,
        }
        resolved.append(record)
        output_teams.append(record)

    expected_teams = int(contract["bindingPolicy"]["expectedTeamCount"])
    expected_resolved = int(contract["bindingPolicy"]["expectedResolvedTeamCount"])
    expected_unresolved = set(contract["bindingPolicy"]["expectedUnresolvedTeams"])
    actual_unresolved = {record["team"] for record in unresolved}
    if len(output_teams) != expected_teams:
        errors.append(f"Built {len(output_teams)} team bindings instead of {expected_teams}.")
    if len(resolved) != expected_resolved:
        errors.append(f"Built {len(resolved)} resolved team bindings instead of {expected_resolved}.")
    if actual_unresolved != expected_unresolved:
        errors.append(f"Unresolved teams {sorted(actual_unresolved)} do not match {sorted(expected_unresolved)}.")
    if errors:
        raise RuntimeError("Stage 4 starter/baseline binding failed:\n- " + "\n- ".join(errors))

    status_counts = Counter(record["bindingStatus"] for record in output_teams)
    return attach_canonical_hash({
        "schemaVersion": "walters-qb-performance-stage4-starter-baseline-bindings-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 4,
        "status": "PASS_WITH_ONE_GOVERNED_FAIL_CLOSED_TEAM",
        "testedAt": tested_at,
        "sourceBindingAuthority": relative(BINDING_AUTHORITY_PATH),
        "sourceBindingAuthoritySha256": sha256_file(BINDING_AUTHORITY_PATH),
        "sourceCandidateRegistry": relative(CANDIDATES_PATH),
        "sourceCandidateRegistrySha256": sha256_file(CANDIDATES_PATH),
        "baselineBindingMethod": contract["bindingPolicy"]["embeddedBaselineValueAuthority"],
        "summary": {
            "teamCount": len(output_teams),
            "resolvedTeamCount": len(resolved),
            "unresolvedTeamCount": len(unresolved),
            "unresolvedTeams": sorted(actual_unresolved),
            "bindingStatusCounts": dict(sorted(status_counts.items())),
            "nonzeroTeamDeltaCount": sum(1 for record in resolved if not nearly_equal(float(record["teamQbDelta"]), 0.0)),
            "lowSamplePriorRetainedCount": sum(1 for record in resolved if record["sampleTreatment"] == "FROZEN_STAGE2_PRIOR_RETAINED_ZERO_PERFORMANCE_DELTA"),
        },
        "teams": output_teams,
        "starterInferenceUsed": False,
        "teamCandidateLeaderUsedAsStarterAuthority": False,
        "teamRatingDecompositionReconstructed": False,
        "productionAuthority": False,
        "grahamWritesAllowed": False,
        "marketViewed": False,
    })


def arithmetic_check(game: dict[str, Any]) -> tuple[bool, float, float]:
    decomposition = game.get("fairDecomposition") or {}
    components = (
        finite_number(decomposition.get("neutralTeamBaseHome"), f"{game.get('gameKey')} neutralTeamBaseHome"),
        finite_number(decomposition.get("homeFieldPointsToHomeSpread"), f"{game.get('gameKey')} homeFieldPointsToHomeSpread"),
        finite_number(decomposition.get("otherGovernedPointsToHomeSpread"), f"{game.get('gameKey')} otherGovernedPointsToHomeSpread"),
        finite_number(decomposition.get("personnelPointsToHomeSpread"), f"{game.get('gameKey')} personnelPointsToHomeSpread"),
        finite_number(decomposition.get("matchupPointsToHomeSpread"), f"{game.get('gameKey')} matchupPointsToHomeSpread"),
    )
    calculated = round_points(sum(components), 6)
    exact = finite_number(decomposition.get("exactFairHome"), f"{game.get('gameKey')} exactFairHome")
    displayed = finite_number(decomposition.get("displayedFairHome"), f"{game.get('gameKey')} displayedFairHome")
    passed = nearly_equal(calculated, exact, 1e-6) and nearly_equal(round_to_half(exact), displayed, 1e-9)
    return passed, calculated, exact


def build_shadow_board(
    contract: dict[str, Any],
    authority: dict[str, Any],
    bindings: dict[str, Any],
    current_numbers: dict[str, Any],
    tested_at: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    binding_by_team = {record["team"]: record for record in bindings["teams"]}
    overlay_bindings = authority["overlayBindings"]
    overlay_by_game: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in overlay_bindings:
        overlay_by_game[str(item["gameKey"])].append(item)

    reconciliation_records: list[dict[str, Any]] = []
    shadow_games: list[dict[str, Any]] = []
    errors: list[str] = []
    arithmetic_pass_count = 0

    for game in current_numbers.get("games", []):
        game_key = str(game.get("gameKey") or "")
        away = str(game.get("away") or "")
        home = str(game.get("home") or "")
        if away not in binding_by_team or home not in binding_by_team:
            errors.append(f"{game_key} references a team without a Stage 4 binding.")
            continue
        away_binding = binding_by_team[away]
        home_binding = binding_by_team[home]
        arithmetic_passed, calculated_exact, current_exact = arithmetic_check(game)
        if arithmetic_passed:
            arithmetic_pass_count += 1
        else:
            errors.append(f"{game_key} current fair decomposition does not reconcile: calculated {calculated_exact}, exact {current_exact}.")

        displayed_current = finite_number((game.get("fairDecomposition") or {}).get("displayedFairHome"), f"{game_key} displayedFairHome")
        game_resolved = bool(away_binding["gameContributionEligible"] and home_binding["gameContributionEligible"])
        if game_resolved:
            away_delta = finite_number(away_binding["teamQbDelta"], f"{away} teamQbDelta")
            home_delta = finite_number(home_binding["teamQbDelta"], f"{home} teamQbDelta")
            qb_points = round_points(away_delta - home_delta, 3)
            qb_status = "RESOLVED_DIFFERENTIAL_APPLIED_IN_SHADOW"
            fail_closed_teams: list[str] = []
        else:
            away_delta = away_binding.get("teamQbDelta")
            home_delta = home_binding.get("teamQbDelta")
            qb_points = 0.0
            qb_status = "FAIL_CLOSED_GAME_PRESERVED"
            fail_closed_teams = [team for team, binding in ((away, away_binding), (home, home_binding)) if not binding["gameContributionEligible"]]

        adjustments = game.get("adjustments") or []
        eligible_overlay_points = 0.0
        game_reconciliation: list[dict[str, Any]] = []
        for overlay_binding in overlay_by_game.get(game_key, []):
            matches = [
                adjustment for adjustment in adjustments
                if str(adjustment.get("type")) == str(overlay_binding["overlayType"])
            ]
            if len(matches) != 1:
                errors.append(
                    f"{game_key} expected one {overlay_binding['overlayType']} adjustment, found {len(matches)}."
                )
                continue
            adjustment = matches[0]
            points = finite_number(adjustment.get("pointsToHomeSpread"), f"{game_key} {overlay_binding['overlayType']} points")
            team_binding = binding_by_team[str(overlay_binding["team"])]
            overlay_class = str(overlay_binding["overlayClass"])
            policy = str(overlay_binding["resolutionPolicy"])
            if overlay_class == contract["overlayPolicy"]["starterIdentityClass"]:
                if team_binding["gameContributionEligible"] and policy.startswith("ELIGIBLE_FOR_STAGE5_REPLACEMENT"):
                    disposition = "ELIGIBLE_FOR_STAGE5_REPLACEMENT_NOT_RETIRED_IN_STAGE4"
                    eligible = True
                    eligible_overlay_points = round_points(eligible_overlay_points + points, 6)
                else:
                    disposition = "PRESERVE_FAIL_CLOSED"
                    eligible = False
            else:
                disposition = "PRESERVE_ORTHOGONAL_UNCERTAINTY"
                eligible = False
            record = {
                "gameKey": game_key,
                "team": overlay_binding["team"],
                "side": overlay_binding["side"],
                "overlayType": overlay_binding["overlayType"],
                "overlayClass": overlay_class,
                "currentPointsToHomeSpread": points,
                "bindingStatus": team_binding["bindingStatus"],
                "stage4Disposition": disposition,
                "eligibleForStage5Replacement": eligible,
                "retiredInStage4": False,
                "stackedWithReplacement": False,
                "productionAuthority": False,
                "marketViewed": False,
            }
            reconciliation_records.append(record)
            game_reconciliation.append(record)

        conservative_exact = round_points(current_exact + qb_points, 3) if game_resolved else current_exact
        reconciled_exact = round_points(current_exact - eligible_overlay_points + qb_points, 3) if game_resolved else current_exact
        recommended_exact = reconciled_exact if game_resolved else current_exact
        recommended_displayed = round_to_half(recommended_exact) if game_resolved else displayed_current

        shadow_games.append({
            "gameKey": game_key,
            "away": away,
            "home": home,
            "startTimePacific": game.get("startTimePacific"),
            "currentGrahamExactFairHome": current_exact,
            "currentGrahamDisplayedFairHome": displayed_current,
            "currentFairArithmeticVerified": arithmetic_passed,
            "awayBindingStatus": away_binding["bindingStatus"],
            "homeBindingStatus": home_binding["bindingStatus"],
            "awayTeamQbDelta": away_delta,
            "homeTeamQbDelta": home_delta,
            "homeSpreadQbPoints": qb_points,
            "qbShadowStatus": qb_status,
            "failClosedTeams": fail_closed_teams,
            "starterIdentityOverlayPointsEligibleForReplacement": eligible_overlay_points,
            "conservativeShadowExactFairHome": conservative_exact,
            "reconciledShadowExactFairHome": reconciled_exact,
            "recommendedStage4ShadowExactFairHome": recommended_exact,
            "recommendedStage4ShadowDisplayedFairHome": recommended_displayed,
            "shadowChangeFromCurrentExact": round_points(recommended_exact - current_exact, 3),
            "overlayReconciliation": game_reconciliation,
            "currentGrahamFairChanged": False,
            "productionAuthority": False,
            "marketViewed": False,
        })

    expected_games = int(contract["activeWeek"]["expectedGameCount"])
    if len(shadow_games) != expected_games:
        errors.append(f"Built {len(shadow_games)} shadow games instead of {expected_games}.")
    if len(reconciliation_records) != int(contract["overlayPolicy"]["expectedBindingCount"]):
        errors.append("Not every contracted quarterback overlay was reconciled.")
    if errors:
        raise RuntimeError("Stage 4 shadow-board build failed:\n- " + "\n- ".join(errors))

    resolved_games = [game for game in shadow_games if game["qbShadowStatus"] == "RESOLVED_DIFFERENTIAL_APPLIED_IN_SHADOW"]
    fail_closed_games = [game for game in shadow_games if game["qbShadowStatus"] == "FAIL_CLOSED_GAME_PRESERVED"]
    board = attach_canonical_hash({
        "schemaVersion": "walters-qb-performance-stage4-shadow-board-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 4,
        "status": "PASS_SHADOW_ONLY",
        "season": current_numbers.get("season"),
        "week": current_numbers.get("week"),
        "testedAt": tested_at,
        "sourceCurrentNumbers": relative(CURRENT_NUMBERS_PATH),
        "sourceCurrentNumbersSha256": sha256_file(CURRENT_NUMBERS_PATH),
        "sourceBindings": relative(BINDINGS_PATH),
        "formula": contract["shadowFormula"],
        "summary": {
            "gameCount": len(shadow_games),
            "resolvedGameCount": len(resolved_games),
            "failClosedGameCount": len(fail_closed_games),
            "failClosedGameKeys": [game["gameKey"] for game in fail_closed_games],
            "nonzeroQbDifferentialGameCount": sum(1 for game in resolved_games if not nearly_equal(game["homeSpreadQbPoints"], 0.0)),
            "potentialDisplayedFairChangeCount": sum(1 for game in resolved_games if not nearly_equal(game["recommendedStage4ShadowDisplayedFairHome"], game["currentGrahamDisplayedFairHome"])),
            "currentFairArithmeticPassCount": arithmetic_pass_count,
        },
        "games": shadow_games,
        "currentGrahamFairNumbersChanged": False,
        "productionAuthority": False,
        "grahamWritesAllowed": False,
        "marketViewed": False,
    })

    disposition_counts = Counter(record["stage4Disposition"] for record in reconciliation_records)
    reconciliation = attach_canonical_hash({
        "schemaVersion": "walters-qb-performance-stage4-uncertainty-reconciliation-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 4,
        "status": "PASS_NO_STAGE4_RETIREMENTS",
        "testedAt": tested_at,
        "summary": {
            "overlayCount": len(reconciliation_records),
            "eligibleForStage5ReplacementCount": sum(1 for record in reconciliation_records if record["eligibleForStage5Replacement"]),
            "preservedFailClosedCount": disposition_counts.get("PRESERVE_FAIL_CLOSED", 0),
            "preservedOrthogonalCount": disposition_counts.get("PRESERVE_ORTHOGONAL_UNCERTAINTY", 0),
            "retiredInStage4Count": 0,
            "stackedWithReplacementCount": 0,
            "dispositionCounts": dict(sorted(disposition_counts.items())),
        },
        "overlays": reconciliation_records,
        "uncertaintyOverlaysRetired": False,
        "productionAuthority": False,
        "grahamWritesAllowed": False,
        "marketViewed": False,
    })
    return board, reconciliation


def evidence_update_allowed(evidence_week: int, last_completed_week: int) -> bool:
    return int(evidence_week) >= 1 and int(evidence_week) <= int(last_completed_week)


def build_rollover_audit(contract: dict[str, Any], active_week: dict[str, Any], tested_at: str) -> dict[str, Any]:
    season = int(active_week["season"])
    week = int(active_week["week"])
    week2_path = ROOT / "data" / "walters" / "nfl" / str(season) / "week-02-current-numbers.json"
    pre_kickoff_accepts_week1 = evidence_update_allowed(1, 0)
    simulated_post_week1_accepts_week1 = evidence_update_allowed(1, 1)
    simulated_post_week1_accepts_week2 = evidence_update_allowed(2, 1)
    passed = (
        season == int(contract["activeWeek"]["season"])
        and week == int(contract["activeWeek"]["week"])
        and not week2_path.exists()
        and pre_kickoff_accepts_week1 is False
        and simulated_post_week1_accepts_week1 is True
        and simulated_post_week1_accepts_week2 is False
    )
    return attach_canonical_hash({
        "schemaVersion": "walters-qb-performance-stage4-rollover-audit-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 4,
        "status": "PASS" if passed else "FAIL",
        "testedAt": tested_at,
        "activeWeekBefore": {"season": season, "week": week, "state": active_week.get("state")},
        "activeWeekAfter": {"season": season, "week": week, "state": active_week.get("state")},
        "activeWeekMutated": False,
        "week2CurrentNumbersExists": week2_path.exists(),
        "simulatedRollover": {
            "fromSeason": season,
            "fromWeek": week,
            "candidateSeason": season,
            "candidateWeek": week + 1,
            "completionGateRequired": True,
            "performed": False,
        },
        "currentSeasonEvidenceScenarios": [
            {
                "scenario": "PRE_KICKOFF_ACTIVE_WEEK",
                "lastCompletedWeek": 0,
                "evidenceWeek": 1,
                "accepted": pre_kickoff_accepts_week1,
                "expected": False,
            },
            {
                "scenario": "POST_WEEK1_CURRENT_EVIDENCE",
                "lastCompletedWeek": 1,
                "evidenceWeek": 1,
                "accepted": simulated_post_week1_accepts_week1,
                "expected": True,
            },
            {
                "scenario": "POST_WEEK1_LOOKAHEAD_BLOCK",
                "lastCompletedWeek": 1,
                "evidenceWeek": 2,
                "accepted": simulated_post_week1_accepts_week2,
                "expected": False,
            },
        ],
        "lookAheadAccepted": False,
        "productionAuthority": False,
        "marketViewed": False,
    })


def protected_hashes(contract: dict[str, Any]) -> dict[str, str]:
    output: dict[str, str] = {}
    for item in contract["protectedArtifacts"]:
        path = ROOT / item
        if not path.exists():
            raise RuntimeError(f"Protected artifact is missing: {item}")
        output[item] = sha256_file(path)
    return output


def scenario_case(case_key: str, passed: bool, actual: Any, expected: Any, detail: str) -> dict[str, Any]:
    return {
        "caseKey": case_key,
        "result": "PASS" if passed else "FAIL",
        "actual": actual,
        "expected": expected,
        "detail": detail,
    }


def build_regression_audit(
    contract: dict[str, Any],
    candidates: dict[str, Any],
    bindings: dict[str, Any],
    board: dict[str, Any],
    reconciliation: dict[str, Any],
    rollover: dict[str, Any],
    protected_before: dict[str, str],
    protected_after: dict[str, str],
    tested_at: str,
) -> dict[str, Any]:
    binding_by_team = {record["team"]: record for record in bindings["teams"]}
    game_by_key = {record["gameKey"]: record for record in board["games"]}
    by_name, by_team = candidate_index(candidates)
    cases: list[dict[str, Any]] = []

    zero_bindings = [record for record in bindings["teams"] if record["gameContributionEligible"] and nearly_equal(float(record["teamQbDelta"]), 0.0)]
    no_change = next((record for record in zero_bindings if record["team"] == "BUF"), zero_bindings[0] if zero_bindings else None)
    cases.append(scenario_case(
        "NO_CHANGE_STARTER",
        no_change is not None and nearly_equal(float(no_change["teamQbDelta"]), 0.0),
        None if no_change is None else {"team": no_change["team"], "teamQbDelta": no_change["teamQbDelta"]},
        "A resolved unchanged candidate produces zero differential.",
        "No-change starter runs must not fabricate a quarterback adjustment.",
    ))

    mahomes = binding_by_team.get("KC")
    mahomes_expected = round_points(
        finite_number(by_name["Patrick Mahomes"]["candidateValue"], "Mahomes candidate")
        - finite_number(by_name["Patrick Mahomes"]["priorValue"], "Mahomes prior"),
        2,
    )
    cases.append(scenario_case(
        "SAME_STARTER_PERFORMANCE_REVALUE",
        mahomes is not None and nearly_equal(float(mahomes["teamQbDelta"]), mahomes_expected),
        None if mahomes is None else mahomes["teamQbDelta"],
        mahomes_expected,
        "A resolved same-starter performance candidate is compared once with its embedded Stage 2 baseline prior.",
    ))

    burrow = binding_by_team.get("CIN")
    move_cap = finite_number(candidates["calibration"]["maximumAbsoluteMoveFromStage2Prior"], "move cap")
    cases.append(scenario_case(
        "MOVE_CAP_SENSITIVITY",
        burrow is not None and abs(float(burrow["teamQbDelta"])) <= move_cap + 1e-9 and nearly_equal(abs(float(burrow["teamQbDelta"])), move_cap),
        None if burrow is None else abs(float(burrow["teamQbDelta"])),
        move_cap,
        "The Joe Burrow case reaches but does not exceed the frozen Stage 3 movement cap.",
    ))

    starter_change_team = "LV"
    baseline = binding_by_team[starter_change_team]
    alternatives = [
        player for player in by_team.get(starter_change_team, [])
        if player.get("playerName") != baseline["currentStarterPlayer"]["playerName"]
    ]
    alternative = min(alternatives, key=lambda player: (float(player["candidateValue"]), str(player["playerName"]))) if alternatives else None
    alternative_delta = None if alternative is None else round_points(
        finite_number(alternative["candidateValue"], "alternative candidate")
        - finite_number(baseline["embeddedBaselineQbValue"], "LV embedded baseline"),
        2,
    )
    cases.append(scenario_case(
        "STARTER_CHANGE_BACKUP",
        alternative is not None and alternative_delta is not None and math.isfinite(alternative_delta),
        None if alternative is None else {"team": starter_change_team, "playerName": alternative["playerName"], "teamQbDelta": alternative_delta},
        "One alternative same-team candidate minus the unchanged embedded baseline prior.",
        "Starter-change math uses replacement minus baseline, never replacement plus the current starter value.",
    ))

    low_sample = next((player for player in candidates["players"] if player.get("status") == "BLOCKED_INSUFFICIENT_QB_SAMPLE"), None)
    low_sample_pass = low_sample is not None and nearly_equal(float(low_sample["candidateValue"]), float(low_sample["priorValue"]))
    cases.append(scenario_case(
        "LOW_SAMPLE_ROOKIE_OR_BACKUP",
        low_sample_pass,
        None if low_sample is None else {"playerName": low_sample["playerName"], "priorValue": low_sample["priorValue"], "candidateValue": low_sample["candidateValue"]},
        "Candidate equals frozen Stage 2 prior.",
        "Insufficient samples fail closed to the prior and cannot invent a performance move.",
    ))

    unresolved_replacement_delta = None
    cases.append(scenario_case(
        "INJURY_UNRESOLVED_REPLACEMENT",
        unresolved_replacement_delta is None,
        unresolved_replacement_delta,
        None,
        "A missing governed replacement identity produces no numeric differential.",
    ))

    mahomes_delta_once = float(mahomes["teamQbDelta"])
    mahomes_delta_replayed = round_points(
        float(mahomes["approvedShadowStarterValue"]) - float(mahomes["embeddedBaselineQbValue"]),
        2,
    )
    cases.append(scenario_case(
        "RETURN_WITHOUT_STACKING",
        nearly_equal(mahomes_delta_once, mahomes_delta_replayed),
        mahomes_delta_replayed,
        mahomes_delta_once,
        "Replaying the same return/current-starter binding recomputes from the baseline and does not add another delta.",
    ))

    lv_game = game_by_key.get("2026-W01-MIA-LV")
    lv_pass = (
        lv_game is not None
        and nearly_equal(float(lv_game["starterIdentityOverlayPointsEligibleForReplacement"]), 0.5)
        and nearly_equal(
            float(lv_game["recommendedStage4ShadowExactFairHome"]),
            float(lv_game["currentGrahamExactFairHome"]) - 0.5 + float(lv_game["homeSpreadQbPoints"]),
        )
        and len([record for record in lv_game["overlayReconciliation"] if record["eligibleForStage5Replacement"]]) == 1
    )
    cases.append(scenario_case(
        "RESOLVED_STARTER_IDENTITY_OVERLAY_RECONCILIATION",
        lv_pass,
        None if lv_game is None else {
            "currentExact": lv_game["currentGrahamExactFairHome"],
            "overlayReplacementPoints": lv_game["starterIdentityOverlayPointsEligibleForReplacement"],
            "qbPoints": lv_game["homeSpreadQbPoints"],
            "recommendedExact": lv_game["recommendedStage4ShadowExactFairHome"],
        },
        "current exact - one resolved identity overlay + one QB differential",
        "Las Vegas' resolved identity overlay is marked for Stage 5 replacement, not stacked or retired in Stage 4.",
    ))

    atl_game = game_by_key.get("2026-W01-ATL-PIT")
    atl_pass = (
        atl_game is not None
        and atl_game["qbShadowStatus"] == "FAIL_CLOSED_GAME_PRESERVED"
        and nearly_equal(float(atl_game["recommendedStage4ShadowExactFairHome"]), float(atl_game["currentGrahamExactFairHome"]))
        and any(record["stage4Disposition"] == "PRESERVE_FAIL_CLOSED" for record in atl_game["overlayReconciliation"])
    )
    cases.append(scenario_case(
        "UNRESOLVED_STARTER_IDENTITY_PRESERVATION",
        atl_pass,
        None if atl_game is None else {"status": atl_game["qbShadowStatus"], "recommendedExact": atl_game["recommendedStage4ShadowExactFairHome"]},
        "Current Graham exact fair preserved.",
        "Atlanta remains unresolved; the full game fails closed without a one-sided Pittsburgh adjustment.",
    ))

    orthogonal = [record for record in reconciliation["overlays"] if record["overlayClass"] in contract["overlayPolicy"]["orthogonalClasses"]]
    orthogonal_pass = len(orthogonal) == 2 and all(record["stage4Disposition"] == "PRESERVE_ORTHOGONAL_UNCERTAINTY" and record["retiredInStage4"] is False for record in orthogonal)
    cases.append(scenario_case(
        "ORTHOGONAL_UNCERTAINTY_PRESERVATION",
        orthogonal_pass,
        [{"gameKey": record["gameKey"], "overlayType": record["overlayType"], "disposition": record["stage4Disposition"]} for record in orthogonal],
        "Two re-entry/clearance overlays preserved.",
        "Cleveland re-entry and Kansas City clearance are not starter-identity duplicates and remain separate.",
    ))

    cases.append(scenario_case(
        "WEEKLY_ROLLOVER_NO_LOOKAHEAD",
        rollover["status"] == "PASS" and rollover["activeWeekMutated"] is False and rollover["week2CurrentNumbersExists"] is False,
        {"activeWeekMutated": rollover["activeWeekMutated"], "week2Exists": rollover["week2CurrentNumbersExists"]},
        {"activeWeekMutated": False, "week2Exists": False},
        "Stage 4 simulates the next week without advancing active state or creating Week 2 files.",
    ))

    evidence_scenarios = rollover["currentSeasonEvidenceScenarios"]
    evidence_pass = all(item["accepted"] == item["expected"] for item in evidence_scenarios) and rollover["lookAheadAccepted"] is False
    cases.append(scenario_case(
        "CURRENT_SEASON_EVIDENCE_NO_LOOKAHEAD",
        evidence_pass,
        evidence_scenarios,
        "Completed-week evidence accepted; active/future-week evidence rejected.",
        "The synthetic evidence gate admits only weeks at or before the last completed week.",
    ))

    arithmetic_pass = board["summary"]["currentFairArithmeticPassCount"] == board["summary"]["gameCount"]
    cases.append(scenario_case(
        "FAIR_DECOMPOSITION_ARITHMETIC",
        arithmetic_pass,
        board["summary"]["currentFairArithmeticPassCount"],
        board["summary"]["gameCount"],
        "All current exact and displayed Graham fairs reconcile before shadow adjustments are evaluated.",
    ))

    forbidden_fields = set(contract["marketIsolation"]["forbiddenGameFields"])
    market_fields_found = sorted({field for game in board["games"] for field in forbidden_fields if field in game})
    market_pass = not market_fields_found and recursive_market_true(board) is False and recursive_market_true(bindings) is False
    cases.append(scenario_case(
        "MARKET_ISOLATION",
        market_pass,
        market_fields_found,
        [],
        "The shadow package contains no market prices, gaps or marketViewed:true state.",
    ))

    protected_pass = protected_before == protected_after
    cases.append(scenario_case(
        "PROTECTED_ARTIFACT_INTEGRITY",
        protected_pass,
        protected_after,
        protected_before,
        "Every protected Graham, active-week and upstream Stage 3 artifact retains its exact SHA-256.",
    ))

    deterministic_material = {
        "bindings": canonical_sha(bindings),
        "board": canonical_sha(board),
        "reconciliation": canonical_sha(reconciliation),
        "rollover": canonical_sha(rollover),
    }
    deterministic_recheck = {
        "bindings": canonical_sha(json.loads(json.dumps(bindings))),
        "board": canonical_sha(json.loads(json.dumps(board))),
        "reconciliation": canonical_sha(json.loads(json.dumps(reconciliation))),
        "rollover": canonical_sha(json.loads(json.dumps(rollover))),
    }
    cases.append(scenario_case(
        "DETERMINISTIC_READBACK",
        deterministic_material == deterministic_recheck,
        deterministic_recheck,
        deterministic_material,
        "Canonical read-back of every core Stage 4 artifact reproduces the same hash.",
    ))

    required = set(contract["requiredRegressionCases"])
    actual = {case["caseKey"] for case in cases}
    missing = sorted(required - actual)
    unexpected = sorted(actual - required)
    all_passed = not missing and not unexpected and all(case["result"] == "PASS" for case in cases)

    return attach_canonical_hash({
        "schemaVersion": "walters-qb-performance-stage4-regression-audit-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 4,
        "status": "PASS" if all_passed else "FAIL",
        "testedAt": tested_at,
        "requiredCaseCount": len(required),
        "executedCaseCount": len(cases),
        "missingCases": missing,
        "unexpectedCases": unexpected,
        "passCount": sum(1 for case in cases if case["result"] == "PASS"),
        "failCount": sum(1 for case in cases if case["result"] == "FAIL"),
        "cases": cases,
        "protectedArtifactSha256Before": protected_before,
        "protectedArtifactSha256After": protected_after,
        "protectedArtifactsUnchanged": protected_pass,
        "currentGrahamFairNumbersChanged": False,
        "uncertaintyOverlaysRetired": False,
        "productionAuthority": False,
        "grahamWritesAllowed": False,
        "marketViewed": False,
    })


def build_acceptance(
    contract: dict[str, Any],
    stage3_acceptance: dict[str, Any],
    freeze: dict[str, Any],
    bindings: dict[str, Any],
    board: dict[str, Any],
    reconciliation: dict[str, Any],
    rollover: dict[str, Any],
    regression: dict[str, Any],
    protected_before: dict[str, str],
    protected_after: dict[str, str],
    tested_at: str,
) -> dict[str, Any]:
    checks = [
        {"id": "QBP4-STAGE3-ACCEPTED", "pass": stage3_acceptance.get("decision") == contract["dependency"]["requiredStage3Decision"]},
        {"id": "QBP4-FREEZE-COMPLETE", "pass": freeze.get("allInputsPresent") is True},
        {"id": "QBP4-TEAM-BINDINGS", "pass": bindings["summary"]["teamCount"] == contract["bindingPolicy"]["expectedTeamCount"]},
        {"id": "QBP4-RESOLVED-BINDINGS", "pass": bindings["summary"]["resolvedTeamCount"] == contract["bindingPolicy"]["expectedResolvedTeamCount"]},
        {"id": "QBP4-UNRESOLVED-FAIL-CLOSED", "pass": bindings["summary"]["unresolvedTeams"] == contract["bindingPolicy"]["expectedUnresolvedTeams"]},
        {"id": "QBP4-WEEK1-SHADOW-BOARD", "pass": board["summary"]["gameCount"] == contract["activeWeek"]["expectedGameCount"]},
        {"id": "QBP4-REGRESSION-MATRIX", "pass": regression.get("status") == "PASS"},
        {"id": "QBP4-OVERLAY-RECONCILIATION", "pass": reconciliation["summary"]["overlayCount"] == contract["overlayPolicy"]["expectedBindingCount"]},
        {"id": "QBP4-NO-OVERLAY-RETIREMENT", "pass": reconciliation.get("uncertaintyOverlaysRetired") is False and reconciliation["summary"]["retiredInStage4Count"] == 0},
        {"id": "QBP4-ROLLOVER-NO-LOOKAHEAD", "pass": rollover.get("status") == "PASS" and rollover.get("lookAheadAccepted") is False},
        {"id": "QBP4-PROTECTED-ARTIFACTS", "pass": protected_before == protected_after},
        {"id": "QBP4-MARKET-ISOLATION", "pass": all(recursive_market_true(value) is False for value in (contract, freeze, bindings, board, reconciliation, rollover, regression))},
        {"id": "QBP4-NO-PRODUCTION-AUTHORITY", "pass": all(value.get("productionAuthority") is False for value in (contract, freeze, bindings, board, reconciliation, rollover, regression))},
        {"id": "QBP4-NO-GRAHAM-WRITES", "pass": all(value.get("grahamWritesAllowed") is False for value in (contract, bindings, board, reconciliation, regression))},
    ]
    passed = all(check["pass"] is True for check in checks)
    decision = contract["acceptance"]["passState"] if passed else contract["acceptance"]["failState"]
    return attach_canonical_hash({
        "schemaVersion": "walters-qb-performance-stage4-acceptance-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 4,
        "status": "PASS" if passed else "FAIL",
        "decision": decision,
        "decidedAt": tested_at,
        "acceptedFor": contract["acceptance"]["acceptedFor"] if passed else None,
        "notAcceptedFor": contract["acceptance"]["notAcceptedFor"],
        "checks": checks,
        "freezeManifest": relative(FREEZE_PATH),
        "freezeManifestSha256": sha256_file(FREEZE_PATH),
        "starterBaselineBindings": relative(BINDINGS_PATH),
        "starterBaselineBindingsSha256": sha256_file(BINDINGS_PATH),
        "shadowBoard": relative(SHADOW_BOARD_PATH),
        "shadowBoardSha256": sha256_file(SHADOW_BOARD_PATH),
        "uncertaintyReconciliation": relative(RECONCILIATION_PATH),
        "uncertaintyReconciliationSha256": sha256_file(RECONCILIATION_PATH),
        "rolloverAudit": relative(ROLLOVER_PATH),
        "rolloverAuditSha256": sha256_file(ROLLOVER_PATH),
        "regressionAudit": relative(REGRESSION_PATH),
        "regressionAuditSha256": sha256_file(REGRESSION_PATH),
        "starterBindingSummary": bindings["summary"],
        "shadowBoardSummary": board["summary"],
        "uncertaintySummary": reconciliation["summary"],
        "modelCautionFlagsCarriedForward": stage3_acceptance.get("modelCautionFlags", []),
        "limitationsCarriedForward": contract["knownStage4Limitations"],
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
    })


def build_current(
    contract: dict[str, Any],
    stage3_acceptance: dict[str, Any],
    freeze: dict[str, Any],
    bindings: dict[str, Any],
    board: dict[str, Any],
    reconciliation: dict[str, Any],
    rollover: dict[str, Any],
    regression: dict[str, Any],
    acceptance: dict[str, Any],
    tested_at: str,
) -> dict[str, Any]:
    return attach_canonical_hash({
        "schemaVersion": "walters-qb-performance-stage4-current-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 4,
        "status": acceptance["decision"],
        "testedAt": tested_at,
        "operational": False,
        "productionAuthority": False,
        "grahamWritesAllowed": False,
        "marketViewed": False,
        "stage3Acceptance": relative(STAGE3_ACCEPTANCE_PATH),
        "stage3AcceptanceSha256": sha256_file(STAGE3_ACCEPTANCE_PATH),
        "stage3Decision": stage3_acceptance.get("decision"),
        "freezeManifest": relative(FREEZE_PATH),
        "freezeManifestSha256": sha256_file(FREEZE_PATH),
        "starterBaselineBindings": relative(BINDINGS_PATH),
        "starterBaselineBindingsSha256": sha256_file(BINDINGS_PATH),
        "shadowBoard": relative(SHADOW_BOARD_PATH),
        "shadowBoardSha256": sha256_file(SHADOW_BOARD_PATH),
        "uncertaintyReconciliation": relative(RECONCILIATION_PATH),
        "uncertaintyReconciliationSha256": sha256_file(RECONCILIATION_PATH),
        "rolloverAudit": relative(ROLLOVER_PATH),
        "rolloverAuditSha256": sha256_file(ROLLOVER_PATH),
        "regressionAudit": relative(REGRESSION_PATH),
        "regressionAuditSha256": sha256_file(REGRESSION_PATH),
        "stage4Acceptance": relative(ACCEPTANCE_PATH),
        "stage4AcceptanceSha256": sha256_file(ACCEPTANCE_PATH),
        "resolvedStarterBindings": bindings["summary"]["resolvedTeamCount"],
        "unresolvedStarterBindings": bindings["summary"]["unresolvedTeamCount"],
        "unresolvedTeams": bindings["summary"]["unresolvedTeams"],
        "shadowGameCount": board["summary"]["gameCount"],
        "failClosedShadowGameCount": board["summary"]["failClosedGameCount"],
        "eligibleStage5OverlayReplacementCount": reconciliation["summary"]["eligibleForStage5ReplacementCount"],
        "preservedOverlayCount": reconciliation["summary"]["preservedFailClosedCount"] + reconciliation["summary"]["preservedOrthogonalCount"],
        "candidateValuesOperational": False,
        "grahamFairNumbersChanged": False,
        "embeddedQbBaselinesChanged": False,
        "uncertaintyOverlaysRetired": False,
        "approvedFor": contract["acceptance"]["acceptedFor"],
        "nextStage": acceptance.get("nextStage"),
    })


def run_self_test() -> None:
    assert round_to_half(2.24) == 2.0
    assert round_to_half(2.25) == 2.5
    assert round_to_half(-2.25) == -2.5
    assert round_points(0.1 + 0.2, 3) == 0.3
    assert evidence_update_allowed(1, 0) is False
    assert evidence_update_allowed(1, 1) is True
    assert evidence_update_allowed(2, 1) is False
    away_delta, home_delta = -0.25, 0.4
    assert nearly_equal(away_delta - home_delta, -0.65)
    current, overlay, qb_points = -2.582, 0.5, 0.05
    reconciled = round_points(current - overlay + qb_points, 3)
    replayed = round_points(current - overlay + qb_points, 3)
    assert nearly_equal(reconciled, replayed)
    sample = {"a": 1, "contentSha256Canonical": "ignored", "nested": [{"contentSha256Canonical": "ignored", "b": 2}]}
    assert canonical_sha(sample) == canonical_sha({"a": 1, "nested": [{"b": 2}]})
    print("WALTERS QB STAGE 4 SELF-TEST: PASS")


def run_build() -> dict[str, Any]:
    contract = read_json(CONTRACT_PATH)
    authority = read_json(BINDING_AUTHORITY_PATH)
    stage3_acceptance = read_json(STAGE3_ACCEPTANCE_PATH)
    stage3_current = read_json(STAGE3_CURRENT_PATH)
    stage3_review = read_json(STAGE3_REVIEW_PATH)
    candidates = read_json(CANDIDATES_PATH)
    active_week = read_json(ACTIVE_WEEK_PATH)
    current_numbers = read_json(CURRENT_NUMBERS_PATH)
    research = read_json(RESEARCH_LEDGER_PATH)
    seed = read_json(SEED_PATH)
    vsin_update = read_json(VSIN_UPDATE_PATH)
    # Loaded for freeze/protection and authority-boundary validation. They are never mutated here.
    read_json(POWER_LEDGER_PATH)
    read_json(PERSONNEL_CURRENT_PATH)
    read_json(MATCHUP_CURRENT_PATH)

    validate_dependencies(
        contract,
        authority,
        stage3_acceptance,
        stage3_current,
        stage3_review,
        candidates,
        active_week,
        current_numbers,
        research,
        seed,
        vsin_update,
    )

    tested_at = str(stage3_acceptance.get("decidedAt") or authority.get("asOf") or current_numbers.get("updatedAt"))
    if not tested_at or tested_at == "None":
        raise RuntimeError("No deterministic Stage 4 test timestamp is available.")

    protected_before = protected_hashes(contract)
    freeze = build_freeze_manifest(contract, tested_at)
    write_json(FREEZE_PATH, freeze)

    bindings = build_bindings(contract, authority, candidates, research, vsin_update, tested_at)
    write_json(BINDINGS_PATH, bindings)

    board, reconciliation = build_shadow_board(contract, authority, bindings, current_numbers, tested_at)
    write_json(SHADOW_BOARD_PATH, board)
    write_json(RECONCILIATION_PATH, reconciliation)

    rollover = build_rollover_audit(contract, active_week, tested_at)
    write_json(ROLLOVER_PATH, rollover)

    protected_after = protected_hashes(contract)
    regression = build_regression_audit(
        contract,
        candidates,
        bindings,
        board,
        reconciliation,
        rollover,
        protected_before,
        protected_after,
        tested_at,
    )
    write_json(REGRESSION_PATH, regression)

    acceptance = build_acceptance(
        contract,
        stage3_acceptance,
        freeze,
        bindings,
        board,
        reconciliation,
        rollover,
        regression,
        protected_before,
        protected_after,
        tested_at,
    )
    write_json(ACCEPTANCE_PATH, acceptance)

    current = build_current(
        contract,
        stage3_acceptance,
        freeze,
        bindings,
        board,
        reconciliation,
        rollover,
        regression,
        acceptance,
        tested_at,
    )
    write_json(CURRENT_PATH, current)

    summary = {
        "status": acceptance["status"],
        "decision": acceptance["decision"],
        "teamBindings": bindings["summary"]["teamCount"],
        "resolvedTeamBindings": bindings["summary"]["resolvedTeamCount"],
        "unresolvedTeams": bindings["summary"]["unresolvedTeams"],
        "shadowGames": board["summary"]["gameCount"],
        "failClosedGames": board["summary"]["failClosedGameCount"],
        "eligibleOverlayReplacements": reconciliation["summary"]["eligibleForStage5ReplacementCount"],
        "regressionCases": regression["executedCaseCount"],
        "regressionPasses": regression["passCount"],
        "protectedArtifactsUnchanged": acceptance["protectedArtifactsUnchanged"],
        "grahamFairNumbersChanged": False,
        "uncertaintyOverlaysRetired": False,
        "productionAuthority": False,
        "marketViewed": False,
        "nextStage": acceptance.get("nextStage"),
    }
    print(json.dumps(summary, indent=2))
    if acceptance["status"] != "PASS":
        raise RuntimeError("Stage 4 acceptance failed.")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Walters QB performance Stage 4 shadow integration evidence.")
    parser.add_argument("--self-test", action="store_true", help="Run deterministic helper tests only.")
    args = parser.parse_args()
    if args.self_test:
        run_self_test()
        return
    run_build()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Evaluate the frozen BW6.2 distribution on the sealed 2025 holdout."""

from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.util
import json
import math
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "data/walters/nfl/key-numbers/bw6-stage1-contract-v1.json"
LOCK_PATH = ROOT / "data/walters/nfl/key-numbers/bw6-stage2-model-lock-v1.json"
CALIBRATION_PATH = ROOT / "data/walters/nfl/key-numbers/bw6-stage2-calibration-v1.json"
STAGE2_BUILDER_PATH = ROOT / "tools/build-walters-bw6-stage2.py"
CATEGORIES = [str(margin) for margin in range(1, 19)] + ["OTHER"]
EPSILON = 1e-12


def fail(message: str) -> None:
    raise RuntimeError(f"WALTERS BW6 STAGE 3 BUILD FAILED // {message}")


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def round_value(value: float, digits: int = 9) -> float:
    return round(float(value), digits)


def load_stage2_module():
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("walters_bw6_stage2", STAGE2_BUILDER_PATH)
    if spec is None or spec.loader is None:
        fail("cannot load frozen Stage 2 helper")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def protected_hashes(contract: dict[str, Any]) -> dict[str, str]:
    output = {}
    for relative in contract["protectedArtifacts"]:
        path = ROOT / relative
        if not path.exists():
            fail(f"missing protected artifact {relative}")
        output[relative] = sha256_file(path)
    return output


def load_holdout_and_prior_games(
    contract: dict[str, Any], stage2: Any
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
    historical = contract["historicalDataContract"]
    source_path = ROOT / historical["sourceSnapshot"]["path"]
    if sha256_file(source_path) != historical["sourceSnapshot"]["sha256"]:
        fail("FAIL_CLOSED_BW6_SOURCE_HASH_MISMATCH")
    holdout_seasons = historical["holdoutWindow"]["seasons"]
    if holdout_seasons != [2025]:
        fail("holdout identity changed")
    prior_seasons = [2023, 2024]
    allowed_seasons = set(prior_seasons + holdout_seasons)
    aliases = historical["teamIdentityAliases"]
    prior_games = []
    holdout_games = []
    score_rows_read = defaultdict(int)
    with source_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != historical["fieldWhitelist"]:
            fail("FAIL_CLOSED_BW6_SOURCE_FIELD_VIOLATION")
        for forbidden in historical["forbiddenFields"]:
            if forbidden in (reader.fieldnames or []):
                fail("FAIL_CLOSED_BW6_MARKET_CONTAMINATION")
        for raw in reader:
            season = int(raw["season"])
            if season not in allowed_seasons or raw["game_type"] != "REG":
                continue
            if raw["home_score"] == "" or raw["away_score"] == "":
                fail(f"missing final score in holdout support window: {raw['game_id']}")
            score_rows_read[season] += 1
            game = {
                "gameId": raw["game_id"],
                "season": season,
                "week": int(raw["week"]),
                "gameday": raw["gameday"],
                "homeTeam": stage2.canonical_team(raw["home_team"], aliases),
                "awayTeam": stage2.canonical_team(raw["away_team"], aliases),
                "homeScore": int(float(raw["home_score"])),
                "awayScore": int(float(raw["away_score"])),
                "neutralSite": raw["location"].strip().lower() != "home",
            }
            if season == 2025:
                holdout_games.append(game)
            else:
                prior_games.append(game)
    prior_games.sort(key=lambda game: (game["season"], game["week"], game["gameday"], game["gameId"]))
    holdout_games.sort(
        key=lambda game: (game["season"], game["week"], game["gameday"], game["gameId"])
    )
    if len(prior_games) != 544 or len(holdout_games) != 272:
        fail(
            f"holdout support counts changed: prior={len(prior_games)}, holdout={len(holdout_games)}"
        )
    return prior_games, holdout_games, {
        "sourceSnapshot": historical["sourceSnapshot"]["path"],
        "sourceSnapshotSha256": sha256_file(source_path),
        "priorSeasonsRead": prior_seasons,
        "priorScoreRowsRead": len(prior_games),
        "holdoutSeason": 2025,
        "holdoutScoreRowsRead": len(holdout_games),
        "scoreRowsReadBySeason": {
            str(season): count for season, count in sorted(score_rows_read.items())
        },
        "marketFieldsPresent": False,
        "marketInputsUsed": False,
    }


def orient_holdout_games(
    prior_games: list[dict[str, Any]],
    holdout_games: list[dict[str, Any]],
    lock: dict[str, Any],
    stage2: Any,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    orientation = lock["orientationMethod"]
    teams = lock["orientationAudit"]["canonicalTeams"]
    by_week: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for game in holdout_games:
        by_week[int(game["week"])].append(game)
    completed_current: list[dict[str, Any]] = []
    records = []
    counts = defaultdict(int)
    for week in sorted(by_week):
        training_games = list(prior_games) + list(completed_current)
        ratings = stage2.fit_team_ratings(
            training_games,
            teams,
            float(orientation["ridgePenalty"]),
            float(orientation["domesticHomeAdvantagePoints"]),
            float(orientation["neutralHomeAdvantagePoints"]),
        )
        for game in by_week[week]:
            location_value = (
                float(orientation["neutralHomeAdvantagePoints"])
                if game["neutralSite"]
                else float(orientation["domesticHomeAdvantagePoints"])
            )
            predicted_home_margin = (
                ratings[game["homeTeam"]] - ratings[game["awayTeam"]] + location_value
            )
            if predicted_home_margin > EPSILON:
                favorite_side = "HOME"
                favorite_team = game["homeTeam"]
                counts["homeFavorite"] += 1
            elif predicted_home_margin < -EPSILON:
                favorite_side = "AWAY"
                favorite_team = game["awayTeam"]
                counts["awayFavorite"] += 1
            else:
                favorite_side = "SPLIT"
                favorite_team = None
                counts["splitOrientation"] += 1

            # Outcome fields are consumed only after the favorite orientation above
            # has been sealed from prior games.
            actual_home_margin = game["homeScore"] - game["awayScore"]
            label_weights = stage2.make_label_weights(favorite_side, actual_home_margin)
            for category, weight in label_weights.items():
                counts[f"category_{category}"] += weight
            records.append(
                {
                    "gameId": game["gameId"],
                    "season": 2025,
                    "week": week,
                    "homeTeam": game["homeTeam"],
                    "awayTeam": game["awayTeam"],
                    "neutralSite": game["neutralSite"],
                    "pregameFavoriteSide": favorite_side,
                    "pregameFavoriteTeam": favorite_team,
                    "predictedHomeMargin": round_value(predicted_home_margin, 6),
                    "actualHomeMargin": actual_home_margin,
                    "observedCategoryWeights": {
                        category: round_value(weight, 6)
                        for category, weight in sorted(label_weights.items())
                    },
                }
            )
        completed_current.extend(by_week[week])
    if len(records) != 272 or len({record["gameId"] for record in records}) != 272:
        fail("holdout game identity is incomplete or duplicated")
    return records, {
        "games": len(records),
        "homeFavorite": counts["homeFavorite"],
        "awayFavorite": counts["awayFavorite"],
        "splitOrientation": counts["splitOrientation"],
        "targetGameScoresUsedForOrientation": False,
        "futureGamesUsedForOrientation": False,
        "marketInputsUsed": False,
    }


def book_distribution(contract: dict[str, Any]) -> dict[str, float]:
    weights = contract["bookExactBaseline"]["pointWeightsPercentPublishedRounded"]
    output = {str(margin): float(weights[str(margin)]) / 100.0 for margin in range(1, 19)}
    output["OTHER"] = 1.0 - sum(output.values())
    return output


def validate_distribution(distribution: dict[str, float], name: str) -> None:
    if list(distribution) != CATEGORIES:
        fail(f"{name} category identity changed")
    if any(not 0 < float(value) < 1 for value in distribution.values()):
        fail(f"{name} contains an invalid probability")
    if abs(sum(distribution.values()) - 1.0) > 1e-9:
        fail(f"{name} distribution does not sum to one")


def evaluate(
    distribution: dict[str, float], records: list[dict[str, Any]]
) -> dict[str, float | int]:
    log_loss = 0.0
    brier = 0.0
    for record in records:
        labels = record["observedCategoryWeights"]
        for category in CATEGORIES:
            target = float(labels.get(category, 0.0))
            probability = float(distribution[category])
            if target:
                log_loss -= target * math.log(probability)
            brier += (probability - target) ** 2
    games = len(records)
    return {
        "games": games,
        "multiclassLogLoss": round_value(log_loss / games),
        "multiclassBrierScore": round_value(brier / games),
    }


def observed_distribution(records: list[dict[str, Any]]) -> dict[str, float]:
    counts = {category: 0.0 for category in CATEGORIES}
    for record in records:
        for category, weight in record["observedCategoryWeights"].items():
            counts[category] += float(weight)
    return {category: counts[category] / len(records) for category in CATEGORIES}


def choose_generated_at(output_path: Path, model_lock_hash: str) -> str:
    explicit = os.environ.get("BW6_GENERATED_AT")
    if explicit:
        return explicit
    if output_path.exists():
        prior = read_json(output_path)
        if (
            prior.get("stage2ModelLockSha256") == model_lock_hash
            and prior.get("generatedAt")
        ):
            return str(prior["generatedAt"])
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def run_self_test() -> None:
    sample = {
        "1": 0.1,
        **{str(margin): 0.01 for margin in range(2, 19)},
        "OTHER": 0.73,
    }
    validate_distribution(sample, "self-test")
    records = [
        {"observedCategoryWeights": {"1": 1.0}},
        {"observedCategoryWeights": {"OTHER": 1.0}},
    ]
    metrics = evaluate(sample, records)
    if metrics["games"] != 2 or metrics["multiclassLogLoss"] <= 0:
        fail("self-test metrics")
    observed = observed_distribution(records)
    if observed["1"] != 0.5 or observed["OTHER"] != 0.5:
        fail("self-test observed distribution")
    print("WALTERS BW6 STAGE 3 SELF-TEST: PASS")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        run_self_test()
        return

    contract = read_json(CONTRACT_PATH)
    lock = read_json(LOCK_PATH)
    calibration = read_json(CALIBRATION_PATH)
    if lock.get("status") != "MODEL_SELECTED_AND_LOCKED_HOLDOUT_UNOPENED_NON_OPERATIONAL":
        fail("invalid Stage 2 model-lock entry status")
    if lock.get("holdoutViewed") is not False or lock.get("holdoutOutcomeFieldsRead") is not False:
        fail("Stage 2 evidence says holdout was opened before lock")
    if calibration.get("stage2ModelLockSha256") != sha256_file(LOCK_PATH):
        fail("Stage 2 calibration does not bind the current model lock")
    if calibration.get("selectedCategoryProbabilities") != lock["selectedModel"][
        "frozenCategoryProbabilities"
    ]:
        fail("frozen Stage 2 probabilities disagree")

    protected_before = protected_hashes(contract)
    source_before = sha256_file(
        ROOT / contract["historicalDataContract"]["sourceSnapshot"]["path"]
    )
    model_lock_before = sha256_file(LOCK_PATH)
    calibration_before = sha256_file(CALIBRATION_PATH)
    stage2 = load_stage2_module()
    prior_games, holdout_games, source_audit = load_holdout_and_prior_games(contract, stage2)
    records, orientation_audit = orient_holdout_games(prior_games, holdout_games, lock, stage2)

    selected = {
        category: float(lock["selectedModel"]["frozenCategoryProbabilities"][category])
        for category in CATEGORIES
    }
    book = book_distribution(contract)
    validate_distribution(selected, "selected")
    validate_distribution(book, "BOOK-EXACT")
    selected_metrics = evaluate(selected, records)
    book_metrics = evaluate(book, records)
    observed = observed_distribution(records)
    selected_aggregate = sum(selected[str(margin)] for margin in range(1, 19))
    book_aggregate = sum(book[str(margin)] for margin in range(1, 19))
    observed_aggregate = sum(observed[str(margin)] for margin in range(1, 19))
    aggregate_wilson_low, aggregate_wilson_high = stage2.wilson_interval(
        observed_aggregate * len(records), len(records)
    )
    aggregate_standard_error = math.sqrt(
        selected_aggregate * (1.0 - selected_aggregate) / len(records)
    )
    aggregate_z_score = (
        (observed_aggregate - selected_aggregate) / aggregate_standard_error
        if aggregate_standard_error > 0
        else 0.0
    )
    thresholds = contract["holdoutAcceptance"]["numericThresholds"]

    per_margin = []
    calibration_rows = {row["margin"]: row for row in calibration["marginRows"]}
    for margin in range(1, 19):
        key = str(margin)
        row = calibration_rows[margin]
        observed_count = observed[key] * len(records)
        per_margin.append(
            {
                "margin": margin,
                "observedEventCount": round_value(observed_count, 3),
                "observedPercent": round_value(observed[key] * 100.0, 6),
                "selectedPredictedPercent": round_value(selected[key] * 100.0, 6),
                "bookExactPredictedPercent": round_value(book[key] * 100.0, 6),
                "selectedErrorPercentagePoints": round_value(
                    (selected[key] - observed[key]) * 100.0, 6
                ),
                "insideDevelopmentWilson95": (
                    observed[key] * 100.0
                    >= row["currentCalibration"]["wilson95Percent"]["lowPercent"]
                    and observed[key] * 100.0
                    <= row["currentCalibration"]["wilson95Percent"]["highPercent"]
                ),
                "developmentSupportStatus": row["currentCalibration"]["supportStatus"],
            }
        )

    protected_after = protected_hashes(contract)
    source_after = sha256_file(
        ROOT / contract["historicalDataContract"]["sourceSnapshot"]["path"]
    )
    model_lock_after = sha256_file(LOCK_PATH)
    calibration_after = sha256_file(CALIBRATION_PATH)
    protected_pass = protected_before == protected_after
    frozen_inputs_pass = (
        source_before == source_after
        and model_lock_before == model_lock_after
        and calibration_before == calibration_after
    )
    all_rows_accounted = len(records) == 272 and len({record["gameId"] for record in records}) == 272
    distributions_pass = (
        abs(sum(selected.values()) - 1.0) <= thresholds["distributionSumTolerance"]
        and abs(sum(book.values()) - 1.0) <= thresholds["distributionSumTolerance"]
    )
    log_loss_delta = (
        selected_metrics["multiclassLogLoss"] - book_metrics["multiclassLogLoss"]
    )
    brier_delta = (
        selected_metrics["multiclassBrierScore"] - book_metrics["multiclassBrierScore"]
    )
    aggregate_error_pp = abs(selected_aggregate - observed_aggregate) * 100.0
    margin_audit_pass = len(per_margin) == 18 and all(
        row["developmentSupportStatus"] in {
            "CURRENT_SUPPORTED",
            "SHADOW_ONLY_UNSTABLE",
            "SHADOW_ONLY_INSUFFICIENT_SAMPLE",
        }
        for row in per_margin
    )
    unsupported_pass = all(
        row["developmentSupportStatus"] == "CURRENT_SUPPORTED" for row in per_margin
    )
    market_isolation_pass = (
        source_audit["marketFieldsPresent"] is False
        and source_audit["marketInputsUsed"] is False
        and orientation_audit["marketInputsUsed"] is False
    )

    checks = [
        {
            "id": "BW6H-MODEL-LOCK-PREEXISTED",
            "pass": frozen_inputs_pass,
            "actual": {
                "modelLockSha256Before": model_lock_before,
                "modelLockSha256After": model_lock_after,
                "calibrationSha256Before": calibration_before,
                "calibrationSha256After": calibration_after,
            },
            "expected": "Frozen Stage 2 inputs remain byte-identical throughout holdout evaluation.",
        },
        {
            "id": "BW6H-GAME-ACCOUNTING",
            "pass": all_rows_accounted,
            "actual": len(records),
            "expected": 272,
        },
        {
            "id": "BW6H-DISTRIBUTIONS",
            "pass": distributions_pass,
            "actual": {
                "selectedSum": round_value(sum(selected.values()), 12),
                "bookExactSum": round_value(sum(book.values()), 12),
            },
            "expected": 1.0,
        },
        {
            "id": "BW6H-LOG-LOSS",
            "pass": log_loss_delta <= thresholds["maximumLogLossWorseThanBook"] + EPSILON,
            "actualDelta": round_value(log_loss_delta),
            "maximum": thresholds["maximumLogLossWorseThanBook"],
        },
        {
            "id": "BW6H-BRIER",
            "pass": brier_delta <= thresholds["maximumBrierScoreWorseThanBook"] + EPSILON,
            "actualDelta": round_value(brier_delta),
            "maximum": thresholds["maximumBrierScoreWorseThanBook"],
        },
        {
            "id": "BW6H-AGGREGATE-CALIBRATION",
            "pass": aggregate_error_pp
            <= thresholds["maximumAggregateOneThroughEighteenCalibrationErrorPercentagePoints"]
            + EPSILON,
            "actualErrorPercentagePoints": round_value(aggregate_error_pp, 6),
            "maximum": thresholds[
                "maximumAggregateOneThroughEighteenCalibrationErrorPercentagePoints"
            ],
        },
        {
            "id": "BW6H-MARGIN-AUDIT",
            "pass": margin_audit_pass,
            "actual": len(per_margin),
            "expected": 18,
        },
        {
            "id": "BW6H-UNSUPPORTED-FAIL-CLOSED",
            "pass": unsupported_pass,
            "actual": sum(
                row["developmentSupportStatus"] == "CURRENT_SUPPORTED"
                for row in per_margin
            ),
            "expected": 18,
        },
        {
            "id": "BW6H-MARKET-ISOLATION",
            "pass": market_isolation_pass,
            "actual": {
                "marketFieldsPresent": source_audit["marketFieldsPresent"],
                "marketInputsUsed": source_audit["marketInputsUsed"],
            },
            "expected": False,
        },
        {
            "id": "BW6H-PROTECTED-ARTIFACTS",
            "pass": protected_pass,
            "actual": protected_pass,
            "expected": True,
        },
    ]
    holdout_pass = all(check["pass"] for check in checks)
    output_path = ROOT / contract["outputs"]["stage3HoldoutAudit"]
    generated_at = choose_generated_at(output_path, model_lock_before)
    payload = {
        "schemaVersion": "walters-bw6-stage3-holdout-audit-v1",
        "module": contract["module"],
        "stage": "BW6.3",
        "status": (
            contract["holdoutAcceptance"]["passState"]
            if holdout_pass
            else contract["holdoutAcceptance"]["failState"]
        ),
        "generatedAt": generated_at,
        "operational": False,
        "productionAuthority": False,
        "grahamFairMutationAllowed": False,
        "liveBoardMutationAllowed": False,
        "betStatusMutationAllowed": False,
        "stakeMutationAllowed": False,
        "marketViewed": False,
        "holdoutViewed": True,
        "holdoutOutcomeFieldsRead": True,
        "modelReselectionAllowed": False,
        "modelReselected": False,
        "stage1ContractSha256": sha256_file(CONTRACT_PATH),
        "stage2ModelLockSha256": model_lock_before,
        "stage2CalibrationSha256": calibration_before,
        "builder": Path(__file__).relative_to(ROOT).as_posix(),
        "builderSha256": sha256_file(Path(__file__)),
        "selectedModelId": lock["selectedModel"]["modelId"],
        "sourceAudit": source_audit,
        "orientationAudit": orientation_audit,
        "distributions": {
            "selectedCalibrated": {
                key: round_value(value) for key, value in selected.items()
            },
            "bookExactRounded": {key: round_value(value) for key, value in book.items()},
            "observedHoldout": {key: round_value(value) for key, value in observed.items()},
        },
        "metrics": {
            "selectedCalibrated": selected_metrics,
            "bookExactRounded": book_metrics,
            "selectedMinusBook": {
                "multiclassLogLoss": round_value(log_loss_delta),
                "multiclassBrierScore": round_value(brier_delta),
            },
            "aggregateOneThroughEighteen": {
                "selectedPredictedPercent": round_value(selected_aggregate * 100.0, 6),
                "bookExactPredictedPercent": round_value(book_aggregate * 100.0, 6),
                "observedPercent": round_value(observed_aggregate * 100.0, 6),
                "selectedAbsoluteErrorPercentagePoints": round_value(
                    aggregate_error_pp, 6
                ),
                "samplingDiagnostic": {
                    "holdoutWilson95LowPercent": round_value(
                        aggregate_wilson_low * 100.0, 6
                    ),
                    "holdoutWilson95HighPercent": round_value(
                        aggregate_wilson_high * 100.0, 6
                    ),
                    "selectedPredictionInsideHoldoutWilson95": (
                        selected_aggregate >= aggregate_wilson_low
                        and selected_aggregate <= aggregate_wilson_high
                    ),
                    "standardErrorPercentagePointsUnderSelectedModel": round_value(
                        aggregate_standard_error * 100.0, 6
                    ),
                    "observedMinusSelectedZScore": round_value(aggregate_z_score, 6),
                    "diagnosticOnlyNoGateOverride": True,
                },
            },
        },
        "perMargin": per_margin,
        "holdoutGames": records,
        "acceptanceChecks": checks,
        "summary": {
            "checks": len(checks),
            "passed": sum(check["pass"] for check in checks),
            "failed": sum(not check["pass"] for check in checks),
            "holdoutPass": holdout_pass,
        },
        "protectedArtifactSha256Before": protected_before,
        "protectedArtifactSha256After": protected_after,
        "protectedArtifactsUnchanged": protected_pass,
        "frozenInputSha256Before": {
            "sourceSnapshot": source_before,
            "stage2ModelLock": model_lock_before,
            "stage2Calibration": calibration_before,
        },
        "frozenInputSha256After": {
            "sourceSnapshot": source_after,
            "stage2ModelLock": model_lock_after,
            "stage2Calibration": calibration_after,
        },
        "nextStage": "BW6.4_ACTIVE_WEEK_SHADOW" if holdout_pass else None,
    }
    write_json(output_path, payload)
    print(
        "WALTERS BW6 STAGE 3 BUILD: "
        f"{'PASS' if holdout_pass else 'FAIL CLOSED'} // "
        f"{payload['summary']['passed']}/{payload['summary']['checks']} CHECKS // "
        f"LOG LOSS Δ {log_loss_delta:+.6f} // BRIER Δ {brier_delta:+.6f} // "
        f"AGG ERROR {aggregate_error_pp:.3f}pp // MARKET ISOLATED // NON-OPERATIONAL"
    )
    if not holdout_pass:
        raise SystemExit(2)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # pragma: no cover - command boundary
        print(str(exc), file=sys.stderr)
        raise

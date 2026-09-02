#!/usr/bin/env python3
from __future__ import annotations

import argparse
import bisect
import csv
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean, median
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
QB_ROOT = ROOT / "data" / "walters" / "nfl" / "qb-performance"
CONTRACT_PATH = QB_ROOT / "stage3c-contract-v1.json"
STAGE3A_CONTRACT_PATH = QB_ROOT / "stage3-contract-v1.json"
STAGE3B_CONTRACT_PATH = QB_ROOT / "stage3b-contract-v1.json"
STAGE3_CURRENT_PATH = QB_ROOT / "stage3-current.json"
STAGE3B_AUDIT_PATH = QB_ROOT / "stage3b-audit-v1.json"
SOURCE_MANIFEST_PATH = QB_ROOT / "source" / "source-manifest-v1.json"
IDENTITY_CROSSWALK_PATH = QB_ROOT / "identity-crosswalk-v1.json"
WEEKLY_PATH = QB_ROOT / "normalized" / "qb-weekly-2021-2025-v1.csv"
SEASONAL_PATH = QB_ROOT / "normalized" / "qb-seasonal-2021-2025-v1.csv"
MODEL_PATH = QB_ROOT / "model" / "stage3c-model-v1.json"
AUDIT_PATH = QB_ROOT / "model" / "stage3c-holdout-audit-v1.json"
CANDIDATE_PATH = QB_ROOT / "candidates" / "qb-candidates-2026-stage3c-v1.json"
POWER_LEDGER_PATH = ROOT / "data" / "walters" / "nfl-power-ratings-ledger.json"
PERSONNEL_CONTEXT_PATH = ROOT / "data" / "walters" / "nfl" / "personnel-production-current.json"
MATCHUP_CONTEXT_PATH = ROOT / "data" / "walters" / "nfl" / "matchup-production-current.json"
ACTIVE_WEEK_PATH = ROOT / "data" / "walters" / "nfl" / "active-week.json"

COUNT_FIELDS = [
    "completions",
    "attempts",
    "passing_yards",
    "passing_tds",
    "interceptions",
    "sacks_suffered",
    "recorded_qb_fumbles",
    "recorded_qb_fumbles_lost",
    "carries",
    "rushing_yards",
    "rushing_tds",
    "rushing_first_downs",
]
FEATURE_FAMILIES = [
    ("passer_rating", 1.0, "attempts"),
    ("yards_per_attempt", 1.0, "attempts"),
    ("interception_rate", -1.0, "attempts"),
    ("sack_rate", -1.0, "dropbacks"),
    ("fumble_rate", -1.0, "dropbacks"),
    ("qb_rushing_value", 1.0, "dropbacks"),
]
FEATURE_NAMES = [f"{window}_{family}" for window in ("long", "short") for family, _, _ in FEATURE_FAMILIES]
FORBIDDEN_INPUT_TOKENS = ("spread", "odds", "moneyline", "pinnacle", "book_price", "ats_result")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_sha(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def finite_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    text = str(value).strip()
    if text in {"", "NA", "NaN", "nan", "NULL", "null"}:
        return default
    parsed = float(text)
    return parsed if math.isfinite(parsed) else default


def finite_int(value: Any, default: int = 0) -> int:
    parsed = finite_float(value, float(default))
    rounded = round(parsed)
    if abs(parsed - rounded) > 1e-6:
        raise RuntimeError(f"Expected integer-compatible value, received {value!r}")
    return int(rounded)


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def round_value(value: float, decimals: int = 8) -> float:
    return round(float(value), decimals)


def nfl_passer_rating(completions: int, attempts: int, yards: int, touchdowns: int, interceptions: int) -> float | None:
    if attempts <= 0:
        return None
    a = clamp(((completions / attempts) - 0.3) * 5.0, 0.0, 2.375)
    b = clamp(((yards / attempts) - 3.0) * 0.25, 0.0, 2.375)
    c = clamp((touchdowns / attempts) * 20.0, 0.0, 2.375)
    d = clamp(2.375 - ((interceptions / attempts) * 25.0), 0.0, 2.375)
    return ((a + b + c + d) / 6.0) * 100.0


def safe_ratio(numerator: float, denominator: float) -> float | None:
    if denominator <= 0:
        return None
    return numerator / denominator


def read_weekly_rows() -> tuple[list[dict[str, Any]], list[str]]:
    with WEEKLY_PATH.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise RuntimeError("Stage 3B weekly evidence has no header")
        headers = [str(field) for field in reader.fieldnames]
        forbidden = [field for field in headers if any(token in field.lower() for token in FORBIDDEN_INPUT_TOKENS)]
        if forbidden:
            raise RuntimeError(f"Forbidden market-like fields in Stage 3B weekly evidence: {forbidden}")
        rows: list[dict[str, Any]] = []
        for source in reader:
            if str(source.get("season_type") or "").upper() != "REG":
                continue
            if str(source.get("position") or "").upper() != "QB":
                continue
            row: dict[str, Any] = {
                "player_id": str(source.get("player_id") or "").strip(),
                "player_display_name": str(source.get("player_display_name") or "").strip(),
                "recent_team": str(source.get("recent_team") or "").strip().upper(),
                "opponent_team": str(source.get("opponent_team") or "").strip().upper(),
                "season": finite_int(source.get("season")),
                "week": finite_int(source.get("week")),
                "passing_epa": finite_float(source.get("passing_epa")),
                "rushing_epa": finite_float(source.get("rushing_epa")),
            }
            for field in COUNT_FIELDS:
                row[field] = finite_int(source.get(field))
            row["dropbacks"] = finite_int(source.get("dropbacks"))
            if row["dropbacks"] != row["attempts"] + row["sacks_suffered"]:
                raise RuntimeError(
                    f"Stage 3B dropback identity failed for {row['player_id']} {row['season']} W{row['week']}"
                )
            row["opportunities"] = row["dropbacks"] + row["carries"]
            row["total_qb_epa"] = row["passing_epa"] + row["rushing_epa"]
            row["raw_target"] = safe_ratio(row["total_qb_epa"], row["opportunities"])
            rows.append(row)
    rows.sort(key=lambda row: (row["season"], row["week"], row["player_id"], row["recent_team"]))
    return rows, headers


def assign_opponent_adjusted_targets(rows: list[dict[str, Any]], contract: dict[str, Any]) -> None:
    target_contract = contract["validationTarget"]
    prior_opportunities = float(target_contract["opponentPriorEquivalentOpportunities"])
    carryover = float(target_contract["previousSeasonDefenseCarryoverWeight"])
    lower, upper = [float(value) for value in target_contract["targetWinsorBounds"]]

    global_numerator = 0.0
    global_denominator = 0.0
    previous_season_defense: dict[str, tuple[float, float]] = {}
    rows_by_season_week: dict[int, dict[int, list[dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))
    for row in rows:
        rows_by_season_week[int(row["season"])][int(row["week"])].append(row)

    for season in sorted(rows_by_season_week):
        defense = {
            team: [numerator * carryover, denominator * carryover]
            for team, (numerator, denominator) in previous_season_defense.items()
        }
        current_season_defense: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0])
        for week in sorted(rows_by_season_week[season]):
            week_rows = rows_by_season_week[season][week]
            league_mean = global_numerator / global_denominator if global_denominator > 0 else 0.0
            for row in week_rows:
                raw_target = row["raw_target"]
                if raw_target is None:
                    row["opponent_strength_before"] = 0.0
                    row["adjusted_target"] = None
                    continue
                opponent = str(row["opponent_team"])
                opponent_num, opponent_den = defense.get(opponent, [0.0, 0.0])
                opponent_allowed = (
                    (opponent_num + prior_opportunities * league_mean) /
                    (opponent_den + prior_opportunities)
                )
                strength = opponent_allowed - league_mean
                row["opponent_strength_before"] = strength
                row["adjusted_target"] = clamp(float(raw_target) - strength, lower, upper)

            # Update only after every row in the week has received its prior-only estimate.
            for row in week_rows:
                opportunities = float(row["opportunities"])
                if opportunities <= 0:
                    continue
                opponent = str(row["opponent_team"])
                numerator = float(row["total_qb_epa"])
                defense.setdefault(opponent, [0.0, 0.0])
                defense[opponent][0] += numerator
                defense[opponent][1] += opportunities
                current_season_defense[opponent][0] += numerator
                current_season_defense[opponent][1] += opportunities
                global_numerator += numerator
                global_denominator += opportunities
        previous_season_defense = {
            team: (values[0], values[1]) for team, values in current_season_defense.items()
        }


def is_qualified(row: dict[str, Any], contract: dict[str, Any]) -> bool:
    rules = contract["eligibleGameEvidence"]
    return (
        int(row["attempts"]) >= int(rules["minimumAttempts"])
        and int(row["dropbacks"]) >= int(rules["minimumDropbacks"])
        and row.get("adjusted_target") is not None
    )


def aggregate_rows(rows: Iterable[dict[str, Any]]) -> dict[str, float]:
    totals = {field: 0.0 for field in COUNT_FIELDS}
    totals["dropbacks"] = 0.0
    totals["opportunities"] = 0.0
    totals["adjusted_target_numerator"] = 0.0
    totals["adjusted_target_denominator"] = 0.0
    for row in rows:
        for field in COUNT_FIELDS:
            totals[field] += float(row[field])
        totals["dropbacks"] += float(row["dropbacks"])
        totals["opportunities"] += float(row["opportunities"])
        if row.get("adjusted_target") is not None and float(row["opportunities"]) > 0:
            totals["adjusted_target_numerator"] += float(row["adjusted_target"]) * float(row["opportunities"])
            totals["adjusted_target_denominator"] += float(row["opportunities"])
    return totals


def metrics_from_totals(totals: dict[str, float]) -> dict[str, tuple[float | None, float]]:
    attempts = totals["attempts"]
    dropbacks = totals["dropbacks"]
    passer = nfl_passer_rating(
        int(round(totals["completions"])),
        int(round(attempts)),
        int(round(totals["passing_yards"])),
        int(round(totals["passing_tds"])),
        int(round(totals["interceptions"])),
    )
    return {
        "passer_rating": (passer, attempts),
        "yards_per_attempt": (safe_ratio(totals["passing_yards"], attempts), attempts),
        "interception_rate": (safe_ratio(totals["interceptions"], attempts), attempts),
        "sack_rate": (safe_ratio(totals["sacks_suffered"], dropbacks), dropbacks),
        "fumble_rate": (safe_ratio(totals["recorded_qb_fumbles"], dropbacks), dropbacks),
        "qb_rushing_value": (safe_ratio(totals["rushing_yards"], dropbacks), dropbacks),
    }


def pooled_metric_centers(rows: list[dict[str, Any]], through_season: int, contract: dict[str, Any]) -> dict[str, float]:
    eligible = [row for row in rows if int(row["season"]) <= through_season and is_qualified(row, contract)]
    metrics = metrics_from_totals(aggregate_rows(eligible))
    centers: dict[str, float] = {}
    for family, _, _ in FEATURE_FAMILIES:
        value, _ = metrics[family]
        if value is None or not math.isfinite(value):
            raise RuntimeError(f"Unable to establish pooled metric center for {family}")
        centers[family] = float(value)
    return centers


def shrink_metric(value: float | None, denominator: float, center: float, prior_equivalent: float) -> float:
    if value is None or denominator <= 0:
        return center
    reliability = denominator / (denominator + prior_equivalent)
    return center + reliability * (float(value) - center)


def raw_feature_vector(
    long_rows: list[dict[str, Any]],
    short_rows: list[dict[str, Any]],
    centers: dict[str, float],
    prior_equivalent: float,
) -> tuple[list[float], dict[str, Any]]:
    output: list[float] = []
    evidence: dict[str, Any] = {}
    for window_name, window_rows in (("long", long_rows), ("short", short_rows)):
        totals = aggregate_rows(window_rows)
        metrics = metrics_from_totals(totals)
        evidence[window_name] = {
            "qualifiedGames": len(window_rows),
            "attempts": int(round(totals["attempts"])),
            "dropbacks": int(round(totals["dropbacks"])),
        }
        for family, _, denominator_name in FEATURE_FAMILIES:
            value, denominator = metrics[family]
            if denominator_name == "attempts":
                denominator = totals["attempts"]
            elif denominator_name == "dropbacks":
                denominator = totals["dropbacks"]
            shrunk = shrink_metric(value, float(denominator), centers[family], prior_equivalent)
            output.append(float(shrunk))
    return output, evidence


def group_rows_by_player(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[str(row["player_id"])].append(row)
    for player_rows in grouped.values():
        player_rows.sort(key=lambda row: (row["season"], row["week"], row["recent_team"]))
    return grouped


def history_windows(
    prior_qualified: list[dict[str, Any]],
    target_season: int,
    long_seasons: int,
    short_games: int,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    lower_season = target_season - long_seasons
    long_rows = [
        row for row in prior_qualified
        if lower_season <= int(row["season"]) < target_season
    ]
    short_rows = prior_qualified[-short_games:]
    return long_rows, short_rows


def build_samples(
    grouped: dict[str, list[dict[str, Any]]],
    target_seasons: set[int],
    contract: dict[str, Any],
    long_seasons: int,
    short_games: int,
    prior_equivalent: float,
    centers: dict[str, float],
) -> list[dict[str, Any]]:
    minimum_prior = int(contract["eligibleGameEvidence"]["minimumPriorDropbacksForEvaluation"])
    samples: list[dict[str, Any]] = []
    for player_id, player_rows in sorted(grouped.items()):
        prior_qualified: list[dict[str, Any]] = []
        for row in player_rows:
            season = int(row["season"])
            if season in target_seasons and is_qualified(row, contract):
                prior_dropbacks = sum(int(item["dropbacks"]) for item in prior_qualified)
                if prior_dropbacks >= minimum_prior:
                    long_rows, short_rows = history_windows(
                        prior_qualified, season, long_seasons, short_games
                    )
                    raw_features, evidence = raw_feature_vector(
                        long_rows, short_rows, centers, prior_equivalent
                    )
                    recent_totals = aggregate_rows(short_rows)
                    samples.append(
                        {
                            "player_id": player_id,
                            "player_name": row["player_display_name"],
                            "season": season,
                            "week": int(row["week"]),
                            "raw_features": raw_features,
                            "target": float(row["adjusted_target"]),
                            "raw_target": float(row["raw_target"]),
                            "opponent_strength_before": float(row["opponent_strength_before"]),
                            "target_opportunities": int(row["opportunities"]),
                            "prior_dropbacks": prior_dropbacks,
                            "recent_target_numerator": float(recent_totals["adjusted_target_numerator"]),
                            "recent_target_denominator": float(recent_totals["adjusted_target_denominator"]),
                            "evidence": evidence,
                        }
                    )
            if is_qualified(row, contract):
                prior_qualified.append(row)
    samples.sort(key=lambda sample: (sample["season"], sample["week"], sample["player_id"]))
    return samples


def fit_scaler(samples: list[dict[str, Any]]) -> dict[str, list[float]]:
    if not samples:
        raise RuntimeError("Cannot fit feature scaler without samples")
    columns = list(zip(*(sample["raw_features"] for sample in samples)))
    means: list[float] = []
    scales: list[float] = []
    for column in columns:
        values = [float(value) for value in column]
        center = mean(values)
        variance = sum((value - center) ** 2 for value in values) / len(values)
        scale = math.sqrt(variance)
        means.append(center)
        scales.append(scale if scale > 1e-12 else 1.0)
    return {"means": means, "scales": scales}


def transform_features(raw_features: list[float], scaler: dict[str, list[float]], clip_limit: float) -> list[float]:
    directions = [direction for _window in ("long", "short") for _, direction, _ in FEATURE_FAMILIES]
    transformed: list[float] = []
    for value, center, scale, direction in zip(
        raw_features, scaler["means"], scaler["scales"], directions
    ):
        z_score = direction * ((float(value) - float(center)) / float(scale))
        transformed.append(clamp(z_score, -clip_limit, clip_limit))
    return transformed


def transform_samples(
    samples: list[dict[str, Any]], scaler: dict[str, list[float]], clip_limit: float
) -> tuple[list[list[float]], list[float]]:
    x_values = [transform_features(sample["raw_features"], scaler, clip_limit) for sample in samples]
    y_values = [float(sample["target"]) for sample in samples]
    return x_values, y_values


def fit_nonnegative_ridge(
    x_values: list[list[float]],
    y_values: list[float],
    alpha: float,
    max_iterations: int,
    tolerance: float,
) -> dict[str, Any]:
    if not x_values or len(x_values) != len(y_values):
        raise RuntimeError("Invalid fit sample matrix")
    n_rows = len(x_values)
    n_columns = len(x_values[0])
    intercept = mean(y_values)
    centered_y = [value - intercept for value in y_values]
    gram = [[0.0 for _ in range(n_columns)] for _ in range(n_columns)]
    target_cov = [0.0 for _ in range(n_columns)]
    for row, target in zip(x_values, centered_y):
        for j in range(n_columns):
            target_cov[j] += row[j] * target / n_rows
            for k in range(j, n_columns):
                gram[j][k] += row[j] * row[k] / n_rows
    for j in range(n_columns):
        for k in range(j):
            gram[j][k] = gram[k][j]

    weights = [0.0 for _ in range(n_columns)]
    iterations = 0
    for iteration in range(max_iterations):
        max_change = 0.0
        for j in range(n_columns):
            residual_cov = target_cov[j] - sum(
                gram[j][k] * weights[k] for k in range(n_columns) if k != j
            )
            denominator = gram[j][j] + alpha
            updated = max(0.0, residual_cov / denominator) if denominator > 0 else 0.0
            max_change = max(max_change, abs(updated - weights[j]))
            weights[j] = updated
        iterations = iteration + 1
        if max_change <= tolerance:
            break
    return {
        "intercept": float(intercept),
        "weights": weights,
        "iterations": iterations,
        "converged": iterations < max_iterations or max_change <= tolerance,
    }


def predict(model: dict[str, Any], x_values: list[list[float]]) -> list[float]:
    return [
        float(model["intercept"]) + sum(weight * value for weight, value in zip(model["weights"], row))
        for row in x_values
    ]


def pearson(values_a: list[float], values_b: list[float]) -> float:
    if len(values_a) != len(values_b) or len(values_a) < 2:
        return 0.0
    mean_a = mean(values_a)
    mean_b = mean(values_b)
    numerator = sum((a - mean_a) * (b - mean_b) for a, b in zip(values_a, values_b))
    denominator_a = math.sqrt(sum((a - mean_a) ** 2 for a in values_a))
    denominator_b = math.sqrt(sum((b - mean_b) ** 2 for b in values_b))
    if denominator_a <= 0 or denominator_b <= 0:
        return 0.0
    return numerator / (denominator_a * denominator_b)


def ranks(values: list[float]) -> list[float]:
    ordered = sorted((value, index) for index, value in enumerate(values))
    output = [0.0] * len(values)
    cursor = 0
    while cursor < len(ordered):
        end = cursor + 1
        while end < len(ordered) and ordered[end][0] == ordered[cursor][0]:
            end += 1
        average_rank = (cursor + end - 1) / 2.0
        for position in range(cursor, end):
            output[ordered[position][1]] = average_rank
        cursor = end
    return output


def evaluation_metrics(
    predictions: list[float],
    targets: list[float],
    samples: list[dict[str, Any]],
    training_mean: float,
    recent_prior_opportunities: float,
) -> dict[str, Any]:
    if not targets:
        raise RuntimeError("Cannot evaluate an empty target set")
    errors = [prediction - target for prediction, target in zip(predictions, targets)]
    mae = mean(abs(error) for error in errors)
    rmse = math.sqrt(mean(error * error for error in errors))
    league_predictions = [training_mean for _ in targets]
    league_errors = [training_mean - target for target in targets]
    league_mae = mean(abs(error) for error in league_errors)
    league_rmse = math.sqrt(mean(error * error for error in league_errors))
    recent_predictions: list[float] = []
    for sample in samples:
        denominator = float(sample["recent_target_denominator"])
        numerator = float(sample["recent_target_numerator"])
        recent_predictions.append(
            (numerator + recent_prior_opportunities * training_mean) /
            (denominator + recent_prior_opportunities)
            if denominator > 0
            else training_mean
        )
    recent_errors = [prediction - target for prediction, target in zip(recent_predictions, targets)]
    recent_mae = mean(abs(error) for error in recent_errors)
    recent_rmse = math.sqrt(mean(error * error for error in recent_errors))

    count = len(targets)
    quintile_count = max(1, count // 5)
    order = sorted(range(count), key=lambda index: (predictions[index], index))
    bottom = [targets[index] for index in order[:quintile_count]]
    top = [targets[index] for index in order[-quintile_count:]]
    directional = mean(
        1.0 if (prediction - training_mean) * (target - training_mean) >= 0 else 0.0
        for prediction, target in zip(predictions, targets)
    )
    prediction_variance = sum((value - mean(predictions)) ** 2 for value in predictions)
    calibration_slope = (
        sum((prediction - mean(predictions)) * (target - mean(targets)) for prediction, target in zip(predictions, targets))
        / prediction_variance
        if prediction_variance > 0
        else 0.0
    )
    return {
        "sampleCount": count,
        "mae": round_value(mae),
        "rmse": round_value(rmse),
        "pearson": round_value(pearson(predictions, targets)),
        "spearman": round_value(pearson(ranks(predictions), ranks(targets))),
        "topQuintileTargetMean": round_value(mean(top)),
        "bottomQuintileTargetMean": round_value(mean(bottom)),
        "topMinusBottomQuintileTargetGap": round_value(mean(top) - mean(bottom)),
        "directionalAccuracy": round_value(directional),
        "calibrationSlope": round_value(calibration_slope),
        "leagueMeanBaseline": {
            "prediction": round_value(training_mean),
            "mae": round_value(league_mae),
            "rmse": round_value(league_rmse),
        },
        "recentAdjustedEpaBaseline": {
            "mae": round_value(recent_mae),
            "rmse": round_value(recent_rmse),
        },
        "rmseToLeagueMeanRatio": round_value(rmse / league_rmse if league_rmse > 0 else math.inf),
        "maeToLeagueMeanRatio": round_value(mae / league_mae if league_mae > 0 else math.inf),
        "rmseToRecentAdjustedEpaRatio": round_value(rmse / recent_rmse if recent_rmse > 0 else math.inf),
    }


def family_weight_summary(weights: list[float]) -> dict[str, Any]:
    family_totals = {family: 0.0 for family, _, _ in FEATURE_FAMILIES}
    for name, weight in zip(FEATURE_NAMES, weights):
        family = name.split("_", 1)[1]
        family_totals[family] += float(weight)
    total = sum(family_totals.values())
    shares = {
        family: (value / total if total > 0 else 0.0)
        for family, value in family_totals.items()
    }
    active = [family for family, share in shares.items() if share >= 0.01]
    return {
        "rawByFamily": {family: round_value(value, 12) for family, value in family_totals.items()},
        "shareByFamily": {family: round_value(value, 8) for family, value in shares.items()},
        "activeFamiliesAtOnePercent": active,
        "activeFamilyCount": len(active),
        "maximumSingleFamilyShare": round_value(max(shares.values()) if shares else 0.0),
    }


def configuration_key(result: dict[str, Any]) -> tuple[Any, ...]:
    config = result["configuration"]
    metrics = result["tuningMetrics"]
    return (
        float(metrics["rmse"]),
        float(metrics["mae"]),
        -float(metrics["pearson"]),
        -int(config["longTermCompletedSeasons"]),
        -int(config["shortTermQualifiedGames"]),
        -float(config["featurePriorEquivalentDropbacks"]),
        -float(config["ridgeAlpha"]),
    )


def tune_configuration(
    rows: list[dict[str, Any]], grouped: dict[str, list[dict[str, Any]]], contract: dict[str, Any]
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    chronology = contract["chronology"]
    features = contract["predictiveFeatures"]
    model_contract = contract["model"]
    clip_limit = float(features["featureZScoreClip"])
    fit_seasons = {int(value) for value in chronology["modelFitSeasonsForTuning"]}
    tuning_seasons = {int(chronology["tuningSeason"])}
    centers = pooled_metric_centers(rows, max(fit_seasons), contract)
    results: list[dict[str, Any]] = []
    for long_seasons in features["longTermWindowCandidatesCompletedSeasons"]:
        for short_games in features["shortTermWindowCandidatesQualifiedGames"]:
            for prior_equivalent in features["featurePriorEquivalentDropbackCandidates"]:
                train_samples = build_samples(
                    grouped,
                    fit_seasons,
                    contract,
                    int(long_seasons),
                    int(short_games),
                    float(prior_equivalent),
                    centers,
                )
                tuning_samples = build_samples(
                    grouped,
                    tuning_seasons,
                    contract,
                    int(long_seasons),
                    int(short_games),
                    float(prior_equivalent),
                    centers,
                )
                scaler = fit_scaler(train_samples)
                train_x, train_y = transform_samples(train_samples, scaler, clip_limit)
                tune_x, tune_y = transform_samples(tuning_samples, scaler, clip_limit)
                for alpha in model_contract["ridgeAlphaCandidates"]:
                    fitted = fit_nonnegative_ridge(
                        train_x,
                        train_y,
                        float(alpha),
                        int(model_contract["maximumIterations"]),
                        float(model_contract["convergenceTolerance"]),
                    )
                    tune_predictions = predict(fitted, tune_x)
                    metrics = evaluation_metrics(
                        tune_predictions,
                        tune_y,
                        tuning_samples,
                        float(fitted["intercept"]),
                        float(contract["validationTarget"]["opponentPriorEquivalentOpportunities"]),
                    )
                    family_weights = family_weight_summary(fitted["weights"])
                    eligibility = model_contract["tuningEligibility"]
                    tuning_eligible = (
                        metrics["pearson"] >= float(eligibility["minimumPearsonCorrelation"])
                        and family_weights["activeFamilyCount"] >= int(eligibility["minimumActiveFeatureFamilies"])
                        and family_weights["maximumSingleFamilyShare"] <= float(eligibility["maximumSingleFeatureFamilyWeightShare"])
                    )
                    results.append(
                        {
                            "configuration": {
                                "longTermCompletedSeasons": int(long_seasons),
                                "shortTermQualifiedGames": int(short_games),
                                "featurePriorEquivalentDropbacks": float(prior_equivalent),
                                "ridgeAlpha": float(alpha),
                            },
                            "fitSampleCount": len(train_samples),
                            "tuningSampleCount": len(tuning_samples),
                            "tuningMetrics": metrics,
                            "weights": [round_value(value, 12) for value in fitted["weights"]],
                            "familyWeights": family_weights,
                            "tuningEligible": tuning_eligible,
                            "solverIterations": int(fitted["iterations"]),
                        }
                    )
    if not results:
        raise RuntimeError("Stage 3C configuration search produced no results")
    eligible_results = [result for result in results if result["tuningEligible"]]
    ranked = eligible_results if eligible_results else results
    ranked.sort(key=configuration_key)
    results.sort(key=configuration_key)
    return ranked[0], results


def final_fit_and_holdout(
    rows: list[dict[str, Any]],
    grouped: dict[str, list[dict[str, Any]]],
    contract: dict[str, Any],
    selected: dict[str, Any],
) -> dict[str, Any]:
    chronology = contract["chronology"]
    config = selected["configuration"]
    final_fit_seasons = {int(value) for value in chronology["finalFitSeasons"]}
    holdout_seasons = {int(chronology["untouchedHoldoutSeason"])}
    centers = pooled_metric_centers(rows, max(final_fit_seasons), contract)
    fit_samples = build_samples(
        grouped,
        final_fit_seasons,
        contract,
        int(config["longTermCompletedSeasons"]),
        int(config["shortTermQualifiedGames"]),
        float(config["featurePriorEquivalentDropbacks"]),
        centers,
    )
    holdout_samples = build_samples(
        grouped,
        holdout_seasons,
        contract,
        int(config["longTermCompletedSeasons"]),
        int(config["shortTermQualifiedGames"]),
        float(config["featurePriorEquivalentDropbacks"]),
        centers,
    )
    scaler = fit_scaler(fit_samples)
    clip_limit = float(contract["predictiveFeatures"]["featureZScoreClip"])
    fit_x, fit_y = transform_samples(fit_samples, scaler, clip_limit)
    holdout_x, holdout_y = transform_samples(holdout_samples, scaler, clip_limit)
    model_contract = contract["model"]
    fitted = fit_nonnegative_ridge(
        fit_x,
        fit_y,
        float(config["ridgeAlpha"]),
        int(model_contract["maximumIterations"]),
        float(model_contract["convergenceTolerance"]),
    )
    repeated = fit_nonnegative_ridge(
        fit_x,
        fit_y,
        float(config["ridgeAlpha"]),
        int(model_contract["maximumIterations"]),
        float(model_contract["convergenceTolerance"]),
    )
    deterministic = canonical_sha(fitted) == canonical_sha(repeated)
    predictions = predict(fitted, holdout_x)
    metrics = evaluation_metrics(
        predictions,
        holdout_y,
        holdout_samples,
        float(fitted["intercept"]),
        float(contract["validationTarget"]["opponentPriorEquivalentOpportunities"]),
    )
    return {
        "centers": centers,
        "scaler": scaler,
        "fitSamples": fit_samples,
        "holdoutSamples": holdout_samples,
        "fitX": fit_x,
        "holdoutX": holdout_x,
        "model": fitted,
        "deterministic": deterministic,
        "holdoutPredictions": predictions,
        "holdoutMetrics": metrics,
        "familyWeights": family_weight_summary(fitted["weights"]),
    }


def snapshot_feature_for_player(
    player_rows: list[dict[str, Any]],
    contract: dict[str, Any],
    config: dict[str, Any],
    centers: dict[str, float],
) -> tuple[list[float], dict[str, Any], int]:
    qualified = [row for row in player_rows if int(row["season"]) <= 2025 and is_qualified(row, contract)]
    long_rows, short_rows = history_windows(
        qualified,
        int(contract["chronology"]["candidateForSeason"]),
        int(config["longTermCompletedSeasons"]),
        int(config["shortTermQualifiedGames"]),
    )
    raw_features, evidence = raw_feature_vector(
        long_rows,
        short_rows,
        centers,
        float(config["featurePriorEquivalentDropbacks"]),
    )
    evidence_dropbacks = sum(int(row["dropbacks"]) for row in long_rows)
    evidence["candidateEvidenceDropbacks"] = evidence_dropbacks
    return raw_features, evidence, evidence_dropbacks


def percentile_against(sorted_values: list[float], value: float) -> float:
    if len(sorted_values) <= 1:
        return 0.5
    left = bisect.bisect_left(sorted_values, value)
    right = bisect.bisect_right(sorted_values, value)
    average_index = (left + right - 1) / 2.0
    return clamp(average_index / (len(sorted_values) - 1), 0.0, 1.0)


def interpolate_sorted(values: list[float], percentile: float) -> float:
    if not values:
        raise RuntimeError("Cannot interpolate an empty anchor distribution")
    if len(values) == 1:
        return float(values[0])
    index = clamp(percentile, 0.0, 1.0) * (len(values) - 1)
    lower = int(math.floor(index))
    upper = min(lower + 1, len(values) - 1)
    fraction = index - lower
    return float(values[lower]) * (1.0 - fraction) + float(values[upper]) * fraction


def build_candidates(
    grouped: dict[str, list[dict[str, Any]]],
    contract: dict[str, Any],
    final: dict[str, Any],
    crosswalk: dict[str, Any],
    selected_config: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    calibration = contract["candidateCalibration"]
    clip_limit = float(contract["predictiveFeatures"]["featureZScoreClip"])
    model = final["model"]
    rows: list[dict[str, Any]] = []
    for identity in crosswalk["players"]:
        gsis_id = identity.get("gsisId")
        history = grouped.get(str(gsis_id), []) if gsis_id else []
        raw_features, evidence, evidence_dropbacks = snapshot_feature_for_player(
            history,
            contract,
            selected_config,
            final["centers"],
        )
        transformed = transform_features(raw_features, final["scaler"], clip_limit)
        score = predict(model, [transformed])[0]
        long_contribution = sum(
            weight * value for weight, value in zip(model["weights"][:6], transformed[:6])
        )
        short_contribution = sum(
            weight * value for weight, value in zip(model["weights"][6:], transformed[6:])
        )
        rows.append(
            {
                "playerId": str(identity["eaPlayerId"]),
                "gsisId": gsis_id,
                "playerName": identity["eaPlayerName"],
                "team": identity.get("eaTeam"),
                "maddenOvr": int(identity["maddenOvr"]),
                "top67DistributionCohort": bool(identity["top67DistributionCohort"]),
                "identityStatus": identity["identityStatus"],
                "priorValue": float(identity["stage2PriorValue"]),
                "modelScore": float(score),
                "longTermPerformanceScore": float(long_contribution),
                "shortTermPerformanceScore": float(short_contribution),
                "evidence": evidence,
                "candidateEvidenceDropbacks": int(evidence_dropbacks),
                "transformedFeatures": [round_value(value, 8) for value in transformed],
            }
        )

    minimum_evidence = int(calibration["minimumCandidateEvidenceDropbacks"])
    experienced_top67 = [
        row for row in rows
        if row["top67DistributionCohort"] and row["candidateEvidenceDropbacks"] >= minimum_evidence
    ]
    score_distribution = sorted(float(row["modelScore"]) for row in experienced_top67)
    anchor_values = sorted(
        float(row["priorValue"]) for row in rows if row["top67DistributionCohort"]
    )
    if len(anchor_values) != 67:
        raise RuntimeError(f"Stage 3C could not reconstruct 67-value anchor distribution: {len(anchor_values)}")

    output_rows: list[dict[str, Any]] = []
    maximum_blend = float(calibration["maximumPerformanceBlend"])
    maximum_move = float(calibration["maximumAbsoluteMoveFromStage2Prior"])
    scale_min, scale_max = [float(value) for value in calibration["scale"]]
    prior_equivalent = float(selected_config["featurePriorEquivalentDropbacks"])
    for row in rows:
        prior_value = float(row["priorValue"])
        evidence_dropbacks = int(row["candidateEvidenceDropbacks"])
        identity_resolved = str(row["identityStatus"]).startswith("MATCHED_")
        if identity_resolved and evidence_dropbacks >= minimum_evidence and score_distribution:
            percentile = percentile_against(score_distribution, float(row["modelScore"]))
            performance_value = interpolate_sorted(anchor_values, percentile)
            sample_reliability = evidence_dropbacks / (evidence_dropbacks + prior_equivalent)
            performance_blend = min(maximum_blend, sample_reliability)
            unbounded = prior_value + performance_blend * (performance_value - prior_value)
            delta = clamp(unbounded - prior_value, -maximum_move, maximum_move)
            candidate_value = clamp(prior_value + delta, scale_min, scale_max)
            if evidence_dropbacks >= 1000:
                confidence = "HIGH"
            elif evidence_dropbacks >= 500:
                confidence = "MEDIUM"
            else:
                confidence = "LOW"
            status = "STAGE3_CANDIDATE_NON_OPERATIONAL"
        else:
            percentile = None
            performance_value = None
            sample_reliability = 0.0
            performance_blend = 0.0
            delta = 0.0
            candidate_value = prior_value
            confidence = "LOW"
            status = "BLOCKED_INSUFFICIENT_QB_SAMPLE" if identity_resolved else "BLOCKED_IDENTITY_UNRESOLVED"

        output_rows.append(
            {
                "playerId": row["playerId"],
                "gsisId": row["gsisId"],
                "playerName": row["playerName"],
                "team": row["team"],
                "maddenOvr": row["maddenOvr"],
                "top67DistributionCohort": row["top67DistributionCohort"],
                "priorValue": round_value(prior_value, 2),
                "longTermPerformanceScore": round_value(row["longTermPerformanceScore"]),
                "shortTermPerformanceScore": round_value(row["shortTermPerformanceScore"]),
                "modelScore": round_value(row["modelScore"]),
                "performancePercentile": round_value(percentile) if percentile is not None else None,
                "performanceImpliedValue": round_value(performance_value, 2) if performance_value is not None else None,
                "sampleReliability": round_value(sample_reliability),
                "performanceBlend": round_value(performance_blend),
                "candidateDeltaFromPrior": round_value(delta, 2),
                "candidateValue": round_value(candidate_value, 2),
                "confidence": confidence,
                "evidence": row["evidence"],
                "contextNormalization": {
                    "method": contract["validationTarget"]["opponentAdjustment"],
                    "directSpreadAddendAllowed": False,
                },
                "sourceLineage": {
                    "stage3BWeekly": relative(WEEKLY_PATH),
                    "identityCrosswalk": relative(IDENTITY_CROSSWALK_PATH),
                    "stage2Prior": "data/walters/nfl/player-values/player-values-2026-v1.json",
                },
                "marketViewed": False,
                "operational": False,
                "status": status,
            }
        )

    output_rows.sort(key=lambda row: (not row["top67DistributionCohort"], -row["maddenOvr"], row["playerId"]))
    top67_values = [float(row["candidateValue"]) for row in output_rows if row["top67DistributionCohort"]]
    deltas = [abs(float(row["candidateDeltaFromPrior"])) for row in output_rows]
    status_counts = Counter(row["status"] for row in output_rows)
    summary = {
        "playerCount": len(output_rows),
        "top67Count": len(top67_values),
        "experiencedTop67Count": len(experienced_top67),
        "statusCounts": dict(sorted(status_counts.items())),
        "top67CandidateMean": round_value(mean(top67_values)),
        "top67CandidateMinimum": min(top67_values),
        "top67CandidateMaximum": max(top67_values),
        "maximumAbsoluteCandidateMove": max(deltas) if deltas else 0.0,
        "medianAbsoluteCandidateMove": round_value(median(deltas)) if deltas else 0.0,
        "allWithinScale": all(scale_min <= float(row["candidateValue"]) <= scale_max for row in output_rows),
        "allWithinMoveCap": all(value <= maximum_move + 1e-9 for value in deltas),
    }
    document = {
        "schemaVersion": "walters-qb-performance-stage3c-candidates-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 3,
        "substage": "3C",
        "status": "NON_OPERATIONAL_SHADOW_CANDIDATES",
        "asOf": contract["chronology"]["candidateAsOf"],
        "forSeason": int(contract["chronology"]["candidateForSeason"]),
        "model": relative(MODEL_PATH),
        "identityCrosswalk": relative(IDENTITY_CROSSWALK_PATH),
        "calibration": calibration,
        "summary": summary,
        "productionAuthority": False,
        "grahamWritesAllowed": False,
        "uncertaintyOverlayRetirementAllowed": False,
        "marketViewed": False,
        "players": output_rows,
    }
    document["contentSha256Canonical"] = canonical_sha(document)
    return document, summary


def protected_hashes() -> dict[str, str | None]:
    output: dict[str, str | None] = {}
    for path in (POWER_LEDGER_PATH, PERSONNEL_CONTEXT_PATH, MATCHUP_CONTEXT_PATH, ACTIVE_WEEK_PATH):
        output[relative(path)] = sha256_file(path) if path.exists() else None
    return output


def build_acceptance_checks(
    contract: dict[str, Any],
    final: dict[str, Any],
    candidate_summary: dict[str, Any],
    protected_unchanged: bool,
) -> list[dict[str, Any]]:
    acceptance = contract["acceptance"]
    metrics = final["holdoutMetrics"]
    family = final["familyWeights"]
    checks = [
        {
            "id": "QBP3C-HOLDOUT-SAMPLE",
            "actual": metrics["sampleCount"],
            "expectedMinimum": acceptance["minimumHoldoutSamples"],
            "pass": metrics["sampleCount"] >= int(acceptance["minimumHoldoutSamples"]),
        },
        {
            "id": "QBP3C-RMSE-LEAGUE-NONINFERIOR",
            "actual": metrics["rmseToLeagueMeanRatio"],
            "expectedMaximum": acceptance["maximumRmseToLeagueMeanRatio"],
            "pass": metrics["rmseToLeagueMeanRatio"] <= float(acceptance["maximumRmseToLeagueMeanRatio"]),
        },
        {
            "id": "QBP3C-MAE-LEAGUE-NONINFERIOR",
            "actual": metrics["maeToLeagueMeanRatio"],
            "expectedMaximum": acceptance["maximumMaeToLeagueMeanRatio"],
            "pass": metrics["maeToLeagueMeanRatio"] <= float(acceptance["maximumMaeToLeagueMeanRatio"]),
        },
        {
            "id": "QBP3C-RMSE-RECENT-EPA-NONINFERIOR",
            "actual": metrics["rmseToRecentAdjustedEpaRatio"],
            "expectedMaximum": acceptance["maximumRmseToRecentAdjustedEpaRatio"],
            "pass": metrics["rmseToRecentAdjustedEpaRatio"] <= float(acceptance["maximumRmseToRecentAdjustedEpaRatio"]),
        },
        {
            "id": "QBP3C-PEARSON",
            "actual": metrics["pearson"],
            "expectedMinimum": acceptance["minimumPearsonCorrelation"],
            "pass": metrics["pearson"] >= float(acceptance["minimumPearsonCorrelation"]),
        },
        {
            "id": "QBP3C-SPEARMAN",
            "actual": metrics["spearman"],
            "expectedMinimum": acceptance["minimumSpearmanCorrelation"],
            "pass": metrics["spearman"] >= float(acceptance["minimumSpearmanCorrelation"]),
        },
        {
            "id": "QBP3C-QUINTILE-SEPARATION",
            "actual": metrics["topMinusBottomQuintileTargetGap"],
            "expectedMinimum": acceptance["minimumTopMinusBottomQuintileTargetGap"],
            "pass": metrics["topMinusBottomQuintileTargetGap"] >= float(acceptance["minimumTopMinusBottomQuintileTargetGap"]),
        },
        {
            "id": "QBP3C-DIRECTIONAL-ACCURACY",
            "actual": metrics["directionalAccuracy"],
            "expectedMinimum": acceptance["minimumDirectionalAccuracy"],
            "pass": metrics["directionalAccuracy"] >= float(acceptance["minimumDirectionalAccuracy"]),
        },
        {
            "id": "QBP3C-ACTIVE-FAMILIES",
            "actual": family["activeFamilyCount"],
            "expectedMinimum": acceptance["minimumActiveFeatureFamilies"],
            "pass": family["activeFamilyCount"] >= int(acceptance["minimumActiveFeatureFamilies"]),
        },
        {
            "id": "QBP3C-FAMILY-CONCENTRATION",
            "actual": family["maximumSingleFamilyShare"],
            "expectedMaximum": acceptance["maximumSingleFeatureFamilyWeightShare"],
            "pass": family["maximumSingleFamilyShare"] <= float(acceptance["maximumSingleFeatureFamilyWeightShare"]),
        },
        {
            "id": "QBP3C-EXPERIENCED-TOP67",
            "actual": candidate_summary["experiencedTop67Count"],
            "expectedMinimum": acceptance["minimumExperiencedTop67ForCalibration"],
            "pass": candidate_summary["experiencedTop67Count"] >= int(acceptance["minimumExperiencedTop67ForCalibration"]),
        },
        {
            "id": "QBP3C-CANDIDATE-MEAN",
            "actual": candidate_summary["top67CandidateMean"],
            "expectedRange": acceptance["candidateMeanRangeTop67"],
            "pass": float(acceptance["candidateMeanRangeTop67"][0]) <= candidate_summary["top67CandidateMean"] <= float(acceptance["candidateMeanRangeTop67"][1]),
        },
        {
            "id": "QBP3C-CANDIDATE-BOUNDS",
            "actual": candidate_summary["allWithinScale"],
            "expected": True,
            "pass": bool(candidate_summary["allWithinScale"]),
        },
        {
            "id": "QBP3C-CANDIDATE-MOVE-CAP",
            "actual": candidate_summary["maximumAbsoluteCandidateMove"],
            "expectedMaximum": contract["candidateCalibration"]["maximumAbsoluteMoveFromStage2Prior"],
            "pass": bool(candidate_summary["allWithinMoveCap"]),
        },
        {
            "id": "QBP3C-DETERMINISM",
            "actual": final["deterministic"],
            "expected": True,
            "pass": bool(final["deterministic"]),
        },
        {
            "id": "QBP3C-FEATURE-SIGNS",
            "actual": min(final["model"]["weights"]),
            "expectedMinimum": 0.0,
            "pass": min(final["model"]["weights"]) >= -1e-12,
        },
        {
            "id": "QBP3C-PROTECTED-ARTIFACTS",
            "actual": protected_unchanged,
            "expected": True,
            "pass": protected_unchanged,
        },
        {
            "id": "QBP3C-MARKET-ISOLATION",
            "actual": False,
            "expected": False,
            "pass": True,
        },
    ]
    return checks


def validate_dependencies(contract: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    for path in (
        STAGE3A_CONTRACT_PATH,
        STAGE3B_CONTRACT_PATH,
        STAGE3_CURRENT_PATH,
        STAGE3B_AUDIT_PATH,
        SOURCE_MANIFEST_PATH,
        IDENTITY_CROSSWALK_PATH,
        WEEKLY_PATH,
        SEASONAL_PATH,
    ):
        if not path.exists():
            raise RuntimeError(f"Missing Stage 3C dependency: {relative(path)}")
    current = read_json(STAGE3_CURRENT_PATH)
    stage3b_audit = read_json(STAGE3B_AUDIT_PATH)
    source_manifest = read_json(SOURCE_MANIFEST_PATH)
    crosswalk = read_json(IDENTITY_CROSSWALK_PATH)
    if current.get("status") != "STAGE3B_CAPTURED_IDENTITY_AUDITED_NON_OPERATIONAL":
        raise RuntimeError(f"Stage 3C requires a fresh Stage 3B handoff, received {current.get('status')}")
    if stage3b_audit.get("status") != "PASS":
        raise RuntimeError("Stage 3B audit is not PASS")
    if stage3b_audit.get("productionAuthority") is not False or stage3b_audit.get("marketViewed") is not False:
        raise RuntimeError("Stage 3B authority or market isolation boundary is invalid")
    if sha256_file(WEEKLY_PATH) != stage3b_audit["weeklyNormalized"]["sha256"]:
        raise RuntimeError("Stage 3B weekly evidence SHA-256 mismatch")
    if sha256_file(SEASONAL_PATH) != stage3b_audit["seasonalNormalized"]["sha256"]:
        raise RuntimeError("Stage 3B seasonal evidence SHA-256 mismatch")
    if source_manifest.get("status") != "SOURCE_ASSETS_HASH_LOCKED":
        raise RuntimeError("Stage 3B source manifest is not hash locked")
    if crosswalk.get("status") != "PASS" or crosswalk.get("blockedIdentityCount") != 0:
        raise RuntimeError("Stage 3B identity crosswalk is not clean")
    if contract.get("status") != "MODEL_SPECIFICATION_LOCKED_NON_OPERATIONAL":
        raise RuntimeError("Stage 3C model contract is not locked")
    if contract.get("operational") is not False or contract.get("productionAuthority") is not False:
        raise RuntimeError("Stage 3C contract must remain non-operational")
    return stage3b_audit, source_manifest, crosswalk


def run_self_test() -> None:
    assert abs(nfl_passer_rating(20, 30, 250, 2, 1) - 100.69444444444444) < 1e-9
    assert shrink_metric(10.0, 100.0, 5.0, 100.0) == 7.5
    sample_x = [[-1.0, 0.0], [0.0, 1.0], [1.0, 2.0], [2.0, 3.0]]
    sample_y = [-1.0, 0.5, 1.5, 3.0]
    model = fit_nonnegative_ridge(sample_x, sample_y, 0.1, 500, 1e-12)
    repeated = fit_nonnegative_ridge(sample_x, sample_y, 0.1, 500, 1e-12)
    assert canonical_sha(model) == canonical_sha(repeated)
    assert all(weight >= 0 for weight in model["weights"])
    assert percentile_against([1.0, 2.0, 3.0], 2.0) == 0.5
    assert interpolate_sorted([6.0, 7.0, 9.5], 0.5) == 7.0
    low = shrink_metric(10.0, 50.0, 5.0, 250.0)
    high = shrink_metric(10.0, 500.0, 5.0, 250.0)
    assert abs(high - 5.0) > abs(low - 5.0)
    print("WALTERS QB STAGE 3C SELF-TEST: PASS")


def main() -> int:
    parser = argparse.ArgumentParser(description="Estimate and validate the governed Walters QB Stage 3C shadow model.")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        run_self_test()
        return 0

    contract = read_json(CONTRACT_PATH)
    stage3b_audit, source_manifest, crosswalk = validate_dependencies(contract)
    protected_before = protected_hashes()

    rows, weekly_headers = read_weekly_rows()
    assign_opponent_adjusted_targets(rows, contract)
    grouped = group_rows_by_player(rows)
    selected, tuning_results = tune_configuration(rows, grouped, contract)
    final = final_fit_and_holdout(rows, grouped, contract, selected)
    candidates, candidate_summary = build_candidates(
        grouped,
        contract,
        final,
        crosswalk,
        selected["configuration"],
    )

    protected_after = protected_hashes()
    protected_unchanged = protected_before == protected_after
    checks = build_acceptance_checks(contract, final, candidate_summary, protected_unchanged)
    audit_pass = all(bool(check["pass"]) for check in checks)
    state = contract["acceptance"]["passState"] if audit_pass else contract["acceptance"]["failState"]
    next_substage = (
        contract["acceptance"]["nextSubstageOnPass"] if audit_pass else "STAGE3C_REMEDIATION_REQUIRED"
    )

    model_document = {
        "schemaVersion": "walters-qb-performance-stage3c-model-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 3,
        "substage": "3C",
        "status": "HOLDOUT_VALIDATED_NON_OPERATIONAL" if audit_pass else "HOLDOUT_REJECTED_FAIL_CLOSED",
        "generatedFromSourceCapturedAt": source_manifest["capturedAt"],
        "contract": relative(CONTRACT_PATH),
        "stage3BAudit": relative(STAGE3B_AUDIT_PATH),
        "weeklyEvidence": {
            "path": relative(WEEKLY_PATH),
            "sha256": sha256_file(WEEKLY_PATH),
            "rowCount": len(rows),
            "fieldCount": len(weekly_headers),
        },
        "selectedConfiguration": selected["configuration"],
        "selectionTuningSeason": int(contract["chronology"]["tuningSeason"]),
        "configurationCountEvaluated": len(tuning_results),
        "selectedTuningMetrics": selected["tuningMetrics"],
        "finalFitSeasons": contract["chronology"]["finalFitSeasons"],
        "holdoutSeason": contract["chronology"]["untouchedHoldoutSeason"],
        "fitSampleCount": len(final["fitSamples"]),
        "holdoutSampleCount": len(final["holdoutSamples"]),
        "featureNames": FEATURE_NAMES,
        "metricCenters": {key: round_value(value, 12) for key, value in final["centers"].items()},
        "featureScaler": {
            "means": [round_value(value, 12) for value in final["scaler"]["means"]],
            "scales": [round_value(value, 12) for value in final["scaler"]["scales"]],
        },
        "intercept": round_value(final["model"]["intercept"], 12),
        "weights": {
            name: round_value(value, 12) for name, value in zip(FEATURE_NAMES, final["model"]["weights"])
        },
        "familyWeights": final["familyWeights"],
        "solver": {
            "family": contract["model"]["solver"],
            "iterations": final["model"]["iterations"],
            "converged": final["model"]["converged"],
            "deterministicRefit": final["deterministic"],
        },
        "holdoutMetrics": final["holdoutMetrics"],
        "topTuningConfigurations": [
            {
                "rank": index + 1,
                "configuration": result["configuration"],
                "fitSampleCount": result["fitSampleCount"],
                "tuningSampleCount": result["tuningSampleCount"],
                "tuningMetrics": result["tuningMetrics"],
                "familyWeights": result["familyWeights"],
                "tuningEligible": result["tuningEligible"],
            }
            for index, result in enumerate(tuning_results[:10])
        ],
        "candidateCalibration": contract["candidateCalibration"],
        "productionAuthority": False,
        "grahamWritesAllowed": False,
        "marketViewed": False,
    }
    model_document["contentSha256Canonical"] = canonical_sha(model_document)
    write_json(MODEL_PATH, model_document)

    candidates["modelContentSha256Canonical"] = model_document["contentSha256Canonical"]
    candidates["holdoutAccepted"] = audit_pass
    candidates["contentSha256Canonical"] = canonical_sha({key: value for key, value in candidates.items() if key != "contentSha256Canonical"})
    write_json(CANDIDATE_PATH, candidates)

    holdout_audit = {
        "schemaVersion": "walters-qb-performance-stage3c-holdout-audit-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 3,
        "substage": "3C",
        "status": "PASS" if audit_pass else "FAIL_CLOSED_REVIEW_REQUIRED",
        "generatedFromSourceCapturedAt": source_manifest["capturedAt"],
        "contract": relative(CONTRACT_PATH),
        "model": relative(MODEL_PATH),
        "candidates": relative(CANDIDATE_PATH),
        "chronology": contract["chronology"],
        "selectedConfiguration": selected["configuration"],
        "holdoutMetrics": final["holdoutMetrics"],
        "familyWeights": final["familyWeights"],
        "candidateSummary": candidate_summary,
        "checks": checks,
        "protectedArtifactSha256Before": protected_before,
        "protectedArtifactSha256After": protected_after,
        "protectedArtifactsUnchanged": protected_unchanged,
        "weightsEstimated": True,
        "candidateQbValuesCreated": True,
        "candidateValuesOperational": False,
        "grahamFairNumbersChanged": False,
        "embeddedQbBaselinesChanged": False,
        "uncertaintyOverlaysRetired": False,
        "productionAuthority": False,
        "marketViewed": False,
        "nextSubstage": next_substage,
    }
    holdout_audit["contentSha256Canonical"] = canonical_sha(holdout_audit)
    write_json(AUDIT_PATH, holdout_audit)

    current = {
        "schemaVersion": "walters-qb-performance-stage3-current-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 3,
        "substage": "3C",
        "status": state,
        "generatedFromSourceCapturedAt": source_manifest["capturedAt"],
        "operational": False,
        "productionAuthority": False,
        "marketViewed": False,
        "priorAuthority": "EA_MADDEN27_DISTRIBUTION_CALIBRATED_PRIOR_ONLY",
        "weightsStatus": "ESTIMATED_FROZEN_STAGE3C_SHADOW" if audit_pass else "ESTIMATED_REJECTED_FAIL_CLOSED",
        "dataCaptureStatus": "PASS_HASH_LOCKED",
        "identityAuditStatus": "PASS",
        "seasonalCrosscheckStatus": "PASS",
        "holdoutValidationStatus": "PASS" if audit_pass else "FAIL_CLOSED",
        "candidateOutputStatus": "CREATED_NON_OPERATIONAL",
        "grahamWritesAllowed": False,
        "uncertaintyOverlayRetirementAllowed": False,
        "activeContract": relative(STAGE3A_CONTRACT_PATH),
        "activeStage3BContract": relative(STAGE3B_CONTRACT_PATH),
        "activeStage3CContract": relative(CONTRACT_PATH),
        "sourceManifest": relative(SOURCE_MANIFEST_PATH),
        "identityCrosswalk": relative(IDENTITY_CROSSWALK_PATH),
        "model": relative(MODEL_PATH),
        "holdoutAudit": relative(AUDIT_PATH),
        "holdoutAuditSha256": sha256_file(AUDIT_PATH),
        "candidates": relative(CANDIDATE_PATH),
        "candidatesSha256": sha256_file(CANDIDATE_PATH),
        "nextSubstage": next_substage,
    }
    write_json(STAGE3_CURRENT_PATH, current)

    print(json.dumps({
        "status": holdout_audit["status"],
        "selectedConfiguration": selected["configuration"],
        "tuningConfigurations": len(tuning_results),
        "fitSamples": len(final["fitSamples"]),
        "holdoutSamples": len(final["holdoutSamples"]),
        "holdoutMetrics": final["holdoutMetrics"],
        "activeFeatureFamilies": final["familyWeights"]["activeFamiliesAtOnePercent"],
        "candidateSummary": candidate_summary,
        "failedChecks": [check["id"] for check in checks if not check["pass"]],
        "productionAuthority": False,
        "marketViewed": False,
        "nextSubstage": next_substage,
    }, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({
            "status": "STAGE3C_BUILD_ERROR",
            "error": f"{type(error).__name__}: {error}",
            "productionAuthority": False,
            "marketViewed": False,
        }, indent=2))
        raise

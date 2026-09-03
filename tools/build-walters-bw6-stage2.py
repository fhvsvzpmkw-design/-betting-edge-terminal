#!/usr/bin/env python3
"""Build the market-isolated BW6.2 point-weight calibration and model lock.

This stage never reads 2025 score fields. It selects the probability estimator
inside the preregistered development window and writes the frozen distribution
that the separate BW6.3 process must use for holdout evaluation.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "data/walters/nfl/key-numbers/bw6-stage1-contract-v1.json"
CATEGORIES: tuple[int | str, ...] = (*range(1, 19), "OTHER")
EPSILON = 1e-12


def fail(message: str) -> None:
    raise RuntimeError(f"WALTERS BW6 STAGE 2 BUILD FAILED // {message}")


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def round_value(value: float, digits: int = 9) -> float:
    return round(float(value), digits)


def category_key(category: int | str) -> str:
    return str(category)


def solve_linear(matrix: list[list[float]], vector: list[float]) -> list[float]:
    """Deterministic Gauss-Jordan solve for the small ridge system."""
    size = len(vector)
    augmented = [list(map(float, matrix[row])) + [float(vector[row])] for row in range(size)]
    for column in range(size):
        pivot = max(range(column, size), key=lambda row: abs(augmented[row][column]))
        if abs(augmented[pivot][column]) < 1e-12:
            continue
        if pivot != column:
            augmented[column], augmented[pivot] = augmented[pivot], augmented[column]
        divisor = augmented[column][column]
        for item in range(column, size + 1):
            augmented[column][item] /= divisor
        for row in range(size):
            if row == column:
                continue
            factor = augmented[row][column]
            if abs(factor) < 1e-15:
                continue
            for item in range(column, size + 1):
                augmented[row][item] -= factor * augmented[column][item]
    return [
        augmented[index][size] if abs(augmented[index][index]) > 1e-10 else 0.0
        for index in range(size)
    ]


def fit_team_ratings(
    games: list[dict[str, Any]],
    teams: list[str],
    ridge_penalty: float,
    domestic_hfa: float,
    neutral_hfa: float,
) -> dict[str, float]:
    index = {team: position for position, team in enumerate(teams)}
    size = len(teams)
    matrix = [[0.0] * size for _ in range(size)]
    vector = [0.0] * size
    for game in games:
        home = game["homeTeam"]
        away = game["awayTeam"]
        if home not in index or away not in index:
            continue
        location_value = neutral_hfa if game["neutralSite"] else domestic_hfa
        target = game["homeScore"] - game["awayScore"] - location_value
        home_index = index[home]
        away_index = index[away]
        matrix[home_index][home_index] += 1.0
        matrix[away_index][away_index] += 1.0
        matrix[home_index][away_index] -= 1.0
        matrix[away_index][home_index] -= 1.0
        vector[home_index] += target
        vector[away_index] -= target
    for position in range(size):
        matrix[position][position] += ridge_penalty
    estimates = solve_linear(matrix, vector)
    center = sum(estimates) / len(estimates) if estimates else 0.0
    return {team: estimates[index[team]] - center for team in teams}


def make_label_weights(favorite_side: str, home_margin: int) -> dict[str, float]:
    if favorite_side == "HOME":
        favorite_margin = home_margin
        category: int | str = favorite_margin if 1 <= favorite_margin <= 18 else "OTHER"
        return {category_key(category): 1.0}
    if favorite_side == "AWAY":
        favorite_margin = -home_margin
        category = favorite_margin if 1 <= favorite_margin <= 18 else "OTHER"
        return {category_key(category): 1.0}
    if favorite_side == "SPLIT":
        absolute_margin = abs(home_margin)
        if 1 <= absolute_margin <= 18:
            return {category_key(absolute_margin): 0.5, "OTHER": 0.5}
        return {"OTHER": 1.0}
    fail(f"unknown favorite side {favorite_side}")


def canonical_team(team: str, aliases: dict[str, str]) -> str:
    normalized = (team or "").strip()
    return aliases.get(normalized, normalized)


def load_development_games(contract: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    historical = contract["historicalDataContract"]
    snapshot = historical["sourceSnapshot"]
    source_path = ROOT / snapshot["path"]
    if not source_path.exists():
        fail(f"missing source snapshot {snapshot['path']}")
    source_hash = sha256_file(source_path)
    if source_hash != snapshot["sha256"]:
        fail("FAIL_CLOSED_BW6_SOURCE_HASH_MISMATCH")

    aliases = historical["teamIdentityAliases"]
    development_seasons = {int(season) for season in historical["developmentWindow"]["seasons"]}
    context_seasons = {int(season) for season in historical["contextOnlySeasons"]}
    allowed_score_seasons = development_seasons | context_seasons
    forbidden_seasons = {int(season) for season in historical["excludedOutcomeSeasons"]}
    holdout_seasons = {int(season) for season in historical["holdoutWindow"]["seasons"]}
    if allowed_score_seasons & (forbidden_seasons | holdout_seasons):
        fail("FAIL_CLOSED_BW6_HOLDOUT_PEEK")

    games: list[dict[str, Any]] = []
    skipped = defaultdict(int)
    encountered_rows = 0
    with source_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != historical["fieldWhitelist"]:
            fail("FAIL_CLOSED_BW6_SOURCE_FIELD_VIOLATION")
        for forbidden in historical["forbiddenFields"]:
            if forbidden in (reader.fieldnames or []):
                fail("FAIL_CLOSED_BW6_MARKET_CONTAMINATION")
        for raw in reader:
            encountered_rows += 1
            season = int(raw["season"])
            game_type = raw["game_type"]
            # This branch occurs before either score field is accessed. In particular,
            # the Stage 2 process cannot inspect the 2025 holdout outcomes.
            if season not in allowed_score_seasons or game_type != historical["gameType"]:
                skipped[f"{season}_{game_type}"] += 1
                continue
            if raw["home_score"] == "" or raw["away_score"] == "":
                skipped["missing_final_score"] += 1
                continue
            home = canonical_team(raw["home_team"], aliases)
            away = canonical_team(raw["away_team"], aliases)
            if not home or not away or home == away:
                skipped["unresolved_team_identity"] += 1
                continue
            games.append(
                {
                    "gameId": raw["game_id"],
                    "season": season,
                    "week": int(raw["week"]),
                    "gameday": raw["gameday"],
                    "homeTeam": home,
                    "awayTeam": away,
                    "homeScore": int(float(raw["home_score"])),
                    "awayScore": int(float(raw["away_score"])),
                    "neutralSite": raw["location"].strip().lower() != "home",
                }
            )

    if encountered_rows != int(snapshot["dataRows"]):
        fail("source row count changed")
    games.sort(key=lambda game: (game["season"], game["week"], game["gameday"], game["gameId"]))
    expected = int(historical["developmentWindow"]["expectedCompletedGames"])
    development_count = sum(game["season"] in development_seasons for game in games)
    if development_count != expected:
        fail(f"expected {expected} development games, found {development_count}")
    return games, {
        "path": snapshot["path"],
        "sha256": source_hash,
        "encounteredRows": encountered_rows,
        "developmentGames": development_count,
        "contextGames": sum(game["season"] in context_seasons for game in games),
        "holdoutScoreFieldsRead": False,
        "marketFieldsPresent": False,
        "skippedRowsByReason": dict(sorted(skipped.items())),
    }


def build_oriented_observations(
    games: list[dict[str, Any]], contract: dict[str, Any]
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    development = set(contract["historicalDataContract"]["developmentWindow"]["seasons"])
    context = set(contract["historicalDataContract"]["contextOnlySeasons"])
    orientation = contract["pregameFavoriteOrientation"]
    teams = sorted({game["homeTeam"] for game in games} | {game["awayTeam"] for game in games})
    if len(teams) != 32:
        fail(f"expected 32 canonical teams, found {len(teams)}: {teams}")

    games_by_season: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for game in games:
        games_by_season[game["season"]].append(game)

    eligible_outcome_seasons = sorted(development | context)
    observations: list[dict[str, Any]] = []
    audit_by_season: dict[str, Any] = {}
    for season in sorted(development):
        season_games = games_by_season[season]
        season_counts = defaultdict(int)
        season_prior = [candidate for candidate in eligible_outcome_seasons if candidate < season]
        season_prior = season_prior[-int(orientation["lookbackEligibleSeasons"]) :]
        completed_current: list[dict[str, Any]] = []
        for week in sorted({game["week"] for game in season_games}):
            week_games = [game for game in season_games if game["week"] == week]
            training_games = [
                game
                for prior_season in season_prior
                for game in games_by_season[prior_season]
            ] + list(completed_current)
            if not training_games:
                fail(f"no chronological rating history for {season} week {week}")
            ratings = fit_team_ratings(
                training_games,
                teams,
                float(orientation["ridgePenalty"]),
                float(orientation["domesticHomeAdvantagePoints"]),
                float(orientation["neutralHomeAdvantagePoints"]),
            )
            for game in week_games:
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
                    season_counts["homeFavorite"] += 1
                elif predicted_home_margin < -EPSILON:
                    favorite_side = "AWAY"
                    favorite_team = game["awayTeam"]
                    season_counts["awayFavorite"] += 1
                else:
                    favorite_side = "SPLIT"
                    favorite_team = None
                    season_counts["splitOrientation"] += 1
                home_margin = game["homeScore"] - game["awayScore"]
                label_weights = make_label_weights(favorite_side, home_margin)
                if label_weights.get("OTHER", 0.0) < 1.0:
                    season_counts["favoriteWinByOneThroughEighteenWeight"] += 1
                observations.append(
                    {
                        "gameId": game["gameId"],
                        "season": season,
                        "week": week,
                        "favoriteSide": favorite_side,
                        "favoriteTeam": favorite_team,
                        "predictedHomeMargin": predicted_home_margin,
                        "labelWeights": label_weights,
                    }
                )
            completed_current.extend(week_games)
        audit_by_season[str(season)] = {
            "games": len(season_games),
            "homeFavorite": season_counts["homeFavorite"],
            "awayFavorite": season_counts["awayFavorite"],
            "splitOrientation": season_counts["splitOrientation"],
        }

    if len(observations) != int(
        contract["historicalDataContract"]["developmentWindow"]["expectedCompletedGames"]
    ):
        fail("development observations are incomplete")
    return observations, {
        "canonicalTeams": teams,
        "developmentObservations": len(observations),
        "bySeason": audit_by_season,
        "targetGameScoresUsedForOrientation": False,
        "futureGamesUsedForOrientation": False,
        "marketInputsUsed": False,
    }


def candidate_season_weights(
    model_id: str, eligible_training_seasons: Iterable[int]
) -> dict[int, float]:
    seasons = sorted({int(season) for season in eligible_training_seasons})
    if not seasons:
        fail(f"no training seasons for {model_id}")
    if model_id == "BW6_FULL_DEVELOPMENT_POOL":
        return {season: 1.0 for season in seasons}
    if model_id == "BW6_ROLLING_FOUR_ELIGIBLE_SEASONS":
        return {season: 1.0 for season in seasons[-4:]}
    if model_id == "BW6_EXPONENTIAL_SEASON_DECAY_HL4":
        most_recent = max(seasons)
        return {season: 0.5 ** ((most_recent - season) / 4.0) for season in seasons}
    fail(f"unknown estimator candidate {model_id}")


def fit_distribution(
    observations: list[dict[str, Any]],
    model_id: str,
    eligible_training_seasons: Iterable[int],
    alpha: float,
) -> dict[str, Any]:
    season_weights = candidate_season_weights(model_id, eligible_training_seasons)
    weighted_counts = {category_key(category): 0.0 for category in CATEGORIES}
    raw_counts = {category_key(category): 0.0 for category in CATEGORIES}
    weighted_games = 0.0
    sum_weight_squared = 0.0
    raw_games = 0
    for observation in observations:
        season = int(observation["season"])
        if season not in season_weights:
            continue
        weight = float(season_weights[season])
        weighted_games += weight
        sum_weight_squared += weight * weight
        raw_games += 1
        for category, label_weight in observation["labelWeights"].items():
            weighted_counts[category] += weight * float(label_weight)
            raw_counts[category] += float(label_weight)
    if raw_games == 0 or weighted_games <= 0:
        fail(f"empty fit for {model_id}")
    denominator = weighted_games + alpha * len(CATEGORIES)
    probabilities = {
        category_key(category): (weighted_counts[category_key(category)] + alpha) / denominator
        for category in CATEGORIES
    }
    probability_sum = sum(probabilities.values())
    if abs(probability_sum - 1.0) > 1e-9:
        fail(f"distribution does not sum to one: {probability_sum}")
    effective_games = weighted_games * weighted_games / sum_weight_squared
    return {
        "modelId": model_id,
        "eligibleSeasons": sorted(season_weights),
        "seasonWeights": {str(season): round_value(weight) for season, weight in season_weights.items()},
        "rawGames": raw_games,
        "weightedGames": weighted_games,
        "effectiveGames": effective_games,
        "rawCategoryCounts": raw_counts,
        "weightedCategoryCounts": weighted_counts,
        "probabilities": probabilities,
        "alphaPerCategory": alpha,
    }


def evaluate_distribution(
    distribution: dict[str, Any], observations: list[dict[str, Any]], validation_season: int
) -> dict[str, Any]:
    validation = [item for item in observations if int(item["season"]) == validation_season]
    if not validation:
        fail(f"no validation observations for {validation_season}")
    probabilities = distribution["probabilities"]
    log_loss = 0.0
    brier = 0.0
    for observation in validation:
        labels = observation["labelWeights"]
        for category in map(category_key, CATEGORIES):
            target = float(labels.get(category, 0.0))
            probability = float(probabilities[category])
            if target:
                log_loss -= target * math.log(probability)
            brier += (probability - target) ** 2
    count = len(validation)
    return {
        "validationSeason": validation_season,
        "games": count,
        "multiclassLogLoss": log_loss / count,
        "multiclassBrierScore": brier / count,
    }


def aggregate_fold_metrics(folds: list[dict[str, Any]]) -> dict[str, Any]:
    total_games = sum(int(fold["games"]) for fold in folds)
    return {
        "games": total_games,
        "gameWeightedMeanLogLoss": sum(
            float(fold["multiclassLogLoss"]) * int(fold["games"]) for fold in folds
        )
        / total_games,
        "gameWeightedMeanBrierScore": sum(
            float(fold["multiclassBrierScore"]) * int(fold["games"]) for fold in folds
        )
        / total_games,
    }


def select_model(candidate_results: list[dict[str, Any]]) -> tuple[str, dict[str, Any]]:
    minimum_brier = min(
        item["aggregate"]["gameWeightedMeanBrierScore"] for item in candidate_results
    )
    brier_eligible = [
        item
        for item in candidate_results
        if item["aggregate"]["gameWeightedMeanBrierScore"] <= minimum_brier + 0.001 + EPSILON
    ]
    minimum_log_loss = min(
        item["aggregate"]["gameWeightedMeanLogLoss"] for item in brier_eligible
    )
    tied = {
        item["modelId"]
        for item in brier_eligible
        if item["aggregate"]["gameWeightedMeanLogLoss"]
        <= minimum_log_loss + 0.002 + EPSILON
    }
    priority = [
        "BW6_FULL_DEVELOPMENT_POOL",
        "BW6_ROLLING_FOUR_ELIGIBLE_SEASONS",
        "BW6_EXPONENTIAL_SEASON_DECAY_HL4",
    ]
    selected = next((model_id for model_id in priority if model_id in tied), None)
    if selected is None:
        fail("no candidate survived the preregistered selection rule")
    return selected, {
        "minimumCandidateBrierScore": minimum_brier,
        "brierEligibilityTolerance": 0.001,
        "minimumEligibleLogLoss": minimum_log_loss,
        "logLossTieTolerance": 0.002,
        "brierEligibleModelIds": [item["modelId"] for item in brier_eligible],
        "logLossTieModelIds": sorted(tied),
        "priorityOrder": priority,
        "selectedModelId": selected,
    }


def wilson_interval(event_count: float, effective_games: float, z: float = 1.95996398454) -> tuple[float, float]:
    if effective_games <= 0:
        return 0.0, 1.0
    proportion = min(1.0, max(0.0, event_count / effective_games))
    denominator = 1.0 + z * z / effective_games
    center = (proportion + z * z / (2.0 * effective_games)) / denominator
    margin = (
        z
        * math.sqrt(
            proportion * (1.0 - proportion) / effective_games
            + z * z / (4.0 * effective_games * effective_games)
        )
        / denominator
    )
    return max(0.0, center - margin), min(1.0, center + margin)


def fair_half_point_costs(point_probability: float) -> dict[str, Any]:
    p = float(point_probability)
    q = 110 / 210
    if not 0 <= p < 1 - q:
        fail(f"invalid exact-margin probability for half-point cost: {p}")
    buy_onto = (100 * q) / (1 - q - p) - 110
    buy_off = (100 * (q * (1 - p) + p)) / ((1 - q) * (1 - p)) - 110
    return {
        "buyOntoLossToPushExactUsdPer100": round_value(buy_onto, 6),
        "buyOntoLossToPushDisplayUsdPer100": int(math.floor(buy_onto + 0.5)),
        "buyOffPushToWinExactUsdPer100": round_value(buy_off, 6),
        "buyOffPushToWinDisplayUsdPer100": int(math.floor(buy_off + 0.5)),
    }


def fit_equal_window(
    observations: list[dict[str, Any]], seasons: list[int], alpha: float
) -> dict[str, Any]:
    return fit_distribution(observations, "BW6_FULL_DEVELOPMENT_POOL", seasons, alpha)


def build_margin_rows(
    contract: dict[str, Any],
    observations: list[dict[str, Any]],
    selected_fit: dict[str, Any],
    alpha: float,
) -> list[dict[str, Any]]:
    historical = contract["historicalDataContract"]
    uncertainty = contract["uncertaintyAndSupport"]
    early_fit = fit_equal_window(observations, historical["earlyEraWindow"]["seasons"], alpha)
    current_fit = fit_equal_window(observations, historical["currentEraWindow"]["seasons"], alpha)
    rows = []
    effective_games = float(selected_fit["effectiveGames"])
    weighted_games = float(selected_fit["weightedGames"])
    for margin in range(1, 19):
        key = str(margin)
        raw_event_count = float(selected_fit["rawCategoryCounts"][key])
        weighted_event_count = float(selected_fit["weightedCategoryCounts"][key])
        unsmoothed_probability = weighted_event_count / weighted_games
        effective_event_count = unsmoothed_probability * effective_games
        low, high = wilson_interval(effective_event_count, effective_games)
        half_width_pp = (high - low) * 50.0

        early_p = float(early_fit["probabilities"][key])
        current_p = float(current_fit["probabilities"][key])
        early_n = float(early_fit["rawGames"])
        current_n = float(current_fit["rawGames"])
        pooled_standard_error_pp = 100.0 * math.sqrt(
            early_p * (1 - early_p) / early_n + current_p * (1 - current_p) / current_n
        )
        stability_difference_pp = abs(current_p - early_p) * 100.0
        stability_threshold_pp = max(2.0, 2.0 * pooled_standard_error_pp)
        stable = stability_difference_pp <= stability_threshold_pp + EPSILON
        sample_pass = raw_event_count >= float(
            uncertainty["minimumRawDevelopmentEventsPerMargin"]
        )
        interval_pass = half_width_pp <= float(
            uncertainty["maximumWilsonHalfWidthPercentagePoints"]
        )
        if not sample_pass:
            support_status = "SHADOW_ONLY_INSUFFICIENT_SAMPLE"
        elif not stable or not interval_pass:
            support_status = "SHADOW_ONLY_UNSTABLE"
        else:
            support_status = "CURRENT_SUPPORTED"

        calibrated_probability = float(selected_fit["probabilities"][key])
        rows.append(
            {
                "margin": margin,
                "bookExact": {
                    "pointWeightPercentPublishedRounded": contract["bookExactBaseline"][
                        "pointWeightsPercentPublishedRounded"
                    ][key],
                    "buyHalfPointFairCostUsdPer100": contract["bookExactBaseline"][
                        "buyHalfPointFairCostUsdPer100"
                    ][key],
                    "provenance": "WALTERS EXACT",
                },
                "currentCalibration": {
                    "pointWeightProbability": round_value(calibrated_probability),
                    "pointWeightPercent": round_value(calibrated_probability * 100.0, 6),
                    "rawEventCount": round_value(raw_event_count, 3),
                    "weightedEventCount": round_value(weighted_event_count, 6),
                    "effectiveEventCount": round_value(effective_event_count, 6),
                    "rawEligibleGames": int(selected_fit["rawGames"]),
                    "weightedEligibleGames": round_value(weighted_games, 6),
                    "effectiveEligibleGames": round_value(effective_games, 6),
                    "wilson95Percent": {
                        "lowPercent": round_value(low * 100.0, 6),
                        "highPercent": round_value(high * 100.0, 6),
                        "halfWidthPercentagePoints": round_value(half_width_pp, 6),
                    },
                    "stability": {
                        "earlyEraPercent": round_value(early_p * 100.0, 6),
                        "currentEraPercent": round_value(current_p * 100.0, 6),
                        "absoluteDifferencePercentagePoints": round_value(
                            stability_difference_pp, 6
                        ),
                        "maximumAllowedDifferencePercentagePoints": round_value(
                            stability_threshold_pp, 6
                        ),
                        "pass": stable,
                    },
                    "samplePass": sample_pass,
                    "intervalPass": interval_pass,
                    "supportStatus": support_status,
                    "halfPointFairCost": fair_half_point_costs(calibrated_probability),
                    "provenance": "WALTERS CALIBRATED",
                },
            }
        )
    return rows


def protected_hashes(contract: dict[str, Any]) -> dict[str, str]:
    hashes: dict[str, str] = {}
    for relative in contract["protectedArtifacts"]:
        path = ROOT / relative
        if not path.exists():
            fail(f"missing protected artifact {relative}")
        hashes[relative] = sha256_file(path)
    return hashes


def choose_generated_at(output_path: Path, contract_hash: str, source_hash: str) -> str:
    explicit = os.environ.get("BW6_GENERATED_AT")
    if explicit:
        return explicit
    if output_path.exists():
        prior = read_json(output_path)
        if (
            prior.get("stage1ContractSha256") == contract_hash
            and prior.get("sourceSnapshotSha256") == source_hash
            and prior.get("generatedAt")
        ):
            return str(prior["generatedAt"])
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def run_self_test() -> None:
    costs = fair_half_point_costs(0.08)
    if abs(costs["buyOntoLossToPushExactUsdPer100"] - 22.211538) > 1e-6:
        fail("self-test buy-onto math")
    if abs(costs["buyOffPushToWinExactUsdPer100"] - 18.26087) > 1e-6:
        fail("self-test buy-off math")
    labels = make_label_weights("HOME", 3)
    if labels != {"3": 1.0}:
        fail("self-test home favorite category")
    labels = make_label_weights("AWAY", -7)
    if labels != {"7": 1.0}:
        fail("self-test away favorite category")
    labels = make_label_weights("SPLIT", 10)
    if labels != {"10": 0.5, "OTHER": 0.5}:
        fail("self-test split category")
    low, high = wilson_interval(8, 100)
    if not (0 < low < 0.08 < high < 1):
        fail("self-test Wilson interval")
    print("WALTERS BW6 STAGE 2 SELF-TEST: PASS")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        run_self_test()
        return

    contract = read_json(CONTRACT_PATH)
    if (
        contract.get("stage") != "BW6.1"
        or contract.get("status")
        != "CONTRACT_LOCKED_FOR_BW6_2_CALIBRATION_NON_OPERATIONAL"
        or contract.get("marketViewed") is not False
        or contract.get("productionAuthority") is not False
    ):
        fail("Stage 1 contract is not a valid BW6.2 entry authority")

    protected_before = protected_hashes(contract)
    source_before = sha256_file(ROOT / contract["historicalDataContract"]["sourceSnapshot"]["path"])
    games, source_audit = load_development_games(contract)
    observations, orientation_audit = build_oriented_observations(games, contract)

    alpha = float(contract["calibrationLock"]["smoothing"]["alphaPerCategory"])
    candidate_results: list[dict[str, Any]] = []
    for candidate in contract["calibrationLock"]["estimatorCandidates"]:
        model_id = candidate["modelId"]
        fold_results = []
        for fold in contract["calibrationLock"]["internalSelectionFolds"]:
            fitted = fit_distribution(
                observations,
                model_id,
                fold["eligibleTrainingSeasons"],
                alpha,
            )
            metric = evaluate_distribution(fitted, observations, int(fold["validationSeason"]))
            metric["trainingSeasons"] = fitted["eligibleSeasons"]
            metric["trainingGames"] = fitted["rawGames"]
            metric["effectiveTrainingGames"] = round_value(fitted["effectiveGames"], 6)
            fold_results.append(metric)
        candidate_results.append(
            {
                "modelId": model_id,
                "folds": [
                    {
                        **fold,
                        "multiclassLogLoss": round_value(fold["multiclassLogLoss"]),
                        "multiclassBrierScore": round_value(
                            fold["multiclassBrierScore"]
                        ),
                    }
                    for fold in fold_results
                ],
                "aggregate": {
                    key: round_value(value)
                    for key, value in aggregate_fold_metrics(fold_results).items()
                },
            }
        )

    selected_model, selection_audit = select_model(candidate_results)
    final_fit = fit_distribution(
        observations,
        selected_model,
        contract["historicalDataContract"]["developmentWindow"]["seasons"],
        alpha,
    )
    margin_rows = build_margin_rows(contract, observations, final_fit, alpha)

    contract_hash = sha256_file(CONTRACT_PATH)
    builder_hash = sha256_file(Path(__file__))
    output_lock = ROOT / contract["outputs"]["stage2ModelLock"]
    output_calibration = ROOT / contract["outputs"]["stage2Calibration"]
    generated_at = choose_generated_at(output_lock, contract_hash, source_audit["sha256"])
    selected_probabilities = {
        key: round_value(value) for key, value in final_fit["probabilities"].items()
    }
    protected_after = protected_hashes(contract)
    source_after = sha256_file(ROOT / contract["historicalDataContract"]["sourceSnapshot"]["path"])
    if protected_after != protected_before:
        fail("FAIL_CLOSED_BW6_PROTECTED_ARTIFACT_MUTATION")
    if source_after != source_before:
        fail("FAIL_CLOSED_BW6_SOURCE_HASH_MISMATCH")

    lock_payload = {
        "schemaVersion": "walters-bw6-stage2-model-lock-v1",
        "module": contract["module"],
        "stage": "BW6.2",
        "status": "MODEL_SELECTED_AND_LOCKED_HOLDOUT_UNOPENED_NON_OPERATIONAL",
        "generatedAt": generated_at,
        "operational": False,
        "productionAuthority": False,
        "grahamFairMutationAllowed": False,
        "liveBoardMutationAllowed": False,
        "betStatusMutationAllowed": False,
        "stakeMutationAllowed": False,
        "marketViewed": False,
        "holdoutViewed": False,
        "holdoutOutcomeFieldsRead": False,
        "stage1Contract": CONTRACT_PATH.relative_to(ROOT).as_posix(),
        "stage1ContractSha256": contract_hash,
        "sourceSnapshot": source_audit["path"],
        "sourceSnapshotSha256": source_audit["sha256"],
        "builder": Path(__file__).relative_to(ROOT).as_posix(),
        "builderSha256": builder_hash,
        "orientationMethod": contract["pregameFavoriteOrientation"],
        "candidateSelection": {
            "candidates": candidate_results,
            "selectionAudit": {
                key: round_value(value) if isinstance(value, float) else value
                for key, value in selection_audit.items()
            },
        },
        "selectedModel": {
            "modelId": selected_model,
            "eligibleSeasons": final_fit["eligibleSeasons"],
            "seasonWeights": final_fit["seasonWeights"],
            "rawGames": final_fit["rawGames"],
            "weightedGames": round_value(final_fit["weightedGames"], 6),
            "effectiveGames": round_value(final_fit["effectiveGames"], 6),
            "smoothing": contract["calibrationLock"]["smoothing"],
            "frozenCategoryProbabilities": selected_probabilities,
        },
        "sourceAudit": source_audit,
        "orientationAudit": orientation_audit,
        "protectedArtifactSha256Before": protected_before,
        "protectedArtifactSha256After": protected_after,
        "protectedArtifactsUnchanged": True,
        "nextStage": "BW6.3_2025_HOLDOUT_EVALUATION_WITHOUT_RESELECTION",
    }
    write_json(output_lock, lock_payload)
    lock_hash = sha256_file(output_lock)

    calibration_payload = {
        "schemaVersion": "walters-bw6-stage2-calibration-v1",
        "module": contract["module"],
        "stage": "BW6.2",
        "status": "CURRENT_POINT_WEIGHTS_CALIBRATED_HOLDOUT_UNOPENED_NON_OPERATIONAL",
        "generatedAt": generated_at,
        "operational": False,
        "productionAuthority": False,
        "grahamFairMutationAllowed": False,
        "liveBoardMutationAllowed": False,
        "betStatusMutationAllowed": False,
        "stakeMutationAllowed": False,
        "marketViewed": False,
        "holdoutViewed": False,
        "holdoutOutcomeFieldsRead": False,
        "stage1ContractSha256": contract_hash,
        "stage2ModelLock": output_lock.relative_to(ROOT).as_posix(),
        "stage2ModelLockSha256": lock_hash,
        "sourceSnapshotSha256": source_audit["sha256"],
        "selectedModelId": selected_model,
        "selectedCategoryProbabilities": selected_probabilities,
        "pointWeightSumOneThroughEighteenPercent": round_value(
            sum(selected_probabilities[str(margin)] for margin in range(1, 19)) * 100.0,
            6,
        ),
        "otherProbabilityPercent": round_value(selected_probabilities["OTHER"] * 100.0, 6),
        "marginRows": margin_rows,
        "supportSummary": {
            status: sum(
                row["currentCalibration"]["supportStatus"] == status for row in margin_rows
            )
            for status in [
                "CURRENT_SUPPORTED",
                "SHADOW_ONLY_UNSTABLE",
                "SHADOW_ONLY_INSUFFICIENT_SAMPLE",
            ]
        },
        "bookExactBoundary": {
            "publishedWeightSumPercent": contract["bookExactBaseline"][
                "publishedWeightSumPercent"
            ],
            "currentValuesDoNotOverwriteBookExact": True,
            "provenance": "WALTERS CALIBRATED",
        },
        "protectedArtifactSha256Before": protected_before,
        "protectedArtifactSha256After": protected_after,
        "protectedArtifactsUnchanged": True,
        "nextStage": "BW6.3_2025_HOLDOUT_EVALUATION_WITHOUT_RESELECTION",
    }
    write_json(output_calibration, calibration_payload)

    print(
        "WALTERS BW6 STAGE 2 BUILD: PASS // "
        f"SELECTED {selected_model} // {final_fit['rawGames']} TRAINING GAMES // "
        f"{calibration_payload['supportSummary']['CURRENT_SUPPORTED']}/18 CURRENT-SUPPORTED // "
        "2025 HOLDOUT UNOPENED // MARKET ISOLATED // NON-OPERATIONAL"
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # pragma: no cover - command boundary
        print(str(exc), file=sys.stderr)
        raise

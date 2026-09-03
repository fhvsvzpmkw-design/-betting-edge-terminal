#!/usr/bin/env python3
"""Build the development-only BW6.3R2 candidate audit and freeze manifest."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import random
import statistics
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "data/walters/nfl/key-numbers/bw6-stage3r2-contract-v1.json"
STAGE1_PATH = ROOT / "data/walters/nfl/key-numbers/bw6-stage1-contract-v1.json"
STAGE2_CALIBRATION_PATH = ROOT / "data/walters/nfl/key-numbers/bw6-stage2-calibration-v1.json"
STAGE2_BUILDER_PATH = ROOT / "tools/build-walters-bw6-stage2.py"
RELEASE_ARTIFACTS = [
    "tools/build-walters-bw6-stage3r2.py",
    "tools/validate-walters-bw6-stage3r2.mjs",
    "tests/walters-bw6-stage3r2.test.mjs",
    ".github/workflows/walters-bw6-stage3r2.yml",
]
CATEGORIES = tuple(str(value) for value in range(1, 19)) + ("OTHER",)
EXACT_CATEGORIES = CATEGORIES[:-1]
EPSILON = 1e-12


def fail(message: str) -> None:
    raise RuntimeError(f"WALTERS BW6 STAGE 3R2 BUILD FAILED // {message}")


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def canonical_digest(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return sha256_bytes(encoded.encode("utf-8"))


def round_value(value: float, digits: int = 9) -> float:
    return round(float(value), digits)


def load_stage2_module() -> Any:
    spec = importlib.util.spec_from_file_location("walters_bw6_stage2", STAGE2_BUILDER_PATH)
    if spec is None or spec.loader is None:
        fail("cannot load the frozen Stage 2 builder")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def hash_paths(paths: list[str]) -> dict[str, str]:
    output = {}
    for relative in paths:
        path = ROOT / relative
        if not path.exists():
            fail(f"missing governed artifact {relative}")
        output[relative] = sha256_file(path)
    return output


def empty_counts() -> dict[str, float]:
    return {category: 0.0 for category in CATEGORIES}


def build_season_counts(observations: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
    output: dict[int, dict[str, Any]] = {}
    for observation in observations:
        season = int(observation["season"])
        row = output.setdefault(season, {"games": 0, "counts": empty_counts()})
        row["games"] += 1
        for category, weight in observation["labelWeights"].items():
            row["counts"][category] += float(weight)
    return output


def weighted_counts(
    season_counts: dict[int, dict[str, Any]], season_weights: dict[int, float]
) -> dict[str, Any]:
    counts = empty_counts()
    weighted_games = 0.0
    weight_squared_games = 0.0
    raw_games = 0
    for season, weight in season_weights.items():
        row = season_counts.get(int(season))
        if row is None:
            fail(f"missing season counts for {season}")
        games = int(row["games"])
        raw_games += games
        weighted_games += games * float(weight)
        weight_squared_games += games * float(weight) ** 2
        for category in CATEGORIES:
            counts[category] += float(row["counts"][category]) * float(weight)
    if raw_games <= 0 or weighted_games <= 0 or weight_squared_games <= 0:
        fail("empty weighted candidate fit")
    return {
        "counts": counts,
        "rawGames": raw_games,
        "weightedGames": weighted_games,
        "effectiveGames": weighted_games**2 / weight_squared_games,
    }


def smooth_distribution(
    fit_counts: dict[str, Any], smoothing_family: str
) -> dict[str, float]:
    counts = fit_counts["counts"]
    games = float(fit_counts["weightedGames"])
    if smoothing_family == "DIRICHLET19":
        denominator = games + 0.5 * len(CATEGORIES)
        probabilities = {
            category: (float(counts[category]) + 0.5) / denominator
            for category in CATEGORIES
        }
    elif smoothing_family == "BETA_DIRICHLET":
        exact_count = sum(float(counts[category]) for category in EXACT_CATEGORIES)
        aggregate_probability = (exact_count + 0.5) / (games + 1.0)
        conditional_denominator = exact_count + 0.5 * len(EXACT_CATEGORIES)
        probabilities = {
            category: aggregate_probability
            * (float(counts[category]) + 0.5)
            / conditional_denominator
            for category in EXACT_CATEGORIES
        }
        probabilities["OTHER"] = 1.0 - aggregate_probability
    else:
        fail(f"unknown smoothing family {smoothing_family}")
    if any(not 0 < probability < 1 for probability in probabilities.values()):
        fail(f"invalid probability in {smoothing_family}")
    if abs(sum(probabilities.values()) - 1.0) > 1e-9:
        fail(f"distribution sum failure in {smoothing_family}")
    return probabilities


def candidate_season_weights(
    stage2: Any,
    candidate: dict[str, Any],
    weight_family_by_id: dict[str, dict[str, Any]],
    eligible_seasons: list[int],
) -> dict[int, float]:
    family = weight_family_by_id[candidate["seasonWeightFamily"]]
    return stage2.candidate_season_weights(family["stage2ModelId"], eligible_seasons)


def fit_candidate(
    stage2: Any,
    season_counts: dict[int, dict[str, Any]],
    candidate: dict[str, Any],
    weight_family_by_id: dict[str, dict[str, Any]],
    eligible_seasons: list[int],
) -> dict[str, Any]:
    season_weights = candidate_season_weights(
        stage2, candidate, weight_family_by_id, eligible_seasons
    )
    counts = weighted_counts(season_counts, season_weights)
    probabilities = smooth_distribution(counts, candidate["smoothingFamily"])
    return {
        **counts,
        "probabilities": probabilities,
        "seasonWeights": season_weights,
        "eligibleSeasons": sorted(season_weights),
    }


def evaluate_fold(
    probabilities: dict[str, float],
    validation: list[dict[str, Any]],
    stage2: Any,
) -> dict[str, Any]:
    multiclass_log_loss = 0.0
    multiclass_brier = 0.0
    binary_log_loss = 0.0
    binary_brier = 0.0
    observed_events = 0.0
    aggregate_probability = sum(probabilities[category] for category in EXACT_CATEGORIES)
    for observation in validation:
        labels = observation["labelWeights"]
        aggregate_target = sum(float(labels.get(category, 0.0)) for category in EXACT_CATEGORIES)
        observed_events += aggregate_target
        for category in CATEGORIES:
            target = float(labels.get(category, 0.0))
            probability = float(probabilities[category])
            if target:
                multiclass_log_loss -= target * math.log(probability)
            multiclass_brier += (probability - target) ** 2
        binary_log_loss -= aggregate_target * math.log(aggregate_probability)
        binary_log_loss -= (1.0 - aggregate_target) * math.log(1.0 - aggregate_probability)
        binary_brier += (aggregate_probability - aggregate_target) ** 2
    games = len(validation)
    observed_probability = observed_events / games
    wilson_low, wilson_high = stage2.wilson_interval(observed_events, games)
    return {
        "games": games,
        "observedEvents": observed_events,
        "aggregatePredictedProbability": aggregate_probability,
        "aggregateObservedProbability": observed_probability,
        "aggregateSignedErrorPercentagePoints": (aggregate_probability - observed_probability)
        * 100.0,
        "aggregatePredictionInsideWilson95": (
            aggregate_probability >= wilson_low and aggregate_probability <= wilson_high
        ),
        "observedWilson95LowPercent": wilson_low * 100.0,
        "observedWilson95HighPercent": wilson_high * 100.0,
        "multiclassLogLoss": multiclass_log_loss / games,
        "multiclassBrierScore": multiclass_brier / games,
        "aggregateBinaryLogLoss": binary_log_loss / games,
        "aggregateBinaryBrierScore": binary_brier / games,
    }


def aggregate_folds(folds: list[dict[str, Any]]) -> dict[str, Any]:
    total_games = sum(int(fold["games"]) for fold in folds)

    def game_weighted(field: str) -> float:
        return sum(float(fold[field]) * int(fold["games"]) for fold in folds) / total_games

    expected_events = sum(
        float(fold["aggregatePredictedProbability"]) * int(fold["games"])
        for fold in folds
    )
    observed_events = sum(float(fold["observedEvents"]) for fold in folds)
    absolute_errors = [abs(float(fold["aggregateSignedErrorPercentagePoints"])) for fold in folds]
    return {
        "games": total_games,
        "scoreMetricWeighting": "VALIDATION_GAME_WEIGHTED",
        "aggregateErrorMetricWeighting": "EQUAL_VALIDATION_FOLD_WEIGHTED",
        "meanMulticlassLogLoss": game_weighted("multiclassLogLoss"),
        "meanMulticlassBrierScore": game_weighted("multiclassBrierScore"),
        "meanAggregateBinaryLogLoss": game_weighted("aggregateBinaryLogLoss"),
        "meanAggregateBinaryBrierScore": game_weighted("aggregateBinaryBrierScore"),
        "meanAbsoluteAggregateErrorPercentagePoints": sum(absolute_errors) / len(folds),
        "rootMeanSquareAggregateErrorPercentagePoints": math.sqrt(
            sum(error**2 for error in absolute_errors) / len(folds)
        ),
        "pooledSignedAggregateErrorPercentagePoints": (
            (expected_events - observed_events) / total_games * 100.0
        ),
        "maximumAbsoluteAggregateErrorPercentagePoints": max(absolute_errors),
        "wilsonCompatibleFolds": sum(
            bool(fold["aggregatePredictionInsideWilson95"]) for fold in folds
        ),
        "totalFolds": len(folds),
    }


def percentile(values: list[float], probability: float) -> float:
    ordered = sorted(values)
    position = (len(ordered) - 1) * probability
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    fraction = position - lower
    return ordered[lower] * (1.0 - fraction) + ordered[upper] * fraction


def robustness(
    stage2: Any,
    season_counts: dict[int, dict[str, Any]],
    candidate: dict[str, Any],
    weight_family_by_id: dict[str, dict[str, Any]],
    development_seasons: list[int],
    replicates: int,
    seed: int,
    lower_probability: float,
    upper_probability: float,
) -> dict[str, Any]:
    final_fit = fit_candidate(
        stage2, season_counts, candidate, weight_family_by_id, development_seasons
    )
    final_probability = sum(
        final_fit["probabilities"][category] for category in EXACT_CATEGORIES
    )
    delete_one = []
    for removed in sorted(development_seasons):
        reduced_fit = fit_candidate(
            stage2,
            season_counts,
            candidate,
            weight_family_by_id,
            [season for season in development_seasons if season != removed],
        )
        probability = sum(
            reduced_fit["probabilities"][category] for category in EXACT_CATEGORIES
        )
        delete_one.append(
            {
                "removedSeason": removed,
                "aggregatePercent": probability * 100.0,
                "shiftFromFullPercentagePoints": (probability - final_probability) * 100.0,
            }
        )
    delete_values = [float(row["aggregatePercent"]) for row in delete_one]

    eligible = sorted(development_seasons)
    rng = random.Random(seed)
    bootstrap_values = []
    for _ in range(replicates):
        multiplicities = {season: 0 for season in eligible}
        for _sample in range(len(eligible)):
            multiplicities[rng.choice(eligible)] += 1
        sampled_seasons = [
            season for season, multiplicity in multiplicities.items() if multiplicity
        ]
        family_weights = candidate_season_weights(
            stage2, candidate, weight_family_by_id, sampled_seasons
        )
        sample_weights = {
            season: family_weights[season] * multiplicities[season]
            for season in family_weights
        }
        sample_counts = weighted_counts(season_counts, sample_weights)
        sample_distribution = smooth_distribution(
            sample_counts, candidate["smoothingFamily"]
        )
        bootstrap_values.append(
            sum(sample_distribution[category] for category in EXACT_CATEGORIES) * 100.0
        )
    low = percentile(bootstrap_values, lower_probability)
    high = percentile(bootstrap_values, upper_probability)
    full_percent = final_probability * 100.0
    return {
        "leaveOneEligibleSeasonOut": delete_one,
        "leaveOneAggregateMinimumPercent": min(delete_values),
        "leaveOneAggregateMaximumPercent": max(delete_values),
        "leaveOneAggregateRangePercentagePoints": max(delete_values) - min(delete_values),
        "leaveOneMaximumAbsoluteShiftPercentagePoints": max(
            abs(float(row["shiftFromFullPercentagePoints"])) for row in delete_one
        ),
        "seasonBlockBootstrap": {
            "replicates": replicates,
            "seed": seed,
            "eligibleSeasonBlocks": eligible,
            "aggregateMeanPercent": statistics.fmean(bootstrap_values),
            "aggregateStandardDeviationPercentagePoints": statistics.pstdev(
                bootstrap_values
            ),
            "aggregate95LowPercent": low,
            "aggregate95HighPercent": high,
            "maximum95HalfWidthFromFullPercentagePoints": max(
                full_percent - low, high - full_percent
            ),
        },
    }


def rounded_robustness(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "leaveOneEligibleSeasonOut": [
            {
                "removedSeason": row["removedSeason"],
                "aggregatePercent": round_value(row["aggregatePercent"], 6),
                "shiftFromFullPercentagePoints": round_value(
                    row["shiftFromFullPercentagePoints"], 6
                ),
            }
            for row in value["leaveOneEligibleSeasonOut"]
        ],
        "leaveOneAggregateMinimumPercent": round_value(
            value["leaveOneAggregateMinimumPercent"], 6
        ),
        "leaveOneAggregateMaximumPercent": round_value(
            value["leaveOneAggregateMaximumPercent"], 6
        ),
        "leaveOneAggregateRangePercentagePoints": round_value(
            value["leaveOneAggregateRangePercentagePoints"], 6
        ),
        "leaveOneMaximumAbsoluteShiftPercentagePoints": round_value(
            value["leaveOneMaximumAbsoluteShiftPercentagePoints"], 6
        ),
        "seasonBlockBootstrap": {
            "replicates": value["seasonBlockBootstrap"]["replicates"],
            "seed": value["seasonBlockBootstrap"]["seed"],
            "eligibleSeasonBlocks": value["seasonBlockBootstrap"][
                "eligibleSeasonBlocks"
            ],
            "aggregateMeanPercent": round_value(
                value["seasonBlockBootstrap"]["aggregateMeanPercent"], 6
            ),
            "aggregateStandardDeviationPercentagePoints": round_value(
                value["seasonBlockBootstrap"][
                    "aggregateStandardDeviationPercentagePoints"
                ],
                6,
            ),
            "aggregate95LowPercent": round_value(
                value["seasonBlockBootstrap"]["aggregate95LowPercent"], 6
            ),
            "aggregate95HighPercent": round_value(
                value["seasonBlockBootstrap"]["aggregate95HighPercent"], 6
            ),
            "maximum95HalfWidthFromFullPercentagePoints": round_value(
                value["seasonBlockBootstrap"][
                    "maximum95HalfWidthFromFullPercentagePoints"
                ],
                6,
            ),
        },
    }


def rounded_fold(fold: dict[str, Any]) -> dict[str, Any]:
    return {
        key: (round_value(value, 9) if isinstance(value, float) else value)
        for key, value in fold.items()
    }


def rounded_metrics(metrics: dict[str, Any]) -> dict[str, Any]:
    return {
        key: (round_value(value, 9) if isinstance(value, float) else value)
        for key, value in metrics.items()
    }


def run_self_test() -> None:
    fit_counts = {
        "counts": {**{str(value): 0.0 for value in range(1, 19)}, "OTHER": 1.0},
        "weightedGames": 1.0,
    }
    flat = smooth_distribution(fit_counts, "DIRICHLET19")
    hierarchical = smooth_distribution(fit_counts, "BETA_DIRICHLET")
    if abs(sum(flat.values()) - 1.0) > EPSILON:
        fail("flat smoothing self-test")
    if abs(sum(hierarchical.values()) - 1.0) > EPSILON:
        fail("hierarchical smoothing self-test")
    if percentile([1.0, 2.0, 3.0], 0.5) != 2.0:
        fail("percentile self-test")
    print("WALTERS BW6 STAGE 3R2 SELF-TEST: PASS")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        run_self_test()
        return

    contract = read_json(CONTRACT_PATH)
    if (
        contract.get("status")
        != "BW6_3R2_DEVELOPMENT_ONLY_RECALIBRATION_CONTRACT_LOCKED_NON_OPERATIONAL"
    ):
        fail("R2 contract is not locked")
    for field in [
        "operational",
        "productionAuthority",
        "grahamFairMutationAllowed",
        "liveBoardMutationAllowed",
        "betStatusMutationAllowed",
        "stakeMutationAllowed",
        "marketInputsAllowed",
    ]:
        if contract.get(field) is not False:
            fail(f"R2 authority boundary changed: {field}")

    prior_manifest = contract["priorArtifactManifest"]
    for item in prior_manifest:
        path = ROOT / item["path"]
        if not path.exists() or sha256_file(path) != item["sha256"]:
            fail(f"prior artifact hash mismatch: {item['path']}")
    source_path = ROOT / contract["sourceSnapshot"]["path"]
    if sha256_file(source_path) != contract["sourceSnapshot"]["sha256"]:
        fail("source snapshot hash mismatch")
    for relative in RELEASE_ARTIFACTS:
        if not (ROOT / relative).exists():
            fail(f"missing R2 release artifact {relative}")

    expected_protected = contract["protectedArtifactSha256"]
    if list(expected_protected) != contract["protectedArtifacts"]:
        fail("R2 protected artifact manifest paths changed")
    protected_before = hash_paths(contract["protectedArtifacts"])
    stage1 = read_json(STAGE1_PATH)
    stage2_calibration = read_json(STAGE2_CALIBRATION_PATH)
    stage2 = load_stage2_module()
    games, source_audit = stage2.load_development_games(stage1)
    observations, orientation_audit = stage2.build_oriented_observations(games, stage1)
    allowed_seasons = contract["outcomeUseBoundary"]["developmentSeasons"]
    observed_seasons = sorted({int(observation["season"]) for observation in observations})
    if observed_seasons != allowed_seasons:
        fail("R2 development seasons changed")
    if source_audit.get("holdoutScoreFieldsRead") is not False:
        fail("R2 builder read holdout score fields")

    fold_specs = contract["expandedForwardFolds"]
    expected_validation_seasons = allowed_seasons[1:]
    if [int(fold["validationSeason"]) for fold in fold_specs] != expected_validation_seasons:
        fail("R2 forward-fold validation seasons changed")
    for fold in fold_specs:
        validation_season = int(fold["validationSeason"])
        expected_training = [
            season for season in allowed_seasons if int(season) < validation_season
        ]
        if fold["trainingSeasons"] != expected_training:
            fail(f"R2 forward-fold chronology changed for {validation_season}")
        if any(
            int(season) in contract["outcomeUseBoundary"]["excludedOutcomeSeasons"]
            for season in fold["trainingSeasons"]
        ):
            fail(f"excluded outcome season entered fold {validation_season}")

    metric_rules = contract["evaluation"]["metricAggregationRules"]
    if metric_rules != {
        "scoreMetrics": "Weight each validation game's log-loss and Brier contribution equally, equivalent to weighting fold means by validation-game count.",
        "aggregateMeanAbsoluteAndRootMeanSquareErrors": "Weight each of the eight validation folds equally after computing that fold's aggregate signed error in percentage points.",
        "pooledSignedAggregateError": "Sum predicted aggregate events and observed aggregate events across all validation games, divide their difference by total validation games, then multiply by 100.",
    }:
        fail("R2 metric aggregation rules changed")
    precision_rules = contract["evaluation"]["calculationPrecisionRules"]
    if precision_rules != {
        "gatesDeltasAndSelection": "Use unrounded binary64 calculation values. Rounded serialized fields must never drive eligibility, materiality, ordering or selection.",
        "halfPointFairCosts": "Compute from the unrounded selected margin probability; serialize the probability to nine decimal places, percentages to six decimal places and monetary exact costs to six decimal places.",
        "reportedFoldAndAggregateMetrics": "Serialize probability and score metrics to nine decimal places and percentage-point robustness summaries to six decimal places.",
    }:
        fail("R2 calculation precision rules changed")

    smoothing_by_id = {
        item["id"]: item
        for item in contract["candidateSpecification"]["smoothingFamilies"]
    }
    if smoothing_by_id.get("DIRICHLET19", {}).get("alphaPerCategory") != 0.5:
        fail("R2 flat smoothing alpha changed")
    hierarchical = smoothing_by_id.get("BETA_DIRICHLET", {})
    if any(
        hierarchical.get(field) != 0.5
        for field in ["aggregateAlpha", "otherAlpha", "conditionalMarginAlpha"]
    ):
        fail("R2 hierarchical smoothing alpha changed")

    bootstrap = contract["evaluation"]["seasonBlockRobustness"]
    if bootstrap.get("leaveOneEligibleSeasonOut") is not True:
        fail("R2 leave-one-season robustness disabled")
    if bootstrap.get("leaveOneEligibleSeasonOutMethod") != (
        "For each of the nine development seasons, remove that season from the full "
        "eligible-season list and refit the candidate's declared season-weight family; "
        "rolling windows may therefore admit the next-most-recent remaining season."
    ):
        fail("R2 leave-one-season method changed")
    if bootstrap.get("bootstrapUnit") != "eligible season block":
        fail("R2 bootstrap unit changed")
    if bootstrap.get("bootstrapMethod") != (
        "Sample nine development-season identities with replacement. Reapply the "
        "candidate's declared season-weight family to the unique sampled seasons, then "
        "multiply each selected family weight by that season's sampled multiplicity."
    ):
        fail("R2 bootstrap method changed")
    if bootstrap.get("bootstrapInterval") != [0.025, 0.975]:
        fail("R2 bootstrap interval changed")
    if bootstrap.get("bootstrapQuantileMethod") != (
        "Sort replicate values and linearly interpolate at zero-based position "
        "(replicateCount - 1) * probability."
    ):
        fail("R2 bootstrap quantile method changed")
    if bootstrap.get("maximum95HalfWidthDefinition") != (
        "The larger of fullEstimate - lowerEndpoint and upperEndpoint - fullEstimate."
    ):
        fail("R2 bootstrap half-width definition changed")

    ordered_observation_identity = [
        {
            "gameId": observation["gameId"],
            "season": observation["season"],
            "week": observation["week"],
            "favoriteSide": observation["favoriteSide"],
            "labelWeights": observation["labelWeights"],
        }
        for observation in observations
    ]
    observation_digest = canonical_digest(ordered_observation_identity)
    candidate_spec_digest = canonical_digest(contract["candidateSpecification"])
    prospective_plan_digest = canonical_digest(contract["bw6Stage4ProspectiveShadowPlan"])
    season_counts = build_season_counts(observations)
    weight_family_by_id = {
        item["id"]: item for item in contract["candidateSpecification"]["seasonWeightFamilies"]
    }
    candidates = contract["candidateSpecification"]["candidates"]
    candidate_ids = [candidate["candidateId"] for candidate in candidates]
    if len(candidate_ids) != len(set(candidate_ids)):
        fail("duplicate R2 candidate identity")

    evaluation_rows = []
    calculation_by_id: dict[str, dict[str, Any]] = {}
    for candidate in candidates:
        raw_folds = []
        folds = []
        for fold_spec in contract["expandedForwardFolds"]:
            fit = fit_candidate(
                stage2,
                season_counts,
                candidate,
                weight_family_by_id,
                fold_spec["trainingSeasons"],
            )
            validation = [
                observation
                for observation in observations
                if int(observation["season"]) == int(fold_spec["validationSeason"])
            ]
            if not validation:
                fail(f"empty validation season {fold_spec['validationSeason']}")
            result = evaluate_fold(fit["probabilities"], validation, stage2)
            raw_fold = {
                "validationSeason": int(fold_spec["validationSeason"]),
                "trainingSeasons": fit["eligibleSeasons"],
                **result,
            }
            raw_folds.append(raw_fold)
            folds.append(
                {
                    "validationSeason": raw_fold["validationSeason"],
                    "trainingSeasons": raw_fold["trainingSeasons"],
                    **rounded_fold(result),
                }
            )
        aggregate = aggregate_folds(raw_folds)
        final_fit = fit_candidate(
            stage2, season_counts, candidate, weight_family_by_id, allowed_seasons
        )
        final_probabilities = {
            category: round_value(final_fit["probabilities"][category])
            for category in CATEGORIES
        }
        final_aggregate = sum(final_fit["probabilities"][category] for category in EXACT_CATEGORIES)
        raw_stability = robustness(
            stage2,
            season_counts,
            candidate,
            weight_family_by_id,
            allowed_seasons,
            int(bootstrap["bootstrapReplicates"]),
            int(bootstrap["bootstrapSeed"]),
            float(bootstrap["bootstrapInterval"][0]),
            float(bootstrap["bootstrapInterval"][1]),
        )
        calculation_by_id[candidate["candidateId"]] = {
            "metrics": aggregate,
            "probabilities": final_fit["probabilities"],
            "robustness": raw_stability,
        }
        evaluation_rows.append(
            {
                "candidateId": candidate["candidateId"],
                "seasonWeightFamily": candidate["seasonWeightFamily"],
                "smoothingFamily": candidate["smoothingFamily"],
                "folds": folds,
                "metrics": rounded_metrics(aggregate),
                "finalFit": {
                    "eligibleSeasons": final_fit["eligibleSeasons"],
                    "seasonWeights": {
                        str(season): round_value(weight)
                        for season, weight in final_fit["seasonWeights"].items()
                    },
                    "rawGames": final_fit["rawGames"],
                    "weightedGames": round_value(final_fit["weightedGames"]),
                    "effectiveGames": round_value(final_fit["effectiveGames"]),
                    "categoryProbabilities": final_probabilities,
                    "aggregateOneThroughEighteenPercent": round_value(
                        final_aggregate * 100.0, 6
                    ),
                    "distributionSha256": canonical_digest(final_probabilities),
                },
                "robustness": rounded_robustness(raw_stability),
            }
        )

    reference_id = contract["candidateSpecification"]["referenceCandidateId"]
    row_by_id = {row["candidateId"]: row for row in evaluation_rows}
    if reference_id not in row_by_id:
        fail("reference candidate is absent")
    reference = row_by_id[reference_id]
    if reference["finalFit"]["categoryProbabilities"] != stage2_calibration[
        "selectedCategoryProbabilities"
    ]:
        fail("R2 reference is not byte-equivalent to the frozen Stage 2 distribution")
    reference_calculation = calculation_by_id[reference_id]

    thresholds = contract["evaluation"]["candidateEligibilityThresholds"]
    compatibility = contract["evaluation"]["predictiveCompatibility"]
    for row in evaluation_rows:
        calculation = calculation_by_id[row["candidateId"]]
        metrics = calculation["metrics"]
        raw_probabilities = calculation["probabilities"]
        raw_stability = calculation["robustness"]
        checks = [
            {
                "id": "DISTRIBUTION",
                "pass": abs(sum(raw_probabilities.values()) - 1.0)
                <= float(thresholds["distributionSumTolerance"]),
            },
            {
                "id": "MULTICLASS_LOG_LOSS_NONINFERIOR",
                "pass": metrics["meanMulticlassLogLoss"]
                <= reference_calculation["metrics"]["meanMulticlassLogLoss"]
                + float(thresholds["maximumMulticlassLogLossWorseThanReference"]),
            },
            {
                "id": "MULTICLASS_BRIER_NONINFERIOR",
                "pass": metrics["meanMulticlassBrierScore"]
                <= reference_calculation["metrics"]["meanMulticlassBrierScore"]
                + float(thresholds["maximumMulticlassBrierScoreWorseThanReference"]),
            },
            {
                "id": "AGGREGATE_LOG_LOSS_NONINFERIOR",
                "pass": metrics["meanAggregateBinaryLogLoss"]
                <= reference_calculation["metrics"]["meanAggregateBinaryLogLoss"]
                + float(thresholds["maximumAggregateBinaryLogLossWorseThanReference"]),
            },
            {
                "id": "AGGREGATE_BRIER_NONINFERIOR",
                "pass": metrics["meanAggregateBinaryBrierScore"]
                <= reference_calculation["metrics"]["meanAggregateBinaryBrierScore"]
                + float(thresholds["maximumAggregateBinaryBrierScoreWorseThanReference"]),
            },
            {
                "id": "POOLED_AGGREGATE_ERROR",
                "pass": abs(metrics["pooledSignedAggregateErrorPercentagePoints"])
                <= float(thresholds["maximumAbsolutePooledAggregateErrorPercentagePoints"]),
            },
            {
                "id": "PREDICTIVE_COMPATIBILITY",
                "pass": int(metrics["wilsonCompatibleFolds"])
                >= int(compatibility["minimumCompatibleFolds"]),
            },
            {
                "id": "LEAVE_ONE_SEASON_STABILITY",
                "pass": raw_stability["leaveOneAggregateRangePercentagePoints"]
                <= float(
                    thresholds["maximumLeaveOneSeasonOutAggregateRangePercentagePoints"]
                ),
            },
            {
                "id": "SEASON_BLOCK_BOOTSTRAP_STABILITY",
                "pass": raw_stability["seasonBlockBootstrap"][
                    "maximum95HalfWidthFromFullPercentagePoints"
                ]
                <= float(thresholds["maximumBootstrap95HalfWidthPercentagePoints"]),
            },
        ]
        row["eligibilityChecks"] = checks
        row["eligible"] = all(check["pass"] for check in checks)
        raw_delta = {
            "multiclassLogLossDelta": metrics["meanMulticlassLogLoss"]
            - reference_calculation["metrics"]["meanMulticlassLogLoss"],
            "multiclassBrierScoreDelta": metrics["meanMulticlassBrierScore"]
            - reference_calculation["metrics"]["meanMulticlassBrierScore"],
            "aggregateMeanAbsoluteErrorDeltaPercentagePoints": metrics[
                "meanAbsoluteAggregateErrorPercentagePoints"
            ]
            - reference_calculation["metrics"][
                "meanAbsoluteAggregateErrorPercentagePoints"
            ],
        }
        calculation["versusReference"] = raw_delta
        row["versusReference"] = {
            "multiclassLogLossDelta": round_value(raw_delta["multiclassLogLossDelta"]),
            "multiclassBrierScoreDelta": round_value(
                raw_delta["multiclassBrierScoreDelta"]
            ),
            "aggregateMeanAbsoluteErrorDeltaPercentagePoints": round_value(
                raw_delta["aggregateMeanAbsoluteErrorDeltaPercentagePoints"]
            ),
        }

    material = contract["evaluation"]["materialReplacementThresholds"]
    material_challengers = []
    for row in evaluation_rows:
        if row["candidateId"] == reference_id:
            row["materialReplacementChecks"] = []
            row["materialReplacementQualified"] = False
            continue
        delta = calculation_by_id[row["candidateId"]]["versusReference"]
        checks = [
            {
                "id": "MATERIAL_LOG_LOSS_IMPROVEMENT",
                "pass": -delta["multiclassLogLossDelta"]
                >= float(material["minimumMulticlassLogLossImprovement"]),
            },
            {
                "id": "MATERIAL_BRIER_IMPROVEMENT",
                "pass": -delta["multiclassBrierScoreDelta"]
                >= float(material["minimumMulticlassBrierScoreImprovement"]),
            },
            {
                "id": "MATERIAL_AGGREGATE_MAE_IMPROVEMENT",
                "pass": -delta["aggregateMeanAbsoluteErrorDeltaPercentagePoints"]
                >= float(
                    material[
                        "minimumMeanAbsoluteAggregateErrorImprovementPercentagePoints"
                    ]
                ),
            },
        ]
        row["materialReplacementChecks"] = checks
        row["materialReplacementQualified"] = row["eligible"] and all(
            check["pass"] for check in checks
        )
        if row["materialReplacementQualified"]:
            material_challengers.append(row)

    priority = {
        candidate_id: index
        for index, candidate_id in enumerate(
            contract["candidateSpecification"]["fixedPriorityOrder"]
        )
    }

    def selection_key(row: dict[str, Any]) -> tuple[float, float, float, int]:
        metrics = calculation_by_id[row["candidateId"]]["metrics"]
        return (
            float(metrics["meanMulticlassLogLoss"]),
            float(metrics["meanMulticlassBrierScore"]),
            float(metrics["meanAbsoluteAggregateErrorPercentagePoints"]),
            priority[row["candidateId"]],
        )

    if reference["eligible"]:
        if material_challengers:
            selected = min(material_challengers, key=selection_key)
            selection_decision = "REPLACE_REFERENCE_WITH_MATERIALLY_BETTER_DEVELOPMENT_CANDIDATE"
        else:
            selected = reference
            selection_decision = "RETAIN_EXISTING_FROZEN_REFERENCE"
    else:
        eligible = [row for row in evaluation_rows if row["eligible"]]
        if eligible:
            selected = min(eligible, key=selection_key)
            selection_decision = "REFERENCE_INELIGIBLE_SELECT_BEST_ELIGIBLE_CANDIDATE"
        else:
            selected = None
            selection_decision = "FAIL_CLOSED_NO_ELIGIBLE_CANDIDATE"

    passed = selected is not None
    selected_probabilities = (
        selected["finalFit"]["categoryProbabilities"] if selected else None
    )
    selected_raw_probabilities = (
        calculation_by_id[selected["candidateId"]]["probabilities"] if selected else None
    )
    selected_distribution_digest = (
        canonical_digest(selected_probabilities) if selected_probabilities else None
    )
    protected_after = hash_paths(contract["protectedArtifacts"])
    if protected_before != protected_after:
        fail("R2 build mutated protected production artifacts")

    audit_path = ROOT / contract["outputs"]["developmentAudit"]
    freeze_path = ROOT / contract["outputs"]["modelFreeze"]
    if not passed and freeze_path.exists():
        fail("failed R2 cannot coexist with a prior model-freeze artifact")
    contract_hash = sha256_file(CONTRACT_PATH)
    builder_hash = sha256_file(Path(__file__))
    issued_at = contract["generatedAt"]
    if issued_at != contract["prospectiveCutoff"]["lockedAt"]:
        fail("R2 deterministic evidence timestamp changed")
    prior_hashes = {item["path"]: item["sha256"] for item in prior_manifest}
    audit = {
        "schemaVersion": "walters-bw6-stage3r2-development-audit-v1",
        "module": contract["module"],
        "stage": "BW6.3R2",
        "status": (
            contract["outcomeStates"]["pass"]
            if passed
            else contract["outcomeStates"]["fail"]
        ),
        "generatedAt": issued_at,
        "operational": False,
        "productionAuthority": False,
        "grahamFairMutationAllowed": False,
        "liveBoardMutationAllowed": False,
        "betStatusMutationAllowed": False,
        "stakeMutationAllowed": False,
        "marketViewed": False,
        "weightedAdvantageAllowed": False,
        "crossZeroDeductionAllowed": False,
        "marketNormalizationAllowed": False,
        "r2Contract": CONTRACT_PATH.relative_to(ROOT).as_posix(),
        "r2ContractSha256": contract_hash,
        "builder": Path(__file__).relative_to(ROOT).as_posix(),
        "builderSha256": builder_hash,
        "sourceSnapshotSha256": sha256_file(source_path),
        "priorArtifactSha256": prior_hashes,
        "priorArtifactsUnchanged": all(
            sha256_file(ROOT / path) == expected for path, expected in prior_hashes.items()
        ),
        "outcomeUseAudit": {
            "developmentSeasonsRead": allowed_seasons,
            "developmentOutcomeRowsRead": len(observations),
            "contextOnlySeasonsUsedForOrientation": contract["outcomeUseBoundary"][
                "contextOnlySeasons"
            ],
            "season2020OutcomeRowsRead": 0,
            "season2025OutcomeRowsRead": 0,
            "season2026OutcomeRowsRead": 0,
            "holdoutOrProspectiveRowsUsedForFit": 0,
            "holdoutOrProspectiveRowsUsedForSelection": 0,
            "priorHoldoutKnownToDesigners": True,
            "sourceAudit": source_audit,
            "orientationAudit": orientation_audit,
        },
        "orderedDevelopmentObservationSha256": observation_digest,
        "candidateSpecificationSha256": candidate_spec_digest,
        "prospectiveShadowPlanSha256": prospective_plan_digest,
        "candidateEvaluations": evaluation_rows,
        "selection": {
            "referenceCandidateId": reference_id,
            "referenceEligible": reference["eligible"],
            "eligibleCandidateIds": [
                row["candidateId"] for row in evaluation_rows if row["eligible"]
            ],
            "materialReplacementCandidateIds": [
                row["candidateId"]
                for row in evaluation_rows
                if row.get("materialReplacementQualified")
            ],
            "decision": selection_decision,
            "selectedCandidateId": selected["candidateId"] if selected else None,
            "selectedDistributionSha256": selected_distribution_digest,
            "referenceDistributionByteEquivalentToStage2": (
                reference["finalFit"]["categoryProbabilities"]
                == stage2_calibration["selectedCategoryProbabilities"]
            ),
            "holdoutUsedToBreakTie": False,
            "replacementForced": False,
        },
        "originalStage3FailureOverridden": False,
        "originalThreePointGateWaived": False,
        "protectedArtifactBaselineRole": "HISTORICAL_ISSUANCE_SNAPSHOT_AT_PROSPECTIVE_CUTOFF",
        "issuanceProtectedArtifactSha256": expected_protected,
        "runtimeProtectedArtifactsUnchanged": protected_before == protected_after,
        "modelFreezePath": contract["outputs"]["modelFreeze"],
        "blockedStages": contract["outcomeStates"]["blockedRegardlessOfPass"],
        "nextStage": (
            contract["outcomeStates"]["nextStageOnPass"] if passed else None
        ),
    }
    write_json(audit_path, audit)

    if passed:
        margin_rows = []
        reference_probabilities = reference["finalFit"]["categoryProbabilities"]
        reference_raw_probabilities = reference_calculation["probabilities"]
        for margin in range(1, 19):
            category = str(margin)
            probability = float(selected_raw_probabilities[category])
            margin_rows.append(
                {
                    "margin": margin,
                    "probability": round_value(probability),
                    "percent": round_value(probability * 100.0, 6),
                    "referenceProbability": reference_probabilities[category],
                    "deltaFromReferencePercentagePoints": round_value(
                        (probability - float(reference_raw_probabilities[category])) * 100.0,
                        6,
                    ),
                    "halfPointFairCosts": stage2.fair_half_point_costs(probability),
                }
            )
        release_hashes = hash_paths(RELEASE_ARTIFACTS)
        freeze = {
            "schemaVersion": "walters-bw6-stage3r2-model-freeze-v1",
            "module": contract["module"],
            "stage": "BW6.3R2",
            "status": contract["outcomeStates"]["freeze"],
            "generatedAt": issued_at,
            "operational": False,
            "productionAuthority": False,
            "grahamFairMutationAllowed": False,
            "liveBoardMutationAllowed": False,
            "betStatusMutationAllowed": False,
            "stakeMutationAllowed": False,
            "marketViewed": False,
            "weightedAdvantageAllowed": False,
            "crossZeroDeductionAllowed": False,
            "marketNormalizationAllowed": False,
            "r2Contract": CONTRACT_PATH.relative_to(ROOT).as_posix(),
            "r2ContractSha256": contract_hash,
            "developmentAudit": audit_path.relative_to(ROOT).as_posix(),
            "developmentAuditSha256": sha256_file(audit_path),
            "builder": Path(__file__).relative_to(ROOT).as_posix(),
            "builderSha256": builder_hash,
            "releaseArtifactSha256": release_hashes,
            "orderedDevelopmentObservationSha256": observation_digest,
            "candidateSpecificationSha256": candidate_spec_digest,
            "selectedCandidateId": selected["candidateId"],
            "selectionDecision": selection_decision,
            "selectedCategoryProbabilities": selected_probabilities,
            "selectedDistributionSha256": selected_distribution_digest,
            "aggregateOneThroughEighteenPercent": round_value(
                sum(selected_raw_probabilities[category] for category in EXACT_CATEGORIES)
                * 100.0,
                6,
            ),
            "otherProbabilityPercent": round_value(
                float(selected_raw_probabilities["OTHER"]) * 100.0, 6
            ),
            "marginRows": margin_rows,
            "prospectiveCutoff": contract["prospectiveCutoff"],
            "prospectiveShadowPlan": contract["bw6Stage4ProspectiveShadowPlan"],
            "prospectiveShadowPlanSha256": prospective_plan_digest,
            "season2025Role": contract["outcomeUseBoundary"]["season2025Role"],
            "season2025OutcomeRowsUsedForFit": 0,
            "season2025OutcomeRowsUsedForSelection": 0,
            "season2026OutcomeRowsUsedForFit": 0,
            "season2026OutcomeRowsUsedForSelection": 0,
            "originalStage2DistributionRetained": selected["candidateId"] == reference_id,
            "originalStage3FailureOverridden": False,
            "originalThreePointGateWaived": False,
            "protectedArtifactBaselineRole": "HISTORICAL_ISSUANCE_SNAPSHOT_AT_PROSPECTIVE_CUTOFF",
            "allowedNextStage": contract["outcomeStates"]["nextStageOnPass"],
            "blockedStages": contract["outcomeStates"]["blockedRegardlessOfPass"],
        }
        write_json(freeze_path, freeze)
    print(
        "WALTERS BW6 STAGE 3R2 BUILD: "
        f"{'PASS' if passed else 'FAIL CLOSED'} // "
        f"{selection_decision} // "
        f"{selected['candidateId'] if selected else 'NONE'} // "
        f"{len(observations)} DEVELOPMENT GAMES // 0 HOLDOUT ROWS // "
        "BW6.4 SHADOW ONLY // NON-OPERATIONAL"
    )
    if not passed:
        raise SystemExit(2)


if __name__ == "__main__":
    main()

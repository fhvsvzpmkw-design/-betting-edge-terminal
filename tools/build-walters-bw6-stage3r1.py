#!/usr/bin/env python3
"""Build the non-operational BW6.3R1 recalibration diagnosis.

The 2025 holdout is already exposed. This builder may characterize its recorded
failure, but it never fits or selects a model with 2025 outcomes and it cannot
change the original BW6.3 disposition.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from statistics import NormalDist
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "data/walters/nfl/key-numbers/bw6-stage3r1-diagnosis-contract-v1.json"
OUTPUT_PATH = ROOT / "data/walters/nfl/key-numbers/bw6-stage3r1-recalibration-diagnosis-v1.json"
STAGE2_BUILDER_PATH = ROOT / "tools/build-walters-bw6-stage2.py"
CATEGORIES = tuple(str(margin) for margin in range(1, 19)) + ("OTHER",)
EPSILON = 1e-12


def fail(message: str) -> None:
    raise RuntimeError(f"WALTERS BW6 STAGE 3R1 BUILD FAILED // {message}")


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def round_value(value: float, digits: int = 9) -> float:
    return round(float(value), digits)


def load_stage2_module() -> Any:
    spec = importlib.util.spec_from_file_location("walters_bw6_stage2", STAGE2_BUILDER_PATH)
    if spec is None or spec.loader is None:
        fail("cannot load the frozen Stage 2 builder")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def exact_binomial_probabilities(games: int, probability: float) -> list[float]:
    if games <= 0 or not 0 < probability < 1:
        fail("invalid exact-binomial inputs")
    return [
        math.comb(games, events)
        * probability**events
        * (1.0 - probability) ** (games - events)
        for events in range(games + 1)
    ]


def exact_two_sided_binomial_p(games: int, events: int, probability: float) -> float:
    probabilities = exact_binomial_probabilities(games, probability)
    observed_probability = probabilities[events]
    return min(
        1.0,
        sum(value for value in probabilities if value <= observed_probability + 1e-15),
    )


def aggregate_event_weight(observation: dict[str, Any]) -> float:
    return sum(float(observation["labelWeights"].get(category, 0.0)) for category in CATEGORIES[:-1])


def observed_aggregate(observations: list[dict[str, Any]]) -> tuple[float, float]:
    events = sum(aggregate_event_weight(observation) for observation in observations)
    return events, events / len(observations)


def normal_two_sided_p(z_score: float) -> float:
    return math.erfc(abs(z_score) / math.sqrt(2.0))


def outcome_partition(favorite_side: str, home_margin: int) -> dict[str, float]:
    output = {
        "FAVORITE_WIN_1_TO_18": 0.0,
        "FAVORITE_WIN_19_PLUS": 0.0,
        "FAVORITE_LOSS_OR_TIE": 0.0,
    }
    if favorite_side == "HOME":
        favorite_margin = home_margin
    elif favorite_side == "AWAY":
        favorite_margin = -home_margin
    elif favorite_side == "SPLIT":
        if home_margin == 0:
            output["FAVORITE_LOSS_OR_TIE"] = 1.0
        elif abs(home_margin) <= 18:
            output["FAVORITE_WIN_1_TO_18"] = 0.5
            output["FAVORITE_LOSS_OR_TIE"] = 0.5
        else:
            output["FAVORITE_WIN_19_PLUS"] = 0.5
            output["FAVORITE_LOSS_OR_TIE"] = 0.5
        return output
    else:
        fail(f"unknown favorite side in outcome partition: {favorite_side}")

    if 1 <= favorite_margin <= 18:
        output["FAVORITE_WIN_1_TO_18"] = 1.0
    elif favorite_margin >= 19:
        output["FAVORITE_WIN_19_PLUS"] = 1.0
    else:
        output["FAVORITE_LOSS_OR_TIE"] = 1.0
    return output


def summarize_outcome_partition(rows: list[dict[str, float]]) -> dict[str, Any]:
    categories = [
        "FAVORITE_WIN_1_TO_18",
        "FAVORITE_WIN_19_PLUS",
        "FAVORITE_LOSS_OR_TIE",
    ]
    counts = {category: sum(float(row[category]) for row in rows) for category in categories}
    games = len(rows)
    return {
        "games": games,
        "counts": {category: round_value(counts[category], 3) for category in categories},
        "percents": {
            category: round_value(counts[category] / games * 100.0, 6)
            for category in categories
        },
        "favoriteWinPercent": round_value(
            (counts["FAVORITE_WIN_1_TO_18"] + counts["FAVORITE_WIN_19_PLUS"])
            / games
            * 100.0,
            6,
        ),
    }


def pearson_homogeneity(two_rows: list[list[float]]) -> tuple[float, int]:
    if len(two_rows) != 2 or not two_rows[0] or len(two_rows[0]) != len(two_rows[1]):
        fail("invalid homogeneity table")
    row_totals = [sum(row) for row in two_rows]
    column_totals = [sum(two_rows[row][column] for row in range(2)) for column in range(len(two_rows[0]))]
    grand_total = sum(row_totals)
    statistic = 0.0
    for row in range(2):
        for column in range(len(two_rows[0])):
            expected = row_totals[row] * column_totals[column] / grand_total
            if expected <= 0:
                fail("empty expected homogeneity cell")
            statistic += (two_rows[row][column] - expected) ** 2 / expected
    return statistic, len(two_rows[0]) - 1


def chi_square_survival_df_one_or_two(statistic: float, degrees_of_freedom: int) -> float:
    if degrees_of_freedom == 1:
        return math.erfc(math.sqrt(statistic / 2.0))
    if degrees_of_freedom == 2:
        return math.exp(-statistic / 2.0)
    fail("unsupported diagnostic chi-square degrees of freedom")


def hashes(paths: list[str]) -> dict[str, str]:
    output = {}
    for relative in paths:
        path = ROOT / relative
        if not path.exists():
            fail(f"missing frozen or protected artifact {relative}")
        output[relative] = sha256_file(path)
    return output


def generated_at(contract_hash: str, stage3_hash: str) -> str:
    explicit = os.environ.get("BW6_STAGE3R1_GENERATED_AT")
    if explicit:
        return explicit
    if OUTPUT_PATH.exists():
        prior = read_json(OUTPUT_PATH)
        if (
            prior.get("diagnosisContractSha256") == contract_hash
            and prior.get("stage3HoldoutAuditSha256") == stage3_hash
            and prior.get("generatedAt")
        ):
            return str(prior["generatedAt"])
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def run_self_test() -> None:
    probabilities = exact_binomial_probabilities(2, 0.5)
    if any(abs(actual - expected) > EPSILON for actual, expected in zip(probabilities, [0.25, 0.5, 0.25])):
        fail("exact-binomial probability self-test")
    if abs(exact_two_sided_binomial_p(2, 0, 0.5) - 0.5) > EPSILON:
        fail("exact-binomial p-value self-test")
    if abs(normal_two_sided_p(0.0) - 1.0) > EPSILON:
        fail("normal p-value self-test")
    print("WALTERS BW6 STAGE 3R1 SELF-TEST: PASS")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        run_self_test()
        return

    contract = read_json(CONTRACT_PATH)
    if contract.get("status") != "BW6_3R1_DIAGNOSTIC_CONTRACT_LOCKED_NON_OPERATIONAL":
        fail("diagnostic contract is not locked")
    if contract.get("authoredAfterHoldoutViewed") is not True:
        fail("post-holdout authorship is not explicit")
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
            fail(f"contract authority boundary changed: {field}")

    frozen_input_paths = [item["path"] for item in contract["frozenInputs"]]
    for item in contract["frozenInputs"]:
        path = ROOT / item["path"]
        if not path.exists() or sha256_file(path) != item["sha256"]:
            fail(f"frozen input hash mismatch: {item['role']}")

    prior_paths = list(contract["priorBw6Artifacts"])
    protected_paths = list(contract["protectedArtifacts"])
    immutable_paths = list(dict.fromkeys(frozen_input_paths + prior_paths + protected_paths))
    immutable_before = hashes(immutable_paths)

    frozen_by_role = {item["role"]: ROOT / item["path"] for item in contract["frozenInputs"]}
    stage1 = read_json(frozen_by_role["BW6_STAGE1_CONTRACT"])
    model_lock = read_json(frozen_by_role["BW6_STAGE2_MODEL_LOCK"])
    stage2_calibration = read_json(frozen_by_role["BW6_STAGE2_CALIBRATION"])
    holdout = read_json(frozen_by_role["BW6_STAGE3_HOLDOUT_AUDIT"])

    expected_stage3_status = contract["outcomeRules"]["originalBw6Stage3StatusMustRemain"]
    if holdout.get("status") != expected_stage3_status:
        fail("original Stage 3 disposition changed")
    failed_checks = [check["id"] for check in holdout["acceptanceChecks"] if not check["pass"]]
    if holdout.get("summary") != {"checks": 10, "passed": 9, "failed": 1, "holdoutPass": False}:
        fail("original Stage 3 result is no longer 9/10 fail-closed")
    if failed_checks != ["BW6H-AGGREGATE-CALIBRATION"]:
        fail("original Stage 3 failed-check identity changed")
    if holdout.get("marketViewed") is not False:
        fail("Stage 3 market-isolation state changed")

    stage2 = load_stage2_module()
    development_games, development_source_audit = stage2.load_development_games(stage1)
    observations, development_orientation_audit = stage2.build_oriented_observations(
        development_games, stage1
    )
    development_seasons = contract["diagnosticPlan"]["developmentSeasons"]
    if sorted({int(item["season"]) for item in observations}) != development_seasons:
        fail("development season identity changed")

    alpha = float(stage1["calibrationLock"]["smoothing"]["alphaPerCategory"])
    candidates = stage1["calibrationLock"]["estimatorCandidates"]
    folds = stage1["calibrationLock"]["internalSelectionFolds"]
    fold_diagnostics = []
    for candidate in candidates:
        model_id = candidate["modelId"]
        for fold in folds:
            distribution = stage2.fit_distribution(
                observations,
                model_id,
                fold["eligibleTrainingSeasons"],
                alpha,
            )
            predicted = sum(float(distribution["probabilities"][category]) for category in CATEGORIES[:-1])
            validation = [
                observation
                for observation in observations
                if int(observation["season"]) == int(fold["validationSeason"])
            ]
            observed_events, actual = observed_aggregate(validation)
            fold_diagnostics.append(
                {
                    "modelId": model_id,
                    "validationSeason": int(fold["validationSeason"]),
                    "games": len(validation),
                    "observedEvents": round_value(observed_events, 3),
                    "predictedPercent": round_value(predicted * 100.0, 6),
                    "observedPercent": round_value(actual * 100.0, 6),
                    "signedErrorPercentagePoints": round_value((predicted - actual) * 100.0, 6),
                }
            )

    selected_model_id = model_lock["selectedModel"]["modelId"]
    selected_folds = [row for row in fold_diagnostics if row["modelId"] == selected_model_id]
    selected_games = sum(int(row["games"]) for row in selected_folds)
    selected_expected_events = sum(
        float(row["predictedPercent"]) / 100.0 * int(row["games"]) for row in selected_folds
    )
    selected_observed_events = sum(float(row["observedEvents"]) for row in selected_folds)
    selected_pooled_error = (selected_expected_events - selected_observed_events) / selected_games

    seasonal_development = []
    for season in development_seasons:
        season_observations = [item for item in observations if int(item["season"]) == season]
        event_count, event_probability = observed_aggregate(season_observations)
        seasonal_development.append(
            {
                "season": season,
                "games": len(season_observations),
                "observedEvents": round_value(event_count, 3),
                "observedPercent": round_value(event_probability * 100.0, 6),
            }
        )

    development_game_by_id = {game["gameId"]: game for game in development_games}
    development_partition_rows = []
    for observation in observations:
        game = development_game_by_id.get(observation["gameId"])
        if game is None:
            fail(f"missing development game for partition {observation['gameId']}")
        development_partition_rows.append(
            outcome_partition(
                observation["favoriteSide"],
                int(game["homeScore"]) - int(game["awayScore"]),
            )
        )
    holdout_partition_rows = [
        outcome_partition(record["pregameFavoriteSide"], int(record["actualHomeMargin"]))
        for record in holdout["holdoutGames"]
    ]
    development_outcomes = summarize_outcome_partition(development_partition_rows)
    holdout_outcomes = summarize_outcome_partition(holdout_partition_rows)
    outcome_categories = [
        "FAVORITE_WIN_1_TO_18",
        "FAVORITE_WIN_19_PLUS",
        "FAVORITE_LOSS_OR_TIE",
    ]
    three_category_table = [
        [float(development_outcomes["counts"][category]) for category in outcome_categories],
        [float(holdout_outcomes["counts"][category]) for category in outcome_categories],
    ]
    three_category_chi, three_category_df = pearson_homogeneity(three_category_table)
    favorite_win_mix_table = [
        [
            float(development_outcomes["counts"]["FAVORITE_WIN_1_TO_18"]),
            float(development_outcomes["counts"]["FAVORITE_WIN_19_PLUS"]),
        ],
        [
            float(holdout_outcomes["counts"]["FAVORITE_WIN_1_TO_18"]),
            float(holdout_outcomes["counts"]["FAVORITE_WIN_19_PLUS"]),
        ],
    ]
    favorite_win_mix_chi, favorite_win_mix_df = pearson_homogeneity(favorite_win_mix_table)
    favorite_win_rate_table = [
        [
            sum(favorite_win_mix_table[0]),
            float(development_outcomes["counts"]["FAVORITE_LOSS_OR_TIE"]),
        ],
        [
            sum(favorite_win_mix_table[1]),
            float(holdout_outcomes["counts"]["FAVORITE_LOSS_OR_TIE"]),
        ],
    ]
    favorite_win_rate_chi, favorite_win_rate_df = pearson_homogeneity(favorite_win_rate_table)

    def era_summary(seasons: list[int]) -> dict[str, Any]:
        rows = [item for item in observations if int(item["season"]) in seasons]
        events, probability = observed_aggregate(rows)
        return {
            "seasons": seasons,
            "games": len(rows),
            "observedEvents": round_value(events, 3),
            "observedPercent": round_value(probability * 100.0, 6),
        }

    early = era_summary(stage1["historicalDataContract"]["earlyEraWindow"]["seasons"])
    current = era_summary(stage1["historicalDataContract"]["currentEraWindow"]["seasons"])
    early_p = float(early["observedEvents"]) / int(early["games"])
    current_p = float(current["observedEvents"]) / int(current["games"])
    pooled_p = (float(early["observedEvents"]) + float(current["observedEvents"])) / (
        int(early["games"]) + int(current["games"])
    )
    era_standard_error = math.sqrt(
        pooled_p
        * (1.0 - pooled_p)
        * (1.0 / int(early["games"]) + 1.0 / int(current["games"]))
    )
    era_z = (current_p - early_p) / era_standard_error

    aggregate = holdout["metrics"]["aggregateOneThroughEighteen"]
    holdout_games = int(holdout["metrics"]["selectedCalibrated"]["games"])
    holdout_events = sum(float(row["observedEventCount"]) for row in holdout["perMargin"])
    frozen_probability = float(aggregate["selectedPredictedPercent"]) / 100.0
    observed_probability = holdout_events / holdout_games
    original_gate = float(contract["diagnosticPlan"]["aggregateReferenceErrorPercentagePoints"]) / 100.0
    exact_probabilities = exact_binomial_probabilities(holdout_games, frozen_probability)
    exact_p = exact_two_sided_binomial_p(holdout_games, int(round(holdout_events)), frozen_probability)
    pass_counts = [
        events
        for events in range(holdout_games + 1)
        if abs(events / holdout_games - frozen_probability) <= original_gate + EPSILON
    ]
    exceedance_probability = sum(
        probability
        for events, probability in enumerate(exact_probabilities)
        if abs(events / holdout_games - frozen_probability) > original_gate + EPSILON
    )
    expected_events = holdout_games * frozen_probability
    shortfall_events = expected_events - holdout_events
    minimum_additional_to_pass = next(
        additional
        for additional in range(holdout_games - int(holdout_events) + 1)
        if abs((holdout_events + additional) / holdout_games - frozen_probability)
        <= original_gate + EPSILON
    )

    family_alpha = float(contract["diagnosticPlan"]["familyWiseAlpha"])
    bonferroni_critical = NormalDist().inv_cdf(1.0 - family_alpha / (2.0 * 18.0))
    margin_rows = []
    for row in holdout["perMargin"]:
        margin = int(row["margin"])
        probability = float(row["selectedPredictedPercent"]) / 100.0
        observed_count = float(row["observedEventCount"])
        expected_count = holdout_games * probability
        standard_error_count = math.sqrt(holdout_games * probability * (1.0 - probability))
        standardized_residual = (observed_count - expected_count) / standard_error_count
        margin_rows.append(
            {
                "margin": margin,
                "observedEvents": round_value(observed_count, 3),
                "expectedEvents": round_value(expected_count, 6),
                "predictedPercent": round_value(probability * 100.0, 6),
                "observedPercent": round_value(observed_count / holdout_games * 100.0, 6),
                "signedModelErrorPercentagePoints": round_value(
                    (probability - observed_count / holdout_games) * 100.0, 6
                ),
                "standardizedResidualObservedMinusExpected": round_value(
                    standardized_residual, 6
                ),
                "bonferroniFamilyWiseFlag": abs(standardized_residual)
                > bonferroni_critical,
            }
        )
    familywise_flags = [row["margin"] for row in margin_rows if row["bonferroniFamilyWiseFlag"]]

    observed_distribution = holdout["distributions"]["observedHoldout"]
    selected_distribution = holdout["distributions"]["selectedCalibrated"]

    def partition(name: str, categories: list[str]) -> dict[str, Any]:
        predicted = sum(float(selected_distribution[category]) for category in categories)
        actual = sum(float(observed_distribution[category]) for category in categories)
        return {
            "id": name,
            "categories": categories,
            "predictedPercent": round_value(predicted * 100.0, 6),
            "observedPercent": round_value(actual * 100.0, 6),
            "signedModelErrorPercentagePoints": round_value((predicted - actual) * 100.0, 6),
        }

    partitions = [
        partition("MARGINS_1_TO_6", [str(value) for value in range(1, 7)]),
        partition("MARGINS_7_TO_12", [str(value) for value in range(7, 13)]),
        partition("MARGINS_13_TO_18", [str(value) for value in range(13, 19)]),
        partition("OTHER", ["OTHER"]),
    ]
    key_numbers = partition("KEY_NUMBERS_3_AND_7", ["3", "7"])
    aggregate_model_error_pp = (frozen_probability - observed_probability) * 100.0
    other_model_error_pp = (
        float(selected_distribution["OTHER"]) - float(observed_distribution["OTHER"])
    ) * 100.0
    structural_signal = exact_p < family_alpha and bool(familywise_flags)
    z_value = float(aggregate["samplingDiagnostic"]["observedMinusSelectedZScore"])
    confidence_z = NormalDist().inv_cdf(
        0.5 + float(contract["diagnosticPlan"]["confidenceLevel"]) / 2.0
    )
    approximate_games_for_gate_precision = math.ceil(
        confidence_z**2
        * frozen_probability
        * (1.0 - frozen_probability)
        / original_gate**2
    )

    immutable_after = hashes(immutable_paths)
    if immutable_before != immutable_after:
        fail("diagnosis mutated frozen or protected artifacts")

    contract_hash = sha256_file(CONTRACT_PATH)
    stage3_hash = sha256_file(frozen_by_role["BW6_STAGE3_HOLDOUT_AUDIT"])
    output = {
        "schemaVersion": "walters-bw6-stage3r1-recalibration-diagnosis-v1",
        "module": contract["module"],
        "stage": "BW6.3R1",
        "status": contract["outcomeRules"]["diagnosisCompleteState"],
        "generatedAt": generated_at(contract_hash, stage3_hash),
        "operational": False,
        "productionAuthority": False,
        "grahamFairMutationAllowed": False,
        "liveBoardMutationAllowed": False,
        "betStatusMutationAllowed": False,
        "stakeMutationAllowed": False,
        "marketViewed": False,
        "holdoutState": contract["exposedHoldoutBoundary"]["state"],
        "modelFitUsed2025": False,
        "modelSelectionUsed2025": False,
        "thresholdChanged": False,
        "stage3DispositionOverridden": False,
        "diagnosisContract": CONTRACT_PATH.relative_to(ROOT).as_posix(),
        "diagnosisContractSha256": contract_hash,
        "stage1ContractSha256": sha256_file(frozen_by_role["BW6_STAGE1_CONTRACT"]),
        "stage2ModelLockSha256": sha256_file(frozen_by_role["BW6_STAGE2_MODEL_LOCK"]),
        "stage2CalibrationSha256": sha256_file(frozen_by_role["BW6_STAGE2_CALIBRATION"]),
        "stage3HoldoutAuditSha256": stage3_hash,
        "builder": Path(__file__).relative_to(ROOT).as_posix(),
        "builderSha256": sha256_file(Path(__file__)),
        "originalDecision": {
            "status": holdout["status"],
            "summary": holdout["summary"],
            "failedChecks": failed_checks,
            "preserved": True,
        },
        "lockedGateDiagnosis": {
            "games": holdout_games,
            "observedEvents": round_value(holdout_events, 3),
            "expectedEvents": round_value(expected_events, 6),
            "eventShortfall": round_value(shortfall_events, 6),
            "selectedPredictedPercent": round_value(frozen_probability * 100.0, 6),
            "observedPercent": round_value(observed_probability * 100.0, 6),
            "signedModelErrorPercentagePoints": round_value(aggregate_model_error_pp, 6),
            "absoluteErrorPercentagePoints": round_value(abs(aggregate_model_error_pp), 6),
            "lockedMaximumErrorPercentagePoints": round_value(original_gate * 100.0, 6),
            "distanceBeyondGatePercentagePoints": round_value(
                abs(aggregate_model_error_pp) - original_gate * 100.0, 6
            ),
            "maximumAbsoluteEventDifferenceAtGate": round_value(holdout_games * original_gate, 6),
            "exactPassingObservedEventRange": {
                "minimum": min(pass_counts),
                "maximum": max(pass_counts),
            },
            "minimumAdditionalExactMarginEventsToPass": minimum_additional_to_pass,
            "errorWithOneAdditionalEventPercentagePoints": round_value(
                abs(frozen_probability - (holdout_events + 1.0) / holdout_games) * 100.0,
                6,
            ),
            "errorWithTwoAdditionalEventsPercentagePoints": round_value(
                abs(frozen_probability - (holdout_events + 2.0) / holdout_games) * 100.0,
                6,
            ),
            "originalGateWaived": False,
        },
        "samplingCompatibility": {
            "standardErrorPercentagePoints": aggregate["samplingDiagnostic"][
                "standardErrorPercentagePointsUnderSelectedModel"
            ],
            "observedMinusExpectedZScore": round_value(z_value, 6),
            "exactTwoSidedBinomialPValue": round_value(exact_p, 9),
            "selectedPredictionInsideHoldoutWilson95": aggregate["samplingDiagnostic"][
                "selectedPredictionInsideHoldoutWilson95"
            ],
            "holdoutWilson95LowPercent": aggregate["samplingDiagnostic"][
                "holdoutWilson95LowPercent"
            ],
            "holdoutWilson95HighPercent": aggregate["samplingDiagnostic"][
                "holdoutWilson95HighPercent"
            ],
            "probabilityAbsoluteErrorExceedsLockedGateUnderFrozenModel": round_value(
                exceedance_probability, 9
            ),
            "probabilityLockedGatePassesUnderFrozenModel": round_value(
                1.0 - exceedance_probability, 9
            ),
            "diagnosticOnlyNoGateOverride": True,
        },
        "developmentEvidence": {
            "sourceAudit": development_source_audit,
            "orientationAudit": development_orientation_audit,
            "seasonalAggregate": seasonal_development,
            "lockedFoldDiagnostics": fold_diagnostics,
            "selectedModelPooledLockedFolds": {
                "modelId": selected_model_id,
                "games": selected_games,
                "expectedEvents": round_value(selected_expected_events, 6),
                "observedEvents": round_value(selected_observed_events, 3),
                "signedModelErrorPercentagePoints": round_value(
                    selected_pooled_error * 100.0, 6
                ),
                "maximumAbsoluteSingleFoldErrorPercentagePoints": round_value(
                    max(abs(float(row["signedErrorPercentagePoints"])) for row in selected_folds),
                    6,
                ),
            },
            "eraComparison": {
                "earlyEra": early,
                "currentEra": current,
                "currentMinusEarlyPercentagePoints": round_value(
                    (current_p - early_p) * 100.0, 6
                ),
                "twoProportionZScore": round_value(era_z, 6),
                "twoSidedNormalPValue": round_value(normal_two_sided_p(era_z), 9),
            },
            "outcomeDecomposition": {
                "development": development_outcomes,
                "holdout": holdout_outcomes,
                "frozenAggregateMinusRawDevelopmentPercentagePoints": round_value(
                    frozen_probability * 100.0
                    - float(development_outcomes["percents"]["FAVORITE_WIN_1_TO_18"]),
                    6,
                ),
                "threeCategoryHomogeneity": {
                    "pearsonChiSquare": round_value(three_category_chi, 6),
                    "degreesOfFreedom": three_category_df,
                    "pValue": round_value(
                        chi_square_survival_df_one_or_two(
                            three_category_chi, three_category_df
                        ),
                        9,
                    ),
                },
                "favoriteWinRateHomogeneity": {
                    "pearsonChiSquare": round_value(favorite_win_rate_chi, 6),
                    "degreesOfFreedom": favorite_win_rate_df,
                    "pValue": round_value(
                        chi_square_survival_df_one_or_two(
                            favorite_win_rate_chi, favorite_win_rate_df
                        ),
                        9,
                    ),
                },
                "oneToEighteenVersusNineteenPlusAmongFavoriteWins": {
                    "pearsonChiSquare": round_value(favorite_win_mix_chi, 6),
                    "degreesOfFreedom": favorite_win_mix_df,
                    "pValue": round_value(
                        chi_square_survival_df_one_or_two(
                            favorite_win_mix_chi, favorite_win_mix_df
                        ),
                        9,
                    ),
                },
                "diagnosticCause": "FAVORITE_WIN_RATE_STABLE_MORE_WINS_ABOVE_18_MONITOR_NOT_PROVEN",
            },
            "holdoutOutcomesUsedForAnyDevelopmentFit": False,
        },
        "localization": {
            "perMargin": margin_rows,
            "bonferroniFamilyWiseAlpha": family_alpha,
            "bonferroniTwoSidedCriticalAbsoluteZ": round_value(bonferroni_critical, 6),
            "familyWiseFlaggedMargins": familywise_flags,
            "completeNonOverlappingPartitions": partitions,
            "keyNumberDiagnostic": key_numbers,
            "aggregateSignedModelErrorPercentagePoints": round_value(
                aggregate_model_error_pp, 6
            ),
            "otherSignedModelErrorPercentagePoints": round_value(other_model_error_pp, 6),
            "aggregateErrorEqualsOppositeOtherError": abs(
                aggregate_model_error_pp + other_model_error_pp
            )
            <= 1e-6,
        },
        "diagnosticConclusion": {
            "descriptiveStructuralSignalDetected": structural_signal,
            "samplingVariationRemainsPlausible": (
                exact_p >= family_alpha
                and aggregate["samplingDiagnostic"]["selectedPredictionInsideHoldoutWilson95"]
            ),
            "interpretation": (
                "STRUCTURAL_SIGNAL_FOR_PROSPECTIVE_RECALIBRATION_ONLY"
                if structural_signal
                else "NO_HOLDOUT_EVIDENCE_JUSTIFIES_RETROACTIVE_REFIT"
            ),
            "currentFrozenModelDisposition": contract["outcomeRules"][
                "currentFrozenModelDisposition"
            ],
            "replacementModelSelected": False,
            "freshValidationRequired": contract["outcomeRules"]["freshValidationRequired"],
            "approximateGamesRequiredForThreePoint95PercentNormalHalfWidth": (
                approximate_games_for_gate_precision
            ),
            "oneSeasonHasMaterialFalseFailRiskAtLockedGate": exceedance_probability > 0.20,
        },
        "protectedArtifactSha256Before": {
            path: immutable_before[path] for path in protected_paths
        },
        "protectedArtifactSha256After": {
            path: immutable_after[path] for path in protected_paths
        },
        "priorBw6ArtifactSha256Before": {
            path: immutable_before[path] for path in prior_paths
        },
        "priorBw6ArtifactSha256After": {
            path: immutable_after[path] for path in prior_paths
        },
        "protectedArtifactsUnchanged": all(
            immutable_before[path] == immutable_after[path] for path in protected_paths
        ),
        "priorBw6ArtifactsUnchanged": all(
            immutable_before[path] == immutable_after[path] for path in prior_paths
        ),
        "blockedStages": contract["outcomeRules"]["blockedStages"],
        "nextStage": contract["outcomeRules"]["nextStage"],
    }
    write_json(OUTPUT_PATH, output)
    print(
        "WALTERS BW6 STAGE 3R1 DIAGNOSIS: COMPLETE // "
        f"ORIGINAL {holdout['summary']['passed']}/{holdout['summary']['checks']} PRESERVED // "
        f"EXACT P {exact_p:.3f} // GATE FALSE-FAIL {exceedance_probability:.3f} // "
        "NO RETROACTIVE REFIT // NON-OPERATIONAL"
    )


if __name__ == "__main__":
    main()

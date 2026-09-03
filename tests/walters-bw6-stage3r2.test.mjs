import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const ROOT = process.cwd();
const CONTRACT_PATH = 'data/walters/nfl/key-numbers/bw6-stage3r2-contract-v1.json';
const AUDIT_PATH = 'data/walters/nfl/key-numbers/bw6-stage3r2-development-audit-v1.json';
const FREEZE_PATH = 'data/walters/nfl/key-numbers/bw6-stage3r2-model-freeze-v1.json';
const STAGE2_CALIBRATION_PATH =
  'data/walters/nfl/key-numbers/bw6-stage2-calibration-v1.json';
const BUILDER_PATH = 'tools/build-walters-bw6-stage3r2.py';
const VALIDATOR_PATH = 'tools/validate-walters-bw6-stage3r2.mjs';

const contract = readJson(CONTRACT_PATH);
const audit = readJson(AUDIT_PATH);
const freeze = readJson(FREEZE_PATH);
const stage2Calibration = readJson(STAGE2_CALIBRATION_PATH);

function readJson(relative) {
  return JSON.parse(fs.readFileSync(`${ROOT}/${relative}`, 'utf8'));
}

function hash(relative) {
  return crypto.createHash('sha256').update(fs.readFileSync(`${ROOT}/${relative}`)).digest('hex');
}

function approximately(actual, expected, tolerance = 1e-8, label = '') {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label || 'value'}: expected ${expected}, received ${actual}`,
  );
}

function immutablePaths() {
  return [
    ...new Set([
      ...contract.priorArtifactManifest.map((item) => item.path),
      ...contract.protectedArtifacts,
      contract.sourceSnapshot.path,
      CONTRACT_PATH,
      BUILDER_PATH,
      VALIDATOR_PATH,
      'tests/walters-bw6-stage3r2.test.mjs',
      '.github/workflows/walters-bw6-stage3r2.yml',
    ]),
  ];
}

function recomputeFoldMetrics(folds) {
  const games = folds.reduce((sum, fold) => sum + fold.games, 0);
  const gameWeighted = (field) =>
    folds.reduce((sum, fold) => sum + fold[field] * fold.games, 0) / games;
  const absoluteErrors = folds.map((fold) =>
    Math.abs(fold.aggregateSignedErrorPercentagePoints),
  );
  const expectedEvents = folds.reduce(
    (sum, fold) => sum + fold.aggregatePredictedProbability * fold.games,
    0,
  );
  const observedEvents = folds.reduce((sum, fold) => sum + fold.observedEvents, 0);
  return {
    games,
    meanMulticlassLogLoss: gameWeighted('multiclassLogLoss'),
    meanMulticlassBrierScore: gameWeighted('multiclassBrierScore'),
    meanAggregateBinaryLogLoss: gameWeighted('aggregateBinaryLogLoss'),
    meanAggregateBinaryBrierScore: gameWeighted('aggregateBinaryBrierScore'),
    meanAbsoluteAggregateErrorPercentagePoints:
      absoluteErrors.reduce((sum, value) => sum + value, 0) / folds.length,
    rootMeanSquareAggregateErrorPercentagePoints: Math.sqrt(
      absoluteErrors.reduce((sum, value) => sum + value ** 2, 0) / folds.length,
    ),
    pooledSignedAggregateErrorPercentagePoints:
      ((expectedEvents - observedEvents) / games) * 100,
    maximumAbsoluteAggregateErrorPercentagePoints: Math.max(...absoluteErrors),
    wilsonCompatibleFolds: folds.filter((fold) => fold.aggregatePredictionInsideWilson95)
      .length,
  };
}

test('BW6.3R2 deterministic helper self-test passes', () => {
  const run = spawnSync('python', [BUILDER_PATH, '--self-test'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {...process.env, PYTHONDONTWRITEBYTECODE: '1'},
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /WALTERS BW6 STAGE 3R2 SELF-TEST: PASS/);
});

test('BW6.3R2 full rebuild is deterministic and preserves every governed input', () => {
  const auditBefore = hash(AUDIT_PATH);
  const freezeBefore = hash(FREEZE_PATH);
  const before = Object.fromEntries(immutablePaths().map((relative) => [relative, hash(relative)]));

  const run = spawnSync('python', [BUILDER_PATH], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {...process.env, PYTHONDONTWRITEBYTECODE: '1'},
  });

  const after = Object.fromEntries(immutablePaths().map((relative) => [relative, hash(relative)]));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /RETAIN_EXISTING_FROZEN_REFERENCE/);
  assert.match(run.stdout, /2367 DEVELOPMENT GAMES \/\/ 0 HOLDOUT ROWS/);
  assert.match(run.stdout, /BW6\.4 SHADOW ONLY \/\/ NON-OPERATIONAL/);
  assert.equal(hash(AUDIT_PATH), auditBefore);
  assert.equal(hash(FREEZE_PATH), freezeBefore);
  assert.deepEqual(after, before);
});

test('BW6.3R2 validator accepts the development audit and frozen shadow handoff', () => {
  const run = spawnSync(process.execPath, [VALIDATOR_PATH], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
});

test('all six candidates run across the exact eight forward-only folds', () => {
  const expectedCandidates = contract.candidateSpecification.candidates.map(
    (candidate) => candidate.candidateId,
  );
  const expectedValidationSeasons = contract.expandedForwardFolds.map(
    (fold) => fold.validationSeason,
  );
  assert.equal(audit.candidateEvaluations.length, 6);
  assert.deepEqual(
    audit.candidateEvaluations.map((candidate) => candidate.candidateId),
    expectedCandidates,
  );

  for (const candidate of audit.candidateEvaluations) {
    assert.equal(candidate.folds.length, 8, candidate.candidateId);
    assert.deepEqual(
      candidate.folds.map((fold) => fold.validationSeason),
      expectedValidationSeasons,
      candidate.candidateId,
    );
    assert.equal(candidate.metrics.games, 2111, candidate.candidateId);
    assert.equal(candidate.metrics.totalFolds, 8, candidate.candidateId);
    assert.equal(candidate.metrics.scoreMetricWeighting, 'VALIDATION_GAME_WEIGHTED');
    assert.equal(
      candidate.metrics.aggregateErrorMetricWeighting,
      'EQUAL_VALIDATION_FOLD_WEIGHTED',
    );
    assert.equal(candidate.robustness.leaveOneEligibleSeasonOut.length, 9);
    assert.deepEqual(
      candidate.robustness.leaveOneEligibleSeasonOut.map((row) => row.removedSeason),
      contract.outcomeUseBoundary.developmentSeasons,
    );
    assert.equal(
      candidate.robustness.seasonBlockBootstrap.replicates,
      contract.evaluation.seasonBlockRobustness.bootstrapReplicates,
    );
    assert.equal(
      candidate.robustness.seasonBlockBootstrap.seed,
      contract.evaluation.seasonBlockRobustness.bootstrapSeed,
    );
    assert.deepEqual(
      candidate.robustness.seasonBlockBootstrap.eligibleSeasonBlocks,
      contract.outcomeUseBoundary.developmentSeasons,
    );
    for (const [index, fold] of candidate.folds.entries()) {
      const specification = contract.expandedForwardFolds[index];
      assert.ok(
        fold.trainingSeasons.every((season) => specification.trainingSeasons.includes(season)),
        `${candidate.candidateId} ${fold.validationSeason} training boundary`,
      );
      assert.ok(
        fold.trainingSeasons.every((season) => season < fold.validationSeason),
        `${candidate.candidateId} ${fold.validationSeason} chronology`,
      );
      assert.ok(
        !fold.trainingSeasons.some((season) => [2020, 2025, 2026].includes(season)),
        `${candidate.candidateId} ${fold.validationSeason} excluded outcome season`,
      );
    }
  }
});

test('reported selection metrics and eligibility are arithmetically reproducible', () => {
  const thresholds = contract.evaluation.candidateEligibilityThresholds;
  const material = contract.evaluation.materialReplacementThresholds;
  const reference = audit.candidateEvaluations.find(
    (candidate) => candidate.candidateId === contract.candidateSpecification.referenceCandidateId,
  );
  assert.ok(reference);
  const recomputedMaterialCandidates = [];

  for (const candidate of audit.candidateEvaluations) {
    const recomputed = recomputeFoldMetrics(candidate.folds);
    for (const [field, value] of Object.entries(recomputed)) {
      if (typeof value === 'number') {
        approximately(candidate.metrics[field], value, 2e-8, `${candidate.candidateId}.${field}`);
      }
    }

    const probabilities = Object.values(candidate.finalFit.categoryProbabilities);
    const roundedDistributionError = Math.abs(
      probabilities.reduce((sum, value) => sum + value, 0) - 1,
    );
    assert.ok(
      roundedDistributionError <=
        thresholds.distributionSumTolerance + probabilities.length * 0.5000001e-9,
      `${candidate.candidateId} serialized distribution envelope`,
    );
    const expectedChecks = new Map([
      ['DISTRIBUTION', true],
      [
        'MULTICLASS_LOG_LOSS_NONINFERIOR',
        candidate.metrics.meanMulticlassLogLoss <=
          reference.metrics.meanMulticlassLogLoss +
            thresholds.maximumMulticlassLogLossWorseThanReference,
      ],
      [
        'MULTICLASS_BRIER_NONINFERIOR',
        candidate.metrics.meanMulticlassBrierScore <=
          reference.metrics.meanMulticlassBrierScore +
            thresholds.maximumMulticlassBrierScoreWorseThanReference,
      ],
      [
        'AGGREGATE_LOG_LOSS_NONINFERIOR',
        candidate.metrics.meanAggregateBinaryLogLoss <=
          reference.metrics.meanAggregateBinaryLogLoss +
            thresholds.maximumAggregateBinaryLogLossWorseThanReference,
      ],
      [
        'AGGREGATE_BRIER_NONINFERIOR',
        candidate.metrics.meanAggregateBinaryBrierScore <=
          reference.metrics.meanAggregateBinaryBrierScore +
            thresholds.maximumAggregateBinaryBrierScoreWorseThanReference,
      ],
      [
        'POOLED_AGGREGATE_ERROR',
        Math.abs(candidate.metrics.pooledSignedAggregateErrorPercentagePoints) <=
          thresholds.maximumAbsolutePooledAggregateErrorPercentagePoints,
      ],
      [
        'PREDICTIVE_COMPATIBILITY',
        candidate.metrics.wilsonCompatibleFolds >=
          contract.evaluation.predictiveCompatibility.minimumCompatibleFolds,
      ],
      [
        'LEAVE_ONE_SEASON_STABILITY',
        candidate.robustness.leaveOneAggregateRangePercentagePoints <=
          thresholds.maximumLeaveOneSeasonOutAggregateRangePercentagePoints,
      ],
      [
        'SEASON_BLOCK_BOOTSTRAP_STABILITY',
        candidate.robustness.seasonBlockBootstrap.maximum95HalfWidthFromFullPercentagePoints <=
          thresholds.maximumBootstrap95HalfWidthPercentagePoints,
      ],
    ]);
    assert.deepEqual(
      Object.fromEntries(candidate.eligibilityChecks.map((check) => [check.id, check.pass])),
      Object.fromEntries(expectedChecks),
      candidate.candidateId,
    );
    assert.equal(
      candidate.eligible,
      [...expectedChecks.values()].every(Boolean),
      candidate.candidateId,
    );

    approximately(
      candidate.versusReference.multiclassLogLossDelta,
      candidate.metrics.meanMulticlassLogLoss - reference.metrics.meanMulticlassLogLoss,
      2e-8,
      `${candidate.candidateId}.multiclassLogLossDelta`,
    );
    approximately(
      candidate.versusReference.multiclassBrierScoreDelta,
      candidate.metrics.meanMulticlassBrierScore - reference.metrics.meanMulticlassBrierScore,
      2e-8,
      `${candidate.candidateId}.multiclassBrierScoreDelta`,
    );
    approximately(
      candidate.versusReference.aggregateMeanAbsoluteErrorDeltaPercentagePoints,
      candidate.metrics.meanAbsoluteAggregateErrorPercentagePoints -
        reference.metrics.meanAbsoluteAggregateErrorPercentagePoints,
      2e-8,
      `${candidate.candidateId}.aggregateMeanAbsoluteErrorDeltaPercentagePoints`,
    );

    if (candidate.candidateId === reference.candidateId) {
      assert.deepEqual(candidate.materialReplacementChecks, []);
      assert.equal(candidate.materialReplacementQualified, false);
      continue;
    }
    const expectedMaterialChecks = new Map([
      [
        'MATERIAL_LOG_LOSS_IMPROVEMENT',
        -candidate.versusReference.multiclassLogLossDelta >=
          material.minimumMulticlassLogLossImprovement,
      ],
      [
        'MATERIAL_BRIER_IMPROVEMENT',
        -candidate.versusReference.multiclassBrierScoreDelta >=
          material.minimumMulticlassBrierScoreImprovement,
      ],
      [
        'MATERIAL_AGGREGATE_MAE_IMPROVEMENT',
        -candidate.versusReference.aggregateMeanAbsoluteErrorDeltaPercentagePoints >=
          material.minimumMeanAbsoluteAggregateErrorImprovementPercentagePoints,
      ],
    ]);
    assert.deepEqual(
      Object.fromEntries(
        candidate.materialReplacementChecks.map((check) => [check.id, check.pass]),
      ),
      Object.fromEntries(expectedMaterialChecks),
      candidate.candidateId,
    );
    const qualified = candidate.eligible && [...expectedMaterialChecks.values()].every(Boolean);
    assert.equal(candidate.materialReplacementQualified, qualified, candidate.candidateId);
    if (qualified) recomputedMaterialCandidates.push(candidate.candidateId);
  }

  assert.equal(reference.eligible, true);
  assert.deepEqual(audit.selection.materialReplacementCandidateIds, recomputedMaterialCandidates);
  assert.deepEqual(recomputedMaterialCandidates, []);
  assert.equal(audit.selection.decision, 'RETAIN_EXISTING_FROZEN_REFERENCE');
  assert.equal(audit.selection.selectedCandidateId, reference.candidateId);
});

test('2025 and 2026 remain unavailable to fitting, selection, and acceptance', () => {
  assert.deepEqual(contract.outcomeUseBoundary.excludedOutcomeSeasons, [2020, 2025, 2026]);
  assert.equal(contract.outcomeUseBoundary.season2025Role,
    'EXPOSED_DIAGNOSTIC_ONLY_ZERO_OUTCOME_ROWS_PASSED_TO_R2_FIT_OR_SELECTION');
  assert.equal(contract.outcomeUseBoundary.season2026Role,
    'PROSPECTIVE_ZERO_OUTCOME_ROWS_PASSED_TO_R2_FIT_OR_SELECTION');
  assert.deepEqual(
    audit.outcomeUseAudit.developmentSeasonsRead,
    contract.outcomeUseBoundary.developmentSeasons,
  );
  assert.equal(audit.outcomeUseAudit.developmentOutcomeRowsRead, 2367);
  assert.equal(audit.outcomeUseAudit.sourceAudit.holdoutScoreFieldsRead, false);
  for (const field of [
    'season2020OutcomeRowsRead',
    'season2025OutcomeRowsRead',
    'season2026OutcomeRowsRead',
    'holdoutOrProspectiveRowsUsedForFit',
    'holdoutOrProspectiveRowsUsedForSelection',
  ]) {
    assert.equal(audit.outcomeUseAudit[field], 0, field);
  }
  for (const field of [
    'season2025OutcomeRowsUsedForFit',
    'season2025OutcomeRowsUsedForSelection',
    'season2026OutcomeRowsUsedForFit',
    'season2026OutcomeRowsUsedForSelection',
  ]) {
    assert.equal(freeze[field], 0, field);
  }
  assert.equal(audit.selection.holdoutUsedToBreakTie, false);
});

test('the selected model is the byte-equivalent frozen Stage 2 reference', () => {
  assert.equal(audit.selection.referenceEligible, true);
  assert.equal(audit.selection.selectedCandidateId, 'R2_FULL_DIRICHLET19');
  assert.equal(audit.selection.referenceDistributionByteEquivalentToStage2, true);
  assert.equal(freeze.originalStage2DistributionRetained, true);
  assert.deepEqual(freeze.selectedCategoryProbabilities, stage2Calibration.selectedCategoryProbabilities);
  assert.equal(freeze.selectedDistributionSha256, audit.selection.selectedDistributionSha256);
  assert.equal(audit.originalStage3FailureOverridden, false);
  assert.equal(audit.originalThreePointGateWaived, false);
  assert.equal(freeze.originalStage3FailureOverridden, false);
  assert.equal(freeze.originalThreePointGateWaived, false);

  const stage2ByMargin = new Map(
    stage2Calibration.marginRows.map((row) => [row.margin, row.currentCalibration]),
  );
  for (const row of freeze.marginRows) {
    const stage2 = stage2ByMargin.get(row.margin);
    assert.ok(stage2, `missing Stage 2 margin ${row.margin}`);
    assert.equal(row.probability, stage2.pointWeightProbability);
    assert.deepEqual(row.halfPointFairCosts, stage2.halfPointFairCost);
  }
  assert.equal(
    freeze.marginRows.find((row) => row.margin === 17).halfPointFairCosts
      .buyOffPushToWinExactUsdPer100,
    4.836418,
  );
});

test('evidence time, protected baseline, and calculation methods are contract-bound', () => {
  assert.equal(contract.generatedAt, contract.prospectiveCutoff.lockedAt);
  assert.equal(audit.generatedAt, contract.generatedAt);
  assert.equal(freeze.generatedAt, contract.generatedAt);
  assert.deepEqual(audit.issuanceProtectedArtifactSha256, contract.protectedArtifactSha256);
  assert.deepEqual(Object.keys(contract.protectedArtifactSha256), contract.protectedArtifacts);
  assert.equal(
    audit.protectedArtifactBaselineRole,
    'HISTORICAL_ISSUANCE_SNAPSHOT_AT_PROSPECTIVE_CUTOFF',
  );
  assert.equal(
    freeze.protectedArtifactBaselineRole,
    'HISTORICAL_ISSUANCE_SNAPSHOT_AT_PROSPECTIVE_CUTOFF',
  );
  assert.match(
    contract.evaluation.calculationPrecisionRules.gatesDeltasAndSelection,
    /unrounded binary64/,
  );
  assert.match(
    contract.evaluation.seasonBlockRobustness.leaveOneEligibleSeasonOutMethod,
    /nine development seasons/,
  );
  assert.match(
    contract.evaluation.seasonBlockRobustness.bootstrapQuantileMethod,
    /linearly interpolate/,
  );
});

test('the exact three-cycle BW6.4 shadow plan is frozen without statistical authority', () => {
  const plan = freeze.prospectiveShadowPlan;
  assert.deepEqual(plan, contract.bw6Stage4ProspectiveShadowPlan);
  assert.equal(plan.authorizedOnlyIfR2Passes, true);
  assert.equal(plan.authorizedStage, 'BW6.4_PROSPECTIVE_ACTIVE_WEEK_SHADOW');
  assert.equal(plan.minimumConsecutiveCleanCycles, 3);
  assert.equal(plan.maximumQualifyingCyclesPerPacificCalendarDate, 1);
  assert.equal(plan.minimumScheduledCycles, 2);
  assert.equal(plan.distinctImmutableInputSnapshotsRequired, true);
  assert.equal(plan.minimumChangedActiveWeekOrCurrentNumbersHashes, 1);
  assert.equal(plan.identicalManualRerunsCount, false);
  assert.equal(plan.failedOrIncompleteCycleResetsConsecutiveCount, true);
  assert.match(plan.cyclePurpose, /Execution stability only/);
  assert.equal(freeze.prospectiveShadowPlanSha256, audit.prospectiveShadowPlanSha256);
  assert.equal(freeze.allowedNextStage, 'BW6.4_PROSPECTIVE_ACTIVE_WEEK_SHADOW');
});

test('R2 grants no production, market, recommendation, or downstream authority', () => {
  assert.equal(audit.status, contract.outcomeStates.pass);
  assert.equal(freeze.status, contract.outcomeStates.freeze);
  assert.equal(contract.marketInputsAllowed, false);
  for (const payload of [contract, audit, freeze]) {
    for (const field of [
      'operational',
      'productionAuthority',
      'grahamFairMutationAllowed',
      'liveBoardMutationAllowed',
      'betStatusMutationAllowed',
      'stakeMutationAllowed',
    ]) {
      assert.equal(payload[field], false, field);
    }
  }
  for (const payload of [audit, freeze]) {
    assert.equal(payload.marketViewed, false);
    assert.equal(payload.weightedAdvantageAllowed, false);
    assert.equal(payload.crossZeroDeductionAllowed, false);
    assert.equal(payload.marketNormalizationAllowed, false);
    assert.deepEqual(payload.blockedStages, ['BW7', 'BW8', 'PRODUCTION_AUTHORITY']);
  }
  assert.ok(contract.bw6Stage4ProspectiveShadowPlan.prohibitedOutput.includes('Graham fair mutation'));
  assert.ok(contract.bw6Stage4ProspectiveShadowPlan.prohibitedOutput.includes('stake mutation'));
});

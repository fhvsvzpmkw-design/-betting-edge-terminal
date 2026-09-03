#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONTRACT_PATH = path.join(ROOT, 'data/walters/nfl/key-numbers/bw6-stage1-contract-v1.json');
const LOCK_PATH = path.join(ROOT, 'data/walters/nfl/key-numbers/bw6-stage2-model-lock-v1.json');
const CALIBRATION_PATH = path.join(
  ROOT,
  'data/walters/nfl/key-numbers/bw6-stage2-calibration-v1.json',
);
const BUILDER_PATH = path.join(ROOT, 'tools/build-walters-bw6-stage2.py');
const EPSILON = 1e-9;

function fail(message) {
  throw new Error(`WALTERS BW6 STAGE 2 VERIFY FAILED // ${message}`);
}

function ok(condition, message) {
  if (!condition) fail(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function same(actual, expected, message) {
  ok(JSON.stringify(actual) === JSON.stringify(expected), message);
}

function approximate(actual, expected, tolerance, message) {
  ok(Number.isFinite(Number(actual)), `${message}: not finite`);
  ok(
    Math.abs(Number(actual) - Number(expected)) <= tolerance,
    `${message}: expected ${expected}, got ${actual}`,
  );
}

function fairCosts(probability) {
  const p = Number(probability);
  const q = 110 / 210;
  return {
    buyOntoLossToPushExactUsdPer100: (100 * q) / (1 - q - p) - 110,
    buyOffPushToWinExactUsdPer100:
      (100 * (q * (1 - p) + p)) / ((1 - q) * (1 - p)) - 110,
  };
}

for (const file of [CONTRACT_PATH, LOCK_PATH, CALIBRATION_PATH, BUILDER_PATH]) {
  ok(fs.existsSync(file), `missing ${path.relative(ROOT, file)}`);
}
const contract = readJson(CONTRACT_PATH);
const lock = readJson(LOCK_PATH);
const calibration = readJson(CALIBRATION_PATH);

const runtimeProtectedFiles = (contract.protectedArtifacts ?? []).map((relative) =>
  path.join(ROOT, relative),
);
for (const file of runtimeProtectedFiles) {
  ok(fs.existsSync(file), `missing protected artifact ${path.relative(ROOT, file)}`);
}
const runtimeProtectedBefore = Object.fromEntries(
  runtimeProtectedFiles.map((file) => [path.relative(ROOT, file), hashFile(file)]),
);

ok(contract.stage === 'BW6.1', 'Stage 1 contract identity');
ok(
  contract.status === 'CONTRACT_LOCKED_FOR_BW6_2_CALIBRATION_NON_OPERATIONAL',
  'Stage 1 entry status',
);
ok(lock.schemaVersion === 'walters-bw6-stage2-model-lock-v1', 'model-lock schema');
ok(lock.module === contract.module, 'model-lock module');
ok(lock.stage === 'BW6.2', 'model-lock stage');
ok(
  lock.status === 'MODEL_SELECTED_AND_LOCKED_HOLDOUT_UNOPENED_NON_OPERATIONAL',
  'model-lock status',
);
ok(calibration.schemaVersion === 'walters-bw6-stage2-calibration-v1', 'calibration schema');
ok(calibration.module === contract.module, 'calibration module');
ok(calibration.stage === 'BW6.2', 'calibration stage');
ok(
  calibration.status === 'CURRENT_POINT_WEIGHTS_CALIBRATED_HOLDOUT_UNOPENED_NON_OPERATIONAL',
  'calibration status',
);

for (const artifact of [lock, calibration]) {
  for (const field of [
    'operational',
    'productionAuthority',
    'grahamFairMutationAllowed',
    'liveBoardMutationAllowed',
    'betStatusMutationAllowed',
    'stakeMutationAllowed',
    'marketViewed',
    'holdoutViewed',
    'holdoutOutcomeFieldsRead',
  ]) {
    ok(artifact[field] === false, `${artifact.schemaVersion}.${field} must be false`);
  }
  ok(artifact.protectedArtifactsUnchanged === true, `${artifact.schemaVersion} protected status`);
  same(
    artifact.protectedArtifactSha256Before,
    artifact.protectedArtifactSha256After,
    `${artifact.schemaVersion} protected before/after hashes`,
  );
}

const contractHash = hashFile(CONTRACT_PATH);
const sourcePath = path.join(ROOT, contract.historicalDataContract.sourceSnapshot.path);
ok(lock.stage1ContractSha256 === contractHash, 'model-lock Stage 1 hash');
ok(calibration.stage1ContractSha256 === contractHash, 'calibration Stage 1 hash');
ok(lock.builderSha256 === hashFile(BUILDER_PATH), 'builder hash');
ok(lock.sourceSnapshotSha256 === hashFile(sourcePath), 'model-lock source hash');
ok(calibration.sourceSnapshotSha256 === hashFile(sourcePath), 'calibration source hash');
ok(calibration.stage2ModelLockSha256 === hashFile(LOCK_PATH), 'calibration model-lock hash');
ok(calibration.stage2ModelLock === path.relative(ROOT, LOCK_PATH), 'calibration model-lock path');
ok(lock.generatedAt === calibration.generatedAt, 'Stage 2 generation identity');

ok(lock.sourceAudit?.holdoutScoreFieldsRead === false, 'source audit holdout isolation');
ok(lock.sourceAudit?.marketFieldsPresent === false, 'source audit market isolation');
ok(lock.sourceAudit?.developmentGames === 2367, 'source audit development count');
ok(lock.sourceAudit?.contextGames === 256, 'source audit context count');
ok(lock.sourceAudit?.skippedRowsByReason?.['2025_REG'] === 272, '2025 rows skipped before scores');
ok(lock.sourceAudit?.skippedRowsByReason?.['2020_REG'] === 256, '2020 rows excluded');
ok(lock.sourceAudit?.skippedRowsByReason?.['2026_REG'] === 272, '2026 rows excluded');

const orientationAudit = lock.orientationAudit ?? {};
ok(orientationAudit.developmentObservations === 2367, 'orientation observation count');
ok(orientationAudit.canonicalTeams?.length === 32, 'canonical team count');
ok(new Set(orientationAudit.canonicalTeams ?? []).size === 32, 'canonical team uniqueness');
ok(orientationAudit.targetGameScoresUsedForOrientation === false, 'target-score lookahead');
ok(orientationAudit.futureGamesUsedForOrientation === false, 'future-game lookahead');
ok(orientationAudit.marketInputsUsed === false, 'orientation market isolation');
const seasonAuditGames = Object.values(orientationAudit.bySeason ?? {}).reduce(
  (total, item) => total + Number(item.games),
  0,
);
ok(seasonAuditGames === 2367, 'orientation season audit total');
for (const [season, item] of Object.entries(orientationAudit.bySeason ?? {})) {
  ok(
    Number(item.homeFavorite) + Number(item.awayFavorite) + Number(item.splitOrientation) ===
      Number(item.games),
    `favorite orientation accounting ${season}`,
  );
}

const candidates = lock.candidateSelection?.candidates ?? [];
same(
  candidates.map((candidate) => candidate.modelId),
  [
    'BW6_FULL_DEVELOPMENT_POOL',
    'BW6_ROLLING_FOUR_ELIGIBLE_SEASONS',
    'BW6_EXPONENTIAL_SEASON_DECAY_HL4',
  ],
  'candidate model order',
);
for (const candidate of candidates) {
  same(
    candidate.folds.map((fold) => fold.validationSeason),
    [2019, 2023, 2024],
    `${candidate.modelId} validation folds`,
  );
  for (const fold of candidate.folds) {
    ok(fold.games > 0, `${candidate.modelId} ${fold.validationSeason} validation games`);
    ok(
      fold.trainingSeasons.every((season) => season < fold.validationSeason && season !== 2020),
      `${candidate.modelId} ${fold.validationSeason} chronological training`,
    );
    ok(Number.isFinite(fold.multiclassLogLoss), `${candidate.modelId} fold log loss`);
    ok(Number.isFinite(fold.multiclassBrierScore), `${candidate.modelId} fold Brier`);
  }
  ok(candidate.aggregate.games === 800, `${candidate.modelId} aggregate games`);
}

const minBrier = Math.min(
  ...candidates.map((candidate) => candidate.aggregate.gameWeightedMeanBrierScore),
);
const brierEligible = candidates.filter(
  (candidate) =>
    candidate.aggregate.gameWeightedMeanBrierScore <= minBrier + 0.001 + EPSILON,
);
const minEligibleLogLoss = Math.min(
  ...brierEligible.map((candidate) => candidate.aggregate.gameWeightedMeanLogLoss),
);
const tied = new Set(
  brierEligible
    .filter(
      (candidate) =>
        candidate.aggregate.gameWeightedMeanLogLoss <= minEligibleLogLoss + 0.002 + EPSILON,
    )
    .map((candidate) => candidate.modelId),
);
const priority = [
  'BW6_FULL_DEVELOPMENT_POOL',
  'BW6_ROLLING_FOUR_ELIGIBLE_SEASONS',
  'BW6_EXPONENTIAL_SEASON_DECAY_HL4',
];
const selectedByRule = priority.find((modelId) => tied.has(modelId));
ok(selectedByRule === lock.selectedModel?.modelId, 'stored selected model violates selection rule');
ok(selectedByRule === calibration.selectedModelId, 'calibration selected model mismatch');
ok(
  lock.candidateSelection?.selectionAudit?.selectedModelId === selectedByRule,
  'selection audit mismatch',
);
ok(lock.selectedModel?.rawGames === 2367, 'selected-model raw game count');
same(
  lock.selectedModel?.eligibleSeasons,
  contract.historicalDataContract.developmentWindow.seasons,
  'selected-model eligible seasons',
);
ok(lock.selectedModel?.smoothing?.method === 'JEFFREYS_DIRICHLET', 'selected smoothing');
ok(lock.selectedModel?.smoothing?.alphaPerCategory === 0.5, 'selected smoothing alpha');

const probabilities = lock.selectedModel?.frozenCategoryProbabilities ?? {};
same(probabilities, calibration.selectedCategoryProbabilities, 'frozen category probabilities');
same(Object.keys(probabilities), [...Array.from({length: 18}, (_, index) => String(index + 1)), 'OTHER'], 'category keys');
for (const [category, probability] of Object.entries(probabilities)) {
  ok(Number(probability) > 0 && Number(probability) < 1, `category probability ${category}`);
}
approximate(
  Object.values(probabilities).reduce((total, value) => total + Number(value), 0),
  1,
  contract.holdoutAcceptance.numericThresholds.distributionSumTolerance,
  'probability sum',
);
const oneThroughEighteen = Array.from({length: 18}, (_, index) => String(index + 1)).reduce(
  (total, key) => total + Number(probabilities[key]),
  0,
);
approximate(
  calibration.pointWeightSumOneThroughEighteenPercent,
  oneThroughEighteen * 100,
  1e-6,
  'point-weight sum',
);
approximate(calibration.otherProbabilityPercent, Number(probabilities.OTHER) * 100, 1e-6, 'other probability');

const marginRows = calibration.marginRows ?? [];
ok(marginRows.length === 18, 'margin-row count');
same(
  marginRows.map((row) => row.margin),
  Array.from({length: 18}, (_, index) => index + 1),
  'margin rows',
);
const supportCounts = {
  CURRENT_SUPPORTED: 0,
  SHADOW_ONLY_UNSTABLE: 0,
  SHADOW_ONLY_INSUFFICIENT_SAMPLE: 0,
};
for (const row of marginRows) {
  const key = String(row.margin);
  ok(
    row.bookExact.pointWeightPercentPublishedRounded ===
      contract.bookExactBaseline.pointWeightsPercentPublishedRounded[key],
    `margin ${key} BOOK-EXACT weight`,
  );
  same(
    row.bookExact.buyHalfPointFairCostUsdPer100,
    contract.bookExactBaseline.buyHalfPointFairCostUsdPer100[key],
    `margin ${key} BOOK-EXACT fair cost`,
  );
  approximate(
    row.currentCalibration.pointWeightProbability,
    probabilities[key],
    1e-9,
    `margin ${key} frozen probability`,
  );
  approximate(
    row.currentCalibration.pointWeightPercent,
    Number(probabilities[key]) * 100,
    1e-6,
    `margin ${key} point-weight percent`,
  );
  ok(row.currentCalibration.rawEventCount >= 15, `margin ${key} raw sample gate`);
  ok(
    row.currentCalibration.wilson95Percent.halfWidthPercentagePoints <= 2.5,
    `margin ${key} interval gate`,
  );
  ok(row.currentCalibration.stability.pass === true, `margin ${key} stability gate`);
  ok(
    row.currentCalibration.supportStatus in supportCounts,
    `margin ${key} unknown support status`,
  );
  supportCounts[row.currentCalibration.supportStatus] += 1;
  const expectedCosts = fairCosts(probabilities[key]);
  approximate(
    row.currentCalibration.halfPointFairCost.buyOntoLossToPushExactUsdPer100,
    expectedCosts.buyOntoLossToPushExactUsdPer100,
    1e-6,
    `margin ${key} buy-onto fair cost`,
  );
  approximate(
    row.currentCalibration.halfPointFairCost.buyOffPushToWinExactUsdPer100,
    expectedCosts.buyOffPushToWinExactUsdPer100,
    1e-6,
    `margin ${key} buy-off fair cost`,
  );
  ok(row.currentCalibration.provenance === 'WALTERS CALIBRATED', `margin ${key} provenance`);
}
same(calibration.supportSummary, supportCounts, 'support summary');
ok(calibration.bookExactBoundary?.currentValuesDoNotOverwriteBookExact === true, 'BOOK-EXACT immutability');
ok(calibration.bookExactBoundary?.publishedWeightSumPercent === 62, 'BOOK-EXACT sum');
ok(lock.nextStage === 'BW6.3_2025_HOLDOUT_EVALUATION_WITHOUT_RESELECTION', 'model-lock next stage');
ok(calibration.nextStage === lock.nextStage, 'calibration next stage');

const runtimeProtectedAfter = Object.fromEntries(
  runtimeProtectedFiles.map((file) => [path.relative(ROOT, file), hashFile(file)]),
);
same(runtimeProtectedAfter, runtimeProtectedBefore, 'validator changed protected artifacts');

console.log(
  `WALTERS BW6 STAGE 2 VERIFY: PASS // ${selectedByRule} // ` +
    `${lock.selectedModel.rawGames} DEVELOPMENT GAMES // ` +
    `${supportCounts.CURRENT_SUPPORTED}/18 CURRENT-SUPPORTED // ` +
    `2025 HOLDOUT UNOPENED // MARKET ISOLATED // NON-OPERATIONAL`,
);

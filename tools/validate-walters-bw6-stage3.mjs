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
const AUDIT_PATH = path.join(
  ROOT,
  'data/walters/nfl/key-numbers/bw6-stage3-holdout-audit-v1.json',
);
const BUILDER_PATH = path.join(ROOT, 'tools/build-walters-bw6-stage3.py');
const CATEGORIES = [...Array.from({length: 18}, (_, index) => String(index + 1)), 'OTHER'];
const EPSILON = 1e-9;

function fail(message) {
  throw new Error(`WALTERS BW6 STAGE 3 VERIFY FAILED // ${message}`);
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

function evaluate(distribution, games) {
  let logLoss = 0;
  let brier = 0;
  for (const game of games) {
    for (const category of CATEGORIES) {
      const target = Number(game.observedCategoryWeights?.[category] ?? 0);
      const probability = Number(distribution[category]);
      if (target) logLoss -= target * Math.log(probability);
      brier += (probability - target) ** 2;
    }
  }
  return {
    games: games.length,
    multiclassLogLoss: logLoss / games.length,
    multiclassBrierScore: brier / games.length,
  };
}

function observedDistribution(games) {
  const counts = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  for (const game of games) {
    for (const [category, weight] of Object.entries(game.observedCategoryWeights ?? {})) {
      counts[category] += Number(weight);
    }
  }
  return Object.fromEntries(
    CATEGORIES.map((category) => [category, counts[category] / games.length]),
  );
}

function wilsonInterval(eventCount, games, z = 1.95996398454) {
  const proportion = eventCount / games;
  const denominator = 1 + z ** 2 / games;
  const center = (proportion + z ** 2 / (2 * games)) / denominator;
  const margin =
    (z * Math.sqrt(proportion * (1 - proportion) / games + z ** 2 / (4 * games ** 2))) /
    denominator;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

for (const file of [CONTRACT_PATH, LOCK_PATH, CALIBRATION_PATH, AUDIT_PATH, BUILDER_PATH]) {
  ok(fs.existsSync(file), `missing ${path.relative(ROOT, file)}`);
}
const contract = readJson(CONTRACT_PATH);
const lock = readJson(LOCK_PATH);
const calibration = readJson(CALIBRATION_PATH);
const audit = readJson(AUDIT_PATH);
const runtimeProtected = (contract.protectedArtifacts ?? []).map((relative) =>
  path.join(ROOT, relative),
);
for (const file of runtimeProtected) {
  ok(fs.existsSync(file), `missing protected artifact ${path.relative(ROOT, file)}`);
}
const runtimeProtectedBefore = Object.fromEntries(
  runtimeProtected.map((file) => [path.relative(ROOT, file), hashFile(file)]),
);

ok(lock.status === 'MODEL_SELECTED_AND_LOCKED_HOLDOUT_UNOPENED_NON_OPERATIONAL', 'Stage 2 lock state');
ok(lock.holdoutViewed === false, 'Stage 2 holdout seal');
ok(calibration.stage2ModelLockSha256 === hashFile(LOCK_PATH), 'Stage 2 calibration lock hash');
ok(audit.schemaVersion === 'walters-bw6-stage3-holdout-audit-v1', 'audit schema');
ok(audit.module === contract.module, 'audit module');
ok(audit.stage === 'BW6.3', 'audit stage');
ok(
  audit.status === contract.holdoutAcceptance.failState,
  'holdout must retain its fail-closed status',
);
for (const field of [
  'operational',
  'productionAuthority',
  'grahamFairMutationAllowed',
  'liveBoardMutationAllowed',
  'betStatusMutationAllowed',
  'stakeMutationAllowed',
  'marketViewed',
  'modelReselectionAllowed',
  'modelReselected',
]) {
  ok(audit[field] === false, `${field} must be false`);
}
ok(audit.holdoutViewed === true, 'holdout viewed status');
ok(audit.holdoutOutcomeFieldsRead === true, 'holdout outcome-read status');
ok(audit.nextStage === null, 'failed holdout cannot advance');

ok(audit.stage1ContractSha256 === hashFile(CONTRACT_PATH), 'audit Stage 1 hash');
ok(audit.stage2ModelLockSha256 === hashFile(LOCK_PATH), 'audit Stage 2 lock hash');
ok(audit.stage2CalibrationSha256 === hashFile(CALIBRATION_PATH), 'audit calibration hash');
ok(audit.builderSha256 === hashFile(BUILDER_PATH), 'audit builder hash');
ok(audit.selectedModelId === lock.selectedModel.modelId, 'selected model identity');
same(
  audit.distributions.selectedCalibrated,
  lock.selectedModel.frozenCategoryProbabilities,
  'selected distribution changed after lock',
);
same(Object.keys(audit.distributions.selectedCalibrated), CATEGORIES, 'selected categories');
same(Object.keys(audit.distributions.bookExactRounded), CATEGORIES, 'BOOK-EXACT categories');
same(Object.keys(audit.distributions.observedHoldout), CATEGORIES, 'observed categories');
for (const name of ['selectedCalibrated', 'bookExactRounded', 'observedHoldout']) {
  const distribution = audit.distributions[name];
  approximate(
    Object.values(distribution).reduce((total, value) => total + Number(value), 0),
    1,
    1e-8,
    `${name} distribution sum`,
  );
}

const games = audit.holdoutGames ?? [];
ok(games.length === 272, 'holdout game count');
ok(new Set(games.map((game) => game.gameId)).size === 272, 'holdout game uniqueness');
for (const game of games) {
  ok(game.season === 2025, `${game.gameId} holdout season`);
  ok(Number.isInteger(game.week), `${game.gameId} week`);
  ok(['HOME', 'AWAY', 'SPLIT'].includes(game.pregameFavoriteSide), `${game.gameId} favorite side`);
  ok(Number.isFinite(game.predictedHomeMargin), `${game.gameId} predicted home margin`);
  ok(Number.isInteger(game.actualHomeMargin), `${game.gameId} actual home margin`);
  const labelEntries = Object.entries(game.observedCategoryWeights ?? {});
  ok(labelEntries.length >= 1 && labelEntries.length <= 2, `${game.gameId} label shape`);
  ok(labelEntries.every(([category]) => CATEGORIES.includes(category)), `${game.gameId} category`);
  approximate(
    labelEntries.reduce((total, [, weight]) => total + Number(weight), 0),
    1,
    1e-12,
    `${game.gameId} label sum`,
  );
}
ok(audit.sourceAudit?.priorSeasonsRead?.join(',') === '2023,2024', 'holdout prior seasons');
ok(audit.sourceAudit?.priorScoreRowsRead === 544, 'holdout prior score rows');
ok(audit.sourceAudit?.holdoutSeason === 2025, 'holdout source season');
ok(audit.sourceAudit?.holdoutScoreRowsRead === 272, 'holdout source rows');
ok(audit.sourceAudit?.marketFieldsPresent === false, 'source market fields');
ok(audit.sourceAudit?.marketInputsUsed === false, 'source market inputs');
ok(audit.orientationAudit?.games === 272, 'orientation game count');
ok(
  audit.orientationAudit.homeFavorite +
    audit.orientationAudit.awayFavorite +
    audit.orientationAudit.splitOrientation ===
    272,
  'orientation accounting',
);
ok(audit.orientationAudit?.targetGameScoresUsedForOrientation === false, 'target-score lookahead');
ok(audit.orientationAudit?.futureGamesUsedForOrientation === false, 'future-game lookahead');
ok(audit.orientationAudit?.marketInputsUsed === false, 'orientation market isolation');

const observed = observedDistribution(games);
for (const category of CATEGORIES) {
  approximate(
    audit.distributions.observedHoldout[category],
    observed[category],
    1e-9,
    `observed distribution ${category}`,
  );
}
const selectedMetrics = evaluate(audit.distributions.selectedCalibrated, games);
const bookMetrics = evaluate(audit.distributions.bookExactRounded, games);
for (const metric of ['multiclassLogLoss', 'multiclassBrierScore']) {
  approximate(
    audit.metrics.selectedCalibrated[metric],
    selectedMetrics[metric],
    1e-9,
    `selected ${metric}`,
  );
  approximate(
    audit.metrics.bookExactRounded[metric],
    bookMetrics[metric],
    1e-9,
    `BOOK-EXACT ${metric}`,
  );
  approximate(
    audit.metrics.selectedMinusBook[metric],
    selectedMetrics[metric] - bookMetrics[metric],
    1e-9,
    `selected-minus-book ${metric}`,
  );
}

const selectedAggregate = CATEGORIES.slice(0, 18).reduce(
  (total, category) => total + Number(audit.distributions.selectedCalibrated[category]),
  0,
);
const bookAggregate = CATEGORIES.slice(0, 18).reduce(
  (total, category) => total + Number(audit.distributions.bookExactRounded[category]),
  0,
);
const observedAggregate = CATEGORIES.slice(0, 18).reduce(
  (total, category) => total + Number(observed[category]),
  0,
);
const aggregateErrorPp = Math.abs(selectedAggregate - observedAggregate) * 100;
const aggregate = audit.metrics.aggregateOneThroughEighteen;
approximate(aggregate.selectedPredictedPercent, selectedAggregate * 100, 1e-6, 'selected aggregate');
approximate(aggregate.bookExactPredictedPercent, bookAggregate * 100, 1e-6, 'book aggregate');
approximate(aggregate.observedPercent, observedAggregate * 100, 1e-6, 'observed aggregate');
approximate(
  aggregate.selectedAbsoluteErrorPercentagePoints,
  aggregateErrorPp,
  1e-6,
  'aggregate error',
);
const [wilsonLow, wilsonHigh] = wilsonInterval(observedAggregate * games.length, games.length);
const diagnostic = aggregate.samplingDiagnostic;
approximate(diagnostic.holdoutWilson95LowPercent, wilsonLow * 100, 1e-6, 'aggregate Wilson low');
approximate(diagnostic.holdoutWilson95HighPercent, wilsonHigh * 100, 1e-6, 'aggregate Wilson high');
ok(diagnostic.selectedPredictionInsideHoldoutWilson95 === true, 'selected aggregate Wilson diagnostic');
ok(diagnostic.diagnosticOnlyNoGateOverride === true, 'diagnostic cannot override gate');

ok(audit.perMargin?.length === 18, 'per-margin audit count');
same(
  audit.perMargin.map((row) => row.margin),
  Array.from({length: 18}, (_, index) => index + 1),
  'per-margin identity',
);
for (const row of audit.perMargin) {
  const key = String(row.margin);
  approximate(row.observedPercent, observed[key] * 100, 1e-6, `margin ${key} observed`);
  approximate(
    row.selectedPredictedPercent,
    Number(audit.distributions.selectedCalibrated[key]) * 100,
    1e-6,
    `margin ${key} selected`,
  );
  ok(row.developmentSupportStatus === 'CURRENT_SUPPORTED', `margin ${key} support`);
}

const thresholds = contract.holdoutAcceptance.numericThresholds;
const logLossDelta = selectedMetrics.multiclassLogLoss - bookMetrics.multiclassLogLoss;
const brierDelta = selectedMetrics.multiclassBrierScore - bookMetrics.multiclassBrierScore;
const expectedPass = new Map([
  ['BW6H-MODEL-LOCK-PREEXISTED', true],
  ['BW6H-GAME-ACCOUNTING', true],
  ['BW6H-DISTRIBUTIONS', true],
  ['BW6H-LOG-LOSS', logLossDelta <= thresholds.maximumLogLossWorseThanBook + EPSILON],
  ['BW6H-BRIER', brierDelta <= thresholds.maximumBrierScoreWorseThanBook + EPSILON],
  [
    'BW6H-AGGREGATE-CALIBRATION',
    aggregateErrorPp <=
      thresholds.maximumAggregateOneThroughEighteenCalibrationErrorPercentagePoints + EPSILON,
  ],
  ['BW6H-MARGIN-AUDIT', true],
  ['BW6H-UNSUPPORTED-FAIL-CLOSED', true],
  ['BW6H-MARKET-ISOLATION', true],
  ['BW6H-PROTECTED-ARTIFACTS', true],
]);
same(
  audit.acceptanceChecks.map((check) => check.id),
  [...expectedPass.keys()],
  'acceptance check identities',
);
for (const check of audit.acceptanceChecks) {
  ok(check.pass === expectedPass.get(check.id), `${check.id} pass result`);
}
const failedIds = audit.acceptanceChecks.filter((check) => !check.pass).map((check) => check.id);
same(failedIds, ['BW6H-AGGREGATE-CALIBRATION'], 'fail-closed reason');
same(
  audit.summary,
  {checks: 10, passed: 9, failed: 1, holdoutPass: false},
  'holdout summary',
);

same(
  audit.protectedArtifactSha256Before,
  audit.protectedArtifactSha256After,
  'protected capture before/after',
);
ok(audit.protectedArtifactsUnchanged === true, 'protected artifact status');
same(audit.frozenInputSha256Before, audit.frozenInputSha256After, 'frozen inputs before/after');
ok(audit.frozenInputSha256Before.stage2ModelLock === hashFile(LOCK_PATH), 'frozen lock hash');
ok(audit.frozenInputSha256Before.stage2Calibration === hashFile(CALIBRATION_PATH), 'frozen calibration hash');
const runtimeProtectedAfter = Object.fromEntries(
  runtimeProtected.map((file) => [path.relative(ROOT, file), hashFile(file)]),
);
same(runtimeProtectedAfter, runtimeProtectedBefore, 'validator changed protected artifacts');

console.log(
  `WALTERS BW6 STAGE 3 VERIFY: PASS // HOLDOUT CORRECTLY FAIL-CLOSED 9/10 // ` +
    `LOG LOSS Δ ${logLossDelta.toFixed(6)} // BRIER Δ ${brierDelta.toFixed(6)} // ` +
    `AGG ERROR ${aggregateErrorPp.toFixed(3)}pp > 3.000pp // NO STAGE 4 AUTHORITY`,
);

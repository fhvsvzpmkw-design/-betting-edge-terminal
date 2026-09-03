#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONTRACT_PATH = path.join(ROOT, 'data/walters/nfl/key-numbers/bw6-stage3r2-contract-v1.json');
const BUILDER_PATH = path.join(ROOT, 'tools/build-walters-bw6-stage3r2.py');
const STAGE1_PATH = path.join(ROOT, 'data/walters/nfl/key-numbers/bw6-stage1-contract-v1.json');
const STAGE2_PATH = path.join(ROOT, 'data/walters/nfl/key-numbers/bw6-stage2-calibration-v1.json');
const EPSILON = 1e-8;
const NINE_DECIMAL_HALF_UNIT = 0.5000001e-9;
const SIX_DECIMAL_HALF_UNIT = 0.5000001e-6;
const CATEGORIES = [...Array.from({length: 18}, (_, index) => String(index + 1)), 'OTHER'];
const EXACT = CATEGORIES.slice(0, 18);
const DEVELOPMENT = [2015, 2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024];
const SEASON_GAMES = new Map([
  [2015, 256], [2016, 256], [2017, 256], [2018, 256], [2019, 256],
  [2021, 272], [2022, 271], [2023, 272], [2024, 272],
]);
const FOLDS = [
  {validationSeason: 2016, trainingSeasons: [2015]},
  {validationSeason: 2017, trainingSeasons: [2015, 2016]},
  {validationSeason: 2018, trainingSeasons: [2015, 2016, 2017]},
  {validationSeason: 2019, trainingSeasons: [2015, 2016, 2017, 2018]},
  {validationSeason: 2021, trainingSeasons: [2015, 2016, 2017, 2018, 2019]},
  {validationSeason: 2022, trainingSeasons: [2015, 2016, 2017, 2018, 2019, 2021]},
  {validationSeason: 2023, trainingSeasons: [2015, 2016, 2017, 2018, 2019, 2021, 2022]},
  {validationSeason: 2024, trainingSeasons: [2015, 2016, 2017, 2018, 2019, 2021, 2022, 2023]},
];
const CANDIDATES = [
  {candidateId: 'R2_FULL_DIRICHLET19', seasonWeightFamily: 'FULL', smoothingFamily: 'DIRICHLET19'},
  {candidateId: 'R2_ROLLING4_DIRICHLET19', seasonWeightFamily: 'ROLLING4', smoothingFamily: 'DIRICHLET19'},
  {candidateId: 'R2_EXP_HL4_DIRICHLET19', seasonWeightFamily: 'EXP_HL4', smoothingFamily: 'DIRICHLET19'},
  {candidateId: 'R2_FULL_BETA_DIRICHLET', seasonWeightFamily: 'FULL', smoothingFamily: 'BETA_DIRICHLET'},
  {candidateId: 'R2_ROLLING4_BETA_DIRICHLET', seasonWeightFamily: 'ROLLING4', smoothingFamily: 'BETA_DIRICHLET'},
  {candidateId: 'R2_EXP_HL4_BETA_DIRICHLET', seasonWeightFamily: 'EXP_HL4', smoothingFamily: 'BETA_DIRICHLET'},
];
const PRIORITY = [
  'R2_FULL_DIRICHLET19',
  'R2_FULL_BETA_DIRICHLET',
  'R2_ROLLING4_DIRICHLET19',
  'R2_ROLLING4_BETA_DIRICHLET',
  'R2_EXP_HL4_DIRICHLET19',
  'R2_EXP_HL4_BETA_DIRICHLET',
];
const PRIOR_PATHS = [
  '.github/workflows/walters-bw6-stage1.yml',
  '.github/workflows/walters-bw6-stage2.yml',
  '.github/workflows/walters-bw6-stage3.yml',
  '.github/workflows/walters-bw6-stage3r1.yml',
  'data/walters/nfl/key-numbers/bw6-stage1-contract-v1.json',
  'data/walters/nfl/key-numbers/bw6-stage2-calibration-v1.json',
  'data/walters/nfl/key-numbers/bw6-stage2-model-lock-v1.json',
  'data/walters/nfl/key-numbers/bw6-stage3-holdout-audit-v1.json',
  'data/walters/nfl/key-numbers/bw6-stage3r1-diagnosis-contract-v1.json',
  'data/walters/nfl/key-numbers/bw6-stage3r1-recalibration-diagnosis-v1.json',
  'tests/walters-bw6-stage1.test.mjs',
  'tests/walters-bw6-stage2.test.mjs',
  'tests/walters-bw6-stage3.test.mjs',
  'tests/walters-bw6-stage3r1.test.mjs',
  'tools/build-walters-bw6-stage2.py',
  'tools/build-walters-bw6-stage3.py',
  'tools/build-walters-bw6-stage3r1.py',
  'tools/validate-walters-bw6-stage1.mjs',
  'tools/validate-walters-bw6-stage2.mjs',
  'tools/validate-walters-bw6-stage3.mjs',
  'tools/validate-walters-bw6-stage3r1.mjs',
];
const PRIOR_HASHES = {
  '.github/workflows/walters-bw6-stage1.yml': '84d1a85a144878233656cf4ae0fb8eefb9e3ed866249ae67fd78c1bd90d317bb',
  '.github/workflows/walters-bw6-stage2.yml': 'f74e9a8c48227ee977b0997f1fe46fadc2d6fb3a12f271724f1f985be555c2f9',
  '.github/workflows/walters-bw6-stage3.yml': 'f49f3bbc50859455449fe08a8109f5d1aa44a8e93693e93196fbf6e3eef6a331',
  '.github/workflows/walters-bw6-stage3r1.yml': 'ba7e06320bb85bbe14f5db793108d068763aff530eebe45b50248a6ad5e145f6',
  'data/walters/nfl/key-numbers/bw6-stage1-contract-v1.json': 'b8dda9eab7ad92a93db3abec5698f041108d3937cef63d56fc87b1f5fe77146f',
  'data/walters/nfl/key-numbers/bw6-stage2-calibration-v1.json': 'af835e502492fea6489e9687d3fbaa28620455d1e3a3a5beb527343e13e0c897',
  'data/walters/nfl/key-numbers/bw6-stage2-model-lock-v1.json': 'd6b6c40fad6caefb5a6fd0d42d8a81341ac09f319612ed446c99df991e2c7151',
  'data/walters/nfl/key-numbers/bw6-stage3-holdout-audit-v1.json': 'c9fac3870c15b5ac4c780c5777e26997a267b109335669dd0d14d97b427fd51a',
  'data/walters/nfl/key-numbers/bw6-stage3r1-diagnosis-contract-v1.json': '70dd281d5699623f936633521ba70f1837b331143a512c10f0a9405bfb9a100b',
  'data/walters/nfl/key-numbers/bw6-stage3r1-recalibration-diagnosis-v1.json': '3adfd753fe13ab38f237f9a4d8876feb25e5bd79bb4fbadfbef13a647e214200',
  'tests/walters-bw6-stage1.test.mjs': '09f91582c6c5239bc8be4e9b9ae9ef2f659c6d6c691704ec8107078d1e98689a',
  'tests/walters-bw6-stage2.test.mjs': '967a0737ed11f966216e24b35e2eb12c3a54410cf74b694eb9f19fe5c756a66b',
  'tests/walters-bw6-stage3.test.mjs': '8a91ce0238e362b1926af285db368c4997230f0574245ef58d36c1d017c1d4a1',
  'tests/walters-bw6-stage3r1.test.mjs': 'd33abef3da8a51bd6ca7f4ea5bfd3aa71d0af7392e1391df219786d42748cad0',
  'tools/build-walters-bw6-stage2.py': 'f943cda2a77f02cea2cf5e859ddff218113fdbd5c79e74da57d4161be5931339',
  'tools/build-walters-bw6-stage3.py': '72db23e7284956a24b66eca14d5ccf3fb7965fe711c88ec1ea01645dfd510075',
  'tools/build-walters-bw6-stage3r1.py': 'f91a5ca03a1b1602adacfa89ed15df014fd510ca25cc787add668e0cb6d81d2b',
  'tools/validate-walters-bw6-stage1.mjs': 'f15bf6c356b76d1f31800406ead67a305ce1be679c6aeddf1b590c2f59da2788',
  'tools/validate-walters-bw6-stage2.mjs': '02bc79ce4c0f34e9f115ad29a659329bedb3bbf116d01420ab9c005b8fc4cb8c',
  'tools/validate-walters-bw6-stage3.mjs': '78cf1f5d69da7dbd6823c7bb2df78702f645d773cbc2b6f0799dbb305b6e847c',
  'tools/validate-walters-bw6-stage3r1.mjs': '849c884c8d0457e09cf9b87d1e86169f4113eab75ed5c3183f1a00b5d0da80fa',
};
const PROTECTED_PATHS = [
  'core/walters-authority-v1.4.json',
  'core/walters-intelligence-interface-v1.4.json',
  'data/live-odds.json',
  'data/walters/nfl/active-week.json',
  'data/walters/nfl/2026/week-01-current-numbers.json',
  'data/walters/nfl/2026/week-01-personnel-ledger.json',
  'data/walters/nfl/current-week-terminal.json',
  'data/walters/nfl-power-ratings-ledger.json',
  'data/walters/nfl/home-field/home-field-production-current.json',
  'data/walters/nfl/personnel-production-current.json',
  'data/walters/nfl/matchup-production-current.json',
  'data/walters/nfl/qb-production-current.json',
  'data/walters/nfl/qb-production/production-contract-v1.json',
];
const PROTECTED_HASHES = {
  'core/walters-authority-v1.4.json': 'e55bb315baf6c5d5501d7419b21ecf81a0b9143e0da07df0b6047effbf7300dc',
  'core/walters-intelligence-interface-v1.4.json': '3972a55ff3ca039d2098c4e257340ec7d209faf859a76db96d0ce44d80ea6cf9',
  'data/live-odds.json': '99b7d6c92db9e7743a7cf5f3b41f96aa18c1859026344d1767bf4ac55c95ff0e',
  'data/walters/nfl/active-week.json': '055530b04c35d53a09f1de4fe1791e6194f4ea35856cf958cef82d79525801ca',
  'data/walters/nfl/2026/week-01-current-numbers.json': '615588fba2de98f7455927054d8578458f39627ef4915231c8bcd1f23e6bdcff',
  'data/walters/nfl/2026/week-01-personnel-ledger.json': '422cca9900630e9fd8f1e4305a5026c2594dbc8346f7ea3d93ea970d1032d166',
  'data/walters/nfl/current-week-terminal.json': 'e99f73c9d418236caac7defa35b0787a9b874ae55f7eaac01cfde7fd05ca546c',
  'data/walters/nfl-power-ratings-ledger.json': 'd1d2add2766fbcefe0b614bc1720643ba0d4997da8d6cde8e839e6127ae934ef',
  'data/walters/nfl/home-field/home-field-production-current.json': '4e06d109d392af0b6c974a34f37ce25f62839aec08473428bd062059f6568e38',
  'data/walters/nfl/personnel-production-current.json': 'f390f80fd921a738d76d2905bfaf63c8be7921600928c160a2d31bf8b55e8641',
  'data/walters/nfl/matchup-production-current.json': 'caeb47aef50520cb02e3e8b5e7911cf02663dacbec40352d3783b3f7f880de91',
  'data/walters/nfl/qb-production-current.json': 'fd477532084da220c61f15f924435836643a5421982f83df372728281e9cc571',
  'data/walters/nfl/qb-production/production-contract-v1.json': 'f969e360922bf7c4751c37c485df4e4671063fca13ea28af1c7ea4b69e366992',
};
const RELEASE_PATHS = [
  'tools/build-walters-bw6-stage3r2.py',
  'tools/validate-walters-bw6-stage3r2.mjs',
  'tests/walters-bw6-stage3r2.test.mjs',
  '.github/workflows/walters-bw6-stage3r2.yml',
];

function fail(message) {
  throw new Error('WALTERS BW6 STAGE 3R2 VERIFY FAILED // ' + message);
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

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key])]));
  }
  return value;
}

function same(actual, expected, message) {
  ok(JSON.stringify(normalize(actual)) === JSON.stringify(normalize(expected)), message);
}

function approximate(actual, expected, tolerance, message) {
  ok(Number.isFinite(Number(actual)), message + ': not finite');
  ok(Math.abs(Number(actual) - Number(expected)) <= tolerance, message);
}

function rounded(value, digits = 9) {
  return Number(Number(value).toFixed(digits));
}

function canonicalStringify(value) {
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalStringify).join(',') + ']';
  }
  if (value && typeof value === 'object') {
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ':' + canonicalStringify(value[key]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

function digest(value) {
  return crypto.createHash('sha256').update(canonicalStringify(value)).digest('hex');
}

function isSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function unique(values, message) {
  ok(new Set(values).size === values.length, message);
}

function unambiguousLessThanOrEqual(left, right, uncertainty, message) {
  ok(Math.abs(Number(left) - Number(right)) > uncertainty, message + ': rounded boundary ambiguity');
  return Number(left) < Number(right);
}

function serializedTo(value, digits, message) {
  ok(Number(value) === rounded(value, digits), message + ': serialization precision');
}

function seasonWeights(family, seasons) {
  if (family === 'FULL') return Object.fromEntries(seasons.map((season) => [season, 1]));
  if (family === 'ROLLING4') {
    return Object.fromEntries(seasons.slice(-4).map((season) => [season, 1]));
  }
  if (family === 'EXP_HL4') {
    const latest = Math.max(...seasons);
    return Object.fromEntries(seasons.map((season) => [season, 0.5 ** ((latest - season) / 4)]));
  }
  fail('unknown season family ' + family);
}

function fitShape(family, seasons) {
  const weights = seasonWeights(family, seasons);
  let rawGames = 0;
  let weightedGames = 0;
  let squared = 0;
  for (const [seasonText, weight] of Object.entries(weights)) {
    const games = SEASON_GAMES.get(Number(seasonText));
    ok(Number.isInteger(games), 'missing season game count ' + seasonText);
    rawGames += games;
    weightedGames += games * weight;
    squared += games * weight ** 2;
  }
  return {
    eligibleSeasons: Object.keys(weights).map(Number),
    seasonWeights: Object.fromEntries(
      Object.entries(weights).map(([season, weight]) => [season, rounded(weight)]),
    ),
    rawGames,
    weightedGames,
    effectiveGames: weightedGames ** 2 / squared,
  };
}

function wilson(events, games, z = 1.95996398454) {
  const p = Math.min(1, Math.max(0, Number(events) / Number(games)));
  const denominator = 1 + z ** 2 / games;
  const center = (p + z ** 2 / (2 * games)) / denominator;
  const margin =
    (z * Math.sqrt((p * (1 - p)) / games + z ** 2 / (4 * games ** 2))) / denominator;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

function foldAggregate(folds) {
  const games = folds.reduce((sum, fold) => sum + Number(fold.games), 0);
  const weighted = (field) =>
    folds.reduce((sum, fold) => sum + Number(fold[field]) * Number(fold.games), 0) / games;
  const absoluteErrors = folds.map((fold) =>
    Math.abs(Number(fold.aggregateSignedErrorPercentagePoints)),
  );
  const expectedEvents = folds.reduce(
    (sum, fold) => sum + Number(fold.aggregatePredictedProbability) * Number(fold.games),
    0,
  );
  const observedEvents = folds.reduce((sum, fold) => sum + Number(fold.observedEvents), 0);
  return {
    games,
    meanMulticlassLogLoss: weighted('multiclassLogLoss'),
    meanMulticlassBrierScore: weighted('multiclassBrierScore'),
    meanAggregateBinaryLogLoss: weighted('aggregateBinaryLogLoss'),
    meanAggregateBinaryBrierScore: weighted('aggregateBinaryBrierScore'),
    meanAbsoluteAggregateErrorPercentagePoints:
      absoluteErrors.reduce((sum, value) => sum + value, 0) / folds.length,
    rootMeanSquareAggregateErrorPercentagePoints:
      Math.sqrt(absoluteErrors.reduce((sum, value) => sum + value ** 2, 0) / folds.length),
    pooledSignedAggregateErrorPercentagePoints:
      ((expectedEvents - observedEvents) / games) * 100,
    maximumAbsoluteAggregateErrorPercentagePoints: Math.max(...absoluteErrors),
    wilsonCompatibleFolds:
      folds.filter((fold) => fold.aggregatePredictionInsideWilson95).length,
    totalFolds: folds.length,
  };
}

function fairCosts(probability) {
  const p = Number(probability);
  const q = 110 / 210;
  ok(p >= 0 && p < 1 - q, 'half-point probability domain');
  const onto = (100 * q) / (1 - q - p) - 110;
  const off = (100 * (q * (1 - p) + p)) / ((1 - q) * (1 - p)) - 110;
  return {
    buyOntoLossToPushExactUsdPer100: rounded(onto, 6),
    buyOntoLossToPushDisplayUsdPer100: Math.floor(onto + 0.5),
    buyOffPushToWinExactUsdPer100: rounded(off, 6),
    buyOffPushToWinDisplayUsdPer100: Math.floor(off + 0.5),
  };
}

for (const file of [CONTRACT_PATH, BUILDER_PATH, STAGE1_PATH, STAGE2_PATH]) {
  ok(fs.existsSync(file), 'missing ' + path.relative(ROOT, file));
}
const contract = readJson(CONTRACT_PATH);
const stage1 = readJson(STAGE1_PATH);
const stage2 = readJson(STAGE2_PATH);

ok(contract.schemaVersion === 'walters-bw6-stage3r2-contract-v1', 'contract schema');
ok(contract.module === 'WALTERS_BW6_POINT_WEIGHT_CALIBRATION', 'contract module');
ok(contract.stage === 'BW6.3R2', 'contract stage');
ok(
  contract.status === 'BW6_3R2_DEVELOPMENT_ONLY_RECALIBRATION_CONTRACT_LOCKED_NON_OPERATIONAL',
  'contract status',
);
same(contract.prospectiveCutoff, {
  lockedAt: '2026-09-03T14:37:15Z',
  baseCommit: 'd7ac56cb83503ca094d414672941bfe0e5b2c93d',
  rule:
    'Every R2 candidate, fold, metric, threshold, selection rule and BW6.4 cycle requirement is fixed before the R2 builder evaluates the expanded development folds.',
  evidenceTimestampRule:
    "Every deterministic R2 evidence output uses this contract's generatedAt timestamp exactly; wall-clock time and prior output content are not inputs.",
}, 'prospective cutoff');
ok(contract.generatedAt === contract.prospectiveCutoff.lockedAt, 'deterministic contract timestamp');
ok(contract.authoredAfter2025HoldoutViewed === true, 'post-holdout disclosure');
for (const field of [
  'operational',
  'productionAuthority',
  'grahamFairMutationAllowed',
  'liveBoardMutationAllowed',
  'betStatusMutationAllowed',
  'stakeMutationAllowed',
  'marketInputsAllowed',
]) {
  ok(contract[field] === false, 'contract ' + field);
}

const boundary = contract.outcomeUseBoundary;
same(boundary.developmentSeasons, DEVELOPMENT, 'development seasons');
same(boundary.contextOnlySeasons, [2014], 'context seasons');
same(boundary.excludedOutcomeSeasons, [2020, 2025, 2026], 'excluded seasons');
ok(
  boundary.season2025Role ===
    'EXPOSED_DIAGNOSTIC_ONLY_ZERO_OUTCOME_ROWS_PASSED_TO_R2_FIT_OR_SELECTION',
  '2025 role',
);
ok(
  boundary.season2026Role ===
    'PROSPECTIVE_ZERO_OUTCOME_ROWS_PASSED_TO_R2_FIT_OR_SELECTION',
  '2026 role',
);
ok(
  !JSON.stringify(contract).includes('ZERO_ROWS_AVAILABLE_TO_R2_BUILDER'),
  'obsolete outcome-use wording remains in contract',
);
ok(boundary.holdoutOrProspectiveOutcomeRowsUsedForFit === 0, 'contract fit rows');
ok(boundary.holdoutOrProspectiveOutcomeRowsUsedForSelection === 0, 'contract selection rows');
ok(boundary.priorHoldoutKnownToDesigners === true, 'known holdout disclosure');
ok(boundary.stage3DispositionMayBeOverridden === false, 'Stage 3 override');
ok(boundary.originalThreePointGateMayBeWaived === false, 'three-point waiver');

ok(contract.sourceSnapshot.path === stage1.historicalDataContract.sourceSnapshot.path, 'source path');
ok(contract.sourceSnapshot.sha256 === stage1.historicalDataContract.sourceSnapshot.sha256, 'source hash binding');
ok(contract.sourceSnapshot.marketFieldsAllowed === false, 'source market boundary');
const sourcePath = path.join(ROOT, contract.sourceSnapshot.path);
ok(hashFile(sourcePath) === contract.sourceSnapshot.sha256, 'current source hash');
const header = fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/, 1)[0].split(',');
same(header, stage1.historicalDataContract.fieldWhitelist, 'source whitelist');
for (const field of stage1.historicalDataContract.forbiddenFields) {
  ok(!header.includes(field), 'forbidden source field ' + field);
}

same(contract.expandedForwardFolds, FOLDS, 'forward folds');
for (const fold of contract.expandedForwardFolds) {
  ok(fold.trainingSeasons.every((season) => season < fold.validationSeason), 'fold chronology');
}
const spec = contract.candidateSpecification;
same(spec.categories.map(String), CATEGORIES, 'candidate categories');
ok(spec.referenceCandidateId === 'R2_FULL_DIRICHLET19', 'reference candidate');
ok(spec.referenceBinding.stage2ModelId === 'BW6_FULL_DEVELOPMENT_POOL', 'reference model binding');
ok(spec.referenceBinding.stage2CalibrationPath === path.relative(ROOT, STAGE2_PATH), 'reference path');
ok(spec.referenceBinding.mustRemainByteEquivalent === true, 'reference byte-equivalence rule');
same(spec.candidates, CANDIDATES, 'candidate set');
same(spec.fixedPriorityOrder, PRIORITY, 'candidate priority');
unique(spec.candidates.map((candidate) => candidate.candidateId), 'duplicate candidate');
unique(spec.fixedPriorityOrder, 'duplicate priority');
same(spec.seasonWeightFamilies.map((family) => [family.id, family.stage2ModelId]), [
  ['FULL', 'BW6_FULL_DEVELOPMENT_POOL'],
  ['ROLLING4', 'BW6_ROLLING_FOUR_ELIGIBLE_SEASONS'],
  ['EXP_HL4', 'BW6_EXPONENTIAL_SEASON_DECAY_HL4'],
], 'weight families');
same(spec.smoothingFamilies.map((family) => family.id), ['DIRICHLET19', 'BETA_DIRICHLET'], 'smoothing families');
ok(spec.smoothingFamilies[0].alphaPerCategory === 0.5, 'Dirichlet alpha');
ok(spec.smoothingFamilies[1].aggregateAlpha === 0.5, 'Beta aggregate alpha');
ok(spec.smoothingFamilies[1].otherAlpha === 0.5, 'Beta OTHER alpha');
ok(spec.smoothingFamilies[1].conditionalMarginAlpha === 0.5, 'conditional alpha');

const evaluation = contract.evaluation;
same(evaluation.multiclassMetrics, ['meanLogLoss', 'meanBrierScore'], 'multiclass metrics');
same(evaluation.aggregateBinaryMetrics, [
  'meanLogLoss',
  'meanBrierScore',
  'meanAbsoluteErrorPercentagePoints',
  'pooledSignedErrorPercentagePoints',
], 'aggregate metrics');
same(evaluation.metricAggregationRules, {
  scoreMetrics:
    "Weight each validation game's log-loss and Brier contribution equally, equivalent to weighting fold means by validation-game count.",
  aggregateMeanAbsoluteAndRootMeanSquareErrors:
    "Weight each of the eight validation folds equally after computing that fold's aggregate signed error in percentage points.",
  pooledSignedAggregateError:
    'Sum predicted aggregate events and observed aggregate events across all validation games, divide their difference by total validation games, then multiply by 100.',
}, 'metric aggregation rules');
same(evaluation.calculationPrecisionRules, {
  gatesDeltasAndSelection:
    'Use unrounded binary64 calculation values. Rounded serialized fields must never drive eligibility, materiality, ordering or selection.',
  halfPointFairCosts:
    'Compute from the unrounded selected margin probability; serialize the probability to nine decimal places, percentages to six decimal places and monetary exact costs to six decimal places.',
  reportedFoldAndAggregateMetrics:
    'Serialize probability and score metrics to nine decimal places and percentage-point robustness summaries to six decimal places.',
}, 'calculation precision rules');
same(evaluation.predictiveCompatibility, {
  method: "Candidate aggregate probability must fall inside the validation season's Wilson 95% interval.",
  minimumCompatibleFolds: 7,
  totalFolds: 8,
}, 'predictive compatibility');
same(evaluation.seasonBlockRobustness, {
  leaveOneEligibleSeasonOut: true,
  leaveOneEligibleSeasonOutMethod:
    "For each of the nine development seasons, remove that season from the full eligible-season list and refit the candidate's declared season-weight family; rolling windows may therefore admit the next-most-recent remaining season.",
  bootstrapReplicates: 5000,
  bootstrapSeed: 20260903,
  bootstrapUnit: 'eligible season block',
  bootstrapMethod:
    "Sample nine development-season identities with replacement. Reapply the candidate's declared season-weight family to the unique sampled seasons, then multiply each selected family weight by that season's sampled multiplicity.",
  bootstrapInterval: [0.025, 0.975],
  bootstrapQuantileMethod:
    'Sort replicate values and linearly interpolate at zero-based position (replicateCount - 1) * probability.',
  maximum95HalfWidthDefinition:
    'The larger of fullEstimate - lowerEndpoint and upperEndpoint - fullEstimate.',
}, 'robustness specification');
same(evaluation.candidateEligibilityThresholds, {
  distributionSumTolerance: 1e-9,
  maximumMulticlassLogLossWorseThanReference: 0.002,
  maximumMulticlassBrierScoreWorseThanReference: 0.001,
  maximumAggregateBinaryLogLossWorseThanReference: 0.002,
  maximumAggregateBinaryBrierScoreWorseThanReference: 0.001,
  maximumAbsolutePooledAggregateErrorPercentagePoints: 2,
  maximumLeaveOneSeasonOutAggregateRangePercentagePoints: 2,
  maximumBootstrap95HalfWidthPercentagePoints: 3,
}, 'eligibility thresholds');
same(evaluation.materialReplacementThresholds, {
  minimumMulticlassLogLossImprovement: 0.005,
  minimumMulticlassBrierScoreImprovement: 0.002,
  minimumMeanAbsoluteAggregateErrorImprovementPercentagePoints: 0.25,
  rule:
    'A challenger replaces an eligible reference only if it passes every eligibility gate and improves all three listed measures by at least the locked amounts.',
}, 'material replacement thresholds');
ok(
  evaluation.selectionRule ===
    'If the reference is eligible, retain it unless a challenger satisfies every material-replacement threshold. If multiple challengers qualify, sort by multiclass log loss, multiclass Brier score, aggregate mean absolute error and fixed priority. If the reference is ineligible, select the eligible candidate using that same sort. If no candidate is eligible, fail closed.',
  'selection rule',
);
ok(evaluation.referenceRetentionIsPermitted === true, 'reference retention');
ok(evaluation.replacementIsRequired === false, 'replacement requirement');

const shadowPlan = contract.bw6Stage4ProspectiveShadowPlan;
same(shadowPlan, {
  authorizedOnlyIfR2Passes: true,
  authorizedStage: 'BW6.4_PROSPECTIVE_ACTIVE_WEEK_SHADOW',
  minimumConsecutiveCleanCycles: 3,
  maximumQualifyingCyclesPerPacificCalendarDate: 1,
  minimumScheduledCycles: 2,
  distinctImmutableInputSnapshotsRequired: true,
  minimumChangedActiveWeekOrCurrentNumbersHashes: 1,
  identicalManualRerunsCount: false,
  failedOrIncompleteCycleResetsConsecutiveCount: true,
  cyclePurpose: 'Execution stability only; cycles do not provide statistical calibration or production authority.',
  threeCycleState: 'BW6_4_THREE_CYCLE_SHADOW_VALIDATED_PROSPECTIVE_OUTCOME_GATE_PENDING_NON_OPERATIONAL',
  allowedInput: 'Current Graham fair margin solely to identify relevant exact-number rows; no sportsbook or recommendation fields.',
  allowedOutput: 'Read-only side-by-side BOOK-EXACT, Stage 2 and R2 weights and fair half-point costs.',
  prohibitedOutput: [
    'Graham fair mutation',
    'QB or embedded baseline mutation',
    'uncertainty-overlay mutation',
    'weighted advantage',
    'cross-zero deduction',
    'star or play threshold',
    'market normalization',
    'BET, LEAN, WAIT or PASS mutation',
    'stake mutation',
  ],
}, 'three-cycle shadow plan');

same(contract.priorArtifactManifest.map((item) => item.path), PRIOR_PATHS, 'prior paths');
same(
  contract.priorArtifactManifest,
  PRIOR_PATHS.map((relative) => ({path: relative, sha256: PRIOR_HASHES[relative]})),
  'locked prior artifact manifest',
);
unique(PRIOR_PATHS, 'duplicate prior paths');
for (const item of contract.priorArtifactManifest) {
  ok(isSha(item.sha256), 'invalid prior hash ' + item.path);
  ok(hashFile(path.join(ROOT, item.path)) === item.sha256, 'frozen prior hash ' + item.path);
}
same(contract.protectedArtifacts, PROTECTED_PATHS, 'protected paths');
same(contract.protectedArtifactSha256, PROTECTED_HASHES, 'locked protected hash baseline');
same(Object.keys(contract.protectedArtifactSha256), PROTECTED_PATHS, 'protected hash paths');
for (const relative of PROTECTED_PATHS) {
  ok(fs.existsSync(path.join(ROOT, relative)), 'missing protected artifact ' + relative);
  ok(isSha(contract.protectedArtifactSha256[relative]), 'invalid protected hash ' + relative);
}
same(contract.outcomeStates, {
  pass: 'BW6_3R2_CANDIDATE_SELECTED_FOR_BW6_4_PROSPECTIVE_SHADOW_ONLY_NON_OPERATIONAL',
  freeze: 'BW6_3R2_CANDIDATE_AND_PROSPECTIVE_PLAN_HASH_FROZEN',
  fail: 'BW6_3R2_FAIL_CLOSED_NO_PROSPECTIVE_SHADOW_CANDIDATE',
  nextStageOnPass: 'BW6.4_PROSPECTIVE_ACTIVE_WEEK_SHADOW',
  blockedRegardlessOfPass: ['BW7', 'BW8', 'PRODUCTION_AUTHORITY'],
}, 'outcome states');
same(contract.outputs, {
  developmentAudit: 'data/walters/nfl/key-numbers/bw6-stage3r2-development-audit-v1.json',
  modelFreeze: 'data/walters/nfl/key-numbers/bw6-stage3r2-model-freeze-v1.json',
}, 'output paths');

const auditPath = path.join(ROOT, contract.outputs.developmentAudit);
const freezePath = path.join(ROOT, contract.outputs.modelFreeze);
ok(fs.existsSync(auditPath), 'missing development audit');
const audit = readJson(auditPath);

ok(audit.schemaVersion === 'walters-bw6-stage3r2-development-audit-v1', 'audit schema');
ok(audit.module === contract.module, 'audit module');
ok(audit.stage === 'BW6.3R2', 'audit stage');
ok(audit.generatedAt === contract.generatedAt, 'audit deterministic timestamp');
ok(
  !JSON.stringify(audit).includes('ZERO_ROWS_AVAILABLE_TO_R2_BUILDER'),
  'obsolete outcome-use wording remains in audit',
);
for (const field of [
  'operational',
  'productionAuthority',
  'grahamFairMutationAllowed',
  'liveBoardMutationAllowed',
  'betStatusMutationAllowed',
  'stakeMutationAllowed',
  'marketViewed',
  'weightedAdvantageAllowed',
  'crossZeroDeductionAllowed',
  'marketNormalizationAllowed',
  'originalStage3FailureOverridden',
  'originalThreePointGateWaived',
]) {
  ok(audit[field] === false, 'audit ' + field);
}
ok(audit.r2Contract === path.relative(ROOT, CONTRACT_PATH), 'audit contract path');
ok(audit.r2ContractSha256 === hashFile(CONTRACT_PATH), 'audit contract hash');
ok(audit.builder === path.relative(ROOT, BUILDER_PATH), 'audit builder path');
ok(audit.builderSha256 === hashFile(BUILDER_PATH), 'audit builder hash');
ok(audit.sourceSnapshotSha256 === contract.sourceSnapshot.sha256, 'audit source hash');
same(
  audit.priorArtifactSha256,
  Object.fromEntries(contract.priorArtifactManifest.map((item) => [item.path, item.sha256])),
  'audit prior hashes',
);
ok(audit.priorArtifactsUnchanged === true, 'prior-artifact state');
ok(
  audit.protectedArtifactBaselineRole ===
    'HISTORICAL_ISSUANCE_SNAPSHOT_AT_PROSPECTIVE_CUTOFF',
  'audit protected-baseline role',
);
same(
  audit.issuanceProtectedArtifactSha256,
  contract.protectedArtifactSha256,
  'audit protected issuance hashes',
);
ok(audit.runtimeProtectedArtifactsUnchanged === true, 'runtime protected-artifact state');

const use = audit.outcomeUseAudit;
same(use.developmentSeasonsRead, DEVELOPMENT, 'audit development seasons');
ok(use.developmentOutcomeRowsRead === 2367, 'development row count');
same(use.contextOnlySeasonsUsedForOrientation, [2014], 'orientation context');
for (const field of [
  'season2020OutcomeRowsRead',
  'season2025OutcomeRowsRead',
  'season2026OutcomeRowsRead',
  'holdoutOrProspectiveRowsUsedForFit',
  'holdoutOrProspectiveRowsUsedForSelection',
]) {
  ok(use[field] === 0, 'outcome-use ' + field);
}
ok(use.priorHoldoutKnownToDesigners === true, 'audit known-holdout disclosure');
ok(use.sourceAudit.path === contract.sourceSnapshot.path, 'source-audit path');
ok(use.sourceAudit.sha256 === contract.sourceSnapshot.sha256, 'source-audit hash');
ok(use.sourceAudit.encounteredRows === 3435, 'source row accounting');
ok(use.sourceAudit.developmentGames === 2367, 'source development accounting');
ok(use.sourceAudit.contextGames === 256, 'source context accounting');
ok(use.sourceAudit.holdoutScoreFieldsRead === false, 'holdout score access');
ok(use.sourceAudit.marketFieldsPresent === false, 'source market fields');
ok(use.sourceAudit.skippedRowsByReason?.['2020_REG'] === 256, '2020 skip accounting');
ok(use.sourceAudit.skippedRowsByReason?.['2025_REG'] === 272, '2025 skip accounting');
ok(use.sourceAudit.skippedRowsByReason?.['2026_REG'] === 272, '2026 skip accounting');
ok(use.orientationAudit.developmentObservations === 2367, 'orientation accounting');
ok(use.orientationAudit.targetGameScoresUsedForOrientation === false, 'target-score lookahead');
ok(use.orientationAudit.futureGamesUsedForOrientation === false, 'future-game lookahead');
ok(use.orientationAudit.marketInputsUsed === false, 'orientation market use');
ok(isSha(audit.orderedDevelopmentObservationSha256), 'observation digest');
ok(audit.candidateSpecificationSha256 === digest(spec), 'candidate-spec digest');
ok(audit.prospectiveShadowPlanSha256 === digest(shadowPlan), 'shadow-plan digest');

same(
  audit.candidateEvaluations.map((row) => ({
    candidateId: row.candidateId,
    seasonWeightFamily: row.seasonWeightFamily,
    smoothingFamily: row.smoothingFamily,
  })),
  CANDIDATES,
  'audit candidate identities',
);
const rows = audit.candidateEvaluations;
const byId = new Map(rows.map((row) => [row.candidateId, row]));
const reference = byId.get(spec.referenceCandidateId);
ok(reference, 'missing reference evaluation');

for (const row of rows) {
  ok(row.folds.length === FOLDS.length, row.candidateId + ' fold count');
  for (let index = 0; index < FOLDS.length; index += 1) {
    const fold = row.folds[index];
    const locked = FOLDS[index];
    const training =
      row.seasonWeightFamily === 'ROLLING4'
        ? locked.trainingSeasons.slice(-4)
        : locked.trainingSeasons;
    ok(fold.validationSeason === locked.validationSeason, row.candidateId + ' validation season');
    same(fold.trainingSeasons, training, row.candidateId + ' training seasons');
    ok(fold.games === SEASON_GAMES.get(locked.validationSeason), row.candidateId + ' fold games');
    ok(Number(fold.observedEvents) >= 0 && Number(fold.observedEvents) <= fold.games, row.candidateId + ' fold events');
    ok(
      Number(fold.aggregatePredictedProbability) > 0 &&
        Number(fold.aggregatePredictedProbability) < 1,
      row.candidateId + ' fold probability',
    );
    approximate(
      fold.aggregateObservedProbability,
      Number(fold.observedEvents) / Number(fold.games),
      EPSILON,
      row.candidateId + ' observed probability',
    );
    approximate(
      fold.aggregateSignedErrorPercentagePoints,
      (Number(fold.aggregatePredictedProbability) -
        Number(fold.aggregateObservedProbability)) *
        100,
      2e-7,
      row.candidateId + ' signed fold error',
    );
    const [low, high] = wilson(fold.observedEvents, fold.games);
    approximate(fold.observedWilson95LowPercent, low * 100, 2e-7, row.candidateId + ' Wilson low');
    approximate(fold.observedWilson95HighPercent, high * 100, 2e-7, row.candidateId + ' Wilson high');
    const predicted = Number(fold.aggregatePredictedProbability);
    ok(
      Math.min(Math.abs(predicted - low), Math.abs(predicted - high)) >
        NINE_DECIMAL_HALF_UNIT,
      row.candidateId + ' Wilson compatibility precision ambiguity',
    );
    ok(
      fold.aggregatePredictionInsideWilson95 === (predicted >= low && predicted <= high),
      row.candidateId + ' Wilson compatibility',
    );
    for (const field of [
      'observedEvents',
      'aggregatePredictedProbability',
      'aggregateObservedProbability',
      'aggregateSignedErrorPercentagePoints',
      'observedWilson95LowPercent',
      'observedWilson95HighPercent',
      'multiclassLogLoss',
      'multiclassBrierScore',
      'aggregateBinaryLogLoss',
      'aggregateBinaryBrierScore',
    ]) {
      serializedTo(fold[field], 9, row.candidateId + ' fold ' + field);
    }
    for (const metric of [
      'multiclassLogLoss',
      'multiclassBrierScore',
      'aggregateBinaryLogLoss',
      'aggregateBinaryBrierScore',
    ]) {
      ok(
        Number.isFinite(Number(fold[metric])) && Number(fold[metric]) >= 0,
        row.candidateId + ' ' + metric,
      );
    }
  }

  const expectedAggregate = foldAggregate(row.folds);
  ok(row.metrics.scoreMetricWeighting === 'VALIDATION_GAME_WEIGHTED', row.candidateId + ' score weighting');
  ok(
    row.metrics.aggregateErrorMetricWeighting === 'EQUAL_VALIDATION_FOLD_WEIGHTED',
    row.candidateId + ' aggregate-error weighting',
  );
  for (const [field, value] of Object.entries(expectedAggregate)) {
    approximate(row.metrics[field], value, 2e-7, row.candidateId + ' aggregate ' + field);
  }
  for (const [field, value] of Object.entries(row.metrics)) {
    if (typeof value === 'number' && !Number.isInteger(value)) {
      serializedTo(value, 9, row.candidateId + ' aggregate ' + field);
    }
  }

  const expectedFit = fitShape(row.seasonWeightFamily, DEVELOPMENT);
  same(row.finalFit.eligibleSeasons, expectedFit.eligibleSeasons, row.candidateId + ' fit seasons');
  same(row.finalFit.seasonWeights, expectedFit.seasonWeights, row.candidateId + ' season weights');
  ok(row.finalFit.rawGames === expectedFit.rawGames, row.candidateId + ' raw games');
  approximate(row.finalFit.weightedGames, expectedFit.weightedGames, EPSILON, row.candidateId + ' weighted games');
  approximate(row.finalFit.effectiveGames, expectedFit.effectiveGames, 2e-7, row.candidateId + ' effective games');
  same(Object.keys(row.finalFit.categoryProbabilities), CATEGORIES, row.candidateId + ' categories');
  for (const probability of Object.values(row.finalFit.categoryProbabilities)) {
    ok(Number(probability) > 0 && Number(probability) < 1, row.candidateId + ' probability');
    serializedTo(probability, 9, row.candidateId + ' final probability');
  }
  const sum = Object.values(row.finalFit.categoryProbabilities).reduce(
    (total, probability) => total + Number(probability),
    0,
  );
  ok(
    Math.abs(sum - 1) <=
      evaluation.candidateEligibilityThresholds.distributionSumTolerance +
        CATEGORIES.length * NINE_DECIMAL_HALF_UNIT,
    row.candidateId + ' rounded distribution sum',
  );
  const aggregate = EXACT.reduce(
    (total, category) => total + Number(row.finalFit.categoryProbabilities[category]),
    0,
  );
  approximate(
    row.finalFit.aggregateOneThroughEighteenPercent,
    aggregate * 100,
    1e-6,
    row.candidateId + ' fit aggregate',
  );
  serializedTo(
    row.finalFit.aggregateOneThroughEighteenPercent,
    6,
    row.candidateId + ' fit aggregate',
  );
  ok(
    row.finalFit.distributionSha256 === digest(row.finalFit.categoryProbabilities),
    row.candidateId + ' distribution digest',
  );

  const robustness = row.robustness;
  same(
    robustness.leaveOneEligibleSeasonOut.map((item) => item.removedSeason),
    DEVELOPMENT,
    row.candidateId + ' leave-one seasons',
  );
  const deleteValues = robustness.leaveOneEligibleSeasonOut.map((item) => {
    serializedTo(item.aggregatePercent, 6, row.candidateId + ' leave-one aggregate');
    serializedTo(item.shiftFromFullPercentagePoints, 6, row.candidateId + ' leave-one shift');
    approximate(
      item.shiftFromFullPercentagePoints,
      Number(item.aggregatePercent) - Number(row.finalFit.aggregateOneThroughEighteenPercent),
      2e-6,
      row.candidateId + ' leave-one shift',
    );
    return Number(item.aggregatePercent);
  });
  approximate(
    robustness.leaveOneAggregateMinimumPercent,
    Math.min(...deleteValues),
    1e-6,
    row.candidateId + ' leave-one minimum',
  );
  approximate(
    robustness.leaveOneAggregateMaximumPercent,
    Math.max(...deleteValues),
    1e-6,
    row.candidateId + ' leave-one maximum',
  );
  approximate(
    robustness.leaveOneAggregateRangePercentagePoints,
    Math.max(...deleteValues) - Math.min(...deleteValues),
    2e-6,
    row.candidateId + ' leave-one range',
  );
  approximate(
    robustness.leaveOneMaximumAbsoluteShiftPercentagePoints,
    Math.max(
      ...robustness.leaveOneEligibleSeasonOut.map((item) =>
        Math.abs(Number(item.shiftFromFullPercentagePoints)),
      ),
    ),
    1e-6,
    row.candidateId + ' leave-one maximum shift',
  );
  const bootstrap = robustness.seasonBlockBootstrap;
  ok(bootstrap.replicates === 5000, row.candidateId + ' bootstrap replicates');
  ok(bootstrap.seed === 20260903, row.candidateId + ' bootstrap seed');
  same(bootstrap.eligibleSeasonBlocks, DEVELOPMENT, row.candidateId + ' bootstrap seasons');
  for (const field of [
    'aggregateMeanPercent',
    'aggregateStandardDeviationPercentagePoints',
    'aggregate95LowPercent',
    'aggregate95HighPercent',
    'maximum95HalfWidthFromFullPercentagePoints',
  ]) {
    serializedTo(bootstrap[field], 6, row.candidateId + ' bootstrap ' + field);
  }
  ok(
    Number(bootstrap.aggregate95LowPercent) <= Number(bootstrap.aggregate95HighPercent),
    row.candidateId + ' bootstrap interval',
  );
  approximate(
    bootstrap.maximum95HalfWidthFromFullPercentagePoints,
    Math.max(
      Number(row.finalFit.aggregateOneThroughEighteenPercent) -
        Number(bootstrap.aggregate95LowPercent),
      Number(bootstrap.aggregate95HighPercent) -
        Number(row.finalFit.aggregateOneThroughEighteenPercent),
    ),
    2e-6,
    row.candidateId + ' bootstrap half-width',
  );
}

same(
  reference.finalFit.categoryProbabilities,
  stage2.selectedCategoryProbabilities,
  'Stage 2 byte-equivalent reference',
);

const eligibilityIds = [
  'DISTRIBUTION',
  'MULTICLASS_LOG_LOSS_NONINFERIOR',
  'MULTICLASS_BRIER_NONINFERIOR',
  'AGGREGATE_LOG_LOSS_NONINFERIOR',
  'AGGREGATE_BRIER_NONINFERIOR',
  'POOLED_AGGREGATE_ERROR',
  'PREDICTIVE_COMPATIBILITY',
  'LEAVE_ONE_SEASON_STABILITY',
  'SEASON_BLOCK_BOOTSTRAP_STABILITY',
];
const materialIds = [
  'MATERIAL_LOG_LOSS_IMPROVEMENT',
  'MATERIAL_BRIER_IMPROVEMENT',
  'MATERIAL_AGGREGATE_MAE_IMPROVEMENT',
];
const thresholds = evaluation.candidateEligibilityThresholds;
const material = evaluation.materialReplacementThresholds;
const eligibleRows = [];
const materialRows = [];

for (const row of rows) {
  const roundedDistributionSum = Object.values(row.finalFit.categoryProbabilities).reduce(
    (total, probability) => total + Number(probability),
    0,
  );
  const expectedEligibility = [
    true,
    unambiguousLessThanOrEqual(
      row.metrics.meanMulticlassLogLoss,
      reference.metrics.meanMulticlassLogLoss +
        thresholds.maximumMulticlassLogLossWorseThanReference,
      NINE_DECIMAL_HALF_UNIT * 2,
      row.candidateId + ' multiclass log-loss gate',
    ),
    unambiguousLessThanOrEqual(
      row.metrics.meanMulticlassBrierScore,
      reference.metrics.meanMulticlassBrierScore +
        thresholds.maximumMulticlassBrierScoreWorseThanReference,
      NINE_DECIMAL_HALF_UNIT * 2,
      row.candidateId + ' multiclass Brier gate',
    ),
    unambiguousLessThanOrEqual(
      row.metrics.meanAggregateBinaryLogLoss,
      reference.metrics.meanAggregateBinaryLogLoss +
        thresholds.maximumAggregateBinaryLogLossWorseThanReference,
      NINE_DECIMAL_HALF_UNIT * 2,
      row.candidateId + ' aggregate log-loss gate',
    ),
    unambiguousLessThanOrEqual(
      row.metrics.meanAggregateBinaryBrierScore,
      reference.metrics.meanAggregateBinaryBrierScore +
        thresholds.maximumAggregateBinaryBrierScoreWorseThanReference,
      NINE_DECIMAL_HALF_UNIT * 2,
      row.candidateId + ' aggregate Brier gate',
    ),
    unambiguousLessThanOrEqual(
      Math.abs(row.metrics.pooledSignedAggregateErrorPercentagePoints),
      thresholds.maximumAbsolutePooledAggregateErrorPercentagePoints,
      NINE_DECIMAL_HALF_UNIT,
      row.candidateId + ' pooled aggregate-error gate',
    ),
    row.metrics.wilsonCompatibleFolds >= evaluation.predictiveCompatibility.minimumCompatibleFolds,
    unambiguousLessThanOrEqual(
      row.robustness.leaveOneAggregateRangePercentagePoints,
      thresholds.maximumLeaveOneSeasonOutAggregateRangePercentagePoints,
      SIX_DECIMAL_HALF_UNIT,
      row.candidateId + ' leave-one-season gate',
    ),
    unambiguousLessThanOrEqual(
      row.robustness.seasonBlockBootstrap.maximum95HalfWidthFromFullPercentagePoints,
      thresholds.maximumBootstrap95HalfWidthPercentagePoints,
      SIX_DECIMAL_HALF_UNIT,
      row.candidateId + ' bootstrap gate',
    ),
  ];
  ok(
    Math.abs(roundedDistributionSum - 1) <=
      thresholds.distributionSumTolerance + CATEGORIES.length * NINE_DECIMAL_HALF_UNIT,
    row.candidateId + ' distribution gate serialization envelope',
  );
  same(
    row.eligibilityChecks.map((check) => check.id),
    eligibilityIds,
    row.candidateId + ' eligibility check identities',
  );
  same(
    row.eligibilityChecks.map((check) => check.pass),
    expectedEligibility,
    row.candidateId + ' eligibility arithmetic',
  );
  ok(
    row.eligible === expectedEligibility.every(Boolean),
    row.candidateId + ' eligibility result',
  );
  if (row.eligible) eligibleRows.push(row);

  const expectedDeltas = {
    multiclassLogLossDelta:
      row.metrics.meanMulticlassLogLoss - reference.metrics.meanMulticlassLogLoss,
    multiclassBrierScoreDelta:
      row.metrics.meanMulticlassBrierScore - reference.metrics.meanMulticlassBrierScore,
    aggregateMeanAbsoluteErrorDeltaPercentagePoints:
      row.metrics.meanAbsoluteAggregateErrorPercentagePoints -
      reference.metrics.meanAbsoluteAggregateErrorPercentagePoints,
  };
  for (const [field, expected] of Object.entries(expectedDeltas)) {
    serializedTo(row.versusReference[field], 9, row.candidateId + ' ' + field);
    approximate(row.versusReference[field], expected, 2e-9, row.candidateId + ' ' + field);
  }

  if (row.candidateId === reference.candidateId) {
    same(row.materialReplacementChecks, [], 'reference material checks');
    ok(row.materialReplacementQualified === false, 'reference replacement qualification');
    continue;
  }
  const expectedMaterial = [
    unambiguousLessThanOrEqual(
      material.minimumMulticlassLogLossImprovement,
      -row.versusReference.multiclassLogLossDelta,
      NINE_DECIMAL_HALF_UNIT,
      row.candidateId + ' material log-loss gate',
    ),
    unambiguousLessThanOrEqual(
      material.minimumMulticlassBrierScoreImprovement,
      -row.versusReference.multiclassBrierScoreDelta,
      NINE_DECIMAL_HALF_UNIT,
      row.candidateId + ' material Brier gate',
    ),
    unambiguousLessThanOrEqual(
      material.minimumMeanAbsoluteAggregateErrorImprovementPercentagePoints,
      -row.versusReference.aggregateMeanAbsoluteErrorDeltaPercentagePoints,
      NINE_DECIMAL_HALF_UNIT,
      row.candidateId + ' material aggregate-MAE gate',
    ),
  ];
  same(
    row.materialReplacementChecks.map((check) => check.id),
    materialIds,
    row.candidateId + ' material check identities',
  );
  same(
    row.materialReplacementChecks.map((check) => check.pass),
    expectedMaterial,
    row.candidateId + ' material replacement arithmetic',
  );
  ok(
    row.materialReplacementQualified === (row.eligible && expectedMaterial.every(Boolean)),
    row.candidateId + ' material replacement result',
  );
  if (row.materialReplacementQualified) materialRows.push(row);
}

function selectBest(candidates, message) {
  if (candidates.length === 0) return null;
  const metricFields = [
    'meanMulticlassLogLoss',
    'meanMulticlassBrierScore',
    'meanAbsoluteAggregateErrorPercentagePoints',
  ];
  return [...candidates].sort((left, right) => {
    for (const field of metricFields) {
      const delta = Number(left.metrics[field]) - Number(right.metrics[field]);
      if (delta !== 0) {
        ok(
          Math.abs(delta) > NINE_DECIMAL_HALF_UNIT * 2,
          message + ': rounded ordering ambiguity for ' + field,
        );
        return delta;
      }
    }
    ok(
      left.candidateId === right.candidateId,
      message + ': raw metric tie cannot be proved from rounded evidence',
    );
    return PRIORITY.indexOf(left.candidateId) - PRIORITY.indexOf(right.candidateId);
  })[0];
}

let expectedSelected = null;
let expectedDecision = 'FAIL_CLOSED_NO_ELIGIBLE_CANDIDATE';
if (reference.eligible) {
  if (materialRows.length > 0) {
    expectedSelected = selectBest(materialRows, 'material challenger selection');
    expectedDecision = 'REPLACE_REFERENCE_WITH_MATERIALLY_BETTER_DEVELOPMENT_CANDIDATE';
  } else {
    expectedSelected = reference;
    expectedDecision = 'RETAIN_EXISTING_FROZEN_REFERENCE';
  }
} else if (eligibleRows.length > 0) {
  expectedSelected = selectBest(eligibleRows, 'eligible candidate selection');
  expectedDecision = 'REFERENCE_INELIGIBLE_SELECT_BEST_ELIGIBLE_CANDIDATE';
}

const selection = audit.selection;
ok(selection.referenceCandidateId === reference.candidateId, 'selection reference candidate');
ok(selection.referenceEligible === reference.eligible, 'selection reference eligibility');
same(selection.eligibleCandidateIds, eligibleRows.map((row) => row.candidateId), 'eligible candidate list');
same(
  selection.materialReplacementCandidateIds,
  materialRows.map((row) => row.candidateId),
  'material replacement candidate list',
);
ok(selection.decision === expectedDecision, 'selection decision');
ok(
  selection.selectedCandidateId === (expectedSelected ? expectedSelected.candidateId : null),
  'selected candidate',
);
ok(
  selection.selectedDistributionSha256 ===
    (expectedSelected ? expectedSelected.finalFit.distributionSha256 : null),
  'selected distribution digest',
);
ok(selection.referenceDistributionByteEquivalentToStage2 === true, 'reference Stage 2 binding');
ok(selection.holdoutUsedToBreakTie === false, 'holdout tie-break boundary');
ok(selection.replacementForced === false, 'forced replacement boundary');
ok(audit.status === (expectedSelected ? contract.outcomeStates.pass : contract.outcomeStates.fail), 'audit status');
ok(audit.modelFreezePath === contract.outputs.modelFreeze, 'audit freeze path');
same(audit.blockedStages, ['BW7', 'BW8', 'PRODUCTION_AUTHORITY'], 'audit blocked stages');
ok(
  audit.nextStage === (expectedSelected ? 'BW6.4_PROSPECTIVE_ACTIVE_WEEK_SHADOW' : null),
  'audit next stage',
);

if (!expectedSelected) {
  ok(!fs.existsSync(freezePath), 'failed R2 retained a model freeze');
  console.log('WALTERS BW6 STAGE 3R2 VERIFY: FAIL-CLOSED EVIDENCE VALID // NO FREEZE');
  process.exit(0);
}

ok(fs.existsSync(freezePath), 'passing R2 missing model freeze');
const freeze = readJson(freezePath);
ok(freeze.schemaVersion === 'walters-bw6-stage3r2-model-freeze-v1', 'freeze schema');
ok(freeze.module === contract.module, 'freeze module');
ok(freeze.stage === 'BW6.3R2', 'freeze stage');
ok(freeze.status === contract.outcomeStates.freeze, 'freeze status');
ok(freeze.generatedAt === contract.generatedAt, 'freeze deterministic timestamp');
ok(
  !JSON.stringify(freeze).includes('ZERO_ROWS_AVAILABLE_TO_R2_BUILDER'),
  'obsolete outcome-use wording remains in freeze',
);
for (const field of [
  'operational',
  'productionAuthority',
  'grahamFairMutationAllowed',
  'liveBoardMutationAllowed',
  'betStatusMutationAllowed',
  'stakeMutationAllowed',
  'marketViewed',
  'weightedAdvantageAllowed',
  'crossZeroDeductionAllowed',
  'marketNormalizationAllowed',
  'originalStage3FailureOverridden',
  'originalThreePointGateWaived',
]) {
  ok(freeze[field] === false, 'freeze ' + field);
}

ok(freeze.r2Contract === path.relative(ROOT, CONTRACT_PATH), 'freeze contract path');
ok(freeze.r2ContractSha256 === hashFile(CONTRACT_PATH), 'freeze contract hash');
ok(freeze.developmentAudit === path.relative(ROOT, auditPath), 'freeze audit path');
ok(freeze.developmentAuditSha256 === hashFile(auditPath), 'freeze audit hash');
ok(freeze.builder === path.relative(ROOT, BUILDER_PATH), 'freeze builder path');
ok(freeze.builderSha256 === hashFile(BUILDER_PATH), 'freeze builder hash');
same(Object.keys(freeze.releaseArtifactSha256), RELEASE_PATHS, 'freeze release paths');
for (const relative of RELEASE_PATHS) {
  ok(fs.existsSync(path.join(ROOT, relative)), 'missing release artifact ' + relative);
  ok(isSha(freeze.releaseArtifactSha256[relative]), 'invalid release hash ' + relative);
  ok(
    freeze.releaseArtifactSha256[relative] === hashFile(path.join(ROOT, relative)),
    'frozen release hash ' + relative,
  );
}
ok(
  freeze.orderedDevelopmentObservationSha256 === audit.orderedDevelopmentObservationSha256,
  'freeze observation hash binding',
);
ok(freeze.candidateSpecificationSha256 === digest(spec), 'freeze candidate-spec hash');
ok(freeze.selectedCandidateId === expectedSelected.candidateId, 'freeze selected candidate');
ok(freeze.selectionDecision === expectedDecision, 'freeze selection decision');
same(
  freeze.selectedCategoryProbabilities,
  expectedSelected.finalFit.categoryProbabilities,
  'freeze selected distribution',
);
ok(
  freeze.selectedDistributionSha256 === digest(freeze.selectedCategoryProbabilities),
  'freeze selected distribution hash',
);
ok(
  freeze.selectedDistributionSha256 === selection.selectedDistributionSha256,
  'audit/freeze distribution binding',
);

const selectedAggregateFromSerialized = EXACT.reduce(
  (total, category) => total + Number(freeze.selectedCategoryProbabilities[category]),
  0,
);
serializedTo(freeze.aggregateOneThroughEighteenPercent, 6, 'freeze aggregate percent');
approximate(
  freeze.aggregateOneThroughEighteenPercent,
  selectedAggregateFromSerialized * 100,
  1.1e-6,
  'freeze aggregate percent',
);
serializedTo(freeze.otherProbabilityPercent, 6, 'freeze OTHER percent');
approximate(
  freeze.otherProbabilityPercent,
  Number(freeze.selectedCategoryProbabilities.OTHER) * 100,
  1e-6,
  'freeze OTHER percent',
);

same(freeze.marginRows.map((row) => row.margin), Array.from({length: 18}, (_, index) => index + 1), 'margin rows');
for (const marginRow of freeze.marginRows) {
  const category = String(marginRow.margin);
  const selectedProbability = Number(freeze.selectedCategoryProbabilities[category]);
  const referenceProbability = Number(reference.finalFit.categoryProbabilities[category]);
  ok(marginRow.probability === selectedProbability, 'margin ' + category + ' selected probability');
  ok(marginRow.referenceProbability === referenceProbability, 'margin ' + category + ' reference probability');
  serializedTo(marginRow.probability, 9, 'margin ' + category + ' probability');
  serializedTo(marginRow.referenceProbability, 9, 'margin ' + category + ' reference probability');
  serializedTo(marginRow.percent, 6, 'margin ' + category + ' percent');
  approximate(marginRow.percent, selectedProbability * 100, 1e-6, 'margin ' + category + ' percent');
  serializedTo(
    marginRow.deltaFromReferencePercentagePoints,
    6,
    'margin ' + category + ' reference delta',
  );
  approximate(
    marginRow.deltaFromReferencePercentagePoints,
    (selectedProbability - referenceProbability) * 100,
    1.1e-6,
    'margin ' + category + ' reference delta',
  );

  const lowerCosts = fairCosts(Math.max(0, selectedProbability - NINE_DECIMAL_HALF_UNIT));
  const upperCosts = fairCosts(selectedProbability + NINE_DECIMAL_HALF_UNIT);
  for (const field of [
    'buyOntoLossToPushExactUsdPer100',
    'buyOffPushToWinExactUsdPer100',
  ]) {
    serializedTo(marginRow.halfPointFairCosts[field], 6, 'margin ' + category + ' ' + field);
    ok(
      Number(marginRow.halfPointFairCosts[field]) >= Math.min(lowerCosts[field], upperCosts[field]) &&
        Number(marginRow.halfPointFairCosts[field]) <= Math.max(lowerCosts[field], upperCosts[field]),
      'margin ' + category + ' ' + field + ' raw-probability binding',
    );
  }
  for (const field of [
    'buyOntoLossToPushDisplayUsdPer100',
    'buyOffPushToWinDisplayUsdPer100',
  ]) {
    ok(Number.isInteger(marginRow.halfPointFairCosts[field]), 'margin ' + category + ' ' + field);
    ok(
      marginRow.halfPointFairCosts[field] >= Math.min(lowerCosts[field], upperCosts[field]) &&
        marginRow.halfPointFairCosts[field] <= Math.max(lowerCosts[field], upperCosts[field]),
      'margin ' + category + ' ' + field + ' raw-probability binding',
    );
  }
}

same(freeze.prospectiveCutoff, contract.prospectiveCutoff, 'freeze prospective cutoff');
same(freeze.prospectiveShadowPlan, shadowPlan, 'freeze three-cycle shadow plan');
ok(freeze.prospectiveShadowPlanSha256 === digest(shadowPlan), 'freeze shadow-plan hash');
ok(
  freeze.prospectiveShadowPlanSha256 === audit.prospectiveShadowPlanSha256,
  'audit/freeze shadow-plan binding',
);
ok(freeze.season2025Role === boundary.season2025Role, 'freeze 2025 outcome role');
for (const field of [
  'season2025OutcomeRowsUsedForFit',
  'season2025OutcomeRowsUsedForSelection',
  'season2026OutcomeRowsUsedForFit',
  'season2026OutcomeRowsUsedForSelection',
]) {
  ok(freeze[field] === 0, 'freeze ' + field);
}
ok(
  freeze.originalStage2DistributionRetained ===
    (expectedSelected.candidateId === reference.candidateId),
  'freeze Stage 2 retention flag',
);
ok(
  freeze.protectedArtifactBaselineRole ===
    'HISTORICAL_ISSUANCE_SNAPSHOT_AT_PROSPECTIVE_CUTOFF',
  'freeze protected-baseline role',
);
if (freeze.originalStage2DistributionRetained) {
  same(
    freeze.selectedCategoryProbabilities,
    stage2.selectedCategoryProbabilities,
    'retained freeze is byte-equivalent to Stage 2',
  );
}
ok(freeze.allowedNextStage === 'BW6.4_PROSPECTIVE_ACTIVE_WEEK_SHADOW', 'freeze allowed stage');
same(freeze.blockedStages, ['BW7', 'BW8', 'PRODUCTION_AUTHORITY'], 'freeze blocked stages');

console.log(
  'WALTERS BW6 STAGE 3R2 VERIFY: PASS // ' +
    expectedSelected.candidateId +
    ' // BW6.4 THREE-CYCLE SHADOW ONLY // BW7/BW8/PRODUCTION BLOCKED',
);

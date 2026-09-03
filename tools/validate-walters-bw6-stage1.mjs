#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

const ROOT = process.cwd();
const CONTRACT_PATH = path.join(
  ROOT,
  'data/walters/nfl/key-numbers/bw6-stage1-contract-v1.json',
);

function fail(message) {
  throw new Error(`WALTERS BW6 STAGE 1 VERIFY FAILED // ${message}`);
}

function ok(condition, message) {
  if (!condition) fail(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function same(actual, expected, message) {
  ok(JSON.stringify(actual) === JSON.stringify(expected), message);
}

function includesAll(actual, expected, message) {
  ok(Array.isArray(actual), `${message}: expected an array`);
  for (const item of expected) {
    ok(actual.includes(item), `${message}: missing ${item}`);
  }
}

function unique(actual, message) {
  ok(Array.isArray(actual), `${message}: expected an array`);
  ok(new Set(actual).size === actual.length, `${message}: contains duplicates`);
}

function approximate(actual, expected, tolerance, message) {
  ok(Number.isFinite(actual), `${message}: not finite`);
  ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);
}

function fairHalfPointCosts(pointProbability) {
  const p = Number(pointProbability);
  const q = 110 / 210;
  ok(Number.isFinite(p) && p >= 0 && p < 1 - q, 'half-point test probability');
  const buyOntoRisk = (100 * q) / (1 - q - p);
  const buyOffRisk = (100 * (q * (1 - p) + p)) / ((1 - q) * (1 - p));
  return {
    buyOntoLossToPush: buyOntoRisk - 110,
    buyOffPushToWin: buyOffRisk - 110,
  };
}

ok(fs.existsSync(CONTRACT_PATH), 'missing BW6 Stage 1 contract');
const contract = readJson(CONTRACT_PATH);
const active = resolveGrahamActiveWeek({root: ROOT, requireFiles: true});

const declaredProtected = contract.protectedArtifacts ?? [];
unique(declaredProtected, 'protectedArtifacts');
const requiredProtected = [
  'core/walters-authority-v1.4.json',
  'core/walters-intelligence-interface-v1.4.json',
  'data/live-odds.json',
  'data/walters/nfl/active-week.json',
  'data/walters/nfl/current-week-terminal.json',
  'data/walters/nfl-power-ratings-ledger.json',
  'data/walters/nfl/home-field/home-field-production-current.json',
  'data/walters/nfl/personnel-production-current.json',
  'data/walters/nfl/matchup-production-current.json',
  'data/walters/nfl/qb-production-current.json',
  'data/walters/nfl/qb-production/production-contract-v1.json',
];
includesAll(declaredProtected, requiredProtected, 'protectedArtifacts');

const protectedRelative = [...declaredProtected];
for (const activePath of [active.paths.currentNumbers, active.paths.personnelLedger]) {
  if (!protectedRelative.includes(activePath)) protectedRelative.push(activePath);
}
unique(protectedRelative, 'resolved protected paths');
const protectedFiles = protectedRelative.map((file) => path.join(ROOT, file));
for (const file of protectedFiles) {
  ok(fs.existsSync(file), `missing protected artifact ${path.relative(ROOT, file)}`);
}
const protectedBefore = Object.fromEntries(
  protectedFiles.map((file) => [path.relative(ROOT, file), sha256(file)]),
);

ok(contract.schemaVersion === 'walters-bw6-stage1-contract-v1', 'schemaVersion');
ok(contract.module === 'WALTERS_KEY_NUMBER_AND_HALF_POINT_VALUE', 'module');
ok(contract.stage === 'BW6.1', 'stage');
ok(
  contract.status === 'CONTRACT_LOCKED_FOR_BW6_2_CALIBRATION_NON_OPERATIONAL',
  'status must remain locked and non-operational',
);
ok(Number(contract.season) === active.season, 'contract season must match active season');
ok(active.manifest?.authority === 'GRAHAM_WEEK_ROLLOVER', 'active-week authority');
for (const field of [
  'operational',
  'productionAuthority',
  'grahamFairMutationAllowed',
  'liveBoardMutationAllowed',
  'betStatusMutationAllowed',
  'stakeMutationAllowed',
  'marketViewed',
]) {
  ok(contract[field] === false, `${field} must be false`);
}

same(contract.scope?.ownedRules, ['BW-R021', 'BW-R022', 'BW-R023'], 'BW6 owned rules');
same(
  contract.scope?.notOwned?.BW7?.ruleIds,
  ['BW-R024', 'BW-R025', 'BW-R026'],
  'BW7 boundary',
);
same(
  contract.scope?.notOwned?.BW8?.ruleIds,
  ['BW-R027', 'BW-R028'],
  'BW8 boundary',
);
ok(
  String(contract.scope?.notOwned?.BW7?.boundary ?? '').includes('deferred'),
  'BW7 must remain deferred',
);
ok(
  String(contract.scope?.notOwned?.BW8?.boundary ?? '').includes('No interpolation'),
  'BW8 must prohibit interpolation',
);

const sourceAuthority = contract.sourceAuthority ?? {};
ok(
  sourceAuthority.documentClosureStatus === 'SOURCE_LOCKED_FOUNDATION_DOCUMENT_CLOSED',
  'document closure status',
);
ok(sourceAuthority.documentPages === '232-274', 'document page range');
ok(sourceAuthority.pagesAccountedFor === 43, 'document page count');
ok(sourceAuthority.unresolvedTranscriptionChecks === 0, 'unresolved transcription checks');
const sourceArtifactHashes = Object.fromEntries(
  (sourceAuthority.governedSourceArtifacts ?? []).map((item) => [item.artifact, item.sha256]),
);
same(
  sourceArtifactHashes,
  {
    'walters-rule-registry-v1.0.json':
      '1e258dc953752fa0a189fc803bf7b6fdc2fa8b4ef2614d3ab3d41554d3f450db',
    'walters-page-disposition-ledger-v1.0.json':
      '0a8ff1a513b39aaa0e8dc61b71edd7c6fd21f7bff7cec573d722215821f1b498',
    'walters-lines-calculator-v1.0.mjs':
      '39097ecea5b283fc0d1f787c1694c99613f2efc3d186499537463aefb349287e',
    'walters-lines-calculator-v1.0.test.mjs':
      '32ee9bb2203ac265b0b32575bc5157ce26315f4f8d0ea0f56dcf5d906746167c',
  },
  'governed source artifact hashes',
);
same(
  (sourceAuthority.rules ?? []).map((rule) => rule.ruleId),
  ['BW-R021', 'BW-R022', 'BW-R023'],
  'source rule identities',
);
ok(
  sourceAuthority.sourceBoundary?.bw8BlockingAnomaly?.anomalyId === 'BW-A014',
  'BW-A014 boundary',
);
same(
  sourceAuthority.sourceBoundary?.supportedMargins,
  Array.from({length: 18}, (_, index) => index + 1),
  'supported source margins',
);
same(
  sourceAuthority.sourceBoundary?.unsupportedBookHalfPointMargins,
  [21, 24],
  'unsupported source half-point margins',
);

const expectedWeights = {
  1: 3,
  2: 3,
  3: 8,
  4: 3,
  5: 3,
  6: 5,
  7: 6,
  8: 3,
  9: 2,
  10: 4,
  11: 2,
  12: 2,
  13: 2,
  14: 5,
  15: 2,
  16: 3,
  17: 3,
  18: 3,
};
const baseline = contract.bookExactBaseline ?? {};
same(baseline.pointWeightsPercentPublishedRounded, expectedWeights, 'BOOK-EXACT weights');
ok(
  Object.values(baseline.pointWeightsPercentPublishedRounded).reduce(
    (total, value) => total + value,
    0,
  ) === 62,
  'BOOK-EXACT weight sum',
);
ok(baseline.publishedWeightSumPercent === 62, 'declared BOOK-EXACT weight sum');
same(
  baseline.buyHalfPointFairCostUsdPer100,
  {
    1: 6,
    2: 6,
    3: {buyOffPushToWin: 20, buyOntoLossToPush: 22},
    4: 6,
    5: 6,
    6: 10,
    7: 13,
    8: 6,
    9: 3,
    10: 9,
    11: 5,
    12: 4,
    13: 5,
    14: 11,
    15: 5,
    16: 6,
    17: 6,
    18: 6,
    21: null,
    24: null,
  },
  'BOOK-EXACT half-point fair costs',
);
ok(baseline.productionUseAllowedInBW6 === false, 'BOOK-EXACT BW6 production boundary');
ok(String(baseline.precisionRule ?? '').includes('Never infer'), 'rounded-source precision rule');

const historical = contract.historicalDataContract ?? {};
const snapshot = historical.sourceSnapshot ?? {};
const sourcePath = path.join(ROOT, snapshot.path ?? '');
ok(fs.existsSync(sourcePath), 'missing pinned source snapshot');
ok(
  sha256(sourcePath) === '3a21c7ed52214151fb63bce848a594bf04c4e513caa5a26f3bcb83b6fd2b49fc',
  'pinned source SHA-256',
);
ok(snapshot.sha256 === sha256(sourcePath), 'contract/source SHA-256 mismatch');

const sourceText = fs.readFileSync(sourcePath, 'utf8');
const sourceLines = sourceText.trimEnd().split(/\r?\n/);
const sourceHeader = sourceLines[0].split(',');
same(sourceHeader, historical.fieldWhitelist, 'source field whitelist and order');
ok(sourceLines.length - 1 === snapshot.dataRows, 'source data-row count');
for (const field of historical.forbiddenFields ?? []) {
  ok(!sourceHeader.includes(field), `forbidden source field present: ${field}`);
}
includesAll(sourceHeader, historical.calibrationFieldWhitelist, 'calibration field whitelist');
same(
  historical.teamIdentityAliases,
  {OAK: 'LV', SD: 'LAC', STL: 'LAR', LA: 'LAR'},
  'team identity aliases',
);
ok(String(historical.teamIdentityRule ?? '').includes('no fuzzy'), 'team identity fail-closed rule');

const scheduledCounts = new Map();
const completedCounts = new Map();
const gameTypeCounts = new Map();
for (const line of sourceLines.slice(1)) {
  const fields = line.split(',');
  const season = Number(fields[1]);
  const gameType = fields[2];
  const key = `${season}:${gameType}`;
  scheduledCounts.set(key, (scheduledCounts.get(key) ?? 0) + 1);
  gameTypeCounts.set(gameType, (gameTypeCounts.get(gameType) ?? 0) + 1);
  if (fields[8] !== '' && fields[10] !== '') {
    completedCounts.set(key, (completedCounts.get(key) ?? 0) + 1);
  }
}
same(
  Object.fromEntries([...gameTypeCounts.entries()].sort()),
  {REG: 3423, SB: 12},
  'source game-type counts',
);
const completedFor = (seasons) =>
  seasons.reduce((total, season) => total + (completedCounts.get(`${season}:REG`) ?? 0), 0);
same(
  historical.developmentWindow?.seasons,
  [2015, 2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024],
  'development seasons',
);
ok(
  completedFor(historical.developmentWindow.seasons) ===
    historical.developmentWindow.expectedCompletedGames,
  'development completed-game count',
);
same(historical.currentEraWindow?.seasons, [2021, 2022, 2023, 2024], 'current era');
ok(
  completedFor(historical.currentEraWindow.seasons) ===
    historical.currentEraWindow.expectedCompletedGames,
  'current-era completed-game count',
);
same(historical.earlyEraWindow?.seasons, [2015, 2016, 2017, 2018, 2019], 'early era');
ok(
  completedFor(historical.earlyEraWindow.seasons) ===
    historical.earlyEraWindow.expectedCompletedGames,
  'early-era completed-game count',
);
same(historical.holdoutWindow?.seasons, [2025], 'holdout season');
ok(
  completedFor(historical.holdoutWindow.seasons) ===
    historical.holdoutWindow.expectedCompletedGames,
  'holdout completed-game count',
);
ok(
  historical.holdoutWindow?.status === 'SEALED_UNTIL_BW6_2_MODEL_SELECTION_IS_RECORDED',
  'holdout seal',
);
same(historical.contextOnlySeasons, [2014], 'context-only season');
same(historical.excludedOutcomeSeasons, [2020, 2026], 'excluded outcome seasons');
ok(historical.gameType === 'REG', 'regular-season scope');
ok(historical.postseasonIncluded === false, 'postseason exclusion');
ok((scheduledCounts.get('2026:REG') ?? 0) === 272, '2026 schedule context count');
ok((completedCounts.get('2026:REG') ?? 0) === 0, '2026 outcomes must be absent');

const orientation = contract.pregameFavoriteOrientation ?? {};
ok(orientation.method === 'ROLLING_RIDGE_PAIRWISE_TEAM_STRENGTH', 'favorite method');
ok(orientation.marketInputsAllowed === false, 'favorite orientation market isolation');
ok(orientation.lookbackEligibleSeasons === 2, 'favorite lookback');
ok(orientation.currentSeasonPriorGamesIncluded === true, 'current-season prior games');
ok(orientation.ridgePenalty === 8, 'favorite ridge penalty');
ok(orientation.domesticHomeAdvantagePoints === 2.082, 'favorite domestic HFA');
ok(orientation.neutralHomeAdvantagePoints === 0, 'favorite neutral HFA');
same(orientation.excludedOutcomeSeasons, [2020], 'favorite excluded seasons');
ok(String(orientation.chronology ?? '').includes('strictly before'), 'pregame chronology');
ok(String(orientation.independenceRule ?? '').includes('sportsbook'), 'orientation independence');

const calibration = contract.calibrationLock ?? {};
same(
  calibration.categories,
  [...Array.from({length: 18}, (_, index) => index + 1), 'OTHER'],
  'calibration categories',
);
same(
  (calibration.estimatorCandidates ?? []).map((model) => model.modelId),
  [
    'BW6_FULL_DEVELOPMENT_POOL',
    'BW6_ROLLING_FOUR_ELIGIBLE_SEASONS',
    'BW6_EXPONENTIAL_SEASON_DECAY_HL4',
  ],
  'estimator candidates',
);
same(
  (calibration.internalSelectionFolds ?? []).map((fold) => fold.validationSeason),
  [2019, 2023, 2024],
  'internal selection folds',
);
ok(calibration.smoothing?.method === 'JEFFREYS_DIRICHLET', 'smoothing method');
ok(calibration.smoothing?.alphaPerCategory === 0.5, 'smoothing alpha');
ok(calibration.smoothing?.categoryCount === 19, 'smoothing category count');
same(
  calibration.selectionMetrics,
  ['multiclassLogLoss', 'multiclassBrierScore'],
  'selection metrics',
);
ok(String(calibration.selectionRule ?? '').includes('0.002'), 'selection tie tolerance');
ok(String(calibration.selectionRule ?? '').includes('0.001'), 'selection Brier tolerance');
ok(String(calibration.freezeRule ?? '').includes('before any 2025'), 'pre-holdout freeze rule');

const uncertainty = contract.uncertaintyAndSupport ?? {};
ok(uncertainty.interval === '95_PERCENT_WILSON_SCORE_INTERVAL', 'uncertainty interval');
ok(uncertainty.minimumRawDevelopmentEventsPerMargin === 15, 'minimum margin events');
ok(
  uncertainty.maximumWilsonHalfWidthPercentagePoints === 2.5,
  'maximum interval half-width',
);
same(uncertainty.stabilityWindows, ['2015-2019', '2021-2024'], 'stability windows');
ok(String(uncertainty.statusRule ?? '').includes('CURRENT_SUPPORTED'), 'support status rule');

const halfPoint = contract.halfPointFairCost ?? {};
ok(halfPoint.referenceAmericanPrice === -110, 'half-point reference price');
ok(halfPoint.stakeBasisUsd === 100, 'half-point stake basis');
approximate(halfPoint.conditionalWinFractionAtMinus110, 110 / 210, 1e-15, 'minus-110 q');
ok(
  String(halfPoint.buyOntoLossToPush?.formula ?? '').includes('100*q/(1-q-p)'),
  'buy-onto formula',
);
ok(
  String(halfPoint.buyOffPushToWin?.formula ?? '').includes('q*(1-p)+p'),
  'buy-off formula',
);
const zeroCost = fairHalfPointCosts(0);
approximate(zeroCost.buyOntoLossToPush, 0, 1e-12, 'zero-probability buy-onto cost');
approximate(zeroCost.buyOffPushToWin, 0, 1e-12, 'zero-probability buy-off cost');
const threeBookWeightCost = fairHalfPointCosts(0.08);
approximate(
  threeBookWeightCost.buyOntoLossToPush,
  22.21153846153848,
  1e-9,
  'eight-percent buy-onto cost',
);
approximate(
  threeBookWeightCost.buyOffPushToWin,
  18.260869565217376,
  1e-9,
  'eight-percent buy-off cost',
);
ok(
  String(halfPoint.bookReproductionBoundary ?? '').includes('not reverse-engineered'),
  'rounded book-cost boundary',
);

const holdout = contract.holdoutAcceptance ?? {};
ok(holdout.modelSelectionMayUse2025 === false, 'holdout model selection boundary');
same(holdout.comparators, ['BOOK_EXACT_ROUNDED', 'BW6_SELECTED_CALIBRATED'], 'holdout comparators');
same(
  holdout.numericThresholds,
  {
    distributionSumTolerance: 1e-9,
    maximumLogLossWorseThanBook: 0.02,
    maximumBrierScoreWorseThanBook: 0.005,
    maximumAggregateOneThroughEighteenCalibrationErrorPercentagePoints: 3,
  },
  'holdout numeric thresholds',
);
ok((holdout.requiredChecks ?? []).length === 10, 'holdout checks');
ok(
  holdout.passState === 'BW6_3_HOLDOUT_VALIDATED_FOR_ACTIVE_WEEK_SHADOW_NON_OPERATIONAL',
  'holdout pass state',
);

ok(contract.activeWeekShadow?.stage === 'BW6.4', 'active-week shadow stage');
ok(contract.activeWeekShadow?.requirements?.length === 7, 'active-week shadow requirements');
ok(contract.activeWeekShadow?.productionAuthorityOnPass === false, 'shadow production authority');
ok(
  String(contract.activeWeekShadow?.allowedInput ?? '').includes('only to identify'),
  'active-week fair-margin read boundary',
);

const outputs = Object.values(contract.outputs ?? {});
ok(outputs.length === 4, 'expected downstream outputs');
for (const output of outputs) {
  ok(output.startsWith('data/walters/nfl/key-numbers/'), `output outside BW6 boundary: ${output}`);
}
ok(contract.writeBoundary?.historicalSourceSnapshotMutationAllowed === false, 'source write boundary');
ok(contract.writeBoundary?.weekScopedWritesAllowed === false, 'week write boundary');
ok(contract.writeBoundary?.productionArtifactsAllowed === false, 'production write boundary');
ok(contract.writeBoundary?.marketArtifactWritesAllowed === false, 'market write boundary');
same(
  contract.writeBoundary?.allowedPrefixes,
  [
    'data/walters/nfl/key-numbers/',
    'tools/build-walters-bw6-',
    'tools/validate-walters-bw6-',
    'tests/walters-bw6-',
    '.github/workflows/walters-bw6-',
  ],
  'BW6 write prefixes',
);
ok(contract.stage1Acceptance?.required?.length === 7, 'Stage 1 acceptance checks');
ok(
  contract.stage1Acceptance?.passState ===
    'CONTRACT_LOCKED_FOR_BW6_2_CALIBRATION_NON_OPERATIONAL',
  'Stage 1 pass state',
);
ok(
  contract.stage1Acceptance?.nextStage === 'BW6.2_INTERNAL_CALIBRATION_AND_MODEL_LOCK',
  'Stage 1 next stage',
);

includesAll(
  contract.failClosedCodes,
  [
    'FAIL_CLOSED_BW6_SOURCE_CLOSURE_MISMATCH',
    'FAIL_CLOSED_BW6_SOURCE_HASH_MISMATCH',
    'FAIL_CLOSED_BW6_SOURCE_FIELD_VIOLATION',
    'FAIL_CLOSED_BW6_MARKET_CONTAMINATION',
    'FAIL_CLOSED_BW6_HOLDOUT_PEEK',
    'FAIL_CLOSED_BW6_FAVORITE_ORIENTATION_LOOKAHEAD',
    'FAIL_CLOSED_BW6_SAMPLE_INSUFFICIENT',
    'FAIL_CLOSED_BW6_MARGIN_UNSTABLE',
    'FAIL_CLOSED_BW6_UNSUPPORTED_MARGIN',
    'FAIL_CLOSED_BW6_BW7_AUTHORITY_LEAK',
    'FAIL_CLOSED_BW6_BW8_AUTHORITY_LEAK',
    'FAIL_CLOSED_BW6_GRAHAM_MUTATION',
    'FAIL_CLOSED_BW6_QB_MUTATION',
    'FAIL_CLOSED_BW6_BET_STATUS_MUTATION',
    'FAIL_CLOSED_BW6_STAKE_MUTATION',
    'FAIL_CLOSED_BW6_PROTECTED_ARTIFACT_MUTATION',
  ],
  'fail-closed codes',
);
unique(contract.failClosedCodes, 'fail-closed codes');

const protectedAfter = Object.fromEntries(
  protectedFiles.map((file) => [path.relative(ROOT, file), sha256(file)]),
);
same(protectedAfter, protectedBefore, 'protected artifact changed during validation');

console.log(
  `WALTERS BW6 STAGE 1 VERIFY: PASS // CONTRACT LOCKED // ${snapshot.dataRows} SOURCE ROWS // ` +
    `${historical.developmentWindow.expectedCompletedGames} DEVELOPMENT + ` +
    `${historical.holdoutWindow.expectedCompletedGames} SEALED HOLDOUT // ` +
    `BW7/BW8 DEFERRED // NON-OPERATIONAL // ACTIVE ${active.season} W${String(active.week).padStart(2, '0')}`,
);

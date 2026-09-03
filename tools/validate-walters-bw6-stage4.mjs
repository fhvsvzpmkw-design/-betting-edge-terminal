#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, '..');
const CONTRACT_REL = 'data/walters/nfl/key-numbers/bw6-stage4-shadow-contract-v1.json';
const CURRENT_REL = 'data/walters/nfl/key-numbers/bw6-stage4-current-v1.json';
const ATTEMPTS_REL = 'data/walters/nfl/key-numbers/bw6-stage4/attempts';
const SNAPSHOTS_REL = 'data/walters/nfl/key-numbers/bw6-stage4/snapshots';
const RESULTS_REL = 'data/walters/nfl/key-numbers/bw6-stage4/results';
const CONTRACT_SHA256 = 'eaec9aee5ea1e8989fa1b1ce9081a57d1c51f6f6eaf5d45034e529c74807ec2a';
const STAGE = 'BW6.4';
const TIMEZONE = 'America/Vancouver';
const SHA_PATTERN = /^[0-9a-f]{64}$/;
const CYCLE_ID_PATTERN = /^bw6-4-\d{4}-w\d{2}-\d{4}-\d{2}-\d{2}-(?:scheduled|manual-equivalent)-run-[a-z0-9][a-z0-9._-]{0,47}-attempt-[1-9]\d*$/;
const ISO_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const PACIFIC_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const GAME_KEY_PATTERN = /^\d{4}-W\d{2}-[A-Z]{2,3}-[A-Z]{2,3}$/;

const AUTHORIZED_UPSTREAM = {
  stage1Contract: {
    path: 'data/walters/nfl/key-numbers/bw6-stage1-contract-v1.json',
    sha256: 'b8dda9eab7ad92a93db3abec5698f041108d3937cef63d56fc87b1f5fe77146f',
  },
  stage2ModelLock: {
    path: 'data/walters/nfl/key-numbers/bw6-stage2-model-lock-v1.json',
    sha256: 'd6b6c40fad6caefb5a6fd0d42d8a81341ac09f319612ed446c99df991e2c7151',
  },
  stage2Calibration: {
    path: 'data/walters/nfl/key-numbers/bw6-stage2-calibration-v1.json',
    sha256: 'af835e502492fea6489e9687d3fbaa28620455d1e3a3a5beb527343e13e0c897',
  },
  stage3HoldoutAudit: {
    path: 'data/walters/nfl/key-numbers/bw6-stage3-holdout-audit-v1.json',
    sha256: 'c9fac3870c15b5ac4c780c5777e26997a267b109335669dd0d14d97b427fd51a',
  },
  stage3R1Contract: {
    path: 'data/walters/nfl/key-numbers/bw6-stage3r1-diagnosis-contract-v1.json',
    sha256: '70dd281d5699623f936633521ba70f1837b331143a512c10f0a9405bfb9a100b',
  },
  stage3R1Diagnosis: {
    path: 'data/walters/nfl/key-numbers/bw6-stage3r1-recalibration-diagnosis-v1.json',
    sha256: '3adfd753fe13ab38f237f9a4d8876feb25e5bd79bb4fbadfbef13a647e214200',
  },
  stage3R2Contract: {
    path: 'data/walters/nfl/key-numbers/bw6-stage3r2-contract-v1.json',
    sha256: '8820e1004ff6998e761ea821c37d5612065f2c3f917f2843d138399bef603939',
  },
  stage3R2Audit: {
    path: 'data/walters/nfl/key-numbers/bw6-stage3r2-development-audit-v1.json',
    sha256: '07eb879bb3e7cdbb5a59e325d024c35a9006c65c86db58f2c62dd907eb68ece9',
  },
  stage3R2Freeze: {
    path: 'data/walters/nfl/key-numbers/bw6-stage3r2-model-freeze-v1.json',
    sha256: 'a7f6146277c1c367afa73fee9d6185e24ba96567d6e1f9635cf69fa2065e5b2b',
  },
};

const EXPECTED_RELEASE_ARTIFACTS = [
  CONTRACT_REL,
  'tools/run-walters-bw6-stage4.mjs',
  'tools/validate-walters-bw6-stage4.mjs',
  'tests/walters-bw6-stage4.test.mjs',
  '.github/workflows/walters-bw6-stage4.yml',
];

const EXPECTED_PROTECTED = [
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

const AUTHORITY_FALSE_KEYS = [
  'operational',
  'productionAuthority',
  'grahamFairMutationAllowed',
  'qbOrEmbeddedBaselineMutationAllowed',
  'uncertaintyOverlayMutationAllowed',
  'liveBoardMutationAllowed',
  'betStatusMutationAllowed',
  'stakeMutationAllowed',
  'marketInputsAllowed',
  'outcomeInputsAllowed',
  'weightedAdvantageAllowed',
  'crossZeroDeductionAllowed',
  'starOrPlayThresholdAllowed',
  'marketNormalizationAllowed',
];

const GAME_FIELDS = [
  'gameKey',
  'away',
  'home',
  'startTimePacific',
  'grahamExactFairHome',
  'grahamFairHome',
  'favoriteSide',
  'favoriteOrientedDisplayMargin',
  'mappingStatus',
  'relevantExactRows',
  'excludedBoundaries',
];

const ROW_FIELDS = ['margin', 'status', 'bookExact', 'stage2', 'stage3R2'];
const TERMINAL_ATTEMPT_STATES = [
  'CLEAN_QUALIFYING',
  'CLEAN_NONQUALIFYING_DUPLICATE',
  'CLEAN_NONQUALIFYING_SAME_DATE',
  'FAILED_RESET',
  'INCOMPLETE_RESET',
  'VALIDATION_ONLY',
];
const BLOCKED_STAGES = ['BW7', 'BW8', 'PRODUCTION_AUTHORITY'];

function parseArgs(argv) {
  let root = DEFAULT_ROOT;
  let requireOpenLiveMatch = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--root') {
      root = path.resolve(argv[index + 1] ?? '');
      index += 1;
    } else if (argv[index] === '--require-open-live-match') {
      requireOpenLiveMatch = true;
    } else {
      throw new Error(`unknown argument ${argv[index]}`);
    }
  }
  return {root, requireOpenLiveMatch};
}

function fail(message) {
  throw new Error(`WALTERS BW6 STAGE 4 VERIFY FAILED // ${message}`);
}

function ok(condition, message) {
  if (!condition) fail(message);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, normalize(value[key])]));
  }
  return value;
}

function same(actual, expected, message) {
  ok(JSON.stringify(normalize(actual)) === JSON.stringify(normalize(expected)), message);
}

function exactKeys(value, expected, message) {
  ok(isPlainObject(value), `${message}: not an object`);
  same(Object.keys(value).sort(), [...expected].sort(), `${message}: keys`);
}

function unique(values, message) {
  ok(new Set(values).size === values.length, message);
}

function isSha(value) {
  return typeof value === 'string' && SHA_PATTERN.test(value);
}

function isIsoInstant(value) {
  return typeof value === 'string' && ISO_INSTANT_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}

function isPacificDate(value) {
  return typeof value === 'string' && PACIFIC_DATE_PATTERN.test(value);
}

function finite(value, message) {
  ok(typeof value === 'number' && Number.isFinite(value), message);
}

function approximate(actual, expected, tolerance, message) {
  finite(actual, `${message}: actual is not finite`);
  finite(expected, `${message}: expected is not finite`);
  ok(Math.abs(actual - expected) <= tolerance, message);
}

function readJson(root, relative) {
  const file = path.join(root, relative);
  ok(fs.existsSync(file), `missing ${relative}`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`invalid JSON ${relative}: ${error.message}`);
  }
}

function hashFile(root, relative) {
  const file = path.join(root, relative);
  ok(fs.existsSync(file), `missing ${relative}`);
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function canonicalStringify(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    ok(Number.isFinite(value), 'canonical JSON contains a non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  ok(isPlainObject(value), 'canonical JSON contains an unsupported value');
  return `{${Object.keys(value).sort().map((key) => {
    ok(value[key] !== undefined, `canonical JSON contains undefined at ${key}`);
    return `${JSON.stringify(key)}:${canonicalStringify(value[key])}`;
  }).join(',')}}`;
}

function digest(value) {
  return crypto.createHash('sha256').update(canonicalStringify(value)).digest('hex');
}

function contentDigest(value) {
  ok(isPlainObject(value), 'content hash target is not an object');
  const payload = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== 'contentSha256Canonical'),
  );
  return digest(payload);
}

function assertContentDigest(value, label) {
  ok(isSha(value?.contentSha256Canonical), `${label}: missing canonical content hash`);
  ok(contentDigest(value) === value.contentSha256Canonical, `${label}: canonical content hash mismatch`);
}

function roundToGovernedHalf(value) {
  finite(value, 'Graham exact fair is not finite');
  const rounded = Math.round((value + Number.EPSILON) * 2) / 2;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function semanticGame(game) {
  return {
    gameKey: game.gameKey,
    away: game.away,
    home: game.home,
    startTimePacific: game.startTimePacific,
    grahamExactFairHome: game.grahamExactFairHome,
    grahamFairHome: game.grahamFairHome,
  };
}

function semanticBoard(numbers) {
  return {
    season: numbers.season,
    week: numbers.week,
    games: numbers.games.map(semanticGame),
  };
}

function expectedMapping(game) {
  finite(game.grahamExactFairHome, `${game.gameKey}: exact fair`);
  finite(game.grahamFairHome, `${game.gameKey}: displayed fair`);
  approximate(
    game.grahamFairHome,
    roundToGovernedHalf(game.grahamExactFairHome),
    1e-12,
    `${game.gameKey}: exact-to-display mismatch`,
  );
  ok(Number.isInteger(game.grahamFairHome * 2), `${game.gameKey}: display is not on half grid`);
  const displayed = game.grahamFairHome;
  const magnitude = Math.abs(displayed);
  const favoriteSide = displayed < 0 ? 'HOME' : displayed > 0 ? 'AWAY' : 'PICK';
  const relevantExactRows = [];
  const excludedBoundaries = [];
  if (magnitude === 0) {
    excludedBoundaries.push({margin: 0, reason: 'CROSS_ZERO_OUT_OF_SCOPE'});
  } else if (Number.isInteger(magnitude)) {
    if (magnitude >= 1 && magnitude <= 18) relevantExactRows.push(magnitude);
    else excludedBoundaries.push({margin: magnitude, reason: 'UNSUPPORTED_EXACT_MARGIN'});
  } else {
    for (const margin of [Math.floor(magnitude), Math.ceil(magnitude)]) {
      if (margin >= 1 && margin <= 18) relevantExactRows.push(margin);
      else {
        excludedBoundaries.push({
          margin,
          reason: margin === 0 ? 'CROSS_ZERO_OUT_OF_SCOPE' : 'UNSUPPORTED_EXACT_MARGIN',
        });
      }
    }
  }
  return {
    favoriteSide,
    favoriteOrientedDisplayMargin: magnitude,
    mappingStatus: relevantExactRows.length > 0 ? 'SUPPORTED_ROWS_IDENTIFIED' : 'FAIL_CLOSED_NO_SUPPORTED_ROW',
    relevantExactRows,
    excludedBoundaries,
  };
}

function listJsonFiles(root, relative, pattern) {
  const directory = path.join(root, relative);
  if (!fs.existsSync(directory)) return [];
  ok(fs.statSync(directory).isDirectory(), `${relative} is not a directory`);
  return fs.readdirSync(directory)
    .map((name) => {
      ok(!name.startsWith('.'), `${relative} contains hidden artifact ${name}`);
      const file = path.join(directory, name);
      ok(fs.statSync(file).isFile(), `${relative} contains non-file ${name}`);
      ok(pattern.test(name), `${relative} contains unexpected artifact ${name}`);
      return name;
    })
    .sort()
    .map((name) => `${relative}/${name}`);
}

function validateContract(root) {
  ok(hashFile(root, CONTRACT_REL) === CONTRACT_SHA256, 'Stage 4 contract raw hash');
  const contract = readJson(root, CONTRACT_REL);
  exactKeys(contract, [
    'schemaVersion', 'module', 'stage', 'status', 'generatedAt', 'timezone', 'prospectiveLock',
    'authorityBoundary', 'authorizedBy', 'inputContract', 'grahamRowMapping', 'allowedOutput',
    'cyclePlan', 'triggerAuthority', 'attemptLifecycle', 'releaseArtifacts', 'releaseFreezeRule',
    'protectedArtifacts', 'dynamicProtectedArtifacts', 'protectedArtifactRule', 'outputs', 'prohibitedOutputConcepts',
    'outcomeStates', 'blockedStages', 'nextGate',
  ], 'contract');
  ok(contract.schemaVersion === 'walters-bw6-stage4-shadow-contract-v1', 'contract schema');
  ok(contract.module === 'WALTERS_BW6_POINT_WEIGHT_CALIBRATION', 'contract module');
  ok(contract.stage === STAGE, 'contract stage');
  ok(
    contract.status === 'BW6_4_PROSPECTIVE_SHADOW_EXECUTION_CONTRACT_LOCKED_NON_OPERATIONAL',
    'contract status',
  );
  ok(contract.generatedAt === '2026-09-03T15:17:48Z', 'contract generatedAt');
  ok(contract.timezone === TIMEZONE, 'contract timezone');

  same(contract.prospectiveLock, {
    baseCommit: '82fb4a17c221cd73f75169d6208316aefa53d59d',
    baseMergedAt: '2026-09-03T15:13:41Z',
    postMergeR2WorkflowRunId: 33771413551,
    postMergeR2WorkflowConclusion: 'success',
    rule: 'This contract, its row mapping, cycle state machine, trigger authority and output boundary must be merged before any BW6.4 cycle may qualify. Pull-request, push and local executions are validation-only.',
  }, 'prospective lock');

  for (const key of AUTHORITY_FALSE_KEYS) {
    ok(contract.authorityBoundary?.[key] === false, `contract authority ${key}`);
  }
  ok(typeof contract.authorityBoundary?.purpose === 'string', 'contract authority purpose');

  for (const [name, expected] of Object.entries(AUTHORIZED_UPSTREAM)) {
    same(contract.authorizedBy?.[name], expected, `contract upstream binding ${name}`);
    ok(hashFile(root, expected.path) === expected.sha256, `upstream raw hash ${name}`);
  }
  ok(
    contract.authorizedBy.requiredR2Status ===
      'BW6_3R2_CANDIDATE_AND_PROSPECTIVE_PLAN_HASH_FROZEN',
    'required R2 status',
  );
  ok(contract.authorizedBy.selectedCandidateId === 'R2_FULL_DIRICHLET19', 'selected candidate');
  ok(
    contract.authorizedBy.selectedDistributionSha256 ===
      '4ab2db72d7fb6e5e07d1f127e80a3e654da9cfe79f309ebf4014a521fb2772e0',
    'selected distribution binding',
  );
  ok(
    contract.authorizedBy.prospectiveShadowPlanSha256 ===
      'e19ad2db934d6e07736b239b3fc313bc75ba05b68bc4051195cbe7d2200ce0ed',
    'prospective plan binding',
  );
  ok(contract.authorizedBy.originalStage3FailureOverridden === false, 'Stage 3 override boundary');
  ok(contract.authorizedBy.originalThreePointGateWaived === false, 'three-point waiver boundary');

  same(contract.inputContract.semanticFieldWhitelist, {
    activeWeek: ['state', 'season', 'week', 'timezone', 'authority'],
    currentNumbers: ['season', 'week'],
    game: ['gameKey', 'away', 'home', 'startTimePacific', 'grahamExactFairHome', 'grahamFairHome'],
  }, 'semantic whitelist');
  ok(contract.inputContract.resolveActiveWeekWithMarketFiles === false, 'market-free active week resolution');
  same(contract.inputContract.hashOnlyArtifactsMayNotBeParsed, [
    'data/live-odds.json',
    'data/walters/nfl/current-week-terminal.json',
  ], 'hash-only artifacts');
  ok(contract.inputContract.snapshotIdentity.algorithm.startsWith('SHA-256'), 'snapshot algorithm');
  same(contract.inputContract.snapshotIdentity.excluded, [
    'timestamps', 'run identifiers', 'commit identifiers', 'cycle ordinal', 'workflow trigger metadata',
  ], 'snapshot exclusions');

  ok(contract.grahamRowMapping.selectionField === 'grahamFairHome', 'row selection field');
  ok(contract.grahamRowMapping.auditOnlyField === 'grahamExactFairHome', 'row audit field');
  ok(contract.grahamRowMapping.displayGridIncrement === 0.5, 'display increment');
  ok(contract.grahamRowMapping.supportedRows?.minimum === 1, 'minimum supported row');
  ok(contract.grahamRowMapping.supportedRows?.maximum === 18, 'maximum supported row');
  ok(contract.grahamRowMapping.allActiveGamesRequired === true, 'all-games rule');
  ok(contract.grahamRowMapping.gameIdentityNormalizationAllowed === false, 'game identity boundary');
  same(contract.allowedOutput.gameFields, GAME_FIELDS, 'allowed game fields');
  same(contract.allowedOutput.rowFields, ROW_FIELDS, 'allowed row fields');
  ok(contract.allowedOutput.bookExactProvenance === 'WALTERS EXACT', 'BOOK provenance');
  ok(contract.allowedOutput.stage2Provenance === 'WALTERS CALIBRATED', 'Stage 2 provenance');
  ok(contract.allowedOutput.stage3R2Provenance === 'WALTERS BW6.3R2 FROZEN', 'R2 provenance');

  same(contract.cyclePlan, {
    minimumConsecutiveCleanCycles: 3,
    maximumQualifyingCyclesPerPacificCalendarDate: 1,
    minimumScheduledCyclesInAcceptedWindow: 2,
    maximumManualCyclesInAcceptedWindow: 1,
    distinctImmutableInputSnapshotsRequired: true,
    minimumChangedActiveWeekOrCurrentNumbersHashes: 1,
    identicalManualRerunsCount: false,
    failedOrIncompleteCycleResetsConsecutiveCount: true,
    cyclePurpose: 'Execution stability only; cycles do not provide statistical calibration or production authority.',
    acceptedWindowRule: 'Evaluate the trailing three consecutive qualifying clean cycles. They must occupy three distinct America/Vancouver dates, include at least two genuine first-attempt schedule events, contain three distinct input snapshot digests and contain at least one transition where the active-week or current-numbers raw SHA-256 changes.',
    initialCycleRule: 'The first clean cycle establishes the prospective baseline and need not demonstrate a prior input change.',
    duplicateInputRule: 'A duplicate input attempt is CLEAN_NONQUALIFYING_DUPLICATE and does not reset the clean streak because no cycle begins.',
    sameDateRule: 'An attempt after a qualifying cycle on the same Pacific date is CLEAN_NONQUALIFYING_SAME_DATE and does not reset the clean streak because no cycle begins.',
    failureRule: 'Any begun cycle that is failed, incomplete, cancelled after its durable START receipt, nondeterministic, unpublished, missing a required receipt, based on changed governing code/model hashes or mutates a protected artifact resets the consecutive clean count to zero.',
    passState: 'BW6_4_THREE_CYCLE_SHADOW_VALIDATED_PROSPECTIVE_OUTCOME_GATE_PENDING_NON_OPERATIONAL',
  }, 'cycle plan');
  same(contract.triggerAuthority.qualifyingEvents, ['schedule', 'workflow_dispatch'], 'qualifying triggers');
  same(contract.triggerAuthority.validationOnlyEvents, ['pull_request', 'push', 'local'], 'validation triggers');
  ok(contract.triggerAuthority.workflow === '.github/workflows/walters-bw6-stage4.yml', 'workflow path');
  ok(contract.triggerAuthority.scheduledCronUtc === '35 2 * * *', 'schedule cron');
  ok(contract.triggerAuthority.triggerClassMayBeSuppliedByUser === false, 'trigger spoof boundary');
  ok(contract.attemptLifecycle.startReceiptRequired === true, 'start receipt requirement');
  ok(contract.attemptLifecycle.remoteReadbackRequired === true, 'remote readback requirement');
  same(contract.attemptLifecycle.terminalAttemptStates, TERMINAL_ATTEMPT_STATES, 'attempt states');
  same(contract.releaseArtifacts, EXPECTED_RELEASE_ARTIFACTS, 'release artifacts');
  same(contract.protectedArtifacts, EXPECTED_PROTECTED, 'protected artifacts');
  same(contract.dynamicProtectedArtifacts, [
    'resolved active-week currentNumbers path',
    'resolved active-week personnelLedger path when present',
  ], 'dynamic protected artifacts');
  same(contract.outputs, {
    current: CURRENT_REL,
    weekResultPattern: 'data/walters/nfl/key-numbers/bw6-stage4-week-{WW}-shadow-v1.json',
    attemptPattern: `${ATTEMPTS_REL}/{cycleId}-start-v1.json`,
    snapshotPattern: `${SNAPSHOTS_REL}/{cycleId}-input-v1.json`,
    resultPattern: `${RESULTS_REL}/{cycleId}-shadow-v1.json`,
    appendOnlyArtifacts: ['attemptPattern', 'snapshotPattern', 'resultPattern'],
  }, 'output paths');
  same(contract.blockedStages, BLOCKED_STAGES, 'blocked stages');
  same(contract.outcomeStates, {
    ready: 'BW6_4_READY_FOR_FIRST_PROSPECTIVE_SHADOW_CYCLE_NON_OPERATIONAL',
    open: 'BW6_4_INCOMPLETE_ATTEMPT_OPEN_STREAK_RESET_NON_OPERATIONAL',
    clean: 'BW6_4_CYCLE_CLEAN_QUALIFYING_NON_OPERATIONAL',
    duplicate: 'BW6_4_CLEAN_NONQUALIFYING_DUPLICATE_INPUT_NON_OPERATIONAL',
    sameDate: 'BW6_4_CLEAN_NONQUALIFYING_SAME_PACIFIC_DATE_NON_OPERATIONAL',
    failed: 'BW6_4_FAILED_ATTEMPT_STREAK_RESET_NON_OPERATIONAL',
    validated: 'BW6_4_THREE_CYCLE_SHADOW_VALIDATED_PROSPECTIVE_OUTCOME_GATE_PENDING_NON_OPERATIONAL',
  }, 'outcome states');
  return contract;
}

function validateUpstream(root, contract) {
  const stage1 = readJson(root, AUTHORIZED_UPSTREAM.stage1Contract.path);
  const stage2Lock = readJson(root, AUTHORIZED_UPSTREAM.stage2ModelLock.path);
  const stage2 = readJson(root, AUTHORIZED_UPSTREAM.stage2Calibration.path);
  const stage3 = readJson(root, AUTHORIZED_UPSTREAM.stage3HoldoutAudit.path);
  const r1Contract = readJson(root, AUTHORIZED_UPSTREAM.stage3R1Contract.path);
  const r1 = readJson(root, AUTHORIZED_UPSTREAM.stage3R1Diagnosis.path);
  const r2Contract = readJson(root, AUTHORIZED_UPSTREAM.stage3R2Contract.path);
  const r2Audit = readJson(root, AUTHORIZED_UPSTREAM.stage3R2Audit.path);
  const r2 = readJson(root, AUTHORIZED_UPSTREAM.stage3R2Freeze.path);

  ok(stage1.status === 'CONTRACT_LOCKED_FOR_BW6_2_CALIBRATION_NON_OPERATIONAL', 'Stage 1 status');
  ok(stage1.operational === false && stage1.productionAuthority === false, 'Stage 1 authority');
  same(stage1.protectedArtifacts, EXPECTED_PROTECTED, 'Stage 1 protected paths');
  ok(stage2Lock.status === 'MODEL_SELECTED_AND_LOCKED_HOLDOUT_UNOPENED_NON_OPERATIONAL', 'Stage 2 lock status');
  ok(stage2Lock.holdoutViewed === false && stage2Lock.holdoutOutcomeFieldsRead === false, 'Stage 2 holdout seal');
  ok(stage2Lock.selectedModel?.modelId === 'BW6_FULL_DEVELOPMENT_POOL', 'Stage 2 locked model');
  ok(stage2.status === 'CURRENT_POINT_WEIGHTS_CALIBRATED_HOLDOUT_UNOPENED_NON_OPERATIONAL', 'Stage 2 calibration status');
  ok(stage2.selectedModelId === 'BW6_FULL_DEVELOPMENT_POOL', 'Stage 2 selected model');
  ok(stage2.protectedArtifactsUnchanged === true, 'Stage 2 protected artifacts');
  ok(stage3.status === 'BW6_3_FAIL_CLOSED_RECALIBRATION_REVIEW_REQUIRED', 'Stage 3 failure status');
  ok(stage3.summary?.holdoutPass === false, 'Stage 3 failed disposition');
  const aggregateGate = stage3.acceptanceChecks?.find((row) => row.id === 'BW6H-AGGREGATE-CALIBRATION');
  ok(aggregateGate?.pass === false, 'Stage 3 three-point gate remains failed');
  approximate(aggregateGate.actualErrorPercentagePoints, 3.43127, 1e-6, 'Stage 3 aggregate miss');
  ok(aggregateGate.maximum === 3, 'Stage 3 aggregate threshold');
  ok(stage3.nextStage === null, 'Stage 3 next stage remains closed');
  ok(r1Contract.status === 'BW6_3R1_DIAGNOSTIC_CONTRACT_LOCKED_NON_OPERATIONAL', 'R1 contract status');
  ok(r1.status === 'BW6_3R1_DIAGNOSIS_COMPLETE_RECALIBRATION_SPEC_REQUIRED_NON_OPERATIONAL', 'R1 status');
  ok(r2Contract.status === 'BW6_3R2_DEVELOPMENT_ONLY_RECALIBRATION_CONTRACT_LOCKED_NON_OPERATIONAL', 'R2 contract status');
  ok(r2Audit.status === 'BW6_3R2_CANDIDATE_SELECTED_FOR_BW6_4_PROSPECTIVE_SHADOW_ONLY_NON_OPERATIONAL', 'R2 audit status');
  ok(r2.status === contract.authorizedBy.requiredR2Status, 'R2 freeze status');
  ok(r2.selectedCandidateId === contract.authorizedBy.selectedCandidateId, 'R2 selected candidate');
  ok(r2.selectedDistributionSha256 === contract.authorizedBy.selectedDistributionSha256, 'R2 selected digest');
  ok(r2.prospectiveShadowPlanSha256 === contract.authorizedBy.prospectiveShadowPlanSha256, 'R2 plan digest');
  ok(digest(r2.selectedCategoryProbabilities) === r2.selectedDistributionSha256, 'R2 distribution digest recomputation');
  ok(digest(r2.prospectiveShadowPlan) === r2.prospectiveShadowPlanSha256, 'R2 plan digest recomputation');
  ok(r2.originalStage2DistributionRetained === true, 'R2 Stage 2 retention');
  ok(r2.originalStage3FailureOverridden === false, 'R2 Stage 3 override');
  ok(r2.originalThreePointGateWaived === false, 'R2 gate waiver');
  ok(r2.operational === false && r2.productionAuthority === false, 'R2 authority');
  same(r2.blockedStages, BLOCKED_STAGES, 'R2 blocked stages');
  ok(r2.allowedNextStage === 'BW6.4_PROSPECTIVE_ACTIVE_WEEK_SHADOW', 'R2 next stage');
  same(r2.prospectiveShadowPlan, r2Contract.bw6Stage4ProspectiveShadowPlan, 'R2 plan parity');
  ok(stage2.marginRows?.length === 18 && r2.marginRows?.length === 18, 'frozen margin row count');

  const rows = new Map();
  for (let index = 0; index < 18; index += 1) {
    const margin = index + 1;
    const stage2Row = stage2.marginRows[index];
    const r2Row = r2.marginRows[index];
    ok(stage2Row.margin === margin && r2Row.margin === margin, `margin ${margin}: ordering`);
    ok(stage2Row.currentCalibration?.supportStatus === 'CURRENT_SUPPORTED', `margin ${margin}: support`);
    ok(stage2Row.currentCalibration?.samplePass === true, `margin ${margin}: sample`);
    ok(stage2Row.currentCalibration?.intervalPass === true, `margin ${margin}: interval`);
    ok(stage2Row.currentCalibration?.stability?.pass === true, `margin ${margin}: stability`);
    approximate(r2Row.probability, stage2Row.currentCalibration.pointWeightProbability, 1e-12, `margin ${margin}: probability parity`);
    approximate(r2Row.percent, stage2Row.currentCalibration.pointWeightPercent, 1e-12, `margin ${margin}: percent parity`);
    same(r2Row.halfPointFairCosts, stage2Row.currentCalibration.halfPointFairCost, `margin ${margin}: cost parity`);
    ok(r2Row.deltaFromReferencePercentagePoints === 0, `margin ${margin}: reference delta`);
    rows.set(margin, {stage2: stage2Row, r2: r2Row});
  }
  return {stage1, stage2Lock, stage2, stage3, r1Contract, r1, r2Contract, r2Audit, r2, rows};
}

function validateLiveBoard(root, contract) {
  const activeRel = contract.inputContract.activeWeekManifest;
  const active = readJson(root, activeRel);
  exactKeys(
    Object.fromEntries(contract.inputContract.semanticFieldWhitelist.activeWeek.map((key) => [key, active[key]])),
    contract.inputContract.semanticFieldWhitelist.activeWeek,
    'active-week semantic view',
  );
  ok(active.state === 'ACTIVE', 'active-week state');
  ok(Number.isInteger(active.season) && active.season >= 2026, 'active-week season');
  ok(Number.isInteger(active.week) && active.week >= 1 && active.week <= 22, 'active-week week');
  ok(active.timezone === TIMEZONE, 'active-week timezone');
  ok(active.authority === 'GRAHAM_WEEK_ROLLOVER', 'active-week authority');
  const weekText = String(active.week).padStart(2, '0');
  const currentRel = `data/walters/nfl/${active.season}/week-${weekText}-current-numbers.json`;
  const numbers = readJson(root, currentRel);
  ok(numbers.season === active.season && numbers.week === active.week, 'current-numbers identity');
  ok(Array.isArray(numbers.games) && numbers.games.length > 0, 'active board games');
  unique(numbers.games.map((game) => game.gameKey), 'active board duplicate game keys');
  const mappings = new Map();
  for (const game of numbers.games) {
    for (const key of contract.inputContract.semanticFieldWhitelist.game) {
      ok(Object.hasOwn(game, key), `${game.gameKey ?? 'unknown game'}: missing semantic field ${key}`);
    }
    ok(typeof game.gameKey === 'string' && GAME_KEY_PATTERN.test(game.gameKey), 'game key');
    ok(typeof game.away === 'string' && /^[A-Z]{2,3}$/.test(game.away), `${game.gameKey}: away`);
    ok(typeof game.home === 'string' && /^[A-Z]{2,3}$/.test(game.home), `${game.gameKey}: home`);
    ok(game.away !== game.home, `${game.gameKey}: same team`);
    ok(typeof game.startTimePacific === 'string' && Number.isFinite(Date.parse(game.startTimePacific)), `${game.gameKey}: start time`);
    mappings.set(game.gameKey, expectedMapping(game));
  }
  const board = semanticBoard(numbers);
  const semanticFairBoardSha256 = digest(board);
  const activeWeekSha256 = hashFile(root, activeRel);
  const currentNumbersSha256 = hashFile(root, currentRel);
  const snapshotPayload = {
    season: active.season,
    week: active.week,
    activeWeekSha256,
    currentNumbersSha256,
    semanticFairBoardSha256,
  };
  return {
    activeRel,
    currentRel,
    active,
    numbers,
    board,
    mappings,
    activeWeekSha256,
    currentNumbersSha256,
    semanticFairBoardSha256,
    snapshotPayload,
    snapshotIdentitySha256: digest(snapshotPayload),
  };
}

function localDateKey(timestamp) {
  ok(isIsoInstant(timestamp), `invalid lifecycle timestamp ${timestamp}`);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function expectedCycleId(receipt) {
  const token = receipt.trigger.triggerClass.toLowerCase().replaceAll('_', '-');
  const run = String(receipt.trigger.runId)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .slice(0, 48);
  return `bw6-4-${receipt.inputBinding.season}-w${String(receipt.inputBinding.week).padStart(2, '0')}-${receipt.pacificDate}-${token}-run-${run}-attempt-${receipt.trigger.runAttempt}`;
}

function validateContractReference(value, message, expectedSha256 = CONTRACT_SHA256) {
  exactKeys(value, ['path', 'sha256'], message);
  ok(value.path === CONTRACT_REL, `${message}: path`);
  ok(isSha(value.sha256), `${message}: hash format`);
  if (expectedSha256 !== null) ok(value.sha256 === expectedSha256, `${message}: hash`);
}

function expectedUpstreamReferences() {
  return Object.fromEntries(
    Object.entries(AUTHORIZED_UPSTREAM).map(([name, binding]) => [name, {...binding}]),
  );
}

function validateUpstreamReferences(value, message) {
  same(value, expectedUpstreamReferences(), message);
}

function currentReleaseManifest(root, contract) {
  return Object.fromEntries(
    contract.releaseArtifacts.map((relative) => [relative, hashFile(root, relative)]),
  );
}

function validateReleaseManifest(value, expected, message, requireCurrentValues = true) {
  exactKeys(value, Object.keys(expected), message);
  for (const [relative, expectedHash] of Object.entries(expected)) {
    ok(isSha(value[relative]), `${message}: invalid hash ${relative}`);
    if (requireCurrentValues) {
      ok(value[relative] === expectedHash, `${message}: changed release artifact ${relative}`);
    }
  }
}

function personnelPathFor(season, week) {
  return `data/walters/nfl/${season}/week-${String(week).padStart(2, '0')}-personnel-ledger.json`;
}

function expectedProtectedPaths(root, contract, binding, supplied = {}, includeLiveOptional = false) {
  const paths = new Set(contract.protectedArtifacts);
  paths.add(binding.currentNumbersPath);
  const personnel = personnelPathFor(binding.season, binding.week);
  if (Object.hasOwn(supplied, personnel) || (includeLiveOptional && fs.existsSync(path.join(root, personnel)))) {
    paths.add(personnel);
  }
  return [...paths].sort();
}

function validateHashMap(root, contract, binding, value, message) {
  ok(isPlainObject(value), `${message}: not an object`);
  const expectedPaths = expectedProtectedPaths(root, contract, binding, value);
  exactKeys(value, expectedPaths, message);
  for (const [relative, sha256] of Object.entries(value)) {
    ok(isSha(sha256), `${message}: invalid SHA-256 for ${relative}`);
  }
}

function validateTrigger(value, message) {
  exactKeys(value, ['eventName', 'triggerClass', 'runId', 'runAttempt', 'scheduledQualifying'], message);
  ok(typeof value.eventName === 'string' && value.eventName.length > 0, `${message}: event name`);
  ok(typeof value.runId === 'string' && value.runId.length > 0, `${message}: run id`);
  ok(Number.isInteger(value.runAttempt) && value.runAttempt >= 1, `${message}: run attempt`);
  if (value.eventName === 'schedule' && value.runAttempt === 1) {
    ok(value.triggerClass === 'SCHEDULED', `${message}: scheduled classification`);
    ok(value.scheduledQualifying === true, `${message}: scheduled qualification`);
  } else if (value.eventName === 'schedule' || value.eventName === 'workflow_dispatch') {
    ok(value.triggerClass === 'MANUAL_EQUIVALENT', `${message}: manual-equivalent classification`);
    ok(value.scheduledQualifying === false, `${message}: manual-equivalent qualification`);
  } else {
    fail(`${message}: unauthorized attempt event ${value.eventName}`);
  }
}

function validateInputBinding(value, message) {
  exactKeys(value, [
    'season', 'week', 'activeWeekPath', 'activeWeekSha256', 'currentNumbersPath',
    'currentNumbersSha256', 'semanticFairBoardSha256', 'snapshotIdentitySha256',
  ], message);
  ok(Number.isInteger(value.season) && value.season >= 2026, `${message}: season`);
  ok(Number.isInteger(value.week) && value.week >= 1 && value.week <= 22, `${message}: week`);
  ok(value.activeWeekPath === 'data/walters/nfl/active-week.json', `${message}: active path`);
  ok(
    value.currentNumbersPath ===
      `data/walters/nfl/${value.season}/week-${String(value.week).padStart(2, '0')}-current-numbers.json`,
    `${message}: current-numbers path`,
  );
  for (const key of [
    'activeWeekSha256', 'currentNumbersSha256', 'semanticFairBoardSha256', 'snapshotIdentitySha256',
  ]) ok(isSha(value[key]), `${message}: ${key}`);
  const identity = {
    season: value.season,
    week: value.week,
    activeWeekSha256: value.activeWeekSha256,
    currentNumbersSha256: value.currentNumbersSha256,
    semanticFairBoardSha256: value.semanticFairBoardSha256,
  };
  ok(digest(identity) === value.snapshotIdentitySha256, `${message}: snapshot identity digest`);
}

function expectedRowComparison(margin, contract, upstream) {
  const pair = upstream.rows.get(margin);
  ok(pair, `missing frozen margin ${margin}`);
  const stage2 = pair.stage2;
  const r2 = pair.r2;
  const support = stage2.currentCalibration.supportStatus;
  return {
    margin,
    status: support === 'CURRENT_SUPPORTED' ? 'CURRENT_SUPPORTED' : `FAIL_CLOSED_${support ?? 'UNSUPPORTED'}`,
    bookExact: {
      pointWeightPercentPublishedRounded: stage2.bookExact.pointWeightPercentPublishedRounded,
      buyHalfPointFairCostUsdPer100: stage2.bookExact.buyHalfPointFairCostUsdPer100,
      provenance: contract.allowedOutput.bookExactProvenance,
    },
    stage2: {
      pointWeightProbability: stage2.currentCalibration.pointWeightProbability,
      pointWeightPercent: stage2.currentCalibration.pointWeightPercent,
      supportStatus: support,
      halfPointFairCost: stage2.currentCalibration.halfPointFairCost,
      provenance: contract.allowedOutput.stage2Provenance,
    },
    stage3R2: {
      candidateId: contract.authorizedBy.selectedCandidateId,
      pointWeightProbability: r2.probability,
      pointWeightPercent: r2.percent,
      supportStatus: support,
      halfPointFairCost: r2.halfPointFairCosts,
      provenance: contract.allowedOutput.stage3R2Provenance,
    },
  };
}

function validateRowComparison(value, expected, message) {
  exactKeys(value, ROW_FIELDS, message);
  exactKeys(value.bookExact, [
    'pointWeightPercentPublishedRounded', 'buyHalfPointFairCostUsdPer100', 'provenance',
  ], `${message}.bookExact`);
  exactKeys(value.stage2, [
    'pointWeightProbability', 'pointWeightPercent', 'supportStatus', 'halfPointFairCost', 'provenance',
  ], `${message}.stage2`);
  exactKeys(value.stage3R2, [
    'candidateId', 'pointWeightProbability', 'pointWeightPercent', 'supportStatus',
    'halfPointFairCost', 'provenance',
  ], `${message}.stage3R2`);
  for (const [label, costs] of [
    ['stage2', value.stage2.halfPointFairCost],
    ['stage3R2', value.stage3R2.halfPointFairCost],
  ]) {
    exactKeys(costs, [
      'buyOntoLossToPushExactUsdPer100', 'buyOntoLossToPushDisplayUsdPer100',
      'buyOffPushToWinExactUsdPer100', 'buyOffPushToWinDisplayUsdPer100',
    ], `${message}.${label}.halfPointFairCost`);
  }
  if (value.margin === 3) {
    exactKeys(value.bookExact.buyHalfPointFairCostUsdPer100, [
      'buyOffPushToWin', 'buyOntoLossToPush',
    ], `${message}.bookExact.buyHalfPointFairCostUsdPer100`);
  } else {
    finite(value.bookExact.buyHalfPointFairCostUsdPer100, `${message}: BOOK cost`);
  }
  same(value, expected, message);
}

function validateReceipt(root, contract, releaseManifest, relative) {
  const value = readJson(root, relative);
  assertContentDigest(value, relative);
  exactKeys(value, [
    'schemaVersion', 'cycleId', 'stage', 'lifecycleState', 'status', 'begunCycle',
    'preclassification', 'startedAt', 'pacificDate', 'trigger', 'sourceCommit', 'contract',
    'releaseArtifactSha256', 'upstream', 'inputBinding', 'protectedArtifactSha256Before',
    'priorCleanStreakCycleIds', 'terminalReasonCode', 'operational', 'productionAuthority',
    'marketInputsUsed', 'contentSha256Canonical',
  ], relative);
  ok(value.schemaVersion === 'walters-bw6-stage4-attempt-start-v1', `${relative}: schema`);
  ok(value.stage === STAGE, `${relative}: stage`);
  ok(
    typeof value.cycleId === 'string' && value.cycleId.length <= 160 && CYCLE_ID_PATTERN.test(value.cycleId),
    `${relative}: cycle id`,
  );
  ok(relative === `${ATTEMPTS_REL}/${value.cycleId}-start-v1.json`, `${relative}: filename`);
  ok(isIsoInstant(value.startedAt), `${relative}: startedAt`);
  ok(isPacificDate(value.pacificDate), `${relative}: pacificDate`);
  ok(localDateKey(value.startedAt) === value.pacificDate, `${relative}: Pacific date derivation`);
  validateTrigger(value.trigger, `${relative}.trigger`);
  validateInputBinding(value.inputBinding, `${relative}.inputBinding`);
  ok(value.cycleId === expectedCycleId(value), `${relative}: cycle id provenance`);
  ok(/^[0-9a-f]{40}$/.test(value.sourceCommit), `${relative}: source commit`);
  validateContractReference(value.contract, `${relative}.contract`, null);
  validateReleaseManifest(
    value.releaseArtifactSha256,
    releaseManifest,
    `${relative}.releaseArtifactSha256`,
    false,
  );
  ok(
    value.releaseArtifactSha256[CONTRACT_REL] === value.contract.sha256,
    `${relative}: release manifest contract binding`,
  );
  validateUpstreamReferences(value.upstream, `${relative}.upstream`);
  validateHashMap(
    root,
    contract,
    value.inputBinding,
    value.protectedArtifactSha256Before,
    `${relative}.protectedArtifactSha256Before`,
  );
  ok(Array.isArray(value.priorCleanStreakCycleIds), `${relative}: prior streak`);
  unique(value.priorCleanStreakCycleIds, `${relative}: duplicate prior streak ids`);
  for (const cycleId of value.priorCleanStreakCycleIds) {
    ok(typeof cycleId === 'string' && CYCLE_ID_PATTERN.test(cycleId), `${relative}: prior cycle id`);
  }
  ok(value.operational === false, `${relative}: operational`);
  ok(value.productionAuthority === false, `${relative}: production authority`);
  ok(value.marketInputsUsed === false, `${relative}: market inputs`);
  const candidates = ['CANDIDATE', 'CLEAN_NONQUALIFYING_DUPLICATE', 'CLEAN_NONQUALIFYING_SAME_DATE'];
  ok(candidates.includes(value.preclassification), `${relative}: preclassification`);
  if (value.preclassification === 'CANDIDATE') {
    ok(value.begunCycle === true, `${relative}: begun candidate`);
    ok(value.lifecycleState === 'STARTED', `${relative}: started lifecycle`);
    ok(value.status === contract.outcomeStates.open, `${relative}: open status`);
    ok(value.terminalReasonCode === null, `${relative}: candidate terminal reason`);
  } else {
    ok(value.begunCycle === false, `${relative}: nonqualifying begun flag`);
    ok(value.lifecycleState === value.preclassification, `${relative}: nonqualifying lifecycle`);
    ok(value.terminalReasonCode === value.preclassification, `${relative}: terminal reason`);
    const expectedStatus = value.preclassification === 'CLEAN_NONQUALIFYING_DUPLICATE'
      ? contract.outcomeStates.duplicate
      : contract.outcomeStates.sameDate;
    ok(value.status === expectedStatus, `${relative}: nonqualifying status`);
  }
  return {relative, value, rawSha256: hashFile(root, relative)};
}

function validateSnapshot(root, contract, receiptEntry, relative) {
  const value = readJson(root, relative);
  const receipt = receiptEntry.value;
  assertContentDigest(value, relative);
  exactKeys(value, [
    'schemaVersion', 'cycleId', 'stage', 'lifecycleState', 'capturedAt', 'pacificDate',
    'sourceCommit', 'inputIdentity', 'snapshotIdentitySha256', 'activeWeek', 'currentNumbers',
    'semanticFieldWhitelistApplied', 'hashOnlyArtifactsParsed', 'marketInputsUsed',
    'outcomeInputsUsed', 'contentSha256Canonical',
  ], relative);
  ok(value.schemaVersion === 'walters-bw6-stage4-input-snapshot-v1', `${relative}: schema`);
  ok(value.cycleId === receipt.cycleId, `${relative}: cycle id`);
  ok(relative === `${SNAPSHOTS_REL}/${value.cycleId}-input-v1.json`, `${relative}: filename`);
  ok(value.stage === STAGE, `${relative}: stage`);
  ok(value.lifecycleState === 'IMMUTABLE_INPUT_SNAPSHOT', `${relative}: lifecycle`);
  ok(value.capturedAt === receipt.startedAt, `${relative}: capturedAt`);
  ok(value.pacificDate === receipt.pacificDate, `${relative}: Pacific date`);
  ok(value.sourceCommit === receipt.sourceCommit, `${relative}: source commit`);
  exactKeys(value.inputIdentity, [
    'season', 'week', 'activeWeekSha256', 'currentNumbersSha256', 'semanticFairBoardSha256',
  ], `${relative}.inputIdentity`);
  same(value.inputIdentity, {
    season: receipt.inputBinding.season,
    week: receipt.inputBinding.week,
    activeWeekSha256: receipt.inputBinding.activeWeekSha256,
    currentNumbersSha256: receipt.inputBinding.currentNumbersSha256,
    semanticFairBoardSha256: receipt.inputBinding.semanticFairBoardSha256,
  }, `${relative}: input identity`);
  ok(digest(value.inputIdentity) === value.snapshotIdentitySha256, `${relative}: snapshot digest`);
  ok(value.snapshotIdentitySha256 === receipt.inputBinding.snapshotIdentitySha256, `${relative}: receipt snapshot binding`);

  exactKeys(value.activeWeek, ['path', 'sha256', 'semantic'], `${relative}.activeWeek`);
  ok(value.activeWeek.path === receipt.inputBinding.activeWeekPath, `${relative}: active path`);
  ok(value.activeWeek.sha256 === receipt.inputBinding.activeWeekSha256, `${relative}: active hash`);
  exactKeys(
    value.activeWeek.semantic,
    contract.inputContract.semanticFieldWhitelist.activeWeek,
    `${relative}.activeWeek.semantic`,
  );
  ok(value.activeWeek.semantic.state === 'ACTIVE', `${relative}: active state`);
  ok(value.activeWeek.semantic.season === receipt.inputBinding.season, `${relative}: active season`);
  ok(value.activeWeek.semantic.week === receipt.inputBinding.week, `${relative}: active week`);
  ok(value.activeWeek.semantic.timezone === TIMEZONE, `${relative}: active timezone`);
  ok(value.activeWeek.semantic.authority === 'GRAHAM_WEEK_ROLLOVER', `${relative}: active authority`);

  exactKeys(value.currentNumbers, ['path', 'sha256', 'semantic'], `${relative}.currentNumbers`);
  ok(value.currentNumbers.path === receipt.inputBinding.currentNumbersPath, `${relative}: numbers path`);
  ok(value.currentNumbers.sha256 === receipt.inputBinding.currentNumbersSha256, `${relative}: numbers hash`);
  exactKeys(value.currentNumbers.semantic, ['season', 'week', 'games'], `${relative}.currentNumbers.semantic`);
  ok(value.currentNumbers.semantic.season === receipt.inputBinding.season, `${relative}: numbers season`);
  ok(value.currentNumbers.semantic.week === receipt.inputBinding.week, `${relative}: numbers week`);
  ok(Array.isArray(value.currentNumbers.semantic.games) && value.currentNumbers.semantic.games.length > 0, `${relative}: games`);
  unique(value.currentNumbers.semantic.games.map((game) => game.gameKey), `${relative}: duplicate game keys`);
  for (const [index, game] of value.currentNumbers.semantic.games.entries()) {
    exactKeys(game, contract.inputContract.semanticFieldWhitelist.game, `${relative}.games[${index}]`);
    ok(typeof game.gameKey === 'string' && GAME_KEY_PATTERN.test(game.gameKey), `${relative}: game key`);
    ok(typeof game.away === 'string' && /^[A-Z]{2,3}$/.test(game.away), `${relative}: away team`);
    ok(typeof game.home === 'string' && /^[A-Z]{2,3}$/.test(game.home), `${relative}: home team`);
    ok(game.away !== game.home, `${relative}: duplicate team`);
    ok(typeof game.startTimePacific === 'string' && Number.isFinite(Date.parse(game.startTimePacific)), `${relative}: kickoff`);
    expectedMapping(game);
  }
  ok(
    digest(value.currentNumbers.semantic) === receipt.inputBinding.semanticFairBoardSha256,
    `${relative}: semantic fair-board digest`,
  );
  ok(value.semanticFieldWhitelistApplied === true, `${relative}: whitelist flag`);
  ok(value.hashOnlyArtifactsParsed === false, `${relative}: hash-only parse flag`);
  ok(value.marketInputsUsed === false, `${relative}: market flag`);
  ok(value.outcomeInputsUsed === false, `${relative}: outcome flag`);
  return {relative, value, rawSha256: hashFile(root, relative)};
}

function validateArtifactReference(value, expectedRelative, expectedEntry, message, includeSnapshotDigest = false) {
  const keys = ['path', 'sha256', 'contentSha256Canonical'];
  if (includeSnapshotDigest) keys.push('snapshotIdentitySha256');
  exactKeys(value, keys, message);
  ok(value.path === expectedRelative, `${message}: path`);
  ok(value.sha256 === expectedEntry.rawSha256, `${message}: raw hash`);
  ok(value.contentSha256Canonical === expectedEntry.value.contentSha256Canonical, `${message}: canonical hash`);
  if (includeSnapshotDigest) {
    ok(value.snapshotIdentitySha256 === expectedEntry.value.snapshotIdentitySha256, `${message}: snapshot digest`);
  }
}

function validateGameOutput(value, expectedGame, message) {
  exactKeys(value, GAME_FIELDS, message);
  const expected = {...semanticGame(expectedGame), ...expectedMapping(expectedGame)};
  same(value, expected, message);
}

function validateCleanResult(root, contract, upstream, releaseManifest, receiptEntry, snapshotEntry, relative) {
  const value = readJson(root, relative);
  const receipt = receiptEntry.value;
  const snapshot = snapshotEntry.value;
  assertContentDigest(value, relative);
  exactKeys(value, [
    'schemaVersion', 'cycleId', 'stage', 'lifecycleState', 'status', 'begunCycle', 'startedAt',
    'completedAt', 'pacificDate', 'trigger', 'sourceCommit', 'contract',
    'releaseArtifactSha256', 'upstream', 'startReceipt', 'inputSnapshot', 'operational',
    'productionAuthority', 'grahamFairMutationAllowed', 'qbOrEmbeddedBaselineMutationAllowed',
    'uncertaintyOverlayMutationAllowed', 'liveBoardMutationAllowed', 'betStatusMutationAllowed',
    'stakeMutationAllowed', 'marketInputsUsed', 'outcomeInputsUsed',
    'weightedAdvantageProduced', 'crossZeroCalculationProduced', 'games', 'rowComparisons',
    'summary', 'protectedArtifactSha256Before', 'protectedArtifactSha256After',
    'protectedArtifactsUnchanged', 'blockedStages', 'nextGate', 'contentSha256Canonical',
  ], relative);
  ok(value.schemaVersion === 'walters-bw6-stage4-result-v1', `${relative}: schema`);
  ok(value.cycleId === receipt.cycleId, `${relative}: cycle id`);
  ok(relative === `${RESULTS_REL}/${value.cycleId}-shadow-v1.json`, `${relative}: filename`);
  ok(value.stage === STAGE, `${relative}: stage`);
  ok(value.lifecycleState === 'CLEAN_QUALIFYING', `${relative}: lifecycle`);
  ok(value.status === contract.outcomeStates.clean, `${relative}: status`);
  ok(value.begunCycle === true && receipt.begunCycle === true, `${relative}: begun cycle`);
  ok(value.startedAt === receipt.startedAt, `${relative}: startedAt`);
  ok(isIsoInstant(value.completedAt), `${relative}: completedAt`);
  ok(Date.parse(value.completedAt) >= Date.parse(value.startedAt), `${relative}: completion precedes start`);
  ok(value.pacificDate === receipt.pacificDate, `${relative}: Pacific date`);
  same(value.trigger, receipt.trigger, `${relative}: trigger`);
  ok(value.sourceCommit === receipt.sourceCommit, `${relative}: source commit`);
  validateContractReference(value.contract, `${relative}.contract`, receipt.contract.sha256);
  validateReleaseManifest(
    value.releaseArtifactSha256,
    releaseManifest,
    `${relative}.releaseArtifactSha256`,
    false,
  );
  same(value.releaseArtifactSha256, receipt.releaseArtifactSha256, `${relative}: receipt release binding`);
  validateUpstreamReferences(value.upstream, `${relative}.upstream`);
  same(value.upstream, receipt.upstream, `${relative}: receipt upstream binding`);
  validateArtifactReference(
    value.startReceipt,
    receiptEntry.relative,
    receiptEntry,
    `${relative}.startReceipt`,
  );
  validateArtifactReference(
    value.inputSnapshot,
    snapshotEntry.relative,
    snapshotEntry,
    `${relative}.inputSnapshot`,
    true,
  );
  for (const key of [
    'operational', 'productionAuthority', 'grahamFairMutationAllowed',
    'qbOrEmbeddedBaselineMutationAllowed', 'uncertaintyOverlayMutationAllowed',
    'liveBoardMutationAllowed', 'betStatusMutationAllowed', 'stakeMutationAllowed',
    'marketInputsUsed', 'outcomeInputsUsed', 'weightedAdvantageProduced',
    'crossZeroCalculationProduced',
  ]) ok(value[key] === false, `${relative}: forbidden authority ${key}`);

  ok(Array.isArray(value.games), `${relative}: games`);
  ok(value.games.length === snapshot.currentNumbers.semantic.games.length, `${relative}: game count`);
  for (let index = 0; index < value.games.length; index += 1) {
    validateGameOutput(
      value.games[index],
      snapshot.currentNumbers.semantic.games[index],
      `${relative}.games[${index}]`,
    );
  }
  const margins = [...new Set(value.games.flatMap((game) => game.relevantExactRows))].sort((a, b) => a - b);
  ok(Array.isArray(value.rowComparisons), `${relative}: row comparisons`);
  ok(value.rowComparisons.length === margins.length, `${relative}: row comparison count`);
  for (let index = 0; index < margins.length; index += 1) {
    validateRowComparison(
      value.rowComparisons[index],
      expectedRowComparison(margins[index], contract, upstream),
      `${relative}.rowComparisons[${index}]`,
    );
  }
  exactKeys(value.summary, [
    'activeGames', 'gamesWithSupportedRows', 'gamesFailClosedWithoutSupportedRow',
    'distinctSupportedRows',
  ], `${relative}.summary`);
  same(value.summary, {
    activeGames: value.games.length,
    gamesWithSupportedRows: value.games.filter((game) => game.relevantExactRows.length > 0).length,
    gamesFailClosedWithoutSupportedRow: value.games.filter((game) => game.relevantExactRows.length === 0).length,
    distinctSupportedRows: margins.length,
  }, `${relative}: summary`);
  validateHashMap(
    root,
    contract,
    receipt.inputBinding,
    value.protectedArtifactSha256Before,
    `${relative}.protectedArtifactSha256Before`,
  );
  validateHashMap(
    root,
    contract,
    receipt.inputBinding,
    value.protectedArtifactSha256After,
    `${relative}.protectedArtifactSha256After`,
  );
  same(value.protectedArtifactSha256Before, receipt.protectedArtifactSha256Before, `${relative}: protected-before receipt binding`);
  same(value.protectedArtifactSha256After, value.protectedArtifactSha256Before, `${relative}: protected artifacts changed`);
  ok(value.protectedArtifactsUnchanged === true, `${relative}: protected unchanged flag`);
  same(value.blockedStages, BLOCKED_STAGES, `${relative}: blocked stages`);
  ok(value.nextGate === contract.nextGate, `${relative}: next gate`);
  return {relative, value, rawSha256: hashFile(root, relative)};
}

function validateFailedResult(root, contract, releaseManifest, receiptEntry, relative) {
  const value = readJson(root, relative);
  const receipt = receiptEntry.value;
  assertContentDigest(value, relative);
  exactKeys(value, [
    'schemaVersion', 'cycleId', 'stage', 'lifecycleState', 'status', 'begunCycle', 'startedAt',
    'completedAt', 'pacificDate', 'trigger', 'sourceCommit', 'contract',
    'releaseArtifactSha256', 'upstream', 'startReceipt', 'inputSnapshot', 'failure',
    'operational', 'productionAuthority', 'grahamFairMutationAllowed', 'liveBoardMutationAllowed',
    'betStatusMutationAllowed', 'stakeMutationAllowed', 'marketInputsUsed', 'outcomeInputsUsed',
    'protectedArtifactSha256Before', 'protectedArtifactSha256After',
    'protectedArtifactsUnchanged', 'blockedStages', 'nextGate', 'contentSha256Canonical',
  ], relative);
  ok(value.schemaVersion === 'walters-bw6-stage4-result-v1', `${relative}: schema`);
  ok(value.cycleId === receipt.cycleId, `${relative}: cycle id`);
  ok(relative === `${RESULTS_REL}/${value.cycleId}-shadow-v1.json`, `${relative}: filename`);
  ok(value.stage === STAGE, `${relative}: stage`);
  ok(value.lifecycleState === 'FAILED_RESET', `${relative}: lifecycle`);
  ok(value.status === contract.outcomeStates.failed, `${relative}: status`);
  ok(value.begunCycle === true && receipt.begunCycle === true, `${relative}: begun cycle`);
  ok(value.startedAt === receipt.startedAt, `${relative}: startedAt`);
  ok(isIsoInstant(value.completedAt), `${relative}: completedAt`);
  ok(Date.parse(value.completedAt) >= Date.parse(value.startedAt), `${relative}: completion precedes start`);
  ok(value.pacificDate === receipt.pacificDate, `${relative}: Pacific date`);
  same(value.trigger, receipt.trigger, `${relative}: trigger`);
  ok(value.sourceCommit === receipt.sourceCommit, `${relative}: source commit`);
  validateContractReference(value.contract, `${relative}.contract`, receipt.contract.sha256);
  validateReleaseManifest(
    value.releaseArtifactSha256,
    releaseManifest,
    `${relative}.releaseArtifactSha256`,
    false,
  );
  same(value.releaseArtifactSha256, receipt.releaseArtifactSha256, `${relative}: receipt release binding`);
  validateUpstreamReferences(value.upstream, `${relative}.upstream`);
  same(value.upstream, receipt.upstream, `${relative}: receipt upstream binding`);
  validateArtifactReference(
    value.startReceipt,
    receiptEntry.relative,
    receiptEntry,
    `${relative}.startReceipt`,
  );
  ok(value.inputSnapshot === null, `${relative}: failed result snapshot reference`);
  exactKeys(value.failure, ['code', 'message'], `${relative}.failure`);
  ok(typeof value.failure.code === 'string' && /^[A-Z0-9_]{3,120}$/.test(value.failure.code), `${relative}: failure code`);
  ok(typeof value.failure.message === 'string' && value.failure.message.length > 0 && value.failure.message.length <= 500, `${relative}: failure message`);
  for (const key of [
    'operational', 'productionAuthority', 'grahamFairMutationAllowed', 'liveBoardMutationAllowed',
    'betStatusMutationAllowed', 'stakeMutationAllowed', 'marketInputsUsed', 'outcomeInputsUsed',
  ]) ok(value[key] === false, `${relative}: forbidden authority ${key}`);
  validateHashMap(
    root,
    contract,
    receipt.inputBinding,
    value.protectedArtifactSha256Before,
    `${relative}.protectedArtifactSha256Before`,
  );
  validateHashMap(
    root,
    contract,
    receipt.inputBinding,
    value.protectedArtifactSha256After,
    `${relative}.protectedArtifactSha256After`,
  );
  same(value.protectedArtifactSha256Before, receipt.protectedArtifactSha256Before, `${relative}: protected-before receipt binding`);
  const unchanged = JSON.stringify(normalize(value.protectedArtifactSha256Before)) ===
    JSON.stringify(normalize(value.protectedArtifactSha256After));
  ok(value.protectedArtifactsUnchanged === unchanged, `${relative}: protected unchanged flag`);
  same(value.blockedStages, BLOCKED_STAGES, `${relative}: blocked stages`);
  ok(value.nextGate === contract.nextGate, `${relative}: next gate`);
  return {relative, value, rawSha256: hashFile(root, relative)};
}

function attemptSummary(receiptEntry, resultEntry) {
  const receipt = receiptEntry.value;
  const lifecycleState = resultEntry?.value.lifecycleState ??
    (receipt.begunCycle ? 'INCOMPLETE_RESET' : receipt.lifecycleState);
  return {
    cycleId: receipt.cycleId,
    pacificDate: receipt.pacificDate,
    triggerClass: receipt.trigger.triggerClass,
    scheduledQualifying: receipt.trigger.scheduledQualifying,
    snapshotIdentitySha256: receipt.inputBinding.snapshotIdentitySha256,
    activeWeekSha256: receipt.inputBinding.activeWeekSha256,
    currentNumbersSha256: receipt.inputBinding.currentNumbersSha256,
    lifecycleState,
    startReceiptPath: receiptEntry.relative,
    resultPath: resultEntry?.relative ?? null,
  };
}

function acceptedWindowFor(cleanStreak, contract) {
  const required = contract.cyclePlan.minimumConsecutiveCleanCycles;
  const trailing = cleanStreak.slice(-required);
  const dates = new Set(trailing.map((item) => item.pacificDate));
  const snapshots = new Set(trailing.map((item) => item.snapshotIdentitySha256));
  const scheduledCycles = trailing.filter((item) => item.scheduledQualifying).length;
  let changedInputTransitions = 0;
  for (let index = 1; index < trailing.length; index += 1) {
    if (
      trailing[index].activeWeekSha256 !== trailing[index - 1].activeWeekSha256 ||
      trailing[index].currentNumbersSha256 !== trailing[index - 1].currentNumbersSha256
    ) changedInputTransitions += 1;
  }
  const accepted = trailing.length === required &&
    dates.size === required &&
    snapshots.size === required &&
    scheduledCycles >= contract.cyclePlan.minimumScheduledCyclesInAcceptedWindow &&
    trailing.length - scheduledCycles <= contract.cyclePlan.maximumManualCyclesInAcceptedWindow &&
    changedInputTransitions >= contract.cyclePlan.minimumChangedActiveWeekOrCurrentNumbersHashes;
  if (trailing.length !== required) return {value: null, accepted, scheduledCycles};
  return {
    value: {
      cycleIds: trailing.map((item) => item.cycleId),
      pacificDates: trailing.map((item) => item.pacificDate),
      scheduledCycles,
      manualEquivalentCycles: trailing.length - scheduledCycles,
      distinctSnapshotDigests: snapshots.size,
      changedInputTransitions,
      accepted,
    },
    accepted,
    scheduledCycles,
  };
}

function discoverLifecycle(root, contract, upstream, releaseManifest, live, requireOpenLiveMatch) {
  const receiptPaths = listJsonFiles(root, ATTEMPTS_REL, /^bw6-4-.+-start-v1\.json$/);
  const snapshotPaths = listJsonFiles(root, SNAPSHOTS_REL, /^bw6-4-.+-input-v1\.json$/);
  const resultPaths = listJsonFiles(root, RESULTS_REL, /^bw6-4-.+-shadow-v1\.json$/);
  const receipts = receiptPaths.map((relative) => validateReceipt(root, contract, releaseManifest, relative));
  unique(receipts.map((entry) => entry.value.cycleId), 'duplicate receipt cycle IDs');
  receipts.sort((left, right) => {
    const delta = Date.parse(left.value.startedAt) - Date.parse(right.value.startedAt);
    return delta || left.value.cycleId.localeCompare(right.value.cycleId);
  });
  for (let index = 1; index < receipts.length; index += 1) {
    ok(receipts[index - 1].value.startedAt !== receipts[index].value.startedAt, 'ambiguous equal receipt timestamps');
  }
  const receiptById = new Map(receipts.map((entry) => [entry.value.cycleId, entry]));
  const snapshotPathById = new Map();
  for (const relative of snapshotPaths) {
    const cycleId = path.basename(relative).replace(/-input-v1\.json$/, '');
    ok(receiptById.has(cycleId), `${relative}: snapshot without receipt`);
    ok(!snapshotPathById.has(cycleId), `${relative}: duplicate snapshot`);
    snapshotPathById.set(cycleId, relative);
  }
  const resultPathById = new Map();
  for (const relative of resultPaths) {
    const cycleId = path.basename(relative).replace(/-shadow-v1\.json$/, '');
    ok(receiptById.has(cycleId), `${relative}: result without receipt`);
    ok(!resultPathById.has(cycleId), `${relative}: duplicate result`);
    resultPathById.set(cycleId, relative);
  }

  const historicalAttempts = [];
  const resultById = new Map();
  const snapshotById = new Map();
  let epochDigest = null;
  let epochQualifyingDates = new Set();
  let epochCleanStreak = [];
  let globalOpenAttempt = null;

  for (let index = 0; index < receipts.length; index += 1) {
    const receiptEntry = receipts[index];
    const receipt = receiptEntry.value;
    const receiptEpochDigest = digest(receipt.releaseArtifactSha256);
    if (receiptEpochDigest !== epochDigest) {
      epochDigest = receiptEpochDigest;
      epochQualifyingDates = new Set();
      epochCleanStreak = [];
    }
    ok(globalOpenAttempt === null, `${receiptEntry.relative}: prior begun attempt remains incomplete`);
    same(
      receipt.priorCleanStreakCycleIds,
      epochCleanStreak.map((item) => item.cycleId),
      `${receiptEntry.relative}: prior clean-streak binding`,
    );
    const duplicate = epochCleanStreak.some(
      (item) => item.snapshotIdentitySha256 === receipt.inputBinding.snapshotIdentitySha256,
    );
    const sameDate = epochQualifyingDates.has(receipt.pacificDate);
    const expectedPreclassification = duplicate
      ? 'CLEAN_NONQUALIFYING_DUPLICATE'
      : sameDate
        ? 'CLEAN_NONQUALIFYING_SAME_DATE'
        : 'CANDIDATE';
    ok(receipt.preclassification === expectedPreclassification, `${receiptEntry.relative}: preclassification recomputation`);

    const snapshotRelative = snapshotPathById.get(receipt.cycleId);
    const resultRelative = resultPathById.get(receipt.cycleId);
    let snapshotEntry = null;
    let resultEntry = null;
    if (snapshotRelative) {
      ok(receipt.begunCycle === true, `${snapshotRelative}: snapshot for non-begun attempt`);
      snapshotEntry = validateSnapshot(root, contract, receiptEntry, snapshotRelative);
      snapshotById.set(receipt.cycleId, snapshotEntry);
    }

    if (!receipt.begunCycle) {
      ok(!snapshotRelative, `${receiptEntry.relative}: nonqualifying snapshot`);
      ok(!resultRelative, `${receiptEntry.relative}: nonqualifying result`);
      resultEntry = null;
    } else if (resultRelative) {
      const preliminary = readJson(root, resultRelative);
      if (preliminary.lifecycleState === 'CLEAN_QUALIFYING') {
        ok(snapshotEntry, `${resultRelative}: clean result missing snapshot`);
        resultEntry = validateCleanResult(
          root,
          contract,
          upstream,
          releaseManifest,
          receiptEntry,
          snapshotEntry,
          resultRelative,
        );
      } else if (preliminary.lifecycleState === 'FAILED_RESET') {
        ok(!snapshotEntry, `${resultRelative}: failed result must not have an input snapshot`);
        resultEntry = validateFailedResult(root, contract, releaseManifest, receiptEntry, resultRelative);
      } else {
        fail(`${resultRelative}: invalid result lifecycle ${preliminary.lifecycleState}`);
      }
      resultById.set(receipt.cycleId, resultEntry);
      ok(
        index === receipts.length - 1 ||
          Date.parse(resultEntry.value.completedAt) <= Date.parse(receipts[index + 1].value.startedAt),
        `${resultRelative}: completion overlaps next attempt`,
      );
    }

    const summary = attemptSummary(receiptEntry, resultEntry);
    historicalAttempts.push({summary, receiptEntry, resultEntry});
    if (summary.lifecycleState === 'CLEAN_QUALIFYING') {
      epochCleanStreak.push(summary);
      epochQualifyingDates.add(summary.pacificDate);
    } else if (summary.lifecycleState === 'FAILED_RESET') {
      epochCleanStreak = [];
    } else if (
      summary.lifecycleState === 'CLEAN_NONQUALIFYING_DUPLICATE' ||
      summary.lifecycleState === 'CLEAN_NONQUALIFYING_SAME_DATE'
    ) {
      // A nonqualifying terminal attempt does not begin or reset an epoch streak.
    } else {
      epochCleanStreak = [];
      globalOpenAttempt = {
        cycleId: receipt.cycleId,
        startedAt: receipt.startedAt,
        startReceiptPath: receiptEntry.relative,
        lifecycleState: 'INCOMPLETE_RESET',
      };
    }
  }

  const attempts = [];
  let cleanStreak = [];
  let activeAttempt = null;
  let lastCurrentEpochTimestamp = null;
  for (const historical of historicalAttempts) {
    ok(activeAttempt === null, `${historical.receiptEntry.relative}: prior active attempt was overwritten`);
    const receipt = historical.receiptEntry.value;
    const matchesCurrentRelease =
      JSON.stringify(normalize(receipt.releaseArtifactSha256)) === JSON.stringify(normalize(releaseManifest));
    const summary = {...historical.summary};
    if (!matchesCurrentRelease) {
      summary.releaseArtifactMismatch = true;
      if (summary.lifecycleState !== 'INCOMPLETE_RESET') summary.lifecycleState = 'FAILED_RESET';
    }
    attempts.push(summary);
    if (summary.lifecycleState === 'CLEAN_QUALIFYING') {
      cleanStreak.push(summary);
      activeAttempt = null;
      if (matchesCurrentRelease) lastCurrentEpochTimestamp = historical.resultEntry.value.completedAt;
    } else if (
      summary.lifecycleState === 'CLEAN_NONQUALIFYING_DUPLICATE' ||
      summary.lifecycleState === 'CLEAN_NONQUALIFYING_SAME_DATE'
    ) {
      activeAttempt = null;
      lastCurrentEpochTimestamp = receipt.startedAt;
    } else if (summary.lifecycleState === 'FAILED_RESET') {
      cleanStreak = [];
      activeAttempt = null;
      if (matchesCurrentRelease) lastCurrentEpochTimestamp = historical.resultEntry.value.completedAt;
    } else {
      cleanStreak = [];
      activeAttempt = {
        cycleId: receipt.cycleId,
        startedAt: receipt.startedAt,
        startReceiptPath: historical.receiptEntry.relative,
        lifecycleState: 'INCOMPLETE_RESET',
      };
      if (matchesCurrentRelease) lastCurrentEpochTimestamp = receipt.startedAt;
    }
  }

  if (requireOpenLiveMatch) {
    ok(activeAttempt, '--require-open-live-match requires an OPEN begun attempt');
    const open = receiptById.get(activeAttempt.cycleId).value;
    const expectedBinding = {
      season: live.active.season,
      week: live.active.week,
      activeWeekPath: live.activeRel,
      activeWeekSha256: live.activeWeekSha256,
      currentNumbersPath: live.currentRel,
      currentNumbersSha256: live.currentNumbersSha256,
      semanticFairBoardSha256: live.semanticFairBoardSha256,
      snapshotIdentitySha256: live.snapshotIdentitySha256,
    };
    same(open.inputBinding, expectedBinding, `${activeAttempt.cycleId}: open input live readback`);
    const actualProtected = Object.fromEntries(
      expectedProtectedPaths(
        root,
        contract,
        open.inputBinding,
        open.protectedArtifactSha256Before,
        true,
      )
        .map((relative) => [relative, hashFile(root, relative)]),
    );
    same(
      open.protectedArtifactSha256Before,
      actualProtected,
      `${activeAttempt.cycleId}: open protected-artifact live readback`,
    );
  }

  const window = acceptedWindowFor(cleanStreak, contract);
  return {
    receipts,
    receiptById,
    snapshotById,
    resultById,
    historicalAttempts,
    attempts,
    cleanStreak,
    activeAttempt,
    acceptedWindow: window.value,
    accepted: window.accepted,
    scheduledCycles: window.scheduledCycles,
    lastCurrentEpochTimestamp,
  };
}

function expectedCurrentStatus(contract, lifecycle) {
  if (lifecycle.activeAttempt) return contract.outcomeStates.open;
  if (lifecycle.accepted) return contract.outcomeStates.validated;
  const latest = lifecycle.attempts.at(-1);
  if (!latest) return contract.outcomeStates.ready;
  if (latest.lifecycleState === 'CLEAN_QUALIFYING') return contract.outcomeStates.clean;
  if (latest.lifecycleState === 'CLEAN_NONQUALIFYING_DUPLICATE') return contract.outcomeStates.duplicate;
  if (latest.lifecycleState === 'CLEAN_NONQUALIFYING_SAME_DATE') return contract.outcomeStates.sameDate;
  if (latest.lifecycleState === 'FAILED_RESET') return contract.outcomeStates.failed;
  return contract.outcomeStates.open;
}

function validateAttemptSummary(value, expected, message) {
  const keys = [
    'cycleId', 'pacificDate', 'triggerClass', 'scheduledQualifying',
    'snapshotIdentitySha256', 'activeWeekSha256', 'currentNumbersSha256',
    'lifecycleState', 'startReceiptPath', 'resultPath',
  ];
  if (expected.releaseArtifactMismatch === true) keys.push('releaseArtifactMismatch');
  exactKeys(value, keys, message);
  same(value, expected, message);
}

function validateCurrent(root, contract, releaseManifest, lifecycle) {
  const current = readJson(root, CURRENT_REL);
  assertContentDigest(current, CURRENT_REL);
  exactKeys(current, [
    'schemaVersion', 'module', 'stage', 'status', 'updatedAt', 'operational',
    'productionAuthority', 'grahamFairMutationAllowed', 'liveBoardMutationAllowed',
    'betStatusMutationAllowed', 'stakeMutationAllowed', 'marketInputsAllowed',
    'outcomeInputsAllowed', 'contract', 'releaseArtifactSha256', 'selectedCandidateId',
    'selectedDistributionSha256', 'prospectiveShadowPlanSha256', 'activeAttempt',
    'attempts', 'cleanStreak', 'acceptedWindow', 'summary', 'blockedStages', 'nextGate',
    'contentSha256Canonical',
  ], CURRENT_REL);
  ok(current.schemaVersion === 'walters-bw6-stage4-current-v1', 'current schema');
  ok(current.module === contract.module, 'current module');
  ok(current.stage === STAGE, 'current stage');
  ok(current.status === expectedCurrentStatus(contract, lifecycle), 'current status');
  ok(isIsoInstant(current.updatedAt), 'current updatedAt format');
  if (lifecycle.lastCurrentEpochTimestamp !== null) {
    ok(current.updatedAt === lifecycle.lastCurrentEpochTimestamp, 'current updatedAt');
  } else if (lifecycle.receipts.length === 0) {
    ok(current.updatedAt === contract.generatedAt, 'initial current updatedAt');
  } else {
    const lastHistoricalTimestamp = Math.max(...lifecycle.historicalAttempts.map((entry) =>
      Date.parse(entry.resultEntry?.value.completedAt ?? entry.receiptEntry.value.startedAt)));
    ok(Date.parse(current.updatedAt) >= lastHistoricalTimestamp, 'release-reset current updatedAt');
  }
  for (const key of [
    'operational', 'productionAuthority', 'grahamFairMutationAllowed', 'liveBoardMutationAllowed',
    'betStatusMutationAllowed', 'stakeMutationAllowed', 'marketInputsAllowed', 'outcomeInputsAllowed',
  ]) ok(current[key] === false, `current forbidden authority ${key}`);
  validateContractReference(current.contract, 'current.contract');
  validateReleaseManifest(current.releaseArtifactSha256, releaseManifest, 'current.releaseArtifactSha256');
  ok(current.selectedCandidateId === contract.authorizedBy.selectedCandidateId, 'current candidate');
  ok(current.selectedDistributionSha256 === contract.authorizedBy.selectedDistributionSha256, 'current distribution');
  ok(current.prospectiveShadowPlanSha256 === contract.authorizedBy.prospectiveShadowPlanSha256, 'current plan');
  if (lifecycle.activeAttempt === null) {
    ok(current.activeAttempt === null, 'current active attempt');
  } else {
    exactKeys(current.activeAttempt, [
      'cycleId', 'startedAt', 'startReceiptPath', 'lifecycleState',
    ], 'current.activeAttempt');
    same(current.activeAttempt, lifecycle.activeAttempt, 'current active attempt');
  }
  ok(Array.isArray(current.attempts), 'current attempts');
  ok(current.attempts.length === lifecycle.attempts.length, 'current attempt count');
  for (let index = 0; index < lifecycle.attempts.length; index += 1) {
    validateAttemptSummary(current.attempts[index], lifecycle.attempts[index], `current.attempts[${index}]`);
  }
  ok(Array.isArray(current.cleanStreak), 'current clean streak');
  ok(current.cleanStreak.length === lifecycle.cleanStreak.length, 'current clean-streak count');
  for (let index = 0; index < lifecycle.cleanStreak.length; index += 1) {
    validateAttemptSummary(current.cleanStreak[index], lifecycle.cleanStreak[index], `current.cleanStreak[${index}]`);
  }
  if (lifecycle.acceptedWindow === null) {
    ok(current.acceptedWindow === null, 'current accepted window');
  } else {
    exactKeys(current.acceptedWindow, [
      'cycleIds', 'pacificDates', 'scheduledCycles', 'manualEquivalentCycles',
      'distinctSnapshotDigests', 'changedInputTransitions', 'accepted',
    ], 'current.acceptedWindow');
    same(current.acceptedWindow, lifecycle.acceptedWindow, 'current accepted window');
  }
  exactKeys(current.summary, [
    'attempts', 'qualifyingCleanCyclesSinceReset', 'scheduledCyclesInTrailingWindow',
    'acceptedWindowReady',
  ], 'current.summary');
  same(current.summary, {
    attempts: lifecycle.attempts.length,
    qualifyingCleanCyclesSinceReset: lifecycle.cleanStreak.length,
    scheduledCyclesInTrailingWindow: lifecycle.scheduledCycles,
    acceptedWindowReady: lifecycle.accepted,
  }, 'current summary');
  same(current.blockedStages, BLOCKED_STAGES, 'current blocked stages');
  ok(current.nextGate === contract.nextGate, 'current next gate');
  return current;
}

function latestCleanResultForWeek(lifecycle, week) {
  return [...lifecycle.resultById.values()]
    .filter((entry) => entry.value.lifecycleState === 'CLEAN_QUALIFYING')
    .filter((entry) => lifecycle.receiptById.get(entry.value.cycleId)?.value.inputBinding.week === week)
    .sort((left, right) => Date.parse(left.value.completedAt) - Date.parse(right.value.completedAt))
    .at(-1) ?? null;
}

function validateWeekResult(root, contract, lifecycle, current, relative) {
  const value = readJson(root, relative);
  assertContentDigest(value, relative);
  exactKeys(value, [
    'schemaVersion', 'module', 'stage', 'season', 'week', 'status', 'updatedAt',
    'operational', 'productionAuthority', 'grahamFairMutationAllowed', 'marketInputsAllowed',
    'contract', 'latestResult', 'cleanStreakCycleIds', 'acceptedWindow', 'blockedStages',
    'nextGate', 'contentSha256Canonical',
  ], relative);
  ok(value.schemaVersion === 'walters-bw6-stage4-week-shadow-v1', `${relative}: schema`);
  ok(value.module === contract.module && value.stage === STAGE, `${relative}: identity`);
  ok(Number.isInteger(value.season) && Number.isInteger(value.week), `${relative}: season/week`);
  ok(relative === `data/walters/nfl/key-numbers/bw6-stage4-week-${String(value.week).padStart(2, '0')}-shadow-v1.json`, `${relative}: filename`);
  for (const key of ['operational', 'productionAuthority', 'grahamFairMutationAllowed', 'marketInputsAllowed']) {
    ok(value[key] === false, `${relative}: forbidden authority ${key}`);
  }
  validateContractReference(value.contract, `${relative}.contract`, null);
  exactKeys(value.latestResult, [
    'cycleId', 'path', 'lifecycleState', 'contentSha256Canonical',
  ], `${relative}.latestResult`);
  const latest = latestCleanResultForWeek(lifecycle, value.week);
  ok(latest, `${relative}: no clean result for week`);
  ok(value.contract.sha256 === latest.value.contract.sha256, `${relative}: historical contract binding`);
  ok(value.latestResult.cycleId === latest.value.cycleId, `${relative}: latest cycle`);
  ok(value.latestResult.path === latest.relative, `${relative}: latest path`);
  ok(value.latestResult.lifecycleState === 'CLEAN_QUALIFYING', `${relative}: latest lifecycle`);
  ok(
    value.latestResult.contentSha256Canonical === latest.value.contentSha256Canonical,
    `${relative}: latest canonical hash`,
  );
  ok(value.season === lifecycle.receiptById.get(latest.value.cycleId).value.inputBinding.season, `${relative}: season`);
  ok(value.updatedAt === latest.value.completedAt, `${relative}: updatedAt`);
  same(value.blockedStages, BLOCKED_STAGES, `${relative}: blocked stages`);
  ok(value.nextGate === contract.nextGate, `${relative}: next gate`);

  // The week file is written at its latest clean completion. Reconstruct that release epoch's prefix.
  const latestHistoricalIndex = lifecycle.historicalAttempts.findIndex(
    (item) => item.summary.cycleId === latest.value.cycleId,
  );
  const prefix = lifecycle.historicalAttempts.slice(0, latestHistoricalIndex + 1);
  let streak = [];
  let epoch = null;
  for (const historical of prefix) {
    const itemEpoch = digest(historical.receiptEntry.value.releaseArtifactSha256);
    if (itemEpoch !== epoch) {
      epoch = itemEpoch;
      streak = [];
    }
    const item = historical.summary;
    if (item.lifecycleState === 'CLEAN_QUALIFYING') streak.push(item);
    else if (item.lifecycleState === 'FAILED_RESET' || item.lifecycleState === 'INCOMPLETE_RESET') streak = [];
  }
  const window = acceptedWindowFor(streak, contract);
  same(value.cleanStreakCycleIds, streak.map((item) => item.cycleId), `${relative}: clean streak ids`);
  same(value.acceptedWindow, window.value, `${relative}: accepted window`);
  const expectedStatus = window.accepted
    ? contract.outcomeStates.validated
    : contract.outcomeStates.clean;
  ok(value.status === expectedStatus, `${relative}: status`);
  void current;
}

function validateWeekResults(root, contract, lifecycle, current) {
  const rootDirectory = path.join(root, 'data/walters/nfl/key-numbers');
  const names = fs.readdirSync(rootDirectory)
    .filter((name) => /^bw6-stage4-week-\d{2}-shadow-v1\.json$/.test(name))
    .sort();
  const cleanWeeks = new Set(
    [...lifecycle.resultById.values()]
      .filter((entry) => entry.value.lifecycleState === 'CLEAN_QUALIFYING')
      .map((entry) => lifecycle.receiptById.get(entry.value.cycleId).value.inputBinding.week),
  );
  same(
    names,
    [...cleanWeeks].sort((a, b) => a - b).map((week) => `bw6-stage4-week-${String(week).padStart(2, '0')}-shadow-v1.json`),
    'week result file set',
  );
  for (const name of names) {
    validateWeekResult(root, contract, lifecycle, current, `data/walters/nfl/key-numbers/${name}`);
  }
}

function assertForbiddenOutputAbsent(value, label) {
  const forbidden = new Set([
    'pinnacle', 'sportsbook', 'bookmaker', 'marketPrice', 'marketEdge', 'weightedAdvantage',
    'crossZeroDeduction', 'starRating', 'playThreshold', 'recommendation', 'recommendedSide',
    'stake', 'bankroll', 'score', 'resultScore', 'bet', 'lean', 'wait', 'pass',
  ]);
  function visit(item, location) {
    if (Array.isArray(item)) {
      item.forEach((child, index) => visit(child, `${location}[${index}]`));
      return;
    }
    if (!isPlainObject(item)) return;
    for (const [key, child] of Object.entries(item)) {
      ok(!forbidden.has(key), `${label}: forbidden output key ${location}.${key}`);
      visit(child, `${location}.${key}`);
    }
  }
  visit(value, '$');
}

function main() {
  const {root, requireOpenLiveMatch} = parseArgs(process.argv.slice(2));
  const contract = validateContract(root);
  const upstream = validateUpstream(root, contract);
  const live = validateLiveBoard(root, contract);
  const releaseManifest = currentReleaseManifest(root, contract);
  const lifecycle = discoverLifecycle(
    root,
    contract,
    upstream,
    releaseManifest,
    live,
    requireOpenLiveMatch,
  );
  const current = validateCurrent(root, contract, releaseManifest, lifecycle);
  validateWeekResults(root, contract, lifecycle, current);
  for (const entry of lifecycle.snapshotById.values()) assertForbiddenOutputAbsent(entry.value, entry.relative);
  for (const entry of lifecycle.resultById.values()) assertForbiddenOutputAbsent(entry.value, entry.relative);
  console.log(
    `WALTERS BW6 STAGE 4 VERIFY: PASS // READ-ONLY // ATTEMPTS ${lifecycle.attempts.length} // CLEAN STREAK ${lifecycle.cleanStreak.length} // ${live.active.season} W${String(live.active.week).padStart(2, '0')} // BW7/BW8/PRODUCTION BLOCKED`,
  );
}

main();

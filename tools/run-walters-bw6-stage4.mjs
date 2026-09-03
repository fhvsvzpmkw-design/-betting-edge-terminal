#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const CONTRACT_RELATIVE = 'data/walters/nfl/key-numbers/bw6-stage4-shadow-contract-v1.json';
const STAGE2_RELATIVE = 'data/walters/nfl/key-numbers/bw6-stage2-calibration-v1.json';
const R2_FREEZE_RELATIVE = 'data/walters/nfl/key-numbers/bw6-stage3r2-model-freeze-v1.json';
const ATTEMPTS_DIRECTORY = 'data/walters/nfl/key-numbers/bw6-stage4/attempts';
const SNAPSHOTS_DIRECTORY = 'data/walters/nfl/key-numbers/bw6-stage4/snapshots';
const RESULTS_DIRECTORY = 'data/walters/nfl/key-numbers/bw6-stage4/results';

const HASH = /^[0-9a-f]{64}$/;
const CYCLE_ID = /^bw6-4-\d{4}-w\d{2}-[a-z0-9][a-z0-9._-]{0,127}$/;
const TERMINAL_NONQUALIFYING = new Set([
  'CLEAN_NONQUALIFYING_DUPLICATE',
  'CLEAN_NONQUALIFYING_SAME_DATE',
]);

function fail(code, detail = '') {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  throw error;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * RFC8785-style canonical JSON for the JSON subset used by this release.
 * Only the root contentSha256Canonical member is excluded. Nested members are
 * treated as ordinary evidence and therefore remain hash-bound.
 */
export function canonicalize(value, root = true) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('NON_FINITE_CANONICAL_NUMBER');
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map((item) => canonicalize(item, false));
  if (!isPlainObject(value)) fail('NON_JSON_CANONICAL_VALUE');
  const output = {};
  for (const key of Object.keys(value).sort()) {
    if (root && key === 'contentSha256Canonical') continue;
    if (value[key] === undefined) fail('UNDEFINED_CANONICAL_VALUE', key);
    output[key] = canonicalize(value[key], false);
  }
  return output;
}

export function canonicalSha(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function attachCanonicalHash(value) {
  return {...value, contentSha256Canonical: canonicalSha(value)};
}

function sha256Buffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail('REQUIRED_FILE_MISSING', file);
  return sha256Buffer(fs.readFileSync(file));
}

function readJson(file, label = file) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail('JSON_READ_FAILED', `${label}: ${error.message}`);
  }
  if (!isPlainObject(parsed)) fail('JSON_ROOT_INVALID', label);
  return parsed;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, {encoding: 'utf8'});
}

function writeImmutableJson(file, value, label) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (fs.existsSync(file)) {
    const existing = fs.readFileSync(file, 'utf8');
    if (existing !== serialized) fail('APPEND_ONLY_ARTIFACT_CONFLICT', `${label}: ${file}`);
    return false;
  }
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, serialized, {encoding: 'utf8', flag: 'wx'});
  return true;
}

function relative(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function absolute(root, relativePath) {
  const resolved = path.resolve(root, relativePath);
  const prefix = `${path.resolve(root)}${path.sep}`;
  if (resolved !== path.resolve(root) && !resolved.startsWith(prefix)) {
    fail('PATH_OUTSIDE_ROOT', relativePath);
  }
  return resolved;
}

function resolvedWriteTarget(file) {
  const requested = path.resolve(file);
  const suffix = [];
  let cursor = requested;
  while (true) {
    let entryExists = false;
    try {
      fs.lstatSync(cursor);
      entryExists = true;
      const resolvedAncestor = fs.realpathSync(cursor);
      return path.resolve(resolvedAncestor, ...suffix);
    } catch (error) {
      if (entryExists) fail('CONTROL_OUT_PATH_INVALID', error.message);
      if (error?.code !== 'ENOENT') fail('CONTROL_OUT_PATH_INVALID', error.message);
      const parent = path.dirname(cursor);
      if (parent === cursor) fail('CONTROL_OUT_PATH_INVALID', requested);
      suffix.unshift(path.basename(cursor));
      cursor = parent;
    }
  }
}

function requireIsoTimestamp(value, label) {
  if (typeof value !== 'string' || !value || !Number.isFinite(Date.parse(value))) {
    fail('TIMESTAMP_INVALID', label);
  }
  return value;
}

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) fail('NUMBER_INVALID', label);
  return Object.is(number, -0) ? 0 : number;
}

function exactKeys(value, keys, label) {
  if (!isPlainObject(value)) fail('OBJECT_INVALID', label);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail('SEMANTIC_FIELD_BOUNDARY_VIOLATION', `${label}: ${actual.join(',')}`);
  }
}

export function localDateKey(timestamp, timeZone = 'America/Vancouver') {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) fail('TIMESTAMP_INVALID', String(timestamp));
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (!values.year || !values.month || !values.day) fail('PACIFIC_DATE_UNRESOLVED');
  return `${values.year}-${values.month}-${values.day}`;
}

export function roundToHalf(value) {
  const number = finiteNumber(value, 'Graham exact fair');
  const rounded = Math.round((number + Number.EPSILON) * 2) / 2;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function mapRelevantRows(grahamFairHome, grahamExactFairHome) {
  const displayed = finiteNumber(grahamFairHome, 'grahamFairHome');
  const exact = finiteNumber(grahamExactFairHome, 'grahamExactFairHome');
  if (Math.abs(displayed * 2 - Math.round(displayed * 2)) > 1e-9) {
    fail('GRAHAM_DISPLAY_NOT_HALF_GRID', String(displayed));
  }
  if (Math.abs(roundToHalf(exact) - displayed) > 1e-9) {
    fail('GRAHAM_EXACT_DISPLAY_MISMATCH', `${exact} -> ${displayed}`);
  }

  const oriented = Math.abs(displayed);
  const lower = Math.floor(oriented + 1e-9);
  const isInteger = Math.abs(oriented - Math.round(oriented)) <= 1e-9;
  const candidates = isInteger ? [Math.round(oriented)] : [lower, lower + 1];
  const relevantExactRows = candidates.filter((margin) => margin >= 1 && margin <= 18);
  const excludedBoundaries = candidates
    .filter((margin) => margin < 1 || margin > 18)
    .map((margin) => ({
      margin,
      reason: margin === 0 ? 'CROSS_ZERO_OUT_OF_SCOPE' : 'UNSUPPORTED_EXACT_MARGIN',
    }));
  const mappingStatus = relevantExactRows.length > 0
    ? 'SUPPORTED_ROWS_IDENTIFIED'
    : 'FAIL_CLOSED_NO_SUPPORTED_ROW';

  return {
    favoriteSide: displayed < 0 ? 'HOME' : displayed > 0 ? 'AWAY' : 'PICK',
    favoriteOrientedDisplayMargin: oriented,
    mappingStatus,
    relevantExactRows,
    excludedBoundaries,
  };
}

function loadContract(root) {
  const file = absolute(root, CONTRACT_RELATIVE);
  const contract = readJson(file, 'BW6.4 contract');
  if (contract.schemaVersion !== 'walters-bw6-stage4-shadow-contract-v1' || contract.stage !== 'BW6.4') {
    fail('BW6_4_CONTRACT_IDENTITY_INVALID');
  }
  if (contract.status !== 'BW6_4_PROSPECTIVE_SHADOW_EXECUTION_CONTRACT_LOCKED_NON_OPERATIONAL') {
    fail('BW6_4_CONTRACT_NOT_LOCKED');
  }
  const boundary = contract.authorityBoundary ?? {};
  for (const [key, value] of Object.entries(boundary)) {
    if (key.endsWith('Allowed') && value !== false) fail('BW6_4_AUTHORITY_BOUNDARY_INVALID', key);
  }
  if (boundary.operational !== false || boundary.productionAuthority !== false) {
    fail('BW6_4_AUTHORITY_BOUNDARY_INVALID');
  }
  return {contract, contractSha256: sha256File(file)};
}

function validateUpstreams(root, contract) {
  const refs = {};
  for (const [name, binding] of Object.entries(contract.authorizedBy)) {
    if (!isPlainObject(binding) || !binding.path || !binding.sha256) continue;
    const actual = sha256File(absolute(root, binding.path));
    if (actual !== binding.sha256) fail('UPSTREAM_HASH_MISMATCH', `${name}: ${actual}`);
    refs[name] = {path: binding.path, sha256: actual};
  }
  const freeze = readJson(absolute(root, contract.authorizedBy.stage3R2Freeze.path), 'R2 freeze');
  if (freeze.status !== contract.authorizedBy.requiredR2Status) fail('R2_STATUS_INVALID');
  if (freeze.selectedCandidateId !== contract.authorizedBy.selectedCandidateId) fail('R2_CANDIDATE_INVALID');
  if (freeze.selectedDistributionSha256 !== contract.authorizedBy.selectedDistributionSha256) {
    fail('R2_DISTRIBUTION_INVALID');
  }
  if (freeze.prospectiveShadowPlanSha256 !== contract.authorizedBy.prospectiveShadowPlanSha256) {
    fail('R2_PLAN_INVALID');
  }
  if (freeze.originalStage3FailureOverridden !== false || freeze.originalThreePointGateWaived !== false) {
    fail('R2_ORIGINAL_FAILURE_BOUNDARY_INVALID');
  }
  return {refs, freeze};
}

function activeNumbersPath(activeWeek) {
  const season = Number(activeWeek.season);
  const week = Number(activeWeek.week);
  if (!Number.isInteger(season) || season < 2000 || season > 2100) fail('ACTIVE_SEASON_INVALID');
  if (!Number.isInteger(week) || week < 1 || week > 30) fail('ACTIVE_WEEK_INVALID');
  return `data/walters/nfl/${season}/week-${String(week).padStart(2, '0')}-current-numbers.json`;
}

function activePersonnelPath(activeWeek) {
  return `data/walters/nfl/${Number(activeWeek.season)}/week-${String(Number(activeWeek.week)).padStart(2, '0')}-personnel-ledger.json`;
}

export function buildSemanticInput(root, contract) {
  const whitelist = contract.inputContract.semanticFieldWhitelist;
  const activePath = contract.inputContract.activeWeekManifest;
  const activeFile = absolute(root, activePath);
  const activeRaw = readJson(activeFile, 'active-week manifest');
  const activeSemantic = Object.fromEntries(whitelist.activeWeek.map((key) => [key, activeRaw[key]]));
  exactKeys(activeSemantic, whitelist.activeWeek, 'activeWeek semantic projection');
  if (
    activeSemantic.state !== 'ACTIVE' ||
    activeSemantic.authority !== 'GRAHAM_WEEK_ROLLOVER' ||
    activeSemantic.timezone !== contract.timezone
  ) fail('ACTIVE_WEEK_AUTHORITY_INVALID');

  const numbersPath = activeNumbersPath(activeSemantic);
  const numbersFile = absolute(root, numbersPath);
  const numbersRaw = readJson(numbersFile, 'current-number board');
  const numbersSemantic = Object.fromEntries(whitelist.currentNumbers.map((key) => [key, numbersRaw[key]]));
  exactKeys(numbersSemantic, whitelist.currentNumbers, 'currentNumbers semantic projection');
  if (
    Number(numbersSemantic.season) !== Number(activeSemantic.season) ||
    Number(numbersSemantic.week) !== Number(activeSemantic.week)
  ) fail('CURRENT_NUMBERS_ACTIVE_WEEK_MISMATCH');
  if (!Array.isArray(numbersRaw.games) || numbersRaw.games.length === 0) fail('CURRENT_NUMBERS_GAMES_INVALID');

  const gameKeys = new Set();
  const games = numbersRaw.games.map((raw, index) => {
    const game = Object.fromEntries(whitelist.game.map((key) => [key, raw?.[key]]));
    exactKeys(game, whitelist.game, `game ${index} semantic projection`);
    if (!game.gameKey || !game.away || !game.home || !game.startTimePacific) {
      fail('GAME_IDENTITY_INVALID', String(index));
    }
    if (gameKeys.has(game.gameKey)) fail('GAME_KEY_DUPLICATE', game.gameKey);
    gameKeys.add(game.gameKey);
    requireIsoTimestamp(game.startTimePacific, `${game.gameKey}.startTimePacific`);
    game.grahamExactFairHome = finiteNumber(game.grahamExactFairHome, `${game.gameKey}.grahamExactFairHome`);
    game.grahamFairHome = finiteNumber(game.grahamFairHome, `${game.gameKey}.grahamFairHome`);
    mapRelevantRows(game.grahamFairHome, game.grahamExactFairHome);
    return game;
  });

  const semanticCurrentNumbers = {...numbersSemantic, games};
  const semanticFairBoardSha256 = canonicalSha(semanticCurrentNumbers);
  const activeWeekSha256 = sha256File(activeFile);
  const currentNumbersSha256 = sha256File(numbersFile);
  const inputIdentity = {
    season: Number(activeSemantic.season),
    week: Number(activeSemantic.week),
    activeWeekSha256,
    currentNumbersSha256,
    semanticFairBoardSha256,
  };
  const snapshotIdentitySha256 = canonicalSha(inputIdentity);
  return {
    season: inputIdentity.season,
    week: inputIdentity.week,
    activeWeek: {path: activePath, sha256: activeWeekSha256, semantic: activeSemantic},
    currentNumbers: {path: numbersPath, sha256: currentNumbersSha256, semantic: semanticCurrentNumbers},
    semanticFairBoardSha256,
    inputIdentity,
    snapshotIdentitySha256,
  };
}

function protectedHashes(root, contract, semanticInput) {
  return protectedHashesFromBinding(root, contract, {
    season: semanticInput.season,
    week: semanticInput.week,
    currentNumbersPath: semanticInput.currentNumbers.path,
  });
}

function protectedHashesFromBinding(root, contract, binding) {
  const paths = new Set(contract.protectedArtifacts);
  paths.add(binding.currentNumbersPath);
  const personnel = activePersonnelPath(binding);
  if (fs.existsSync(absolute(root, personnel))) paths.add(personnel);
  const result = {};
  for (const item of [...paths].sort()) result[item] = sha256File(absolute(root, item));
  return result;
}

function rehashBoundPaths(root, boundHashes, binding) {
  if (!isPlainObject(boundHashes)) fail('PROTECTED_HASH_BINDING_INVALID');
  const result = {};
  const paths = new Set(Object.keys(boundHashes));
  const personnel = activePersonnelPath(binding);
  if (fs.existsSync(absolute(root, personnel))) paths.add(personnel);
  for (const item of [...paths].sort()) {
    if (!Object.hasOwn(boundHashes, item) && item !== personnel) {
      fail('PROTECTED_HASH_BINDING_INVALID', item);
    }
    if (Object.hasOwn(boundHashes, item) && !HASH.test(String(boundHashes[item]))) {
      fail('PROTECTED_HASH_BINDING_INVALID', item);
    }
    result[item] = sha256File(absolute(root, item));
  }
  return result;
}

function listJson(root, directory) {
  const absoluteDirectory = absolute(root, directory);
  if (!fs.existsSync(absoluteDirectory)) return [];
  return fs.readdirSync(absoluteDirectory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const file = path.join(absoluteDirectory, name);
      return {path: relative(root, file), value: readJson(file)};
    });
}

function validateCanonicalArtifact(entry, expectedSchema) {
  const value = entry.value;
  if (value.schemaVersion !== expectedSchema) fail('ARTIFACT_SCHEMA_INVALID', entry.path);
  if (!HASH.test(String(value.contentSha256Canonical ?? ''))) fail('ARTIFACT_CANONICAL_HASH_MISSING', entry.path);
  if (canonicalSha(value) !== value.contentSha256Canonical) fail('ARTIFACT_CANONICAL_HASH_MISMATCH', entry.path);
}

function discoverLifecycle(root) {
  const receipts = listJson(root, ATTEMPTS_DIRECTORY);
  const results = listJson(root, RESULTS_DIRECTORY);
  for (const entry of receipts) validateCanonicalArtifact(entry, 'walters-bw6-stage4-attempt-start-v1');
  for (const entry of results) validateCanonicalArtifact(entry, 'walters-bw6-stage4-result-v1');
  const receiptIds = new Set();
  for (const entry of receipts) {
    if (!CYCLE_ID.test(String(entry.value.cycleId ?? ''))) fail('CYCLE_ID_INVALID', entry.path);
    if (receiptIds.has(entry.value.cycleId)) fail('CYCLE_ID_DUPLICATE', entry.value.cycleId);
    receiptIds.add(entry.value.cycleId);
  }
  const resultById = new Map();
  for (const entry of results) {
    if (!receiptIds.has(entry.value.cycleId)) fail('RESULT_WITHOUT_START', entry.path);
    if (resultById.has(entry.value.cycleId)) fail('RESULT_DUPLICATE', entry.value.cycleId);
    resultById.set(entry.value.cycleId, entry);
  }
  receipts.sort((left, right) => {
    const delta = Date.parse(left.value.startedAt) - Date.parse(right.value.startedAt);
    return delta || left.value.cycleId.localeCompare(right.value.cycleId);
  });
  return {receipts, resultById};
}

function attemptSummary(receiptEntry, resultEntry) {
  const receipt = receiptEntry.value;
  const result = resultEntry?.value;
  const lifecycleState = result?.lifecycleState ??
    (TERMINAL_NONQUALIFYING.has(receipt.preclassification) ? receipt.preclassification : 'INCOMPLETE_RESET');
  return {
    cycleId: receipt.cycleId,
    pacificDate: receipt.pacificDate,
    triggerClass: receipt.trigger.triggerClass,
    scheduledQualifying: receipt.trigger.scheduledQualifying,
    snapshotIdentitySha256: receipt.inputBinding.snapshotIdentitySha256,
    activeWeekSha256: receipt.inputBinding.activeWeekSha256,
    currentNumbersSha256: receipt.inputBinding.currentNumbersSha256,
    lifecycleState,
    startReceiptPath: receiptEntry.path,
    resultPath: resultEntry?.path ?? null,
  };
}

function releaseHashes(root, contract, supplied = null) {
  if (supplied && isPlainObject(supplied)) return supplied;
  const hashes = {};
  for (const item of contract.releaseArtifacts ?? []) {
    const file = absolute(root, item);
    if (!fs.existsSync(file)) fail('RELEASE_ARTIFACT_MISSING', item);
    hashes[item] = sha256File(file);
  }
  return hashes;
}

function frozenReleaseHashes(root, contract) {
  const currentFile = absolute(root, contract.outputs.current);
  if (!fs.existsSync(currentFile)) return releaseHashes(root, contract);
  const current = readJson(currentFile, 'BW6.4 current state');
  if (
    current.schemaVersion !== 'walters-bw6-stage4-current-v1' ||
    !HASH.test(String(current.contentSha256Canonical ?? '')) ||
    canonicalSha(current) !== current.contentSha256Canonical
  ) fail('CURRENT_STATE_CANONICAL_BINDING_INVALID');
  const manifest = current.releaseArtifactSha256;
  if (!isPlainObject(manifest)) fail('RELEASE_MANIFEST_MISSING_FROM_CURRENT');
  const expected = [...contract.releaseArtifacts].sort();
  if (JSON.stringify(Object.keys(manifest).sort()) !== JSON.stringify(expected)) {
    fail('RELEASE_MANIFEST_PATHS_INVALID');
  }
  for (const [item, digest] of Object.entries(manifest)) {
    if (!HASH.test(String(digest))) fail('RELEASE_MANIFEST_HASH_INVALID', item);
  }
  return manifest;
}

export function deriveCurrent({root, contract, contractSha256, updatedAt, releaseArtifactSha256 = null}) {
  const {receipts, resultById} = discoverLifecycle(root);
  const releaseManifest = releaseArtifactSha256 ?? frozenReleaseHashes(root, contract);
  const attempts = [];
  let cleanStreak = [];
  let activeAttempt = null;

  for (const receiptEntry of receipts) {
    if (activeAttempt) fail('PRIOR_ATTEMPT_INCOMPLETE', activeAttempt.cycleId);
    const receipt = receiptEntry.value;
    const resultEntry = resultById.get(receipt.cycleId);
    const summary = attemptSummary(receiptEntry, resultEntry);
    if (!compareHashes(receipt.releaseArtifactSha256, releaseManifest)) {
      summary.releaseArtifactMismatch = true;
      cleanStreak = [];
      if (summary.lifecycleState === 'INCOMPLETE_RESET') {
        activeAttempt = {
          cycleId: receipt.cycleId,
          startedAt: receipt.startedAt,
          startReceiptPath: receiptEntry.path,
          lifecycleState: 'INCOMPLETE_RESET',
        };
      } else {
        summary.lifecycleState = 'FAILED_RESET';
        activeAttempt = null;
      }
      attempts.push(summary);
      continue;
    }
    attempts.push(summary);
    if (summary.lifecycleState === 'CLEAN_QUALIFYING') {
      cleanStreak.push(summary);
      activeAttempt = null;
    } else if (TERMINAL_NONQUALIFYING.has(summary.lifecycleState)) {
      activeAttempt = null;
    } else if (summary.lifecycleState === 'FAILED_RESET') {
      cleanStreak = [];
      activeAttempt = null;
    } else {
      cleanStreak = [];
      activeAttempt = {
        cycleId: receipt.cycleId,
        startedAt: receipt.startedAt,
        startReceiptPath: receiptEntry.path,
        lifecycleState: 'INCOMPLETE_RESET',
      };
    }
  }

  const windowSize = Number(contract.cyclePlan.minimumConsecutiveCleanCycles);
  const trailing = cleanStreak.slice(-windowSize);
  const dates = new Set(trailing.map((item) => item.pacificDate));
  const snapshots = new Set(trailing.map((item) => item.snapshotIdentitySha256));
  const scheduledCount = trailing.filter((item) => item.scheduledQualifying).length;
  let changedInputTransitions = 0;
  for (let index = 1; index < trailing.length; index += 1) {
    if (
      trailing[index].activeWeekSha256 !== trailing[index - 1].activeWeekSha256 ||
      trailing[index].currentNumbersSha256 !== trailing[index - 1].currentNumbersSha256
    ) changedInputTransitions += 1;
  }
  const accepted = trailing.length === windowSize &&
    dates.size === windowSize &&
    snapshots.size === windowSize &&
    scheduledCount >= Number(contract.cyclePlan.minimumScheduledCyclesInAcceptedWindow) &&
    changedInputTransitions >= Number(contract.cyclePlan.minimumChangedActiveWeekOrCurrentNumbersHashes);
  const acceptedWindow = trailing.length === windowSize ? {
    cycleIds: trailing.map((item) => item.cycleId),
    pacificDates: trailing.map((item) => item.pacificDate),
    scheduledCycles: scheduledCount,
    manualEquivalentCycles: trailing.length - scheduledCount,
    distinctSnapshotDigests: snapshots.size,
    changedInputTransitions,
    accepted,
  } : null;

  const latest = attempts.at(-1) ?? null;
  let status = contract.outcomeStates.ready;
  if (activeAttempt) status = contract.outcomeStates.open;
  else if (accepted) status = contract.outcomeStates.validated;
  else if (latest?.lifecycleState === 'CLEAN_QUALIFYING') status = contract.outcomeStates.clean;
  else if (latest?.lifecycleState === 'CLEAN_NONQUALIFYING_DUPLICATE') status = contract.outcomeStates.duplicate;
  else if (latest?.lifecycleState === 'CLEAN_NONQUALIFYING_SAME_DATE') status = contract.outcomeStates.sameDate;
  else if (latest?.lifecycleState === 'FAILED_RESET') status = contract.outcomeStates.failed;

  return attachCanonicalHash({
    schemaVersion: 'walters-bw6-stage4-current-v1',
    module: contract.module,
    stage: contract.stage,
    status,
    updatedAt,
    operational: false,
    productionAuthority: false,
    grahamFairMutationAllowed: false,
    liveBoardMutationAllowed: false,
    betStatusMutationAllowed: false,
    stakeMutationAllowed: false,
    marketInputsAllowed: false,
    outcomeInputsAllowed: false,
    contract: {path: CONTRACT_RELATIVE, sha256: contractSha256},
    releaseArtifactSha256: releaseManifest,
    selectedCandidateId: contract.authorizedBy.selectedCandidateId,
    selectedDistributionSha256: contract.authorizedBy.selectedDistributionSha256,
    prospectiveShadowPlanSha256: contract.authorizedBy.prospectiveShadowPlanSha256,
    activeAttempt,
    attempts,
    cleanStreak,
    acceptedWindow,
    summary: {
      attempts: attempts.length,
      qualifyingCleanCyclesSinceReset: cleanStreak.length,
      scheduledCyclesInTrailingWindow: scheduledCount,
      acceptedWindowReady: accepted,
    },
    blockedStages: [...contract.blockedStages],
    nextGate: contract.nextGate,
  });
}

function buildTrigger(args) {
  const eventName = args.eventName ?? process.env.GITHUB_EVENT_NAME ?? 'local';
  const runAttempt = Number(args.runAttempt ?? process.env.GITHUB_RUN_ATTEMPT ?? 1);
  const runId = String(args.runId ?? process.env.GITHUB_RUN_ID ?? 'local');
  if (!Number.isInteger(runAttempt) || runAttempt < 1) fail('RUN_ATTEMPT_INVALID');
  let triggerClass = 'VALIDATION_ONLY';
  if (eventName === 'schedule' && runAttempt === 1) triggerClass = 'SCHEDULED';
  else if (eventName === 'schedule' || eventName === 'workflow_dispatch') triggerClass = 'MANUAL_EQUIVALENT';
  return {eventName, triggerClass, runId, runAttempt, scheduledQualifying: triggerClass === 'SCHEDULED'};
}

function upstreamRefs(contract) {
  const refs = {};
  for (const [name, binding] of Object.entries(contract.authorizedBy)) {
    if (isPlainObject(binding) && binding.path && binding.sha256) refs[name] = {...binding};
  }
  return refs;
}

function cyclePaths(root, contract, cycleId, week) {
  const replace = (pattern) => pattern
    .replace('{cycleId}', cycleId)
    .replace('{WW}', String(week).padStart(2, '0'));
  const relativePaths = {
    attempt: replace(contract.outputs.attemptPattern),
    snapshot: replace(contract.outputs.snapshotPattern),
    result: replace(contract.outputs.resultPattern),
    current: contract.outputs.current,
    week: replace(contract.outputs.weekResultPattern),
  };
  return {
    relative: relativePaths,
    absolute: Object.fromEntries(Object.entries(relativePaths).map(([key, value]) => [key, absolute(root, value)])),
  };
}

function normalizedCycleId(value) {
  if (!CYCLE_ID.test(String(value ?? ''))) fail('CYCLE_ID_INVALID', String(value));
  return String(value);
}

function defaultCycleId(semanticInput, pacificDate, trigger) {
  const triggerToken = trigger.triggerClass.toLowerCase().replaceAll('_', '-');
  const runToken = String(trigger.runId).toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(0, 48);
  return normalizedCycleId(
    `bw6-4-${semanticInput.season}-w${String(semanticInput.week).padStart(2, '0')}-${pacificDate}-${triggerToken}-run-${runToken}-attempt-${trigger.runAttempt}`,
  );
}

function writeControl(args, value) {
  const line = JSON.stringify(value);
  if (args.controlOut) writeJson(path.resolve(args.controlOut), value);
  process.stdout.write(`${line}\n`);
}

function currentBefore(root, contract, contractSha256, at) {
  return deriveCurrent({root, contract, contractSha256, updatedAt: at});
}

function classifyStart(current, semanticInput) {
  if (current.cleanStreak.some((item) => item.snapshotIdentitySha256 === semanticInput.snapshotIdentitySha256)) {
    return 'CLEAN_NONQUALIFYING_DUPLICATE';
  }
  if (current.attempts.some((item) => item.lifecycleState === 'CLEAN_QUALIFYING' && item.pacificDate === semanticInput.pacificDate)) {
    return 'CLEAN_NONQUALIFYING_SAME_DATE';
  }
  return 'CANDIDATE';
}

function startMode(root, contract, contractSha256, args) {
  validateUpstreams(root, contract);
  const trigger = buildTrigger(args);
  if (!['SCHEDULED', 'MANUAL_EQUIVALENT'].includes(trigger.triggerClass)) {
    fail('START_TRIGGER_NOT_AUTHORIZED', trigger.eventName);
  }
  const startedAt = requireIsoTimestamp(args.startedAt ?? new Date().toISOString(), 'startedAt');
  const pacificDate = localDateKey(startedAt, contract.timezone);
  const sourceCommit = String(args.sourceCommit ?? process.env.GITHUB_SHA ?? 'LOCAL_UNBOUND');
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) fail('SOURCE_COMMIT_INVALID');
  const semanticInput = {...buildSemanticInput(root, contract), pacificDate};
  const expectedCycleId = defaultCycleId(semanticInput, pacificDate, trigger);
  const cycleId = normalizedCycleId(args.cycleId ?? expectedCycleId);
  if (cycleId !== expectedCycleId) fail('CYCLE_ID_PROVENANCE_INVALID', cycleId);
  const current = currentBefore(root, contract, contractSha256, startedAt);
  if (current.activeAttempt) {
    fail('PRIOR_ATTEMPT_INCOMPLETE', current.activeAttempt.cycleId);
  }
  const actualReleaseArtifactSha256 = releaseHashes(root, contract);
  if (!compareHashes(actualReleaseArtifactSha256, current.releaseArtifactSha256)) {
    fail('RELEASE_ARTIFACT_MANIFEST_CHANGED');
  }
  const preclassification = classifyStart(current, semanticInput);
  const begunCycle = preclassification === 'CANDIDATE';
  const lifecycleState = begunCycle ? 'STARTED' : preclassification;
  const paths = cyclePaths(root, contract, cycleId, semanticInput.week);
  const protectedBefore = protectedHashes(root, contract, semanticInput);
  if (
    protectedBefore[semanticInput.activeWeek.path] !== semanticInput.activeWeek.sha256 ||
    protectedBefore[semanticInput.currentNumbers.path] !== semanticInput.currentNumbers.sha256
  ) fail('INPUT_CHANGED_DURING_START_HASH_CAPTURE');
  const status = begunCycle ? contract.outcomeStates.open :
    preclassification === 'CLEAN_NONQUALIFYING_DUPLICATE' ? contract.outcomeStates.duplicate : contract.outcomeStates.sameDate;
  const receipt = attachCanonicalHash({
    schemaVersion: 'walters-bw6-stage4-attempt-start-v1',
    cycleId,
    stage: contract.stage,
    lifecycleState,
    status,
    begunCycle,
    preclassification,
    startedAt,
    pacificDate,
    trigger,
    sourceCommit,
    contract: {path: CONTRACT_RELATIVE, sha256: contractSha256},
    releaseArtifactSha256: actualReleaseArtifactSha256,
    upstream: upstreamRefs(contract),
    inputBinding: {
      season: semanticInput.season,
      week: semanticInput.week,
      activeWeekPath: semanticInput.activeWeek.path,
      activeWeekSha256: semanticInput.activeWeek.sha256,
      currentNumbersPath: semanticInput.currentNumbers.path,
      currentNumbersSha256: semanticInput.currentNumbers.sha256,
      semanticFairBoardSha256: semanticInput.semanticFairBoardSha256,
      snapshotIdentitySha256: semanticInput.snapshotIdentitySha256,
    },
    protectedArtifactSha256Before: protectedBefore,
    priorCleanStreakCycleIds: current.cleanStreak.map((item) => item.cycleId),
    terminalReasonCode: begunCycle ? null : preclassification,
    operational: false,
    productionAuthority: false,
    marketInputsUsed: false,
  });
  writeImmutableJson(paths.absolute.attempt, receipt, 'start receipt');
  const nextCurrent = deriveCurrent({root, contract, contractSha256, updatedAt: startedAt});
  writeJson(paths.absolute.current, nextCurrent);
  const control = {
    mode: 'start',
    cycleId,
    lifecycleState,
    action: begunCycle ? 'COMPLETE_REQUIRED' : 'SKIP_TERMINAL',
    attemptPath: paths.relative.attempt,
    currentPath: paths.relative.current,
  };
  writeControl(args, control);
  return control;
}

function loadReceipt(root, contract, cycleId) {
  const pattern = contract.outputs.attemptPattern.replace('{cycleId}', cycleId);
  const file = absolute(root, pattern);
  const entry = {path: pattern, value: readJson(file, 'start receipt')};
  validateCanonicalArtifact(entry, 'walters-bw6-stage4-attempt-start-v1');
  if (entry.value.cycleId !== cycleId) fail('START_CYCLE_ID_MISMATCH');
  return entry;
}

function compareHashes(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function rowComparisons(root, contract, margins) {
  const stage2 = readJson(absolute(root, STAGE2_RELATIVE), 'Stage 2 calibration');
  const freeze = readJson(absolute(root, R2_FREEZE_RELATIVE), 'R2 freeze');
  const stage2Rows = new Map((stage2.marginRows ?? []).map((row) => [Number(row.margin), row]));
  const r2Rows = new Map((freeze.marginRows ?? []).map((row) => [Number(row.margin), row]));
  return [...new Set(margins)].sort((a, b) => a - b).map((margin) => {
    const s2 = stage2Rows.get(margin);
    const r2 = r2Rows.get(margin);
    if (!s2 || !r2) fail('FROZEN_MARGIN_ROW_MISSING', String(margin));
    const support = s2.currentCalibration?.supportStatus;
    const status = support === 'CURRENT_SUPPORTED' ? 'CURRENT_SUPPORTED' : `FAIL_CLOSED_${support ?? 'UNSUPPORTED'}`;
    return {
      margin,
      status,
      bookExact: {
        pointWeightPercentPublishedRounded: s2.bookExact.pointWeightPercentPublishedRounded,
        buyHalfPointFairCostUsdPer100: s2.bookExact.buyHalfPointFairCostUsdPer100,
        provenance: contract.allowedOutput.bookExactProvenance,
      },
      stage2: {
        pointWeightProbability: s2.currentCalibration.pointWeightProbability,
        pointWeightPercent: s2.currentCalibration.pointWeightPercent,
        supportStatus: support,
        halfPointFairCost: s2.currentCalibration.halfPointFairCost,
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
  });
}

function buildSnapshot(contract, receipt, semanticInput) {
  return attachCanonicalHash({
    schemaVersion: 'walters-bw6-stage4-input-snapshot-v1',
    cycleId: receipt.cycleId,
    stage: contract.stage,
    lifecycleState: 'IMMUTABLE_INPUT_SNAPSHOT',
    capturedAt: receipt.startedAt,
    pacificDate: receipt.pacificDate,
    sourceCommit: receipt.sourceCommit,
    inputIdentity: semanticInput.inputIdentity,
    snapshotIdentitySha256: semanticInput.snapshotIdentitySha256,
    activeWeek: semanticInput.activeWeek,
    currentNumbers: semanticInput.currentNumbers,
    semanticFieldWhitelistApplied: true,
    hashOnlyArtifactsParsed: false,
    marketInputsUsed: false,
    outcomeInputsUsed: false,
  });
}

function artifactReference(root, relativePath, value) {
  return {
    path: relativePath,
    sha256: sha256File(absolute(root, relativePath)),
    contentSha256Canonical: value.contentSha256Canonical,
  };
}

function buildGames(semanticInput) {
  return semanticInput.currentNumbers.semantic.games.map((game) => ({
    ...game,
    ...mapRelevantRows(game.grahamFairHome, game.grahamExactFairHome),
  }));
}

function writeWeekResult(root, contract, contractSha256, semanticInput, result, resultPath, current, completedAt) {
  const weekPath = contract.outputs.weekResultPattern.replace('{WW}', String(semanticInput.week).padStart(2, '0'));
  const weekResult = attachCanonicalHash({
    schemaVersion: 'walters-bw6-stage4-week-shadow-v1',
    module: contract.module,
    stage: contract.stage,
    season: semanticInput.season,
    week: semanticInput.week,
    status: current.status,
    updatedAt: completedAt,
    operational: false,
    productionAuthority: false,
    grahamFairMutationAllowed: false,
    marketInputsAllowed: false,
    contract: {path: CONTRACT_RELATIVE, sha256: contractSha256},
    latestResult: {
      cycleId: result.cycleId,
      path: resultPath,
      lifecycleState: result.lifecycleState,
      contentSha256Canonical: result.contentSha256Canonical,
    },
    cleanStreakCycleIds: current.cleanStreak.map((item) => item.cycleId),
    acceptedWindow: current.acceptedWindow,
    blockedStages: [...contract.blockedStages],
    nextGate: contract.nextGate,
  });
  writeJson(absolute(root, weekPath), weekResult);
  return weekPath;
}

function completeMode(root, contract, contractSha256, args) {
  validateUpstreams(root, contract);
  const cycleId = normalizedCycleId(args.cycleId);
  const receiptEntry = loadReceipt(root, contract, cycleId);
  const receipt = receiptEntry.value;
  if (receipt.lifecycleState !== 'STARTED' || receipt.begunCycle !== true) {
    fail('ATTEMPT_NOT_COMPLETABLE', receipt.lifecycleState);
  }
  const paths = cyclePaths(root, contract, cycleId, receipt.inputBinding.week);
  if (fs.existsSync(paths.absolute.result)) fail('ATTEMPT_ALREADY_TERMINAL', cycleId);
  const completedAt = requireIsoTimestamp(args.completedAt ?? new Date().toISOString(), 'completedAt');
  if (Date.parse(completedAt) < Date.parse(receipt.startedAt)) fail('COMPLETION_PRECEDES_START');
  const semanticInput = buildSemanticInput(root, contract);
  const actualReleaseArtifactSha256 = releaseHashes(root, contract);
  if (!compareHashes(actualReleaseArtifactSha256, receipt.releaseArtifactSha256)) {
    fail('IN_FLIGHT_RELEASE_ARTIFACT_CHANGED');
  }
  const binding = receipt.inputBinding;
  if (
    semanticInput.activeWeek.path !== binding.activeWeekPath ||
    semanticInput.activeWeek.sha256 !== binding.activeWeekSha256 ||
    semanticInput.currentNumbers.path !== binding.currentNumbersPath ||
    semanticInput.currentNumbers.sha256 !== binding.currentNumbersSha256 ||
    semanticInput.semanticFairBoardSha256 !== binding.semanticFairBoardSha256 ||
    semanticInput.snapshotIdentitySha256 !== binding.snapshotIdentitySha256
  ) fail('IN_FLIGHT_INPUT_CHANGED');
  const protectedAfter = protectedHashes(root, contract, semanticInput);
  if (
    protectedAfter[semanticInput.activeWeek.path] !== semanticInput.activeWeek.sha256 ||
    protectedAfter[semanticInput.currentNumbers.path] !== semanticInput.currentNumbers.sha256
  ) fail('INPUT_CHANGED_DURING_COMPLETION_HASH_CAPTURE');
  if (!compareHashes(protectedAfter, receipt.protectedArtifactSha256Before)) {
    fail('PROTECTED_ARTIFACT_MUTATION');
  }
  const snapshot = buildSnapshot(contract, receipt, semanticInput);
  writeImmutableJson(paths.absolute.snapshot, snapshot, 'input snapshot');
  const games = buildGames(semanticInput);
  const relevant = games.flatMap((game) => game.relevantExactRows);
  const comparisons = rowComparisons(root, contract, relevant);
  const startReference = artifactReference(root, paths.relative.attempt, receipt);
  const snapshotReference = artifactReference(root, paths.relative.snapshot, snapshot);
  const result = attachCanonicalHash({
    schemaVersion: 'walters-bw6-stage4-result-v1',
    cycleId,
    stage: contract.stage,
    lifecycleState: 'CLEAN_QUALIFYING',
    status: contract.outcomeStates.clean,
    begunCycle: true,
    startedAt: receipt.startedAt,
    completedAt,
    pacificDate: receipt.pacificDate,
    trigger: receipt.trigger,
    sourceCommit: receipt.sourceCommit,
    contract: {path: CONTRACT_RELATIVE, sha256: contractSha256},
    releaseArtifactSha256: receipt.releaseArtifactSha256,
    upstream: receipt.upstream,
    startReceipt: startReference,
    inputSnapshot: {...snapshotReference, snapshotIdentitySha256: snapshot.snapshotIdentitySha256},
    operational: false,
    productionAuthority: false,
    grahamFairMutationAllowed: false,
    qbOrEmbeddedBaselineMutationAllowed: false,
    uncertaintyOverlayMutationAllowed: false,
    liveBoardMutationAllowed: false,
    betStatusMutationAllowed: false,
    stakeMutationAllowed: false,
    marketInputsUsed: false,
    outcomeInputsUsed: false,
    weightedAdvantageProduced: false,
    crossZeroCalculationProduced: false,
    games,
    rowComparisons: comparisons,
    summary: {
      activeGames: games.length,
      gamesWithSupportedRows: games.filter((game) => game.relevantExactRows.length > 0).length,
      gamesFailClosedWithoutSupportedRow: games.filter((game) => game.relevantExactRows.length === 0).length,
      distinctSupportedRows: comparisons.length,
    },
    protectedArtifactSha256Before: receipt.protectedArtifactSha256Before,
    protectedArtifactSha256After: protectedAfter,
    protectedArtifactsUnchanged: true,
    blockedStages: [...contract.blockedStages],
    nextGate: contract.nextGate,
  });
  writeImmutableJson(paths.absolute.result, result, 'shadow result');
  const current = deriveCurrent({root, contract, contractSha256, updatedAt: completedAt});
  writeJson(paths.absolute.current, current);
  const weekPath = writeWeekResult(root, contract, contractSha256, semanticInput, result, paths.relative.result, current, completedAt);
  const control = {
    mode: 'complete',
    cycleId,
    lifecycleState: result.lifecycleState,
    action: 'PUBLISH_COMPLETION',
    snapshotPath: paths.relative.snapshot,
    resultPath: paths.relative.result,
    currentPath: paths.relative.current,
    weekResultPath: weekPath,
  };
  writeControl(args, control);
  return control;
}

function failMode(root, contract, contractSha256, args) {
  const cycleId = normalizedCycleId(args.cycleId);
  const receiptEntry = loadReceipt(root, contract, cycleId);
  const receipt = receiptEntry.value;
  if (receipt.lifecycleState !== 'STARTED' || receipt.begunCycle !== true) {
    fail('ATTEMPT_NOT_FAIL_CLOSABLE', receipt.lifecycleState);
  }
  const paths = cyclePaths(root, contract, cycleId, receipt.inputBinding.week);
  if (fs.existsSync(paths.absolute.result)) fail('ATTEMPT_ALREADY_TERMINAL', cycleId);
  if (fs.existsSync(paths.absolute.snapshot)) fail('ATTEMPT_SNAPSHOT_ALREADY_PRESENT', cycleId);
  const actualReleaseArtifactSha256 = releaseHashes(root, contract);
  const governedReleaseArtifactSha256 = frozenReleaseHashes(root, contract);
  if (!compareHashes(actualReleaseArtifactSha256, governedReleaseArtifactSha256)) {
    fail('RELEASE_ARTIFACT_MANIFEST_CHANGED');
  }
  const completedAt = requireIsoTimestamp(args.completedAt ?? new Date().toISOString(), 'completedAt');
  if (Date.parse(completedAt) < Date.parse(receipt.startedAt)) fail('COMPLETION_PRECEDES_START');
  const failureCode = String(args.failureCode ?? 'BW6_4_ATTEMPT_FAILED');
  if (!/^[A-Z0-9_]{3,120}$/.test(failureCode)) fail('FAILURE_CODE_INVALID');
  const protectedAfter = rehashBoundPaths(
    root,
    receipt.protectedArtifactSha256Before,
    receipt.inputBinding,
  );
  const unchanged = compareHashes(protectedAfter, receipt.protectedArtifactSha256Before);
  const result = attachCanonicalHash({
    schemaVersion: 'walters-bw6-stage4-result-v1',
    cycleId,
    stage: contract.stage,
    lifecycleState: 'FAILED_RESET',
    status: contract.outcomeStates.failed,
    begunCycle: true,
    startedAt: receipt.startedAt,
    completedAt,
    pacificDate: receipt.pacificDate,
    trigger: receipt.trigger,
    sourceCommit: receipt.sourceCommit,
    contract: receipt.contract,
    releaseArtifactSha256: receipt.releaseArtifactSha256,
    upstream: receipt.upstream,
    startReceipt: {
      path: receiptEntry.path,
      sha256: sha256File(absolute(root, receiptEntry.path)),
      contentSha256Canonical: receipt.contentSha256Canonical,
    },
    inputSnapshot: null,
    failure: {code: failureCode, message: String(args.failureMessage ?? failureCode).slice(0, 500)},
    operational: false,
    productionAuthority: false,
    grahamFairMutationAllowed: false,
    liveBoardMutationAllowed: false,
    betStatusMutationAllowed: false,
    stakeMutationAllowed: false,
    marketInputsUsed: false,
    outcomeInputsUsed: false,
    protectedArtifactSha256Before: receipt.protectedArtifactSha256Before,
    protectedArtifactSha256After: protectedAfter,
    protectedArtifactsUnchanged: unchanged,
    blockedStages: [...contract.blockedStages],
    nextGate: contract.nextGate,
  });
  writeImmutableJson(paths.absolute.result, result, 'failed result');
  const current = deriveCurrent({root, contract, contractSha256, updatedAt: completedAt});
  writeJson(paths.absolute.current, current);
  const control = {
    mode: 'fail',
    cycleId,
    lifecycleState: 'FAILED_RESET',
    action: 'PUBLISH_FAILURE',
    resultPath: paths.relative.result,
    currentPath: paths.relative.current,
  };
  writeControl(args, control);
  return control;
}

function validateOnlyMode(root, contract, contractSha256, args) {
  validateUpstreams(root, contract);
  const semanticInput = buildSemanticInput(root, contract);
  const before = protectedHashes(root, contract, semanticInput);
  const games = buildGames(semanticInput);
  const comparisons = rowComparisons(root, contract, games.flatMap((game) => game.relevantExactRows));
  const after = protectedHashes(root, contract, semanticInput);
  if (!compareHashes(before, after)) fail('VALIDATION_ONLY_PROTECTED_ARTIFACT_MUTATION');
  const current = deriveCurrent({
    root,
    contract,
    contractSha256,
    updatedAt: contract.generatedAt,
  });
  if (!compareHashes(releaseHashes(root, contract), current.releaseArtifactSha256)) {
    fail('RELEASE_ARTIFACT_MANIFEST_CHANGED');
  }
  const control = {
    mode: 'validate-only',
    lifecycleState: 'VALIDATION_ONLY',
    action: 'NO_REPOSITORY_WRITES',
    season: semanticInput.season,
    week: semanticInput.week,
    games: games.length,
    distinctSupportedRows: comparisons.length,
    snapshotIdentitySha256: semanticInput.snapshotIdentitySha256,
    currentStatus: current.status,
  };
  writeControl(args, control);
  return control;
}

function parseArgs(argv) {
  const args = {};
  const valueKeys = new Map([
    ['--mode', 'mode'], ['--root', 'root'], ['--cycle-id', 'cycleId'],
    ['--started-at', 'startedAt'], ['--completed-at', 'completedAt'],
    ['--source-commit', 'sourceCommit'], ['--event-name', 'eventName'],
    ['--run-id', 'runId'], ['--run-attempt', 'runAttempt'],
    ['--failure-code', 'failureCode'], ['--failure-message', 'failureMessage'],
    ['--control-out', 'controlOut'],
  ]);
  let index = 0;
  if (argv[0] && !argv[0].startsWith('-')) {
    args.mode = argv[0];
    index = 1;
  }
  while (index < argv.length) {
    const key = argv[index];
    const target = valueKeys.get(key);
    if (!target || index + 1 >= argv.length) fail('ARGUMENT_INVALID', key);
    args[target] = argv[index + 1];
    index += 2;
  }
  return args;
}

export function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const mode = args.mode ?? 'validate-only';
  const root = path.resolve(args.root ?? process.cwd());
  if (args.controlOut) {
    const controlPath = resolvedWriteTarget(args.controlOut);
    const resolvedRoot = fs.realpathSync(root);
    const rootPrefix = `${resolvedRoot}${path.sep}`;
    if (controlPath === resolvedRoot || controlPath.startsWith(rootPrefix)) {
      fail('CONTROL_OUT_INSIDE_ROOT');
    }
  }
  const {contract, contractSha256} = loadContract(root);
  if (mode === 'validate-only') return validateOnlyMode(root, contract, contractSha256, args);
  if (mode === 'start') return startMode(root, contract, contractSha256, args);
  if (mode === 'complete') return completeMode(root, contract, contractSha256, args);
  if (mode === 'fail') return failMode(root, contract, contractSha256, args);
  fail('MODE_INVALID', mode);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  try {
    run();
  } catch (error) {
    console.error(`WALTERS BW6 STAGE 4 FAILED // ${error.code ?? 'UNEXPECTED'} // ${error.message}`);
    process.exitCode = 1;
  }
}

#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const QB_ROOT = path.join(ROOT, 'data', 'walters', 'nfl', 'qb-performance');
const STAGE4_ROOT = path.join(QB_ROOT, 'stage4');

const paths = {
  contract: path.join(QB_ROOT, 'stage4-contract-v1.json'),
  authority: path.join(STAGE4_ROOT, 'binding-authority-v1.json'),
  stage3Acceptance: path.join(QB_ROOT, 'stage3-acceptance-v1.json'),
  candidates: path.join(QB_ROOT, 'candidates', 'qb-candidates-2026-stage3c-v1.json'),
  freeze: path.join(STAGE4_ROOT, 'freeze-manifest-v1.json'),
  bindings: path.join(STAGE4_ROOT, 'starter-baseline-bindings-v1.json'),
  board: path.join(STAGE4_ROOT, 'shadow-board-v1.json'),
  reconciliation: path.join(STAGE4_ROOT, 'uncertainty-reconciliation-v1.json'),
  rollover: path.join(STAGE4_ROOT, 'rollover-audit-v1.json'),
  regression: path.join(STAGE4_ROOT, 'regression-audit-v1.json'),
  acceptance: path.join(QB_ROOT, 'stage4-acceptance-v1.json'),
  current: path.join(QB_ROOT, 'stage4-current.json'),
};

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function readJson(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing required file: ${rel(file)}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(file) {
  return sha256Buffer(fs.readFileSync(file));
}

function canonicalPayload(value) {
  if (Array.isArray(value)) return value.map(canonicalPayload);
  if (value && typeof value === 'object') {
    const output = {};
    for (const key of Object.keys(value).sort()) {
      if (key === 'contentSha256Canonical') continue;
      output[key] = canonicalPayload(value[key]);
    }
    return output;
  }
  return value;
}

function canonicalSha(value) {
  return sha256Buffer(Buffer.from(JSON.stringify(canonicalPayload(value)), 'utf8'));
}

function nearlyEqual(left, right, tolerance = 1e-9) {
  return Math.abs(Number(left) - Number(right)) <= tolerance;
}

function roundHalfAwayFromZero(value) {
  const scaled = Number(value) * 2;
  const rounded = scaled >= 0 ? Math.floor(scaled + 0.5) : Math.ceil(scaled - 0.5);
  return rounded / 2;
}

function anyTrueKey(value, targetKey) {
  if (Array.isArray(value)) return value.some((item) => anyTrueKey(item, targetKey));
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === targetKey && item === true) return true;
      if (anyTrueKey(item, targetKey)) return true;
    }
  }
  return false;
}

function assertCanonical(name, value, errors) {
  if (typeof value.contentSha256Canonical !== 'string') {
    errors.push(`${name} has no canonical content hash.`);
    return;
  }
  const actual = canonicalSha(value);
  if (actual !== value.contentSha256Canonical) {
    errors.push(`${name} canonical hash mismatch: ${actual} != ${value.contentSha256Canonical}`);
  }
}

const contract = readJson(paths.contract);
const authority = readJson(paths.authority);
const stage3Acceptance = readJson(paths.stage3Acceptance);
const candidates = readJson(paths.candidates);
const freeze = readJson(paths.freeze);
const bindings = readJson(paths.bindings);
const board = readJson(paths.board);
const reconciliation = readJson(paths.reconciliation);
const rollover = readJson(paths.rollover);
const regression = readJson(paths.regression);
const acceptance = readJson(paths.acceptance);
const current = readJson(paths.current);
const errors = [];

for (const [name, value] of Object.entries({ freeze, bindings, board, reconciliation, rollover, regression, acceptance, current })) {
  assertCanonical(name, value, errors);
}

if (contract.stage !== 4 || contract.operational !== false || contract.productionAuthority !== false) {
  errors.push('Stage 4 contract identity or non-operational boundary is invalid.');
}
if (stage3Acceptance.status !== 'PASS' || stage3Acceptance.decision !== contract.dependency.requiredStage3Decision) {
  errors.push('Stage 3 acceptance is not the contracted Stage 4 handoff.');
}
if (freeze.status !== 'STAGE4_INPUTS_HASH_FROZEN' || freeze.allInputsPresent !== true) {
  errors.push('Stage 4 freeze manifest did not pass.');
}
if (freeze.inputCount !== contract.freezePolicy.immutableInputPaths.length) {
  errors.push('Stage 4 freeze input count does not match the contract.');
}
for (const entry of freeze.inputs ?? []) {
  const file = path.join(ROOT, entry.path);
  if (!fs.existsSync(file)) {
    errors.push(`Frozen input is missing: ${entry.path}`);
    continue;
  }
  const actualRaw = sha256File(file);
  if (actualRaw !== entry.sha256) errors.push(`Frozen input raw hash mismatch: ${entry.path}`);
  if (entry.canonicalJsonSha256) {
    const parsed = readJson(file);
    if (canonicalSha(parsed) !== entry.canonicalJsonSha256) errors.push(`Frozen input canonical hash mismatch: ${entry.path}`);
  }
}

const bindingTeams = bindings.teams ?? [];
const teamCodes = bindingTeams.map((record) => record.team);
if (bindingTeams.length !== contract.bindingPolicy.expectedTeamCount || new Set(teamCodes).size !== bindingTeams.length) {
  errors.push('Stage 4 bindings do not contain 32 unique teams.');
}
const resolvedBindings = bindingTeams.filter((record) => record.gameContributionEligible === true);
const unresolvedBindings = bindingTeams.filter((record) => record.gameContributionEligible === false);
if (resolvedBindings.length !== contract.bindingPolicy.expectedResolvedTeamCount) {
  errors.push(`Expected ${contract.bindingPolicy.expectedResolvedTeamCount} resolved team bindings, found ${resolvedBindings.length}.`);
}
const unresolvedTeams = unresolvedBindings.map((record) => record.team).sort();
if (JSON.stringify(unresolvedTeams) !== JSON.stringify([...contract.bindingPolicy.expectedUnresolvedTeams].sort())) {
  errors.push(`Unexpected unresolved team set: ${JSON.stringify(unresolvedTeams)}`);
}
for (const record of resolvedBindings) {
  const calculated = Number(record.approvedShadowStarterValue) - Number(record.embeddedBaselineQbValue);
  if (!nearlyEqual(calculated, Number(record.teamQbDelta), 0.011)) {
    errors.push(`${record.team} team QB delta does not reconcile to starter minus baseline.`);
  }
  if (record.teamRatingDecompositionReconstructed !== false) {
    errors.push(`${record.team} improperly reconstructed the team-rating decomposition.`);
  }
}
for (const record of unresolvedBindings) {
  if (record.teamQbDelta !== null || record.approvedShadowStarterValue !== null || record.embeddedBaselineQbValue !== null) {
    errors.push(`${record.team} unresolved binding contains a numeric differential.`);
  }
}

const bindingByTeam = new Map(bindingTeams.map((record) => [record.team, record]));
const games = board.games ?? [];
if (games.length !== contract.activeWeek.expectedGameCount || new Set(games.map((game) => game.gameKey)).size !== games.length) {
  errors.push('Stage 4 shadow board does not contain 16 unique Week 1 games.');
}
const forbiddenFields = new Set(contract.marketIsolation.forbiddenGameFields);
for (const game of games) {
  for (const field of Object.keys(game)) {
    if (forbiddenFields.has(field)) errors.push(`${game.gameKey} exposes forbidden market field ${field}.`);
  }
  const away = bindingByTeam.get(game.away);
  const home = bindingByTeam.get(game.home);
  if (!away || !home) {
    errors.push(`${game.gameKey} references a team without a binding.`);
    continue;
  }
  if (game.currentFairArithmeticVerified !== true) errors.push(`${game.gameKey} current fair arithmetic did not pass.`);
  if (game.qbShadowStatus === 'RESOLVED_DIFFERENTIAL_APPLIED_IN_SHADOW') {
    const expectedQbPoints = Number(away.teamQbDelta) - Number(home.teamQbDelta);
    if (!nearlyEqual(expectedQbPoints, Number(game.homeSpreadQbPoints), 0.0011)) {
      errors.push(`${game.gameKey} home-spread QB differential is wrong.`);
    }
    const expectedExact = Number(game.currentGrahamExactFairHome)
      - Number(game.starterIdentityOverlayPointsEligibleForReplacement)
      + Number(game.homeSpreadQbPoints);
    if (!nearlyEqual(expectedExact, Number(game.recommendedStage4ShadowExactFairHome), 0.0011)) {
      errors.push(`${game.gameKey} reconciled shadow exact is wrong.`);
    }
    if (!nearlyEqual(roundHalfAwayFromZero(expectedExact), Number(game.recommendedStage4ShadowDisplayedFairHome), 1e-9)) {
      errors.push(`${game.gameKey} displayed shadow rounding is wrong.`);
    }
  } else if (game.qbShadowStatus === 'FAIL_CLOSED_GAME_PRESERVED') {
    if (!nearlyEqual(game.currentGrahamExactFairHome, game.recommendedStage4ShadowExactFairHome)) {
      errors.push(`${game.gameKey} fail-closed game did not preserve the current exact fair.`);
    }
    if (!nearlyEqual(game.currentGrahamDisplayedFairHome, game.recommendedStage4ShadowDisplayedFairHome)) {
      errors.push(`${game.gameKey} fail-closed game did not preserve the current displayed fair.`);
    }
  } else {
    errors.push(`${game.gameKey} has unknown shadow status ${game.qbShadowStatus}.`);
  }
  if (game.currentGrahamFairChanged !== false) errors.push(`${game.gameKey} claims the current Graham fair changed.`);
}

if (reconciliation.summary.overlayCount !== contract.overlayPolicy.expectedBindingCount) {
  errors.push('Stage 4 did not reconcile every contracted QB overlay.');
}
if (reconciliation.summary.eligibleForStage5ReplacementCount !== 1) {
  errors.push('Exactly one resolved starter-identity overlay should be eligible for Stage 5 replacement.');
}
if (reconciliation.summary.preservedFailClosedCount !== 1 || reconciliation.summary.preservedOrthogonalCount !== 2) {
  errors.push('Stage 4 overlay preservation counts are wrong.');
}
if (reconciliation.summary.retiredInStage4Count !== 0 || reconciliation.uncertaintyOverlaysRetired !== false) {
  errors.push('Stage 4 retired an uncertainty overlay.');
}
for (const overlay of reconciliation.overlays ?? []) {
  if (overlay.retiredInStage4 !== false || overlay.stackedWithReplacement !== false) {
    errors.push(`${overlay.gameKey} ${overlay.overlayType} was retired or stacked in Stage 4.`);
  }
}

if (rollover.status !== 'PASS' || rollover.activeWeekMutated !== false || rollover.lookAheadAccepted !== false) {
  errors.push('Stage 4 rollover/no-look-ahead audit failed.');
}
if ((rollover.currentSeasonEvidenceScenarios ?? []).some((item) => item.accepted !== item.expected)) {
  errors.push('Current-season evidence gate scenario mismatch.');
}

const requiredCases = new Set(contract.requiredRegressionCases);
const actualCases = new Set((regression.cases ?? []).map((item) => item.caseKey));
if (regression.status !== 'PASS' || regression.failCount !== 0 || regression.passCount !== requiredCases.size) {
  errors.push('Stage 4 regression matrix did not fully pass.');
}
for (const key of requiredCases) {
  if (!actualCases.has(key)) errors.push(`Missing Stage 4 regression case ${key}.`);
}
for (const item of regression.cases ?? []) {
  if (item.result !== 'PASS') errors.push(`Stage 4 regression case failed: ${item.caseKey}`);
}

if (acceptance.status !== 'PASS' || acceptance.decision !== contract.acceptance.passState) {
  errors.push('Stage 4 acceptance decision is not PASS.');
}
if ((acceptance.checks ?? []).some((check) => check.pass !== true)) {
  errors.push('One or more Stage 4 acceptance checks failed.');
}
if (current.status !== contract.acceptance.passState || current.nextStage !== contract.acceptance.nextStageOnPass) {
  errors.push('Stage 4 current state does not point to Stage 5 review.');
}
if (current.resolvedStarterBindings !== contract.bindingPolicy.expectedResolvedTeamCount) {
  errors.push('Stage 4 current resolved binding count is wrong.');
}

const hashLinks = [
  [acceptance.freezeManifest, acceptance.freezeManifestSha256],
  [acceptance.starterBaselineBindings, acceptance.starterBaselineBindingsSha256],
  [acceptance.shadowBoard, acceptance.shadowBoardSha256],
  [acceptance.uncertaintyReconciliation, acceptance.uncertaintyReconciliationSha256],
  [acceptance.rolloverAudit, acceptance.rolloverAuditSha256],
  [acceptance.regressionAudit, acceptance.regressionAuditSha256],
  [current.stage3Acceptance, current.stage3AcceptanceSha256],
  [current.freezeManifest, current.freezeManifestSha256],
  [current.starterBaselineBindings, current.starterBaselineBindingsSha256],
  [current.shadowBoard, current.shadowBoardSha256],
  [current.uncertaintyReconciliation, current.uncertaintyReconciliationSha256],
  [current.rolloverAudit, current.rolloverAuditSha256],
  [current.regressionAudit, current.regressionAuditSha256],
  [current.stage4Acceptance, current.stage4AcceptanceSha256],
];
for (const [filePath, expectedHash] of hashLinks) {
  const file = path.join(ROOT, filePath);
  if (!fs.existsSync(file) || sha256File(file) !== expectedHash) errors.push(`Referenced artifact hash mismatch: ${filePath}`);
}

if (JSON.stringify(regression.protectedArtifactSha256Before) !== JSON.stringify(regression.protectedArtifactSha256After)) {
  errors.push('Regression protected-artifact before/after maps differ.');
}
if (JSON.stringify(acceptance.protectedArtifactSha256Before) !== JSON.stringify(acceptance.protectedArtifactSha256After)) {
  errors.push('Acceptance protected-artifact before/after maps differ.');
}
for (const [filePath, expectedHash] of Object.entries(acceptance.protectedArtifactSha256After ?? {})) {
  const file = path.join(ROOT, filePath);
  if (!fs.existsSync(file) || sha256File(file) !== expectedHash) errors.push(`Protected artifact changed after Stage 4: ${filePath}`);
}

const generated = { freeze, bindings, board, reconciliation, rollover, regression, acceptance, current };
for (const [name, value] of Object.entries(generated)) {
  if (anyTrueKey(value, 'marketViewed')) errors.push(`${name} contains marketViewed:true.`);
  if (anyTrueKey(value, 'productionAuthority')) errors.push(`${name} contains productionAuthority:true.`);
  if (anyTrueKey(value, 'grahamWritesAllowed')) errors.push(`${name} contains grahamWritesAllowed:true.`);
  if (anyTrueKey(value, 'uncertaintyOverlaysRetired')) errors.push(`${name} contains uncertaintyOverlaysRetired:true.`);
}
const serializedGenerated = JSON.stringify(generated);
if (serializedGenerated.includes('APPROVED_WALTERS_QB_PERFORMANCE')) {
  errors.push('Stage 4 generated artifacts contain a production authority token.');
}

if (errors.length) {
  console.error(JSON.stringify({
    schemaVersion: 'walters-qb-performance-stage4-validation-v1',
    status: 'FAIL',
    stage: 4,
    errors,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  schemaVersion: 'walters-qb-performance-stage4-validation-v1',
  status: 'PASS',
  stage: 4,
  checks: [
    'stage3-acceptance-handoff',
    'immutable-stage4-input-freeze',
    'governed-starter-and-baseline-bindings',
    'differential-only-shadow-formula',
    'resolved-overlay-replacement-without-stacking',
    'unresolved-and-orthogonal-overlay-preservation',
    'sixteen-case-regression-matrix',
    'weekly-rollover-and-current-evidence-no-lookahead',
    'protected-artifact-integrity',
    'market-and-production-isolation',
    'stage5-review-only-handoff',
  ],
  bindingSummary: bindings.summary,
  shadowBoardSummary: board.summary,
  uncertaintySummary: reconciliation.summary,
  regressionPassCount: regression.passCount,
  decision: acceptance.decision,
  productionAuthority: false,
  grahamWritesAllowed: false,
  marketViewed: false,
  nextStage: acceptance.nextStage,
}, null, 2));

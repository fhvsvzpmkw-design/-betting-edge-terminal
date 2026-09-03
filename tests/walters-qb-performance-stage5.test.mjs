import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const QB_ROOT = path.join(ROOT, 'data', 'walters', 'nfl', 'qb-performance');
const STAGE5_ROOT = path.join(QB_ROOT, 'stage5');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function sha256File(relativePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, relativePath))).digest('hex');
}

function close(left, right, tolerance = 1e-9) {
  return Math.abs(Number(left) - Number(right)) <= tolerance;
}

function roundHalfAwayFromZero(value) {
  const scaled = Number(value) * 2;
  return (scaled >= 0 ? Math.floor(scaled + 0.5) : Math.ceil(scaled - 0.5)) / 2;
}

function anyTrueKey(value, targetKey) {
  if (Array.isArray(value)) return value.some((item) => anyTrueKey(item, targetKey));
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([key, item]) => (key === targetKey && item === true) || anyTrueKey(item, targetKey));
  }
  return false;
}

const contract = readJson('data/walters/nfl/qb-performance/stage5-contract-v1.json');
const review = readJson('data/walters/nfl/qb-performance/stage5/production-review-v1.json');
const readiness = readJson('data/walters/nfl/qb-performance/stage5/activation-readiness-v1.json');
const regression = readJson('data/walters/nfl/qb-performance/stage5/regression-audit-v1.json');
const acceptance = readJson('data/walters/nfl/qb-performance/stage5-acceptance-v1.json');
const current = readJson('data/walters/nfl/qb-performance/stage5-current.json');

test('Stage 5 is review-only and grants no operational authority', () => {
  assert.equal(contract.stage, 5);
  for (const key of [
    'operational',
    'productionAuthority',
    'grahamWritesAllowed',
    'embeddedBaselineWritesAllowed',
    'uncertaintyOverlayRetirementAllowed',
    'runtimeAdapterWritesAllowed',
    'betAuthority',
    'wagerOrStakeWritesAllowed',
  ]) assert.equal(contract[key], false, key);
  assert.equal(acceptance.productionAuthority, false);
  assert.equal(acceptance.activationAuthorized, false);
  assert.equal(current.currentProductionDisposition, 'REMAIN_NON_OPERATIONAL');
});

test('15:15 control verifies publication but not the NFL quarterback path', () => {
  const control = review.fifteenFifteenControl;
  assert.equal(control.candidateId, contract.productionControl.expectedCandidateId);
  assert.equal(control.label, '15:15 EVENING');
  assert.deepEqual(control.counts, { bet: 0, lean: 0, pass: 9, wait: 0 });
  assert.equal(control.risk, 0);
  assert.equal(control.recommendationCount, 9);
  assert.deepEqual(control.recommendationStatuses, ['PASS']);
  assert.deepEqual(control.recommendationSports, ['MLB']);
  assert.equal(control.derivedNflRecommendationCount, 0);
  assert.equal(control.publicationIntegrityVerified, true);
  assert.equal(control.qbProductionPathVerified, false);
  assert.equal(current.nflPathVerified, false);
});

test('Las Vegas formula reconciles in review while production remains LV -2.5', () => {
  const lv = review.lasVegasStarterIdentityReview;
  const qbPoints = lv.awayTeamQbDelta - lv.homeTeamQbDelta;
  const conservative = lv.currentGrahamExactFairHome + qbPoints;
  const reconciled = lv.currentGrahamExactFairHome - lv.eligibleResolvedStarterIdentityOverlayPoints + qbPoints;
  assert.equal(lv.starterPlayer.playerName, 'Kirk Cousins');
  assert.equal(lv.embeddedBaselinePlayer.playerName, 'Kirk Cousins');
  assert.ok(close(qbPoints, 0.05));
  assert.ok(close(conservative, -2.532));
  assert.ok(close(reconciled, -3.032));
  assert.ok(close(roundHalfAwayFromZero(reconciled), -3));
  assert.ok(close(lv.currentGrahamExactFairHome, -2.582));
  assert.ok(close(lv.currentGrahamDisplayedFairHome, -2.5));
  assert.equal(lv.identityOverlayStillPresent, true);
  assert.equal(lv.overlayRetired, false);
  assert.equal(lv.productionMutationApplied, false);
  assert.equal(current.lasVegasDisplayedFairHome, -2.5);
});

test('Atlanta remains fail-closed and scoped out', () => {
  const atl = review.atlantaFailClosedReview;
  assert.equal(atl.gameKey, '2026-W01-ATL-PIT');
  assert.equal(atl.currentStarterStatus, 'UNRESOLVED_COMPETITION');
  assert.equal(atl.embeddedBaselineStatus, 'UNRESOLVED_COMPOSITE');
  assert.equal(atl.teamQbDelta, null);
  assert.equal(atl.scopedProductionExclusionRequired, true);
  assert.equal(atl.failClosedPreserved, true);
  assert.equal(current.atlantaFailClosed, true);
});

test('all 18 contracted Stage 5 review cases pass', () => {
  const required = new Set(contract.requiredReviewCases);
  const actual = new Set(regression.cases.map((item) => item.caseKey));
  assert.equal(required.size, 18);
  assert.deepEqual(actual, required);
  assert.equal(regression.requiredCaseCount, 18);
  assert.equal(regression.passCount, 18);
  assert.equal(regression.failCount, 0);
  assert.ok(regression.cases.every((item) => item.result === 'PASS'));
});

test('activation remains blocked by an NFL-bearing readback and explicit approval', () => {
  assert.equal(readiness.status, 'REVIEW_PASS_ACTIVATION_NOT_AUTHORIZED');
  assert.equal(readiness.activationAuthorized, false);
  const gates = new Map(readiness.pendingBlockingGates.map((item) => [item.gate, item]));
  for (const key of ['FIRST_NFL_BEARING_PRODUCTION_READBACK', 'EXPLICIT_SCOPED_QB_ACTIVATION_APPROVAL']) {
    assert.equal(gates.get(key)?.status, 'UNSATISFIED');
    assert.equal(gates.get(key)?.blocking, true);
  }
  assert.equal(current.nextRequiredGate, 'FIRST_NFL_BEARING_PRODUCTION_READBACK');
});

test('Stage 5 records matching before/after hashes and its evidence files still read back', () => {
  assert.deepEqual(acceptance.protectedArtifactSha256Before, acceptance.protectedArtifactSha256After);
  for (const [relativePath, expectedHash] of Object.entries(acceptance.protectedArtifactSha256After)) {
    assert.ok(relativePath.length > 0, relativePath);
    assert.match(expectedHash, /^[a-f0-9]{64}$/, relativePath);
  }
  for (const [relativePath, expectedHash] of [
    [acceptance.freezeManifest, acceptance.freezeManifestSha256],
    [acceptance.productionReview, acceptance.productionReviewSha256],
    [acceptance.activationReadiness, acceptance.activationReadinessSha256],
    [acceptance.regressionAudit, acceptance.regressionAuditSha256],
    [current.stage5Acceptance, current.stage5AcceptanceSha256],
  ]) assert.equal(sha256File(relativePath), expectedHash, relativePath);
});

test('generated evidence contains no authority or market-use escalation', () => {
  const generated = { review, readiness, regression, acceptance, current };
  for (const key of [
    'productionAuthority',
    'grahamWritesAllowed',
    'embeddedQbBaselinesChanged',
    'uncertaintyOverlaysRetired',
    'runtimeAdapterChanged',
    'wagerOrStakeChanged',
    'activationAuthorized',
    'marketFieldsCopiedIntoStage5Evidence',
    'marketFieldsUsedByQbFormula',
    'marketFieldsUsedToMoveGrahamFair',
  ]) assert.equal(anyTrueKey(generated, key), false, key);
  assert.equal(JSON.stringify(generated).includes('APPROVED_WALTERS_QB_PERFORMANCE'), false);
  assert.equal(review.marketBoundary.marketBearingProductionArtifactInspectedForPublicationControl, true);
  assert.equal(review.marketBoundary.marketFieldsCopiedIntoStage5Evidence, false);
});

test('Stage 5 output paths remain evidence-only and its workflow is frozen read-only', () => {
  const protectedSet = new Set(contract.protectedArtifacts);
  for (const outputPath of Object.values(contract.outputs)) {
    assert.equal(protectedSet.has(outputPath), false, outputPath);
    assert.match(outputPath, /^data\/walters\/nfl\/qb-performance\/stage5(?:\/|-)/);
  }
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/walters-qb-performance-stage5.yml'), 'utf8');
  assert.match(workflow, /774df41143140f9c5cdd7d0bb30519c886132f82/);
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /\bpush:/);
  assert.doesNotMatch(workflow, /\bpull_request:/);
  assert.doesNotMatch(workflow, /git (?:add|commit|push)/);
  for (const protectedPath of contract.protectedArtifacts) {
    assert.equal(workflow.includes(`git add -- ${protectedPath}`), false, protectedPath);
  }
});

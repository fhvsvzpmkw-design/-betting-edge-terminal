import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const QB_ROOT = path.join(ROOT, 'data', 'walters', 'nfl', 'qb-performance');
const STAGE4_ROOT = path.join(QB_ROOT, 'stage4');

function read(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function nearlyEqual(left, right, tolerance = 1e-9) {
  return Math.abs(Number(left) - Number(right)) <= tolerance;
}

const contract = read('data/walters/nfl/qb-performance/stage4-contract-v1.json');
const bindings = read('data/walters/nfl/qb-performance/stage4/starter-baseline-bindings-v1.json');
const board = read('data/walters/nfl/qb-performance/stage4/shadow-board-v1.json');
const reconciliation = read('data/walters/nfl/qb-performance/stage4/uncertainty-reconciliation-v1.json');
const rollover = read('data/walters/nfl/qb-performance/stage4/rollover-audit-v1.json');
const regression = read('data/walters/nfl/qb-performance/stage4/regression-audit-v1.json');
const acceptance = read('data/walters/nfl/qb-performance/stage4-acceptance-v1.json');
const current = read('data/walters/nfl/qb-performance/stage4-current.json');

test('Stage 4 remains non-operational and hands off only to Stage 5 review', () => {
  assert.equal(acceptance.status, 'PASS');
  assert.equal(acceptance.decision, contract.acceptance.passState);
  assert.equal(acceptance.productionAuthority, false);
  assert.equal(acceptance.grahamWritesAllowed, false);
  assert.equal(current.nextStage, contract.acceptance.nextStageOnPass);
});

test('All 32 teams are bound without candidate-leader starter inference', () => {
  assert.equal(bindings.summary.teamCount, 32);
  assert.equal(bindings.summary.resolvedTeamCount, 31);
  assert.equal(bindings.starterInferenceUsed, false);
  assert.equal(bindings.teamCandidateLeaderUsedAsStarterAuthority, false);
  assert.equal(new Set(bindings.teams.map((team) => team.team)).size, 32);
});

test('Atlanta is the only unresolved team and fails closed', () => {
  assert.deepEqual(bindings.summary.unresolvedTeams, ['ATL']);
  const atl = bindings.teams.find((team) => team.team === 'ATL');
  assert.equal(atl.gameContributionEligible, false);
  assert.equal(atl.teamQbDelta, null);
  const game = board.games.find((item) => item.gameKey === '2026-W01-ATL-PIT');
  assert.equal(game.qbShadowStatus, 'FAIL_CLOSED_GAME_PRESERVED');
  assert.equal(game.recommendedStage4ShadowExactFairHome, game.currentGrahamExactFairHome);
});

test('Resolved team QB values use candidate minus explicitly bound baseline prior', () => {
  for (const team of bindings.teams.filter((item) => item.gameContributionEligible)) {
    assert.ok(nearlyEqual(
      Number(team.approvedShadowStarterValue) - Number(team.embeddedBaselineQbValue),
      Number(team.teamQbDelta),
      0.011,
    ), team.team);
    assert.equal(team.teamRatingDecompositionReconstructed, false);
  }
});

test('All 16 Week 1 shadow games use away delta minus home delta', () => {
  assert.equal(board.games.length, 16);
  const byTeam = new Map(bindings.teams.map((team) => [team.team, team]));
  for (const game of board.games.filter((item) => item.qbShadowStatus === 'RESOLVED_DIFFERENTIAL_APPLIED_IN_SHADOW')) {
    const expected = Number(byTeam.get(game.away).teamQbDelta) - Number(byTeam.get(game.home).teamQbDelta);
    assert.ok(nearlyEqual(expected, game.homeSpreadQbPoints, 0.0011), game.gameKey);
  }
});

test('Las Vegas resolved starter identity overlay is replaced once in shadow, not stacked', () => {
  const game = board.games.find((item) => item.gameKey === '2026-W01-MIA-LV');
  assert.equal(game.starterIdentityOverlayPointsEligibleForReplacement, 0.5);
  assert.ok(nearlyEqual(
    game.recommendedStage4ShadowExactFairHome,
    game.currentGrahamExactFairHome - 0.5 + game.homeSpreadQbPoints,
    0.0011,
  ));
  const eligible = game.overlayReconciliation.filter((item) => item.eligibleForStage5Replacement);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].retiredInStage4, false);
  assert.equal(eligible[0].stackedWithReplacement, false);
});

test('Cleveland re-entry and Kansas City clearance overlays remain orthogonal', () => {
  const orthogonal = reconciliation.overlays.filter((item) =>
    ['REENTRY_EFFECTIVENESS', 'AVAILABILITY_CLEARANCE'].includes(item.overlayClass));
  assert.equal(orthogonal.length, 2);
  for (const item of orthogonal) {
    assert.equal(item.stage4Disposition, 'PRESERVE_ORTHOGONAL_UNCERTAINTY');
    assert.equal(item.retiredInStage4, false);
  }
});

test('Current Graham fair arithmetic reconciles before every shadow calculation', () => {
  assert.equal(board.summary.currentFairArithmeticPassCount, board.summary.gameCount);
  assert.ok(board.games.every((game) => game.currentFairArithmeticVerified === true));
  assert.equal(board.currentGrahamFairNumbersChanged, false);
});

test('Rollover and current-season evidence tests reject look-ahead', () => {
  assert.equal(rollover.status, 'PASS');
  assert.equal(rollover.activeWeekMutated, false);
  assert.equal(rollover.week2CurrentNumbersExists, false);
  assert.equal(rollover.lookAheadAccepted, false);
  assert.ok(rollover.currentSeasonEvidenceScenarios.every((item) => item.accepted === item.expected));
});

test('Every required Stage 4 regression case passes in one audit', () => {
  const required = new Set(contract.requiredRegressionCases);
  assert.equal(regression.status, 'PASS');
  assert.equal(regression.executedCaseCount, required.size);
  assert.equal(regression.passCount, required.size);
  assert.equal(regression.failCount, 0);
  assert.deepEqual(new Set(regression.cases.map((item) => item.caseKey)), required);
  assert.ok(regression.cases.every((item) => item.result === 'PASS'));
});

test('Protected Graham and upstream artifacts are unchanged', () => {
  assert.equal(regression.protectedArtifactsUnchanged, true);
  assert.deepEqual(regression.protectedArtifactSha256After, regression.protectedArtifactSha256Before);
  assert.equal(acceptance.protectedArtifactsUnchanged, true);
  assert.equal(acceptance.grahamFairNumbersChanged, false);
  assert.equal(acceptance.embeddedQbBaselinesChanged, false);
  assert.equal(acceptance.uncertaintyOverlaysRetired, false);
});

test('Stage 4 generated artifacts contain no market fields or marketViewed true state', () => {
  const serialized = JSON.stringify({ bindings, board, reconciliation, rollover, regression, acceptance, current });
  assert.equal(serialized.includes('pinnacleSpreadHome'), false);
  assert.equal(serialized.includes('grahamHomeStrengthGap'), false);
  assert.equal(serialized.includes('"marketViewed":true'), false);
  assert.equal(serialized.includes('APPROVED_WALTERS_QB_PERFORMANCE'), false);
});

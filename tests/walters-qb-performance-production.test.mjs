import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SCRIPT = path.join(ROOT, 'tools/apply-walters-qb-performance-production.mjs');
const VALIDATOR = path.join(ROOT, 'tools/validate-walters-qb-performance-production.mjs');
const TOKEN = 'APPROVED_WALTERS_QB_PERFORMANCE';
const readJson = (root, relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const close = (left, right, tolerance = 0.0005) => Math.abs(Number(left) - Number(right)) <= tolerance;

const contract = readJson(ROOT, 'data/walters/nfl/qb-production/production-contract-v1.json');
const production = readJson(ROOT, 'data/walters/nfl/qb-production-current.json');
const audit = readJson(ROOT, 'data/walters/nfl/qb-production/activation-audit-v1.json');
const rollback = readJson(ROOT, 'data/walters/nfl/qb-production/rollback-week-01-current-numbers-v1.json');
const active = readJson(ROOT, 'data/walters/nfl/active-week.json');
const activeToken = String(Number(active.week)).padStart(2, '0');
const activePaths = {
  board: `data/walters/nfl/${active.season}/week-${activeToken}-current-numbers.json`,
  research: `data/walters/nfl/${active.season}/week-${activeToken}-research-ledger.json`,
  market: `data/walters/nfl/${active.season}/week-${activeToken}-daily-market-ledger.json`,
  personnel: `data/walters/nfl/${active.season}/week-${activeToken}-personnel-ledger.json`,
};
const board = readJson(ROOT, activePaths.board);

function copy(root, relative) {
  const source = path.join(ROOT, relative);
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.copyFileSync(source, target);
}

function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'walters-qb-production-'));
  const files = [
    'data/walters/nfl/active-week.json',
    'data/walters/nfl/graham-fair-decomposition-policy-v1.json',
    activePaths.board,
    activePaths.research,
    activePaths.market,
    activePaths.personnel,
    'data/walters/nfl/2026/week-01-research-ledger.json',
    'data/walters/nfl/2026/week-01-daily-market-ledger.json',
    'data/walters/nfl/2026/week-01-personnel-ledger.json',
    'data/walters/nfl-power-ratings-ledger.json',
    'data/walters/nfl/personnel-production-current.json',
    'data/walters/nfl/matchup-production-current.json',
    'data/walters/nfl/home-field/home-field-production-current.json',
    'data/walters/nfl/qb-production/production-contract-v1.json',
    'data/walters/nfl/qb-production/activation-audit-v1.json',
    'data/walters/nfl/qb-production/rollback-week-01-current-numbers-v1.json',
    'data/walters/nfl/qb-production-current.json',
    'data/walters/nfl/qb-production-staging.json',
    ...Object.values(contract.sourceAuthority).map(item => item.path),
    ...Object.keys(audit.protectedArtifactSha256After),
  ];
  for (const relative of new Set(files)) copy(root, relative);
  return root;
}

function run(root, args, expectedStatus = 0) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {cwd: root, encoding: 'utf8'});
  assert.equal(result.status, expectedStatus, `${result.stdout}\n${result.stderr}`);
  return result;
}

test('explicit activation grants only the governed QB production scope', () => {
  assert.equal(contract.state, 'APPROVED_SCOPED_ACTIVATION');
  assert.equal(contract.authorityToken, TOKEN);
  assert.equal(contract.productionScope.resolvedTeamCount, 31);
  assert.deepEqual(contract.productionScope.excludedTeams, ['ATL']);
  assert.equal(contract.productionScope.grahamFairWritesAllowed, true);
  assert.equal(contract.productionScope.embeddedBaselineWritesAllowed, false);
  assert.equal(contract.productionScope.carriedTeamRatingWritesAllowed, false);
  assert.equal(contract.productionScope.automaticInSeasonRefitAllowed, false);
  assert.equal(contract.postActivationCanary.mayDelayGrahamActivation, false);
});

test('production binds 31 resolved teams and keeps Atlanta fail-closed', () => {
  assert.equal(production.state, 'OPERATIONAL_SCOPED');
  assert.equal(production.productionAuthority, true);
  assert.equal(production.grahamWritesAllowed, true);
  assert.equal(production.teamBindings.length, 32);
  assert.ok(production.teamBindings.filter(item => item.bindingStatus === TOKEN).length <= 31);
  assert.equal(audit.summary.resolvedTeamCount, 31);
  const atlanta = production.teamBindings.find(item => item.team === 'ATL');
  assert.equal(atlanta.bindingStatus, 'FAIL_CLOSED_UNRESOLVED_STARTER_AND_BASELINE');
  assert.equal(atlanta.teamQbDelta, null);
  assert.equal(atlanta.gameContributionEligible, false);
});

test('all Week 1 QB calculations and displayed fairs match the approved formula', () => {
  const expected = {
    '2026-W01-NE-SEA': [0.91, -3.672, -3.5],
    '2026-W01-SF-LAR': [0.32, -2.08, -2],
    '2026-W01-CHI-CAR': [-0.75, 1.168, 1],
    '2026-W01-BAL-IND': [-0.09, 3.328, 3.5],
    '2026-W01-CLE-JAX': [-0.99, -7.072, -7],
    '2026-W01-TB-CIN': [0.1, -2.982, -3],
    '2026-W01-NYJ-TEN': [0.42, -3.662, -3.5],
    '2026-W01-NO-DET': [-0.27, -5.652, -5.5],
    '2026-W01-BUF-HOU': [0.49, 2.408, 2.5],
    '2026-W01-ARI-LAC': [0.42, -7.462, -7.5],
    '2026-W01-GB-MIN': [0.16, 1.078, 1],
    '2026-W01-MIA-LV': [0.05, -3.032, -3],
    '2026-W01-WAS-PHI': [-0.16, -7.242, -7],
    '2026-W01-DAL-NYG': [0.16, 0.578, 0.5],
    '2026-W01-DEN-KC': [0.97, -0.112, 0],
  };
  for (const game of audit.games) {
    if (game.gameKey === '2026-W01-ATL-PIT') continue;
    const values = expected[game.gameKey];
    assert.ok(values, game.gameKey);
    assert.ok(close(game.pointsToHomeSpread, values[0]), `${game.gameKey} QB points`);
    assert.ok(close(game.exactFairHome, values[1]), `${game.gameKey} exact fair`);
    assert.ok(close(game.displayedFairHome, values[2]), `${game.gameKey} displayed fair`);
  }
});

test('Las Vegas retires only the resolved identity overlay and moves to LV -3', () => {
  const game = audit.games.find(item => item.gameKey === '2026-W01-MIA-LV');
  assert.ok(close(game.baseExactFairHome, -3.082));
  assert.ok(close(game.pointsToHomeSpread, 0.05));
  assert.ok(close(game.exactFairHome, -3.032));
  assert.ok(close(game.displayedFairHome, -3));
  assert.ok(close(game.retiredStarterIdentityOverlayPoints, 0.5));
  assert.equal(production.retiredOverlays.length, 1);
  assert.equal(production.retiredOverlays[0].gameKey, game.gameKey);
});

test('Atlanta preserves its prior fair while orthogonal QB overlays remain intact', () => {
  const atlanta = audit.games.find(item => item.gameKey === '2026-W01-ATL-PIT');
  assert.equal(atlanta.status, 'FAIL_CLOSED_GAME_PRESERVED');
  assert.ok(close(atlanta.exactFairHome, -4.582));
  assert.ok(close(atlanta.displayedFairHome, -4.5));
  assert.deepEqual(atlanta.failClosedTeams, ['ATL']);
  assert.deepEqual(
    audit.preservedOrthogonalAdjustments.map(item => [item.gameKey, item.type, item.pointsToHomeSpread]),
    [
      ['2026-W01-CLE-JAX', 'QB_REENTRY', -0.5],
      ['2026-W01-DEN-KC', 'KC_QB_CLEARANCE', 0.5],
    ],
  );
});

test('activation preserves embedded baselines, ratings, betting controls and market isolation', () => {
  assert.deepEqual(audit.protectedArtifactSha256Before, audit.protectedArtifactSha256After);
  assert.equal(audit.protectedArtifactsUnchanged, true);
  assert.equal(audit.embeddedBaselinesChanged, false);
  assert.equal(audit.carriedTeamRatingsChanged, false);
  assert.equal(audit.bettingAuthorityChanged, false);
  assert.equal(audit.wagerOrStakeChanged, false);
  assert.equal(contract.bettingBoundary.qbLayerMaySetBetStatusDirectly, false);
  assert.equal(contract.bettingBoundary.qbLayerMaySetStake, false);
  assert.equal(contract.bettingBoundary.qbLayerMayBypassCoreGates, false);
  assert.equal(JSON.stringify({contract, production, audit, rollback}).includes('"marketViewed": true'), false);
  assert.equal(rollback.boardSha256, audit.activeBoard.beforeSha256);
});

test('reconciliation is byte-idempotent', () => {
  const root = sandbox();
  try {
    const boardPath = path.join(root, activePaths.board);
    const productionPath = path.join(root, 'data/walters/nfl/qb-production-current.json');
    const beforeBoard = fs.readFileSync(boardPath, 'utf8');
    const beforeProduction = fs.readFileSync(productionPath, 'utf8');
    run(root, ['--reconcile']);
    assert.equal(fs.readFileSync(boardPath, 'utf8'), beforeBoard);
    assert.equal(fs.readFileSync(productionPath, 'utf8'), beforeProduction);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('a newly unresolved starter fails closed without guessing or removing the last approved term', () => {
  const root = sandbox();
  try {
    const stagingPath = 'data/walters/nfl/qb-production-staging.json';
    const liveBoard = readJson(root, activePaths.board);
    const bindingByTeam = new Map(production.teamBindings.map(item => [item.team, item]));
    const targetGame = liveBoard.games.find(item =>
      bindingByTeam.get(item.away)?.bindingStatus === TOKEN && bindingByTeam.get(item.home)?.bindingStatus === TOKEN,
    );
    const targetTeam = targetGame.home;
    const resolvedBefore = production.teamBindings.filter(item => item.bindingStatus === TOKEN).length;
    fs.writeFileSync(path.join(root, stagingPath), `${JSON.stringify({
      schema: 1,
      state: 'READY',
      productionId: production.productionId,
      batchId: 'test-sea-unresolved-v1',
      effectiveAt: '2026-09-03T08:00:00-07:00',
      season: 2026,
      week: 1,
      sourceTask: 'TEST',
      marketViewed: false,
      cases: [{
        team: targetTeam,
        bindingStatus: 'FAIL_CLOSED_UNRESOLVED_STARTER',
        currentStarterStatus: 'UNRESOLVED',
        reason: 'Regression fixture: starter identity is unresolved.',
        sourceRefs: ['https://example.com/non-market-fixture'],
      }],
    }, null, 2)}\n`);
    const before = readJson(root, activePaths.board).games.find(item => item.gameKey === targetGame.gameKey);
    run(root, ['--staging', stagingPath]);
    const after = readJson(root, activePaths.board).games.find(item => item.gameKey === targetGame.gameKey);
    assert.equal(after.qbPerformanceStatus, 'FAIL_CLOSED_GAME_PRESERVED');
    assert.deepEqual(after.qbPerformanceFailClosedTeams, [targetTeam]);
    assert.ok(close(after.grahamExactFairHome, before.grahamExactFairHome));
    assert.ok(close(after.grahamFairHome, before.grahamFairHome));
    const manifest = readJson(root, 'data/walters/nfl/qb-production-current.json');
    assert.equal(manifest.teamBindings.filter(item => item.bindingStatus === TOKEN).length, resolvedBefore - 1);
    const validation = spawnSync(process.execPath, [VALIDATOR], {cwd: root, encoding: 'utf8'});
    assert.equal(validation.status, 0, `${validation.stdout}\n${validation.stderr}`);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('market-contaminated staging is rejected before any board write', () => {
  const root = sandbox();
  try {
    const stagingPath = 'data/walters/nfl/qb-production-staging.json';
    const boardPath = path.join(root, activePaths.board);
    const liveBoard = readJson(root, activePaths.board);
    const bindingByTeam = new Map(production.teamBindings.map(item => [item.team, item]));
    const targetGame = liveBoard.games.find(item =>
      bindingByTeam.get(item.away)?.bindingStatus === TOKEN && bindingByTeam.get(item.home)?.bindingStatus === TOKEN,
    );
    const before = fs.readFileSync(boardPath, 'utf8');
    fs.writeFileSync(path.join(root, stagingPath), `${JSON.stringify({
      schema: 1,
      state: 'READY',
      productionId: production.productionId,
      batchId: 'test-market-contamination-v1',
      effectiveAt: '2026-09-03T08:00:00-07:00',
      season: 2026,
      week: 1,
      sourceTask: 'TEST',
      marketViewed: false,
      cases: [{
        team: targetGame.home,
        bindingStatus: 'FAIL_CLOSED_UNRESOLVED_STARTER',
        reason: 'DraftKings line movement was consulted.',
        sourceRefs: ['https://example.com/fixture'],
      }],
    }, null, 2)}\n`);
    const result = run(root, ['--staging', stagingPath], 1);
    assert.match(result.stderr, /STAGING_MARKET_CONTAMINATION/);
    assert.equal(fs.readFileSync(boardPath, 'utf8'), before);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('rollback restores the exact pre-activation board when no later board transaction exists', () => {
  const root = sandbox();
  try {
    const manifestPath = path.join(root, 'data/walters/nfl/active-week.json');
    const weekOneManifest = {...active, season: 2026, week: 1, state: 'ACTIVE', authority: 'GRAHAM_WEEK_ROLLOVER'};
    fs.writeFileSync(manifestPath, `${JSON.stringify(weekOneManifest, null, 2)}\n`);
    const weekOneBoardPath = path.join(root, 'data/walters/nfl/2026/week-01-current-numbers.json');
    fs.writeFileSync(weekOneBoardPath, `${JSON.stringify(rollback.board, null, 2)}\n`);
    fs.rmSync(path.join(root, 'data/walters/nfl/qb-production-current.json'));
    fs.rmSync(path.join(root, 'data/walters/nfl/qb-production/activation-audit-v1.json'));
    fs.rmSync(path.join(root, 'data/walters/nfl/qb-production/rollback-week-01-current-numbers-v1.json'));
    run(root, ['--activate']);
    run(root, ['--rollback']);
    const restored = readJson(root, 'data/walters/nfl/2026/week-01-current-numbers.json');
    assert.deepEqual(restored, rollback.board);
    const manifest = readJson(root, 'data/walters/nfl/qb-production-current.json');
    assert.equal(manifest.state, 'ROLLED_BACK_FAIL_CLOSED');
    assert.equal(manifest.productionAuthority, false);
    assert.equal(manifest.grahamWritesAllowed, false);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

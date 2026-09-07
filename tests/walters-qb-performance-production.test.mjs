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

const CONTRACT_PATH = 'data/walters/nfl/qb-production/production-contract-v1.json';
const PRODUCTION_PATH = 'data/walters/nfl/qb-production-current.json';
const STAGING_PATH = 'data/walters/nfl/qb-production-staging.json';
const ATL_GAME = '2026-W01-ATL-PIT';
const writeJson = (root, relative, value) => fs.writeFileSync(path.join(root, relative), `${JSON.stringify(value, null, 2)}\n`);
const WEEK_ONE_BOARD = 'data/walters/nfl/2026/week-01-current-numbers.json';
const atlGame = root => readJson(root, WEEK_ONE_BOARD).games.find(item => item.gameKey === ATL_GAME);

function activateLegacy(root) {
  writeJson(root, 'data/walters/nfl/active-week.json', {...active, season: 2026, week: 1, state: 'ACTIVE', authority: 'GRAHAM_WEEK_ROLLOVER'});
  writeJson(root, 'data/walters/nfl/2026/week-01-current-numbers.json', rollback.board);
  for (const relative of [PRODUCTION_PATH, 'data/walters/nfl/qb-production/activation-audit-v1.json', 'data/walters/nfl/qb-production/rollback-week-01-current-numbers-v1.json']) fs.rmSync(path.join(root, relative));
  const legacy = structuredClone(contract);
  delete legacy.scopeAmendments;
  legacy.productionScope.resolvedTeamCount = 31;
  legacy.productionScope.excludedTeams = ['ATL'];
  legacy.uncertaintyOverlayReconciliation.rules = legacy.uncertaintyOverlayReconciliation.rules.filter(item => !item.scopeAmendmentId);
  writeJson(root, CONTRACT_PATH, legacy);
  run(root, ['--activate']);
}

function stageAtlanta(root, suffix, item) {
  const fixtureActive = readJson(root, 'data/walters/nfl/active-week.json');
  writeJson(root, STAGING_PATH, {
    schema: 1, state: 'READY', productionId: production.productionId,
    batchId: `test-atl-${suffix}`, effectiveAt: '2026-09-08T08:00:00-07:00',
    season: fixtureActive.season, week: fixtureActive.week, sourceTask: 'TEST', marketViewed: false,
    cases: [{team: 'ATL', reason: 'Synthetic non-market regression fixture.', sourceRefs: ['https://example.com/fixture'], ...item}],
  });
  run(root, ['--staging', STAGING_PATH]);
}

test('Atlanta admission changes only its matchup, retires uncertainty once and preserves frozen evidence', () => {
  const root = sandbox();
  try {
    activateLegacy(root);
    const before = readJson(root, WEEK_ONE_BOARD);
    const protectedPaths = [...Object.keys(audit.protectedArtifactSha256After), ...Object.values(contract.sourceAuthority).map(item => item.path),
      'data/walters/nfl/qb-production/activation-audit-v1.json', 'data/walters/nfl/qb-production/rollback-week-01-current-numbers-v1.json'];
    const protectedBytes = new Map(protectedPaths.map(relative => [relative, fs.readFileSync(path.join(root, relative))]));
    writeJson(root, CONTRACT_PATH, contract);
    // Freeze this migration fixture independently of whatever later batch is live.
    stageAtlanta(root, 'initial-admission', {bindingStatus: 'RESOLVED_CURRENT_STARTER', currentStarterStatus: 'CONFIRMED_NAMED_STARTER', playerId: '20916', gsisId: '00-0036212', playerName: 'Tua Tagovailoa'});
    const after = readJson(root, WEEK_ONE_BOARD);
    const game = atlGame(root);
    const manifest = readJson(root, PRODUCTION_PATH);
    assert.equal(before.games.find(item => item.gameKey === ATL_GAME).grahamExactFairHome, -4.582);
    assert.equal(game.qbPerformanceBaseExactFairHome, -4.082);
    assert.equal(game.qbPerformanceAwayTeamDelta, 0);
    assert.equal(game.qbPerformanceHomeTeamDelta, -0.75);
    assert.equal(game.qbPerformancePointsToHomeSpread, 0.75);
    assert.equal(game.grahamExactFairHome, -3.332);
    assert.equal(game.grahamFairHome, -3.5);
    assert.equal(game.adjustments.filter(item => item.type === 'QB_UNCERTAINTY').length, 0);
    assert.equal(game.adjustments.filter(item => item.type === 'QB_PERFORMANCE_PRODUCTION').length, 1);
    assert.equal(manifest.retiredOverlays.filter(item => item.gameKey === ATL_GAME).length, 1);
    assert.equal(manifest.appliedScopeAmendments.length, 1);
    assert.deepEqual(after.games.filter(item => item.gameKey !== ATL_GAME), before.games.filter(item => item.gameKey !== ATL_GAME));
    for (const [relative, bytes] of protectedBytes) assert.deepEqual(fs.readFileSync(path.join(root, relative)), bytes, relative);
    const finalBytes = [WEEK_ONE_BOARD, PRODUCTION_PATH].map(relative => fs.readFileSync(path.join(root, relative), 'utf8'));
    run(root, ['--staging', STAGING_PATH]);
    run(root, ['--reconcile']);
    assert.deepEqual([WEEK_ONE_BOARD, PRODUCTION_PATH].map(relative => fs.readFileSync(path.join(root, relative), 'utf8')), finalBytes);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});

for (const [name, mutate, error] of [
  ['missing explicit approval', value => { value.scopeAmendments[0].approval.source = 'ROUTINE_TASK'; }, /ATLANTA_AMENDMENT_INVALID/],
  ['unequal baseline value', value => { value.scopeAmendments[0].baseline.value = 7.99; }, /ATLANTA_BASELINE_NOT_VALUE_INVARIANT/],
  ['missing candidate', value => { value.scopeAmendments[0].baseline.candidatePlayerIds.pop(); }, /ATLANTA_BASELINE_CANDIDATES_INVALID/],
  ['changed frozen source', value => { value.sourceAuthority.candidateRegistry.sha256 = '0'.repeat(64); }, /SOURCE.*HASH|HASH.*MISMATCH/],
]) test(`Atlanta admission rejects ${name} before writing production`, () => {
  const root = sandbox();
  try {
    activateLegacy(root);
    const before = [activePaths.board, PRODUCTION_PATH].map(relative => fs.readFileSync(path.join(root, relative), 'utf8'));
    const invalid = structuredClone(contract);
    mutate(invalid);
    writeJson(root, CONTRACT_PATH, invalid);
    const result = run(root, ['--staging', STAGING_PATH], 1);
    assert.match(result.stderr, error);
    assert.deepEqual([activePaths.board, PRODUCTION_PATH].map(relative => fs.readFileSync(path.join(root, relative), 'utf8')), before);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});

test('later Atlanta uncertainty preserves the fair and a new starter uses the same baseline', () => {
  const root = sandbox();
  try {
    activateLegacy(root);
    writeJson(root, CONTRACT_PATH, contract);
    stageAtlanta(root, 'future-test-admission', {bindingStatus: 'RESOLVED_CURRENT_STARTER', currentStarterStatus: 'CONFIRMED_NAMED_STARTER', playerId: '20916'});
    const before = atlGame(root);
    stageAtlanta(root, 'unresolved', {bindingStatus: 'FAIL_CLOSED_UNRESOLVED_STARTER', currentStarterStatus: 'UNRESOLVED'});
    const unresolved = atlGame(root);
    assert.equal(unresolved.qbPerformanceStatus, 'FAIL_CLOSED_GAME_PRESERVED');
    assert.deepEqual(unresolved.qbPerformanceFailClosedTeams, ['ATL']);
    assert.equal(unresolved.grahamExactFairHome, before.grahamExactFairHome);
    assert.deepEqual(unresolved.adjustments, before.adjustments);
    const validation = spawnSync(process.execPath, [VALIDATOR], {cwd: root, encoding: 'utf8'});
    assert.equal(validation.status, 0, `${validation.stdout}\n${validation.stderr}`);
    stageAtlanta(root, 'penix', {bindingStatus: 'RESOLVED_CURRENT_STARTER', currentStarterStatus: 'CONFIRMED_NAMED_STARTER', playerId: '14608', gsisId: '00-0039917', playerName: 'Michael Penix Jr'});
    const resolved = atlGame(root);
    const manifest = readJson(root, PRODUCTION_PATH);
    const binding = manifest.teamBindings.find(item => item.team === 'ATL');
    assert.equal(binding.embeddedBaselineQbValue, 7.5);
    assert.equal(binding.teamQbDelta, 0.49);
    assert.ok(close(resolved.grahamExactFairHome, before.qbPerformanceBaseExactFairHome + 0.49 - resolved.qbPerformanceHomeTeamDelta));
    assert.equal(resolved.adjustments.filter(item => item.type === 'QB_UNCERTAINTY').length, 0);
    assert.equal(manifest.retiredOverlays.filter(item => item.gameKey === ATL_GAME).length, 1);
    run(root, ['--check']);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});

test('null Atlanta baseline cannot silently become zero', () => {
  const root = sandbox();
  try {
    const manifest = readJson(root, PRODUCTION_PATH);
    manifest.teamBindings.find(item => item.team === 'ATL').embeddedBaselineQbValue = null;
    writeJson(root, PRODUCTION_PATH, manifest);
    assert.match(run(root, ['--check'], 1).stderr, /ATLANTA_BASELINE_BINDING_INVALID/);
  } finally { fs.rmSync(root, {recursive: true, force: true}); }
});

test('explicit activation grants only the governed QB production scope', () => {
  assert.equal(contract.state, 'APPROVED_SCOPED_ACTIVATION');
  assert.equal(contract.authorityToken, TOKEN);
  assert.equal(contract.productionScope.resolvedTeamCount, 32);
  assert.deepEqual(contract.productionScope.excludedTeams, []);
  assert.equal(contract.scopeAmendments[0].approval.source, 'USER_EXPLICIT_PROJECT_CONVERSATION');
  assert.equal(contract.productionScope.grahamFairWritesAllowed, true);
  assert.equal(contract.productionScope.embeddedBaselineWritesAllowed, false);
  assert.equal(contract.productionScope.carriedTeamRatingWritesAllowed, false);
  assert.equal(contract.productionScope.automaticInSeasonRefitAllowed, false);
  assert.equal(contract.postActivationCanary.mayDelayGrahamActivation, false);
});

test('Atlanta has a documented equal-prior baseline while original activation evidence stays intact', () => {
  assert.equal(production.state, 'OPERATIONAL_SCOPED');
  assert.equal(production.productionAuthority, true);
  assert.equal(production.grahamWritesAllowed, true);
  assert.equal(production.teamBindings.length, 32);
  assert.ok(production.teamBindings.filter(item => item.bindingStatus === TOKEN).length <= 32);
  assert.equal(audit.summary.resolvedTeamCount, 31);
  const atlanta = production.teamBindings.find(item => item.team === 'ATL');
  assert.equal(atlanta.embeddedBaselineStatus, 'RESOLVED_VALUE_INVARIANT_COMPOSITE');
  assert.equal(atlanta.embeddedBaselinePlayer, null);
  assert.equal(atlanta.embeddedBaselineQbValue, 7.5);
  assert.deepEqual(atlanta.embeddedBaselineCandidates.map(item => item.priorValue), [7.5, 7.5]);
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
  assert.equal(production.retiredOverlays.filter(item => item.gameKey === game.gameKey).length, 1);
});

test('original activation audit preserves the then-excluded Atlanta fair and orthogonal overlays', () => {
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
    activateLegacy(root);
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

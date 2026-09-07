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
const readText = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

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
    'data/walters/nfl/current-week-terminal.json',
    'data/walters/nfl/graham-schedule-authority-v1.json',
    'data/walters/nfl/player-values/stage2-current.json',
    'data/walters/nfl/stage3/stage3-current.json',
    'data/walters/nfl/player-values/player-values-2026-v1.json',
    'data/walters/nfl/personnel-calibration-v1.json',
    'data/walters/nfl/matchup-stage3/stage3-current.json',
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

test('numeric publisher completion routes through QB reconciliation before terminal refresh', () => {
  const qb = readText('.github/workflows/graham-qb-performance-production.yml');
  const terminal = readText('.github/workflows/graham-terminal-refresh.yml');
  const followers = workflow => workflow.match(/  workflow_run:\n    workflows:\n([\s\S]*?)    branches:/)?.[1]
    .split('\n').map(line => line.trim().replace(/^- /, '')).filter(Boolean);
  const publishers = ['graham-personnel-production', 'graham-matchup-production', 'walters-matchup-m5-catchup', 'walters-home-field-h4', 'graham-research-input'];
  for (const file of publishers) {
    const name = readText(`.github/workflows/${file}.yml`).match(/^name: (.+)$/m)[1];
    assert.ok(followers(qb).includes(name), `${name} must trigger QB reconciliation`);
    assert.ok(!followers(terminal).includes(name), `${name} must not bypass QB reconciliation`);
  }
  assert.ok(followers(terminal).includes('Graham QB performance production'));
  assert.ok(followers(terminal).includes('Refresh Betting Edge odds'));
  assert.ok(!followers(qb).includes('Refresh Graham NFL terminal'), 'the chain must not loop');
  for (const workflow of [qb, terminal]) {
    assert.match(workflow, /workflow_run:[\s\S]*?branches: \[main\]/);
    assert.match(workflow, /if:.*workflow_run\.conclusion == 'success'.*workflow_run\.head_branch == 'main'.*workflow_run\.head_repository\.full_name == github\.repository/);
  }
  const publishing = terminal.slice(terminal.indexOf('          for attempt'));
  const gate = publishing.indexOf('node tools/validate-walters-qb-performance-production.mjs');
  assert.ok(gate > publishing.indexOf('git reset --hard origin/main'), 'validate the refreshed main checkout');
  assert.ok(gate < publishing.indexOf('node tools/capture-graham-daily-pinnacle.mjs'), 'QB validation must precede market capture');
  assert.ok(gate < publishing.indexOf('node tools/build-graham-current-week.mjs'), 'QB validation must precede terminal construction');
  assert.match(publishing, /if ! node tools\/validate-walters-qb-performance-production\.mjs; then[\s\S]*?sleep 30\n\s+continue[\s\S]*?exit 1\n\s+fi/, 'retry pending reconciliation and stop publication if validation never succeeds');
  assert.match(publishing, /git push origin HEAD:main/);
});

for (const kind of ['personnel', 'matchup']) test(`${kind} change keeps its fair through QB reconciliation and terminal publication`, () => {
  const root = sandbox();
  const invoke = (name, args = [], expectedStatus = 0) => {
    const result = spawnSync(process.execPath, [path.join(ROOT, 'tools', name), ...args], {cwd: root, encoding: 'utf8'});
    assert.equal(result.status, expectedStatus, `${result.stdout}\n${result.stderr}`);
    return result;
  };
  const boardPath = WEEK_ONE_BOARD;
  const terminalPath = 'data/walters/nfl/current-week-terminal.json';
  const bytes = relative => fs.readFileSync(path.join(root, relative), 'utf8');
  const getGame = key => readJson(root, boardPath).games.find(game => game.gameKey === key);
  const sync = () => invoke('graham-fair-decomposition.mjs', ['--path', boardPath, '--write']);
  const activeReturn = (player, team, side, gameKey) => {
    writeJson(root, 'test-personnel.json', {
      schema: 1, state: 'READY', batchId: `test-${kind}-return`, effectiveAt: '2026-09-08T09:00:00-07:00',
      sourceTask: 'SYNTHETIC_REGRESSION_ONLY', season: 2026, week: 1, marketViewed: false,
      cases: [{personnelEventId: `test-${kind}-return-event`, caseKey: `2026-W01-${team}-${player.replaceAll(' ', '-')}`,
        gameKey, team, side, player, availabilityStatus: 'ACTIVE_FULL', resolutionStatus: 'RESOLVED_ACTIVE',
        reason: 'Synthetic fixture, not a real availability assertion.', sourceRefs: ['https://example.com/fixture']}],
    });
    invoke('apply-graham-personnel-staging.mjs', ['test-personnel.json']);
    sync();
  };
  try {
    // Fixed historical fixture keeps this regression valid after active-week rollover.
    activateLegacy(root);
    writeJson(root, CONTRACT_PATH, contract);
    stageAtlanta(root, `handoff-${kind}`, {bindingStatus: 'RESOLVED_CURRENT_STARTER', playerId: '20916'});
    invoke('graham-schedule-authority.mjs', ['--path', boardPath, '--write']);
    const gameKey = kind === 'personnel' ? '2026-W01-NO-DET' : '2026-W01-SF-LAR';
    if (kind === 'matchup') {
      activeReturn('Ricky Pearsall', 'SF', 'AWAY', gameKey);
      run(root, ['--reconcile']);
    }
    invoke('validate-walters-qb-performance-production.mjs');
    invoke('build-graham-current-week.mjs');
    const publishedBefore = bytes(terminalPath);
    const before = getGame(gameKey);
    if (kind === 'personnel') activeReturn('Isiah Pacheco', 'DET', 'HOME', gameKey);
    else {
      // Freeze the accepted Week 1 committee fixture independently of later batches.
      const historicalCase = readJson(root, 'data/walters/nfl/2026/week-01-personnel-ledger.json').events
        .find(item => item.caseKey === '2026-W01-SF-Ricky-Pearsall' && item.resolutionStatus === 'RESOLVED_VALUE_INVARIANT_COMMITTEE');
      assert.ok(historicalCase, 'accepted committee fixture must exist');
      writeJson(root, 'test-matchup.json', {schema: 1, state: 'READY', marketViewed: false, season: 2026, week: 1, batchId: 'test-matchup-handoff',
        effectiveAt: '2026-09-08T10:00:00-07:00', sourceTask: 'SYNTHETIC_REGRESSION_ONLY',
        cases: [{...historicalCase, matchupEventId: 'test-matchup-handoff-event', personnelEventId: 'test-matchup-handoff-event',
          productionClass: 'VALUE_INVARIANT_COMMITTEE',
          committeeCandidates: historicalCase.committee.map(({player, eaPlayerId}) => ({player, eaPlayerId})),
          reason: 'Synthetic replay of the accepted committee, not new research.'}],
      });
      invoke('apply-graham-matchup-production.mjs', ['test-matchup.json']);
      sync();
    }
    const changed = getGame(gameKey);
    assert.notEqual(changed.grahamExactFairHome, before.grahamExactFairHome, 'fixture must exercise a numeric change');
    assert.equal(changed.qbPerformancePointsToHomeSpread, before.qbPerformancePointsToHomeSpread);
    // Execute the same gate-then-build order as the terminal workflow.
    const blocked = invoke('validate-walters-qb-performance-production.mjs', [], 1);
    assert.match(blocked.stderr, new RegExp(`QB_TERM_ARITHMETIC_INVALID:${gameKey}`));
    assert.equal(bytes(terminalPath), publishedBefore, 'stale QB state must leave the published feed intact');
    const preservedPaths = ['data/walters/nfl/2026/week-01-personnel-ledger.json', 'data/walters/nfl/2026/week-01-research-ledger.json',
      'data/walters/nfl/2026/week-01-daily-market-ledger.json', 'data/walters/nfl-power-ratings-ledger.json', PRODUCTION_PATH];
    const preserved = preservedPaths.map(bytes);
    run(root, ['--reconcile']);
    invoke('validate-walters-qb-performance-production.mjs');
    const reconciled = getGame(gameKey);
    assert.equal(reconciled.grahamExactFairHome, changed.grahamExactFairHome);
    assert.equal(reconciled.grahamFairHome, changed.grahamFairHome);
    assert.ok(close(reconciled.qbPerformanceBaseExactFairHome + reconciled.qbPerformancePointsToHomeSpread, reconciled.grahamExactFairHome));
    assert.equal(reconciled.adjustments.filter(item => item.type === 'QB_PERFORMANCE_PRODUCTION').length, 1);
    assert.deepEqual(preservedPaths.map(bytes), preserved, 'reconciliation must preserve football evidence, market snapshots and fixed bindings');
    invoke('build-graham-current-week.mjs');
    assert.equal(readJson(root, terminalPath).games.find(game => game.gameKey === gameKey).grahamFairHome, changed.grahamFairHome);
    const reconciledBytes = bytes(boardPath);
    run(root, ['--reconcile']);
    assert.equal(bytes(boardPath), reconciledBytes, 'duplicate completion must not add QB points again');
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

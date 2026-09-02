#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveGrahamActiveWeek } from '../tools/graham-active-week.mjs';
import { roundHalf } from '../tools/graham-fair-decomposition.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const round = (n, d = 3) => Number(Number(n).toFixed(d));

function run(relScript, args = [], { cwd = ROOT, expectFailure = false } = {}) {
  const script = path.join(ROOT, relScript);
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
  const combined = `${result.stdout || ''}${result.stderr || ''}`;
  if (expectFailure) {
    assert.notEqual(result.status, 0, `Expected failure from ${relScript}, but it passed. Output:\n${combined}`);
  } else {
    assert.equal(result.status, 0, `${relScript} failed with ${result.status}. Output:\n${combined}`);
  }
  return { ...result, combined };
}

function copyRel(tmp, rel) {
  const src = path.join(ROOT, rel);
  const dst = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function writeJson(root, rel, value) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function choosePersonnelPair(registry) {
  const groups = new Map();
  for (const p of registry.players || []) {
    if (p?.valueStatus !== 'CALIBRATED' || !Number.isFinite(Number(p?.waltersPoints)) || p?.position === 'QB') continue;
    const arr = groups.get(p.position) || [];
    arr.push(p);
    groups.set(p.position, arr);
  }
  for (const arr of groups.values()) {
    arr.sort((a, b) => Number(b.waltersPoints) - Number(a.waltersPoints));
    if (arr.length >= 2 && Number(arr[0].waltersPoints) > Number(arr.at(-1).waltersPoints)) {
      return { player: arr[0], replacement: arr.at(-1) };
    }
  }
  throw new Error('STAGE4_NO_NON_QB_PERSONNEL_PAIR');
}

function makePersonnelSandbox() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'graham-stage4-personnel-'));
  const dependencies = [
    'data/walters/nfl/personnel-production-current.json',
    'data/walters/nfl/player-values/stage2-current.json',
    'data/walters/nfl/stage3/stage3-current.json',
    'data/walters/nfl/player-values/player-values-2026-v1.json',
    'data/walters/nfl/personnel-calibration-v1.json',
    'data/walters/nfl/graham-fair-decomposition-policy-v1.json'
  ];
  for (const rel of dependencies) copyRel(tmp, rel);

  const registry = readJson(path.join(tmp, 'data/walters/nfl/player-values/player-values-2026-v1.json'));
  const pair = choosePersonnelPair(registry);
  const gameKey = '2026-W01-ST4-OPP';
  const baseExact = -2.082;

  writeJson(tmp, 'data/walters/nfl/2026/week-01-current-numbers.json', {
    schema: 1,
    season: 2026,
    week: 1,
    timezone: 'America/Vancouver',
    rules: { marketIsolation: 'Finish independent Graham fair before viewing market.' },
    games: [{
      gameKey,
      away: 'OPP',
      home: 'ST4',
      neutralBaseHome: 0,
      grahamExactFairHome: baseExact,
      grahamFairHome: roundHalf(baseExact),
      homeFieldPointsToHomeSpread: -2.082,
      personnelOverlayPointsToHomeSpread: 0,
      adjustments: [{ type: 'HOME_FIELD', pointsToHomeSpread: -2.082 }],
      sourceRefs: []
    }]
  });

  writeJson(tmp, 'data/walters/nfl/2026/week-01-research-ledger.json', {
    schema: 1,
    season: 2026,
    week: 1,
    state: 'ACTIVE',
    policy: { appendOnly: true, marketIsolation: 'Research completed before market comparison.' },
    sweeps: []
  });

  return { tmp, pair, gameKey, baseExact };
}

function stagingFor({ pair, gameKey, batchId, eventId, marketViewed = false }) {
  return {
    schema: 1,
    state: 'READY',
    season: 2026,
    week: 1,
    marketViewed,
    batchId,
    effectiveAt: '2026-09-02T00:00:00-07:00',
    sourceTask: 'STAGE4_REGRESSION',
    cases: [{
      personnelEventId: eventId,
      caseKey: '2026-W01-ST4-SYNTHETIC-PLAYER',
      gameKey,
      team: 'ST4',
      side: 'HOME',
      player: pair.player.player,
      playerEaId: pair.player.eaPlayerId,
      availabilityStatus: 'OUT',
      resolutionStatus: 'RESOLVED_ONE_FOR_ONE',
      replacementPlayer: pair.replacement.player,
      replacementEaId: pair.replacement.eaPlayerId,
      reason: 'Synthetic Stage 4 one-for-one personnel regression.',
      sourceRefs: ['https://example.com/graham-stage4-regression']
    }]
  };
}

function applyPersonnelSandbox(sb, batchId, eventId) {
  writeJson(sb.tmp, 'data/walters/nfl/personnel-staging.json', stagingFor({
    pair: sb.pair,
    gameKey: sb.gameKey,
    batchId,
    eventId,
    marketViewed: false
  }));
  run('tools/apply-graham-personnel-staging.mjs', ['data/walters/nfl/personnel-staging.json'], { cwd: sb.tmp });
  run('tools/graham-fair-decomposition.mjs', ['--path', 'data/walters/nfl/2026/week-01-current-numbers.json', '--write'], { cwd: sb.tmp });
  run('tools/graham-fair-decomposition.mjs', ['--path', 'data/walters/nfl/2026/week-01-current-numbers.json'], { cwd: sb.tmp });
}

const passed = [];
function check(name, fn) {
  fn();
  passed.push(name);
  console.log(`STAGE4 ${name}: PASS`);
}

check('NO_CHANGE_RUN', () => {
  const fixturePath = path.join(ROOT, 'tests/fixtures/graham-research-completion-no-change.json');
  const fixture = readJson(fixturePath);
  const sweep = fixture.ledger.sweeps[0];
  assert.equal(sweep.completionResult, 'NO_MATERIAL_CHANGE');
  assert.equal(sweep.summary.marketViewed, false);
  assert.deepEqual(sweep.ratingChanges, []);
  assert.deepEqual(sweep.matchupChanges, []);
  const result = run('tools/validate-graham-research-completion.mjs', ['--fixture', 'tests/fixtures/graham-research-completion-no-change.json']);
  assert.match(result.combined, /PASS/i);
});

check('PERSONNEL_CHANGE', () => {
  const sb = makePersonnelSandbox();
  try {
    applyPersonnelSandbox(sb, 'stage4-personnel-batch-1', 'stage4-personnel-event-1');
    const numbers = readJson(path.join(sb.tmp, 'data/walters/nfl/2026/week-01-current-numbers.json'));
    const research = readJson(path.join(sb.tmp, 'data/walters/nfl/2026/week-01-research-ledger.json'));
    const game = numbers.games[0];
    const rawDelta = round(Number(sb.pair.replacement.waltersPoints) - Number(sb.pair.player.waltersPoints));
    assert.ok(rawDelta < 0, 'Synthetic personnel starter must be worth more than replacement');
    const expectedOverlay = round(-rawDelta);
    const expectedExact = round(sb.baseExact + expectedOverlay);
    assert.equal(game.neutralBaseHome, 0, 'Personnel production must not alter carried neutral team base');
    assert.equal(game.personnelOverlayPointsToHomeSpread, expectedOverlay);
    assert.equal(game.grahamExactFairHome, expectedExact);
    assert.equal(game.grahamFairHome, roundHalf(expectedExact));
    assert.equal(game.fairDecomposition.personnelPointsToHomeSpread, expectedOverlay);
    assert.equal(game.fairDecomposition.exactFairHome, expectedExact);
    assert.match(game.researchSummary, new RegExp(`exact Graham home fair [+-]${Math.abs(expectedExact).toFixed(3).replace('.', '\\.')}`));
    const sweep = research.sweeps.at(-1);
    assert.equal(sweep.type, 'PERSONNEL_PRODUCTION_BATCH');
    assert.deepEqual(sweep.ratingChanges, []);
    assert.equal(sweep.summary.carriedRatingMoves, 0);
    assert.equal(sweep.summary.marketViewed, false);
  } finally {
    fs.rmSync(sb.tmp, { recursive: true, force: true });
  }
});

check('SUMMARY_ARITHMETIC', () => {
  run('tests/graham-fair-decomposition.test.mjs');
  const active = resolveGrahamActiveWeek();
  const result = run('tools/graham-fair-decomposition.mjs', ['--path', active.paths.currentNumbers]);
  assert.match(result.combined, /READBACK VERIFIED/);
});

check('SCHEDULE_INHERITANCE', () => {
  run('tests/graham-schedule-authority.test.mjs');
  const active = resolveGrahamActiveWeek();
  const board = run('tools/graham-schedule-authority.mjs', ['--path', active.paths.currentNumbers]);
  const ledger = run('tools/graham-schedule-authority.mjs', ['--path', active.paths.researchLedger]);
  assert.match(board.combined, /CURRENT_NUMBERS/);
  assert.match(ledger.combined, /RESEARCH_LEDGER/);
});

check('MARKET_ISOLATION', () => {
  const active = resolveGrahamActiveWeek();
  const numbers = readJson(path.join(ROOT, active.paths.currentNumbers));
  const research = readJson(path.join(ROOT, active.paths.researchLedger));
  assert.match(numbers.rules.marketIsolation, /before viewing/i);
  assert.match(research.policy.marketIsolation, /before contemporaneous Pinnacle comparison/i);

  const capture = fs.readFileSync(path.join(ROOT, 'tools/capture-graham-daily-pinnacle.mjs'), 'utf8');
  assert.match(capture, /fs\.writeFileSync\(MARKET,/);
  assert.doesNotMatch(capture, /fs\.writeFileSync\(NUMBERS,/);

  const sb = makePersonnelSandbox();
  try {
    const beforeNumbers = fs.readFileSync(path.join(sb.tmp, 'data/walters/nfl/2026/week-01-current-numbers.json'), 'utf8');
    const beforeResearch = fs.readFileSync(path.join(sb.tmp, 'data/walters/nfl/2026/week-01-research-ledger.json'), 'utf8');
    writeJson(sb.tmp, 'data/walters/nfl/personnel-staging.json', stagingFor({
      pair: sb.pair,
      gameKey: sb.gameKey,
      batchId: 'stage4-market-isolation-batch',
      eventId: 'stage4-market-isolation-event',
      marketViewed: true
    }));
    const failed = run('tools/apply-graham-personnel-staging.mjs', ['data/walters/nfl/personnel-staging.json'], { cwd: sb.tmp, expectFailure: true });
    assert.match(failed.combined, /MARKET_ISOLATION_FAILURE/);
    assert.equal(fs.readFileSync(path.join(sb.tmp, 'data/walters/nfl/2026/week-01-current-numbers.json'), 'utf8'), beforeNumbers);
    assert.equal(fs.readFileSync(path.join(sb.tmp, 'data/walters/nfl/2026/week-01-research-ledger.json'), 'utf8'), beforeResearch);
    assert.equal(fs.existsSync(path.join(sb.tmp, 'data/walters/nfl/2026/week-01-personnel-ledger.json')), false);
  } finally {
    fs.rmSync(sb.tmp, { recursive: true, force: true });
  }
});

check('DOUBLE_COUNT_PROTECTION', () => {
  const sb = makePersonnelSandbox();
  try {
    applyPersonnelSandbox(sb, 'stage4-double-count-batch-1', 'stage4-double-count-event-1');
    const firstNumbersPath = path.join(sb.tmp, 'data/walters/nfl/2026/week-01-current-numbers.json');
    const first = readJson(firstNumbersPath).games[0];
    const firstExact = first.grahamExactFairHome;
    const firstOverlay = first.personnelOverlayPointsToHomeSpread;

    applyPersonnelSandbox(sb, 'stage4-double-count-batch-2', 'stage4-double-count-event-2');
    const second = readJson(firstNumbersPath).games[0];
    const ledgerPath = path.join(sb.tmp, 'data/walters/nfl/2026/week-01-personnel-ledger.json');
    const ledger = readJson(ledgerPath);
    assert.equal(second.grahamExactFairHome, firstExact, 'Same caseKey under a new event must not stack the loss');
    assert.equal(second.personnelOverlayPointsToHomeSpread, firstOverlay, 'Personnel overlay must be recomputed, not accumulated');
    assert.equal(Object.keys(ledger.currentCases).length, 1, 'Only one active current case should exist for the stable caseKey');
    const personnelAdjustments = second.adjustments.filter(a => a.type === 'PERSONNEL_CALIBRATED_PRODUCTION');
    assert.equal(personnelAdjustments.length, 1, 'Live board must contain one recomputed personnel adjustment');
    assert.equal(personnelAdjustments[0].caseKeys.length, 1);

    const researchPath = path.join(sb.tmp, 'data/walters/nfl/2026/week-01-research-ledger.json');
    const beforeReplay = {
      numbers: fs.readFileSync(firstNumbersPath, 'utf8'),
      ledger: fs.readFileSync(ledgerPath, 'utf8'),
      research: fs.readFileSync(researchPath, 'utf8')
    };
    const replay = run('tools/apply-graham-personnel-staging.mjs', ['data/walters/nfl/personnel-staging.json'], { cwd: sb.tmp });
    assert.match(replay.combined, /IDEMPOTENT SKIP/);
    assert.equal(fs.readFileSync(firstNumbersPath, 'utf8'), beforeReplay.numbers);
    assert.equal(fs.readFileSync(ledgerPath, 'utf8'), beforeReplay.ledger);
    assert.equal(fs.readFileSync(researchPath, 'utf8'), beforeReplay.research);
  } finally {
    fs.rmSync(sb.tmp, { recursive: true, force: true });
  }
});

assert.equal(passed.length, 6);
console.log(`GRAHAM STAGE 4 REGRESSION: PASS // ${passed.length}/6 // ${passed.join(' + ')}`);

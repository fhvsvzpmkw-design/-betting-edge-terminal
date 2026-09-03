import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

import {
  buildSemanticInput,
  canonicalSha,
  deriveCurrent,
  localDateKey,
  mapRelevantRows,
  roundToHalf,
} from '../tools/run-walters-bw6-stage4.mjs';

const ROOT = process.cwd();
const CONTRACT_REL = 'data/walters/nfl/key-numbers/bw6-stage4-shadow-contract-v1.json';
const RUNNER_REL = 'tools/run-walters-bw6-stage4.mjs';
const VALIDATOR_REL = 'tools/validate-walters-bw6-stage4.mjs';
const CURRENT_REL = 'data/walters/nfl/key-numbers/bw6-stage4-current-v1.json';
const CONTRACT = readJson(ROOT, CONTRACT_REL);
const CONTRACT_SHA = hashFile(ROOT, CONTRACT_REL);

function readJson(root, relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
}

function hashFile(root, relative) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
}

function releaseManifest(root) {
  return Object.fromEntries(CONTRACT.releaseArtifacts.map((relative) => [relative, hashFile(root, relative)]));
}

function writeJson(root, relative, value) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function copyRelative(root, relative) {
  const source = path.join(ROOT, relative);
  if (!fs.existsSync(source)) return;
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.copyFileSync(source, destination);
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'walters-bw6-stage4-test-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const active = readJson(ROOT, CONTRACT.inputContract.activeWeekManifest);
  const token = String(active.week).padStart(2, '0');
  const dynamic = [
    `data/walters/nfl/${active.season}/week-${token}-current-numbers.json`,
    `data/walters/nfl/${active.season}/week-${token}-personnel-ledger.json`,
  ];
  const upstream = Object.values(CONTRACT.authorizedBy)
    .filter((value) => value && typeof value === 'object' && value.path)
    .map((value) => value.path);
  const paths = new Set([
    CONTRACT_REL,
    CONTRACT.inputContract.activeWeekManifest,
    ...upstream,
    ...CONTRACT.protectedArtifacts,
    ...CONTRACT.releaseArtifacts,
    ...dynamic,
  ]);
  for (const relative of paths) copyRelative(root, relative);
  const initial = deriveCurrent({
    root,
    contract: CONTRACT,
    contractSha256: CONTRACT_SHA,
    updatedAt: CONTRACT.generatedAt,
  });
  writeJson(root, CURRENT_REL, initial);
  return root;
}

function repositoryManifest(root) {
  const manifest = {};
  function visit(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) {
        const relative = path.relative(root, file).split(path.sep).join('/');
        manifest[relative] = hashFile(root, relative);
      }
    }
  }
  visit(root);
  return manifest;
}

function runCli(root, mode, options = {}) {
  const args = [path.join(ROOT, RUNNER_REL), mode, '--root', root];
  const names = {
    cycleId: '--cycle-id',
    startedAt: '--started-at',
    completedAt: '--completed-at',
    sourceCommit: '--source-commit',
    eventName: '--event-name',
    runId: '--run-id',
    runAttempt: '--run-attempt',
    failureCode: '--failure-code',
    failureMessage: '--failure-message',
    controlOut: '--control-out',
  };
  for (const [key, flag] of Object.entries(names)) {
    if (options[key] !== undefined) args.push(flag, String(options[key]));
  }
  return spawnSync(process.execPath, args, {cwd: ROOT, encoding: 'utf8'});
}

function control(run) {
  assert.equal(run.status, 0, run.stderr);
  const lines = run.stdout.trim().split('\n').filter(Boolean);
  return JSON.parse(lines.at(-1));
}

function cycleOptions(index, eventName, startedAt, runAttempt = 1, week = 1) {
  const runId = `test-${index}`;
  const trigger = eventName === 'schedule' && runAttempt === 1
    ? 'scheduled'
    : 'manual-equivalent';
  return {
    cycleId: `bw6-4-2026-w${String(week).padStart(2, '0')}-${localDateKey(startedAt)}-${trigger}-run-${runId}-attempt-${runAttempt}`,
    startedAt,
    completedAt: new Date(Date.parse(startedAt) + 60_000).toISOString(),
    sourceCommit: String(index).padStart(40, 'a').slice(-40),
    eventName,
    runId,
    runAttempt,
  };
}

function startAndComplete(root, options) {
  const start = control(runCli(root, 'start', options));
  assert.equal(start.action, 'COMPLETE_REQUIRED');
  const complete = control(runCli(root, 'complete', options));
  assert.equal(complete.action, 'PUBLISH_COMPLETION');
  return {
    start,
    complete,
    receipt: readJson(root, start.attemptPath),
    snapshot: readJson(root, complete.snapshotPath),
    result: readJson(root, complete.resultPath),
    current: readJson(root, complete.currentPath),
  };
}

function mutateFirstFair(root, exact) {
  const semantic = buildSemanticInput(root, CONTRACT);
  const numbers = readJson(root, semantic.currentNumbers.path);
  numbers.games[0].grahamExactFairHome = exact;
  numbers.games[0].grahamFairHome = roundToHalf(exact);
  writeJson(root, semantic.currentNumbers.path, numbers);
}

function moveFixtureToWeek(root, week) {
  const active = readJson(root, CONTRACT.inputContract.activeWeekManifest);
  const priorNumbersPath = `data/walters/nfl/${active.season}/week-${String(active.week).padStart(2, '0')}-current-numbers.json`;
  const numbers = readJson(root, priorNumbersPath);
  active.week = week;
  numbers.week = week;
  writeJson(root, CONTRACT.inputContract.activeWeekManifest, active);
  writeJson(
    root,
    `data/walters/nfl/${active.season}/week-${String(week).padStart(2, '0')}-current-numbers.json`,
    numbers,
  );
  return {season: active.season, week};
}

test('governed half-point rounding and row boundaries are exact', () => {
  assert.equal(roundToHalf(0.25), 0.5);
  assert.equal(roundToHalf(-0.25), 0);
  assert.equal(roundToHalf(-0.75), -0.5);
  assert.equal(Object.is(roundToHalf(-0.1), -0), false);

  assert.deepEqual(mapRelevantRows(-3, -3.032), {
    favoriteSide: 'HOME',
    favoriteOrientedDisplayMargin: 3,
    mappingStatus: 'SUPPORTED_ROWS_IDENTIFIED',
    relevantExactRows: [3],
    excludedBoundaries: [],
  });
  assert.deepEqual(mapRelevantRows(3.5, 3.328), {
    favoriteSide: 'AWAY',
    favoriteOrientedDisplayMargin: 3.5,
    mappingStatus: 'SUPPORTED_ROWS_IDENTIFIED',
    relevantExactRows: [3, 4],
    excludedBoundaries: [],
  });
  assert.deepEqual(mapRelevantRows(0, -0.112), {
    favoriteSide: 'PICK',
    favoriteOrientedDisplayMargin: 0,
    mappingStatus: 'FAIL_CLOSED_NO_SUPPORTED_ROW',
    relevantExactRows: [],
    excludedBoundaries: [{margin: 0, reason: 'CROSS_ZERO_OUT_OF_SCOPE'}],
  });
  assert.deepEqual(mapRelevantRows(-0.5, -0.49), {
    favoriteSide: 'HOME',
    favoriteOrientedDisplayMargin: 0.5,
    mappingStatus: 'SUPPORTED_ROWS_IDENTIFIED',
    relevantExactRows: [1],
    excludedBoundaries: [{margin: 0, reason: 'CROSS_ZERO_OUT_OF_SCOPE'}],
  });
  assert.deepEqual(mapRelevantRows(-18.5, -18.49), {
    favoriteSide: 'HOME',
    favoriteOrientedDisplayMargin: 18.5,
    mappingStatus: 'SUPPORTED_ROWS_IDENTIFIED',
    relevantExactRows: [18],
    excludedBoundaries: [{margin: 19, reason: 'UNSUPPORTED_EXACT_MARGIN'}],
  });
  assert.throws(() => mapRelevantRows(-3.5, -3.1), /GRAHAM_EXACT_DISPLAY_MISMATCH/);
  assert.throws(() => mapRelevantRows(-3.25, -3.25), /GRAHAM_DISPLAY_NOT_HALF_GRID/);
});

test('Pacific dates and canonical hashes are deterministic', () => {
  assert.equal(localDateKey('2026-09-04T06:59:59Z'), '2026-09-03');
  assert.equal(localDateKey('2026-09-04T07:00:00Z'), '2026-09-04');
  assert.equal(canonicalSha({b: 2, a: {d: 4, c: 3}}), canonicalSha({a: {c: 3, d: 4}, b: 2}));
});

test('workflow preserves the governed capture and publication boundary', () => {
  const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/walters-bw6-stage4.yml'), 'utf8');
  assert.match(workflow, /cron: '35 2 \* \* \*'/);
  assert.match(workflow, /capture-prospective-cycle:[\s\S]*needs: validate-release/);
  assert.match(
    workflow,
    /\(github\.event_name == 'schedule' \|\| github\.event_name == 'workflow_dispatch'\)[\s\S]*github\.ref == 'refs\/heads\/main'/,
  );
  assert.match(workflow, /--require-open-live-match/);
  assert.match(workflow, /PRIOR_ATTEMPT_INCOMPLETE_RECOVERY/);
  assert.match(workflow, /git merge-base --is-ancestor/);
  assert.doesNotMatch(workflow, /^\s*git (?:pull|rebase)\b/m);
  assert.equal((workflow.match(/node - <<'NODE' >> "\$GITHUB_OUTPUT"/g) ?? []).length, 3);
  const pushes = workflow.split('\n').filter((line) => /\bgit push\b/.test(line));
  assert.ok(pushes.length >= 3);
  for (const line of pushes) assert.match(line, /git push --no-force origin HEAD:refs\/heads\/main/);
});

test('validate-only is byte-read-only and start derives trigger authority', (t) => {
  const root = fixture(t);
  const before = repositoryManifest(root);
  const validation = control(runCli(root, 'validate-only'));
  assert.equal(validation.lifecycleState, 'VALIDATION_ONLY');
  assert.equal(validation.action, 'NO_REPOSITORY_WRITES');
  assert.deepEqual(repositoryManifest(root), before);

  const forbiddenControl = path.join(root, 'validation-control.json');
  const controlWrite = runCli(root, 'validate-only', {controlOut: forbiddenControl});
  assert.notEqual(controlWrite.status, 0);
  assert.match(controlWrite.stderr, /control.*root|validation.*write|read.only/i);
  assert.deepEqual(repositoryManifest(root), before);

  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'walters-bw6-stage4-control-'));
  t.after(() => fs.rmSync(outside, {recursive: true, force: true}));
  const linkedRoot = path.join(outside, 'linked-root');
  fs.symlinkSync(root, linkedRoot, 'dir');
  const symlinkWrite = runCli(root, 'validate-only', {
    controlOut: path.join(linkedRoot, 'symlink-control.json'),
  });
  assert.notEqual(symlinkWrite.status, 0);
  assert.match(symlinkWrite.stderr, /control.*root|validation.*write|read.only/i);
  assert.deepEqual(repositoryManifest(root), before);

  const manual = cycleOptions(1, 'workflow_dispatch', '2026-09-03T16:00:00Z');
  const manualControl = control(runCli(root, 'start', manual));
  const receipt = readJson(root, manualControl.attemptPath);
  assert.equal(receipt.trigger.triggerClass, 'MANUAL_EQUIVALENT');
  assert.equal(receipt.trigger.scheduledQualifying, false);
  assert.equal(receipt.pacificDate, '2026-09-03');
  assert.equal(receipt.sourceCommit, manual.sourceCommit);

  const forbiddenRoot = fixture(t);
  const push = runCli(
    forbiddenRoot,
    'start',
    cycleOptions(2, 'push', '2026-09-03T17:00:00Z'),
  );
  assert.notEqual(push.status, 0);
  assert.match(push.stderr, /START_TRIGGER_NOT_AUTHORIZED/);
});

test('a changed release artifact is rejected before another cycle can begin', (t) => {
  const root = fixture(t);
  const workflow = path.join(root, '.github/workflows/walters-bw6-stage4.yml');
  fs.appendFileSync(workflow, '\n# test-only release drift\n');
  const validation = runCli(root, 'validate-only');
  assert.notEqual(validation.status, 0);
  assert.match(validation.stderr, /RELEASE_ARTIFACT_MANIFEST_CHANGED/);
  const start = runCli(
    root,
    'start',
    cycleOptions(9, 'workflow_dispatch', '2026-09-03T18:00:00Z'),
  );
  assert.notEqual(start.status, 0);
  assert.match(start.stderr, /RELEASE_ARTIFACT_MANIFEST_CHANGED/);
});

test('market-bearing protected artifacts are hashed as opaque bytes and never parsed', (t) => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'data/live-odds.json'), '{not valid JSON');
  fs.writeFileSync(path.join(root, 'data/walters/nfl/current-week-terminal.json'), 'opaque terminal bytes');
  const validation = control(runCli(root, 'validate-only'));
  assert.equal(validation.action, 'NO_REPOSITORY_WRITES');
  assert.equal(validation.games, 16);
  const independent = spawnSync(process.execPath, [path.join(ROOT, VALIDATOR_REL), '--root', root], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(independent.status, 0, independent.stderr);
});

test('first-attempt schedules count while scheduled reruns are manual-equivalent', (t) => {
  const scheduledRoot = fixture(t);
  const scheduled = cycleOptions(1, 'schedule', '2026-09-03T16:00:00Z');
  const scheduledControl = control(runCli(scheduledRoot, 'start', scheduled));
  const scheduledReceipt = readJson(scheduledRoot, scheduledControl.attemptPath);
  assert.equal(scheduledReceipt.trigger.triggerClass, 'SCHEDULED');
  assert.equal(scheduledReceipt.trigger.scheduledQualifying, true);

  const rerunRoot = fixture(t);
  const rerun = cycleOptions(2, 'schedule', '2026-09-03T16:00:00Z', 2);
  const rerunControl = control(runCli(rerunRoot, 'start', rerun));
  const rerunReceipt = readJson(rerunRoot, rerunControl.attemptPath);
  assert.equal(rerunReceipt.trigger.triggerClass, 'MANUAL_EQUIVALENT');
  assert.equal(rerunReceipt.trigger.scheduledQualifying, false);
});

test('duplicate inputs and a second Pacific-date cycle do not inflate the streak', (t) => {
  const duplicateRoot = fixture(t);
  const first = cycleOptions(1, 'workflow_dispatch', '2026-09-03T16:00:00Z');
  startAndComplete(duplicateRoot, first);
  const duplicate = cycleOptions(2, 'workflow_dispatch', '2026-09-04T16:00:00Z');
  const duplicateControl = control(runCli(duplicateRoot, 'start', duplicate));
  assert.equal(duplicateControl.action, 'SKIP_TERMINAL');
  assert.equal(duplicateControl.lifecycleState, 'CLEAN_NONQUALIFYING_DUPLICATE');
  const duplicateCurrent = readJson(duplicateRoot, CURRENT_REL);
  assert.equal(duplicateCurrent.summary.qualifyingCleanCyclesSinceReset, 1);

  const sameDateRoot = fixture(t);
  startAndComplete(sameDateRoot, first);
  mutateFirstFair(sameDateRoot, -3.6);
  const sameDate = cycleOptions(3, 'schedule', '2026-09-03T22:00:00Z');
  const sameDateControl = control(runCli(sameDateRoot, 'start', sameDate));
  assert.equal(sameDateControl.action, 'SKIP_TERMINAL');
  assert.equal(sameDateControl.lifecycleState, 'CLEAN_NONQUALIFYING_SAME_DATE');
  const sameDateCurrent = readJson(sameDateRoot, CURRENT_REL);
  assert.equal(sameDateCurrent.summary.qualifyingCleanCyclesSinceReset, 1);
});

test('one manual plus two scheduled changed snapshots reaches only the BW6.4 gate', (t) => {
  const root = fixture(t);
  const first = startAndComplete(
    root,
    cycleOptions(1, 'workflow_dispatch', '2026-09-03T16:00:00Z'),
  );
  assert.equal(first.current.summary.qualifyingCleanCyclesSinceReset, 1);

  mutateFirstFair(root, -3.6);
  startAndComplete(root, cycleOptions(2, 'schedule', '2026-09-04T16:00:00Z'));
  mutateFirstFair(root, -3.7);
  const third = startAndComplete(
    root,
    cycleOptions(3, 'schedule', '2026-09-05T16:00:00Z'),
  );

  assert.equal(third.current.status, CONTRACT.cyclePlan.passState);
  assert.equal(third.current.acceptedWindow.accepted, true);
  assert.equal(third.current.acceptedWindow.scheduledCycles, 2);
  assert.equal(third.current.acceptedWindow.manualEquivalentCycles, 1);
  assert.equal(third.current.acceptedWindow.distinctSnapshotDigests, 3);
  assert.ok(third.current.acceptedWindow.changedInputTransitions >= 1);
  assert.deepEqual(third.current.blockedStages, ['BW7', 'BW8', 'PRODUCTION_AUTHORITY']);
  assert.equal(third.current.productionAuthority, false);
  assert.equal(third.result.productionAuthority, false);
  assert.equal(third.result.grahamFairMutationAllowed, false);
  assert.equal(third.result.betStatusMutationAllowed, false);
  assert.equal(third.result.stakeMutationAllowed, false);
  assert.equal(third.result.marketInputsUsed, false);
  assert.equal(third.result.outcomeInputsUsed, false);

  const validator = spawnSync(process.execPath, [path.join(ROOT, VALIDATOR_REL), '--root', root], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(validator.status, 0, validator.stderr);
});

test('three manual-equivalent cycles cannot satisfy the two-scheduled-cycle gate', (t) => {
  const root = fixture(t);
  startAndComplete(root, cycleOptions(1, 'workflow_dispatch', '2026-09-03T16:00:00Z'));
  mutateFirstFair(root, -3.6);
  startAndComplete(root, cycleOptions(2, 'workflow_dispatch', '2026-09-04T16:00:00Z'));
  mutateFirstFair(root, -3.7);
  const third = startAndComplete(
    root,
    cycleOptions(3, 'workflow_dispatch', '2026-09-05T16:00:00Z'),
  );
  assert.equal(third.current.acceptedWindow.scheduledCycles, 0);
  assert.equal(third.current.acceptedWindow.changedInputTransitions, 2);
  assert.equal(third.current.acceptedWindow.accepted, false);
  assert.equal(third.current.summary.acceptedWindowReady, false);
  assert.equal(third.current.status, CONTRACT.outcomeStates.clean);
});

test('open and failed attempts reset a prior clean streak', (t) => {
  const root = fixture(t);
  startAndComplete(root, cycleOptions(1, 'workflow_dispatch', '2026-09-03T16:00:00Z'));
  mutateFirstFair(root, -3.6);
  const second = cycleOptions(2, 'schedule', '2026-09-04T16:00:00Z');
  const started = control(runCli(root, 'start', second));
  assert.equal(started.action, 'COMPLETE_REQUIRED');
  let current = readJson(root, CURRENT_REL);
  assert.equal(current.activeAttempt.cycleId, second.cycleId);
  assert.equal(current.summary.qualifyingCleanCyclesSinceReset, 0);
  assert.equal(current.status, CONTRACT.outcomeStates.open);

  const failed = control(runCli(root, 'fail', {
    ...second,
    failureCode: 'TEST_FAILURE',
    failureMessage: 'intentional fail-closed regression',
  }));
  assert.equal(failed.lifecycleState, 'FAILED_RESET');
  current = readJson(root, CURRENT_REL);
  assert.equal(current.activeAttempt, null);
  assert.equal(current.cleanStreak.length, 0);
  assert.equal(current.status, CONTRACT.outcomeStates.failed);

  mutateFirstFair(root, -3.7);
  const recovery = cycleOptions(3, 'schedule', '2026-09-05T16:00:00Z');
  const reopened = control(runCli(root, 'start', recovery));
  assert.equal(reopened.action, 'COMPLETE_REQUIRED');
  assert.equal(reopened.lifecycleState, 'STARTED');
});

test('protected input mutation after START prevents a clean completion', (t) => {
  const root = fixture(t);
  const options = cycleOptions(1, 'workflow_dispatch', '2026-09-03T16:00:00Z');
  const started = control(runCli(root, 'start', options));
  assert.equal(started.action, 'COMPLETE_REQUIRED');
  fs.appendFileSync(path.join(root, 'data/live-odds.json'), '\nchanged after START\n');
  const completion = runCli(root, 'complete', options);
  assert.notEqual(completion.status, 0);
  assert.match(completion.stderr, /PROTECTED_ARTIFACT_MUTATION/);
  const current = readJson(root, CURRENT_REL);
  assert.equal(current.activeAttempt.cycleId, options.cycleId);
  assert.equal(current.summary.qualifyingCleanCyclesSinceReset, 0);
});

test('strict START readback rejects drift while ordinary validation preserves recovery liveness', (t) => {
  const root = fixture(t);
  const options = cycleOptions(1, 'workflow_dispatch', '2026-09-03T16:00:00Z');
  control(runCli(root, 'start', options));
  fs.appendFileSync(path.join(root, 'data/live-odds.json'), '\nmutated after durable START\n');
  const ordinary = spawnSync(process.execPath, [path.join(ROOT, VALIDATOR_REL), '--root', root], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(ordinary.status, 0, ordinary.stderr);
  assert.equal(readJson(root, CURRENT_REL).status, CONTRACT.outcomeStates.open);

  const strict = spawnSync(process.execPath, [
    path.join(ROOT, VALIDATOR_REL),
    '--root', root,
    '--require-open-live-match',
  ], {cwd: ROOT, encoding: 'utf8'});
  assert.notEqual(strict.status, 0);
  assert.match(strict.stderr, /protected|active attempt|input binding|live readback/i);
});

test('strict START readback is not applied to a terminal duplicate', (t) => {
  const root = fixture(t);
  startAndComplete(root, cycleOptions(1, 'workflow_dispatch', '2026-09-03T16:00:00Z'));
  const duplicate = control(runCli(
    root,
    'start',
    cycleOptions(2, 'workflow_dispatch', '2026-09-04T16:00:00Z'),
  ));
  assert.equal(duplicate.action, 'SKIP_TERMINAL');
  assert.equal(readJson(root, CURRENT_REL).activeAttempt, null);

  const ordinary = spawnSync(process.execPath, [path.join(ROOT, VALIDATOR_REL), '--root', root], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(ordinary.status, 0, ordinary.stderr);
  const strict = spawnSync(process.execPath, [
    path.join(ROOT, VALIDATOR_REL),
    '--root', root,
    '--require-open-live-match',
  ], {cwd: ROOT, encoding: 'utf8'});
  assert.notEqual(strict.status, 0);
  assert.match(strict.stderr, /requires an OPEN begun attempt/i);
});

test('an open START survives a release transition until explicit failure recovery', (t) => {
  const root = fixture(t);
  const first = cycleOptions(1, 'workflow_dispatch', '2026-09-03T16:00:00Z');
  const started = control(runCli(root, 'start', first));
  assert.equal(started.lifecycleState, 'STARTED');

  const workflow = path.join(root, '.github/workflows/walters-bw6-stage4.yml');
  fs.appendFileSync(workflow, '\n# governed test release epoch\n');
  const transitioned = deriveCurrent({
    root,
    contract: CONTRACT,
    contractSha256: CONTRACT_SHA,
    updatedAt: '2026-09-03T17:00:00Z',
    releaseArtifactSha256: releaseManifest(root),
  });
  writeJson(root, CURRENT_REL, transitioned);
  assert.equal(transitioned.activeAttempt.cycleId, first.cycleId);
  assert.equal(transitioned.status, CONTRACT.outcomeStates.open);

  const validator = spawnSync(process.execPath, [path.join(ROOT, VALIDATOR_REL), '--root', root], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(validator.status, 0, validator.stderr);

  const blocked = runCli(
    root,
    'start',
    cycleOptions(2, 'schedule', '2026-09-04T16:00:00Z'),
  );
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /PRIOR_ATTEMPT_INCOMPLETE/);

  const closed = control(runCli(root, 'fail', {
    ...first,
    completedAt: '2026-09-03T17:30:00Z',
    failureCode: 'PRIOR_ATTEMPT_INCOMPLETE_RECOVERY',
    failureMessage: 'explicit cross-release recovery',
  }));
  assert.equal(closed.lifecycleState, 'FAILED_RESET');
  assert.equal(readJson(root, CURRENT_REL).activeAttempt, null);

  const reopened = control(runCli(
    root,
    'start',
    cycleOptions(3, 'schedule', '2026-09-04T16:00:00Z'),
  ));
  assert.equal(reopened.lifecycleState, 'STARTED');
  assert.equal(reopened.action, 'COMPLETE_REQUIRED');
});

test('a governed release epoch resets current streak without rewriting historical week evidence', (t) => {
  const root = fixture(t);
  const completed = startAndComplete(
    root,
    cycleOptions(1, 'workflow_dispatch', '2026-09-03T16:00:00Z'),
  );
  const historicalWeekBytes = fs.readFileSync(path.join(root, completed.complete.weekResultPath));

  fs.appendFileSync(
    path.join(root, '.github/workflows/walters-bw6-stage4.yml'),
    '\n# governed test release epoch\n',
  );
  const transitioned = deriveCurrent({
    root,
    contract: CONTRACT,
    contractSha256: CONTRACT_SHA,
    updatedAt: '2026-09-03T18:00:00Z',
    releaseArtifactSha256: releaseManifest(root),
  });
  writeJson(root, CURRENT_REL, transitioned);

  assert.equal(transitioned.cleanStreak.length, 0);
  assert.equal(transitioned.acceptedWindow, null);
  assert.deepEqual(
    fs.readFileSync(path.join(root, completed.complete.weekResultPath)),
    historicalWeekBytes,
  );

  const validator = spawnSync(process.execPath, [path.join(ROOT, VALIDATOR_REL), '--root', root], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(validator.status, 0, validator.stderr);
});

test('later optional personnel creation does not rewrite historical protected-map shape', (t) => {
  const terminalRoot = fixture(t);
  const {season, week} = moveFixtureToWeek(terminalRoot, 2);
  startAndComplete(
    terminalRoot,
    cycleOptions(1, 'workflow_dispatch', '2026-09-03T16:00:00Z', 1, 2),
  );
  const personnelPath = `data/walters/nfl/${season}/week-${String(week).padStart(2, '0')}-personnel-ledger.json`;
  writeJson(terminalRoot, personnelPath, {schema: 1, season, week, state: 'CREATED_AFTER_CYCLE'});
  const historical = spawnSync(process.execPath, [
    path.join(ROOT, VALIDATOR_REL),
    '--root', terminalRoot,
  ], {cwd: ROOT, encoding: 'utf8'});
  assert.equal(historical.status, 0, historical.stderr);

  const openRoot = fixture(t);
  moveFixtureToWeek(openRoot, 2);
  const openOptions = cycleOptions(2, 'workflow_dispatch', '2026-09-03T16:00:00Z', 1, 2);
  control(runCli(openRoot, 'start', openOptions));
  writeJson(openRoot, personnelPath, {schema: 1, season, week, state: 'CREATED_DURING_CYCLE'});
  const ordinary = spawnSync(process.execPath, [path.join(ROOT, VALIDATOR_REL), '--root', openRoot], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(ordinary.status, 0, ordinary.stderr);
  const strict = spawnSync(process.execPath, [
    path.join(ROOT, VALIDATOR_REL),
    '--root', openRoot,
    '--require-open-live-match',
  ], {cwd: ROOT, encoding: 'utf8'});
  assert.notEqual(strict.status, 0);
  assert.match(strict.stderr, /protected|live readback/i);

  const failed = control(runCli(openRoot, 'fail', {
    ...openOptions,
    failureCode: 'DYNAMIC_PERSONNEL_APPEARED',
    failureMessage: 'optional personnel ledger appeared after START',
  }));
  const failure = readJson(openRoot, failed.resultPath);
  assert.equal(Object.hasOwn(failure.protectedArtifactSha256Before, personnelPath), false);
  assert.equal(failure.protectedArtifactSha256After[personnelPath], hashFile(openRoot, personnelPath));
  assert.equal(failure.protectedArtifactsUnchanged, false);
  const recovered = spawnSync(process.execPath, [path.join(ROOT, VALIDATOR_REL), '--root', openRoot], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(recovered.status, 0, recovered.stderr);
});

test('a release epoch cannot conceal a second START after an incomplete begun attempt', (t) => {
  const root = fixture(t);
  const first = cycleOptions(1, 'workflow_dispatch', '2026-09-03T16:00:00Z');
  const firstControl = control(runCli(root, 'start', first));
  const firstReceipt = readJson(root, firstControl.attemptPath);

  fs.appendFileSync(
    path.join(root, '.github/workflows/walters-bw6-stage4.yml'),
    '\n# governed test release epoch\n',
  );
  const transitioned = deriveCurrent({
    root,
    contract: CONTRACT,
    contractSha256: CONTRACT_SHA,
    updatedAt: '2026-09-03T17:00:00Z',
    releaseArtifactSha256: releaseManifest(root),
  });
  writeJson(root, CURRENT_REL, transitioned);

  const second = cycleOptions(2, 'schedule', '2026-09-04T16:00:00Z');
  const forged = structuredClone(firstReceipt);
  Object.assign(forged, {
    cycleId: second.cycleId,
    startedAt: second.startedAt,
    pacificDate: localDateKey(second.startedAt),
    trigger: {
      eventName: second.eventName,
      triggerClass: 'SCHEDULED',
      runId: second.runId,
      runAttempt: second.runAttempt,
      scheduledQualifying: true,
    },
    sourceCommit: second.sourceCommit,
    releaseArtifactSha256: releaseManifest(root),
    priorCleanStreakCycleIds: [],
  });
  forged.contentSha256Canonical = canonicalSha(forged);
  writeJson(
    root,
    CONTRACT.outputs.attemptPattern.replace('{cycleId}', second.cycleId),
    forged,
  );

  const validator = spawnSync(process.execPath, [path.join(ROOT, VALIDATOR_REL), '--root', root], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.notEqual(validator.status, 0);
  assert.match(validator.stderr, /prior begun attempt remains incomplete/i);
});

test('terminal attempts cannot be closed twice and rejected transitions are byte-write-free', (t) => {
  const failedRoot = fixture(t);
  const options = cycleOptions(1, 'workflow_dispatch', '2026-09-03T16:00:00Z');
  control(runCli(failedRoot, 'start', options));
  control(runCli(failedRoot, 'fail', {
    ...options,
    failureCode: 'TEST_FAILURE',
    failureMessage: 'terminal transition regression',
  }));
  const failedBefore = repositoryManifest(failedRoot);
  const completeAfterFail = runCli(failedRoot, 'complete', options);
  assert.notEqual(completeAfterFail.status, 0);
  assert.match(completeAfterFail.stderr, /terminal|already|not completable/i);
  assert.deepEqual(repositoryManifest(failedRoot), failedBefore);

  const cleanRoot = fixture(t);
  startAndComplete(cleanRoot, options);
  const cleanBefore = repositoryManifest(cleanRoot);
  const failAfterComplete = runCli(cleanRoot, 'fail', {
    ...options,
    failureCode: 'TEST_FAILURE',
    failureMessage: 'terminal transition regression',
  });
  assert.notEqual(failAfterComplete.status, 0);
  assert.match(failAfterComplete.stderr, /terminal|already|not fail-closable/i);
  assert.deepEqual(repositoryManifest(cleanRoot), cleanBefore);
});

test('independent validation rejects a snapshot attached to a failed attempt', (t) => {
  const options = cycleOptions(1, 'workflow_dispatch', '2026-09-03T16:00:00Z');
  const cleanRoot = fixture(t);
  const clean = startAndComplete(cleanRoot, options);
  const snapshotBytes = fs.readFileSync(path.join(cleanRoot, clean.complete.snapshotPath));

  const failedRoot = fixture(t);
  control(runCli(failedRoot, 'start', options));
  control(runCli(failedRoot, 'fail', {
    ...options,
    failureCode: 'TEST_FAILURE',
    failureMessage: 'failed-attempt snapshot regression',
  }));
  const snapshotPath = CONTRACT.outputs.snapshotPattern.replace('{cycleId}', options.cycleId);
  fs.mkdirSync(path.dirname(path.join(failedRoot, snapshotPath)), {recursive: true});
  fs.writeFileSync(path.join(failedRoot, snapshotPath), snapshotBytes);

  const validator = spawnSync(process.execPath, [path.join(ROOT, VALIDATOR_REL), '--root', failedRoot], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.notEqual(validator.status, 0);
  assert.match(validator.stderr, /failed.*snapshot|snapshot.*failed|failed result.*snapshot/i);
});

test('shadow artifacts contain only whitelisted game and row fields', (t) => {
  const root = fixture(t);
  const {snapshot, result} = startAndComplete(
    root,
    cycleOptions(1, 'workflow_dispatch', '2026-09-03T16:00:00Z'),
  );
  assert.deepEqual(
    Object.keys(snapshot.activeWeek.semantic).sort(),
    [...CONTRACT.inputContract.semanticFieldWhitelist.activeWeek].sort(),
  );
  assert.deepEqual(
    Object.keys(snapshot.currentNumbers.semantic).sort(),
    ['games', ...CONTRACT.inputContract.semanticFieldWhitelist.currentNumbers].sort(),
  );
  for (const game of snapshot.currentNumbers.semantic.games) {
    assert.deepEqual(
      Object.keys(game).sort(),
      [...CONTRACT.inputContract.semanticFieldWhitelist.game].sort(),
    );
  }
  for (const game of result.games) {
    assert.deepEqual(Object.keys(game).sort(), [...CONTRACT.allowedOutput.gameFields].sort());
  }
  for (const row of result.rowComparisons) {
    assert.deepEqual(Object.keys(row).sort(), [...CONTRACT.allowedOutput.rowFields].sort());
  }
  const forbiddenKeys = new Set([
    'pinnacle', 'sportsbook', 'bookmaker', 'marketPrice', 'marketEdge', 'weightedAdvantage',
    'crossZeroDeduction', 'starRating', 'playThreshold', 'recommendation', 'recommendedSide',
    'stake', 'bankroll', 'score', 'resultScore',
  ]);
  function inspect(value) {
    if (Array.isArray(value)) return value.forEach(inspect);
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.equal(forbiddenKeys.has(key), false, `forbidden output key ${key}`);
      inspect(child);
    }
  }
  inspect(snapshot);
  inspect(result);
});

test('identical inputs and provenance produce byte-identical immutable evidence', (t) => {
  const leftRoot = fixture(t);
  const rightRoot = fixture(t);
  const options = cycleOptions(1, 'workflow_dispatch', '2026-09-03T16:00:00Z');
  const left = startAndComplete(leftRoot, options);
  const right = startAndComplete(rightRoot, options);
  assert.equal(hashFile(leftRoot, left.start.attemptPath), hashFile(rightRoot, right.start.attemptPath));
  assert.equal(hashFile(leftRoot, left.complete.snapshotPath), hashFile(rightRoot, right.complete.snapshotPath));
  assert.equal(hashFile(leftRoot, left.complete.resultPath), hashFile(rightRoot, right.complete.resultPath));
  assert.equal(left.receipt.contentSha256Canonical, canonicalSha(left.receipt));
  assert.equal(left.snapshot.contentSha256Canonical, canonicalSha(left.snapshot));
  assert.equal(left.result.contentSha256Canonical, canonicalSha(left.result));

  const derived = deriveCurrent({
    root: leftRoot,
    contract: CONTRACT,
    contractSha256: CONTRACT_SHA,
    updatedAt: options.completedAt,
  });
  assert.equal(derived.contentSha256Canonical, canonicalSha(derived));
  assert.deepEqual(derived.attempts, left.current.attempts);
});

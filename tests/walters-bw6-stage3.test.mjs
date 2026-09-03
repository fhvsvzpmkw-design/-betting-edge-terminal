import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const ROOT = process.cwd();
const CONTRACT_PATH = 'data/walters/nfl/key-numbers/bw6-stage1-contract-v1.json';
const LOCK_PATH = 'data/walters/nfl/key-numbers/bw6-stage2-model-lock-v1.json';
const AUDIT_PATH = 'data/walters/nfl/key-numbers/bw6-stage3-holdout-audit-v1.json';
const contract = readJson(CONTRACT_PATH);
const lock = readJson(LOCK_PATH);
const audit = readJson(AUDIT_PATH);

function readJson(relative) {
  return JSON.parse(fs.readFileSync(`${ROOT}/${relative}`, 'utf8'));
}

function hash(relative) {
  return crypto.createHash('sha256').update(fs.readFileSync(`${ROOT}/${relative}`)).digest('hex');
}

test('BW6.3 deterministic helper self-tests pass', () => {
  const run = spawnSync('python', ['tools/build-walters-bw6-stage3.py', '--self-test'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /WALTERS BW6 STAGE 3 SELF-TEST: PASS/);
});

test('BW6.3 deterministically returns the governed fail-closed code and preserves inputs', () => {
  const auditBefore = hash(AUDIT_PATH);
  const lockBefore = hash(LOCK_PATH);
  const protectedBefore = Object.fromEntries(
    contract.protectedArtifacts.map((relative) => [relative, hash(relative)]),
  );
  const run = spawnSync('python', ['tools/build-walters-bw6-stage3.py'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const protectedAfter = Object.fromEntries(
    contract.protectedArtifacts.map((relative) => [relative, hash(relative)]),
  );

  assert.equal(run.status, 2, run.stderr);
  assert.match(run.stdout, /FAIL CLOSED \/\/ 9\/10 CHECKS/);
  assert.equal(hash(AUDIT_PATH), auditBefore);
  assert.equal(hash(LOCK_PATH), lockBefore);
  assert.deepEqual(protectedAfter, protectedBefore);
});

test('BW6.3 validator confirms the fail-closed evidence', () => {
  const run = spawnSync(process.execPath, ['tools/validate-walters-bw6-stage3.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /HOLDOUT CORRECTLY FAIL-CLOSED 9\/10/);
  assert.match(run.stdout, /NO STAGE 4 AUTHORITY/);
});

test('the holdout used the frozen model once and did not reselect it', () => {
  assert.equal(audit.selectedModelId, lock.selectedModel.modelId);
  assert.deepEqual(
    audit.distributions.selectedCalibrated,
    lock.selectedModel.frozenCategoryProbabilities,
  );
  assert.equal(audit.modelReselectionAllowed, false);
  assert.equal(audit.modelReselected, false);
  assert.equal(audit.holdoutViewed, true);
  assert.equal(audit.holdoutOutcomeFieldsRead, true);
  assert.equal(audit.marketViewed, false);
});

test('the current calibration beats BOOK-EXACT but misses the locked aggregate ceiling', () => {
  assert.ok(audit.metrics.selectedMinusBook.multiclassLogLoss < 0);
  assert.ok(audit.metrics.selectedMinusBook.multiclassBrierScore < 0);
  assert.equal(
    audit.metrics.aggregateOneThroughEighteen.selectedAbsoluteErrorPercentagePoints,
    3.43127,
  );
  assert.ok(
    audit.metrics.aggregateOneThroughEighteen.selectedAbsoluteErrorPercentagePoints >
      contract.holdoutAcceptance.numericThresholds
        .maximumAggregateOneThroughEighteenCalibrationErrorPercentagePoints,
  );
  assert.equal(
    audit.metrics.aggregateOneThroughEighteen.samplingDiagnostic
      .selectedPredictionInsideHoldoutWilson95,
    true,
  );
  assert.equal(
    audit.metrics.aggregateOneThroughEighteen.samplingDiagnostic.diagnosticOnlyNoGateOverride,
    true,
  );
});

test('only the aggregate calibration check fails and Stage 4 remains blocked', () => {
  assert.deepEqual(audit.summary, {
    checks: 10,
    passed: 9,
    failed: 1,
    holdoutPass: false,
  });
  assert.deepEqual(
    audit.acceptanceChecks.filter((check) => !check.pass).map((check) => check.id),
    ['BW6H-AGGREGATE-CALIBRATION'],
  );
  assert.equal(audit.status, contract.holdoutAcceptance.failState);
  assert.equal(audit.nextStage, null);
  assert.equal(audit.productionAuthority, false);
  assert.equal(audit.liveBoardMutationAllowed, false);
});

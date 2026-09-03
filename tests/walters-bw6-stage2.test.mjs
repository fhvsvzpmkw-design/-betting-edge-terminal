import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import test from 'node:test';

const ROOT = process.cwd();
const CONTRACT_PATH = 'data/walters/nfl/key-numbers/bw6-stage1-contract-v1.json';
const LOCK_PATH = 'data/walters/nfl/key-numbers/bw6-stage2-model-lock-v1.json';
const CALIBRATION_PATH = 'data/walters/nfl/key-numbers/bw6-stage2-calibration-v1.json';
const contract = readJson(CONTRACT_PATH);
const lock = readJson(LOCK_PATH);
const calibration = readJson(CALIBRATION_PATH);

function readJson(relative) {
  return JSON.parse(fs.readFileSync(`${ROOT}/${relative}`, 'utf8'));
}

function hash(relative) {
  return crypto.createHash('sha256').update(fs.readFileSync(`${ROOT}/${relative}`)).digest('hex');
}

test('BW6.2 deterministic helper self-tests pass', () => {
  const output = execFileSync('python', ['tools/build-walters-bw6-stage2.py', '--self-test'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.match(output, /WALTERS BW6 STAGE 2 SELF-TEST: PASS/);
});

test('BW6.2 rebuild is deterministic and preserves governed production', () => {
  const outputBefore = {
    lock: hash(LOCK_PATH),
    calibration: hash(CALIBRATION_PATH),
  };
  const protectedBefore = Object.fromEntries(
    contract.protectedArtifacts.map((relative) => [relative, hash(relative)]),
  );
  const output = execFileSync('python', ['tools/build-walters-bw6-stage2.py'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const outputAfter = {
    lock: hash(LOCK_PATH),
    calibration: hash(CALIBRATION_PATH),
  };
  const protectedAfter = Object.fromEntries(
    contract.protectedArtifacts.map((relative) => [relative, hash(relative)]),
  );

  assert.match(output, /2025 HOLDOUT UNOPENED/);
  assert.deepEqual(outputAfter, outputBefore);
  assert.deepEqual(protectedAfter, protectedBefore);
});

test('BW6.2 validator accepts the frozen model and calibration', () => {
  const output = execFileSync(process.execPath, ['tools/validate-walters-bw6-stage2.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.match(output, /WALTERS BW6 STAGE 2 VERIFY: PASS/);
});

test('the internal selector uses only development folds and applies the locked tie break', () => {
  assert.equal(lock.selectedModel.modelId, 'BW6_FULL_DEVELOPMENT_POOL');
  assert.deepEqual(lock.candidateSelection.selectionAudit.logLossTieModelIds, [
    'BW6_FULL_DEVELOPMENT_POOL',
    'BW6_ROLLING_FOUR_ELIGIBLE_SEASONS',
  ]);
  assert.equal(
    lock.candidateSelection.selectionAudit.selectedModelId,
    'BW6_FULL_DEVELOPMENT_POOL',
  );
  for (const candidate of lock.candidateSelection.candidates) {
    for (const fold of candidate.folds) {
      assert.equal(fold.trainingSeasons.includes(2025), false);
      assert.equal(fold.validationSeason === 2025, false);
    }
  }
});

test('2025 and market data remain unopened in every Stage 2 artifact', () => {
  for (const artifact of [lock, calibration]) {
    assert.equal(artifact.holdoutViewed, false);
    assert.equal(artifact.holdoutOutcomeFieldsRead, false);
    assert.equal(artifact.marketViewed, false);
    assert.equal(artifact.productionAuthority, false);
  }
  assert.equal(lock.sourceAudit.holdoutScoreFieldsRead, false);
  assert.equal(lock.sourceAudit.skippedRowsByReason['2025_REG'], 272);
  assert.equal(lock.orientationAudit.marketInputsUsed, false);
});

test('all 18 current rows pass sample and era-stability gates without overwriting the book', () => {
  assert.deepEqual(calibration.supportSummary, {
    CURRENT_SUPPORTED: 18,
    SHADOW_ONLY_UNSTABLE: 0,
    SHADOW_ONLY_INSUFFICIENT_SAMPLE: 0,
  });
  assert.equal(calibration.marginRows.length, 18);
  for (const row of calibration.marginRows) {
    const key = String(row.margin);
    assert.equal(
      row.bookExact.pointWeightPercentPublishedRounded,
      contract.bookExactBaseline.pointWeightsPercentPublishedRounded[key],
    );
    assert.equal(row.currentCalibration.supportStatus, 'CURRENT_SUPPORTED');
    assert.equal(row.currentCalibration.stability.pass, true);
    assert.equal(row.currentCalibration.samplePass, true);
    assert.equal(row.currentCalibration.intervalPass, true);
  }
  const byMargin = new Map(calibration.marginRows.map((row) => [row.margin, row]));
  assert.ok(
    byMargin.get(3).currentCalibration.pointWeightPercent >
      byMargin.get(7).currentCalibration.pointWeightPercent,
  );
  assert.ok(
    byMargin.get(7).currentCalibration.pointWeightPercent >
      byMargin.get(6).currentCalibration.pointWeightPercent,
  );
});

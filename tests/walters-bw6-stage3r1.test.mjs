import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const ROOT = process.cwd();
const CONTRACT_PATH =
  'data/walters/nfl/key-numbers/bw6-stage3r1-diagnosis-contract-v1.json';
const DIAGNOSIS_PATH =
  'data/walters/nfl/key-numbers/bw6-stage3r1-recalibration-diagnosis-v1.json';
const contract = readJson(CONTRACT_PATH);
const diagnosis = readJson(DIAGNOSIS_PATH);

function readJson(relative) {
  return JSON.parse(fs.readFileSync(`${ROOT}/${relative}`, 'utf8'));
}

function hash(relative) {
  return crypto.createHash('sha256').update(fs.readFileSync(`${ROOT}/${relative}`)).digest('hex');
}

test('BW6.3R1 deterministic helper tests pass', () => {
  const run = spawnSync('python', ['tools/build-walters-bw6-stage3r1.py', '--self-test'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /WALTERS BW6 STAGE 3R1 SELF-TEST: PASS/);
});

test('BW6.3R1 diagnosis rebuild is deterministic and preserves governed inputs', () => {
  const diagnosisBefore = hash(DIAGNOSIS_PATH);
  const immutable = [
    ...new Set([
      ...contract.frozenInputs.map((item) => item.path),
      ...contract.priorBw6Artifacts,
      ...contract.protectedArtifacts,
    ]),
  ];
  const before = Object.fromEntries(immutable.map((relative) => [relative, hash(relative)]));
  const run = spawnSync('python', ['tools/build-walters-bw6-stage3r1.py'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const after = Object.fromEntries(immutable.map((relative) => [relative, hash(relative)]));

  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /ORIGINAL 9\/10 PRESERVED/);
  assert.match(run.stdout, /NO RETROACTIVE REFIT/);
  assert.equal(hash(DIAGNOSIS_PATH), diagnosisBefore);
  assert.deepEqual(after, before);
});

test('BW6.3R1 validator accepts the diagnosis and blocked handoff', () => {
  const run = spawnSync(process.execPath, ['tools/validate-walters-bw6-stage3r1.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /SAMPLING VARIATION PLAUSIBLE/);
  assert.match(run.stdout, /BW6\.4 BLOCKED/);
});

test('the original fail-closed decision remains immutable', () => {
  assert.deepEqual(diagnosis.originalDecision, {
    status: 'BW6_3_FAIL_CLOSED_RECALIBRATION_REVIEW_REQUIRED',
    summary: {checks: 10, passed: 9, failed: 1, holdoutPass: false},
    failedChecks: ['BW6H-AGGREGATE-CALIBRATION'],
    preserved: true,
  });
  assert.equal(diagnosis.lockedGateDiagnosis.originalGateWaived, false);
  assert.equal(diagnosis.stage3DispositionOverridden, false);
});

test('2025 remains diagnostic-only and cannot select or fit a replacement', () => {
  assert.equal(contract.exposedHoldoutBoundary.state, 'EXPOSED_DIAGNOSTIC_ONLY');
  assert.equal(contract.exposedHoldoutBoundary.modelFitAllowed, false);
  assert.equal(contract.exposedHoldoutBoundary.modelSelectionAllowed, false);
  assert.equal(contract.exposedHoldoutBoundary.holdoutReuseForAcceptanceAllowed, false);
  assert.equal(diagnosis.modelFitUsed2025, false);
  assert.equal(diagnosis.modelSelectionUsed2025, false);
  assert.equal(diagnosis.diagnosticConclusion.replacementModelSelected, false);
});

test('the diagnosis identifies gate fragility without treating it as a waiver', () => {
  assert.equal(diagnosis.lockedGateDiagnosis.observedEvents, 120);
  assert.equal(diagnosis.lockedGateDiagnosis.minimumAdditionalExactMarginEventsToPass, 2);
  assert.ok(diagnosis.samplingCompatibility.exactTwoSidedBinomialPValue > 0.05);
  assert.ok(
    diagnosis.samplingCompatibility.probabilityAbsoluteErrorExceedsLockedGateUnderFrozenModel >
      0.3,
  );
  assert.equal(diagnosis.samplingCompatibility.diagnosticOnlyNoGateOverride, true);
  assert.equal(
    diagnosis.diagnosticConclusion.approximateGamesRequiredForThreePoint95PercentNormalHalfWidth,
    1065,
  );
});

test('the shortfall is localized to more 19-plus wins, not weaker favorite orientation', () => {
  const decomposition = diagnosis.developmentEvidence.outcomeDecomposition;
  assert.ok(decomposition.holdout.favoriteWinPercent > decomposition.development.favoriteWinPercent);
  assert.ok(
    decomposition.holdout.percents.FAVORITE_WIN_19_PLUS >
      decomposition.development.percents.FAVORITE_WIN_19_PLUS,
  );
  assert.ok(decomposition.threeCategoryHomogeneity.pValue > 0.05);
  assert.ok(decomposition.oneToEighteenVersusNineteenPlusAmongFavoriteWins.pValue > 0.05);
  assert.equal(
    decomposition.diagnosticCause,
    'FAVORITE_WIN_RATE_STABLE_MORE_WINS_ABOVE_18_MONITOR_NOT_PROVEN',
  );
});

test('all downstream stages and production mutations remain blocked', () => {
  assert.deepEqual(diagnosis.blockedStages, ['BW6.4', 'BW7', 'BW8']);
  assert.equal(diagnosis.nextStage, 'BW6.3R2_DEVELOPMENT_ONLY_RECALIBRATION_CONTRACT');
  for (const field of [
    'operational',
    'productionAuthority',
    'grahamFairMutationAllowed',
    'liveBoardMutationAllowed',
    'betStatusMutationAllowed',
    'stakeMutationAllowed',
    'marketViewed',
  ]) {
    assert.equal(diagnosis[field], false, field);
  }
});

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import test from 'node:test';

const ROOT = process.cwd();
const CONTRACT_PATH = `${ROOT}/data/walters/nfl/key-numbers/bw6-stage1-contract-v1.json`;
const contract = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(`${ROOT}/${file}`)).digest('hex');
}

function fairCosts(p) {
  const q = 110 / 210;
  return {
    buyOntoLossToPush: (100 * q) / (1 - q - p) - 110,
    buyOffPushToWin: (100 * (q * (1 - p) + p)) / ((1 - q) * (1 - p)) - 110,
  };
}

test('BW6 Stage 1 validator passes without mutating protected artifacts', () => {
  const before = Object.fromEntries(contract.protectedArtifacts.map((file) => [file, hash(file)]));
  const output = execFileSync(process.execPath, ['tools/validate-walters-bw6-stage1.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const after = Object.fromEntries(contract.protectedArtifacts.map((file) => [file, hash(file)]));

  assert.match(output, /WALTERS BW6 STAGE 1 VERIFY: PASS/);
  assert.deepEqual(after, before);
});

test('BW6 owns only point weights and half-point costs', () => {
  assert.deepEqual(contract.scope.ownedRules, ['BW-R021', 'BW-R022', 'BW-R023']);
  assert.deepEqual(contract.scope.notOwned.BW7.ruleIds, ['BW-R024', 'BW-R025', 'BW-R026']);
  assert.deepEqual(contract.scope.notOwned.BW8.ruleIds, ['BW-R027', 'BW-R028']);
  assert.equal(contract.productionAuthority, false);
  assert.equal(contract.grahamFairMutationAllowed, false);
  assert.equal(contract.betStatusMutationAllowed, false);
  assert.equal(contract.stakeMutationAllowed, false);
});

test('BOOK-EXACT point values remain complete and source-rounded', () => {
  assert.deepEqual(contract.bookExactBaseline.pointWeightsPercentPublishedRounded, {
    1: 3,
    2: 3,
    3: 8,
    4: 3,
    5: 3,
    6: 5,
    7: 6,
    8: 3,
    9: 2,
    10: 4,
    11: 2,
    12: 2,
    13: 2,
    14: 5,
    15: 2,
    16: 3,
    17: 3,
    18: 3,
  });
  assert.equal(
    Object.values(contract.bookExactBaseline.pointWeightsPercentPublishedRounded).reduce(
      (sum, value) => sum + value,
      0,
    ),
    62,
  );
  assert.deepEqual(contract.sourceAuthority.sourceBoundary.unsupportedBookHalfPointMargins, [21, 24]);
});

test('transparent current half-point cost math distinguishes onto and off a push', () => {
  const zero = fairCosts(0);
  assert.ok(Math.abs(zero.buyOntoLossToPush) < 1e-12);
  assert.ok(Math.abs(zero.buyOffPushToWin) < 1e-12);
  const atThreeBookWeight = fairCosts(0.08);
  assert.ok(Math.abs(atThreeBookWeight.buyOntoLossToPush - 22.21153846153848) < 1e-12);
  assert.ok(Math.abs(atThreeBookWeight.buyOffPushToWin - 18.260869565217376) < 1e-12);
  assert.ok(atThreeBookWeight.buyOntoLossToPush > atThreeBookWeight.buyOffPushToWin);
});

test('2025 is a disjoint holdout and cannot select the model', () => {
  const development = new Set(contract.historicalDataContract.developmentWindow.seasons);
  const holdout = contract.historicalDataContract.holdoutWindow.seasons;
  assert.deepEqual(holdout, [2025]);
  assert.equal(holdout.some((season) => development.has(season)), false);
  assert.equal(contract.holdoutAcceptance.modelSelectionMayUse2025, false);
  for (const fold of contract.calibrationLock.internalSelectionFolds) {
    assert.equal(
      fold.eligibleTrainingSeasons.some((season) => season >= fold.validationSeason),
      false,
    );
  }
});

test('the pinned historical snapshot exposes no sportsbook field', () => {
  const sourcePath = `${ROOT}/${contract.historicalDataContract.sourceSnapshot.path}`;
  const header = fs.readFileSync(sourcePath, 'utf8').split(/\r?\n/, 1)[0].split(',');
  assert.deepEqual(header, contract.historicalDataContract.fieldWhitelist);
  for (const field of contract.historicalDataContract.forbiddenFields) {
    assert.equal(header.includes(field), false, `forbidden field ${field}`);
  }
  assert.deepEqual(contract.historicalDataContract.teamIdentityAliases, {
    OAK: 'LV',
    SD: 'LAC',
    STL: 'LAR',
    LA: 'LAR',
  });
});

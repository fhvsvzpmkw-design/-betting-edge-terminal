#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CONTRACT_PATH = path.join(
  ROOT,
  'data/walters/nfl/key-numbers/bw6-stage3r1-diagnosis-contract-v1.json',
);
const OUTPUT_PATH = path.join(
  ROOT,
  'data/walters/nfl/key-numbers/bw6-stage3r1-recalibration-diagnosis-v1.json',
);
const BUILDER_PATH = path.join(ROOT, 'tools/build-walters-bw6-stage3r1.py');
const EPSILON = 1e-8;

function fail(message) {
  throw new Error(`WALTERS BW6 STAGE 3R1 VERIFY FAILED // ${message}`);
}

function ok(condition, message) {
  if (!condition) fail(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function same(actual, expected, message) {
  ok(JSON.stringify(actual) === JSON.stringify(expected), message);
}

function approximate(actual, expected, tolerance, message) {
  ok(Number.isFinite(Number(actual)), `${message}: not finite`);
  ok(
    Math.abs(Number(actual) - Number(expected)) <= tolerance,
    `${message}: expected ${expected}, got ${actual}`,
  );
}

function binomialProbabilities(games, probability) {
  const probabilities = Array(games + 1).fill(0);
  probabilities[0] = (1 - probability) ** games;
  for (let events = 0; events < games; events += 1) {
    probabilities[events + 1] =
      probabilities[events] *
      ((games - events) / (events + 1)) *
      (probability / (1 - probability));
  }
  return probabilities;
}

function outcomePartition(favoriteSide, homeMargin) {
  const result = {
    FAVORITE_WIN_1_TO_18: 0,
    FAVORITE_WIN_19_PLUS: 0,
    FAVORITE_LOSS_OR_TIE: 0,
  };
  if (favoriteSide === 'SPLIT') {
    if (homeMargin === 0) result.FAVORITE_LOSS_OR_TIE = 1;
    else if (Math.abs(homeMargin) <= 18) {
      result.FAVORITE_WIN_1_TO_18 = 0.5;
      result.FAVORITE_LOSS_OR_TIE = 0.5;
    } else {
      result.FAVORITE_WIN_19_PLUS = 0.5;
      result.FAVORITE_LOSS_OR_TIE = 0.5;
    }
    return result;
  }
  const favoriteMargin = favoriteSide === 'HOME' ? homeMargin : -homeMargin;
  if (favoriteMargin >= 1 && favoriteMargin <= 18) result.FAVORITE_WIN_1_TO_18 = 1;
  else if (favoriteMargin >= 19) result.FAVORITE_WIN_19_PLUS = 1;
  else result.FAVORITE_LOSS_OR_TIE = 1;
  return result;
}

for (const file of [CONTRACT_PATH, OUTPUT_PATH, BUILDER_PATH]) {
  ok(fs.existsSync(file), `missing ${path.relative(ROOT, file)}`);
}
const contract = readJson(CONTRACT_PATH);
const diagnosis = readJson(OUTPUT_PATH);

ok(
  contract.schemaVersion === 'walters-bw6-stage3r1-diagnosis-contract-v1',
  'contract schema',
);
ok(contract.stage === 'BW6.3R1', 'contract stage');
ok(
  contract.status === 'BW6_3R1_DIAGNOSTIC_CONTRACT_LOCKED_NON_OPERATIONAL',
  'contract status',
);
ok(contract.authoredAfterHoldoutViewed === true, 'post-holdout authorship disclosure');
for (const field of [
  'operational',
  'productionAuthority',
  'grahamFairMutationAllowed',
  'liveBoardMutationAllowed',
  'betStatusMutationAllowed',
  'stakeMutationAllowed',
  'marketInputsAllowed',
]) {
  ok(contract[field] === false, `contract ${field}`);
}
const exposed = contract.exposedHoldoutBoundary;
ok(exposed.season === 2025 && exposed.games === 272, 'exposed holdout identity');
ok(exposed.state === 'EXPOSED_DIAGNOSTIC_ONLY', 'exposed holdout state');
ok(exposed.diagnosticArithmeticAllowed === true, 'diagnostic arithmetic authority');
for (const field of [
  'modelFitAllowed',
  'modelSelectionAllowed',
  'thresholdChangeAllowed',
  'holdoutReuseForAcceptanceAllowed',
  'stage3DispositionOverrideAllowed',
]) {
  ok(exposed[field] === false, `exposed holdout ${field}`);
}

for (const item of contract.frozenInputs) {
  const file = path.join(ROOT, item.path);
  ok(fs.existsSync(file), `missing frozen input ${item.role}`);
  ok(hashFile(file) === item.sha256, `frozen input hash ${item.role}`);
}
const frozenByRole = Object.fromEntries(contract.frozenInputs.map((item) => [item.role, item]));
const stage3 = readJson(path.join(ROOT, frozenByRole.BW6_STAGE3_HOLDOUT_AUDIT.path));

ok(
  diagnosis.schemaVersion === 'walters-bw6-stage3r1-recalibration-diagnosis-v1',
  'diagnosis schema',
);
ok(diagnosis.module === contract.module, 'diagnosis module');
ok(diagnosis.stage === 'BW6.3R1', 'diagnosis stage');
ok(diagnosis.status === contract.outcomeRules.diagnosisCompleteState, 'diagnosis status');
for (const field of [
  'operational',
  'productionAuthority',
  'grahamFairMutationAllowed',
  'liveBoardMutationAllowed',
  'betStatusMutationAllowed',
  'stakeMutationAllowed',
  'marketViewed',
  'modelFitUsed2025',
  'modelSelectionUsed2025',
  'thresholdChanged',
  'stage3DispositionOverridden',
]) {
  ok(diagnosis[field] === false, `diagnosis ${field}`);
}
ok(diagnosis.holdoutState === 'EXPOSED_DIAGNOSTIC_ONLY', 'diagnosis holdout state');
ok(diagnosis.diagnosisContractSha256 === hashFile(CONTRACT_PATH), 'diagnosis contract hash');
ok(diagnosis.builderSha256 === hashFile(BUILDER_PATH), 'diagnosis builder hash');
ok(
  diagnosis.stage1ContractSha256 === frozenByRole.BW6_STAGE1_CONTRACT.sha256,
  'Stage 1 hash binding',
);
ok(
  diagnosis.stage2ModelLockSha256 === frozenByRole.BW6_STAGE2_MODEL_LOCK.sha256,
  'Stage 2 lock hash binding',
);
ok(
  diagnosis.stage2CalibrationSha256 === frozenByRole.BW6_STAGE2_CALIBRATION.sha256,
  'Stage 2 calibration hash binding',
);
ok(
  diagnosis.stage3HoldoutAuditSha256 === frozenByRole.BW6_STAGE3_HOLDOUT_AUDIT.sha256,
  'Stage 3 audit hash binding',
);

same(
  diagnosis.originalDecision,
  {
    status: 'BW6_3_FAIL_CLOSED_RECALIBRATION_REVIEW_REQUIRED',
    summary: {checks: 10, passed: 9, failed: 1, holdoutPass: false},
    failedChecks: ['BW6H-AGGREGATE-CALIBRATION'],
    preserved: true,
  },
  'original fail-closed decision',
);
same(diagnosis.originalDecision.summary, stage3.summary, 'Stage 3 summary binding');

const gate = diagnosis.lockedGateDiagnosis;
const games = 272;
const observedEvents = 120;
const selectedProbability = 0.47548917;
const expectedEvents = games * selectedProbability;
const observedProbability = observedEvents / games;
const errorPercentagePoints = Math.abs(selectedProbability - observedProbability) * 100;
ok(gate.games === games, 'gate games');
approximate(gate.observedEvents, observedEvents, EPSILON, 'gate observed events');
approximate(gate.expectedEvents, expectedEvents, 1e-6, 'gate expected events');
approximate(gate.eventShortfall, expectedEvents - observedEvents, 1e-6, 'gate event shortfall');
approximate(gate.absoluteErrorPercentagePoints, errorPercentagePoints, 1e-6, 'gate error');
approximate(gate.lockedMaximumErrorPercentagePoints, 3, EPSILON, 'locked gate');
approximate(gate.distanceBeyondGatePercentagePoints, errorPercentagePoints - 3, 1e-6, 'gate distance');
approximate(gate.maximumAbsoluteEventDifferenceAtGate, 8.16, EPSILON, 'event gate');
same(gate.exactPassingObservedEventRange, {minimum: 122, maximum: 137}, 'passing count range');
ok(gate.minimumAdditionalExactMarginEventsToPass === 2, 'minimum additional events');
ok(gate.errorWithOneAdditionalEventPercentagePoints > 3, 'one additional event still fails');
ok(gate.errorWithTwoAdditionalEventsPercentagePoints < 3, 'two additional events pass');
ok(gate.originalGateWaived === false, 'original gate waiver');

const probabilities = binomialProbabilities(games, selectedProbability);
const observedMass = probabilities[observedEvents];
const exactP = probabilities
  .filter((probability) => probability <= observedMass + 1e-15)
  .reduce((total, probability) => total + probability, 0);
const exceedance = probabilities.reduce(
  (total, probability, events) =>
    total + (Math.abs(events / games - selectedProbability) > 0.03 + 1e-12 ? probability : 0),
  0,
);
approximate(
  diagnosis.samplingCompatibility.exactTwoSidedBinomialPValue,
  exactP,
  1e-8,
  'exact binomial p-value',
);
approximate(
  diagnosis.samplingCompatibility.probabilityAbsoluteErrorExceedsLockedGateUnderFrozenModel,
  exceedance,
  1e-8,
  'locked gate false-fail probability',
);
approximate(
  diagnosis.samplingCompatibility.probabilityLockedGatePassesUnderFrozenModel,
  1 - exceedance,
  1e-8,
  'locked gate pass probability',
);
ok(diagnosis.samplingCompatibility.selectedPredictionInsideHoldoutWilson95 === true, 'Wilson compatibility');
ok(diagnosis.samplingCompatibility.diagnosticOnlyNoGateOverride === true, 'sampling non-override');

const development = diagnosis.developmentEvidence;
ok(development.sourceAudit.developmentGames === 2367, 'development game count');
ok(development.sourceAudit.holdoutScoreFieldsRead === false, 'development holdout isolation');
ok(development.sourceAudit.marketFieldsPresent === false, 'development market fields');
ok(development.orientationAudit.marketInputsUsed === false, 'development market inputs');
ok(development.seasonalAggregate.length === 9, 'development seasons');
ok(
  development.seasonalAggregate.reduce((total, row) => total + row.games, 0) === 2367,
  'seasonal game accounting',
);
ok(development.lockedFoldDiagnostics.length === 9, 'locked fold diagnostics');
const selectedFolds = development.lockedFoldDiagnostics.filter(
  (row) => row.modelId === 'BW6_FULL_DEVELOPMENT_POOL',
);
ok(selectedFolds.length === 3, 'selected fold count');
ok(development.selectedModelPooledLockedFolds.games === 800, 'pooled fold games');
approximate(
  development.selectedModelPooledLockedFolds.signedModelErrorPercentagePoints,
  0.807459,
  1e-6,
  'pooled fold error',
);
ok(
  development.selectedModelPooledLockedFolds.maximumAbsoluteSingleFoldErrorPercentagePoints < 3,
  'locked folds remain within aggregate reference error',
);
ok(development.holdoutOutcomesUsedForAnyDevelopmentFit === false, 'development fit isolation');

const decomposition = development.outcomeDecomposition;
same(
  decomposition.development.counts,
  {
    FAVORITE_WIN_1_TO_18: 1121,
    FAVORITE_WIN_19_PLUS: 323,
    FAVORITE_LOSS_OR_TIE: 923,
  },
  'development outcome counts',
);
const holdoutCounts = {
  FAVORITE_WIN_1_TO_18: 0,
  FAVORITE_WIN_19_PLUS: 0,
  FAVORITE_LOSS_OR_TIE: 0,
};
for (const game of stage3.holdoutGames) {
  const row = outcomePartition(game.pregameFavoriteSide, game.actualHomeMargin);
  for (const category of Object.keys(holdoutCounts)) holdoutCounts[category] += row[category];
}
same(decomposition.holdout.counts, holdoutCounts, 'holdout outcome decomposition');
ok(decomposition.development.favoriteWinPercent < decomposition.holdout.favoriteWinPercent, 'favorite win rate direction');
ok(
  decomposition.development.percents.FAVORITE_WIN_19_PLUS <
    decomposition.holdout.percents.FAVORITE_WIN_19_PLUS,
  '19-plus shift direction',
);
ok(decomposition.threeCategoryHomogeneity.pValue > 0.05, 'three-category compatibility');
ok(
  decomposition.oneToEighteenVersusNineteenPlusAmongFavoriteWins.pValue > 0.05,
  'favorite-win mix is not conclusive',
);
ok(
  decomposition.diagnosticCause ===
    'FAVORITE_WIN_RATE_STABLE_MORE_WINS_ABOVE_18_MONITOR_NOT_PROVEN',
  'diagnostic cause',
);

const localization = diagnosis.localization;
ok(localization.perMargin.length === 18, 'margin localization count');
same(localization.perMargin.map((row) => row.margin), Array.from({length: 18}, (_, i) => i + 1), 'margin identities');
same(localization.familyWiseFlaggedMargins, [], 'family-wise margin flags');
ok(localization.bonferroniTwoSidedCriticalAbsoluteZ > 2.99, 'Bonferroni critical value');
ok(localization.completeNonOverlappingPartitions.length === 4, 'partition count');
const partitionCategories = localization.completeNonOverlappingPartitions.flatMap(
  (row) => row.categories,
);
same(
  partitionCategories,
  [...Array.from({length: 18}, (_, index) => String(index + 1)), 'OTHER'],
  'partition completeness',
);
ok(localization.aggregateErrorEqualsOppositeOtherError === true, 'aggregate/OTHER identity');
approximate(
  localization.aggregateSignedModelErrorPercentagePoints +
    localization.otherSignedModelErrorPercentagePoints,
  0,
  2e-6,
  'aggregate/OTHER opposite errors',
);

same(diagnosis.protectedArtifactSha256Before, diagnosis.protectedArtifactSha256After, 'protected runtime hashes');
same(diagnosis.priorBw6ArtifactSha256Before, diagnosis.priorBw6ArtifactSha256After, 'prior BW6 runtime hashes');
for (const [relative, expected] of Object.entries(diagnosis.protectedArtifactSha256After)) {
  ok(hashFile(path.join(ROOT, relative)) === expected, `current protected hash ${relative}`);
}
for (const [relative, expected] of Object.entries(diagnosis.priorBw6ArtifactSha256After)) {
  ok(hashFile(path.join(ROOT, relative)) === expected, `current prior BW6 hash ${relative}`);
}
ok(diagnosis.protectedArtifactsUnchanged === true, 'protected artifact unchanged state');
ok(diagnosis.priorBw6ArtifactsUnchanged === true, 'prior BW6 unchanged state');

const conclusion = diagnosis.diagnosticConclusion;
ok(conclusion.descriptiveStructuralSignalDetected === false, 'no descriptive structural signal');
ok(conclusion.samplingVariationRemainsPlausible === true, 'sampling variation plausibility');
ok(conclusion.interpretation === 'NO_HOLDOUT_EVIDENCE_JUSTIFIES_RETROACTIVE_REFIT', 'interpretation');
ok(conclusion.currentFrozenModelDisposition === 'RETAIN_AS_FROZEN_REFERENCE_NON_OPERATIONAL', 'model disposition');
ok(conclusion.replacementModelSelected === false, 'replacement model selection');
ok(conclusion.freshValidationRequired === true, 'fresh validation requirement');
ok(
  conclusion.approximateGamesRequiredForThreePoint95PercentNormalHalfWidth === 1065,
  'precision sample size',
);
ok(conclusion.oneSeasonHasMaterialFalseFailRiskAtLockedGate === true, 'one-season gate risk');
same(diagnosis.blockedStages, ['BW6.4', 'BW7', 'BW8'], 'blocked stages');
ok(
  diagnosis.nextStage === 'BW6.3R2_DEVELOPMENT_ONLY_RECALIBRATION_CONTRACT',
  'next governed stage',
);

console.log(
  'WALTERS BW6 STAGE 3R1 VERIFY: PASS // ORIGINAL 9/10 PRESERVED // ' +
    'SAMPLING VARIATION PLAUSIBLE // NO RETROACTIVE REFIT // BW6.4 BLOCKED',
);

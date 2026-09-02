#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const QB_ROOT = path.join(ROOT, 'data', 'walters', 'nfl', 'qb-performance');
const STAGE5_ROOT = path.join(QB_ROOT, 'stage5');

const paths = {
  contract: path.join(QB_ROOT, 'stage5-contract-v1.json'),
  stage4Acceptance: path.join(QB_ROOT, 'stage4-acceptance-v1.json'),
  stage4Current: path.join(QB_ROOT, 'stage4-current.json'),
  freeze: path.join(STAGE5_ROOT, 'freeze-manifest-v1.json'),
  review: path.join(STAGE5_ROOT, 'production-review-v1.json'),
  readiness: path.join(STAGE5_ROOT, 'activation-readiness-v1.json'),
  regression: path.join(STAGE5_ROOT, 'regression-audit-v1.json'),
  acceptance: path.join(QB_ROOT, 'stage5-acceptance-v1.json'),
  current: path.join(QB_ROOT, 'stage5-current.json'),
};

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function readJson(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing required file: ${rel(file)}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256File(file) {
  return sha256Buffer(fs.readFileSync(file));
}

function canonicalPayload(value) {
  if (Array.isArray(value)) return value.map(canonicalPayload);
  if (value && typeof value === 'object') {
    const output = {};
    for (const key of Object.keys(value).sort()) {
      if (key === 'contentSha256Canonical') continue;
      output[key] = canonicalPayload(value[key]);
    }
    return output;
  }
  return value;
}

function canonicalSha(value) {
  return sha256Buffer(Buffer.from(JSON.stringify(canonicalPayload(value)), 'utf8'));
}

function nearlyEqual(left, right, tolerance = 1e-9) {
  return Math.abs(Number(left) - Number(right)) <= tolerance;
}

function roundHalfAwayFromZero(value) {
  const scaled = Number(value) * 2;
  const rounded = scaled >= 0 ? Math.floor(scaled + 0.5) : Math.ceil(scaled - 0.5);
  return rounded / 2;
}

function anyTrueKey(value, targetKey) {
  if (Array.isArray(value)) return value.some((item) => anyTrueKey(item, targetKey));
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === targetKey && item === true) return true;
      if (anyTrueKey(item, targetKey)) return true;
    }
  }
  return false;
}

function collectKeys(value, output = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, output);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      output.add(key);
      collectKeys(item, output);
    }
  }
  return output;
}

function assertCanonical(name, value, errors) {
  if (typeof value.contentSha256Canonical !== 'string') {
    errors.push(`${name} has no canonical content hash.`);
    return;
  }
  const actual = canonicalSha(value);
  if (actual !== value.contentSha256Canonical) {
    errors.push(`${name} canonical hash mismatch: ${actual} != ${value.contentSha256Canonical}`);
  }
}

const contract = readJson(paths.contract);
const stage4Acceptance = readJson(paths.stage4Acceptance);
const stage4Current = readJson(paths.stage4Current);
const freeze = readJson(paths.freeze);
const review = readJson(paths.review);
const readiness = readJson(paths.readiness);
const regression = readJson(paths.regression);
const acceptance = readJson(paths.acceptance);
const current = readJson(paths.current);
const generated = { freeze, review, readiness, regression, acceptance, current };
const errors = [];

for (const [name, value] of Object.entries(generated)) assertCanonical(name, value, errors);

if (
  contract.stage !== 5
  || contract.operational !== false
  || contract.productionAuthority !== false
  || contract.grahamWritesAllowed !== false
  || contract.uncertaintyOverlayRetirementAllowed !== false
  || contract.runtimeAdapterWritesAllowed !== false
  || contract.betAuthority !== false
  || contract.wagerOrStakeWritesAllowed !== false
) {
  errors.push('Stage 5 contract identity or review-only authority boundary is invalid.');
}
if (
  stage4Acceptance.status !== contract.dependency.requiredStage4Status
  || stage4Acceptance.decision !== contract.dependency.requiredStage4Decision
  || stage4Current.nextStage !== contract.dependency.requiredStage4NextStage
) {
  errors.push('Stage 4 acceptance/current state does not match the Stage 5 handoff.');
}

if (freeze.status !== 'STAGE5_REVIEW_INPUTS_HASH_FROZEN' || freeze.allInputsPresent !== true) {
  errors.push('Stage 5 freeze manifest did not pass.');
}
if (freeze.inputCount !== contract.freezePolicy.immutableInputPaths.length) {
  errors.push('Stage 5 freeze input count does not match the contract.');
}
for (const entry of freeze.inputs ?? []) {
  const file = path.join(ROOT, entry.path);
  if (!fs.existsSync(file)) {
    errors.push(`Frozen input is missing: ${entry.path}`);
    continue;
  }
  if (sha256File(file) !== entry.sha256) errors.push(`Frozen input raw hash mismatch: ${entry.path}`);
  if (entry.canonicalJsonSha256) {
    const parsed = readJson(file);
    if (canonicalSha(parsed) !== entry.canonicalJsonSha256) errors.push(`Frozen input canonical hash mismatch: ${entry.path}`);
  }
}

const continuity = review.commitContinuity ?? {};
if (
  continuity.stage4Commit !== contract.dependency.stage4Commit
  || continuity.stage4CommitIsAncestor !== true
  || continuity.candidateCommit !== contract.productionControl.candidateCommit
  || continuity.candidateCommitIsAncestor !== true
  || continuity.publicationCommit !== contract.productionControl.publicationCommit
  || continuity.publicationCommitIsAncestor !== true
) {
  errors.push('Stage 5 commit ancestry/continuity evidence failed.');
}

const control = review.fifteenFifteenControl ?? {};
if (
  control.candidateId !== contract.productionControl.expectedCandidateId
  || String(control.phase) !== String(contract.productionControl.expectedPhase)
  || control.label !== contract.productionControl.expectedLabel
  || control.timestamp !== contract.productionControl.expectedTimestamp
  || control.slot !== contract.productionControl.expectedSlot
  || JSON.stringify(control.counts) !== JSON.stringify(contract.productionControl.expectedCounts)
  || !nearlyEqual(control.risk, contract.productionControl.expectedRisk)
  || control.recommendationCount !== contract.productionControl.expectedRecommendationCount
  || JSON.stringify(control.recommendationStatuses) !== JSON.stringify([...contract.productionControl.expectedRecommendationStatuses].sort())
  || JSON.stringify(control.recommendationSports) !== JSON.stringify([...contract.productionControl.expectedSports].sort())
  || control.derivedNflRecommendationCount !== contract.productionControl.expectedNflGamesInScope
  || control.candidateReportMatchesPublishedReport !== true
  || control.currentHistoryPathMatchesPublishedCommit !== true
  || control.publicationIntegrityVerified !== true
) {
  errors.push('The September 2 15:15 production-control identity or zero-risk result is invalid.');
}
if (control.qbProductionPathVerified !== false || control.derivedNflRecommendationCount !== 0) {
  errors.push('The zero-NFL 15:15 run was falsely promoted to QB production-path verification.');
}

const lv = review.lasVegasStarterIdentityReview ?? {};
const expectedLv = contract.lasVegasReviewCase;
if (
  lv.gameKey !== expectedLv.gameKey
  || lv.starterStatus !== expectedLv.starterIdentityStatus
  || lv.starterPlayer?.playerName !== expectedLv.starterPlayerName
  || lv.embeddedBaselinePlayer?.playerName !== expectedLv.embeddedBaselinePlayerName
  || !nearlyEqual(lv.awayTeamQbDelta, expectedLv.awayTeamQbDelta, 0.0011)
  || !nearlyEqual(lv.homeTeamQbDelta, expectedLv.homeTeamQbDelta, 0.0011)
  || !nearlyEqual(lv.homeSpreadQbPoints, expectedLv.homeSpreadQbPoints, 0.0011)
  || !nearlyEqual(lv.currentGrahamExactFairHome, expectedLv.currentGrahamExactFairHome)
  || !nearlyEqual(lv.currentGrahamDisplayedFairHome, expectedLv.currentGrahamDisplayedFairHome)
  || !nearlyEqual(lv.eligibleResolvedStarterIdentityOverlayPoints, expectedLv.eligibleResolvedStarterIdentityOverlayPoints)
  || !nearlyEqual(lv.conservativeReviewExactFairHome, expectedLv.conservativeReviewExactFairHome, 0.0011)
  || !nearlyEqual(lv.reconciledReviewExactFairHome, expectedLv.reconciledReviewExactFairHome, 0.0011)
  || !nearlyEqual(lv.reconciledReviewDisplayedFairHome, expectedLv.reconciledReviewDisplayedFairHome)
  || lv.identityOverlayStillPresent !== true
  || lv.productionGrahamFairPreserved !== true
  || lv.overlayRetired !== false
  || lv.productionMutationApplied !== false
  || lv.disposition !== expectedLv.requiredProductionDisposition
) {
  errors.push('Las Vegas Stage 5 starter-identity reconciliation review is invalid.');
}
const computedQbPoints = Number(lv.awayTeamQbDelta) - Number(lv.homeTeamQbDelta);
const computedConservative = Number(lv.currentGrahamExactFairHome) + computedQbPoints;
const computedReconciled = Number(lv.currentGrahamExactFairHome)
  - Number(lv.eligibleResolvedStarterIdentityOverlayPoints)
  + computedQbPoints;
if (
  !nearlyEqual(computedQbPoints, lv.homeSpreadQbPoints, 0.0011)
  || !nearlyEqual(computedConservative, lv.conservativeReviewExactFairHome, 0.0011)
  || !nearlyEqual(computedReconciled, lv.reconciledReviewExactFairHome, 0.0011)
  || !nearlyEqual(roundHalfAwayFromZero(computedReconciled), lv.reconciledReviewDisplayedFairHome)
) {
  errors.push('Las Vegas formula or rounding arithmetic failed independent validator recomputation.');
}

const atl = review.atlantaFailClosedReview ?? {};
if (
  atl.gameKey !== contract.atlantaReviewCase.gameKey
  || atl.currentStarterStatus !== contract.atlantaReviewCase.starterStatus
  || atl.embeddedBaselineStatus !== contract.atlantaReviewCase.embeddedBaselineStatus
  || atl.teamQbDelta !== null
  || atl.scopedProductionExclusionRequired !== true
  || atl.failClosedPreserved !== true
) {
  errors.push('Atlanta did not remain fail-closed and excluded from numeric contribution.');
}

const staleness = review.formulaAndStalenessReview ?? {};
if (
  staleness.candidateAsOf !== contract.evidenceStaleness.modelAsOf
  || staleness.candidateForSeason !== contract.evidenceStaleness.candidateForSeason
  || staleness.stalenessDisposition !== contract.evidenceStaleness.week1ReviewDisposition
  || staleness.automaticInSeasonRefitAllowed !== false
  || !Array.isArray(staleness.modelCautionFlagsReviewedAndRetained)
  || staleness.modelCautionFlagsReviewedAndRetained.length !== 5
) {
  errors.push('Stage 5 evidence-staleness or model-caution review is invalid.');
}

const marketBoundary = review.marketBoundary ?? {};
if (
  marketBoundary.marketBearingProductionArtifactInspectedForPublicationControl !== true
  || marketBoundary.marketFieldsCopiedIntoStage5Evidence !== false
  || marketBoundary.marketFieldsUsedByQbFormula !== false
  || marketBoundary.marketFieldsUsedToMoveGrahamFair !== false
) {
  errors.push('Stage 5 market quarantine boundary is invalid.');
}
const copiedForbiddenKeys = ['book', 'price', 'fair', 'pinnacleBenchmark', 'odds', 'marketSpread', 'marketPrice']
  .filter((key) => collectKeys(review).has(key));
if (copiedForbiddenKeys.length) errors.push(`Stage 5 review copied forbidden market-bearing keys: ${copiedForbiddenKeys.join(', ')}`);

if (
  readiness.status !== 'REVIEW_PASS_ACTIVATION_NOT_AUTHORIZED'
  || readiness.reviewPassed !== true
  || readiness.activationAuthorized !== false
  || readiness.productionAuthority !== false
  || readiness.grahamWritesAllowed !== false
  || readiness.nextRequiredGate !== contract.acceptance.requiredPendingGate
) {
  errors.push('Stage 5 activation-readiness state is invalid.');
}
const gates = new Map((readiness.pendingBlockingGates ?? []).map((item) => [item.gate, item]));
for (const gateName of ['FIRST_NFL_BEARING_PRODUCTION_READBACK', 'EXPLICIT_SCOPED_QB_ACTIVATION_APPROVAL']) {
  const gate = gates.get(gateName);
  if (!gate || gate.status !== 'UNSATISFIED' || gate.blocking !== true) {
    errors.push(`Required Stage 5 blocking gate is not preserved: ${gateName}`);
  }
}

const requiredCases = new Set(contract.requiredReviewCases);
const actualCases = new Set((regression.cases ?? []).map((item) => item.caseKey));
if (
  regression.status !== 'PASS'
  || regression.failCount !== 0
  || regression.passCount !== requiredCases.size
  || regression.requiredCaseCount !== requiredCases.size
) {
  errors.push('Stage 5 review-case matrix did not fully pass.');
}
for (const key of requiredCases) if (!actualCases.has(key)) errors.push(`Missing Stage 5 review case ${key}.`);
for (const item of regression.cases ?? []) if (item.result !== 'PASS') errors.push(`Stage 5 review case failed: ${item.caseKey}`);

if (
  acceptance.status !== 'PASS'
  || acceptance.decision !== contract.acceptance.passState
  || acceptance.activationAuthorized !== false
  || acceptance.productionAuthority !== false
  || acceptance.grahamWritesAllowed !== false
  || acceptance.fifteenFifteenControl?.nflPathVerified !== false
  || acceptance.fifteenFifteenControl?.nflGamesInScope !== 0
  || acceptance.lasVegasDisposition !== contract.lasVegasReviewCase.requiredProductionDisposition
  || acceptance.atlantaDisposition !== contract.atlantaReviewCase.requiredDisposition
  || acceptance.nextRequiredGate !== contract.acceptance.requiredPendingGate
  || (acceptance.checks ?? []).some((check) => check.pass !== true)
) {
  errors.push('Stage 5 acceptance decision is invalid.');
}
if (
  current.status !== contract.acceptance.passState
  || current.stage !== 5
  || current.nflPathVerified !== false
  || !nearlyEqual(current.lasVegasDisplayedFairHome, -2.5)
  || current.lasVegasOverlayRetired !== false
  || current.atlantaFailClosed !== true
  || current.productionAuthority !== false
  || current.grahamWritesAllowed !== false
  || current.activationAuthorized !== false
  || current.currentProductionDisposition !== contract.acceptance.currentProductionDisposition
  || current.nextRequiredGate !== contract.acceptance.requiredPendingGate
) {
  errors.push('Stage 5 current-state pointer is invalid.');
}

const hashLinks = [
  [readiness.productionReview, readiness.productionReviewSha256],
  [acceptance.freezeManifest, acceptance.freezeManifestSha256],
  [acceptance.productionReview, acceptance.productionReviewSha256],
  [acceptance.activationReadiness, acceptance.activationReadinessSha256],
  [acceptance.regressionAudit, acceptance.regressionAuditSha256],
  [current.stage5Acceptance, current.stage5AcceptanceSha256],
  [current.productionReview, current.productionReviewSha256],
  [current.activationReadiness, current.activationReadinessSha256],
  [current.regressionAudit, current.regressionAuditSha256],
];
for (const [filePath, expectedHash] of hashLinks) {
  const file = path.join(ROOT, filePath);
  if (!fs.existsSync(file) || sha256File(file) !== expectedHash) errors.push(`Referenced artifact hash mismatch: ${filePath}`);
}

for (const artifact of [review, regression, acceptance]) {
  if (JSON.stringify(artifact.protectedArtifactSha256Before) !== JSON.stringify(artifact.protectedArtifactSha256After)) {
    errors.push(`${artifact.schemaVersion} protected-artifact before/after maps differ.`);
  }
}
for (const [filePath, expectedHash] of Object.entries(acceptance.protectedArtifactSha256After ?? {})) {
  const file = path.join(ROOT, filePath);
  if (!fs.existsSync(file) || sha256File(file) !== expectedHash) errors.push(`Protected artifact changed during Stage 5: ${filePath}`);
}

for (const [name, value] of Object.entries(generated)) {
  for (const key of [
    'productionAuthority',
    'grahamWritesAllowed',
    'embeddedQbBaselinesChanged',
    'uncertaintyOverlaysRetired',
    'runtimeAdapterChanged',
    'wagerOrStakeChanged',
    'activationAuthorized',
    'marketFieldsCopiedIntoStage5Evidence',
    'marketFieldsUsedByQbFormula',
    'marketFieldsUsedToMoveGrahamFair',
  ]) {
    if (anyTrueKey(value, key)) errors.push(`${name} contains ${key}:true.`);
  }
}
const serializedGenerated = JSON.stringify(generated);
if (serializedGenerated.includes('APPROVED_WALTERS_QB_PERFORMANCE')) {
  errors.push('Stage 5 generated artifacts contain a production-authority token.');
}

if (errors.length) {
  console.error(JSON.stringify({
    schemaVersion: 'walters-qb-performance-stage5-validation-v1',
    status: 'FAIL',
    stage: 5,
    errors,
  }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  schemaVersion: 'walters-qb-performance-stage5-validation-v1',
  status: 'PASS',
  stage: 5,
  checks: [
    'stage4-commit-and-acceptance-handoff',
    '1515-candidate-publication-commit-continuity',
    '1515-zero-risk-publication-control',
    'zero-nfl-no-false-runtime-attestation',
    'las-vegas-starter-identity-review-scenario',
    'las-vegas-minus-2.5-preservation',
    'las-vegas-overlay-preservation',
    'atlanta-fail-closed-preservation',
    'formula-and-rounding-recomputation',
    'model-caution-and-staleness-boundary',
    'market-bearing-control-quarantine',
    'eighteen-case-review-matrix',
    'protected-artifact-integrity',
    'no-production-or-betting-authority',
    'deterministic-readback',
  ],
  decision: acceptance.decision,
  fifteenFifteenClassification: contract.productionControl.classification,
  nflPathVerified: false,
  lasVegasDisplayedFairHome: current.lasVegasDisplayedFairHome,
  lasVegasOverlayRetired: false,
  atlantaFailClosed: true,
  productionAuthority: false,
  activationAuthorized: false,
  nextRequiredGate: current.nextRequiredGate,
}, null, 2));

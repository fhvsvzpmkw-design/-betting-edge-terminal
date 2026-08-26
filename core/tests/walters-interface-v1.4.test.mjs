#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const interfacePath = 'core/walters-intelligence-interface-v1.4.json';
const specPath = 'research/staging/BILLY_WALTERS_SPREAD_BOX_SPEC_2026-08-15.md';

const iface = JSON.parse(fs.readFileSync(interfacePath, 'utf8'));
const spec = fs.readFileSync(specPath);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function gitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`);
  return crypto.createHash('sha1').update(Buffer.concat([header, buffer])).digest('hex');
}

assert(iface.schema === 1, 'Walters interface schema must be 1');
assert(iface.targetCoreVersion === '1.4', 'Walters interface must target Core 1.4');
assert(iface.coverage?.interfaceResolutionRequiredForCore14 === true, 'Core 1.4 must resolve Walters availability');
assert(iface.coverage?.availabilityIsReportBlocking === false, 'Missing Walters data must not block an otherwise valid report');
assert(iface.sourceAuthority?.designPath === specPath, 'Walters source-design path mismatch');
assert(gitBlobSha(spec) === iface.sourceAuthority?.designBlobSha, 'Pinned Walters source-design blob SHA mismatch');
assert(iface.sourceAuthority?.page270CorrectionRequired === true, 'Page 270 correction must remain required');

const forbiddenAuthority = [
  'mayCreateBet',
  'mayCountAsIndependentCurrentSupport',
  'mayDirectlyMoveCoreFairValuePointEstimate',
  'mayLowerModelErrorFloor',
  'maySetPlayTo',
  'maySetStake',
  'mayOverrideIdentity',
  'mayOverridePriceFreshness',
  'mayOverridePersonnelGate',
  'mayOverrideExposureGate',
  'maySupplyExecutablePrice'
];
for (const key of forbiddenAuthority) {
  assert(iface.authorityBoundaries?.[key] === false, `Walters authority boundary ${key} must remain false in initial Core 1.4`);
}
assert(iface.authorityBoundaries?.mayTriggerExplicitReReview === true, 'Walters must be allowed to trigger explicit re-review');
assert(iface.authorityBoundaries?.maySupplyTransparentSpecialistContext === true, 'Walters specialist context must be available');
assert(iface.futureActivationBoundary?.weightedCoreInputAllowedNow === false, 'Walters weighted core input must remain disabled initially');

for (const state of ['AVAILABLE', 'PARTIAL', 'UNAVAILABLE']) {
  assert(iface.availabilityStates.includes(state), `Missing Walters availability state ${state}`);
}
for (const state of ['ALIGNED', 'MIXED', 'CONFLICT', 'NOT_COMPARABLE', 'UNAVAILABLE']) {
  assert(iface.comparisonStates.includes(state), `Missing Walters comparison state ${state}`);
}
assert(iface.spreadMoneylineStates.includes('SPREAD_VS_ML_UNAVAILABLE'), 'Fail-closed spread-vs-moneyline state is required');

const sampleAvailable = {
  candidateKey: 'nfl:away@home:2026-09-13',
  availability: 'AVAILABLE',
  eventIdentity: {
    sport: 'NFL',
    league: 'NFL',
    eventId: 'sample-event',
    away: 'Away',
    home: 'Home',
    startTime: '2026-09-13T13:00:00-07:00'
  },
  source: {
    methodologyVersion: iface.interfaceId,
    sourceAsOf: '2026-09-13T09:00:00-07:00',
    generatedAt: '2026-09-13T09:05:00-07:00',
    sourceRefs: ['power-ratings', 'personnel-check'],
    notes: null
  },
  power: {
    awayNeutralRating: 1.5,
    homeNeutralRating: 4.0,
    rawHomeDifferential: 2.5,
    awayPriorRating: 1.0,
    homePriorRating: 4.0,
    awayUpdate: 0.5,
    homeUpdate: 0,
    confidence: 'MEDIUM'
  },
  personnel: { adjustments: [], netHomeAdjustment: 0, unresolved: [] },
  gameFactors: { factors: [], netHomeAdjustment: 1.5 },
  fairSpread: {
    homePerspective: -4.0,
    arithmeticVerified: true,
    componentEquation: '2.5 neutral + 1.5 home = home -4.0',
    uncertainty: 'medium confidence',
    status: 'AVAILABLE'
  },
  keyNumbers: { status: 'AVAILABLE', crossings: [3], tableRef: 'sample-key-number-table' },
  spreadVsMoneyline: {
    status: 'SPREAD_VS_ML_UNAVAILABLE',
    preferredExpression: 'UNAVAILABLE',
    logicRef: null,
    rationale: 'Corrected conversion logic not loaded in this sample.'
  },
  marketReference: {
    spread: -3.0,
    spreadPrice: -110,
    moneyline: -155,
    book: 'comparison-only',
    observedAt: '2026-09-13T09:00:00-07:00',
    executionAuthority: false
  },
  waltersVerdict: 'MARGINAL',
  coreComparison: {
    coreFairSpread: -3.5,
    waltersFairSpread: -4.0,
    differencePoints: -0.5,
    state: 'ALIGNED',
    materialityRationale: 'Same directional view; half-point difference does not independently create a wager.',
    reviewRequired: false
  }
};

assert(sampleAvailable.marketReference.executionAuthority === false, 'Walters sample market reference must not be executable authority');
assert(sampleAvailable.spreadVsMoneyline.status === 'SPREAD_VS_ML_UNAVAILABLE', 'Unresolved Page 270 conversion must fail closed');
assert(sampleAvailable.coreComparison.state === 'ALIGNED', 'Available sample should demonstrate comparison access');

const sampleUnavailable = {
  candidateKey: 'nfl:missing',
  availability: 'UNAVAILABLE',
  coreComparison: { state: 'UNAVAILABLE', reviewRequired: false }
};
assert(sampleUnavailable.availability === 'UNAVAILABLE', 'Unavailable Walters input must be representable without blocking core analysis');

console.log('CORE 1.4 WALTERS INTERFACE TEST OK');

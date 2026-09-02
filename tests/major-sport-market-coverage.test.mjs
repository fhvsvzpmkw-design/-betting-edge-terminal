import assert from 'node:assert/strict';
import fs from 'node:fs';

const policy = JSON.parse(fs.readFileSync('data/major-sport-market-coverage-v1.json', 'utf8'));

assert.equal(policy.schema, 1);
assert.equal(policy.authorityId, 'major-sport-market-coverage-v1');
assert.equal(policy.state, 'OPERATIONAL');
assert.equal(policy.principles.evaluationOrder, 'EVALUATE_BEFORE_CARD_SELECTION');
assert.equal(policy.principles.preselectedSideAllowed, false);
assert.equal(policy.principles.marketSubstitutionAllowed, false);
assert.equal(policy.principles.sportSubstitutionAllowed, false);
assert.equal(policy.feedAuthority.path, 'data/live-odds.json');
assert.equal(policy.feedAuthority.primaryEventCollection, 'events');
assert.ok(policy.feedAuthority.supplementalCollections.includes('deepMarkets'));
assert.ok(policy.feedAuthority.supplementalCollections.includes('baseballProps'));

function assertTwoSidedPrimary(sportKey, spreadDisplayName = null) {
  const sport = policy.sports[sportKey];
  assert.ok(sport, `missing ${sportKey}`);
  assert.equal(sport.primary.length, 3, `${sportKey} must define ML/spread/total`);

  const ml = sport.primary.find(x => x.market === 'moneyline');
  const spread = sport.primary.find(x => x.market === 'spread');
  const total = sport.primary.find(x => x.market === 'total');

  assert.deepEqual(ml?.requiredSelections, ['home', 'away']);
  assert.deepEqual(spread?.requiredSelections, ['home', 'away']);
  assert.deepEqual(total?.requiredSelections, ['over', 'under']);
  assert.equal(spread?.primaryLineOnly, true);
  assert.equal(total?.primaryLineOnly, true);
  if (spreadDisplayName) assert.equal(spread?.displayName, spreadDisplayName);

  assert.equal(sport.props.requiredWhenFreshAndAvailable, true);
  assert.match(sport.props.scope, /^ALL_EXACT_SUPPORTED_/);
}

assertTwoSidedPrimary('MLB', 'run line');
assertTwoSidedPrimary('NHL', 'puck line');
assertTwoSidedPrimary('NBA_WNBA');
assertTwoSidedPrimary('FOOTBALL');
assert.deepEqual(policy.sports.FOOTBALL.leagues, ['NFL', 'NCAAF', 'CFL']);

assert.equal(policy.presentation.preferencePath, 'data/preferences.json');
assert.equal(policy.presentation.preferenceId, 'report_card_target');
assert.equal(policy.presentation.targetIsSoft, true);
assert.equal(policy.presentation.overflowProtectionRequired, true);
assert.match(policy.presentation.rule, /BET, LEAN or WAIT/);

assert.equal(policy.coverageAudit.schema, 1);
assert.equal(policy.coverageAudit.sidecarField, 'coverageAudit');
assert.equal(policy.coverageAudit.requiredFrom, '2026-09-02T08:00:00-07:00');
assert.equal(policy.coverageAudit.validatorPath, 'tools/major-sport-market-coverage-gate.mjs');
assert.deepEqual(policy.coverageAudit.sportKeys, ['MLB', 'NHL', 'NBA_WNBA', 'NFL', 'NCAAF', 'CFL']);
assert.equal(policy.coverageAudit.primarySelectionsPerGame, 6);
for (const field of ['schema', 'authorityId', 'authorityPath', 'authorityBlobSha', 'state', 'feedGeneratedAt', 'evaluationOrder', 'sports', 'availabilityLimitations', 'presentation', 'totals', 'complete']) {
  assert.ok(policy.coverageAudit.fieldContract.topLevel.includes(field), `coverageAudit top-level contract missing ${field}`);
}
for (const field of ['returned', 'screened', 'seriousDeepReviewed']) {
  assert.ok(policy.coverageAudit.fieldContract.props.includes(field), `coverageAudit props contract missing ${field}`);
}
assert.ok(policy.coverageAudit.rules.some(rule => /authorityBlobSha/.test(rule)));
assert.ok(policy.coverageAudit.rules.some(rule => /actionableSuppressedByTarget is zero/.test(rule)));
assert.ok(policy.coverageAudit.rules.some(rule => /major-sport-market-coverage-gate\.mjs/.test(rule)));

assert.match(policy.completion.primaryCoverageComplete, /every required primary selection/i);
assert.match(policy.completion.propCoverageComplete, /every fresh exact supported prop/i);

const markdown = fs.readFileSync('BETTING_EDGE_MAJOR_SPORT_MARKET_COVERAGE.md', 'utf8');
for (const phrase of [
  'Evaluate first, select cards second',
  'MLB',
  'NHL',
  'NBA / WNBA',
  'NFL / NCAAF / CFL',
  'Props are part of the major-sport sweep',
  'not a hard ceiling',
  'Durable coverage receipt',
  'major-sport-market-coverage-gate.mjs',
  'fails closed'
]) {
  assert.ok(markdown.includes(phrase), `coverage addendum missing phrase: ${phrase}`);
}

console.log('MAJOR SPORT MARKET COVERAGE TEST: PASS // TWO-SIDED PRIMARY MARKETS + PROPS + COVERAGE RECEIPT + SOFT CARD TARGET');

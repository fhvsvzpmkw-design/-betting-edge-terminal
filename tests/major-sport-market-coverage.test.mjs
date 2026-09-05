import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deriveBoundCoverage, majorSportKey } from '../tools/major-sport-market-coverage-gate.mjs';

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

  assert.equal(sport.props.requiredWhenFreshAndAvailable, false);
  assert.equal(sport.props.scope, 'PAUSED_BY_SCOPE');
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

// Source-reconciliation regression: a future same-day NCAAF game in the exact
// bound snapshot must not be reported as zero, and soccer's "1. CFL" league
// must not be confused with the Canadian Football League.
assert.equal(majorSportKey({ sport: { slug: 'american-football' }, league: { slug: 'usa-college' } }), 'NCAAF');
assert.equal(majorSportKey({ sport: { slug: 'american-football' }, league: { slug: 'usa-nfl-preseason' } }), 'NFL');
assert.equal(majorSportKey({ sport: { slug: 'american-football' }, league: { slug: 'canada-cfl' } }), 'CFL');
assert.equal(majorSportKey({ sport: { slug: 'football' }, league: { slug: 'montenegro-1-cfl' } }), null);

const reconciliationReport = {
  ts: '2026-09-03T09:34:30.000-07:00',
  feedGeneratedAt: '2026-09-03T16:23:30.384Z'
};
const reconciliationFeed = {
  generatedAt: reconciliationReport.feedGeneratedAt,
  events: [
    {
      eventId: 'ncaaf-future', date: '2026-09-03T22:00:00.000Z',
      sport: { slug: 'american-football' }, league: { slug: 'usa-college', name: 'USA - College' },
      bookmakers: { Bet365: [
        {
          marketKey: 'ml', updatedAt: '2026-09-03T16:20:00.000Z',
          odds: [{ home: '1.20', away: '4.50', selectionKeys: { home: 'ncaaf-future|ml|home||', away: 'ncaaf-future|ml|away||' } }]
        },
        {
          marketKey: 'touchdown-scorers', name: 'Touchdown Scorers', updatedAt: '2026-09-03T16:20:00.000Z',
          odds: [{ label: 'Synthetic Runner', yes: '2.25', selectionKeys: { yes: 'ncaaf-future|touchdown-scorers|yes|synthetic-runner|' } }]
        }
      ] }
    },
    {
      eventId: 'mlb-fresh-spread', date: '2026-09-03T23:00:00.000Z',
      sport: { slug: 'baseball' }, league: { slug: 'usa-mlb', name: 'USA - MLB' },
      bookmakers: { Bet365: [
        {
          marketKey: 'ml', updatedAt: '2026-09-03T16:20:00.000Z',
          odds: [{ home: '1.80', away: '2.05', selectionKeys: { home: 'mlb-fresh-spread|ml|home||', away: 'mlb-fresh-spread|ml|away||' } }]
        },
        {
          marketKey: 'spread', updatedAt: '2026-09-03T16:03:13.287Z',
          odds: [{ hdp: -1.5, home: '1.91', away: '1.91', selectionKeys: { home: 'mlb-fresh-spread|spread|home||-1.5', away: 'mlb-fresh-spread|spread|away||-1.5' } }]
        },
        {
          marketKey: 'totals', updatedAt: '2026-09-03T16:20:00.000Z',
          odds: [{ hdp: 8.5, over: '1.91', under: '1.91', selectionKeys: { over: 'mlb-fresh-spread|totals|over||8.5', under: 'mlb-fresh-spread|totals|under||8.5' } }]
        }
      ] }
    },
    {
      eventId: 'soccer-cfl', date: '2026-09-03T21:00:00.000Z',
      sport: { slug: 'football' }, league: { slug: 'montenegro-1-cfl', name: 'Montenegro - 1. CFL' }, bookmakers: {}
    },
    {
      eventId: 'ncaaf-next-day', date: '2026-09-04T16:00:00.000Z',
      sport: { slug: 'american-football' }, league: { slug: 'usa-college', name: 'USA - College' }, bookmakers: {}
    }
  ]
};
const reconciled = deriveBoundCoverage(reconciliationReport, reconciliationFeed, policy);
assert.deepEqual(reconciled.sports.NCAAF.eventIds, ['ncaaf-future']);
assert.equal(reconciled.sports.NCAAF.gamesInScope, 1);
assert.equal(reconciled.sports.NCAAF.primary.evaluated, 2);
assert.equal(reconciled.sports.NCAAF.primary.unavailable, 4);
assert.equal(reconciled.sports.NCAAF.propsReturned, 1);
assert.equal(reconciled.sports.CFL.gamesInScope, 0);
assert.equal(reconciled.sports.MLB.primary.evaluated, 6, 'a 20-minute-old exact spread must be fresh under the 30-minute clock');

const markdown = fs.readFileSync('BETTING_EDGE_MAJOR_SPORT_MARKET_COVERAGE.md', 'utf8');
for (const phrase of [
  'Evaluate first, select cards second',
  'MLB',
  'NHL',
  'NBA / WNBA',
  'NFL / NCAAF / CFL',
  'Player props are paused by scope',
  'not a hard ceiling',
  'Durable coverage receipt',
  'major-sport-market-coverage-gate.mjs',
  'fails closed'
]) {
  assert.ok(markdown.includes(phrase), `coverage addendum missing phrase: ${phrase}`);
}

console.log('MAJOR SPORT MARKET COVERAGE TEST: PASS // TWO-SIDED PRIMARY MARKETS + PAUSED PROPS + COVERAGE RECEIPT + SOFT CARD TARGET');

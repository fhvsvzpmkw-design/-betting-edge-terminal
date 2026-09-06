import assert from 'node:assert/strict';
import fs from 'node:fs';

const text = fs.readFileSync('BETTING_EDGE_SCHEDULED_REPORT_AUTHORITY.md', 'utf8');

for (const phrase of [
  'Status:** OPERATIONAL',
  'Authority version:** 1.1',
  'Schedule profile gate',
  'Core 1.4 production preflight',
  'Major-sport market coverage',
  'both moneyline sides',
  'primary run line',
  'primary puck line',
  'Player props — PAUSED_BY_SCOPE',
  'live-odds.events',
  'Pinnacle official sharp benchmark',
  'pre-freeze trace audit',
  'Walters engine',
  'Walters QB production read-back',
  'APPROVED_WALTERS_QB_PERFORMANCE',
  'FIRST_NFL_BEARING_BETTING_EDGE_READBACK',
  'Unbounded card-output amendment',
  'no numeric card minimum, target, profile or maximum',
  'Publish every EVALUATED primary decision unchanged',
  'UNBOUNDED_ANALYSIS_OUTPUT',
  'Publisher ownership'
]) {
  assert.ok(text.includes(phrase), `scheduled report authority missing phrase: ${phrase}`);
}

assert.ok(!/hard maximum 9/i.test(text), 'scheduled report authority must not restore a hard nine-card ceiling');
assert.ok(!/report_card_target/.test(text), 'scheduled report authority must not resolve the retired report_card_target preference');
assert.ok(!/PASS cards may be curated/i.test(text), 'evaluated PASS decisions must not be hidden by card curation');
assert.ok(!/preselect an underdog/i.test(text) || text.includes('Never preselect an underdog'), 'underdog preselection must be prohibited');
assert.ok(text.includes('data/major-sport-market-coverage-v1.json'));
assert.ok(text.includes('BETTING_EDGE_MAJOR_SPORT_MARKET_COVERAGE.md'));
assert.ok(text.includes('NFL, NCAAF and CFL'));
assert.ok(text.includes('MLB, NHL, NBA/WNBA, NFL, NCAAF and CFL'));
assert.ok(text.includes('node tools/report-publication.mjs validate --report <report.json> --sidecar <sidecar.json>'));
assert.ok(text.includes('checked=0'));

console.log('SCHEDULED REPORT AUTHORITY TEST: PASS // ONE SHARED AUTHORITY + COMPLETE PRIMARY COVERAGE + PAUSED PROPS + UNBOUNDED CARD OUTPUT');

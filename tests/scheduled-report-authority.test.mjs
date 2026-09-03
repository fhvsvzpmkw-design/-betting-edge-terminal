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
  'Props are part of the major-sport sweep',
  'live-odds.events',
  'Pinnacle official sharp benchmark',
  'pre-freeze trace audit',
  'Walters engine',
  'Walters QB production read-back',
  'APPROVED_WALTERS_QB_PERFORMANCE',
  'FIRST_NFL_BEARING_BETTING_EDGE_READBACK',
  'soft**, not a hard ceiling',
  'Publisher ownership'
]) {
  assert.ok(text.includes(phrase), `scheduled report authority missing phrase: ${phrase}`);
}

assert.ok(!/hard maximum 9/i.test(text), 'scheduled report authority must not restore a hard nine-card ceiling');
assert.ok(!/preselect an underdog/i.test(text) || text.includes('Never preselect an underdog'), 'underdog preselection must be prohibited');
assert.ok(text.includes('data/major-sport-market-coverage-v1.json'));
assert.ok(text.includes('BETTING_EDGE_MAJOR_SPORT_MARKET_COVERAGE.md'));
assert.ok(text.includes('NFL, NCAAF and CFL'));
assert.ok(text.includes('MLB, NHL, NBA/WNBA, NFL, NCAAF and CFL'));

console.log('SCHEDULED REPORT AUTHORITY TEST: PASS // ONE SHARED AUTHORITY + COMPLETE PRIMARY/PROP COVERAGE + SOFT CARD TARGET');

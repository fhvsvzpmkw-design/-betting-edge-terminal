import assert from 'node:assert/strict';
import fs from 'node:fs';
import { auditReport, loadPolicy, selfTest } from '../tools/report-event-eligibility.mjs';

const policy = loadPolicy();
const synthetic = selfTest();
assert.equal(synthetic.state, 'PASS');
assert.equal(synthetic.cases, 6);

const fixturePath = 'data/history/runs/2026-09-01/late-181800.json';
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const audit = auditReport(fixture, policy);

assert.equal(fixture.recs.length, 7, '18:15 historical fixture must remain the issued seven-card report');
assert.equal(audit.total, 7);
assert.equal(audit.eligible.length, 3, 'same-day rule must retain the three Tuesday cards');
assert.equal(audit.violations.length, 4, 'same-day rule must exclude the four Wednesday cards');
assert.equal(audit.ok, false, 'historical fixture intentionally demonstrates what the new publisher would reject');
assert.deepEqual(
  [...new Set(audit.violations.map(v => v.code))],
  [policy.failureCodes.outsideReportDate],
  'all four excluded fixture cards must be next-day violations, not identity or timestamp failures'
);

const eligibleEventIds = audit.eligible.map(v => String(v.eventId)).sort();
assert.deepEqual(
  eligibleEventIds,
  ['63299319', '63301037', '63301565'].sort(),
  'eligible cards must be Cardinals-Dodgers, Yankees-Angels and Phillies-Diamondbacks'
);

console.log(JSON.stringify({
  state: 'PASS',
  policyId: policy.policyId,
  fixture: fixturePath,
  fixtureIssuedCards: 7,
  sameDayEligible: 3,
  nextDayExcluded: 4
}, null, 2));

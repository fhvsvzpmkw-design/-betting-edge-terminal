import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {formatOddsPapiUsage, readOddsPapiUsage} from '../tools/oddspapi-usage-summary.mjs';

const fixture = changes => ({budget: {
  schema: 1, requestLimit: 250, usedThisMonth: 155, remaining: 95,
  todayUsed: 5, todayLimit: 7, projectedMonthEnd: 217,
  pendingRequests: 0, unattributedToday: 0, externalUsageEstimatedToday: false,
  ...changes
}});

assert.equal(formatOddsPapiUsage(fixture()),
  'OddsPapi: 155/250 used this month · 95 remaining · today 5/7 · projected month-end 217/250');
assert.equal(formatOddsPapiUsage(fixture({usedThisMonth: 0, remaining: 250, todayUsed: 0, projectedMonthEnd: 0})),
  'OddsPapi: 0/250 used this month · 250 remaining · today 0/7 · projected month-end 0/250',
  'real zero usage and projection must remain visible');
assert.match(formatOddsPapiUsage(fixture({pendingRequests: 2, externalUsageEstimatedToday: true})),
  /155\/250 estimated used this month.*today 5\/7 \(estimated\)/,
  'locally attempted requests and unknown external timing cannot appear provider-reconciled');
assert.match(formatOddsPapiUsage(fixture({unattributedToday: 2})), /today 5\/7 \(estimated\)/);
assert.match(formatOddsPapiUsage(fixture({projectedMonthEnd: 217.2})), /projected month-end 218\/250$/);
assert.match(formatOddsPapiUsage(fixture({usedThisMonth: 251, remaining: 0, todayUsed: 8})),
  /251\/250 used this month · 0 remaining · today 8\/7/,
  'real over-limit usage must not be capped or hidden');
const unknown = formatOddsPapiUsage(fixture({remaining: null, todayUsed: null, projectedMonthEnd: null}));
assert.equal(unknown,
  'OddsPapi: 155/250 used this month · remaining unavailable · today unavailable · projected month-end unavailable');
for (const observer of [null, {}, {budget: []}, fixture({requestLimit: 0}), fixture({usedThisMonth: '155'}), fixture({usedThisMonth: -1})]) {
  assert.equal(formatOddsPapiUsage(observer), 'OddsPapi usage unavailable');
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'oddspapi-usage-summary-'));
try {
  const file = path.join(temp, 'observer.json');
  fs.writeFileSync(file, JSON.stringify(fixture()));
  assert.equal(readOddsPapiUsage(file), formatOddsPapiUsage(fixture()));
  const tool = path.resolve('tools/oddspapi-usage-summary.mjs');
  const valid = spawnSync(process.execPath, [tool, file], {encoding: 'utf8'});
  assert.equal(valid.status, 0);
  assert.equal(valid.stdout.trim(), formatOddsPapiUsage(fixture()));
  fs.writeFileSync(file, '{incomplete');
  for (const target of [file, path.join(temp, 'absent.json')]) {
    const result = spawnSync(process.execPath, [tool, target], {encoding: 'utf8'});
    assert.equal(result.status, 0, 'a diagnostic line cannot fail the odds workflow');
    assert.equal(result.stdout.trim(), 'OddsPapi usage unavailable');
    assert.equal(result.stderr, '');
  }
} finally {
  fs.rmSync(temp, {recursive: true, force: true});
}
console.log('ODDSPAPI USAGE SUMMARY: actual/estimated counts, zero/over-limit usage, honest unknowns and non-blocking saved-file CLI PASS');

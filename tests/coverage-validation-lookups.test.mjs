import assert from 'node:assert/strict';
import test from 'node:test';
import {localDateKey, evaluatedDecisionLookup} from '../tools/coverage-validation-lookups.mjs';

test('local dates retain timezone and daylight-saving boundaries', () => {
  for (const timeZone of ['America/Vancouver', 'UTC', 'America/Toronto']) {
    for (const timestamp of ['2026-10-19T00:30:00Z', '2026-03-08T10:30:00Z', '2026-11-01T09:30:00Z']) {
      const parts = new Intl.DateTimeFormat('en-CA', {timeZone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date(timestamp));
      const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
      assert.equal(localDateKey(timestamp, timeZone), `${values.year}-${values.month}-${values.day}`);
    }
  }
  assert.equal(localDateKey('not-a-date', 'America/Vancouver'), null);
  assert.throws(() => localDateKey('2026-10-19T00:30:00Z', 'not-a-timezone'), RangeError);
});

test('indexed receipt lookup preserves exact full-decision equality and duplicate-key matches', () => {
  const first = {feed:{selectionKey:'event|ml|home||'}, status:'LEAN', price:'+110', evidence:{finding:'original'}};
  const second = {...first, price:'+115'};
  const blocked = {...first, feed:{selectionKey:'event|ml|away||'}};
  const receipts = [{state:'EVALUATED', decision:first}, {state:'EVALUATED', decision:second}, {state:'BLOCKED', decision:blocked}];
  const lookup = evaluatedDecisionLookup(receipts);
  const reordered = {price:first.price, status:first.status, feed:first.feed, evidence:first.evidence};
  const cases = [first, second, blocked, {...first, evidence:{finding:'tampered'}}, {...first, status:'BET'}, reordered,
    {...first, feed:{selectionKey:'different|ml|home||'}}, {status:'PASS'}];
  for (const card of cases) {
    const previous = receipts.some(item => item.state === 'EVALUATED' && JSON.stringify(item.decision) === JSON.stringify(card));
    assert.equal(lookup(card), previous);
  }
  assert.equal(lookup(JSON.parse(JSON.stringify(second))), true);
  assert.equal(evaluatedDecisionLookup([])(first), false);
});

test('lookup is rebuilt for each validation and does not reuse changed receipt decisions', () => {
  const decision = {feed:{selectionKey:'event|ml|home||'}, status:'PASS'};
  const receipts = [{state:'EVALUATED', decision}];
  assert.equal(evaluatedDecisionLookup(receipts)({...decision}), true);
  decision.status = 'BET';
  const next = evaluatedDecisionLookup(receipts);
  assert.equal(next({...decision, status:'PASS'}), false);
  assert.equal(next({...decision}), true);
});

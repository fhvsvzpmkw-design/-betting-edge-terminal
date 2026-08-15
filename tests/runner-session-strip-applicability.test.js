const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'runner.html'), 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert(scriptMatch, 'runner.html script block not found');
const script = scriptMatch[1];
const start = script.indexOf('function sessionKey(');
const end = script.indexOf('function selectSession(', start);
assert(start >= 0 && end > start, 'runner session block not found');
const sessionSource = script.slice(start, end) + '\nglobalThis.__runnerSessionTest={sessionKey,sessionWindowApplicable,sessionRuns,newestSessionRun,SESSION_MINUTES};\n';

const FIXED_NOW = '2026-08-15T21:32:00Z'; // 14:32 America/Vancouver
class FixedDate extends Date {
  constructor(value) {
    super(arguments.length ? value : FIXED_NOW);
  }
  static now() { return new Date(FIXED_NOW).getTime(); }
  static parse(value) { return Date.parse(value); }
  static UTC(...args) { return Date.UTC(...args); }
}

let localHistory = [];
const context = {
  Date: FixedDate,
  Intl,
  String,
  Number,
  Array,
  Map,
  globalThis: null,
  localDateKey(ts) {
    const m = String(ts || '').match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  },
  safeHistory() { return localHistory; },
  runKey(run) { return [String(run.ts || ''), String(run.slot || ''), String(run.label || '')].join('|'); },
  normalizeRun(run) { return { ...run }; },
  withoutComparison(run) { return { ...run }; }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(sessionSource, context, { filename: 'runner.html' });
const { sessionWindowApplicable, sessionRuns, newestSessionRun } = context.__runnerSessionTest;

function assertSlots(nowIso, day, expected) {
  const now = new Date(nowIso);
  for (const [slot, wanted] of Object.entries(expected)) {
    assert.strictEqual(sessionWindowApplicable(slot, day, now), wanted, `${nowIso} ${day} ${slot}`);
  }
}

assertSlots('2026-08-15T21:32:00Z', '2026-08-15', {
  '06:00': true, '08:00': true, '09:30': true, '15:15': false, '18:15': false
});
assertSlots('2026-08-16T02:00:00Z', '2026-08-15', {
  '06:00': true, '08:00': true, '09:30': true, '15:15': true, '18:15': true
});
assertSlots('2026-08-15T12:30:00Z', '2026-08-15', {
  '06:00': false, '08:00': false, '09:30': false, '15:15': false, '18:15': false
});
assertSlots('2026-08-15T21:32:00Z', '2026-08-14', {
  '06:00': true, '08:00': true, '09:30': true, '15:15': true, '18:15': true
});
assertSlots('2026-08-15T21:32:00Z', '2026-08-16', {
  '06:00': false, '08:00': false, '09:30': false, '15:15': false, '18:15': false
});

const active = { slot: 'final_morning', label: 'FINAL MORNING', ts: '2026-08-15T09:30:00-07:00' };
localHistory = [
  { slot: 'open', label: 'OPEN', ts: '2026-08-15T06:00:00-07:00' },
  { slot: 'open', label: 'OPEN REPRICE', ts: '2026-08-15T06:08:00-07:00' },
  { slot: 'main', label: 'MAIN', ts: '2026-08-15T08:00:00-07:00' },
  { slot: 'evening', label: 'EVENING', ts: '2026-08-15T15:15:00-07:00' },
  { slot: 'late', label: 'LATE', ts: '2026-08-15T18:15:00-07:00' },
  { slot: 'main', label: 'YESTERDAY MAIN', ts: '2026-08-14T08:00:00-07:00' }
];

const sessionList = sessionRuns(active);
assert.strictEqual(
  JSON.stringify(Array.from(sessionList, x => `${x.slot}:${x.ts}`).sort()),
  JSON.stringify([
    'final_morning:2026-08-15T09:30:00-07:00',
    'main:2026-08-15T08:00:00-07:00',
    'open:2026-08-15T06:00:00-07:00',
    'open:2026-08-15T06:08:00-07:00'
  ].sort()),
  'same-day local history should exclude future slots and prior dates at 14:32 Vancouver time'
);

const newestOpen = newestSessionRun(active, '06:00');
assert(newestOpen, 'newest open session should exist');
assert.strictEqual(newestOpen.ts, '2026-08-15T06:08:00-07:00', 'latest snapshot must win within a session');
assert.strictEqual(newestSessionRun(active, '15:15'), null, 'future 15:15 session must remain unavailable');
assert.strictEqual(newestSessionRun(active, '18:15'), null, 'future 18:15 session must remain unavailable');

console.log('runner session strip applicability regression: PASS');

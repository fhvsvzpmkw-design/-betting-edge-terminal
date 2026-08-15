const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(require('path').join(__dirname, '..', 'r.html'), 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
assert(match, 'r.html script block not found');
const source = match[1].replace(/\nload\(\);\s*$/, '\nglobalThis.__runnerHistoryTest={sessionApplicable,sameDayPriorRuns,SLOT_MINUTES};\n');

const payloads = new Map();
const dummyElement = () => ({
  textContent: '',
  classList: { add() {} },
  addEventListener() {},
  style: {},
  src: ''
});
const context = {
  document: { getElementById: dummyElement },
  location: { search: '' },
  URLSearchParams,
  TextEncoder,
  Intl,
  Date,
  setTimeout,
  console,
  btoa: value => Buffer.from(value, 'binary').toString('base64'),
  fetch: async url => {
    const key = String(url).split('?')[0];
    if (!payloads.has(key)) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => payloads.get(key) };
  }
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'r.html' });
const { sessionApplicable, sameDayPriorRuns } = context.__runnerHistoryTest;

function assertSlots(nowIso, day, expected) {
  const now = new Date(nowIso);
  for (const [slot, wanted] of Object.entries(expected)) {
    assert.strictEqual(sessionApplicable(slot, day, now), wanted, `${nowIso} ${day} ${slot}`);
  }
}

assertSlots('2026-08-15T21:32:00Z', '2026-08-15', {
  open: true, main: true, final_morning: true, evening: false, late: false
});
assertSlots('2026-08-16T02:00:00Z', '2026-08-15', {
  open: true, main: true, final_morning: true, evening: true, late: true
});
assertSlots('2026-08-15T12:30:00Z', '2026-08-15', {
  open: false, main: false, final_morning: false, evening: false, late: false
});
assertSlots('2026-08-15T21:32:00Z', '2026-08-14', {
  open: true, main: true, final_morning: true, evening: true, late: true
});
assertSlots('2026-08-15T21:32:00Z', '2026-08-16', {
  open: false, main: false, final_morning: false, evening: false, late: false
});

const entries = [
  { slot: 'open', ts: '2026-08-15T06:00:00-07:00', path: 'runs/open-a.json' },
  { slot: 'open', ts: '2026-08-15T06:08:00-07:00', path: 'runs/open-b.json' },
  { slot: 'main', ts: '2026-08-15T08:00:00-07:00', path: 'runs/main.json' },
  { slot: 'final_morning', ts: '2026-08-15T09:30:00-07:00', path: 'runs/final.json' },
  { slot: 'evening', ts: '2026-08-15T15:15:00-07:00', path: 'runs/evening.json' },
  { slot: 'late', ts: '2026-08-15T18:15:00-07:00', path: 'runs/late.json' },
  { slot: 'main', ts: '2026-08-14T08:00:00-07:00', path: 'runs/yesterday.json' }
];
for (const entry of entries) {
  payloads.set('./' + entry.path, { slot: entry.slot, ts: entry.ts, label: entry.slot });
}

(async () => {
  const current = payloads.get('./runs/final.json');
  const afternoon = await sameDayPriorRuns({ runs: entries }, current, new Date('2026-08-15T21:32:00Z'));
  assert.strictEqual(
    JSON.stringify(Array.from(afternoon, x => `${x.slot}:${x.ts}`).sort()),
    JSON.stringify(['main:2026-08-15T08:00:00-07:00', 'open:2026-08-15T06:08:00-07:00'])
  );

  const evening = await sameDayPriorRuns({ runs: entries }, current, new Date('2026-08-16T02:00:00Z'));
  assert.strictEqual(
    JSON.stringify(Array.from(evening, x => x.slot).sort()),
    JSON.stringify(['evening', 'late', 'main', 'open'])
  );

  console.log('runner history applicability regression: PASS');
})().catch(error => {
  console.error(error);
  process.exit(1);
});

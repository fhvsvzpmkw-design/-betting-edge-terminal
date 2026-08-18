const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync(require('path').join(__dirname, '..', 'r.html'), 'utf8');
const contract = fs.readFileSync(require('path').join(__dirname, '..', 'BETTING_EDGE_CONTRACT.md'), 'utf8');

assert(contract.includes('## 6.1 Spread-lineage reconciliation when a tracked spread disappears'), 'spread-lineage reconciliation rule missing');
assert(contract.includes('same event and same side'), 'spread-lineage same-event/same-side identity rule missing');
assert(contract.includes('must **not** trigger an additional Odds-API request'), 'spread-lineage no-extra-API guard missing');
assert(contract.includes('`+10.5 -> +11.5`'), 'spread-lineage favorable-move example missing');
assert(contract.includes('`+10.5 -> +9.5`'), 'spread-lineage adverse-move example missing');
assert(contract.includes('Preserve the tracked spread recommendation on the current pregame report instead of silently dropping it.'), 'spread-lineage card-continuity rule missing');
assert(contract.includes('The current line must independently satisfy all ordinary identity, freshness, fair-value and staking gates before action'), 'spread-lineage independent-requalification rule missing');

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

  console.log('runner history + spread-lineage contract regression: PASS');
})().catch(error => {
  console.error(error);
  process.exit(1);
});

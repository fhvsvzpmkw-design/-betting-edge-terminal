import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

// Exercise exactly the production source extraction and Crypto overlay, while
// replacing filesystem/network/time. No credentials or live quota are used.
const source = fs.readFileSync('tools/odds-refresh-worker-source.yml', 'utf8');
const startMarker = "          node <<'NODE'\n";
const start = source.indexOf(startMarker) + startMarker.length;
const end = source.indexOf('\n          NODE\n', start);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'odds-worker-recovery-'));
let worker;
try {
  const target = path.join(temp, 'worker.js');
  fs.writeFileSync(target, source.slice(start, end).replace(/^          /gm, ''));
  execFileSync(process.execPath, ['tools/apply-crypto-watch-priority.mjs', target], { stdio: 'pipe' });
  worker = fs.readFileSync(target, 'utf8');
} finally { fs.rmSync(temp, { recursive: true, force: true }); }

const now = Date.parse('2026-09-05T22:00:00Z');
const stamp = minutes => new Date(now - minutes * 60000).toISOString();
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
function event(id, hours = 1, sport = 'baseball', league = 'MLB') {
  return { id: String(id), home: `Home ${id}`, away: `Away ${id}`, date: new Date(now + hours * 3600000).toISOString(), sport: { slug: sport }, league: { name: league } };
}
function market(name, age = 1, extra = {}) {
  return { name, updatedAt: stamp(age), odds: [{ ...(name === 'ML' ? {} : { hdp: name === 'Totals' ? 8.5 : -1.5 }), ...(name === 'Totals' ? { over: '1.90', under: '1.90' } : { home: '1.90', away: '1.90' }) }], ...extra };
}
function completeMarkets() { return ['ML', 'Spread', 'Totals'].map(name => market(name)); }

async function run({ candidates, main, supplemental, watches = [], multiFailures = 0 }) {
  const files = new Map([['data/crypto-fight-watch.json', JSON.stringify({ fights: watches })]]);
  const calls = [];
  const failures = [];
  const memoryFs = {
    existsSync: p => files.has(p),
    readFileSync: p => { if (!files.has(p)) throw Error(`Absent ${p}`); return files.get(p); },
    writeFileSync: (p, data) => files.set(p, data),
    renameSync: (from, to) => { files.set(to, files.get(from)); files.delete(from); },
    mkdirSync: () => {}
  };
  const context = vm.createContext({
    require: name => ({ fs: memoryFs, path, crypto })[name],
    process: { env: { ODDS_API_KEY: 'offline-test', EVENT_NAME: 'workflow_dispatch' }, exit: code => { throw Error(`Worker exit ${code}`); } },
    Date: FixedDate, URL, setTimeout: callback => callback(),
    console: { log() {}, warn() {}, error: (...args) => failures.push(args.join(' ')) },
    fetch: async raw => {
      const url = new URL(raw);
      calls.push(url);
      let data;
      if (url.pathname.endsWith('/sports')) data = [...new Set(candidates.map(e => e.sport.slug))].map(slug => ({ slug }));
      else if (url.pathname.endsWith('/events')) {
        const rows = candidates.filter(e => e.sport.slug === url.searchParams.get('sport'));
        const offset = (Number(url.searchParams.get('page')) - 1) * 200;
        data = rows.slice(offset, offset + 200);
      } else if (url.pathname.endsWith('/odds/multi')) {
        if (multiFailures-- > 0) return { ok: false, status: 503, statusText: 'Service Unavailable', text: async () => 'offline retry-budget fixture' };
        const ids = url.searchParams.get('eventIds').split(',');
        const book = url.searchParams.get('bookmakers');
        data = candidates.filter(e => ids.includes(e.id)).map(e => main(e, book)).filter(Boolean);
      } else if (url.pathname.endsWith('/odds')) {
        const candidate = candidates.find(e => e.id === url.searchParams.get('eventId'));
        data = supplemental(candidate);
      } else throw Error(`Unexpected endpoint ${url.pathname}`);
      return { ok: true, json: async () => structuredClone(data) };
    }
  });
  await vm.runInContext(worker, context);
  assert.ok(files.has('data/live-odds.json'), `Worker did not publish: ${failures.join('; ')}`);
  return { feed: JSON.parse(files.get('data/live-odds.json')), calls };
}

const cases = [event('recover', 5), event('incomplete', 4), event('stale', 3), event('missing', 2), ...Array.from({ length: 7 }, (_, i) => event(`complete-${i}`, 0.5))];
const watched = event('fight', 20, 'boxing', 'Boxing');
cases.push(watched);
const watch = { id: 'test-watch', fighterA: watched.home, fighterB: watched.away, eventStartPt: watched.date, priority: 'MAIN' };
const result = await run({
  candidates: cases,
  watches: [watch],
  main: (e, book) => {
    if (e.id === 'missing') return null;
    let markets = completeMarkets();
    if (e.id === 'recover') markets = [market('ML'), market('Spread', 35)];
    if (e.id === 'incomplete') markets = [market('ML', 5), market('Spread', 35), market('Totals', 5)];
    if (e.id === 'stale') markets = [market('ML'), market('Spread', 100), market('Totals', 120)];
    markets.push(market('Player Props', 1, { odds: [{ label: 'Player A', over: '2.00' }] }));
    markets.push(market('Player Props', 1, { odds: [{ label: 'Player B', over: '2.00' }] }));
    return { ...e, bookmakers: { [book]: markets } };
  },
  supplemental: e => {
    if (e.id === 'missing') return null;
    if (e.id === 'stale') return { ...e, home: 'Wrong team', bookmakers: { Bet365: completeMarkets() } };
    if (e.id === 'recover') return { ...e, bookmakers: { Bet365: [market('ML', 20), market('Spread', 1, { odds: [{ hdp: -4, home: '1.91', away: '1.91' }] }), market('Totals')] } };
    if (e.id === 'incomplete') return { ...e, bookmakers: Object.fromEntries(['Bet365', 'DraftKings'].map(book => [book, [market('ML', 1, { odds: [{ home: '1.80' }] }), market('Spread', 1, { status: 'suspended' }), market('Totals', 1, { odds: [] })]])) };
    return { ...e, bookmakers: { Bet365: completeMarkets() } };
  }
});
const supplementIds = result.calls.filter(url => url.pathname.endsWith('/odds')).map(url => url.searchParams.get('eventId'));
assert.equal(supplementIds.length, 6, 'supplemental request ceiling remains six');
assert.equal(supplementIds[0], 'fight', 'Crypto exact fight watch must retain precedence and 30-hour horizon');
for (const id of ['recover', 'incomplete', 'stale', 'missing']) assert.ok(supplementIds.includes(id), `gap ${id} must outrank complete urgent events`);
const repaired = result.feed.events.find(e => e.id === 'recover');
assert.equal(repaired.bookmakers.Bet365.find(m => m.name === 'ML').updatedAt, stamp(1), 'older supplement cannot downgrade newer primary');
assert.equal(repaired.bookmakers.Bet365.find(m => m.name === 'Spread').odds[0].hdp, -4);
assert.equal(repaired.bookmakers.Bet365.find(m => m.name === 'Totals').odds.length, 1);
assert.equal(repaired.bookmakers.Bet365.filter(m => m.name === 'Player Props').length, 2, 'all duplicate-named props survive primary recovery');
assert.equal(repaired.bookmakers.Bet365.find(m => m.name === 'Spread').odds[0].selectionKeys.home, 'recover|spread|home||-4');
const incomplete = result.feed.events.find(e => e.id === 'incomplete');
assert.equal(incomplete.bookmakers.Bet365.find(m => m.name === 'ML').odds[0].away, undefined, 'newer missing side must not resurrect older executable quote');
const availability = new Map(result.feed.diagnostics.coreMarketAvailability.map(e => [e.eventId, e]));
assert.equal(availability.get('incomplete').markets.ml.available, false);
assert.equal(availability.get('incomplete').markets.ml.books.Bet365, 'INCOMPLETE');
assert.equal(availability.get('incomplete').markets.spread.books.Bet365, 'SUSPENDED');
assert.equal(incomplete.bookmakers.Bet365.find(m => m.name === 'Spread').odds.length, 0, 'suspended snapshot must not expose previously priced sides');
assert.equal(incomplete.bookmakers.Bet365.find(m => m.name === 'Totals').odds.length, 0, 'empty incoming snapshot must remain unavailable');
assert.equal(availability.get('stale').markets.spread.books.Bet365, 'STALE_BEYOND_RETENTION');
assert.equal(availability.get('stale').markets.spread.updatedAtByBook.Bet365, stamp(100));
assert.equal(availability.get('missing').acquisition.Bet365, 'EVENT_NOT_RETURNED');
assert.equal(availability.get('missing').markets.ml.books.Bet365, 'NOT_RETURNED');
assert.equal(result.feed.diagnostics.identityRejects, 1);
assert.equal(result.feed.diagnostics.coreRecovery.results.find(e => e.eventId === 'missing').outcome, 'EVENT_NOT_RETURNED');
assert.equal(result.feed.diagnostics.coreRecovery.results.find(e => e.eventId === 'stale').outcome, 'IDENTITY_REJECTED');
assert.equal(result.feed.diagnostics.coreRecovery.results.length, result.feed.diagnostics.coreRecovery.eventsChecked);
assert.ok(!result.feed.events.find(e => e.id === 'stale').bookmakers.Bet365.some(m => m.name === 'Spread'), 'stale primary remains discarded');
assert.equal(result.feed.diagnostics.coreRecovery.results.find(e => e.eventId === 'recover').recovered.length, 2);
assert.ok(result.feed.requestsUsed <= 90);
assert.equal(result.feed.maxMarketAgeMinutes, 90);
assert.equal(result.feed.requestPolicy.coreQuoteMaxAgeMinutes, 30);

const ambiguous = await run({
  candidates: [event('ambiguous')],
  main: (e, book) => ({ ...e, bookmakers: { [book]: [market('ML'), market('Totals'), market('Spread', 1, { odds: [{ hdp: -2, home: '1.90', away: '1.90' }, { hdp: -3, home: '1.90', away: '1.90' }] })] } }),
  supplemental: e => ({ ...e, bookmakers: { Bet365: completeMarkets() } })
});
assert.equal(ambiguous.feed.diagnostics.coreRecovery.results[0].before.spread.books.Bet365, 'PRIMARY_LINE_UNRESOLVED');
assert.deepEqual(ambiguous.feed.diagnostics.coreRecovery.results[0].recovered, ['spread']);

const duplicates = await run({
  candidates: [event('duplicate-a'), event('duplicate-b')],
  main: (e, book) => ({ ...e, bookmakers: { [book]: completeMarkets() } }),
  supplemental: e => ({ ...e, bookmakers: { Bet365: [...completeMarkets(), market('Player Props', 1, { odds: [{ label: 'Identical suspicious player payload', over: '2.00' }] })] } })
});
assert.equal(duplicates.feed.diagnostics.duplicateDeepRejects, 2);
assert.equal(duplicates.feed.deepMarkets.length, 0);
assert.ok(duplicates.feed.events.every(e => Object.values(e.bookmakers).every(markets => markets.every(m => m.name !== 'Player Props'))), 'quarantined supplemental props must never leak through primary events');

// A large board must preserve both the hard ceiling and unattempted manifest
// entries instead of claiming every selected game was actually pulled.
const board = Array.from({ length: 340 }, (_, i) => event(`large-${i}`, 1 + i / 500));
const budget = await run({
  candidates: board,
  multiFailures: 16,
  main: (e, book) => ({ ...e, bookmakers: { [book]: completeMarkets() } }),
  supplemental: e => ({ ...e, bookmakers: { Bet365: completeMarkets() } })
});
assert.ok(budget.feed.requestsUsed <= 90);
assert.ok(budget.calls.filter(url => url.pathname.endsWith('/odds')).length <= 6);
assert.equal(budget.feed.diagnostics.coreMarketAvailability.length, 340);
assert.ok(budget.feed.diagnostics.coreMarketAvailability.some(row => Object.values(row.acquisition).includes('NOT_ATTEMPTED_BUDGET')), 'unattempted selected games must remain explicitly visible');
assert.ok(budget.feed.diagnostics.coreMarketAvailability.some(row => Object.values(row.acquisition).includes('REQUEST_FAILED')), 'failed batches must remain explicitly visible');
assert.equal(budget.feed.requestsUsed, budget.calls.length);

console.log('ODDS WORKER CORE RECOVERY: PASS // production Crypto overlay, six-call recovery, timestamp-safe primary merge, shared props retention, missing/stale receipts, quota ceiling');

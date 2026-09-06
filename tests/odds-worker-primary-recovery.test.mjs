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
function event(id, hours = 1, sport = 'baseball', league = 'MLB') {
  return { id: String(id), home: `Home ${id}`, away: `Away ${id}`, date: new Date(now + hours * 3600000).toISOString(), sport: { slug: sport }, league: { name: league } };
}
function market(name, age = 1, extra = {}) {
  return { name, updatedAt: stamp(age), odds: [{ ...(name === 'ML' ? {} : { hdp: name === 'Totals' ? 8.5 : -1.5 }), ...(name === 'Totals' ? { over: '1.90', under: '1.90' } : { home: '1.90', away: '1.90' }) }], ...extra };
}
function completeMarkets() { return ['ML', 'Spread', 'Totals'].map(name => market(name)); }

async function run({ candidates, main, supplemental, watches = [], multiFailures = 0, requestStepMs = 1000, extraMulti = () => [] }) {
  let clock = now;
  class ReceiptDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock])); }
    static now() { return clock; }
  }
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
    Date: ReceiptDate, URL, setTimeout: callback => callback(),
    console: { log() {}, warn() {}, error: (...args) => failures.push(args.join(' ')) },
    fetch: async raw => {
      const url = new URL(raw);
      calls.push(url);
      clock += requestStepMs;
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
        data = candidates.filter(e => ids.includes(e.id)).map(e => main(e, book)).filter(Boolean).concat(extraMulti(ids, book));
      } else if (url.pathname.endsWith('/odds')) {
        const candidate = candidates.find(e => e.id === url.searchParams.get('eventId'));
        data = supplemental(candidate);
        if (data instanceof Error) throw data;
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
    if (e.id === 'incomplete') markets = [market('ML', 5, { odds: [{ home: '1.80' }] }), market('Spread', 35), market('Totals', 5)];
    if (e.id === 'stale') markets = [market('ML'), market('Spread', 100), market('Totals', 120, { odds: [] })];
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
assert.equal(repaired.bookmakers.Bet365.find(m => m.name === 'ML').updatedAt, stamp(20), 'latest observation wins without rewriting the original provider change timestamp');
assert.equal(repaired.bookmakers.Bet365.find(m => m.name === 'Spread').odds[0].hdp, -4);
assert.equal(repaired.bookmakers.Bet365.find(m => m.name === 'Totals').odds.length, 1);
assert.equal(repaired.bookmakers.Bet365.filter(m => m.name === 'Player Props').length, 0, 'props omitted by a later full response must not survive from earlier core data');
assert.equal(repaired.bookmakers.DraftKings, undefined, 'book omitted by later successful full requested-book response must not resurrect');
assert.equal(repaired.bookmakers.Bet365.find(m => m.name === 'Spread').odds[0].selectionKeys.home, 'recover|spread|home||-4');
const incomplete = result.feed.events.find(e => e.id === 'incomplete');
assert.equal(incomplete.bookmakers.Bet365.find(m => m.name === 'ML').odds[0].away, undefined, 'newer missing side must not resurrect older executable quote');
const availability = new Map(result.feed.diagnostics.coreMarketAvailability.map(e => [e.eventId, e]));
assert.equal(availability.get('incomplete').markets.ml.available, false);
assert.equal(availability.get('incomplete').markets.ml.books.Bet365, 'INCOMPLETE');
assert.equal(availability.get('incomplete').markets.spread.books.Bet365, 'SUSPENDED');
assert.equal(incomplete.bookmakers.Bet365.find(m => m.name === 'Spread').odds.length, 0, 'suspended snapshot must not expose previously priced sides');
assert.equal(incomplete.bookmakers.Bet365.find(m => m.name === 'Totals').odds.length, 0, 'empty incoming snapshot must remain unavailable');
assert.equal(availability.get('stale').markets.spread.books.Bet365, 'AVAILABLE', 'an unchanged old provider price remains fresh when just returned');
assert.equal(availability.get('stale').markets.spread.updatedAtByBook.Bet365, stamp(100));
assert.equal(availability.get('missing').acquisition.Bet365, 'EVENT_NOT_RETURNED');
assert.equal(availability.get('missing').markets.ml.books.Bet365, 'NOT_RETURNED');
assert.equal(result.feed.diagnostics.identityRejects, 1);
assert.equal(result.feed.diagnostics.coreRecovery.results.find(e => e.eventId === 'missing').outcome, 'EVENT_NOT_RETURNED');
assert.equal(result.feed.diagnostics.coreRecovery.results.find(e => e.eventId === 'stale').outcome, 'IDENTITY_REJECTED');
assert.equal(result.feed.diagnostics.coreRecovery.results.length, result.feed.diagnostics.coreRecovery.eventsChecked);
assert.ok(result.feed.events.find(e => e.id === 'stale').bookmakers.Bet365.some(m => m.name === 'Spread'), 'old last-change timestamp no longer discards a fresh observation');
assert.equal(result.feed.diagnostics.coreRecovery.results.find(e => e.eventId === 'recover').recovered.length, 1);
assert.equal(result.feed.quoteObservationVersion, 1);
assert.equal(result.feed.collectionStartedAt, new Date(now).toISOString());
assert.ok(Date.parse(result.feed.generatedAt) > now, 'snapshot timestamp is collection completion, not its start');
for (const event of [...result.feed.events, ...result.feed.deepMarkets, ...result.feed.baseballProps]) {
  for (const markets of Object.values(event.bookmakers)) {
    for (const market of markets) {
      assert.ok(Date.parse(market.observedAt) > now);
      assert.ok(Date.parse(market.observedAt) <= Date.parse(result.feed.generatedAt));
    }
  }
}
assert.equal(availability.get('stale').markets.spread.observedAtByBook.Bet365, result.feed.events.find(e => e.id === 'stale').bookmakers.Bet365.find(m => m.name === 'Spread').observedAt);
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

const unchanged = await run({
  candidates: [event('unchanged', 20)],
  main: (e, book) => ({ ...e, bookmakers: { [book]: [market('ML', 240, { observedAt: '2099-01-01T00:00:00Z' }), market('Player Props', 300, { odds: [{ label: 'Player A', over: '2.00' }] }), market('Player Props', 300, { odds: [{ label: 'Player B', over: '2.00' }] })] } }),
  supplemental: () => { throw Error('Outside supplemental horizon'); }
});
assert.equal(unchanged.calls.filter(url => url.pathname.endsWith('/odds')).length, 0);
assert.equal(unchanged.feed.events[0].bookmakers.Bet365[0].updatedAt, stamp(240));
assert.equal(unchanged.feed.events[0].bookmakers.Bet365[0].observedAt, new Date(now + 3000).toISOString(), 'only local receipt time is trusted, not provider-supplied observedAt');
assert.equal(unchanged.feed.events[0].bookmakers.Bet365.filter(m => m.name === 'Player Props').length, 2, 'broad core props are independently retained, including duplicate market names');
assert.equal(unchanged.feed.diagnostics.coreMarketAvailability[0].markets.ml.books.Bet365, 'AVAILABLE');
assert.equal(unchanged.feed.diagnostics.staleMarketsRemoved, 0);

const omitted = await run({
  candidates: [event('omitted')],
  main: (e, book) => ({ ...e, bookmakers: { [book]: completeMarkets() } }),
  supplemental: e => ({ ...e, bookmakers: { Bet365: [market('ML', 240)] } })
});
assert.deepEqual(omitted.feed.events[0].bookmakers.Bet365.map(m => m.name), ['ML']);
assert.equal(omitted.feed.events[0].bookmakers.DraftKings, undefined);
assert.equal(omitted.feed.diagnostics.coreMarketAvailability[0].markets.spread.books.Bet365, 'NOT_RETURNED', 'omitted latest full-response market is not recovered from earlier priced snapshot');
assert.equal(omitted.feed.events[0].bookmakerObservedAt.DraftKings, new Date(now + 5000).toISOString(), 'absent requested book retains authoritative full-scope receipt');

const withdrawn = await run({
  candidates: [event('withdrawn')],
  main: (e, book) => ({ ...e, bookmakers: { [book]: completeMarkets() } }),
  supplemental: e => ({ ...e, bookmakers: {} })
});
assert.equal(withdrawn.feed.events.length, 1, 'retain full-response scope tombstones even when no priced markets remain');
assert.deepEqual(withdrawn.feed.events[0].bookmakers, {});
assert.deepEqual(withdrawn.feed.events[0].bookmakerObservedAt, {
  Bet365: new Date(now + 5000).toISOString(), DraftKings: new Date(now + 5000).toISOString()
});
assert.equal(withdrawn.feed.diagnostics.mainOddsEvents, 0);
assert.equal(withdrawn.feed.diagnostics.coreMarketAvailability[0].markets.ml.books.Bet365, 'NOT_RETURNED');

await assert.rejects(run({
  candidates: [event('all-failed')], multiFailures: 999,
  main: () => { throw Error('Failed request must not reach payload fixture'); },
  supplemental: () => new Error('offline all requests failed')
}), /Worker exit 1/, 'all-failed refresh cannot publish a fresh empty feed without authoritative response scopes');

const partial = await run({
  candidates: [event('partial')],
  main: (e, book) => ({ ...e, bookmakers: { [book]: completeMarkets() } }),
  supplemental: e => ({ ...e, partial: true, bookmakers: { Bet365: [market('ML', 240)] } })
});
const partialEvent = partial.feed.events[0];
assert.equal(partialEvent.bookmakers.Bet365.find(m => m.name === 'ML').observedAt, new Date(now + 5000).toISOString());
assert.equal(partialEvent.bookmakers.Bet365.find(m => m.name === 'Spread').observedAt, new Date(now + 3000).toISOString(), 'partial response must not restamp absent spread');
assert.equal(partialEvent.bookmakers.DraftKings[0].observedAt, new Date(now + 4000).toISOString(), 'partial response must not restamp absent book');
assert.equal(partialEvent.bookmakerObservedAt.Bet365, new Date(now + 3000).toISOString(), 'partial response cannot claim full-book authority');

const failed = await run({
  candidates: [event('failed')],
  main: (e, book) => ({ ...e, bookmakers: { [book]: completeMarkets() } }),
  supplemental: () => new Error('offline supplemental failure')
});
assert.equal(failed.feed.events[0].bookmakers.Bet365[0].observedAt, new Date(now + 3000).toISOString(), 'failed request cannot restamp retained core quotes');
assert.equal(failed.feed.events[0].bookmakerObservedAt.Bet365, new Date(now + 3000).toISOString());
assert.equal(failed.feed.diagnostics.coreRecovery.results[0].outcome, 'REQUEST_FAILED');

const unavailable = await run({
  candidates: [event('inactive-markets'), event('inactive-rows'), event('inactive-event')],
  main: (e, book) => ({ ...e, ...(e.id === 'inactive-event' ? { state: 'disabled' } : {}), bookmakers: { [book]: e.id === 'inactive-markets'
    ? [market('ML', 1, { active: false }), market('Spread', 1, { isActive: false }), market('Totals', 1, { state: 'unavailable' })]
    : e.id === 'inactive-rows'
      ? [market('ML', 1, { odds: [{ home: '1.90', away: '1.90', active: false }] }), market('Spread', 1, { odds: [{ hdp: -1.5, home: '1.90', away: '1.90', state: 'cancelled' }] }), market('Totals')]
      : completeMarkets()
  } }),
  supplemental: () => new Error('retain unavailable primary observations')
});
const unavailableRows = new Map(unavailable.feed.diagnostics.coreMarketAvailability.map(row => [row.eventId, row]));
for (const key of ['ml', 'spread', 'totals']) {
  assert.equal(unavailableRows.get('inactive-markets').markets[key].books.Bet365, 'SUSPENDED');
  assert.equal(unavailableRows.get('inactive-event').markets[key].books.Bet365, 'SUSPENDED');
}
assert.equal(unavailableRows.get('inactive-rows').markets.ml.books.Bet365, 'INCOMPLETE', 'inactive row cannot supply a priced primary side');
assert.equal(unavailableRows.get('inactive-rows').markets.spread.books.Bet365, 'INCOMPLETE', 'cancelled row cannot supply a priced primary line');
assert.ok(unavailable.feed.events.filter(e => e.id !== 'inactive-rows').every(e => Object.values(e.bookmakers).every(markets => markets.every(m => m.odds.length === 0))));

// A provider must not turn a selected-but-unrequested event into a fresh quote
// for the current batch. It may only be observed when its own batch is fetched.
const isolatedBoard = Array.from({ length: 11 }, (_, i) => event(`scope-${String(i).padStart(2, '0')}`, 20 + i / 100));
const outside = isolatedBoard[10];
const outsideScope = await run({
  candidates: isolatedBoard,
  main: (e, book) => e.id === outside.id ? null : ({ ...e, bookmakers: { [book]: completeMarkets() } }),
  extraMulti: (ids, book) => ids.includes(outside.id) ? [] : [{ ...outside, bookmakers: { [book]: completeMarkets() } }],
  supplemental: () => { throw Error('Outside supplemental horizon'); }
});
assert.equal(outsideScope.feed.diagnostics.identityRejects, 2, 'wrong-batch ID rejected once per requested book');
assert.deepEqual(outsideScope.feed.events.find(e => e.id === outside.id).bookmakers, {}, 'out-of-batch price must never be observed');

// A quote can genuinely age while collection is still running. Eligibility
// and retention use that original receipt, even with a recent price-change time.
const aging = await run({
  candidates: [event('aging', 20)], requestStepMs: 91 * 60000,
  main: (e, book) => ({ ...e, bookmakers: { [book]: completeMarkets() } }),
  supplemental: () => { throw Error('Outside supplemental horizon'); }
});
assert.equal(aging.feed.diagnostics.coreMarketAvailability[0].markets.ml.books.Bet365, 'STALE_BEYOND_RETENTION');
assert.equal(aging.feed.events[0].bookmakers.Bet365, undefined);
assert.equal(aging.feed.events[0].bookmakers.DraftKings[0].updatedAt, stamp(1));
assert.equal(aging.feed.diagnostics.removedMarkets.length, 3);
assert.equal(aging.feed.diagnostics.removedMarkets[0].reason, 'STALE_BEYOND_RETENTION');
assert.equal(aging.feed.diagnostics.removedMarkets[0].observedAt, new Date(now + 273 * 60000).toISOString());

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

console.log('ODDS WORKER CORE RECOVERY: PASS // production Crypto overlay, local observation timestamps, old unchanged prices, complete/partial/failure receipts, omission/suspension, real retention age, quota ceiling');

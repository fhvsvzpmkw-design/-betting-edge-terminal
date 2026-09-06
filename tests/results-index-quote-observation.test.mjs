import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../tools/build-results-index.mjs', import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'results-observation-'));
const entries = [];
const cases = [];
const oldChange = '2026-09-06T07:00:00Z';
const write = (file, value) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), JSON.stringify(value));
};
function add(name, mutate = () => {}, { legacy = false, cached = null } = {}) {
  const n = cases.length;
  const generatedAt = new Date(Date.parse('2026-09-06T16:30:00Z') + n * 60000).toISOString();
  const observedAt = new Date(Date.parse(generatedAt) - 60000).toISOString();
  const selectionKey = `${name}|ml|home||`;
  const market = { marketKey: 'ml', updatedAt: oldChange, observedAt,
    odds: [{ home: '1.95', away: '2.05', selectionKeys: { home: selectionKey, away: `${name}|ml|away||` } }] };
  const feed = { generatedAt, quoteObservationVersion: 1,
    collectionStartedAt: new Date(Date.parse(generatedAt) - 120000).toISOString(),
    events: [{ id: name, bookmakers: { Bet365: [market] } }] };
  if (legacy) { delete feed.quoteObservationVersion; delete feed.collectionStartedAt; delete market.observedAt; }
  mutate(feed, market);
  const blob = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: root, input: JSON.stringify(feed), encoding: 'utf8' }).trim();
  entries.push({ generatedAt, snapshotBlobSha: blob });
  const sourceRun = `data/history/runs/2026-09-06/${name}.json`;
  write(sourceRun, { ts: generatedAt, slot: 'evening', feedGeneratedAt: generatedAt,
    recs: [{ title: name, status: 'PASS', book: 'Bet365', feed: { eventId: name, marketKey: 'ml', side: 'home', selectionKey } }] });
  write(`data/history/observations/2026-09-06/${name}.json`, {
    kind: 'issued-card-observations', sourceRun, recommendations: [{
      issued: cached, completion: { state: 'complete', grade: 'WIN' }
    }]
  });
  const record = { name, generatedAt, observedAt, blob };
  cases.push(record);
  return record;
}

try {
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  const fresh = add('fresh-unchanged');
  add('stale-observation', (feed, market) => { market.observedAt = new Date(Date.parse(feed.generatedAt) - 31 * 60000).toISOString(); });
  add('missing-observation', (feed, market) => { delete market.observedAt; market.updatedAt = feed.generatedAt; });
  add('invalid-observation', (feed, market) => { market.observedAt = 'invalid'; market.updatedAt = feed.generatedAt; });
  add('future-observation', (feed, market) => { market.observedAt = new Date(Date.parse(feed.generatedAt) + 1).toISOString(); });
  add('unknown-version', feed => { feed.quoteObservationVersion = 2; });
  add('latest-missing-side', (feed, market) => {
    const newer = structuredClone(market);
    newer.observedAt = feed.generatedAt;
    newer.odds = [{ away: '2.05', selectionKeys: { away: 'latest-missing-side|ml|away||' } }];
    feed.events[0].bookmakers.Bet365.push(newer);
  });
  add('latest-suspended', (feed, market) => {
    feed.events[0].bookmakers.Bet365.push({ ...structuredClone(market), observedAt: feed.generatedAt, suspended: true });
  });
  add('suspended-row', (feed, market) => { market.odds[0].suspended = true; });
  add('removed-book-scope', feed => {
    feed.deepMarkets = [{ id: 'removed-book-scope', bookmakerObservedAt: { Bet365: feed.generatedAt }, bookmakers: { Bet365: [] } }];
  });
  add('newest-invalid', (feed, market) => {
    feed.events[0].bookmakers.Bet365.push({ ...structuredClone(market), observedAt: 'invalid' });
  });
  add('tied-conflict', (feed, market) => {
    const duplicate = structuredClone(market);
    duplicate.odds[0].home = '2.30';
    feed.events[0].bookmakers.Bet365.push(duplicate);
  });
  const changed = add('latest-real-change', (feed, market) => {
    const newer = structuredClone(market);
    newer.observedAt = feed.generatedAt;
    newer.updatedAt = new Date(Date.parse(feed.generatedAt) - 30000).toISOString();
    newer.odds[0].home = '2.20';
    feed.events[0].bookmakers.Bet365.push(newer);
  });
  const legacy = add('legacy-fresh', (feed, market) => { market.updatedAt = feed.generatedAt; }, { legacy: true });
  add('legacy-stale', () => {}, { legacy: true });
  add('legacy-old-fallback', (feed, market) => {
    market.updatedAt = new Date(Date.parse(feed.generatedAt) - 60000).toISOString();
    feed.events[0].bookmakers.Bet365.push({ marketKey: 'ml', updatedAt: feed.generatedAt, odds: [] });
  }, { legacy: true });
  add('cached-observation', () => {}, { cached: {
    analysisPriceState: 'exact', analysisPriceDecimal: 2.10, analysisPriceAmerican: 110,
    analysisBook: 'Bet365', analysisBookKey: 'bet365', analysisQuoteUpdatedAt: oldChange,
    analysisQuoteObservedAt: '2026-09-06T16:45:00Z', analysisSnapshotBlobSha: 'a'.repeat(40)
  } });
  add('cached-legacy', () => {}, { cached: {
    analysisPriceState: 'exact', analysisPriceDecimal: 2.10, analysisPriceAmerican: 110,
    analysisBook: 'Bet365', analysisBookKey: 'bet365', analysisQuoteUpdatedAt: oldChange,
    analysisSnapshotBlobSha: 'b'.repeat(40)
  } });

  write('data/history/odds-index.json', { entries });
  execFileSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  const result = JSON.parse(fs.readFileSync(path.join(root, 'data/history/results-index.json'), 'utf8'));
  const byName = new Map(result.cards.map(card => [card.title, card]));
  assert.equal(byName.size, cases.length);
  assert.deepEqual(byName.get(fresh.name).analysisPrice, {
    state: 'exact', decimal: 1.95, american: -105, book: 'Bet365', bookKey: 'bet365',
    quoteUpdatedAt: oldChange, quoteObservedAt: fresh.observedAt,
    snapshotBlobSha: fresh.blob, source: 'immutable-issued-snapshot'
  });
  for (const name of ['stale-observation', 'missing-observation', 'invalid-observation', 'future-observation',
    'unknown-version', 'latest-missing-side', 'latest-suspended', 'suspended-row', 'removed-book-scope',
    'newest-invalid', 'tied-conflict', 'legacy-stale']) {
    assert.equal(byName.get(name).analysisPrice.state, 'unavailable', name);
    assert.equal(byName.get(name).units, null, `${name} must not contribute invented priced performance`);
  }
  assert.equal(byName.get(changed.name).analysisPrice.decimal, 2.20);
  assert.equal(byName.get(changed.name).analysisPrice.quoteObservedAt, changed.generatedAt);
  assert.equal(byName.get(changed.name).analysisPrice.quoteUpdatedAt, new Date(Date.parse(changed.generatedAt) - 30000).toISOString());
  assert.deepEqual(byName.get(legacy.name).analysisPrice, {
    state: 'exact', decimal: 1.95, american: -105, book: 'Bet365', bookKey: 'bet365',
    quoteUpdatedAt: legacy.generatedAt, snapshotBlobSha: legacy.blob, source: 'immutable-issued-snapshot'
  });
  assert.equal(byName.get('legacy-old-fallback').analysisPrice.state, 'exact', 'historical legacy interpretation is retained');
  assert.equal(byName.get('cached-observation').analysisPrice.quoteObservedAt, '2026-09-06T16:45:00Z');
  assert.ok(!Object.hasOwn(byName.get('cached-legacy').analysisPrice, 'quoteObservedAt'));
  assert.equal(result.priceAnalytics.pricedCards, 6);
  console.log('RESULTS INDEX OBSERVATION TEST: PASS // exact clocks, latest scope, immutable provenance and legacy shape');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('tools/odds-refresh-worker-source.yml', 'utf8');

// The broad core pull must remain the primary acquisition path and must not
// request only a hard-coded subset of market names.
assert.ok(source.includes("apiUrl('/odds/multi', { eventIds, bookmakers: bookmaker })"), 'missing broad /odds/multi acquisition');

// Freshness filtering on the primary events collection must operate on every
// returned market, rather than whitelisting ML/spread/total and discarding props.
assert.ok(source.includes('function filterFreshMarketsFromEvent(event, now, diagnostics)'), 'missing fresh-market event filter');
assert.ok(source.includes('const fresh = markets.filter(market => {'), 'primary event filter must iterate all markets');
assert.ok(source.includes('marketAgeMinutes(market, now) <= MAX_MARKET_AGE_MINUTES'), 'primary event market filter must be freshness based');
assert.ok(source.includes('Date.parse(market?.observedAt)'), 'market retention must measure successful observation age');
assert.ok(source.includes('quoteObservationVersion: 1'), 'new feeds must declare observation provenance');
assert.ok(source.includes('collectionStartedAt: now.toISOString()'), 'collector must preserve collection start separately from completion');
assert.ok(source.includes('snapshot.generatedAt = completedAt.toISOString()'), 'snapshot date must represent completed collection');

// Canonical identity must be applied to the complete primary event collection.
assert.ok(source.includes('snapshot.events = snapshot.events.map(enrichIdentity);'), 'primary events must receive canonical identity');

// Deep collections are supplemental. Keep the existing deep queue, but never
// make it the only path by which props can survive into the bound snapshot.
assert.ok(source.includes('snapshot.deepMarkets = snapshot.deepMarkets.map(enrichIdentity);'), 'deep market identity missing');
assert.ok(source.includes('snapshot.baseballProps = snapshot.baseballProps.map(enrichIdentity);'), 'baseball prop identity missing');
assert.ok(source.includes('snapshot.events'), 'primary events collection missing');

// Protect the major-league deep recognizer as a secondary discovery aid across
// MLB/NHL/NBA/WNBA/NFL/NCAAF/CFL rather than baseball only.
assert.ok(source.includes('function propEligible(event)'), 'prop eligibility helper missing');
assert.ok(source.includes('return isMajorLeague(event);'), 'deep prop eligibility must remain major-league aware');
for (const token of ['MLB', 'NHL', 'NBA', 'WNBA', 'NFL', 'NCAAF', 'CFL']) {
  assert.ok(source.includes(token), `worker source missing major-sport token ${token}`);
}

// The normal event payload is deliberately broader than the deep 8-hour queue.
// This protects against a future regression that mistakenly treats deepMarkets
// as the sole prop source.
const mainMapIndex = source.indexOf('snapshot.events = snapshot.events.map(enrichIdentity);');
const deepMapIndex = source.indexOf('snapshot.deepMarkets = snapshot.deepMarkets.map(enrichIdentity);');
assert.ok(mainMapIndex >= 0 && deepMapIndex > mainMapIndex, 'primary events must remain independently retained before supplemental deep collections');

console.log('ODDS WORKER MAJOR-SPORT RETENTION TEST: PASS // BROAD MULTI-EVENT MARKETS RETAINED + DEEP PROPS SUPPLEMENTAL');

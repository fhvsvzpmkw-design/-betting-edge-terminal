import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('tools/odds-refresh-worker-source.yml', 'utf8');
// Production acquisition stays filtered upstream; the runtime suite verifies
// behavior when provider responses ignore the requested market scope.
assert.ok(source.includes("apiUrl('/odds/multi', { eventIds, bookmakers: bookmaker, markets: PRIMARY_MARKETS })"));
assert.ok(source.includes('marketAgeMinutes(market, now) <= MAX_MARKET_AGE_MINUTES'));
assert.ok(source.includes('Date.parse(market?.observedAt)'));
assert.ok(source.includes('quoteObservationVersion: 1'));
assert.ok(source.includes('snapshot.generatedAt = completedAt.toISOString()'));
assert.ok(source.includes('snapshot.events = snapshot.events.map(enrichIdentity);'));
assert.ok(source.includes('snapshot.deepMarkets = snapshot.deepMarkets.map(enrichIdentity);'));
assert.ok(source.includes('function primaryRecoveryEligible(event, coreEventMap)'));
for (const sport of ['MLB', 'NHL', 'NBA', 'WNBA', 'NFL', 'NCAAF', 'CFL']) assert.ok(source.includes(sport));
console.log('ODDS WORKER PRIMARY RETENTION: PASS');

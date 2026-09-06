import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import clock from '../assets/quote-observation.js';

const generatedAt = '2026-09-06T16:22:00Z';
const feed = {quoteObservationVersion: 1, generatedAt};
const quiet = {name: 'ML', updatedAt: '2026-09-06T12:00:00Z', observedAt: '2026-09-06T16:21:00Z', odds: [{home: '1.91', away: '1.91'}]};
assert.equal(clock.quoteAgeMinutes(quiet, feed), 1);
assert.equal(clock.quoteIsFresh(quiet, feed), true);
assert.equal(quiet.updatedAt, '2026-09-06T12:00:00Z');
for (const observedAt of [undefined, '', 'invalid', '2026-09-06T16:23:00Z', '2026-09-06T15:51:59Z']) {
  assert.equal(clock.quoteIsFresh({...quiet, observedAt}, feed), false, `unsafe observation ${observedAt}`);
}
assert.equal(clock.quoteIsFresh({...quiet, observedAt: '2026-09-06T15:52:00Z'}, feed), true);
assert.equal(clock.quoteIsFresh({...quiet, suspended: true}, feed), false);
assert.equal(clock.quoteIsFresh(quiet, {...feed, quoteObservationVersion: 2}), false);
assert.equal(clock.quoteAgeMinutes(quiet, {generatedAt}), 262, 'legacy uses original change-time rule');
assert.equal(clock.quoteTimestamp(quiet, feed), quiet.observedAt);

const event = {id: 123, home: 'Home', away: 'Away', bookmakers: {Bet365: [quiet]}, bookmakerObservedAt: {Bet365: quiet.observedAt}};
const omitted = {...event, bookmakers: {Bet365: []}, bookmakerObservedAt: {Bet365: generatedAt}};
assert.equal(clock.mergeObservedEvents({...feed, events: [event], deepMarkets: [omitted], baseballProps: [event]})[0].bookmakers.Bet365.length, 0, 'new full omission defeats older copies in every collection');
const changed = {...quiet, observedAt: generatedAt, odds: [{home: '1.95'}]};
const incomplete = {...omitted, bookmakers: {Bet365: [changed]}};
const merged = clock.mergeObservedEvents({...feed, events: [event], deepMarkets: [incomplete]})[0];
assert.deepEqual(merged.bookmakers.Bet365, [changed]);
assert.equal(merged.bookmakers.Bet365[0].odds[0].away, undefined, 'older opposite side stays absent');
assert.equal(clock.mergeObservedEvents({...feed, events: [event], deepMarkets: [event]})[0].bookmakers.Bet365.length, 1);
assert.deepEqual([quiet, changed].sort((a,b) => clock.compareMarketRecency(a,b,feed)), [changed, quiet]);
const context = {};
vm.runInNewContext(fs.readFileSync('assets/quote-observation.js', 'utf8'), context);
assert.equal(context.BettingEdgeQuoteObservation.quoteIsFresh(quiet, feed), true, 'browser and Node use same clock');
console.log('QUOTE OBSERVATION TEST OK — separate clocks, strict timestamps, full-scope omissions, legacy compatibility');

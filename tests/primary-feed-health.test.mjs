import assert from 'node:assert/strict';
import {inspectPrimaryFeedHealth,validatePrimaryFeedHealth} from '../tools/primary-feed-health.mjs';
const report={ts:'2026-10-27T08:00:00-07:00'};
const row={eventId:'nhl-1',category:'NHL',startTime:'2026-10-27T23:00:00Z',acquisition:{Bet365:'REQUEST_FAILED',DraftKings:'NOT_ATTEMPTED_BUDGET'}};
const feed={diagnostics:{coreMarketAvailability:[row]},errors:[{stage:'odds-multi:Bet365',message:'403 paid plan'}]};
assert.equal(inspectPrimaryFeedHealth(report,feed,0).state,'PRIMARY_PRICES_UNAVAILABLE');
assert.throws(()=>validatePrimaryFeedHealth(report,feed,0),/PRIMARY ODDS ACQUISITION BLOCK/);
assert.equal(validatePrimaryFeedHealth(report,feed,6).state,'PRICES_AVAILABLE','a failed book never blocks supported unrelated decisions');
assert.equal(validatePrimaryFeedHealth(report,{diagnostics:{coreMarketAvailability:[]}},0).pendingPrimaryEvents,0,'genuinely empty slates remain valid');
assert.equal(validatePrimaryFeedHealth({ts:'2026-10-27T06:18:42-07:00'},feed,0).state,'PRIMARY_PRICES_UNAVAILABLE','issued historical report remains verifiable');
for(const startTime of ['2026-10-27T12:00:00Z','2026-10-29T00:00:00Z'])
  assert.doesNotThrow(()=>validatePrimaryFeedHealth(report,{diagnostics:{coreMarketAvailability:[{...row,startTime}]}},0),'started or other-day events cannot block a real empty slate');
assert.throws(()=>validatePrimaryFeedHealth(report,{diagnostics:{primaryEventsNotPriced:[{...row,date:row.startTime}]}},0),/ACQUISITION BLOCK/,'capacity omissions cannot disappear from a zero-board report');
assert.throws(()=>validatePrimaryFeedHealth(report,{diagnostics:{coreMarketAvailability:[{...row,acquisition:{Bet365:'EVENT_NOT_RETURNED',DraftKings:'EVENT_NOT_RETURNED'}}]}},0),/ACQUISITION BLOCK/,'known upcoming games without returned prices are not a no-event slate');
assert.doesNotThrow(()=>validatePrimaryFeedHealth(report,{diagnostics:{coreMarketAvailability:[{...row,category:'TENNIS'}]}},0));
console.log('PRIMARY FEED HEALTH: PASS // failed collection, supported partial board, genuine empty slate, event eligibility and immutable history');

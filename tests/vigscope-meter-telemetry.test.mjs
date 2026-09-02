import assert from 'node:assert/strict';
import {
  VIG_METER_TELEMETRY_AUTHORITY,
  deriveInstrumentTelemetry,
  exactSelectionQuote
} from '../tools/vigscope-meter-telemetry.mjs';

const feedGeneratedAt='2026-09-02T15:25:00.000Z';
const feed={
  generatedAt:feedGeneratedAt,
  events:[{
    id:1,
    bookmakers:{
      Bet365:[{
        name:'ML',marketKey:'ml',updatedAt:'2026-09-02T15:20:00.000Z',odds:[
          {home:'2.350',away:'1.650',selectionKeys:{home:'1|ml|home||',away:'1|ml|away||'}}
        ]
      },{
        name:'ML second',marketKey:'ml2',updatedAt:'2026-09-02T15:20:00.000Z',odds:[
          {home:'1.950',away:'1.950',selectionKeys:{home:'2|ml|home||',away:'2|ml|away||'}}
        ]
      }],
      DraftKings:[{
        name:'ML',marketKey:'ml',updatedAt:'2026-09-02T15:21:00.000Z',odds:[
          {home:'2.400',away:'1.620',selectionKeys:{home:'1|ml|home||',away:'1|ml|away||'}}
        ]
      },{
        name:'ML second',marketKey:'ml2',updatedAt:'2026-09-02T15:21:00.000Z',odds:[
          {home:'2.000',away:'1.900',selectionKeys:{home:'2|ml|home||',away:'2|ml|away||'}}
        ]
      }]
    }
  }]
};

assert.equal(exactSelectionQuote(feed,'DraftKings','1|ml|home||').decimal,2.4);
assert.equal(exactSelectionQuote(feed,'Bet365','2|ml|home||').decimal,1.95);

const prior={
  ts:'2026-09-02T06:02:15-07:00',
  recs:[
    {status:'PASS',book:'DraftKings',price:'+138',feed:{selectionKey:'1|ml|home||'}},
    {status:'PASS',book:'Bet365',price:'-102',feed:{selectionKey:'2|ml|home||'}}
  ]
};
const current={
  ts:'2026-09-02T08:07:00-07:00',
  feedGeneratedAt,
  recs:[
    // Current selected book is Bet365, but movement must stay on prior DraftKings.
    {status:'PASS',book:'Bet365',price:'+135',playTo:'+180 or better',feed:{selectionKey:'1|ml|home||'}},
    // Current selected book is DraftKings, but movement must stay on prior Bet365.
    {status:'PASS',book:'DraftKings',price:'-105',playTo:'+135 or better',feed:{selectionKey:'2|ml|home||'}},
    // New card has no prior exact identity and cannot create movement.
    {status:'PASS',book:'Bet365',price:'+120',feed:{selectionKey:'3|ml|home||'}}
  ]
};

const telemetry=deriveInstrumentTelemetry({
  report:current,
  priorReport:prior,
  feed,
  feedBlobSha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  priorRunPath:'data/history/runs/2026-09-02/open-060215.json'
});

assert.equal(telemetry.authority,VIG_METER_TELEMETRY_AUTHORITY);
assert.equal(telemetry.movement.eligibleSelections,3);
assert.equal(telemetry.movement.comparableSelections,2);
assert.equal(telemetry.movement.sameBookComparisons,2);
assert.equal(telemetry.movement.changedSelections,2);
assert.equal(telemetry.movement.confidence,67);
assert.equal(telemetry.source.priorRunTs,prior.ts);
assert.equal(telemetry.agreement.pairs,2);
assert.ok(telemetry.agreement.confidence>0);
assert.ok(telemetry.heat.confidence>0);
assert.ok(telemetry.pressure.confidence>0);

// The first comparison must use DK +138 -> DK decimal 2.40 (+140-ish), which is favorable.
// If it incorrectly compared to selected Bet365 +135 it would be adverse.
assert.ok(telemetry.movement.weightedFavor<0.001,'mixed same-book changes should not inherit selected-book switching direction');

const noPrior=deriveInstrumentTelemetry({
  report:current,
  priorReport:null,
  feed,
  feedBlobSha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
});
assert.equal(noPrior.source.reason,'NO_PRIOR_SAME_DAY_RUN');
assert.equal(noPrior.heat.confidence,0);
assert.equal(noPrior.pressure.confidence,0);
assert.equal(noPrior.agreement.confidence,0);

const mismatchedFeed=deriveInstrumentTelemetry({
  report:current,
  priorReport:prior,
  feed:{...feed,generatedAt:'2026-09-02T15:24:00.000Z'},
  feedBlobSha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
});
assert.equal(mismatchedFeed.source.reason,'PINNED_FEED_UNAVAILABLE_OR_MISMATCHED');
assert.equal(mismatchedFeed.heat.confidence,0);

console.log(JSON.stringify({
  state:'PASS',
  authority:telemetry.authority,
  movement:telemetry.movement,
  heat:telemetry.heat,
  pressure:telemetry.pressure,
  agreement:telemetry.agreement
},null,2));

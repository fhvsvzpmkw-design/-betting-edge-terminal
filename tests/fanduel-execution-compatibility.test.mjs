import assert from 'node:assert/strict';
import fs from 'node:fs';
import {derivePrimarySelectionInventory} from '../tools/major-sport-market-coverage-gate.mjs';
import {exactBookQuotes, auditTrackedAvailability} from '../tools/selection-availability.mjs';
import {canonicalBook, primaryLineQuote} from '../tools/primary-lineage.mjs';
import {explainUnavailableSelections} from '../tools/report-coverage-summary.mjs';
import {deriveInstrumentTelemetry, derivePrimaryMarketInstrumentTelemetry} from '../tools/vigscope-meter-telemetry.mjs';

const policy=JSON.parse(fs.readFileSync('data/major-sport-market-coverage-v1.json','utf8'));
const key=(market,side,line='')=>`fd-event|${market}|${side}||${line}`;
function makeFeed(generatedAt,home=2.1){
  return {generatedAt,bookmakers:['DraftKings','FanDuel'],events:[{
    id:'fd-event',date:'2026-10-28T23:10:00Z',sport:{slug:'american-football'},league:{slug:'usa-nfl'},
    bookmakers:Object.fromEntries(['DraftKings','FanDuel'].map(book=>[book,[
      {marketKey:'ml',updatedAt:generatedAt,odds:[{home:home+(book==='FanDuel'?.05:0),away:1.8,selectionKeys:{home:key('ml','home'),away:key('ml','away')}}]},
      {marketKey:'spread',updatedAt:generatedAt,odds:[{hdp:-3.5,home:1.91,away:1.91,selectionKeys:{home:key('spread','home',-3.5),away:key('spread','away',-3.5)}}]},
      {marketKey:'totals',updatedAt:generatedAt,odds:[{hdp:45.5,over:1.91,under:1.91,selectionKeys:{over:key('totals','over',45.5),under:key('totals','under',45.5)}}]}
    ]]))
  }]};
}
const feed=makeFeed('2026-10-28T22:10:00Z'),before=makeFeed('2026-10-28T22:00:00Z',2);
const report={ts:'2026-10-28T15:15:00-07:00',feedGeneratedAt:feed.generatedAt,recs:[]};
const onlyFanDuel=structuredClone(feed);
delete onlyFanDuel.events[0].bookmakers.DraftKings;
const inventory=derivePrimarySelectionInventory(report,onlyFanDuel,policy);
assert.equal(inventory.selections.length,6,'FanDuel alone supplies both sides of all three primary markets');
assert.ok(inventory.selections.every(selection=>selection.quotes.length===1&&selection.quotes[0].book==='FanDuel'));
assert.equal(primaryLineQuote(feed.events[0],'FanDuel','home',feed,'spread').state,'OK');
assert.equal(primaryLineQuote(feed.events[0],'FanDuel','over',feed,'totals').state,'OK');
for(const alias of ['FanDuel','Fan Duel','FD'])assert.equal(canonicalBook(alias),'FanDuel');
assert.equal(canonicalBook('B365'),'Bet365','historical bookmaker aliases remain valid');

const rec={status:'WAIT',title:'Home over 45.5',book:'FanDuel',price:'-110',stake:'$0',
  feed:{eventId:'fd-event',marketKey:'totals',side:'over',selectionKey:key('totals','over',45.5),eventDate:'2026-10-28T23:10:00Z'}};
assert.deepEqual(exactBookQuotes(onlyFanDuel,rec).map(quote=>quote.book),['FanDuel']);
for(const alias of ['FanDuel','Fan Duel','FD']){
  const current={...report,recs:[{...rec,book:alias}]};
  const audit=auditTrackedAvailability({previous:{recs:[rec]},report:current,feed:onlyFanDuel});
  assert.equal(audit.ok,true,audit.violations.join('; '));
}
const ghost={...report,recs:[{...rec,price:'-105'}]};
assert.equal(auditTrackedAvailability({previous:{recs:[rec]},report:ghost,feed:onlyFanDuel}).ok,false,'FanDuel still requires the exact bound price');

const primary=derivePrimaryMarketInstrumentTelemetry({report,feed,policy,feedBlobSha:'a'.repeat(40),oddsSnapshots:[{blobSha:'b'.repeat(40),feed:before}]});
assert.equal(primary.sample.availableSelections,6);
assert.equal(primary.agreement.source,'BOUND_PRIMARY_FEED_DRAFTKINGS_FANDUEL');
assert.equal(primary.agreement.pairs,6);
assert.ok(primary.agreement.comparisons.every(pair=>pair.fanDuelDecimal&&pair.draftKingsDecimal&&!('bet365Decimal' in pair)));
const directional={...report,recs:[{status:'LEAN',book:'FanDuel',price:'+115',feed:{selectionKey:key('ml','home')}}]};
const fdBefore=structuredClone(before);delete fdBefore.events[0].bookmakers.DraftKings;
const fdMovement=derivePrimaryMarketInstrumentTelemetry({report:directional,feed:onlyFanDuel,policy,feedBlobSha:'a'.repeat(40),oddsSnapshots:[{blobSha:'b'.repeat(40),feed:fdBefore}]});
assert.equal(fdMovement.movement.comparableSelections,6,'FanDuel same-book history supports the movement meter');
assert.equal(fdMovement.pressure.state,'MEASURED');
assert.equal(fdMovement.pressure.comparisons[0].book,'FanDuel');
const legacy=deriveInstrumentTelemetry({report:directional,priorReport:{ts:'2026-10-28T15:00:00-07:00',recs:[{...directional.recs[0],price:'+105'}]},feed});
assert.equal(legacy.agreement.source,'BOUND_FEED_DRAFTKINGS_FANDUEL');
assert.equal(legacy.agreement.pairs,1);

const omitted={...feed,events:[],diagnostics:{coreMarketAvailability:[{
  eventId:'missing',category:'NFL',startTime:'2026-10-28T23:10:00Z',acquisition:{DraftKings:'EVENT_NOT_RETURNED',FanDuel:'EVENT_NOT_RETURNED'},
  markets:{totals:{available:false,books:{DraftKings:'STALE_BEYOND_RETENTION',FanDuel:'NOT_RETURNED'},updatedAtByBook:{DraftKings:'2026-10-28T20:00:00Z'}}}
}]}};
const audit={availabilityLimitations:[{eventId:'missing',sport:'NFL',marketDetail:'full_game_primary_total',selections:['over','under'],reason:'MARKET_NOT_RETURNED'}]};
const explanation=explainUnavailableSelections(report,audit,omitted);
assert.equal(explanation.unavailableReasons[0].reason,'STALE_BEYOND_RETENTION');
assert.equal(explanation.discoveryOmissions[0].reason,'EVENT_NOT_RETURNED');
assert.deepEqual(Object.keys(explanation.discoveryOmissions[0].acquisition),['DraftKings','FanDuel']);
const historical=structuredClone(omitted);delete historical.bookmakers;
const row=historical.diagnostics.coreMarketAvailability[0];
row.acquisition={Bet365:'EVENT_NOT_RETURNED',DraftKings:'EVENT_NOT_RETURNED'};
row.markets.totals.books={Bet365:'NOT_RETURNED',DraftKings:'STALE_BEYOND_RETENTION'};
assert.deepEqual(Object.keys(explainUnavailableSelections(report,audit,historical).discoveryOmissions[0].acquisition),['Bet365','DraftKings']);
console.log('FANDUEL EXECUTION: PASS // primary inventory, exact quotes/aliases, same-book meters, correct DK/FD agreement and historical coverage compatibility');

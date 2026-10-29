import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const helper=fs.readFileSync('assets/quote-observation.js','utf8');
function runtimeApi(filename){
  let source=fs.readFileSync(filename,'utf8');
  if(filename.endsWith('.html'))source=source.match(/<script>([\s\S]*?)<\/script>/)[1];
  const app={addEventListener(){}};
  const context={console,document:{querySelector:s=>s==='#app'?app:null},location:{hash:'',search:''},localStorage:{getItem:()=>null},Intl,URLSearchParams,Date,setTimeout,clearTimeout};
  vm.runInNewContext(helper,context);
  const marker='\nactiveRun=payload();';
  assert.ok(source.includes(marker));
  vm.runInNewContext(source.replace(marker,'\nglobalThis.api={compareRec,bestQuoteForRec,buildInstrumentTelemetry,fallbackAgreement,playerEvents};'+marker),context);
  return context.api;
}
const observedAt='2026-10-28T22:20:00Z';
function fixture(){
  const event={id:'1',eventId:'1',home:'Hosts',away:'Visitors',date:'2026-10-29T02:00:00Z',sport:{slug:'ice-hockey'},bookmakerObservedAt:{},bookmakers:{}};
  for(const [book,home] of [['FanDuel',2.2],['DraftKings',2],['Bet365',3]]){
    event.bookmakerObservedAt[book]=observedAt;
    event.bookmakers[book]=[{name:'ML',marketKey:'ml',updatedAt:'2026-10-28T20:00:00Z',observedAt,odds:[{home,away:1.8,selectionKeys:{home:'1|ml|home||',away:'1|ml|away||'}}]}];
  }
  return {quoteObservationVersion:1,generatedAt:'2026-10-28T22:30:00Z',bookmakers:['FanDuel','DraftKings'],events:[event]};
}
const rec={status:'LEAN',book:'DraftKings',price:'+100',title:'Hosts ML',feed:{eventId:'1',marketKey:'ml',side:'home',selectionKey:'1|ml|home||'}};
const run={ts:'2026-10-28T15:30:00-07:00',recs:[rec]};
for(const filename of ['assets/runner-core-runtime.js','runner-core.html']){
  const api=runtimeApi(filename),feed=fixture(),original=JSON.stringify(rec);
  const quote=api.bestQuoteForRec(rec,feed,run).quote;
  assert.equal(quote.book,'FanDuel',`${filename}: replacement book supplies the best active price`);
  assert.equal(quote.dec,2.2,'unselected historical Bet365 quote cannot override active books');
  const comparison=api.compareRec(rec,feed,run);
  assert.equal(comparison.matched,true);
  assert.equal(comparison.rec.priceComparison.book,'FanDuel');
  assert.equal(comparison.movement,'IMPROVED');
  assert.equal(JSON.stringify(rec),original,'checking replacement books leaves issued report unchanged');
  assert.equal(api.buildInstrumentTelemetry([rec],feed).agreement.pairs,1,'FanDuel/DraftKings agreement has two independent current prices');
  assert.equal(api.fallbackAgreement({recs:[{source:'FanDuel +120 // DraftKings +100'}]}).pairs,1,'text comparison recognizes replacement pair');
  const missingSecond=fixture();delete missingSecond.events[0].bookmakers.DraftKings;
  assert.equal(api.buildInstrumentTelemetry([rec],missingSecond).agreement.pairs,0,'unselected Bet365 cannot replace absent active book in agreement');
  const stale=fixture();delete stale.events[0].bookmakerObservedAt.FanDuel;stale.events[0].bookmakers.FanDuel[0].observedAt='2026-10-28T21:59:00Z';
  assert.equal(api.bestQuoteForRec(rec,stale,run).quote.book,'DraftKings','stale FanDuel price does not execute');
  assert.equal(api.buildInstrumentTelemetry([rec],stale).agreement.pairs,0,'stale FanDuel price does not create agreement');
  const titleOnly={...rec,feed:undefined};
  assert.equal(api.bestQuoteForRec(titleOnly,feed,run).quote.book,'FanDuel','title matching recognizes replacement book');
  const historical=fixture();historical.bookmakers=['Bet365','DraftKings'];
  assert.equal(api.bestQuoteForRec(rec,historical,run).quote.book,'Bet365','historical bookmaker pair remains supported');
  assert.equal(api.buildInstrumentTelemetry([rec],historical).agreement.pairs,1);
  const legacy=structuredClone(historical);delete legacy.bookmakers;
  delete legacy.events[0].bookmakers.FanDuel;
  assert.equal(api.bestQuoteForRec(rec,legacy,run).quote.book,'Bet365','legacy snapshots without bookmaker declaration remain readable');
}
console.log('RUNNER FANDUEL: active-book prices, current agreement, stale rejection, immutable reports and historical Bet365 PASS');

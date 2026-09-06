import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {exactSelectionQuote, derivePrimaryMarketInstrumentTelemetry} from '../tools/vigscope-meter-telemetry.mjs';

const helper=fs.readFileSync('assets/quote-observation.js','utf8');
function runtimeApi(filename,{loadHelper=true}={}){
  let source=fs.readFileSync(filename,'utf8');
  if(filename.endsWith('.html'))source=source.match(/<script>([\s\S]*?)<\/script>/)[1];
  const app={addEventListener(){}};
  const context={console,document:{querySelector:s=>s==='#app'?app:null},location:{hash:'',search:''},localStorage:{getItem:()=>null},Intl,URLSearchParams,Date,setTimeout,clearTimeout};
  if(loadHelper)vm.runInNewContext(helper,context);
  const marker='\nactiveRun=payload();';
  assert.ok(source.includes(marker));
  vm.runInNewContext(source.replace(marker,'\nglobalThis.api={compareRec,bestQuoteForRec,buildInstrumentTelemetry,allEvents};'+marker),context);
  return context.api;
}
const stamp='2026-09-06T16:20:00Z',changed='2026-09-06T13:00:00Z';
function fixture(){
  const feed={quoteObservationVersion:1,generatedAt:'2026-09-06T16:30:00Z',events:[{id:'1',eventId:'1',home:'Hosts',away:'Visitors',date:'2026-09-06T22:00:00Z',sport:{slug:'baseball'},league:{slug:'usa-mlb'},bookmakerObservedAt:{Bet365:stamp,DraftKings:stamp},bookmakers:{}}]};
  for(const book of ['Bet365','DraftKings'])feed.events[0].bookmakers[book]=[{name:'ML',marketKey:'ml',updatedAt:changed,observedAt:stamp,odds:[{home:2,away:1.8,selectionKeys:{home:'1|ml|home||',away:'1|ml|away||'}}]}];
  return feed;
}
const rec={status:'PASS',book:'Bet365',price:'+100',title:'Hosts ML',feed:{eventId:'1',marketKey:'ml',side:'home',selectionKey:'1|ml|home||'}};
const report={ts:'2026-09-06T09:30:00-07:00',feedGeneratedAt:fixture().generatedAt,recs:[rec]};
for(const filename of ['assets/runner-core-runtime.js','runner-core.html']){
  const withoutHelper=runtimeApi(filename,{loadHelper:false}),unverifiable=fixture();
  for(const markets of Object.values(unverifiable.events[0].bookmakers))markets[0].updatedAt=stamp;
  assert.equal(withoutHelper.compareRec(rec,unverifiable,report).matched,false,'marked feed cannot fall back to provider timestamp if helper failed to load');
  assert.equal(withoutHelper.buildInstrumentTelemetry([rec],unverifiable).agreement.pairs,0,'missing helper cannot manufacture current agreement');
  const legacyWithoutHelper=structuredClone(unverifiable);delete legacyWithoutHelper.quoteObservationVersion;
  assert.equal(withoutHelper.compareRec(rec,legacyWithoutHelper,report).matched,true,'unmarked historical prices retain legacy support without helper');
  const api=runtimeApi(filename),feed=fixture(),before=JSON.stringify(rec);
  const check=api.compareRec(rec,feed,report);
  assert.equal(check.matched,true,`${filename}: a freshly returned unchanged price is current`);
  assert.equal(check.movement,'UNCHANGED');
  assert.equal(check.rec.priceComparison.updatedAt,changed);
  assert.equal(check.rec.priceComparison.observedAt,stamp);
  assert.equal(check.rec.priceComparison.quoteObservationVersion,1);
  assert.equal(JSON.stringify(rec),before,'the issued report is immutable');
  assert.equal(api.buildInstrumentTelemetry([rec],feed).agreement.pairs,1);
  for(const observedAt of ['2026-09-06T15:59:59Z',undefined,'invalid','2026-09-06T16:31:00Z']){
    const bad=fixture();
    for(const [book,markets] of Object.entries(bad.events[0].bookmakers)){
      markets[0].observedAt=observedAt;markets[0].updatedAt=stamp;
      delete bad.events[0].bookmakerObservedAt[book];
    }
    assert.equal(api.compareRec(rec,bad,report).matched,false,`${filename}: ${observedAt} cannot qualify`);
    assert.equal(api.buildInstrumentTelemetry([rec],bad).agreement.pairs,0);
    assert.equal(exactSelectionQuote(bad,'Bet365',rec.feed.selectionKey),null);
  }
  const oneBook=fixture();oneBook.events[0].bookmakers.DraftKings[0].observedAt='2026-09-06T15:59:59Z';delete oneBook.events[0].bookmakerObservedAt.DraftKings;
  assert.equal(api.compareRec(rec,oneBook,report).matched,true,'one valid execution book can qualify');
  assert.equal(api.buildInstrumentTelemetry([rec],oneBook).agreement.pairs,0,'agreement requires two independently fresh books');
  const moved=fixture();moved.events[0].bookmakers.Bet365[0].odds[0].home=2.2;
  assert.equal(api.compareRec(rec,moved,report).movement,'IMPROVED','actual price change still drives movement');
  for(const suspended of ['event','market','row']){
    const blocked=fixture();
    if(suspended==='event')blocked.events[0].suspended=true;
    else for(const markets of Object.values(blocked.events[0].bookmakers))(suspended==='market'?markets[0]:markets[0].odds[0]).suspended=true;
    assert.equal(api.compareRec(rec,blocked,report).matched,false,`${suspended} suspension blocks price`);
    assert.equal(exactSelectionQuote(blocked,'Bet365',rec.feed.selectionKey),null);
  }
  const missing=fixture();missing.deepMarkets=structuredClone(missing.events);
  for(const [book,markets] of Object.entries(missing.deepMarkets[0].bookmakers)){markets[0].observedAt='2026-09-06T16:10:00Z';missing.deepMarkets[0].bookmakerObservedAt[book]=markets[0].observedAt;}
  missing.events[0].bookmakers={Bet365:[],DraftKings:[]};
  assert.equal(api.compareRec(rec,missing,report).matched,false,'older deep market cannot restore a market omitted by latest full response');
  assert.equal(exactSelectionQuote(missing,'Bet365',rec.feed.selectionKey),null);
  const removedSelection=fixture();removedSelection.deepMarkets=structuredClone(removedSelection.events);
  for(const book of ['Bet365','DraftKings']){
    const latest=removedSelection.deepMarkets[0].bookmakers[book][0];latest.observedAt='2026-09-06T16:25:00Z';delete latest.odds[0].home;
    delete removedSelection.events[0].bookmakerObservedAt[book];delete removedSelection.deepMarkets[0].bookmakerObservedAt[book];
  }
  assert.equal(api.compareRec(rec,removedSelection,report).matched,false,'newer partial market missing selection cannot revive old selection');
  assert.equal(exactSelectionQuote(removedSelection,'Bet365',rec.feed.selectionKey),null);
  const conflict=fixture();conflict.deepMarkets=structuredClone(conflict.events);
  for(const markets of Object.values(conflict.deepMarkets[0].bookmakers))markets[0].odds[0].home=2.3;
  assert.equal(api.compareRec(rec,conflict,report).matched,false,'same-time conflicting market prices fail closed');
  assert.equal(exactSelectionQuote(conflict,'Bet365',rec.feed.selectionKey),null);
  const duplicate=fixture();duplicate.deepMarkets=structuredClone(duplicate.events);
  assert.equal(api.compareRec(rec,duplicate,report).matched,true,'identical same-time copies remain usable');
  assert.equal(exactSelectionQuote(duplicate,'Bet365',rec.feed.selectionKey).decimal,2);
  const legacy=fixture();delete legacy.quoteObservationVersion;
  assert.equal(api.compareRec(rec,legacy,report).matched,false,'legacy feed keeps provider timestamp interpretation');
  for(const markets of Object.values(legacy.events[0].bookmakers))markets[0].updatedAt=stamp;
  const historical=api.compareRec(rec,legacy,report);
  assert.equal(historical.matched,true);assert.equal(historical.rec.priceComparison.quoteObservationVersion,undefined);
}

for(const filename of ['runner.html','runner-app.html','runner-core.html']){
  const source=fs.readFileSync(filename,'utf8'),helperTag=source.indexOf('<script src="./assets/quote-observation.js"></script>');
  const runtime=filename==='runner-core.html'?source.indexOf('<script>'):source.indexOf('<script src="./assets/runner-core-runtime.js"></script>');
  assert.ok(helperTag>=0&&runtime>helperTag,`${filename}: helper loads before runtime`);
}

const policy=JSON.parse(fs.readFileSync('data/major-sport-market-coverage-v1.json','utf8'));
const feed=fixture(),baseline=fixture();baseline.generatedAt='2026-09-06T15:30:00Z';
for(const [book,markets] of Object.entries(baseline.events[0].bookmakers)){markets[0].observedAt='2026-09-06T15:20:00Z';baseline.events[0].bookmakerObservedAt[book]=markets[0].observedAt;}
const telemetry=derivePrimaryMarketInstrumentTelemetry({report,feed,policy,feedBlobSha:'a'.repeat(40),coverageAuthorityBlobSha:'b'.repeat(40),oddsSnapshots:[{feed:baseline,blobSha:'c'.repeat(40)}]});
assert.equal(telemetry.sample.availableSelections,2);
assert.equal(telemetry.agreement.pairs,2);
assert.equal(telemetry.movement.sameBookComparisons,2);
assert.equal(telemetry.movement.changedSelections,0,'new observation timestamps alone create no price movement');
for(const comparison of telemetry.movement.comparisons){
  assert.equal(comparison.currentQuoteUpdatedAt,changed);assert.equal(comparison.baselineQuoteUpdatedAt,changed);
  assert.equal(comparison.currentQuoteObservedAt,stamp);assert.equal(comparison.baselineQuoteObservedAt,'2026-09-06T15:20:00Z');
}
console.log('RUNNER + METERS OBSERVATION: PASS // unchanged price, invalid/future/stale observations, availability, independent books, movement provenance, legacy');

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {probabilityToAmerican,matchNovigMarket,novigQuotes,collectNovig as pacedCollectNovig,saveNovigCapture,loadNovigCapture,novigReference,compareNovigPrice} from '../tools/novig-market-data.mjs';
import {bindIntelligence,buildGameIntelligence} from '../tools/game-intelligence.mjs';
import {buildBoard} from '../tools/build-game-board.mjs';

const at='2026-10-09T21:00:00Z',start='2026-10-09T23:00:00Z';
const collectNovig=options=>pacedCollectNovig({...options,requestIntervalMs:0});
const event={eventId:'nhl-test',sport:'NHL',home:'Detroit Red Wings',away:'Seattle Kraken',startTime:start};
const sourceEvent={eventId:'source-event',league:'NHL',sport:'ICE_HOCKEY',status:'OPEN_PREGAME',startsTs:Date.parse(start)};
const market={marketId:'market',eventId:'source-event',marketType:'MONEY',status:'OPEN',strike:'0',startsTs:Date.parse(start),
  fee:{charged:'WHEN_LIVE',coefficient:'0.06'},voids:'FMV',outcomes:[{outcomeId:'away-id',name:'SEA',status:'TBD'},{outcomeId:'home-id',name:'DET',status:'TBD'}]};
const book={marketId:'market',seq:4,orders:{'home-id':[{orderId:'h',price:'0.600',qty:1000}],
  'away-id':[{orderId:'a1',price:'0.395',qty:110},{orderId:'a2',price:'0.395',qty:90},{orderId:'a3',price:'0.390',qty:9000}]}};
const feed={generatedAt:at,events:[{id:event.eventId,home:event.home,away:event.away,date:start,
  sport:{slug:'ice-hockey'},league:{slug:'usa-nhl'},bookmakers:{}}]};
const match=()=>matchNovigMarket(event,[sourceEvent],[market]);
const fetchFixture=(urls=[],options={})=>async (url,init)=>{
  urls.push({url,headers:init.headers});
  if(options.fail)return {ok:false,status:options.fail};
  const data=url.includes('/book?')?book:url.includes('/trades?')?
    {items:[{tradeId:'trade',outcomeId:'home-id',price:'0.60',qty:200,ts:Date.parse(at)-1000}]}:
    url.includes('/catalog/events?')?{items:[sourceEvent]}:{items:[market]};
  return {ok:true,status:200,headers:new Headers({'Age':'3'}),text:async()=>JSON.stringify(data)};
};

test('available prices use opposing bids, sum same-price liquidity and preserve native cent units',()=>{
  const quotes=novigQuotes(match(),book),home=quotes.find(q=>q.side==='home'),away=quotes.find(q=>q.side==='away');
  assert.equal(home.buyProbability,.605);assert.equal(home.bidProbability,.6);assert.equal(home.priceAmerican,'-153');
  assert.equal(home.availableRawApiQty,200);assert.equal(home.availablePayoutUsd,2);assert.equal(home.availableCostUsd,1.21);
  assert.equal(away.buyProbability,.4);assert.equal(away.priceAmerican,'+150');
  assert.equal(home.bidAskSpreadProbability,.005);
  const reordered={...market,outcomes:[...market.outcomes].reverse()};
  assert.deepEqual(novigQuotes(matchNovigMarket(event,[sourceEvent],[reordered]),book),quotes);
  assert.equal(probabilityToAmerican(.5),'+100');assert.equal(probabilityToAmerican(null),null);
});
test('empty and one-sided books stay explicit; malformed or crossed books are rejected',()=>{
  const empty=novigQuotes(match(),{marketId:'market',seq:1,orders:{}});assert.ok(empty.every(q=>q.priceAmerican===null&&q.state==='NO_OFFER'));
  const one=novigQuotes(match(),{...book,orders:{'home-id':book.orders['home-id']}});
  assert.equal(one.find(q=>q.side==='home').buyProbability,null);assert.equal(one.find(q=>q.side==='away').buyProbability,.4);
  assert.throws(()=>novigQuotes(match(),{...book,marketId:'other'}),/identity/);
  assert.throws(()=>novigQuotes(match(),{...book,orders:{...book.orders,'away-id':[{orderId:'x',price:'0.500',qty:1}]}}),/Crossed/);
  assert.throws(()=>novigQuotes(match(),{...book,orders:{...book.orders,'away-id':[{orderId:'x',price:'0.395',qty:-1}]}}),/quantity/);
});
test('matching requires exact teams, kickoff, type, status and one source market',()=>{
  assert.equal(match().outcomes.home.outcomeId,'home-id');
  assert.equal(matchNovigMarket({...event,home:'Boston Bruins'},[sourceEvent],[market]),null);
  assert.equal(matchNovigMarket({...event,startTime:'2026-10-09T23:01:00Z'},[sourceEvent],[market]),null);
  assert.equal(matchNovigMarket(event,[sourceEvent],[market,{...market,marketId:'duplicate'}]),null);
  assert.equal(matchNovigMarket(event,[sourceEvent],[{...market,marketType:'MONEY_1H'}]),null);
  assert.equal(matchNovigMarket(event,[{...sourceEvent,status:'OPEN_LIVE'}],[market]),null);
  assert.equal(matchNovigMarket(event,[sourceEvent],[{...market,outcomes:[market.outcomes[0],{...market.outcomes[1],name:'YES'}]}]),null);
});
test('collection uses only public Novig reads and saves clocks, tape and separate authority',async()=>{
  const urls=[],capture=await collectNovig({feed,at,fetchImpl:fetchFixture(urls)});
  assert.equal(capture.state,'COLLECTED');assert.equal(capture.counts.collectedEvents,1);assert.equal(urls.length,4);
  assert.ok(urls.every(r=>r.url.startsWith('https://api.novig.com/v3/public/')&&!r.headers.Authorization));
  assert.equal(capture.acquisition.oddsApiRequests,0);assert.equal(capture.acquisition.modelCalls,0);
  assert.equal(capture.decisionAuthority,false);assert.equal(capture.forecastAuthority,false);assert.equal(capture.executionAuthority,false);
  assert.equal(capture.observations[0].lastTradeAt,'2026-10-09T20:59:59.000Z');
  assert.equal(capture.observations[0].settlement.state,'REVIEW_REQUIRED');
  assert.equal(capture.observations[0].raw.book.seq,4);assert.equal(capture.acquisition.receipts[0].cacheAgeSeconds,'3');
});
test('rate-limit failures retain original quote clocks and cannot yield a fresh usable comparison',async()=>{
  const first=await collectNovig({feed,at,fetchImpl:fetchFixture()});
  const urls=[],later='2026-10-09T21:05:00Z';
  const failed=await collectNovig({feed,prior:first,at:later,fetchImpl:fetchFixture(urls,{fail:429})});
  assert.equal(failed.state,'UNAVAILABLE');assert.equal(urls.length,1,'no repeated calls on 429');
  assert.equal(failed.counts.retainedEvents,1);assert.deepEqual(failed.observations,first.observations);
  const ref=novigReference(failed,event,'home',failed.collectedAt);
  assert.equal(ref.acquisitionState,'UNAVAILABLE');assert.equal(ref.observedAt,first.observations[0].observedAt);
  assert.equal(compareNovigPrice(ref,{priceDecimal:1.7,quoteObservedAt:later},failed.collectedAt).sportsbookPayoutDifferencePercent,null);
});
test('tape failures preserve a valid book, and repeated prices record actual sample movement',async()=>{
  const first=await collectNovig({feed,at,fetchImpl:fetchFixture()});
  const fixture=fetchFixture(),second=await collectNovig({feed,prior:first,at:'2026-10-09T21:05:00Z',fetchImpl:async(url,init)=>
    url.includes('/trades?')?{ok:false,status:503}:fixture(url,init)});
  assert.equal(second.state,'COLLECTED');assert.equal(second.observations[0].tradeState,'UNAVAILABLE');
  assert.equal(second.observations[0].movement.home.buyProbabilityChange,0);
  assert.equal(second.observations[0].movement.home.bookSequenceChanged,false);
  assert.equal(second.observations[0].movement.home.from,first.observations[0].observedAt);
});
test('a mid-slate 429 stops all remaining book and tape calls for the shared public throttle',async()=>{
  const otherStart='2026-10-10T00:00:00Z';
  const otherSource={...sourceEvent,eventId:'source-two',startsTs:Date.parse(otherStart)};
  const otherMarket={...market,marketId:'market-two',eventId:otherSource.eventId,startsTs:otherSource.startsTs,
    outcomes:[{outcomeId:'bos',name:'BOS',status:'TBD'},{outcomeId:'phi',name:'PHI',status:'TBD'}]};
  const twoFeed={...feed,events:[...feed.events,{...feed.events[0],id:'other',home:'Boston Bruins',away:'Philadelphia Flyers',date:otherStart}]};
  const urls=[];
  const capture=await collectNovig({feed:twoFeed,at,fetchImpl:async url=>{
    urls.push(url);
    if(url.includes('/book?'))return {ok:false,status:429,headers:new Headers({'Retry-After':'5'})};
    const data=url.includes('/catalog/events?')?{items:[sourceEvent,otherSource]}:{items:[market,otherMarket]};
    return {ok:true,status:200,text:async()=>JSON.stringify(data)};
  }});
  assert.equal(urls.length,3);assert.equal(capture.counts.collectedEvents,0);
  assert.equal(capture.acquisition.receipts.at(-1).retryAfter,'5');
  assert.match(capture.eventStates.find(s=>s.eventId==='other').reason,/deferred/);
});
test('started games and exhausted optional budgets do not create observations or network retries',async()=>{
  const urls=[],empty=await collectNovig({feed,at:start,fetchImpl:fetchFixture(urls)});
  assert.equal(empty.state,'NO_ELIGIBLE_EVENTS');assert.equal(urls.length,0);
  const exhausted=await collectNovig({feed,at,maxDurationMs:0,fetchImpl:fetchFixture(urls)});
  assert.equal(exhausted.state,'UNAVAILABLE');assert.equal(exhausted.observations.length,0);assert.equal(urls.length,0);
});
test('historical isolation, immutable captures and time ordering prevent later data rewriting earlier runs',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'novig-store-'));
  try{
    const first=await collectNovig({feed,at,fetchImpl:fetchFixture()}),second=await collectNovig({feed,at:'2026-10-09T21:05:00Z',fetchImpl:fetchFixture()});
    const filename=saveNovigCapture(root,first);saveNovigCapture(root,second);saveNovigCapture(root,first);
    assert.equal(loadNovigCapture(root,second.collectedAt).snapshotId,second.snapshotId);
    assert.equal(loadNovigCapture(root,first.collectedAt),null);
    assert.equal(fs.readFileSync(filename,'utf8'),JSON.stringify(first,null,2)+'\n');
    assert.throws(()=>saveNovigCapture(root,{...first,decisionAuthority:true}),/Invalid/);
    assert.equal(novigReference(second,event,'home',start),null);
    assert.equal(novigReference(second,{...event,eventId:'other'},'home',second.collectedAt),null);
    const stale=novigReference(first,event,'home','2026-10-09T22:20:00Z');assert.equal(stale.freshness,'REFRESH_REQUIRED');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('report dossiers pin Novig separately from forecast records and preserve original graded decisions',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'novig-dossier-'));
  try{
    const capture=await collectNovig({feed,at,fetchImpl:fetchFixture()});saveNovigCapture(root,capture);
    const quote={eventId:event.eventId,side:'home',book:'Bet365',marketKey:'ml',line:null,priceDecimal:1.7,quoteObservedAt:at,selectionKey:'nhl-test|ml|home||'};
    const selection={selectionId:'NHL|nhl-test|full_game_moneyline|home',eventId:event.eventId,eventDate:start,sport:'NHL',marketDetail:'full_game_moneyline',side:'home',quotes:[quote]};
    const report={ts:capture.collectedAt},sidecar={},universe={selections:[selection]};
    bindIntelligence({root,report,sidecar,feed,universe});
    assert.equal(sidecar.gameIntelligenceInputs.novigMarketData.snapshotId,capture.snapshotId);
    assert.deepEqual(sidecar.forecastEvidence.records,[]);
    const view=buildGameIntelligence({report,sidecar,feed,universe,candidateAssessment:{selections:[{selectionId:selection.selectionId,status:'LEAN',reviewState:'COMPLETED'}]}});
    const selected=view.games[0].markets[0];
    assert.equal(selected.status,'LEAN');assert.equal(selected.quotes[0].supplementalMarketReferences[0].priceAmerican,'-153');
    assert.equal(selected.quotes[0].supplementalMarketReferences[0].comparisonState,'SHADOW_PRICE_COMPARISON');
    assert.equal(selected.quotes[0].supplementalMarketReferences[0].decisionAuthority,false);
    assert.equal(view.counts.withExternalModels,0);assert.deepEqual(view.games[0].consensus,[]);
    const inputs=structuredClone(sidecar.gameIntelligenceInputs);saveNovigCapture(root,await collectNovig({feed,at:'2026-10-09T21:05:00Z',fetchImpl:fetchFixture()}));
    bindIntelligence({root,report,sidecar,feed,universe});assert.deepEqual(sidecar.gameIntelligenceInputs,inputs);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('current board includes a Novig capture collected after the forecast capture without changing source clocks',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'novig-board-'));
  try{
    const capture=await collectNovig({feed,at:'2026-10-09T21:05:00Z',fetchImpl:fetchFixture()});saveNovigCapture(root,capture);
    fs.mkdirSync(path.join(root,'data/game-intelligence'),{recursive:true});
    fs.writeFileSync(path.join(root,'data/game-intelligence/current.json'),JSON.stringify({schema:1,collectedAt:at,records:[],facts:[],sources:[]}));
    fs.writeFileSync(path.join(root,'data/live-odds.json'),JSON.stringify({...feed,events:[{...feed.events[0],bookmakers:{Bet365:[{
      name:'ML',marketKey:'ml',updatedAt:at,observedAt:at,odds:[{home:'1.7',away:'2.2',selectionKeys:{home:'nhl-test|ml|home||',away:'nhl-test|ml|away||'}}]
    }]}}]}));
    fs.copyFileSync('data/major-sport-market-coverage-v1.json',path.join(root,'data/major-sport-market-coverage-v1.json'));
    const board=buildBoard(root);
    assert.equal(board.asOf,capture.collectedAt);assert.equal(board.collectedAt,at);
    assert.equal(board.games[0].markets[0].quotes[0].supplementalMarketReferences[0].observedAt,capture.observations[0].observedAt);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

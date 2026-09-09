import assert from 'node:assert/strict';
import {summarizePinnacle} from '../tools/oddspapi-observer.mjs';
import {annotatePinnacle,UNAVAILABLE} from '../tools/pinnacle-sharp-benchmark.mjs';

const observedAt='2026-09-09T22:09:06.775Z';
const changedAt='2026-09-09T22:06:52.827Z';
function market(bookmakerMarketId,{mainLine=false,line=44.5}={}){
  return {marketActive:true,bookmakerMarketId,outcomes:{
    over:{players:{0:{bookmakerOutcomeId:`${line}/over`,price:1.99,priceAmerican:'-101',active:true,mainLine,limit:37878,bookmakerChangedAt:changedAt,changedAt}}},
    under:{players:{0:{bookmakerOutcomeId:`${line}/under`,price:1.884,priceAmerican:'-113',active:true,mainLine,limit:42420,bookmakerChangedAt:changedAt,changedAt}}}
  }};
}
function cappedBook(){
  const markets={};
  for(let i=0;i<12;i++)markets[`ordinary-${i}`]=market(`altLine/15/889/123/456/${i}/0/spreads`);
  // Extra totals do not consume slots previously available to main lines.
  markets['early-extra-total']=market('altLine/15/889/123/456/100/0/totals',{line:43.5});
  markets['early-extra-spread']=market('altLine/15/889/123/456/101/0/spreads');
  for(let i=0;i<12;i++)markets[`main-${i}`]=market(`line/15/889/123/${i}/0/totals`,{mainLine:true,line:30+i});
  markets['late-total']=market('altLine/15/889/123/456/102/0/totals');
  markets['later-total']=market('altLine/15/889/123/456/103/0/totals',{line:45});
  markets['late-spread']=market('altLine/15/889/123/456/104/0/spreads');
  markets['late-period']=market('altLine/15/889/123/456/105/1/totals');
  markets['late-team-total']=market('altLine/15/889/123/456/106/0/teamTotals');
  markets['late-main']=market('line/15/889/123/999/0/totals',{mainLine:true});
  return {bookmakerIsActive:true,suspended:false,markets};
}

const book=cappedBook(),original=structuredClone(book);
const savedFetch=globalThis.fetch;
let calls=0,result;
try{
  globalThis.fetch=()=>{calls++;throw new Error('Retention must use the collected response without new requests');};
  result=summarizePinnacle(book,observedAt);
}finally{globalThis.fetch=savedFetch;}
assert.equal(calls,0);
assert.deepEqual(book,original,'retention must not change source quotes');
assert.equal(result.markets.length,27,'24 original slots plus three exact alternate totals');
assert.equal(result.marketCount,Object.keys(book.markets).length);
const ids=new Set(result.markets.map(m=>m.marketId));
for(let i=0;i<12;i++)assert.ok(ids.has(`ordinary-${i}`)&&ids.has(`main-${i}`),'all original retained markets survive');
for(const id of ['early-extra-total','late-total','later-total'])assert.ok(ids.has(id),id);
for(const id of ['early-extra-spread','late-spread','late-period','late-team-total','late-main'])assert.ok(!ids.has(id),`ordinary retention rules unchanged: ${id}`);
const total=result.markets.find(m=>m.marketId==='late-total');
assert.deepEqual(total.outcomes.flatMap(o=>o.players).map(q=>({changed:q.bookmakerChangedAt,providerChanged:q.changedAt,observed:q.observedAt,main:q.mainLine})),[
  {changed:changedAt,providerChanged:changedAt,observed:observedAt,main:false},
  {changed:changedAt,providerChanged:changedAt,observed:observedAt,main:false}
]);
annotatePinnacle(result,{generatedAt:observedAt,primaryMatch:{eventId:'71515752'},quoteObservationVersion:1});
assert.equal(total.benchmark.state,UNAVAILABLE,'collection alone must not change historical main-line qualification');
assert.equal(total.benchmark.reason,'COMPLETE_TWO_WAY_MAIN_LINE_REQUIRED');

const ordinaryOnly={bookmakerIsActive:true,suspended:false,markets:{}};
for(let i=0;i<40;i++)ordinaryOnly.markets[`alt-${i}`]=market(`altLine/15/889/123/456/${i}/0/spreads`);
assert.equal(summarizePinnacle(ordinaryOnly,observedAt).markets.length,12,'ordinary alternate sample remains capped at 12');
const mainsOnly={bookmakerIsActive:true,suspended:false,markets:{}};
for(let i=0;i<40;i++)mainsOnly.markets[`main-${i}`]=market(`line/15/889/123/${i}/0/totals`,{mainLine:true});
assert.equal(summarizePinnacle(mainsOnly,observedAt).markets.length,24,'ordinary main-line budget remains capped at 24');
console.log('PINNACLE TOTAL RETENTION: PASS // late exact totals retained, ordinary caps preserved, timestamps unchanged, no new requests or default qualification changes');

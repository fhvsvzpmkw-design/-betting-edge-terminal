#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

export const AUTHORITY='OFFICIAL_NON_EXECUTABLE_SHARP_BENCHMARK';
export const QUALIFIED='QUALIFIED';
export const UNAVAILABLE='PINNACLE_BENCHMARK_UNAVAILABLE';

export function americanFromDecimal(value){
  const d=Number(value);
  if(!Number.isFinite(d)||d<=1) return null;
  const n=d>=2?Math.round((d-1)*100):-Math.round(100/(d-1));
  return n>0?`+${n}`:String(n);
}

export function noVigTwoWay(prices){
  if(!Array.isArray(prices)||prices.length!==2) return null;
  const decimal=prices.map(Number);
  if(decimal.some(v=>!Number.isFinite(v)||v<=1)) return null;
  const raw=decimal.map(v=>1/v);
  const overround=raw[0]+raw[1];
  if(!Number.isFinite(overround)||overround<=0) return null;
  return raw.map((p,index)=>{
    const probability=p/overround;
    const fairDecimal=1/probability;
    return {
      probability:Number(probability.toFixed(8)),
      priceDecimal:Number(fairDecimal.toFixed(4)),
      priceAmerican:americanFromDecimal(fairDecimal),
      sourcePriceDecimal:decimal[index]
    };
  });
}

function quoteTime(quote){
  const raw=quote?.bookmakerChangedAt||quote?.changedAt||null;
  const ms=Date.parse(raw||'');
  return Number.isFinite(ms)?{raw,ms}:null;
}

export function qualifyMarket({market,generatedAt,primaryMatch,bookmakerIsActive=true,suspended=false,quoteFreshnessMinutes=30,futureClockSkewToleranceMinutes=5}={}){
  const base={state:UNAVAILABLE,authority:AUTHORITY,executionAuthority:false,decisionAuthority:false,fairValueAuthority:false,reason:null,generatedAt:generatedAt||null,pairedOutcomes:[]};
  if(!primaryMatch){base.reason='PRIMARY_EVENT_MATCH_REQUIRED';return base;}
  if(bookmakerIsActive!==true){base.reason='BOOKMAKER_INACTIVE';return base;}
  if(suspended===true){base.reason='BOOKMAKER_SUSPENDED';return base;}
  if(!market||market.marketActive===false){base.reason='MARKET_INACTIVE';return base;}
  const outcomes=Array.isArray(market.outcomes)?market.outcomes:[];
  const rows=[];
  for(const outcome of outcomes){
    const players=Array.isArray(outcome?.players)?outcome.players:[];
    for(const quote of players){
      if(quote?.mainLine===true) rows.push({outcomeId:String(outcome?.outcomeId??''),quote});
    }
  }
  if(rows.length!==2||new Set(rows.map(row=>row.outcomeId)).size!==2){base.reason='COMPLETE_TWO_WAY_MAIN_LINE_REQUIRED';return base;}
  if(rows.some(row=>row.quote?.active!==true)){base.reason='QUOTE_INACTIVE';return base;}
  const generatedMs=Date.parse(generatedAt||'');
  if(!Number.isFinite(generatedMs)){base.reason='OBSERVER_TIMESTAMP_INVALID';return base;}
  const quoteTimes=rows.map(row=>quoteTime(row.quote));
  if(quoteTimes.some(value=>!value)){base.reason='QUOTE_TIMESTAMP_INVALID';return base;}
  const ages=quoteTimes.map(value=>(generatedMs-value.ms)/60000);
  if(ages.some(age=>age < -futureClockSkewToleranceMinutes || age > quoteFreshnessMinutes)){
    base.reason='QUOTE_STALE';
    base.maxQuoteAgeMinutes=Number(Math.max(...ages).toFixed(2));
    return base;
  }
  const prices=rows.map(row=>Number(row.quote.price));
  const noVig=noVigTwoWay(prices);
  if(!noVig){base.reason='NO_VIG_PAIR_INVALID';return base;}
  base.state=QUALIFIED;
  base.reason=null;
  base.maxQuoteAgeMinutes=Number(Math.max(...ages).toFixed(2));
  base.overround=Number((prices.reduce((sum,p)=>sum+1/p,0)-1).toFixed(8));
  base.pairedOutcomes=rows.map((row,index)=>({
    outcomeId:row.outcomeId,
    playerId:String(row.quote?.playerId??''),
    bookmakerOutcomeId:row.quote?.bookmakerOutcomeId??null,
    price:Number(row.quote.price),
    priceAmerican:row.quote?.priceAmerican??null,
    noVigProbability:noVig[index].probability,
    noVigPriceDecimal:noVig[index].priceDecimal,
    noVigPriceAmerican:noVig[index].priceAmerican,
    quoteChangedAt:quoteTimes[index].raw,
    limit:Number.isFinite(Number(row.quote?.limit))?Number(row.quote.limit):null
  }));
  return base;
}

export function annotatePinnacle(pinnacle,{generatedAt,primaryMatch,quoteFreshnessMinutes=30,futureClockSkewToleranceMinutes=5}={}){
  if(!pinnacle||typeof pinnacle!=='object') return pinnacle;
  const markets=Array.isArray(pinnacle.markets)?pinnacle.markets:[];
  let qualified=0;
  for(const market of markets){
    market.benchmark=qualifyMarket({
      market,
      generatedAt,
      primaryMatch,
      bookmakerIsActive:pinnacle.bookmakerIsActive===true,
      suspended:pinnacle.suspended===true,
      quoteFreshnessMinutes,
      futureClockSkewToleranceMinutes
    });
    if(market.benchmark.state===QUALIFIED) qualified++;
  }
  pinnacle.benchmarkAuthority=AUTHORITY;
  pinnacle.executionAuthority=false;
  pinnacle.qualifiedBenchmarkMarkets=qualified;
  return pinnacle;
}

export function validateObserver(observer,{observerFreshnessMinutes=75,quoteFreshnessMinutes=30,futureClockSkewToleranceMinutes=5,asOf=new Date()}={}){
  const errors=[];
  if(!observer||typeof observer!=='object') return {ok:false,errors:['observer missing']};
  if(observer.mode!=='official-sharp-benchmark') errors.push('observer mode is not official-sharp-benchmark');
  if(observer.benchmarkAuthority!==AUTHORITY) errors.push('observer benchmark authority mismatch');
  if(observer.executionAuthority!==false) errors.push('observer must remain non-executable');
  if(observer.status==='ok'){
    const generatedMs=Date.parse(observer.generatedAt||'');
    const asOfMs=asOf instanceof Date?asOf.getTime():Date.parse(asOf||'');
    if(!Number.isFinite(generatedMs)) errors.push('observer generatedAt invalid');
    else if(Number.isFinite(asOfMs)){
      const age=(asOfMs-generatedMs)/60000;
      if(age < -futureClockSkewToleranceMinutes || age > observerFreshnessMinutes) errors.push('observer stale');
    }
    for(const fixture of observer.fixtures||[]){
      const pinnacle=fixture?.pinnacle;
      if(!pinnacle) continue;
      for(const market of pinnacle.markets||[]){
        const expected=qualifyMarket({market,generatedAt:observer.generatedAt,primaryMatch:fixture.primaryMatch,bookmakerIsActive:pinnacle.bookmakerIsActive===true,suspended:pinnacle.suspended===true,quoteFreshnessMinutes,futureClockSkewToleranceMinutes});
        const actual=market?.benchmark;
        if(JSON.stringify(actual)!==JSON.stringify(expected)) errors.push(`benchmark drift fixture=${fixture.fixtureId||'unknown'} market=${market.marketId||'unknown'}`);
      }
    }
  }
  return {ok:errors.length===0,errors};
}

function selfTest(){
  const generatedAt='2026-09-01T17:00:00.000Z';
  const market={marketId:'131',marketActive:true,outcomes:[
    {outcomeId:'home',players:[{playerId:'0',bookmakerOutcomeId:'home',bookmakerChangedAt:'2026-09-01T16:55:00.000Z',price:1.8,priceAmerican:'-125',active:true,mainLine:true,limit:9000}]},
    {outcomeId:'away',players:[{playerId:'0',bookmakerOutcomeId:'away',bookmakerChangedAt:'2026-09-01T16:55:00.000Z',price:2.15,priceAmerican:'+115',active:true,mainLine:true,limit:7500}]}
  ]};
  const q=qualifyMarket({market,generatedAt,primaryMatch:{eventId:'1'},bookmakerIsActive:true,suspended:false});
  assert.equal(q.state,QUALIFIED);
  assert.equal(q.pairedOutcomes.length,2);
  assert.ok(Math.abs(q.pairedOutcomes.reduce((s,x)=>s+x.noVigProbability,0)-1)<1e-7);
  assert.equal(qualifyMarket({market,generatedAt,primaryMatch:null}).reason,'PRIMARY_EVENT_MATCH_REQUIRED');
  assert.equal(qualifyMarket({market,generatedAt,primaryMatch:{eventId:'1'},suspended:true}).reason,'BOOKMAKER_SUSPENDED');
  const stale=structuredClone(market);stale.outcomes[0].players[0].bookmakerChangedAt='2026-09-01T16:00:00.000Z';
  assert.equal(qualifyMarket({market:stale,generatedAt,primaryMatch:{eventId:'1'}}).reason,'QUOTE_STALE');
  const alt=structuredClone(market);alt.outcomes[0].players[0].mainLine=false;
  assert.equal(qualifyMarket({market:alt,generatedAt,primaryMatch:{eventId:'1'}}).reason,'COMPLETE_TWO_WAY_MAIN_LINE_REQUIRED');
  console.log('Pinnacle sharp benchmark self-test passed');
}

const command=process.argv[2];
if(command==='self-test') selfTest();
if(command==='validate-observer'){
  const file=process.argv[3]||'data/oddspapi-observer.json';
  const observer=JSON.parse(fs.readFileSync(file,'utf8'));
  const result=validateObserver(observer);
  if(!result.ok){for(const error of result.errors) console.error(error);process.exit(1);}
  console.log(`Pinnacle observer validation passed // ${file}`);
}

#!/usr/bin/env node
// Optional market observations. No orders, sportsbook pulls or decision writes.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {mergedFeedEvents,majorSportKey} from './major-sport-market-coverage-gate.mjs';

export const NOVIG_HOST='https://api.novig.com';
export const NOVIG_MODE='NHL_MONEYLINE_SHADOW';
const list=x=>Array.isArray(x)?x:[];
const time=x=>Date.parse(x||'');
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const read=file=>{try{return JSON.parse(fs.readFileSync(file));}catch{return null;}};
const json=x=>JSON.stringify(x,null,2)+'\n';
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const teams={ANA:'Anaheim Ducks',BOS:'Boston Bruins',BUF:'Buffalo Sabres',CAR:'Carolina Hurricanes',CBJ:'Columbus Blue Jackets',
  CGY:'Calgary Flames',CHI:'Chicago Blackhawks',COL:'Colorado Avalanche',DAL:'Dallas Stars',DET:'Detroit Red Wings',
  EDM:'Edmonton Oilers',FLA:'Florida Panthers',LAK:'Los Angeles Kings',MIN:'Minnesota Wild',MTL:'Montreal Canadiens',
  NJD:'New Jersey Devils',NSH:'Nashville Predators',NYI:'New York Islanders',NYR:'New York Rangers',OTT:'Ottawa Senators',
  PHI:'Philadelphia Flyers',PIT:'Pittsburgh Penguins',SEA:'Seattle Kraken',SJS:'San Jose Sharks',STL:'St. Louis Blues',
  TBL:'Tampa Bay Lightning',TOR:'Toronto Maple Leafs',UTA:'Utah Mammoth',VAN:'Vancouver Canucks',VGK:'Vegas Golden Knights',
  WPG:'Winnipeg Jets',WSH:'Washington Capitals'};
const aliases=new Map(Object.entries(teams).flatMap(([code,name])=>[[norm(code),code],[norm(name),code]]));
for(const [alias,code] of Object.entries({LA:'LAK',SJ:'SJS',TB:'TBL',NJ:'NJD',WAS:'WSH',MON:'MTL'}))aliases.set(alias,code);
export const nhlCode=value=>aliases.get(norm(value))||null;
export function probabilityToAmerican(p){
  if(typeof p!=='number'||!Number.isFinite(p)||p<=0||p>=1)return null;
  const value=Math.round(p>.5?-100*p/(1-p):100*(1-p)/p);
  return value>0?'+'+value:String(value);
}

// Match both named outcomes and the exact start. Never infer teams from the
// outcome array position or parse the unversioned market description.
export function matchNovigMarket(event,catalogEvents,markets){
  const home=nhlCode(event.home),away=nhlCode(event.away);
  if(event.sport!=='NHL'||!home||!away||home===away||!Number.isFinite(time(event.startTime)))return null;
  const matches=list(markets).filter(m=>{
    const sources=list(catalogEvents).filter(e=>e.eventId===m.eventId&&e.league==='NHL'&&e.sport==='ICE_HOCKEY'&&e.status==='OPEN_PREGAME'&&e.startsTs===time(event.startTime));
    const outcomes=list(m.outcomes),codes=outcomes.map(o=>nhlCode(o.name));
    return sources.length===1&&m.startsTs===time(event.startTime)&&m.marketType==='MONEY'&&m.status==='OPEN'&&
      (m.strike==null||m.strike==='0')&&outcomes.length===2&&outcomes.every(o=>o.outcomeId&&o.status==='TBD')&&
      new Set(outcomes.map(o=>o.outcomeId)).size===2&&codes.includes(home)&&codes.includes(away);
  });
  if(matches.length!==1)return null;
  const market=matches[0];
  return {market,sourceEvent:list(catalogEvents).find(e=>e.eventId===market.eventId),
    outcomes:{home:market.outcomes.find(o=>nhlCode(o.name)===home),away:market.outcomes.find(o=>nhlCode(o.name)===away)}};
}
function priceMilli(value){
  if(typeof value!=='string'||!/^0\.\d{1,3}$/.test(value))throw Error('Invalid Novig price');
  const n=Math.round(Number(value)*1000);if(n<=0||n>=1000)throw Error('Invalid Novig price');return n;
}
function bestBid(rows){
  if(!Array.isArray(rows))throw Error('Invalid Novig order array');
  if(!rows.length)return null;
  const prices=rows.map(o=>{
    if(!o.orderId||!Number.isSafeInteger(o.qty)||o.qty<=0)throw Error('Invalid Novig order quantity');
    return priceMilli(o.price);
  });
  const best=Math.max(...prices);
  if(prices[0]!==best)throw Error('Novig book is not best-price first');
  const quantity=rows.reduce((n,o,i)=>n+(prices[i]===best?o.qty:0),0);
  if(!Number.isSafeInteger(quantity))throw Error('Novig quantity exceeds safe range');
  return {priceMilli:best,rawApiQty:quantity,orders:prices.filter(p=>p===best).length};
}
export function novigQuotes(match,book){
  if(book.marketId!==match.market.marketId||!Number.isSafeInteger(book.seq)||book.seq<0||!book.orders||typeof book.orders!=='object')throw Error('Novig book identity invalid');
  const ids=Object.values(match.outcomes).map(o=>o.outcomeId);
  if(Object.keys(book.orders).some(id=>!ids.includes(id)))throw Error('Unexpected Novig outcome in book');
  const bids=Object.fromEntries(['home','away'].map(side=>[side,bestBid(book.orders[match.outcomes[side].outcomeId]||[])]));
  if(bids.home&&bids.away&&bids.home.priceMilli+bids.away.priceMilli>1000)throw Error('Crossed Novig book');
  return ['home','away'].map(side=>{
    const opposing=bids[side==='home'?'away':'home'],bid=bids[side],buy=opposing?(1000-opposing.priceMilli)/1000:null;
    return {side,outcomeId:match.outcomes[side].outcomeId,sourceTeam:match.outcomes[side].name,
      bidProbability:bid?bid.priceMilli/1000:null,buyProbability:buy,priceAmerican:probabilityToAmerican(buy),
      priceDecimal:buy===null?null:1/buy,bidAskSpreadProbability:buy!==null&&bid?(1000-opposing.priceMilli-bid.priceMilli)/1000:null,
      availableRawApiQty:opposing?.rawApiQty||0,availableOrders:opposing?.orders||0,
      // API qty is in the currency's smallest unit (1 cent of payout), unlike
      // the public daily reporting files' dollar-sized contracts.
      apiPayoutUnitUsd:.01,availablePayoutUsd:opposing?opposing.rawApiQty/100:0,
      availableCostUsd:opposing?opposing.rawApiQty*buy/100:0,
      state:buy===null?'NO_OFFER':'OFFER_AVAILABLE'};
  });
}
function observationIdentity(row,event){
  return String(row.eventId)===String(event.eventId)&&row.sport==='NHL'&&row.home===event.home&&row.away===event.away&&time(row.startTime)===time(event.startTime);
}
export function novigReference(capture,event,side,asOf){
  if(capture?.schema!==1||capture.mode!==NOVIG_MODE||capture.decisionAuthority!==false||time(capture.collectedAt)>time(asOf))return null;
  const rows=list(capture.observations).filter(r=>observationIdentity(r,event)&&Number.isFinite(time(r.observedAt))&&
    time(r.observedAt)<=time(asOf)&&time(r.observedAt)<time(r.startTime)&&time(asOf)<time(r.startTime));
  if(rows.length!==1)return null;
  const row=rows[0],quote=list(row.quotes).find(q=>q.side===side);if(!quote)return null;
  const ageMinutes=(time(asOf)-time(row.observedAt))/60000;
  return {sourceId:'novig',mode:NOVIG_MODE,decisionAuthority:false,executionAuthority:false,forecastAuthority:false,
    marketId:row.marketId,sourceEventId:row.sourceEventId,url:row.url,observedAt:row.observedAt,
    lastTradeAt:row.lastTradeAt,ageMinutes,freshness:ageMinutes<=75?'RECENT_CAPTURE':'REFRESH_REQUIRED',
    acquisitionState:capture.eventStates?.find(s=>observationIdentity(s,event))?.state||'UNKNOWN',
    ...quote,movement:row.movement?.[side]||null,settlement:row.settlement,fee:row.fee,
    limitation:'Shadow exchange price, not a forecast or fair probability. Exact NHL OT/shootout and fair-market-value void settlement require review before analytical adoption.'};
}
export function compareNovigPrice(reference,quote,asOf){
  if(!reference)return null;
  const observedAt=quote.quoteObservedAt||quote.observedAt||quote.quoteUpdatedAt||quote.updatedAt;
  const age=(time(asOf)-time(observedAt))/60000;
  const usable=reference.freshness==='RECENT_CAPTURE'&&reference.acquisitionState==='COLLECTED'&&reference.state==='OFFER_AVAILABLE'&&
    Number.isFinite(age)&&age>=0&&age<=75&&quote.priceDecimal>1;
  return {...reference,sportsbookObservedAt:observedAt||null,sportsbookFreshness:Number.isFinite(age)&&age>=0&&age<=75?'RECENT_SNAPSHOT':'REFRESH_REQUIRED',
    comparisonState:usable?'SHADOW_PRICE_COMPARISON':'UNAVAILABLE_OR_STALE',
    // A price gap is descriptive; no EV, probability edge, vote or grade.
    sportsbookPayoutDifferencePercent:usable?(quote.priceDecimal/reference.priceDecimal-1)*100:null,
    decisionAuthority:false};
}

export async function collectNovig({feed,prior=null,at=new Date().toISOString(),fetchImpl=fetch,maxDurationMs=45000,requestIntervalMs=1000}={}){
  if(!feed||!Number.isFinite(time(at)))throw Error('Novig requires actual clock and existing event feed');
  const elapsedStart=Date.now(),clock=()=>new Date(time(at)+Date.now()-elapsedStart).toISOString();
  const events=[...mergedFeedEvents(feed).values()].filter(e=>majorSportKey(e)==='NHL').map(e=>({eventId:String(e.eventId||e.id),sport:'NHL',home:e.home,away:e.away,startTime:e.date||e.identity?.startTime}))
    .filter(e=>time(e.startTime)>time(at)&&time(e.startTime)-time(at)<=48*3600000);
  const requests=[],observations=[],eventStates=[];
  let successful=0;
  let lastRequestStarted=0,rateLimited=false;
  const retained=event=>prior?.mode===NOVIG_MODE&&time(prior.collectedAt)<=time(at)?list(prior.observations).filter(r=>observationIdentity(r,event)&&time(r.observedAt)<=time(at)):[];
  const fail=(event,error)=>{observations.push(...retained(event));eventStates.push({...event,state:'UNAVAILABLE',checkedAt:clock(),reason:error.message,retainedOriginalObservation:retained(event).length===1});};
  async function get(route){
    if(rateLimited)throw Error('Novig rate limit: remaining optional requests deferred until the next run');
    const pause=Math.max(0,lastRequestStarted+requestIntervalMs-Date.now());
    if(pause>=maxDurationMs-(Date.now()-elapsedStart))throw Error('Novig optional collection budget exhausted');
    if(pause)await new Promise(resolve=>setTimeout(resolve,pause));
    const remaining=maxDurationMs-(Date.now()-elapsedStart);
    if(remaining<=0||requests.length>=80)throw Error('Novig optional collection budget exhausted');
    lastRequestStarted=Date.now();
    const url=NOVIG_HOST+route,receipt={url,requestedAt:clock()};requests.push(receipt);
    try{
      const response=await fetchImpl(url,{headers:{Accept:'application/json','User-Agent':'VigWireLabs-NovigTrial/1.0'},signal:AbortSignal.timeout(Math.max(1,Math.min(6000,remaining)))});
      Object.assign(receipt,{status:response.status,observedAt:clock(),cacheAgeSeconds:response.headers?.get('Age')||null,serverDate:response.headers?.get('Date')||null,retryAfter:response.headers?.get('Retry-After')||null});
      if(response.status===429)rateLimited=true;
      if(!response.ok)throw Error(`Novig HTTP ${response.status}`); // No retries on 429, no key or alternate-host fallback.
      const text=await response.text();if(text.length>2*1024*1024)throw Error('Novig response exceeds 2 MiB');
      return {data:JSON.parse(text),observedAt:receipt.observedAt};
    }catch(error){receipt.error=error.message;throw error;}
  }
  async function catalog(kind){
    const params=new URLSearchParams({league:'NHL',startsAfter:String(time(at)),startsBefore:String(time(at)+48*3600000),limit:'500'});
    if(kind==='markets')params.set('marketType','MONEY');
    const rows=[],seen=new Set();
    for(let page=0;page<5;page++){
      const {data}=await get(`/v3/public/catalog/${kind}?${params}`);
      if(!Array.isArray(data.items))throw Error('Invalid Novig catalogue');rows.push(...data.items);
      if(!data.next)return rows;
      if(typeof data.next!=='string'||seen.has(data.next))throw Error('Invalid Novig catalogue cursor');
      seen.add(data.next);params.set('after',data.next);
    }
    throw Error('Novig catalogue pagination limit reached');
  }
  if(events.length)try{
    const catalogEvents=await catalog('events'),markets=await catalog('markets');
    const pending=[...events];
    // One request at a time, paced at one per second, within 45 seconds.
    await Promise.all(Array.from({length:Math.min(1,pending.length)},async()=>{
      while(pending.length){
        const event=pending.shift();
        try{
          const match=matchNovigMarket(event,catalogEvents,markets);
          if(!match)throw Error('No unique exact pregame Novig NHL MONEY market');
          const route=`/v3/public/catalog/markets/${encodeURIComponent(match.market.marketId)}`;
          const {data:book,observedAt}=await get(route+'/book?depth=3');
          if(time(observedAt)>=time(event.startTime))throw Error('Event started during Novig collection');
          const quotes=novigQuotes(match,book),previous=retained(event)[0];
          let tape=[],tradeState='UNAVAILABLE';
          try{
            const {data}=await get(route+'/trades?limit=20');
            if(!Array.isArray(data.items))throw Error('Invalid Novig tape');
            const ids=Object.values(match.outcomes).map(o=>o.outcomeId);
            tape=data.items.filter(t=>ids.includes(t.outcomeId)&&Number.isSafeInteger(t.ts)&&t.ts<=time(clock())&&t.ts<time(event.startTime)&&Number.isSafeInteger(t.qty)&&t.qty>0)
              .map(t=>({...t,priceProbability:priceMilli(t.price)/1000}));
            tradeState='COLLECTED';
          }catch{/* A tape failure never discards a valid order-book observation. */}
          if(time(clock())>=time(event.startTime))throw Error('Event started during Novig tape collection');
          const movement=Object.fromEntries(quotes.map(q=>{
            const old=previous?.marketId===match.market.marketId?previous.quotes?.find(x=>x.side===q.side):null;
            return [q.side,old&&time(previous.observedAt)<time(observedAt)?{from:previous.observedAt,to:observedAt,
              buyProbabilityChange:q.buyProbability!==null&&old.buyProbability!==null?q.buyProbability-old.buyProbability:null,
              priorPriceAmerican:old.priceAmerican,bookSequenceChanged:previous.bookSequence!==book.seq}:null];
          }));
          const row={...event,sourceId:'novig',kind:'EXCHANGE_MARKET',marketDetail:'full_game_moneyline',sourceEventId:match.market.eventId,
            marketId:match.market.marketId,url:NOVIG_HOST+route+'/book',observedAt,bookSequence:book.seq,quotes,movement,
            fee:match.market.fee||null,voids:match.market.voids||null,
            settlement:{state:'REVIEW_REQUIRED',sourceMarketType:'MONEY',includesOvertime:null,includesShootout:null,voidRule:match.market.voids||null},
            raw:{event:match.sourceEvent,market:match.market,book,trades:tape},tradeState,
            lastTradeAt:tape.length?new Date(Math.max(...tape.map(t=>t.ts))).toISOString():null};
          row.observationId=digest(row);observations.push(row);successful++;
          eventStates.push({...event,state:'COLLECTED',checkedAt:clock(),marketId:row.marketId,tradeState});
        }catch(error){fail(event,error);}
      }
    }));
  }catch(error){for(const event of events)fail(event,error);}
  const capture={schema:1,sourceId:'novig',mode:NOVIG_MODE,collectedAt:clock(),feedGeneratedAt:feed.generatedAt||null,
    decisionAuthority:false,executionAuthority:false,forecastAuthority:false,
    state:!events.length?'NO_ELIGIBLE_EVENTS':successful===events.length?'COLLECTED':successful?'PARTIAL':'UNAVAILABLE',
    observations:observations.sort((a,b)=>a.eventId.localeCompare(b.eventId)),eventStates:eventStates.sort((a,b)=>a.eventId.localeCompare(b.eventId)),
    acquisition:{requests:requests.length,oddsApiRequests:0,modelCalls:0,authenticated:false,receipts:requests},
    counts:{eligibleEvents:events.length,collectedEvents:successful,retainedEvents:observations.length-successful},
    limitation:'NHL moneyline shadow collection only. No calibration, EV or grading authority. Review settlement, liquidity, timestamps and source-use terms before wider adoption.'};
  capture.snapshotId=digest(capture);return capture;
}
export function saveNovigCapture(root,capture){
  const {snapshotId,...value}=capture||{};
  if(!captureShape(capture)||snapshotId!==digest(value))throw Error('Invalid Novig shadow capture');
  const dir=path.join(root,'data/novig'),file=path.join(dir,'captures',`${capture.collectedAt.slice(0,10)}-${snapshotId}.json`);
  fs.mkdirSync(path.dirname(file),{recursive:true});const bytes=json(capture);
  if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')!==bytes)throw Error('Immutable Novig capture conflict');
  if(!fs.existsSync(file))fs.writeFileSync(file,bytes,{flag:'wx'});
  const current=path.join(dir,'current.json'),prior=read(current);
  if(!prior||time(prior.collectedAt)<=time(capture.collectedAt)){fs.writeFileSync(current+'.tmp',bytes);fs.renameSync(current+'.tmp',current);}
  return file;
}
function captureShape(capture){
  return capture?.schema===1&&capture.sourceId==='novig'&&capture.mode===NOVIG_MODE&&capture.decisionAuthority===false&&
    capture.executionAuthority===false&&capture.forecastAuthority===false&&Number.isFinite(time(capture.collectedAt))&&
    Array.isArray(capture.observations)&&Array.isArray(capture.eventStates)&&capture.acquisition&&
    Number.isSafeInteger(capture.acquisition.requests)&&capture.observations.every(row=>row?.sourceId==='novig'&&row.kind==='EXCHANGE_MARKET'&&
      row.marketDetail==='full_game_moneyline'&&row.sport==='NHL'&&row.eventId&&row.marketId&&
      Number.isFinite(time(row.observedAt))&&time(row.observedAt)<=time(capture.collectedAt)&&time(row.observedAt)<time(row.startTime)&&
      Array.isArray(row.quotes)&&row.quotes.length===2&&['home','away'].every(side=>row.quotes.filter(q=>q.side===side).length===1));
}
export function loadNovigCapture(root,asOf){
  const capture=read(path.join(root,'data/novig/current.json'));
  if(!captureShape(capture)||time(capture.collectedAt)>time(asOf))return null;
  const {snapshotId,...value}=capture;if(snapshotId!==digest(value))return null;
  return capture;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    const args=process.argv.slice(2),value=flag=>args[args.indexOf(flag)+1],root=path.resolve(args.includes('--root')?value('--root'):'.');
    const capture=await collectNovig({feed:read(path.join(root,'data/live-odds.json')),prior:read(path.join(root,'data/novig/current.json'))});
    if(args.includes('--candidate'))fs.writeFileSync(path.resolve(value('--candidate')),json(capture));else saveNovigCapture(root,capture);
    console.log(json({sourceId:capture.sourceId,state:capture.state,mode:capture.mode,collectedAt:capture.collectedAt,counts:capture.counts,requests:capture.acquisition.requests}));
  }catch(error){console.error('Optional Novig collector: '+error.message);process.exitCode=1;}
}

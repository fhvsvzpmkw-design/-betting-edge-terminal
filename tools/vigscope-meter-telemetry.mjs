#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {derivePrimarySelectionInventory} from './major-sport-market-coverage-gate.mjs';
import {
  VIG_METER_CALIBRATION_ID,
  calibratedHeat,
  calibratedPressure,
  clamp
} from './vigscope-meter-production.mjs';

export const VIG_METER_TELEMETRY_SCHEMA=1;
export const VIG_METER_TELEMETRY_AUTHORITY='PUBLISHER_BOUND_FEED_V1';
export const EXECUTION_BOOKS=Object.freeze(['Bet365','DraftKings']);
export const QUOTE_MAX_AGE_MINUTES=30;
export const RESILIENT_METER_CUTOVER='2026-09-05T11:00:00-07:00';
export const PRIMARY_MARKET_METER_CUTOVER='2026-09-06T00:00:00-07:00';
export const METER_BASELINE_MAX_HOURS=24;
const ODDS_INDEX_PATH='data/history/odds-index.json';
export function usesResilientMeterTelemetry(report){return Date.parse(report?.ts)>=Date.parse(RESILIENT_METER_CUTOVER);}
export function usesPrimaryMarketTelemetry(report){return Date.parse(report?.ts)>=Date.parse(PRIMARY_MARKET_METER_CUTOVER);}

function round(value,digits=6){
  const n=Number(value);
  if(!Number.isFinite(n)) return null;
  const scale=10**digits;
  return Math.round(n*scale)/scale;
}
function nonEmpty(value){return typeof value==='string'&&value.trim().length>0;}
function americanNumber(value){
  const match=String(value??'').replace(/−/g,'-').match(/(?:^|[^\d.])([+-]\d{2,4})(?![\d.])/);
  return match?Number(match[1]):null;
}
export function americanProbability(value){
  const n=Number(value);
  if(!Number.isFinite(n)||n===0) return null;
  return n>0?100/(n+100):(-n)/((-n)+100);
}
function decimalProbability(value){
  const n=Number(value);
  return Number.isFinite(n)&&n>1?1/n:null;
}
function recWeight(rec){
  const status=String(rec?.status||'PASS').toUpperCase();
  return status==='BET'?1.5:status==='LEAN'?1.2:status==='WAIT'?0.8:0.45;
}
function thresholdActivity(rec){
  const status=String(rec?.status||'PASS').toUpperCase();
  if(status!=='BET'&&status!=='LEAN') return null;
  const play=americanNumber(rec?.playTo||rec?.betAt);
  const current=americanNumber(rec?.price);
  const p=americanProbability(play),c=americanProbability(current);
  if(p===null||c===null) return null;
  return clamp(1-Math.abs(c-p)/0.03,0,1);
}
function eventCollections(feed){
  return [feed?.events,feed?.deepMarkets,feed?.baseballProps]
    .filter(Array.isArray)
    .flat();
}
function rowSelectionKeys(row){
  const keys={};
  for(const source of [row?.selectionKeys,row?.identity?.selectionKeys]){
    if(!source||typeof source!=='object'||Array.isArray(source)) continue;
    for(const [side,key] of Object.entries(source)) if(nonEmpty(key)) keys[side]=String(key);
  }
  if(nonEmpty(row?.selectionKey)) keys.selection=String(row.selectionKey);
  if(nonEmpty(row?.identity?.selectionKey)) keys.selection=String(row.identity.selectionKey);
  return keys;
}
function quoteFresh(updatedAt,feedGeneratedAt,maxAgeMinutes=QUOTE_MAX_AGE_MINUTES){
  const quoteMs=Date.parse(updatedAt),feedMs=Date.parse(feedGeneratedAt);
  if(!Number.isFinite(quoteMs)||!Number.isFinite(feedMs)) return false;
  const ageMinutes=(feedMs-quoteMs)/60000;
  return ageMinutes>=0&&ageMinutes<=maxAgeMinutes;
}
export function exactSelectionQuote(feed,book,selectionKey,{requireFresh=true,maxAgeMinutes=QUOTE_MAX_AGE_MINUTES}={}){
  if(!feed||!EXECUTION_BOOKS.includes(book)||!nonEmpty(selectionKey)) return null;
  let best=null;
  for(const event of eventCollections(feed)){
    const markets=event?.bookmakers?.[book];
    if(!Array.isArray(markets)) continue;
    for(const market of markets){
      if(!Array.isArray(market?.odds)) continue;
      for(const row of market.odds){
        const keys=rowSelectionKeys(row);
        for(const [side,key] of Object.entries(keys)){
          if(key!==selectionKey) continue;
          const decimal=Number(row?.[side]);
          if(!Number.isFinite(decimal)||decimal<=1) continue;
          const updatedAt=String(market?.updatedAt||'');
          if(requireFresh&&!quoteFresh(updatedAt,feed.generatedAt,maxAgeMinutes)) continue;
          const candidate={
            book,
            selectionKey,
            side,
            decimal,
            probability:1/decimal,
            updatedAt,
            eventId:String(event?.id??''),
            marketKey:String(market?.marketKey||market?.identity?.marketKey||market?.name||'')
          };
          if(!best||Date.parse(candidate.updatedAt)>Date.parse(best.updatedAt)) best=candidate;
        }
      }
    }
  }
  return best;
}
function agreementFromFeed(report,feed){
  const recs=Array.isArray(report?.recs)?report.recs:[];
  const diffs=[];
  let identityEligible=0;
  for(const rec of recs){
    const key=rec?.feed?.selectionKey;
    if(!nonEmpty(key)) continue;
    identityEligible++;
    const bet365=exactSelectionQuote(feed,'Bet365',key);
    const draftKings=exactSelectionQuote(feed,'DraftKings',key);
    if(!bet365||!draftKings) continue;
    diffs.push(Math.abs(bet365.probability-draftKings.probability));
  }
  const pairs=diffs.length;
  if(!pairs){
    return {score:50,rawScore:50,confidence:0,pairs:0,identityEligible,source:'BOUND_FEED_BET365_DRAFTKINGS',state:'UNMEASURED'};
  }
  const avgDiff=diffs.reduce((sum,value)=>sum+value,0)/pairs;
  const rawScore=clamp(100-(avgDiff/0.10)*100);
  const confidence=clamp((pairs/Math.max(1,recs.length))*100);
  return {
    score:Math.round(rawScore),
    rawScore:round(rawScore),
    confidence:Math.round(confidence),
    rawConfidence:round(confidence),
    pairs,
    identityEligible,
    averageImpliedProbabilityGap:round(avgDiff),
    source:'BOUND_FEED_BET365_DRAFTKINGS',
    state:'MEASURED'
  };
}
function movementFromPrior(report,priorReport,feed){
  const recs=Array.isArray(report?.recs)?report.recs:[];
  const priorByKey=new Map();
  for(const rec of Array.isArray(priorReport?.recs)?priorReport.recs:[]){
    const key=rec?.feed?.selectionKey;
    if(nonEmpty(key)&&!priorByKey.has(key)) priorByKey.set(key,rec);
  }
  const comparisons=[];
  let identityEligible=0;
  for(const rec of recs){
    const key=rec?.feed?.selectionKey;
    if(!nonEmpty(key)) continue;
    identityEligible++;
    const prior=priorByKey.get(key);
    if(!prior||!EXECUTION_BOOKS.includes(prior?.book)) continue;
    const priorAmerican=americanNumber(prior?.price);
    const priorProb=americanProbability(priorAmerican);
    if(priorProb===null) continue;
    const currentSameBook=exactSelectionQuote(feed,prior.book,key);
    if(!currentSameBook) continue;
    const favor=priorProb-currentSameBook.probability;
    comparisons.push({
      selectionKey:key,
      fixedBook:prior.book,
      priorAmerican,
      currentDecimal:currentSameBook.decimal,
      priorProbability:priorProb,
      currentProbability:currentSameBook.probability,
      favor,
      magnitude:Math.abs(favor),
      weight:recWeight(rec)
    });
  }
  const comparable=comparisons.length;
  const changed=comparisons.filter(item=>item.magnitude>=0.0025).length;
  const weightedDenominator=comparisons.reduce((sum,item)=>sum+item.weight,0)||1;
  const weightedFavor=comparisons.reduce((sum,item)=>sum+item.favor*item.weight,0)/weightedDenominator;
  const avgMagnitude=comparable?comparisons.reduce((sum,item)=>sum+item.magnitude,0)/comparable:0;
  const movementCoverage=recs.length?comparable/recs.length:0;
  const breadth=recs.length?changed/recs.length:0;
  return {
    eligibleSelections:recs.length,
    identityEligibleSelections:identityEligible,
    comparableSelections:comparable,
    changedSelections:changed,
    sameBookComparisons:comparable,
    averageMagnitude:round(avgMagnitude),
    breadth:round(breadth),
    weightedFavor:round(weightedFavor),
    confidence:Math.round(clamp(movementCoverage*100)),
    rawConfidence:round(clamp(movementCoverage*100)),
    state:comparable?'MEASURED':'UNMEASURED'
  };
}
function unmeasuredTelemetry({report,feedBlobSha,priorReport=null,priorRunPath=null,reason}){
  return {
    schema:VIG_METER_TELEMETRY_SCHEMA,
    calibrationId:VIG_METER_CALIBRATION_ID,
    authority:VIG_METER_TELEMETRY_AUTHORITY,
    derivedAt:report?.ts||null,
    source:{
      feedBlobSha:feedBlobSha||null,
      feedGeneratedAt:report?.feedGeneratedAt||null,
      priorRunTs:priorReport?.ts||null,
      priorRunPath:priorRunPath||null,
      state:'UNAVAILABLE',
      reason
    },
    movement:{eligibleSelections:Array.isArray(report?.recs)?report.recs.length:0,identityEligibleSelections:0,comparableSelections:0,changedSelections:0,sameBookComparisons:0,averageMagnitude:0,breadth:0,weightedFavor:0,confidence:0,rawConfidence:0,state:'UNMEASURED'},
    heat:{value:0,rawValue:0,confidence:0,rawConfidence:0,state:'UNMEASURED'},
    pressure:{value:50,rawValue:50,confidence:0,rawConfidence:0,state:'UNMEASURED'},
    agreement:{score:50,rawScore:50,confidence:0,rawConfidence:0,pairs:0,source:'BOUND_FEED_BET365_DRAFTKINGS',state:'UNMEASURED'}
  };
}
export function deriveInstrumentTelemetry({report,priorReport,feed,feedBlobSha=null,priorRunPath=null}={}){
  if(!report||!Array.isArray(report.recs)) throw new Error('deriveInstrumentTelemetry requires report.recs');
  if(!priorReport) return unmeasuredTelemetry({report,feedBlobSha,reason:'NO_PRIOR_SAME_DAY_RUN'});
  if(!feed||feed.generatedAt!==report.feedGeneratedAt){
    return unmeasuredTelemetry({report,feedBlobSha,priorReport,priorRunPath,reason:'PINNED_FEED_UNAVAILABLE_OR_MISMATCHED'});
  }
  const movement=movementFromPrior(report,priorReport,feed);
  const agreement=agreementFromFeed(report,feed);
  const thresholds=report.recs.map(thresholdActivity).filter(value=>value!==null);
  const threshold=thresholds.length?thresholds.reduce((sum,value)=>sum+value,0)/thresholds.length:0;
  const heatRaw=calibratedHeat({
    avgMagnitude:movement.averageMagnitude,
    breadth:movement.breadth,
    thresholdActivity:threshold,
    agreementScore:agreement.rawScore,
    agreementConfidence:agreement.rawConfidence
  });
  const pressureRaw=calibratedPressure(movement.weightedFavor);
  const movementCoverage=movement.rawConfidence/100;
  const heatConfidence=clamp(movementCoverage*70+(agreement.rawConfidence/100)*30);
  const pressureConfidence=movement.rawConfidence;
  return {
    schema:VIG_METER_TELEMETRY_SCHEMA,
    calibrationId:VIG_METER_CALIBRATION_ID,
    authority:VIG_METER_TELEMETRY_AUTHORITY,
    derivedAt:report.ts,
    source:{feedBlobSha:feedBlobSha||null,feedGeneratedAt:report.feedGeneratedAt,priorRunTs:priorReport.ts,priorRunPath:priorRunPath||null,state:'PINNED'},
    movement,
    heat:{value:Math.round(heatRaw),rawValue:round(heatRaw),confidence:Math.round(heatConfidence),rawConfidence:round(heatConfidence),state:heatConfidence>0?'MEASURED':'UNMEASURED'},
    pressure:{value:Math.round(pressureRaw),rawValue:round(pressureRaw),confidence:Math.round(pressureConfidence),rawConfidence:round(pressureConfidence),state:pressureConfidence>0?'MEASURED':'UNMEASURED'},
    agreement
  };
}
function loadFeedFromGit(root,sha){
  try{
    if(!/^[0-9a-f]{40}$/i.test(String(sha||''))) return null;
    const text=execFileSync('git',['cat-file','blob',String(sha)],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']});
    return JSON.parse(text);
  }catch{return null;}
}
function loadCurrentFeedFallback(root,expectedGeneratedAt){
  try{
    const file=path.join(root,'data/live-odds.json');
    const feed=JSON.parse(fs.readFileSync(file,'utf8'));
    return feed?.generatedAt===expectedGeneratedAt?feed:null;
  }catch{return null;}
}
export function latestPriorSameDay(index,report,root){
  const date=String(report?.ts||'').slice(0,10);
  const currentTs=String(report?.ts||'');
  const candidates=(Array.isArray(index?.runs)?index.runs:[])
    .filter(entry=>entry?.date===date&&String(entry?.ts||'')<currentTs&&nonEmpty(entry?.path))
    .sort((a,b)=>String(b.ts).localeCompare(String(a.ts)));
  for(const entry of candidates){
    try{
      const prior=JSON.parse(fs.readFileSync(path.join(root,entry.path),'utf8'));
      if(prior?.ts===entry.ts&&Array.isArray(prior?.recs)) return {entry,report:prior};
    }catch{}
  }
  return null;
}
function blobSha(text){return createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');}
function readGitJson(root,sha){
  if(!/^[0-9a-f]{40}$/i.test(String(sha||'')))throw new Error('Meter source requires a Git blob SHA');
  const raw=execFileSync('git',['cat-file','blob',sha],{cwd:root,encoding:'utf8',maxBuffer:128*1024*1024,stdio:['ignore','pipe','ignore']});
  if(blobSha(raw)!==sha)throw new Error('Meter source blob hash mismatch');
  return JSON.parse(raw);
}
function readSourceFile(root,file){
  const raw=fs.readFileSync(path.join(root,file),'utf8');
  return {data:JSON.parse(raw),sha:blobSha(raw)};
}
function earlierBaseline(ts,currentTs){
  const age=Date.parse(currentTs)-Date.parse(ts);
  return Number.isFinite(age)&&age>0&&age<=METER_BASELINE_MAX_HOURS*3600000;
}
function eligibleSnapshotEntries(oddsIndex,report){
  return (Array.isArray(oddsIndex?.entries)?oddsIndex.entries:[])
    .filter(e=>earlierBaseline(e.generatedAt,report.feedGeneratedAt)&&/^[0-9a-f]{40}$/i.test(String(e.snapshotBlobSha||''))&&Date.parse(e.indexedAtUtc)<=Date.parse(report.ts))
    .sort((a,b)=>Date.parse(b.generatedAt)-Date.parse(a.generatedAt)||a.snapshotBlobSha.localeCompare(b.snapshotBlobSha))
    .filter((e,i,all)=>all.findIndex(x=>x.snapshotBlobSha===e.snapshotBlobSha)===i).slice(0,12);
}

// Forward-only calculation. Agreement is independent of movement history;
// unavailable report comparisons may use a real, exact same-book odds baseline.
export function deriveResilientInstrumentTelemetry({report,feed,feedBlobSha,priorReport=null,priorRunPath=null,priorRunBlobSha=null,oddsIndexBlobSha=null,oddsSnapshots=[]}={}){
  if(!Array.isArray(report?.recs)||feed?.generatedAt!==report.feedGeneratedAt)throw new Error('Resilient meters require the exact bound current feed');
  const priorByKey=new Map((priorReport?.recs||[]).map(r=>[r.feed?.selectionKey,r]));
  const snapshots=oddsSnapshots.filter(s=>earlierBaseline(s.feed?.generatedAt,feed.generatedAt)).sort((a,b)=>Date.parse(b.feed.generatedAt)-Date.parse(a.feed.generatedAt));
  const comparisons=[];
  for(const rec of report.recs){
    const key=rec?.feed?.selectionKey;if(!nonEmpty(key))continue;
    const prior=priorByKey.get(key);let comparison=null;
    if(prior&&EXECUTION_BOOKS.includes(prior.book)&&earlierBaseline(priorReport.feedGeneratedAt,feed.generatedAt)){
      const baselineAmerican=americanNumber(prior.price),p=americanProbability(baselineAmerican),q=exactSelectionQuote(feed,prior.book,key);
      if(p!==null&&q)comparison={basis:'PRIOR_REPORT',book:prior.book,baselineTs:priorReport.ts,baselineAmerican,baselineProbability:p,currentProbability:q.probability,currentQuoteUpdatedAt:q.updatedAt};
    }
    if(!comparison){
      const books=[...new Set([rec.book,...EXECUTION_BOOKS])].filter(b=>EXECUTION_BOOKS.includes(b));
      for(const snapshot of snapshots){
        for(const book of books){
          const before=exactSelectionQuote(snapshot.feed,book,key),after=exactSelectionQuote(feed,book,key);
          if(!before||!after)continue;
          comparison={basis:'ODDS_SNAPSHOT',book,baselineTs:snapshot.feed.generatedAt,baselineFeedBlobSha:snapshot.blobSha,baselineDecimal:before.decimal,baselineProbability:before.probability,baselineQuoteUpdatedAt:before.updatedAt,currentProbability:after.probability,currentQuoteUpdatedAt:after.updatedAt};
          break;
        }
        if(comparison)break;
      }
    }
    if(comparison){
      const favor=comparison.baselineProbability-comparison.currentProbability;
      comparisons.push({selectionKey:key,...comparison,favor,magnitude:Math.abs(favor),weight:recWeight(rec)});
    }
  }
  const count=comparisons.length,total=report.recs.length,changed=comparisons.filter(c=>c.magnitude>=0.0025).length;
  const denominator=comparisons.reduce((n,c)=>n+c.weight,0)||1;
  const movement={eligibleSelections:total,identityEligibleSelections:report.recs.filter(r=>nonEmpty(r?.feed?.selectionKey)).length,comparableSelections:count,changedSelections:changed,sameBookComparisons:count,
    averageMagnitude:round(count?comparisons.reduce((n,c)=>n+c.magnitude,0)/count:0),breadth:round(total?changed/total:0),weightedFavor:round(comparisons.reduce((n,c)=>n+c.favor*c.weight,0)/denominator),
    confidence:Math.round(total?count/total*100:0),rawConfidence:round(total?count/total*100:0),state:count?'MEASURED':'UNMEASURED',
    reportComparisons:comparisons.filter(c=>c.basis==='PRIOR_REPORT').length,snapshotComparisons:comparisons.filter(c=>c.basis==='ODDS_SNAPSHOT').length,comparisons};
  const agreement=agreementFromFeed(report,feed);agreement.rawConfidence??=0;
  const thresholds=report.recs.map(thresholdActivity).filter(v=>v!==null);
  const heatRaw=calibratedHeat({avgMagnitude:movement.averageMagnitude,breadth:movement.breadth,thresholdActivity:thresholds.length?thresholds.reduce((a,b)=>a+b,0)/thresholds.length:0,agreementScore:agreement.rawScore,agreementConfidence:agreement.rawConfidence});
  const heatConfidence=clamp(movement.rawConfidence*.7+agreement.rawConfidence*.3),pressureRaw=calibratedPressure(movement.weightedFavor);
  return {schema:VIG_METER_TELEMETRY_SCHEMA,calculationVersion:2,calibrationId:VIG_METER_CALIBRATION_ID,authority:VIG_METER_TELEMETRY_AUTHORITY,derivedAt:report.ts,
    source:{feedBlobSha,feedGeneratedAt:report.feedGeneratedAt,priorRunTs:priorReport?.ts||null,priorRunPath,priorRunBlobSha,oddsIndexBlobSha,baselinePolicy:'LATEST_REPORT_THEN_ODDS_24H',maxBaselineAgeHours:METER_BASELINE_MAX_HOURS,state:'PINNED'},movement,
    heat:{value:Math.round(heatRaw),rawValue:round(heatRaw),confidence:Math.round(heatConfidence),rawConfidence:round(heatConfidence),state:heatConfidence>0?(count?'MEASURED':'PARTIAL'):'UNMEASURED'},
    pressure:{value:Math.round(pressureRaw),rawValue:round(pressureRaw),confidence:movement.confidence,rawConfidence:movement.rawConfidence,state:count?'MEASURED':'UNMEASURED'},agreement};
}

// Version 3 samples primary markets before card selection. Both opposing sides
// contribute unsigned movement magnitude; only an actual BET/LEAN/WAIT stance
// can supply direction for the separate recommendation-price pressure meter.
// The v1/v2 derivations above remain untouched for exact historical replay.
export function derivePrimaryMarketInstrumentTelemetry({report,feed,policy,feedBlobSha,coverageAuthorityBlobSha=null,oddsIndexBlobSha=null,oddsSnapshots=[]}={}){
  if(!Array.isArray(report?.recs)||feed?.generatedAt!==report.feedGeneratedAt)throw new Error('Primary market meters require the exact bound current feed');
  const inventory=derivePrimarySelectionInventory(report,feed,policy);
  const selections=inventory.selections.filter(s=>s.quotes.length);
  const byId=new Map(selections.map(s=>[s.selectionId,s]));
  const snapshots=oddsSnapshots.filter(s=>earlierBaseline(s.feed?.generatedAt,feed.generatedAt))
    .sort((a,b)=>Date.parse(b.feed.generatedAt)-Date.parse(a.feed.generatedAt)||String(a.blobSha).localeCompare(String(b.blobSha)))
    .filter((s,i,all)=>all.findIndex(x=>x.blobSha===s.blobSha)===i).slice(0,12)
    .map(s=>({...s,selections:new Map(derivePrimarySelectionInventory({...report,feedGeneratedAt:s.feed.generatedAt},s.feed,policy).selections.map(row=>[row.selectionId,row]))}));
  function comparisonFor(selection,{book=null,selectionKey=null}={}){
    for(const snapshot of snapshots){
      const before=snapshot.selections.get(selection.selectionId);
      if(!before)continue;
      for(const fixedBook of book?[book]:EXECUTION_BOOKS){
        const after=selection.quotes.find(q=>q.book===fixedBook&&(!selectionKey||q.selectionKey===selectionKey));
        if(!after)continue;
        const previous=before.quotes.find(q=>q.book===fixedBook&&q.selectionKey===after.selectionKey);
        if(!previous)continue;
        const baselineProbability=1/previous.priceDecimal,currentProbability=1/after.priceDecimal;
        const favor=baselineProbability-currentProbability;
        return {selectionId:selection.selectionId,selectionKey:after.selectionKey,basis:'ODDS_SNAPSHOT',book:fixedBook,
          baselineTs:snapshot.feed.generatedAt,baselineFeedBlobSha:snapshot.blobSha,baselineDecimal:previous.priceDecimal,
          baselineProbability,baselineQuoteUpdatedAt:previous.quoteUpdatedAt,currentDecimal:after.priceDecimal,currentProbability,
          currentQuoteUpdatedAt:after.quoteUpdatedAt,favor,magnitude:Math.abs(favor),weight:1};
      }
    }
    return null;
  }
  const comparisons=selections.map(s=>comparisonFor(s)).filter(Boolean);
  const count=comparisons.length,total=selections.length,changed=comparisons.filter(c=>c.magnitude>=0.0025).length;
  const movementConfidence=total?count/total*100:0;
  const movement={eligibleSelections:total,identityEligibleSelections:total,comparableSelections:count,changedSelections:changed,sameBookComparisons:count,
    averageMagnitude:round(count?comparisons.reduce((n,c)=>n+c.magnitude,0)/count:0),breadth:round(total?changed/total:0),
    confidence:Math.round(movementConfidence),rawConfidence:round(movementConfidence),state:count?'MEASURED':'UNMEASURED',
    reason:count?null:total?'NO_EXACT_PRIMARY_SAME_BOOK_BASELINE':'NO_VERIFIED_PRIMARY_QUOTES',
    reportComparisons:0,snapshotComparisons:count,comparisons};
  const pairs=[];
  for(const selection of selections){
    const first=selection.quotes.find(q=>q.book==='Bet365'),second=selection.quotes.find(q=>q.book==='DraftKings');
    if(!first||!second||first.selectionKey!==second.selectionKey)continue;
    pairs.push({selectionId:selection.selectionId,selectionKey:first.selectionKey,bet365Decimal:first.priceDecimal,draftKingsDecimal:second.priceDecimal,
      bet365QuoteUpdatedAt:first.quoteUpdatedAt,draftKingsQuoteUpdatedAt:second.quoteUpdatedAt,gap:Math.abs(1/first.priceDecimal-1/second.priceDecimal)});
  }
  const avgDiff=pairs.length?pairs.reduce((n,p)=>n+p.gap,0)/pairs.length:0;
  const agreementScore=pairs.length?clamp(100-avgDiff/0.10*100):50;
  const agreementConfidence=total?pairs.length/total*100:0;
  const agreement={score:Math.round(agreementScore),rawScore:round(agreementScore),confidence:Math.round(agreementConfidence),rawConfidence:round(agreementConfidence),
    pairs:pairs.length,identityEligible:total,averageImpliedProbabilityGap:pairs.length?round(avgDiff):null,
    source:'BOUND_PRIMARY_FEED_BET365_DRAFTKINGS',state:pairs.length?'MEASURED':'UNMEASURED',
    reason:pairs.length?null:total?'NO_EXACT_CROSS_BOOK_PRIMARY_PAIR':'NO_VERIFIED_PRIMARY_QUOTES',comparisons:pairs};

  const referents=new Map();let unverifiedReferences=0;
  for(const rec of report.recs){
    if(!['BET','LEAN','WAIT'].includes(String(rec?.status||'').toUpperCase()))continue;
    const key=rec?.feed?.selectionKey,book=rec?.book;
    const selection=selections.find(s=>s.quotes.some(q=>q.book===book&&q.selectionKey===key));
    if(!selection){unverifiedReferences++;continue;}
    // A repeated card/book cannot add weight to a stance. Fixed book priority
    // makes direction deterministic even if card order changes.
    const old=referents.get(selection.selectionId);
    if(!old||EXECUTION_BOOKS.indexOf(book)<EXECUTION_BOOKS.indexOf(old.book))referents.set(selection.selectionId,{selectionId:selection.selectionId,selectionKey:key,book});
  }
  const groups=new Map();
  for(const ref of referents.values()){
    const selection=byId.get(ref.selectionId),group=[selection.sport,selection.eventId,selection.marketDetail].join('|');
    if(!groups.has(group))groups.set(group,[]);
    groups.get(group).push(ref);
  }
  const conflicted=new Set([...groups.values()].filter(refs=>refs.length>1).flat().map(ref=>ref.selectionId));
  const directional=[...referents.values()].filter(ref=>!conflicted.has(ref.selectionId)).sort((a,b)=>a.selectionId.localeCompare(b.selectionId));
  const directionalComparisons=directional.map(ref=>comparisonFor(byId.get(ref.selectionId),ref)).filter(Boolean);
  const signedFavor=directionalComparisons.length?directionalComparisons.reduce((n,c)=>n+c.favor,0)/directionalComparisons.length:0;
  const pressureRaw=calibratedPressure(signedFavor),pressureConfidence=directional.length?directionalComparisons.length/directional.length*100:0;
  const pressure={value:Math.round(pressureRaw),rawValue:round(pressureRaw),confidence:Math.round(pressureConfidence),rawConfidence:round(pressureConfidence),
    state:directionalComparisons.length?'MEASURED':'UNMEASURED',basis:'VERIFIED_BET_LEAN_WAIT_REFERENTS',
    reason:directionalComparisons.length?null:directional.length?'NO_EXACT_DIRECTIONAL_SAME_BOOK_BASELINE':conflicted.size?'CONFLICTING_DIRECTIONAL_REFERENCES':unverifiedReferences?'UNVERIFIED_DIRECTIONAL_REFERENCES':'NO_DIRECTIONAL_REFERENCE',
    directionalSelections:directional.length,comparableSelections:directionalComparisons.length,conflictingSelections:conflicted.size,unverifiedReferences,
    weightedFavor:round(signedFavor),comparisons:directionalComparisons};
  const heatRaw=calibratedHeat({avgMagnitude:movement.averageMagnitude,breadth:movement.breadth,thresholdActivity:0,agreementScore:agreement.rawScore,agreementConfidence:agreement.rawConfidence});
  const heatConfidence=clamp(movement.rawConfidence*.7+agreement.rawConfidence*.3);
  const requiredSelections=Object.values(inventory.sports).reduce((n,s)=>n+s.primary.required,0);
  return {schema:VIG_METER_TELEMETRY_SCHEMA,calculationVersion:3,calibrationId:VIG_METER_CALIBRATION_ID,authority:VIG_METER_TELEMETRY_AUTHORITY,derivedAt:report.ts,
    source:{feedBlobSha,feedGeneratedAt:report.feedGeneratedAt,coverageAuthorityBlobSha,oddsIndexBlobSha,priorRunTs:null,priorRunPath:null,priorRunBlobSha:null,
      baselinePolicy:'LATEST_EXACT_PRIMARY_ODDS_24H',maxBaselineAgeHours:METER_BASELINE_MAX_HOURS,maxBaselineSnapshots:12,state:'PINNED'},
    sample:{scope:'PRIMARY_FULL_GAME_ONLY',basis:'VERIFIED_PRIMARY_MARKET_QUOTES',requiredSelections,availableSelections:total,unavailableSelections:requiredSelections-total,
      quoteCount:selections.reduce((n,s)=>n+s.quotes.length,0),gamesWithQuotes:new Set(selections.map(s=>`${s.sport}|${s.eventId}`)).size,
      selectionIds:selections.map(s=>s.selectionId),weighting:'EQUAL_LOGICAL_SELECTION',thresholdActivityIncluded:false},movement,
    heat:{value:Math.round(heatRaw),rawValue:round(heatRaw),confidence:Math.round(heatConfidence),rawConfidence:round(heatConfidence),state:heatConfidence>0?(count?'MEASURED':'PARTIAL'):'UNMEASURED',
      basis:'PRIMARY_PRICE_MOVEMENT_AND_DISPERSION',reason:heatConfidence>0?(count?null:'CURRENT_AGREEMENT_ONLY'):'NO_MEASURABLE_PRIMARY_INPUTS'},pressure,agreement};
}

function attachPrimaryMarketTelemetry({root,report,sidecar,replaySource}){
  const feedBlobSha=sidecar?.provenance?.feedBlobSha,feed=readGitJson(root,feedBlobSha);
  const coverageAuthorityBlobSha=replaySource?.coverageAuthorityBlobSha||sidecar?.coverageAudit?.authorityBlobSha;
  if(coverageAuthorityBlobSha!==sidecar?.coverageAudit?.authorityBlobSha)throw new Error('Meter coverage authority does not match the bound analysis authority');
  const policy=readGitJson(root,coverageAuthorityBlobSha);
  let oddsIndex=null,oddsIndexBlobSha=null;
  if(replaySource){
    oddsIndexBlobSha=replaySource.oddsIndexBlobSha;
    if(oddsIndexBlobSha)oddsIndex=readGitJson(root,oddsIndexBlobSha);
  }else if(fs.existsSync(path.join(root,ODDS_INDEX_PATH))){
    const source=readSourceFile(root,ODDS_INDEX_PATH);oddsIndex=source.data;oddsIndexBlobSha=source.sha;
  }
  const oddsSnapshots=eligibleSnapshotEntries(oddsIndex,report).map(entry=>{
    const snapshot=readGitJson(root,entry.snapshotBlobSha);
    if(snapshot.generatedAt!==entry.generatedAt)throw new Error('Meter odds index timestamp mismatch');
    return {blobSha:entry.snapshotBlobSha,feed:snapshot};
  });
  return derivePrimaryMarketInstrumentTelemetry({report,feed,policy,feedBlobSha,coverageAuthorityBlobSha,oddsIndexBlobSha,oddsSnapshots});
}
function attachResilientTelemetry({root,index,report,sidecar,replaySource}){
  const feedBlobSha=sidecar?.provenance?.feedBlobSha,feed=readGitJson(root,feedBlobSha);
  let prior=null,priorRunBlobSha=null,oddsIndex=null,oddsIndexBlobSha=null;
  if(replaySource){
    if(replaySource.priorRunPath){
      const entry=index.runs.find(e=>e.path===replaySource.priorRunPath&&e.ts===replaySource.priorRunTs);
      if(!entry||entry.date!==report.ts.slice(0,10)||Date.parse(entry.ts)>=Date.parse(report.ts))throw new Error('Invalid pinned meter prior report');
      priorRunBlobSha=replaySource.priorRunBlobSha;
      const data=readGitJson(root,priorRunBlobSha);
      if(data.ts!==entry.ts)throw new Error('Meter prior report timestamp mismatch');
      prior={entry,report:data};
    }
    oddsIndexBlobSha=replaySource.oddsIndexBlobSha;
    if(oddsIndexBlobSha)oddsIndex=readGitJson(root,oddsIndexBlobSha);
  }else{
    prior=latestPriorSameDay(index,report,root);
    if(prior)priorRunBlobSha=readSourceFile(root,prior.entry.path).sha;
    if(fs.existsSync(path.join(root,ODDS_INDEX_PATH))){const source=readSourceFile(root,ODDS_INDEX_PATH);oddsIndex=source.data;oddsIndexBlobSha=source.sha;}
  }
  const oddsSnapshots=eligibleSnapshotEntries(oddsIndex,report).map(entry=>{
    const snapshot=readGitJson(root,entry.snapshotBlobSha);
    if(snapshot.generatedAt!==entry.generatedAt)throw new Error('Meter odds index timestamp mismatch');
    return {blobSha:entry.snapshotBlobSha,feed:snapshot};
  });
  return deriveResilientInstrumentTelemetry({report,feed,feedBlobSha,priorReport:prior?.report||null,priorRunPath:prior?.entry?.path||null,priorRunBlobSha,oddsIndexBlobSha,oddsSnapshots});
}
export function attachPublisherInstrumentTelemetry({root,index,report,sidecar,replaySource=null}={}){
  if(!root||!index||!report||!sidecar) throw new Error('attachPublisherInstrumentTelemetry requires root, index, report and sidecar');
  if(usesResilientMeterTelemetry(report)){
    // Replaying an already issued run must use its original source manifest,
    // even after the live odds index has gained later snapshots.
    const issued=index.runs.find(e=>e.ts===report.ts&&e.slot===report.slot);
    if(!replaySource&&issued?.path){
      const stored=readSourceFile(root,issued.path).data;
      const expectedVersion=usesPrimaryMarketTelemetry(report)?3:2;
      if(stored.instrumentTelemetry?.calculationVersion!==expectedVersion)throw new Error('Issued meter receipt has an invalid calculation version');
      replaySource=stored.instrumentTelemetry.source;
    }
    report.instrumentTelemetry=usesPrimaryMarketTelemetry(report)?attachPrimaryMarketTelemetry({root,report,sidecar,replaySource}):attachResilientTelemetry({root,index,report,sidecar,replaySource});
    return report.instrumentTelemetry;
  }
  const feedBlobSha=sidecar?.provenance?.feedBlobSha||null;
  const prior=latestPriorSameDay(index,report,root);
  let feed=loadFeedFromGit(root,feedBlobSha);
  if(!feed||feed.generatedAt!==report.feedGeneratedAt) feed=loadCurrentFeedFallback(root,report.feedGeneratedAt);
  const telemetry=deriveInstrumentTelemetry({
    report,
    priorReport:prior?.report||null,
    feed,
    feedBlobSha,
    priorRunPath:prior?.entry?.path||null
  });
  report.instrumentTelemetry=telemetry;
  return telemetry;
}

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
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
export function attachPublisherInstrumentTelemetry({root,index,report,sidecar}={}){
  if(!root||!index||!report||!sidecar) throw new Error('attachPublisherInstrumentTelemetry requires root, index, report and sidecar');
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

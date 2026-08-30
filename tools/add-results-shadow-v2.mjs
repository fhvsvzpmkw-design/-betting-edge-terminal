#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const INDEX_PATH=path.join(ROOT,'data/history/results-index.json');
const UNIT_BASE_PCT=0.03;
const NON_BET_STATUSES=new Set(['LEAN','WAIT','PASS']);
const STATUS_ORDER=['LEAN','WAIT','PASS'];
const DAY_MS=24*60*60*1000;

function readJson(file){
  try{return JSON.parse(fs.readFileSync(file,'utf8'))}
  catch{return null}
}
function cleanText(v){return String(v??'').trim()}
function round(v,d=4){
  if(v===null||v===undefined||v==='')return null;
  const n=Number(v);
  if(!Number.isFinite(n))return null;
  const p=10**d;
  return Math.round(n*p)/p;
}
function strictUnits(card){
  if(card?.completionState!=='complete')return null;
  if(card?.units===null||card?.units===undefined||card?.units==='')return null;
  const n=Number(card.units);
  return Number.isFinite(n)?n:null;
}
function cardTime(card){
  const parsed=Date.parse(card?.runId||'');
  return Number.isFinite(parsed)?parsed:null;
}
function laterCard(a,b){
  const at=cardTime(a),bt=cardTime(b);
  if(at!==null&&bt!==null&&at!==bt)return at>bt?a:b;
  const runCmp=String(a?.runId||'').localeCompare(String(b?.runId||''));
  if(runCmp!==0)return runCmp>0?a:b;
  return String(a?.cardId||'').localeCompare(String(b?.cardId||''))>=0?a:b;
}
function latestFinalNonBetDecisions(cards){
  const latest=new Map();
  for(const card of cards||[]){
    const key=cleanText(card?.selectionKey)||`card:${cleanText(card?.cardId)}`;
    const prior=latest.get(key);
    latest.set(key,prior?laterCard(prior,card):card);
  }
  return [...latest.values()].filter(card=>NON_BET_STATUSES.has(cleanText(card?.status).toUpperCase()));
}
function gradeCounts(rows){
  const out={WIN:0,LOSS:0,PUSH:0,VOID:0,HALF_WIN:0,HALF_LOSS:0};
  for(const row of rows){
    const g=cleanText(row?.grade).toUpperCase();
    if(Object.hasOwn(out,g))out[g]+=1;
  }
  return out;
}
function dateKey(card){
  const direct=cleanText(card?.date);
  if(/^\d{4}-\d{2}-\d{2}$/.test(direct))return direct;
  const run=cleanText(card?.runId);
  const match=run.match(/^\d{4}-\d{2}-\d{2}/);
  return match?match[0]:null;
}
function dateMs(date){
  if(!date)return null;
  const parsed=Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(parsed)?parsed:null;
}

const index=readJson(INDEX_PATH);
if(!index||!Array.isArray(index.cards)){
  console.error('results index unavailable or invalid');
  process.exit(1);
}

const runCache=new Map();
function sourceRun(card){
  const source=cleanText(card?.sourceRun);
  if(!source)return null;
  if(runCache.has(source))return runCache.get(source);
  const run=readJson(path.join(ROOT,source));
  runCache.set(source,run||null);
  return run||null;
}
function frozenUnitCad(card){
  const bankroll=Number(sourceRun(card)?.bankroll);
  return Number.isFinite(bankroll)&&bankroll>0?bankroll*UNIT_BASE_PCT:null;
}
function enrichDecision(card){
  const units=strictUnits(card);
  const unitCad=frozenUnitCad(card);
  const hasDollar=units!==null&&Number.isFinite(unitCad)&&unitCad>0;
  return {
    ...card,
    shadowUnits:units,
    frozenUnitCad:hasDollar?unitCad:null,
    shadowProfitLossCad:hasDollar?units*unitCad:null,
    decisionDate:dateKey(card)
  };
}
function aggregate(rows,status=null){
  const list=status?rows.filter(row=>cleanText(row?.status).toUpperCase()===status):rows;
  const complete=list.filter(row=>row?.completionState==='complete');
  const priced=list.filter(row=>row.shadowUnits!==null);
  const dollarValued=priced.filter(row=>Number.isFinite(Number(row.frozenUnitCad))&&Number(row.frozenUnitCad)>0&&Number.isFinite(Number(row.shadowProfitLossCad)));
  const shadowNetUnits=priced.reduce((n,row)=>n+Number(row.shadowUnits),0);
  const shadowRiskUnits=priced.length;
  const shadowRiskCad=dollarValued.reduce((n,row)=>n+Number(row.frozenUnitCad),0);
  const shadowProfitLossCad=dollarValued.reduce((n,row)=>n+Number(row.shadowProfitLossCad),0);
  const protectedRows=priced.filter(row=>Number(row.shadowUnits)<0);
  const missedRows=priced.filter(row=>Number(row.shadowUnits)>0);
  const neutralRows=priced.filter(row=>Number(row.shadowUnits)===0);
  const valueProtectedUnits=protectedRows.reduce((n,row)=>n-Math.min(0,Number(row.shadowUnits)),0);
  const valueMissedUnits=missedRows.reduce((n,row)=>n+Math.max(0,Number(row.shadowUnits)),0);
  const valueProtectedCad=dollarValued.filter(row=>Number(row.shadowUnits)<0).reduce((n,row)=>n-Math.min(0,Number(row.shadowProfitLossCad)),0);
  const valueMissedCad=dollarValued.filter(row=>Number(row.shadowUnits)>0).reduce((n,row)=>n+Math.max(0,Number(row.shadowProfitLossCad)),0);
  const decisionValueUnits=-shadowNetUnits;
  const decisionValueCad=-shadowProfitLossCad;
  return {
    ...(status?{status}:{}),
    decisions:list.length,
    complete:complete.length,
    unresolved:list.length-complete.length,
    priced:priced.length,
    excluded:list.length-priced.length,
    dollarValued:dollarValued.length,
    grades:gradeCounts(priced),
    shadowRiskUnits:round(shadowRiskUnits,4),
    shadowNetUnits:round(shadowNetUnits,4),
    shadowRoiPct:shadowRiskUnits?round(shadowNetUnits/shadowRiskUnits*100,2):null,
    shadowRiskCad:round(shadowRiskCad,2),
    shadowProfitLossCad:round(shadowProfitLossCad,2),
    shadowRoiCadPct:shadowRiskCad>0?round(shadowProfitLossCad/shadowRiskCad*100,2):null,
    valueProtectedUnits:round(valueProtectedUnits,4),
    valueProtectedCad:round(valueProtectedCad,2),
    valueMissedUnits:round(valueMissedUnits,4),
    valueMissedCad:round(valueMissedCad,2),
    decisionValueUnits:round(decisionValueUnits,4),
    decisionValueCad:round(decisionValueCad,2),
    protectedOutcomes:protectedRows.length,
    missedOutcomes:missedRows.length,
    neutralOutcomes:neutralRows.length,
    cappedDecisionScore:protectedRows.length-missedRows.length
  };
}
function grouped(rows,getter){
  const groups=new Map();
  for(const row of rows){
    const name=cleanText(getter(row))||'UNKNOWN';
    if(!groups.has(name))groups.set(name,[]);
    groups.get(name).push(row);
  }
  return [...groups.entries()]
    .map(([name,items])=>({name,...aggregate(items)}))
    .sort((a,b)=>b.priced-a.priced||a.name.localeCompare(b.name));
}
function eligibleCalibration(rows,minSample=5){
  return rows.filter(row=>row.priced>=minSample&&Number.isFinite(Number(row.shadowRoiPct)));
}
function calibrationState(row){
  if(!row||row.priced<5||!Number.isFinite(Number(row.shadowRoiPct)))return'SMALL SAMPLE';
  const roi=Number(row.shadowRoiPct);
  if(roi<=-5)return'FILTER HELPING';
  if(roi>=5)return'TOO TIGHT';
  return'MIXED';
}

const finalDecisions=latestFinalNonBetDecisions(index.cards).map(enrichDecision);
const overall=aggregate(finalDecisions);
const byStatus=STATUS_ORDER.map(status=>aggregate(finalDecisions,status));
const byMarket=grouped(finalDecisions,row=>row.market);
const marketCalibration=eligibleCalibration(byMarket);
const bestMarket=marketCalibration.length?[...marketCalibration].sort((a,b)=>Number(a.shadowRoiPct)-Number(b.shadowRoiPct))[0]:null;
const weakestMarket=marketCalibration.length?[...marketCalibration].sort((a,b)=>Number(b.shadowRoiPct)-Number(a.shadowRoiPct))[0]:null;
const statusCalibration=eligibleCalibration(byStatus);
const weakestStatus=statusCalibration.length?[...statusCalibration].sort((a,b)=>Number(b.shadowRoiPct)-Number(a.shadowRoiPct))[0]:null;

const dated=finalDecisions.map(row=>({row,ms:dateMs(row.decisionDate)})).filter(x=>x.ms!==null);
const latestMs=dated.length?Math.max(...dated.map(x=>x.ms)):null;
let recentSevenDay=null,previousSevenDay=null,recentTrend='NO BASELINE',recentTrendDeltaRoiPct=null;
if(latestMs!==null){
  const recentStart=latestMs-6*DAY_MS;
  const previousStart=latestMs-13*DAY_MS;
  const previousEnd=latestMs-7*DAY_MS;
  const recentRows=dated.filter(x=>x.ms>=recentStart&&x.ms<=latestMs).map(x=>x.row);
  const previousRows=dated.filter(x=>x.ms>=previousStart&&x.ms<=previousEnd).map(x=>x.row);
  recentSevenDay={start:new Date(recentStart).toISOString().slice(0,10),end:new Date(latestMs).toISOString().slice(0,10),...aggregate(recentRows)};
  previousSevenDay={start:new Date(previousStart).toISOString().slice(0,10),end:new Date(previousEnd).toISOString().slice(0,10),...aggregate(previousRows)};
  if(recentSevenDay.priced>=5&&previousSevenDay.priced>=5&&Number.isFinite(Number(recentSevenDay.shadowRoiPct))&&Number.isFinite(Number(previousSevenDay.shadowRoiPct))){
    recentTrendDeltaRoiPct=round(Number(recentSevenDay.shadowRoiPct)-Number(previousSevenDay.shadowRoiPct),2);
    if(recentTrendDeltaRoiPct<=-2)recentTrend='IMPROVING';
    else if(recentTrendDeltaRoiPct>=2)recentTrend='WEAKENING';
    else recentTrend='STABLE';
  }
}

index.decisionValueShadowV2={
  version:2,
  presentationVersion:3,
  methodology:'one final non-BET decision per exact unique selectionKey. Repeated report-lane appearances are deduplicated to the last issued decision. Price-based shadow results require a completed result and a non-null exact issued-price unit result. Each valid decision risks one historical full unit frozen at 3% of the bankroll stored in that final source report. Dollar P/L is the sum of those historically frozen units, not a flat-$100 conversion.',
  referenceUnitBasePct:3,
  unitDefinition:'1.00u = 3% of bankroll in the final source report for that decision',
  uniqueFinalDecisions:finalDecisions.length,
  completeFinalDecisions:finalDecisions.filter(row=>row.completionState==='complete').length,
  pricedFinalDecisions:overall.priced,
  dollarValuedFinalDecisions:overall.dollarValued,
  excludedFinalDecisions:overall.excluded,
  unresolvedFinalDecisions:overall.unresolved,
  shadowRiskUnits:overall.shadowRiskUnits,
  shadowNetUnits:overall.shadowNetUnits,
  shadowRoiPct:overall.shadowRoiPct,
  shadowRiskCad:overall.shadowRiskCad,
  shadowProfitLossCad:overall.shadowProfitLossCad,
  shadowRoiCadPct:overall.shadowRoiCadPct,
  netDecisionUnits:overall.decisionValueUnits,
  netDecisionCad:overall.decisionValueCad,
  valueProtectedUnits:overall.valueProtectedUnits,
  valueProtectedCad:overall.valueProtectedCad,
  valueMissedUnits:overall.valueMissedUnits,
  valueMissedCad:overall.valueMissedCad,
  protectedOutcomes:overall.protectedOutcomes,
  missedOutcomes:overall.missedOutcomes,
  neutralOutcomes:overall.neutralOutcomes,
  cappedDecisionScore:overall.cappedDecisionScore,
  byStatus:byStatus.map(row=>({...row,calibrationState:calibrationState(row)})),
  byMarket,
  diagnostics:{
    bestMarket,
    weakestMarket,
    weakestStatus:weakestStatus?{...weakestStatus,calibrationState:calibrationState(weakestStatus)}:null,
    recentSevenDay,
    previousSevenDay,
    recentTrend,
    recentTrendDeltaRoiPct
  },
  notes:[
    'Negative shadow ROI means the bets that were filtered out would have lost money; that is evidence the filters helped.',
    'Positive shadow ROI means the filtered-out bets would have made money; that is a sign the filter may have been too tight.',
    'This is retrospective calibration only, not actual ledger profit and not a re-handicap.'
  ]
};

fs.writeFileSync(INDEX_PATH,`${JSON.stringify(index,null,2)}\n`,'utf8');
console.log(`${path.relative(ROOT,INDEX_PATH)}: Filter Calibration Shadow Review (${overall.priced}/${finalDecisions.length} valid priced; ${round(overall.shadowNetUnits,2)}u if played; ${round(overall.shadowRoiPct,2)}% shadow ROI)`);

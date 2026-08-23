#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const INDEX_PATH=path.join(ROOT,'data/history/results-index.json');
const UNIT_BASE_PCT=0.03;
const PLAYER_UNIT_CAD=100;
const NON_BET_STATUSES=new Set(['LEAN','WAIT','PASS']);

function readJson(file){
  try{return JSON.parse(fs.readFileSync(file,'utf8'))}
  catch{return null}
}
function cleanText(v){return String(v??'').trim()}
function parseStakeCad(v){
  if(typeof v==='number'&&Number.isFinite(v))return Math.max(0,v);
  const text=cleanText(v).replace(/,/g,'');
  const m=text.match(/\$?\s*([0-9]+(?:\.[0-9]+)?)/);
  if(!m)return 0;
  const n=Number(m[1]);
  return Number.isFinite(n)?Math.max(0,n):0;
}
function round(v,d=4){
  if(v===null||v===undefined||v==='')return null;
  const n=Number(v);
  if(!Number.isFinite(n))return null;
  const p=10**d;
  return Math.round(n*p)/p;
}
function runRec(card,runCache){
  const sourceRun=cleanText(card?.sourceRun);
  if(!sourceRun)return {run:null,rec:null};
  let run=runCache.get(sourceRun);
  if(run===undefined){
    run=readJson(path.join(ROOT,sourceRun));
    runCache.set(sourceRun,run||null);
  }
  if(!run||!Array.isArray(run.recs))return {run,rec:null};
  const raw=cleanText(card?.cardId);
  const hash=raw.lastIndexOf('#');
  const index=hash>=0?Number(raw.slice(hash+1)):NaN;
  const rec=Number.isInteger(index)&&index>=0?run.recs[index]:null;
  return {run,rec};
}
function gradeCounts(rows){
  const out={WIN:0,LOSS:0,PUSH:0,VOID:0,HALF_WIN:0,HALF_LOSS:0};
  for(const row of rows){
    const g=cleanText(row?.grade).toUpperCase();
    if(Object.hasOwn(out,g))out[g]+=1;
  }
  return out;
}
function latestDecisionCards(cards){
  const bySelection=new Map();
  for(const card of cards){
    const key=cleanText(card?.selectionKey)||`card:${cleanText(card?.cardId)}`;
    const prior=bySelection.get(key);
    if(!prior||String(card?.runId||'').localeCompare(String(prior?.runId||''))>=0)bySelection.set(key,card);
  }
  return [...bySelection.values()].filter(card=>NON_BET_STATUSES.has(cleanText(card?.status).toUpperCase()));
}
function decisionStatusRow(rows,status){
  const list=rows.filter(row=>cleanText(row?.status).toUpperCase()===status);
  const priced=list.filter(row=>row.completionState==='complete'&&Number.isFinite(Number(row.units)));
  const shadowNetUnits=priced.reduce((n,row)=>n+Number(row.units),0);
  const lossAvoidedUnits=priced.reduce((n,row)=>n+(Number(row.units)<0?-Number(row.units):0),0);
  const opportunityMissedUnits=priced.reduce((n,row)=>n+(Number(row.units)>0?Number(row.units):0),0);
  return {
    status,
    decisions:list.length,
    priced:priced.length,
    grades:gradeCounts(priced),
    shadowNetUnits:round(shadowNetUnits,4),
    shadowRoiPct:priced.length?round(shadowNetUnits/priced.length*100,2):null,
    lossAvoidedUnits:round(lossAvoidedUnits,4),
    opportunityMissedUnits:round(opportunityMissedUnits,4),
    decisionValueUnits:round(lossAvoidedUnits-opportunityMissedUnits,4),
    shadowCashCad:priced.length?round(shadowNetUnits*PLAYER_UNIT_CAD,2):null,
    decisionValueCad:priced.length?round((lossAvoidedUnits-opportunityMissedUnits)*PLAYER_UNIT_CAD,2):null
  };
}

const index=readJson(INDEX_PATH);
if(!index||!Array.isArray(index.cards)){
  console.error('results index unavailable or invalid');
  process.exit(1);
}

const runCache=new Map();
for(const card of index.cards){
  const {run,rec}=runRec(card,runCache);
  const status=cleanText(card.status||rec?.status).toUpperCase();
  const bankrollCad=Number(run?.bankroll);
  const referenceFullUnitCad=Number.isFinite(bankrollCad)&&bankrollCad>0?bankrollCad*UNIT_BASE_PCT:null;
  const issuedStakeCad=status==='BET'?parseStakeCad(rec?.stake):0;
  const stakeUnits=Number.isFinite(referenceFullUnitCad)&&referenceFullUnitCad>0?issuedStakeCad/referenceFullUnitCad:0;
  const settledFlatUnits=Number(card.units);
  const sizedNetUnits=card.completionState==='complete'&&Number.isFinite(settledFlatUnits)&&stakeUnits>0
    ?settledFlatUnits*stakeUnits
    :null;

  card.issuedStakeCad=round(issuedStakeCad,2);
  card.referenceFullUnitCad=round(referenceFullUnitCad,2);
  card.stakeUnits=round(stakeUnits,4);
  card.sizedNetUnits=round(sizedNetUnits,4);
}

const issuedBets=index.cards.filter(c=>cleanText(c.status).toUpperCase()==='BET'&&Number(c.issuedStakeCad)>0&&Number(c.stakeUnits)>0);
const settledBets=issuedBets.filter(c=>c.completionState==='complete');
const pricedBets=settledBets.filter(c=>Number.isFinite(Number(c.units))&&Number.isFinite(Number(c.sizedNetUnits)));
const riskUnits=pricedBets.reduce((n,c)=>n+Number(c.stakeUnits||0),0);
const netUnits=pricedBets.reduce((n,c)=>n+Number(c.sizedNetUnits||0),0);
const roiPct=riskUnits>0?netUnits/riskUnits*100:null;

index.playerValueAnalytics={
  methodology:'actual issued BET stake is divided by 3% of that report bankroll to preserve the issued stake fraction, then replayed with a standardized $100 full unit',
  referenceUnitBasePct:3,
  standardizedFullUnitCad:PLAYER_UNIT_CAD,
  issuedBets:issuedBets.length,
  settledBets:settledBets.length,
  pricedBets:pricedBets.length,
  riskUnits:round(riskUnits,4),
  netUnits:round(netUnits,4),
  roiPct:round(roiPct,2),
  riskCad:pricedBets.length?round(riskUnits*PLAYER_UNIT_CAD,2):0,
  cashValueCad:pricedBets.length?round(netUnits*PLAYER_UNIT_CAD,2):0,
  note:'$100 defines the standardized full-unit reference only. Each actual BET keeps its issued Betting Edge stake fraction; non-BET statuses never contribute to realized player P/L.'
};

const finalDecisions=latestDecisionCards(index.cards);
const pricedFinalDecisions=finalDecisions.filter(c=>c.completionState==='complete'&&Number.isFinite(Number(c.units)));
const lossAvoidedUnits=pricedFinalDecisions.reduce((n,c)=>n+(Number(c.units)<0?-Number(c.units):0),0);
const opportunityMissedUnits=pricedFinalDecisions.reduce((n,c)=>n+(Number(c.units)>0?Number(c.units):0),0);
const shadowNetUnits=pricedFinalDecisions.reduce((n,c)=>n+Number(c.units),0);
const netDecisionUnits=lossAvoidedUnits-opportunityMissedUnits;

index.decisionValueAnalytics={
  methodology:'one final issued non-BET decision per unique selectionKey; repeated report-lane appearances are deduplicated. Counterfactual shadow review uses a flat $100 full-unit risk at the final exact issued price. It is not actual betting P/L.',
  standardizedFullUnitCad:PLAYER_UNIT_CAD,
  uniqueFinalDecisions:finalDecisions.length,
  pricedFinalDecisions:pricedFinalDecisions.length,
  shadowNetUnits:round(shadowNetUnits,4),
  shadowRoiPct:pricedFinalDecisions.length?round(shadowNetUnits/pricedFinalDecisions.length*100,2):null,
  lossAvoidedUnits:round(lossAvoidedUnits,4),
  opportunityMissedUnits:round(opportunityMissedUnits,4),
  netDecisionUnits:round(netDecisionUnits,4),
  lossAvoidedCad:pricedFinalDecisions.length?round(lossAvoidedUnits*PLAYER_UNIT_CAD,2):null,
  opportunityMissedCad:pricedFinalDecisions.length?round(opportunityMissedUnits*PLAYER_UNIT_CAD,2):null,
  netDecisionCad:pricedFinalDecisions.length?round(netDecisionUnits*PLAYER_UNIT_CAD,2):null,
  byStatus:['LEAN','WAIT','PASS'].map(status=>decisionStatusRow(finalDecisions,status)),
  note:'Positive decision value means losses avoided exceeded profitable opportunities passed up. Negative decision value means the final non-BET filters left more profitable shadow value on the table than they protected.'
};

fs.writeFileSync(INDEX_PATH,`${JSON.stringify(index,null,2)}\n`,'utf8');
console.log(`${path.relative(ROOT,INDEX_PATH)}: $100 player (${pricedBets.length} priced settled BETs) + decision value (${pricedFinalDecisions.length} priced unique final non-BET decisions)`);

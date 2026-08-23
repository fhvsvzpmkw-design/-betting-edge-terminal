#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const INDEX_PATH=path.join(ROOT,'data/history/results-index.json');
const UNIT_BASE_PCT=0.03;
const PLAYER_UNITS_CAD=[100,250,500,1000];

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
  const fullUnitCad=Number.isFinite(bankrollCad)&&bankrollCad>0?bankrollCad*UNIT_BASE_PCT:null;
  const rawStake=status==='BET'?parseStakeCad(rec?.stake):0;
  const stakeUnits=Number.isFinite(fullUnitCad)&&fullUnitCad>0?rawStake/fullUnitCad:0;
  const settledFlatUnits=Number(card.units);
  const sizedNetUnits=card.completionState==='complete'&&Number.isFinite(settledFlatUnits)&&stakeUnits>0
    ? settledFlatUnits*stakeUnits
    : null;

  card.issuedStakeCad=round(rawStake,2);
  card.referenceFullUnitCad=round(fullUnitCad,2);
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
  methodology:'issued BET stake preserved; standardized full-unit scale uses 3% of report bankroll as the reference 1.00u amount, then replays each completed exact-priced BET at its issued stake fraction',
  unitBasePct:3,
  issuedBets:issuedBets.length,
  settledBets:settledBets.length,
  pricedBets:pricedBets.length,
  riskUnits:round(riskUnits,4),
  netUnits:round(netUnits,4),
  roiPct:round(roiPct,2),
  playerScale:PLAYER_UNITS_CAD.map(unitCad=>({
    fullUnitCad:unitCad,
    cashValueCad:pricedBets.length?round(netUnits*unitCad,2):null
  })),
  note:'$100 player means 1.00u = $100. VigScope fractional/full stake sizing is preserved; it does not make every wager $100. Flat-card calibration remains separate in priceAnalytics.'
};

fs.writeFileSync(INDEX_PATH,`${JSON.stringify(index,null,2)}\n`,'utf8');
console.log(`${path.relative(ROOT,INDEX_PATH)}: player-value sizing added (${pricedBets.length} priced settled BETs, ${round(netUnits,4)??0}u sized net)`);

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {matchNflFixture,extractPinnacleHomeSpread} from './graham-market-utils.mjs';

const ROOT=process.cwd();
const NUMBERS=path.join(ROOT,'data/walters/nfl/2026/week-01-current-numbers.json');
const MARKET=path.join(ROOT,'data/walters/nfl/2026/week-01-daily-market-ledger.json');
const OBSERVER=path.join(ROOT,'data/oddspapi-observer.json');
const LIVE=path.join(ROOT,'data/live-odds.json');
function readJson(f){return JSON.parse(fs.readFileSync(f,'utf8'))}
function roundHalf(v){return Math.round(v*2)/2}

const numbers=readJson(NUMBERS),market=readJson(MARKET),observer=readJson(OBSERVER),live=readJson(LIVE);
const reportTime=String(live?.scheduleMeta?.plannedReportTime||'');
if(reportTime!=='15:15'){
  console.log(`GRAHAM DAILY CAPTURE SKIP // REPORT ${reportTime||'UNKNOWN'} != 15:15`);
  process.exit(0);
}
const reviewDate=String(live?.scheduleMeta?.operatingDate||numbers.updatedAt||'').slice(0,10);
if(!/^\d{4}-\d{2}-\d{2}$/.test(reviewDate))throw new Error('Cannot resolve Graham review date');
const fixtures=observer?.status==='ok'&&Array.isArray(observer.fixtures)?observer.fixtures:[];
const numbersByKey=new Map((numbers.games||[]).map(g=>[g.gameKey,g]));
let appended=0;
for(const marketGame of market.games||[]){
  const number=numbersByKey.get(marketGame.gameKey);
  const graham=Number(number?.grahamFairHome);
  if(!Number.isFinite(graham)||!number?.grahamAsOf)continue;
  if(Date.parse(marketGame.startTimePacific||'')<=Date.now())continue;
  if((marketGame.dailySnapshots||[]).some(s=>s?.type==='DAILY'&&s?.reviewDate===reviewDate))continue;
  const matched=matchNflFixture(marketGame,fixtures);
  const quote=matched?extractPinnacleHomeSpread(matched.fixture,observer?.generatedAt):null;
  const seq=Math.max(-1,...(marketGame.dailySnapshots||[]).map(s=>Number(s.sequence??-1)))+1;
  const available=quote&&Number.isFinite(Number(quote.homeSpread));
  const snapshot={
    sequence:seq,type:'DAILY',reviewDate,capturedAt:new Date().toISOString(),
    grahamFairHome:graham,grahamAsOf:number.grahamAsOf,
    pinnacleSpreadHome:available?Number(quote.homeSpread):null,
    pinnacleHomePriceAmerican:available?quote.homePriceAmerican:null,
    pinnacleObservedAt:available?quote.observedAt:null,
    pinnacleStatus:available?'AVAILABLE':'PINNACLE_UNAVAILABLE',
    sourceRefs:available?['data/oddspapi-observer.json',`OddsPapi fixture ${matched.fixture.fixtureId}`]:['data/oddspapi-observer.json'],
    grahamHomeStrengthGap:available?roundHalf(Number(quote.homeSpread)-graham):null,
    note:available?`Automatic 15:15 Graham-versus-Pinnacle capture; market selected by ${quote.selectionMethod}.`:'Automatic 15:15 capture found no usable Pinnacle headline spread; no substitute bookmaker used.'
  };
  if(!Array.isArray(marketGame.dailySnapshots))marketGame.dailySnapshots=[];
  marketGame.dailySnapshots.push(snapshot);appended++;
}
if(appended){
  market.updatedAt=new Date().toISOString();market.state='DAILY_CAPTURE_ACTIVE';
  fs.writeFileSync(MARKET,JSON.stringify(market,null,2)+'\n');
  JSON.parse(fs.readFileSync(MARKET,'utf8'));
}
console.log(`GRAHAM DAILY CAPTURE // ${reviewDate} // APPENDED ${appended}`);

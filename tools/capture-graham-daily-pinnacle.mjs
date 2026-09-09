#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {matchNflFixture,extractPinnacleHomeSpread} from './graham-market-utils.mjs';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

function readJson(f){return JSON.parse(fs.readFileSync(f,'utf8'))}
function numeric(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
function roundHalf(v){return Math.round(v*2)/2}
function pacificDate(value){const t=Date.parse(value||'');return Number.isFinite(t)?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit'}).format(t):null}

export function appendDailyPinnacleSnapshots({numbers,market,observer,live,now=new Date().toISOString()}){
  // A manual pull is the same observed market as a scheduled pull. The first
  // usable observation each Pacific day is retained as the day's fixed baseline;
  // subsequent pulls update the live comparison without resetting its movement.
  const observationMs=Date.parse(observer?.generatedAt||'');
  const reviewDate=pacificDate(observer?.generatedAt);
  if(!reviewDate||reviewDate!==pacificDate(now)||observationMs>Date.parse(now))return 0;
  if(pacificDate(live?.generatedAt)!==reviewDate)return 0;
  const fixtures=observer?.status==='ok'&&Array.isArray(observer.fixtures)?observer.fixtures:[];
  const numbersByKey=new Map((numbers.games||[]).map(g=>[g.gameKey,g]));
  let appended=0;
  for(const marketGame of market.games||[]){
    const number=numbersByKey.get(marketGame.gameKey);
    const graham=numeric(number?.grahamFairHome);
    const fairMs=Date.parse(number?.grahamAsOf||'');
    const kickoffMs=Date.parse(marketGame.startTimePacific||'');
    if(graham===null||!Number.isFinite(fairMs)||fairMs>observationMs)continue;
    if(!Number.isFinite(kickoffMs)||kickoffMs<=Date.parse(now))continue;
    // An unavailable attempt must not consume the day's successful capture.
    if((marketGame.dailySnapshots||[]).some(s=>s?.reviewDate===reviewDate&&(
      (s.pinnacleStatus==='AVAILABLE'&&numeric(s.pinnacleSpreadHome)!==null)||
      s.observerGeneratedAt===observer.generatedAt)))continue;
    const matched=matchNflFixture(marketGame,fixtures);
    const quote=matched?extractPinnacleHomeSpread(matched.fixture,observer?.generatedAt):null;
    const seq=Math.max(-1,...(marketGame.dailySnapshots||[]).map(s=>Number(s.sequence??-1)))+1;
    const quoteHome=numeric(quote?.homeSpread);
    const available=quoteHome!==null;
    const snapshot={
      sequence:seq,type:'DAILY',reviewDate,capturedAt:now,
      observerGeneratedAt:observer.generatedAt,
      sourceScheduleMeta:live?.scheduleMeta||null,
      grahamFairHome:graham,grahamAsOf:number.grahamAsOf,
      pinnacleSpreadHome:available?quoteHome:null,
      pinnacleHomePriceAmerican:available?quote.homePriceAmerican:null,
      pinnacleObservedAt:available?quote.observedAt:null,
      pinnacleStatus:available?'AVAILABLE':'PINNACLE_UNAVAILABLE',
      sourceRefs:available?['data/oddspapi-observer.json',`OddsPapi fixture ${matched.fixture.fixtureId}`]:['data/oddspapi-observer.json'],
      grahamHomeStrengthGap:available?roundHalf(quoteHome-graham):null,
      note:available?`First usable daily Graham-versus-Pinnacle capture from a scheduled or manual odds pull; market selected by ${quote.selectionMethod}.`:'Daily capture found no usable Pinnacle headline spread; a later pull may complete the baseline. No substitute bookmaker used.'
    };
    if(!Array.isArray(marketGame.dailySnapshots))marketGame.dailySnapshots=[];
    marketGame.dailySnapshots.push(snapshot);appended++;
  }
  if(appended){
    market.updatedAt=now;market.state='DAILY_CAPTURE_ACTIVE';
  }
  return appended;
}

function main(){
  const ROOT=process.cwd();
  const ACTIVE=resolveGrahamActiveWeek({root:ROOT});
  const MARKET=ACTIVE.absolutePaths.dailyMarketLedger;
  const numbers=readJson(ACTIVE.absolutePaths.currentNumbers),market=readJson(MARKET);
  const observer=readJson(path.join(ROOT,'data/oddspapi-observer.json'));
  const live=readJson(path.join(ROOT,'data/live-odds.json'));
  const appended=appendDailyPinnacleSnapshots({numbers,market,observer,live});
  if(appended){
    fs.writeFileSync(MARKET,JSON.stringify(market,null,2)+'\n');
    const verify=JSON.parse(fs.readFileSync(MARKET,'utf8'));
    if(Number(verify.season)!==ACTIVE.season||Number(verify.week)!==ACTIVE.week)throw new Error('Graham daily capture active-week verification failed');
  }
  console.log(`GRAHAM DAILY CAPTURE // ${ACTIVE.season} W${ACTIVE.weekToken} // ${pacificDate(observer?.generatedAt)||'UNAVAILABLE'} // APPENDED ${appended}`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();

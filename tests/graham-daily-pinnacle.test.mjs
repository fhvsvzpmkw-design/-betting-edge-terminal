#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {appendDailyPinnacleSnapshots} from '../tools/capture-graham-daily-pinnacle.mjs';
import {resolveGrahamActiveWeek} from '../tools/graham-active-week.mjs';

const observedAt='2026-09-09T01:08:00Z'; // September 8 in Pacific time.
const now='2026-09-09T01:10:00Z';
const game={gameKey:'2026-W01-NE-SEA',away:'NE',home:'SEA',startTimePacific:'2026-09-09T17:20:00-07:00'};
function sample(){
  return {
    numbers:{games:[{...game,grahamFairHome:-2.5,grahamAsOf:'2026-09-08T18:20:00Z'}]},
    market:{games:[{...game,dailySnapshots:[]}]},
    observer:{status:'ok',generatedAt:observedAt,fixtures:[{
      fixtureId:'nfl-1',tournamentId:31,startTime:'2026-09-10T00:20:00Z',
      participant1Name:'Seattle Seahawks',participant2Name:'New England Patriots',
      pinnacle:{bookmakerIsActive:true,markets:[{
        marketId:'spread',marketActive:true,bookmakerMarketId:'spread/main',outcomes:[
          {players:[{active:true,bookmakerOutcomeId:'-3/home',price:1.91,priceAmerican:-110,mainLine:true}]},
          {players:[{active:true,bookmakerOutcomeId:'-3/away',price:1.91,priceAmerican:-110,mainLine:true}]}
        ]
      }]}
    }]},
    live:{generatedAt:observedAt,scheduleMeta:{slot:'manual',plannedReportTime:null,operatingDate:'2026-09-08'}},
    now
  };
}
const rows=x=>x.market.games[0].dailySnapshots;
const input=sample(),originalNumbers=structuredClone(input.numbers);
assert.equal(appendDailyPinnacleSnapshots(input),1,'manual refresh must establish the missing baseline');
assert.equal(rows(input)[0].pinnacleSpreadHome,-3);
assert.equal(rows(input)[0].reviewDate,'2026-09-08','capture day follows observed Pacific date, not UTC or number-board date');
assert.equal(rows(input)[0].pinnacleObservedAt,'2026-09-09T01:08:00.000Z');
assert.equal(rows(input)[0].grahamFairHome,-2.5);
assert.deepEqual(input.numbers,originalNumbers,'market capture must never change Graham fair');
const baseline=structuredClone(rows(input)[0]);
assert.equal(appendDailyPinnacleSnapshots(input),0,'same observation must be idempotent');
input.observer.generatedAt='2026-09-09T02:08:00Z';
input.live.generatedAt=input.observer.generatedAt;input.now='2026-09-09T02:10:00Z';
input.observer.fixtures[0].pinnacle.markets[0].outcomes[0].players[0].bookmakerOutcomeId='-3.5/home';
input.observer.fixtures[0].pinnacle.markets[0].outcomes[1].players[0].bookmakerOutcomeId='-3.5/away';
assert.equal(appendDailyPinnacleSnapshots(input),0,'later same-day price movement must not reset the daily baseline');
assert.deepEqual(rows(input),[baseline]);

for(const time of ['06:00','08:00','09:30','15:15','18:15']){
  const x=sample();x.live.scheduleMeta={plannedReportTime:time};
  assert.equal(appendDailyPinnacleSnapshots(x),1,`scheduled ${time} can establish a missing daily baseline`);
}
const recovery=sample();recovery.observer.fixtures=[];
assert.equal(appendDailyPinnacleSnapshots(recovery),1);
assert.equal(rows(recovery)[0].pinnacleStatus,'PINNACLE_UNAVAILABLE');
assert.equal(appendDailyPinnacleSnapshots(recovery),0,'same unavailable attempt is not duplicated');
const unavailable=structuredClone(rows(recovery)[0]);
recovery.observer=sample().observer;recovery.observer.generatedAt='2026-09-09T01:09:00Z';
assert.equal(appendDailyPinnacleSnapshots(recovery),1,'a later usable observation can complete a previously unavailable baseline');
assert.deepEqual(rows(recovery)[0],unavailable,'recovery preserves the original unavailable record');
assert.equal(rows(recovery)[1].pinnacleStatus,'AVAILABLE');

for(const [label,mutate] of [
  ['missing fair',x=>{x.numbers.games[0].grahamFairHome=null;}],
  ['fair written after the observation',x=>{x.numbers.games[0].grahamAsOf='2026-09-09T01:09:00Z';}],
  ['invalid fair timestamp',x=>{x.numbers.games[0].grahamAsOf='invalid';}],
  ['started game',x=>{x.market.games[0].startTimePacific='2026-09-09T01:00:00Z';}],
  ['prior-day observer',x=>{x.observer.generatedAt='2026-09-08T01:00:00Z';}],
  ['future observer',x=>{x.observer.generatedAt='2026-09-09T02:00:00Z';}],
  ['missing observer timestamp',x=>{x.observer.generatedAt=null;}],
  ['different feed day',x=>{x.live.generatedAt='2026-09-08T01:00:00Z';}]
]){
  const x=sample();mutate(x);
  assert.equal(appendDailyPinnacleSnapshots(x),0,`${label} cannot create a daily comparison`);
  assert.deepEqual(rows(x),[]);
}
const backfill=sample();backfill.market.games[0].dailySnapshots=[{...baseline,type:'BACKFILL'}];
assert.equal(appendDailyPinnacleSnapshots(backfill),0,'a recovered daily baseline remains fixed');
const nextDay=sample();nextDay.market.games[0].dailySnapshots=[baseline];
nextDay.observer.generatedAt='2026-09-09T15:00:00Z';
nextDay.live.generatedAt=nextDay.observer.generatedAt;nextDay.now='2026-09-09T15:01:00Z';
assert.equal(appendDailyPinnacleSnapshots(nextDay),1,'a later Pacific day appends a new daily baseline');
assert.deepEqual(rows(nextDay)[0],baseline);
assert.equal(rows(nextDay)[1].reviewDate,'2026-09-09');
assert.equal(rows(nextDay)[1].sequence,baseline.sequence+1);

// Exercise the real feed builder with isolated data: unavailable observations
// must not erase a usable baseline or manufacture an unchanged market.
const root=process.cwd(),active=resolveGrahamActiveWeek();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'graham-market-delta-'));
try{
  const copyPaths=[active.manifestPath,active.paths.currentNumbers,active.paths.researchLedger,
    'data/walters/nfl/graham-schedule-authority-v1.json','data/walters/nfl-power-ratings-ledger.json'];
  for(const rel of copyPaths){const dest=path.join(tmp,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,rel),dest);}
  const write=(rel,value)=>{const file=path.join(tmp,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value));};
  const board=JSON.parse(fs.readFileSync(path.join(tmp,active.paths.currentNumbers),'utf8'));
  board.games=[{...board.games[0],...game}];write(active.paths.currentNumbers,board);
  const ledger={season:active.season,week:active.week,games:[{...game,dailySnapshots:[
    {...baseline,pinnacleSpreadHome:-3.5},
    {...unavailable,sequence:baseline.sequence+1}
  ]}]};
  const observation=sample().observer;
  write(active.paths.dailyMarketLedger,ledger);write('data/oddspapi-observer.json',observation);write('data/live-odds.json',sample().live);
  const build=()=>{
    execFileSync(process.execPath,[path.join(root,'tools/build-graham-current-week.mjs')],{cwd:tmp,stdio:'pipe'});
    return JSON.parse(fs.readFileSync(path.join(tmp,'data/walters/nfl/current-week-terminal.json'),'utf8')).games[0];
  };
  assert.equal(build().pinnacleMove,0.5,'live -3 versus stored -3.5 must display +0.5 despite a later unavailable attempt');
  ledger.games[0].dailySnapshots[0].pinnacleSpreadHome=-3;write(active.paths.dailyMarketLedger,ledger);
  assert.equal(build().pinnacleMove,0,'a verified unchanged spread remains numeric zero');
  observation.status='error';write('data/oddspapi-observer.json',observation);
  const missingLive=build();assert.equal(missingLive.pinnacleMove,null,'a stored fallback price alone cannot establish zero movement');
  assert.equal(missingLive.grahamFairHome,board.games[0].grahamFairHome,'missing market evidence cannot change Graham fair');
  observation.status='ok';write('data/oddspapi-observer.json',observation);
  ledger.games[0].dailySnapshots=[];write(active.paths.dailyMarketLedger,ledger);
  assert.equal(build().pinnacleMove,null,'a current quote without a usable baseline remains unavailable');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
console.log('GRAHAM DAILY PINNACLE: PASS // manual/scheduled capture, fixed baseline, recovery, chronology, Pacific date, fair isolation');

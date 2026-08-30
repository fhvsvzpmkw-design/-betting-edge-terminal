#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const ledgerPath='data/walters/nfl/2026/week-01-daily-market-ledger.json';
const toolPath='tools/record-walters-pinnacle-comparison.mjs';
const ledger=JSON.parse(fs.readFileSync(ledgerPath,'utf8'));

assert(ledger.marketBenchmark?.bookmaker==='Pinnacle','Pinnacle must be the market benchmark');
assert(ledger.marketBenchmark?.executionAuthority===false,'Pinnacle comparison must not become execution authority');
assert(ledger.capturePolicy?.marketIsolationRule?.includes('before'),'Graham number must be completed before market comparison');
assert(ledger.capturePolicy?.immutabilityRule?.includes('append-only'),'daily snapshots must be append-only');
assert(Array.isArray(ledger.games)&&ledger.games.length===16,'Week 1 board must contain 16 games');
assert(new Set(ledger.games.map(g=>g.gameKey)).size===16,'Week 1 game keys must be unique');
for(const game of ledger.games){
  assert(Array.isArray(game.dailySnapshots),'every game must expose dailySnapshots');
  assert(Date.parse(game.startTimePacific),'every game must have a valid Pacific kickoff timestamp');
}

const tmp=path.join(os.tmpdir(),`walters-pinnacle-${process.pid}.json`);
fs.copyFileSync(ledgerPath,tmp);
try{
  const run=spawnSync(process.execPath,[toolPath,
    '--game','BUF-HOU',
    '--graham','-5.5',
    '--graham-as-of','2026-09-08T09:00:00-07:00',
    '--pinnacle','-4.5',
    '--pinnacle-price','-110',
    '--observed-at','2026-09-08T09:05:00-07:00',
    '--captured-at','2026-09-08T09:06:00-07:00',
    '--review-date','2026-09-08',
    '--source','OddsPapi Pinnacle',
    '--ledger',tmp
  ],{encoding:'utf8'});
  assert(run.status===0,`recorder failed: ${run.stderr||run.stdout}`);
  const after=JSON.parse(fs.readFileSync(tmp,'utf8'));
  const bufHou=after.games.find(g=>g.gameKey==='2026-W01-BUF-HOU');
  const other=after.games.find(g=>g.gameKey==='2026-W01-NE-SEA');
  const last=bufHou.dailySnapshots.at(-1);
  assert(last.grahamFairHome===-5.5,'Graham fair not preserved');
  assert(last.pinnacleSpreadHome===-4.5,'Pinnacle spread not preserved');
  assert(last.grahamHomeStrengthGap===1,'signed Graham-vs-Pinnacle gap is wrong');
  assert(last.pinnacleStatus==='AVAILABLE','Pinnacle availability state is wrong');
  assert(bufHou.dailySnapshots.length===ledger.games.find(g=>g.gameKey==='2026-W01-BUF-HOU').dailySnapshots.length+1,'snapshot was not appended');
  assert(other.dailySnapshots.length===ledger.games.find(g=>g.gameKey==='2026-W01-NE-SEA').dailySnapshots.length,'unrelated game was modified');

  const unavailable=spawnSync(process.execPath,[toolPath,
    '--game','NE-SEA',
    '--graham','-2',
    '--graham-as-of','2026-09-08T09:00:00-07:00',
    '--pinnacle-status','PINNACLE_UNAVAILABLE',
    '--captured-at','2026-09-08T09:06:00-07:00',
    '--review-date','2026-09-08',
    '--source','OddsPapi Pinnacle unavailable',
    '--ledger',tmp
  ],{encoding:'utf8'});
  assert(unavailable.status===0,`unavailable snapshot failed: ${unavailable.stderr||unavailable.stdout}`);
  const afterUnavailable=JSON.parse(fs.readFileSync(tmp,'utf8'));
  const neSea=afterUnavailable.games.find(g=>g.gameKey==='2026-W01-NE-SEA').dailySnapshots.at(-1);
  assert(neSea.pinnacleSpreadHome===null&&neSea.grahamHomeStrengthGap===null,'unavailable Pinnacle must remain null rather than substitute another book');
} finally {
  try{fs.unlinkSync(tmp)}catch{}
}

console.log('WALTERS PINNACLE DAILY COMPARISON: PASS');

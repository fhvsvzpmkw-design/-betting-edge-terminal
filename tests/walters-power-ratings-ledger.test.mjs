#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const ledgerPath='data/walters/nfl-power-ratings-ledger.json';
const seedPath='core/staging/walters-nfl-seed-dataset-2026.json';
const toolPath='tools/update-walters-power-rating.mjs';
const ledger=JSON.parse(fs.readFileSync(ledgerPath,'utf8'));
const seed=JSON.parse(fs.readFileSync(seedPath,'utf8'));

assert(ledger.ledgerId==='graham-mercer-nfl-power-ratings-v1','unexpected ledger id');
assert(ledger.carryForwardPolicy?.operationalField==='currentRating','currentRating must be operational carry-forward field');
assert(ledger.carryForwardPolicy?.seedResetAllowed===false,'seed resets must fail closed');
assert(ledger.carryForwardPolicy?.silentOverwriteAllowed===false,'silent rating overwrite must be prohibited');
assert(Array.isArray(ledger.teams)&&ledger.teams.length===32,'ledger must contain all 32 NFL teams');
assert(new Set(ledger.teams.map(t=>t.abbr)).size===32,'team abbreviations must be unique');

const seedMap=new Map(seed.powerRatings.map(r=>[r.team,r.rating]));
for(const team of ledger.teams){
  assert(seedMap.has(team.team),`seed is missing ${team.team}`);
  assert(team.seedRating===seedMap.get(team.team),`${team.team} seedRating does not match preserved VSiN seed`);
  assert(Number.isFinite(team.currentRating),`${team.team} currentRating must be numeric`);
  assert(Array.isArray(team.history)&&team.history.length>=1,`${team.team} must retain rating history`);
  const first=team.history[0];
  const last=team.history.at(-1);
  assert(first.type==='SEED'&&first.toRating===team.seedRating,`${team.team} immutable seed history event is invalid`);
  assert(last.toRating===team.currentRating,`${team.team} currentRating must equal the last history event`);
  if(team.history.length===1){
    assert(team.priorRating===null,`${team.team} initial priorRating must be null`);
  }else{
    const previous=team.history.at(-2);
    assert(team.priorRating===previous.toRating,`${team.team} priorRating must equal the previous carried rating`);
    assert(last.fromRating===team.priorRating,`${team.team} latest history event must start from priorRating`);
    assert(Number((last.fromRating+last.delta).toFixed(3))===last.toRating,`${team.team} latest history arithmetic is invalid`);
  }
  assert(team.externalComparisons?.espnFpi?.role==='INDEPENDENT_COMPARISON_ONLY',`${team.team} ESPN role must remain comparison-only`);
}

const bufBefore=ledger.teams.find(t=>t.abbr==='BUF');
const balBefore=ledger.teams.find(t=>t.abbr==='BAL');
const tmp=path.join(os.tmpdir(),`walters-power-ledger-${process.pid}.json`);
fs.copyFileSync(ledgerPath,tmp);
try{
  const run=spawnSync(process.execPath,[toolPath,'--team','BUF','--delta','0.5','--reason','Regression test carry-forward','--source','TEST SOURCE','--effective-at','2026-08-30T13:30:00-07:00','--ledger',tmp],{encoding:'utf8'});
  assert(run.status===0,`updater failed: ${run.stderr||run.stdout}`);
  const after=JSON.parse(fs.readFileSync(tmp,'utf8'));
  const buf=after.teams.find(t=>t.abbr==='BUF');
  const bal=after.teams.find(t=>t.abbr==='BAL');
  const expected=Number((bufBefore.currentRating+0.5).toFixed(3));
  assert(buf.seedRating===bufBefore.seedRating,'Buffalo immutable seed changed');
  assert(buf.priorRating===bufBefore.currentRating,'Buffalo prior rating was not preserved');
  assert(buf.currentRating===expected,'Buffalo carried rating did not advance by +0.5');
  assert(buf.lastDelta===0.5,'Buffalo last delta incorrect');
  assert(buf.history.length===bufBefore.history.length+1,'Buffalo update history was not appended');
  assert(buf.history.at(-1).fromRating===bufBefore.currentRating&&buf.history.at(-1).toRating===expected,'Buffalo transition history incorrect');
  assert(bal.seedRating===balBefore.seedRating&&bal.currentRating===balBefore.currentRating&&bal.history.length===balBefore.history.length,'unrelated team was modified');
} finally {
  try{fs.unlinkSync(tmp)}catch{}
}

console.log('WALTERS POWER-RATING LEDGER: PASS');

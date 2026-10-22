import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {verifyGrahamIndependentReadback as verify} from '../tools/graham-independent-readback.mjs';

function fixture(){
  const active={season:2026,week:7,manifest:{state:'ACTIVE',authority:'GRAHAM_WEEK_ROLLOVER'}};
  const game={gameKey:'2026-W07-NE-CHI',away:'NE',home:'CHI',startTimePacific:'2026-10-22T17:15:00-07:00',
    grahamFairHome:0,grahamAsOf:'2026-10-21T20:10:00Z',numberStatus:'READY_WITH_UNRESOLVED_PERSONNEL_OR_QB_INPUTS',
    informationStatus:'PERSONNEL_PRODUCTION_REVIEWED',
    personnelEstimateCases:[{caseKey:'estimate',assumptionRationale:'PRIVATE_MARKET_SENTINEL'}],
    personnelUnresolvedCases:[{caseKey:'unresolved',nested:{price:'PRIVATE_MARKET_SENTINEL'}}],
    personnelBlockedGroups:[],qbPerformanceFailClosedTeams:[],qbPriorEstimateTeams:[],qbPriorEstimates:[]};
  const board={season:2026,week:7,state:'ACTIVE',baselineStatus:'CURRENT_BASELINE_COMPLETE',games:[game]};
  const terminal={schema:1,feedId:'graham-mercer-nfl-current-week-terminal-v1',season:2026,week:7,
    activeWeek:{season:2026,week:7,authority:'GRAHAM_WEEK_ROLLOVER'},state:board.state,baselineStatus:board.baselineStatus,
    generatedAt:'2026-10-21T23:07:52Z',lastResearchAt:'2026-10-21T23:00:30Z',games:[structuredClone(game)]};
  return {active,board,terminal};
}

test('valid readback preserves genuine zero and unresolved inputs without claiming readiness or deployment',()=>{
  const result=verify(fixture());
  assert.equal(result.repositoryReadback,'VERIFIED');
  assert.equal(result.deployedReadback,'NOT_CHECKED');
  assert.equal(result.games[0].grahamFairHome,0);
  assert.equal(result.games[0].personnelUnresolvedCount,1);
  assert.equal(result.games[0].personnelEstimateCount,1);
  assert.equal(result.marketViewed,undefined);
});

test('explicit output allowlist drops existing, future and nested market information',()=>{
  const f=fixture();
  f.terminal.pinnacle='PRIVATE_MARKET_SENTINEL';
  f.terminal.games[0].pinnacleSpreadHome=8.5;
  f.terminal.games[0].proposedWager={price:'PRIVATE_MARKET_SENTINEL'};
  f.terminal.games[0].researchSummary='PRIVATE_MARKET_SENTINEL';
  f.terminal.futureField={newBook:'PRIVATE_MARKET_SENTINEL'};
  const output=JSON.stringify(verify(f));
  assert.doesNotMatch(output,/PRIVATE_MARKET_SENTINEL|pinnacle|proposedWager|researchSummary|futureField|8\.5/);
  assert.deepEqual(Object.keys(verify(f).games[0]).sort(),['gameKey','away','home','startTimePacific','grahamFairHome','grahamAsOf','personnelUnresolvedCount','personnelBlockedGroupCount','personnelEstimateCount','qbBlockedTeams'].sort());
});

test('market-only changes do not affect independent verification',()=>{
  const f=fixture(),expected=verify(f);
  f.terminal.games[0].pinnacleSpreadHome=-9;
  f.terminal.games[0].pinnacleHomePriceAmerican=-120;
  assert.deepEqual(verify(f),expected);
});

test('null fair stays pending and is never coerced to zero',()=>{
  const f=fixture();f.board.games[0].grahamFairHome=null;f.terminal.games[0].grahamFairHome=null;
  assert.equal(verify(f).games[0].grahamFairHome,null);
  f.terminal.games[0].grahamFairHome=0;
  assert.throws(()=>verify(f),/GRAHAMFAIRHOME_MISMATCH/);
});

test('wrong week, missing/duplicate games and stale independent fields fail closed',()=>{
  for(const mutate of [
    f=>{f.terminal.week=6;},
    f=>{f.terminal.activeWeek.week=6;},
    f=>{f.terminal.games=[];},
    f=>{f.terminal.games.push(structuredClone(f.terminal.games[0]));},
    f=>{f.terminal.games[0].grahamFairHome=-1;},
    f=>{f.terminal.games[0].grahamAsOf='2026-10-20T20:10:00Z';},
    f=>{f.terminal.games[0].personnelUnresolvedCases=[];},
    f=>{f.terminal.games[0].personnelUnresolvedCases[0].nested.price='changed';},
    f=>{f.terminal.games[0].personnelEstimateCases=[];},
    f=>{f.terminal.games[0].personnelBlockedGroups=[{group:'DB'}];},
    f=>{f.terminal.games[0].qbPerformanceFailClosedTeams=['NE'];},
    f=>{f.terminal.games[0].numberStatus='READY';},
    f=>{f.terminal.generatedAt='2026-10-20T20:10:00Z';}
  ]){const f=fixture();mutate(f);assert.throws(()=>verify(f));}
});

test('same-count duplicate identities and malformed source fields are rejected',()=>{
  const f=fixture();
  const second={...structuredClone(f.board.games[0]),gameKey:'2026-W07-KC-SEA',away:'KC',home:'SEA'};
  f.board.games.push(second);f.terminal.games.push(structuredClone(f.terminal.games[0]));
  assert.throws(()=>verify(f),/DUPLICATE_GAME/);
  for(const mutate of [
    x=>{x.board.games[0].grahamFairHome='PRIVATE_MARKET_SENTINEL';},
    x=>{x.board.games[0].gameKey='PRIVATE_MARKET_SENTINEL';},
    x=>{x.board.games[0].grahamAsOf='PRIVATE_MARKET_SENTINEL';},
    x=>{x.board.games[0].qbPerformanceFailClosedTeams=['PRIVATE_MARKET_SENTINEL'];}
  ]){const x=fixture();mutate(x);assert.throws(()=>verify(x),e=>!e.message.includes('PRIVATE_MARKET_SENTINEL'));}
});

test('deployed confirmation requires matching independent publication and research time',()=>{
  const f=fixture();f.deployedTerminal=structuredClone(f.terminal);
  assert.equal(verify(f).deployedReadback,'VERIFIED');
  f.deployedTerminal.games[0].personnelUnresolvedCases=[];
  assert.throws(()=>verify(f),/DEPLOYED_GAME_PERSONNELUNRESOLVEDCASES_MISMATCH/);
  f.deployedTerminal=structuredClone(f.terminal);
  f.deployedTerminal.lastResearchAt='2026-10-21T22:00:30Z';
  assert.throws(()=>verify(f),/DEPLOYED_RESEARCH_TIME_MISMATCH/);
});

test('CLI verifies stored terminal without exposing raw bytes and sanitizes failures',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'graham-independent-readback-'));
  const script=path.resolve('tools/graham-independent-readback.mjs');
  try{
    const f=fixture(),write=(name,value)=>{const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value));};
    write('data/walters/nfl/active-week.json',{schema:1,season:2026,week:7,...f.active.manifest});
    write('data/walters/nfl/2026/week-07-current-numbers.json',f.board);
    write('data/walters/nfl/current-week-terminal.json',f.terminal);
    let result=spawnSync(process.execPath,[script,'--root',root],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    assert.equal(JSON.parse(result.stdout).repositoryReadback,'VERIFIED');
    assert.doesNotMatch(result.stdout+result.stderr,/PRIVATE_MARKET_SENTINEL/);
    fs.writeFileSync(path.join(root,'data/walters/nfl/current-week-terminal.json'),'PRIVATE_MARKET_SENTINEL');
    result=spawnSync(process.execPath,[script,'--root',root],{encoding:'utf8'});
    assert.equal(result.status,1);assert.equal(result.stdout,'');
    assert.match(result.stderr,/READBACK_INPUT_UNAVAILABLE/);
    assert.doesNotMatch(result.stderr,/PRIVATE_MARKET_SENTINEL/);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

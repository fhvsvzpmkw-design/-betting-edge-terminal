import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {deriveGrahamFairDecomposition} from '../tools/graham-fair-decomposition.mjs';
import {refreshRatingBases} from '../tools/graham-refresh-rating-bases.mjs';

const read=p=>JSON.parse(fs.readFileSync(p));
const policy=read('data/walters/nfl/graham-fair-decomposition-policy-v1.json');
function withheldGame(){return {
  gameKey:'2026-W08-LAC-LAR',away:'LAC',home:'LAR',startTimePacific:'2026-11-01T13:05:00-08:00',
  neutralBaseHome:1,grahamFairHome:null,grahamExactFairHome:null,grahamAsOf:'2026-10-27T12:00:00Z',
  numberStatus:'FAIL_CLOSED_H4_SHARED_VENUE_METHOD_REQUIRED',informationStatus:'H4_SHARED_VENUE_OR_METRO_UNRESOLVED',
  venueClass:'SHARED_VENUE_OR_METRO',homeFieldVenueClass:'SHARED_VENUE_OR_METRO',
  homeFieldAdvantagePoints:null,homeFieldPointsToHomeSpread:null,homeFieldNonLocationExactFairHome:null,
  personnelBaselineExactFairHome:null,personnelOverlayPointsToHomeSpread:0,matchupOverlayPointsToHomeSpread:0,
  adjustments:[{type:'HOME_FIELD',venueClass:'SHARED_VENUE_OR_METRO',pointsToHomeSpread:null,homeLocationAdvantagePoints:null}],
  ratingCarryForward:{awayRating:2,homeRating:1},sourceRefs:[]
};}
function fixture(game=withheldGame()){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'graham-withheld-fair-'));
  for(const rel of ['personnel-production-current.json','player-values/stage2-current.json','stage3/stage3-current.json','player-values/player-values-2026-v1.json','personnel-calibration-v1.json']){
    const src='data/walters/nfl/'+rel,dest=path.join(root,src);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(src,dest);
  }
  const players=read('data/walters/nfl/player-values/player-values-2026-v1.json').players;
  const player=players.find(p=>p.valueStatus==='CALIBRATED'&&p.position==='DT'&&p.waltersPoints>0);
  const replacement=players.find(p=>p.valueStatus==='CALIBRATED'&&p.position==='DT'&&p.waltersPoints===0);
  assert.ok(player&&replacement);
  const write=(p,j)=>{const dest=path.join(root,'data/walters/nfl/'+p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(j));};
  const input={schema:1,state:'READY',season:2026,week:8,batchId:'withheld-fixture',effectiveAt:'2026-10-31T23:00:00Z',marketViewed:false,cases:[{
    personnelEventId:'absence',caseKey:'absence',gameKey:game.gameKey,team:game.away,side:'AWAY',
    player:player.player,playerEaId:player.eaPlayerId,replacementPlayer:replacement.player,replacementEaId:replacement.eaPlayerId,
    availabilityStatus:'OUT',resolutionStatus:'RESOLVED_ONE_FOR_ONE',reason:'Source-bound test absence',sourceRefs:['https://example.invalid/official-fixture']
  }]};
  write('personnel-staging.json',input);write('2026/week-08-current-numbers.json',{season:2026,week:8,games:[game]});write('2026/week-08-research-ledger.json',{season:2026,week:8,sweeps:[]});
  return {root,game,input,write,player,boardPath:path.join(root,'data/walters/nfl/2026/week-08-current-numbers.json'),run:()=>execFileSync(process.execPath,[path.resolve('tools/apply-graham-personnel-staging.mjs')],{cwd:root,stdio:'pipe'})};
}
test('personnel work records a supported loss while preserving the withheld location-dependent fair',()=>{
  const f=fixture();try{
    f.run();const game=read(f.boardPath).games[0];
    assert.equal(game.personnelOverlayPointsToHomeSpread,-f.player.waltersPoints);
    for(const key of ['grahamFairHome','grahamExactFairHome','personnelBaselineExactFairHome','homeFieldPointsToHomeSpread'])assert.equal(game[key],null,key);
    for(const key of ['numberStatus','informationStatus','grahamAsOf'])assert.equal(game[key],f.game[key],key);
    assert.equal(deriveGrahamFairDecomposition(game,policy).arithmeticVerified,false);
  }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test('normal missing fairs fail before writing the board or personnel ledger',()=>{
  const g=withheldGame();g.numberStatus='READY';
  const f=fixture(g);try{
    const original=fs.readFileSync(f.boardPath);
    assert.throws(f.run,/INVALID_GRAHAM_FAIR_BEFORE_PERSONNEL/);
    assert.deepEqual(fs.readFileSync(f.boardPath),original);
    assert.equal(fs.existsSync(path.join(f.root,'data/walters/nfl/2026/week-08-personnel-ledger.json')),false);
  }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test('wrong team, wrong side, duplicate event ids and started games cannot alter the published board',()=>{
  for(const [mutate,expected] of [
    [f=>f.input.cases[0].side='HOME',/TEAM_SIDE_MISMATCH/],
    [f=>f.input.cases[0].side='home',/TEAM_SIDE_MISMATCH/],
    [f=>f.input.cases[0].team='BUF',/TEAM_SIDE_MISMATCH/],
    [f=>f.input.cases.push({...f.input.cases[0]}),/DUPLICATE_PERSONNEL_EVENT_ID/],
    [f=>f.input.effectiveAt=f.game.startTimePacific,/STARTED_GAME_FROZEN/]
  ]){
    const f=fixture();try{const original=fs.readFileSync(f.boardPath);mutate(f);f.write('personnel-staging.json',f.input);assert.throws(f.run,expected);assert.deepEqual(fs.readFileSync(f.boardPath),original);}finally{fs.rmSync(f.root,{recursive:true,force:true});}
  }
});
test('missing playing effectiveness stays unresolved instead of applying a zero-percent assumption',()=>{
  for(const missing of [null,'',false,[]]){
    const f=fixture();try{
      Object.assign(f.input.cases[0],{availabilityStatus:'PLAYING_LIMITED',approvedEffectivenessPct:missing});f.write('personnel-staging.json',f.input);f.run();
      const game=read(f.boardPath).games[0];assert.equal(game.personnelOverlayPointsToHomeSpread,0);assert.match(game.personnelUnresolvedCases[0].failClosedCode,/REVIEW_REQUIRED_EFFECTIVENESS/);
    }finally{fs.rmSync(f.root,{recursive:true,force:true});}
  }
});
test('decomposition rejects missing normal fairs and team bases without coercing them to zero',()=>{
  const normal={gameKey:'g',neutralBaseHome:0,grahamExactFairHome:0,grahamFairHome:0,adjustments:[]};
  assert.equal(deriveGrahamFairDecomposition(normal,policy).exactFairHome,0);
  for(const key of ['neutralBaseHome','grahamExactFairHome','grahamFairHome'])for(const missing of [null,'',false,[],{}])assert.throws(()=>deriveGrahamFairDecomposition({...normal,[key]:missing},policy),/GRAHAM_FAIR_DECOMPOSITION_MISSING/);
  for(const key of ['homeFieldPointsToHomeSpread','personnelOverlayPointsToHomeSpread','matchupOverlayPointsToHomeSpread'])assert.throws(()=>deriveGrahamFairDecomposition({...normal,[key]:null},policy),/GRAHAM_FAIR_DECOMPOSITION_MISSING/);
  assert.throws(()=>deriveGrahamFairDecomposition({...normal,adjustments:[{type:'HOME_FIELD',pointsToHomeSpread:null}]},policy),/GRAHAM_FAIR_DECOMPOSITION_MISSING/);
});
function ratingFixture(){
  const receipt={sourceWeek:7,targetWeek:8,state:'PARTIAL_BLOCKED',marketViewed:false,blockedGames:[]};
  return {active:{season:2026,week:8},board:{season:2026,week:8,baselineStatus:'PENDING_TUESDAY_GRAHAM_BASELINE',games:[withheldGame()]},
    power:{weekly90_10:receipt,teams:[{abbr:'LAC',currentRating:3,history:[{auditId:'paired-source'}]},{abbr:'LAR',currentRating:1,history:[]}]},
    staging:{auditType:'WALTERS_WEEKLY_90_10',state:'APPLIED',marketViewed:false,auditId:'paired-source',appliedAt:'2026-10-30T23:00:00Z',result:{receipt,ratingChanges:[{team:'LAC',priorRating:2,currentRating:3}]}},
    policy,effectiveAt:'2026-10-31T23:00:00Z',powerBlobSha:'a'.repeat(40)};
}
function matchupFixture(game=withheldGame()){
  const f=fixture(game);
  for(const rel of ['data/walters/nfl/matchup-production-current.json','data/walters/nfl/matchup-stage3/stage3-current.json','data/walters/nfl-power-ratings-ledger.json']){
    const dest=path.join(f.root,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(rel,dest);
  }
  f.write('active-week.json',{schema:1,state:'ACTIVE',authority:'GRAHAM_WEEK_ROLLOVER',season:2026,week:8});
  f.write('2026/week-08-daily-market-ledger.json',{season:2026,week:8});
  f.write('2026/week-08-personnel-ledger.json',{season:2026,week:8,marketViewed:false,currentCases:{},events:[]});
  const candidates=read('data/walters/nfl/player-values/player-values-2026-v1.json').players.filter(p=>p.valueStatus==='CALIBRATED'&&p.position==='DT'&&p.waltersPoints===0).slice(0,2);
  assert.equal(candidates.length,2);
  Object.assign(f.input.cases[0],{matchupEventId:'committee',productionClass:'VALUE_INVARIANT_COMMITTEE',resolutionStatus:'RESOLVED_VALUE_INVARIANT_COMMITTEE',baselineDoubleCountReviewed:true,clusterGuardStatus:'PASS',committeeCandidates:candidates.map(p=>({player:p.player,eaPlayerId:p.eaPlayerId})),matchupReview:{status:'REVIEWED_ZERO',increment:0,reason:'No nonzero opponent adjustment',sourceRefs:['https://example.invalid/official-fixture']}});
  f.write('matchup-production-staging.json',f.input);
  f.run=()=>execFileSync(process.execPath,[path.resolve('tools/apply-graham-matchup-production.mjs')],{cwd:f.root,stdio:'pipe'});
  return f;
}
test('M4 committee writer preserves the explicit shared-venue null fair while recording supported personnel loss',()=>{
  const f=matchupFixture();try{
    f.run();const g=read(f.boardPath).games[0];assert.equal(g.personnelOverlayPointsToHomeSpread,-f.player.waltersPoints);
    assert.equal(g.grahamExactFairHome,null);assert.equal(g.grahamFairHome,null);assert.equal(g.personnelBaselineExactFairHome,null);
    assert.equal(g.numberStatus,f.game.numberStatus);assert.equal(g.grahamAsOf,f.game.grahamAsOf);assert.equal(g.informationStatus,f.game.informationStatus);
    assert.equal(deriveGrahamFairDecomposition(g,policy).arithmeticVerified,false);
  }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
test('M4 keeps ordinary committee arithmetic while rejecting unreviewed zero, wrong sides, duplicate events and started games',()=>{
  const game={...withheldGame(),numberStatus:'READY',venueClass:'DOMESTIC_HOME',homeFieldVenueClass:'DOMESTIC_HOME',homeFieldAdvantagePoints:2.082,homeFieldPointsToHomeSpread:-2.082,grahamExactFairHome:-1.082,grahamFairHome:-1,personnelBaselineExactFairHome:-1.082,homeFieldNonLocationExactFairHome:1,adjustments:[{type:'HOME_FIELD',pointsToHomeSpread:-2.082}]};
  const good=matchupFixture(game);try{good.run();const g=read(good.boardPath).games[0];assert.equal(g.grahamExactFairHome,Number((-1.082-good.player.waltersPoints).toFixed(3)));assert.equal(deriveGrahamFairDecomposition(g,policy).arithmeticVerified,true);}finally{fs.rmSync(good.root,{recursive:true,force:true});}
  for(const [mutate,expected] of [
    [f=>f.input.cases[0].matchupReview.increment=null,/ZERO_MATCHUP_REVIEW_REQUIRED/],
    [f=>f.input.cases[0].side='HOME',/TEAM_SIDE_MISMATCH/],
    [f=>f.input.cases.push({...f.input.cases[0]}),/DUPLICATE_EVENT_ID/],
    [f=>f.input.effectiveAt=f.game.startTimePacific,/STARTED_GAME_FROZEN/]
  ]){
    const f=matchupFixture();try{const original=fs.readFileSync(f.boardPath);mutate(f);f.write('matchup-production-staging.json',f.input);assert.throws(f.run,expected);assert.deepEqual(fs.readFileSync(f.boardPath),original);assert.deepEqual(read(path.join(f.root,'data/walters/nfl/2026/week-08-personnel-ledger.json')).events,[]);}finally{fs.rmSync(f.root,{recursive:true,force:true});}
  }
});
test('verified rating propagation updates the retained team base without inventing shared-venue HFA',()=>{
  const f=ratingFixture(),r=refreshRatingBases(f),g=r.board.games[0];
  assert.equal(g.neutralBaseHome,2);assert.equal(g.ratingCarryForward.awayRating,3);
  for(const key of ['grahamFairHome','grahamExactFairHome','personnelBaselineExactFairHome','homeFieldNonLocationExactFairHome','homeFieldPointsToHomeSpread'])assert.equal(g[key],null,key);
  for(const key of ['numberStatus','informationStatus','grahamAsOf'])assert.equal(g[key],f.board.games[0][key],key);
  assert.equal(g.fairDecomposition.neutralTeamBaseHome,2);assert.equal(g.weeklyRatingInput.applicationStatus,'APPLIED');
  assert.equal(refreshRatingBases({...f,board:r.board}).changed,false);
});

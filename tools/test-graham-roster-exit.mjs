import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluateWeeklyEvidence} from './graham-weekly-evidence.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const calibration=read('data/walters/nfl/personnel-calibration-v1.json'),registry=read('data/walters/nfl/player-values/player-values-2026-v1.json');
const gameKey='2026-W05-PHI-JAX',sourceIds=['transaction'];
function fixture(type='TRADE'){
 const c={caseKey:'archived',player:'Cam Jurgens',eaPlayerId:'22273',resolution:'SOURCE_CONFIRMED_ROSTER_EXIT',modelId:'graham-roster-exit-closure-v1',availabilityStatus:'ROSTER_EXIT',rationale:'Synthetic dated roster departure supersedes a stale injury case.',sourceIds,rosterExit:{type,fromTeam:'PHI',toTeam:'BAL',finalized:true,normalDutyEnded:true,effectiveAt:'2026-10-07T17:00:00Z',rationale:'Synthetic official finalized transaction.',sourceIds}};
 const team=(team,cases)=>({team,cases,coverage:'FINAL_GAME_DAY',allAbsencesReviewed:true,coverageRationale:'Synthetic final review',sourceIds,qbAvailability:{state:'NO_GAME_DAY_LOSS',sourceIds,rationale:'Synthetic full QB duty'}});
 return {calibration,registry,production:{state:'OPERATIONAL',productionAuthority:true},matchupProduction:{state:'OPERATIONAL_SCOPED',productionAuthority:true},prior:{season:2026,week:5,games:[{gameKey,away:'PHI',home:'JAX',startTimePacific:'2026-10-11T06:30:00-07:00'}]},personnel:{season:2026,week:5,calibrationId:calibration.calibrationId,currentCases:{archived:{caseKey:'archived',gameKey,team:'PHI',player:'Cam Jurgens'}}},bundle:{schema:1,season:2026,sourceWeek:5,estimationPolicy:'graham-historical-value-estimates-v1',marketViewed:false,recordedAt:'2026-10-20T20:00:00Z',sources:[{id:'transaction',kind:'OFFICIAL',url:'https://example.com/synthetic-transaction',finding:'Synthetic finalized transaction',checkedAt:'2026-10-20T19:00:00Z',gameKeys:[gameKey]}],games:[{gameKey,away:'PHI',home:'JAX',state:'READY',teams:[team('PHI',[c]),team('JAX',[])]}]}};
}
let n=0;
const check=(name,fn)=>{fn();n++;console.log('PASS '+name);};
const run=f=>evaluateWeeklyEvidence(f).games[0];
const record=f=>f.bundle.games[0].teams[0].cases[0];
check('dated trade and retirement close stale cases without claiming active duty',()=>{
 for(const type of ['TRADE','RETIREMENT']){const f=fixture(type),g=run(f);assert.equal(g.state,'READY');assert.equal(g.teams[0].injuryLoss,0);const c=g.teams[0].cases[0];assert.equal(c.healthyValue,.5);assert.equal(c.modelEstimate.classification,'SOURCE_CONFIRMED_NON_INJURY_CLOSURE');assert.equal(c.modelEstimate.rosterExit.type,type);assert.equal(c.replacementValue,null);}
});
check('later roster news cannot erase a real game-day injury',()=>{const f=fixture();record(f).rosterExit.effectiveAt='2026-10-12T00:00:00Z';assert.ok(run(f).blockers.some(b=>b.code==='ROSTER_EXIT_BEFORE_KICKOFF_REQUIRED'));});
check('pending trades and current-roster absence alone cannot close an injury',()=>{
 for(const change of [c=>c.rosterExit.finalized=false,c=>delete c.rosterExit.effectiveAt,c=>c.rosterExit.fromTeam='JAX',c=>c.rosterExit.toTeam='PHI',c=>c.rosterExit.normalDutyEnded=false]){const f=fixture();change(record(f));assert.equal(run(f).state,'BLOCKED');}
});
check('roster closure requires an official game-specific source',()=>{const f=fixture();f.bundle.sources[0].kind='REPORTING';assert.ok(run(f).blockers.some(b=>b.code==='ROSTER_EXIT_OFFICIAL_SOURCE_REQUIRED'));});
check('closure retains the archived identity and cannot carry replacement credit',()=>{
 for(const change of [f=>record(f).replacements=[{player:'Jake Majors'}],f=>record(f).player='Lane Johnson',f=>{f.personnel.currentCases={};record(f).newlyIdentified=true;}]){const f=fixture();change(f);assert.equal(run(f).state,'BLOCKED');}
});
console.log(`ROSTER EXIT CLOSURE: ${n} PASS`);

import fs from 'node:fs';
import assert from 'node:assert/strict';
import {evaluateWeeklyEvidence,loadWeeklyEvidence,gitBlob} from './graham-weekly-evidence.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const path='data/walters/nfl/2026/week-02-weekly-evidence/2026-09-22-phi-role-chain-recovery.json';
const bundle=read(path),inputs={bundle,personnel:read('data/walters/nfl/2026/week-02-personnel-ledger.json'),prior:read('data/walters/nfl/2026/week-02-current-numbers.json'),registry:read('data/walters/nfl/player-values/player-values-2026-v1.json'),calibration:read('data/walters/nfl/personnel-calibration-v1.json'),production:read('data/walters/nfl/personnel-production-current.json'),matchupProduction:read('data/walters/nfl/matchup-production-current.json')};
let count=0;
const check=(name,fn)=>{fn();count++;console.log('PASS '+name);};
const individual=x=>evaluateWeeklyEvidence(x).games[0].caseReviews[0];
const mutation=(change,pattern)=>{const x=structuredClone(inputs);change(x.bundle.games[0].caseReviews[0],x);const r=individual(x);assert.equal(r.state,'BLOCKED');assert.match(r.reason,pattern);};
check('real Philadelphia chain retains Jurgens on both sides and calculates 1.200',()=>{
 const r=individual(inputs);assert.equal(r.state,'CASE_ESTIMATE_ONLY');assert.equal(r.estimate.injuryLoss,1.2);
 const {before,after}=r.estimate.reconciledRoles;assert.equal(before.find(r=>r.player==='Cam Jurgens').lockedValue,0.5);assert.equal(after.find(r=>r.player==='Cam Jurgens').lockedValue,0.5);
 assert.equal(r.estimate.replacementValue,0);assert.equal(evaluateWeeklyEvidence(inputs).readyGames,0);
});
check('unfilled original center role is rejected',()=>mutation(c=>c.roleChain.after.pop(),/ASSIGNMENTS/));
check('same player cannot fill two simultaneous positions',()=>mutation(c=>Object.assign(c.roleChain.after[1],{player:'Cam Jurgens',eaPlayerId:'22273'}),/DUPLICATE/));
check('unrelated source cannot establish a moved-player assignment',()=>mutation(c=>c.roleChain.after[0].sourceIds=['unrecorded'],/SOURCE/));
check('missing locked identity never becomes zero-valued incoming player',()=>mutation(c=>{c.replacements[0].eaPlayerId='missing';},/LOCKED_PLAYER_IDENTITY/));
check('inactive incoming player cannot fill the new vacancy',()=>mutation(c=>c.roleChain.after[1].availabilityStatus='OUT',/OCCUPANT_AVAILABILITY/));
check('displaced duties cannot be silently declared absent',()=>mutation(c=>c.baselineDutiesDisplaced=false,/BASELINE/));
check('extra disconnected unchanged position cannot pad a chain',()=>mutation(c=>{
 const row={role:'RT',player:'Lane Johnson',eaPlayerId:'1072',sourceIds:['phi-post'],rationale:'Synthetic disconnected row'};
 const p=inputs.registry.players.find(p=>p.player==='Lane Johnson');row.eaPlayerId=String(p.eaPlayerId);
 c.roleChain.before.push(row);c.roleChain.after.push({...row,availabilityStatus:'ACTIVE',assignmentEvidence:'REPORTED_STARTER'});
},/DISCONNECTED/));
// Synthetic paired fixture only: never save or publish these coverage declarations.
function paired(){
 const x=structuredClone(inputs),g=x.bundle.games[0],c=g.caseReviews[0];
 c.newlyIdentified=true;
 const team=abbr=>({team:abbr,coverage:'FINAL_GAME_DAY',allAbsencesReviewed:true,coverageRationale:'Synthetic test fixture, not real coverage',sourceIds:g.sourceIds,qbAvailability:{state:'NO_GAME_DAY_LOSS',rationale:'Synthetic test fixture',sourceIds:g.sourceIds},cases:abbr==='PHI'?[c]:[]});
 g.state='READY';g.teams=[team('PHI'),team('TEN')];delete g.caseReviews;delete g.blockers;
 x.personnel.currentCases={};return x;
}
check('fully covered synthetic pair accepts reconciled chain using existing team calculator',()=>{
 const g=evaluateWeeklyEvidence(paired()).games[0];assert.equal(g.state,'READY');assert.equal(g.teams.find(t=>t.team==='PHI').injuryLoss,1.2);
});
check('real archived omitted Greenard case still blocks a paired promotion',()=>{
 const x=paired();x.personnel=inputs.personnel;const g=evaluateWeeklyEvidence(x).games[0];assert.equal(g.state,'BLOCKED');assert.ok(g.blockers.some(b=>b.code.includes('PRIOR_CASE')));
});
check('chain occupant cannot also be unavailable in another case in either order',()=>{
 for(const reverse of [false,true]){
  const x=paired(),cs=x.bundle.games[0].teams[0].cases;cs[0].newlyIdentified=true;
  cs.push({...structuredClone(cs[0]),caseKey:'synthetic-jurgens-out',player:'Cam Jurgens',eaPlayerId:'22273',resolution:'ONE_FOR_ONE',availabilityStatus:'OUT',replacements:[{player:'Willie Lampkin IV',eaPlayerId:'4639'}]});
  if(reverse)cs.reverse();const g=evaluateWeeklyEvidence(x).games[0];assert.equal(g.state,'BLOCKED');assert.ok(g.blockers.some(b=>b.code.includes('CHAIN_OCCUPANT_UNAVAILABLE')));
 }
});
check('retained starter cannot be credited as replacement for another absence in either order',()=>{
 for(const reverse of [false,true]){
  const x=paired(),cs=x.bundle.games[0].teams[0].cases,p=x.registry.players.find(p=>p.player==='Lane Johnson');
  cs.push({...structuredClone(cs[0]),caseKey:'synthetic-lane-out',player:p.player,eaPlayerId:String(p.eaPlayerId),resolution:'ONE_FOR_ONE',availabilityStatus:'OUT',replacements:[{player:'Cam Jurgens',eaPlayerId:'22273'}]});
  if(reverse)cs.reverse();const g=evaluateWeeklyEvidence(x).games[0];assert.equal(g.state,'BLOCKED');assert.ok(g.blockers.some(b=>b.code.includes('DOUBLE_COUNT')));
 }
});
check('new real bundle passes Git ancestry, path and exact blob binding',()=>{
 const bytes=fs.readFileSync(path),r=loadWeeklyEvidence(process.cwd(),{path,blobSha:gitBlob(bytes)},{season:2026,sourceWeek:2,effectiveAt:bundle.recordedAt});
 assert.equal(r.readyGames,0);assert.equal(r.games[0].caseReviews[0].estimate.injuryLoss,1.2);
});
console.log(`HISTORICAL ROLE CHAIN: ${count} PASS`);

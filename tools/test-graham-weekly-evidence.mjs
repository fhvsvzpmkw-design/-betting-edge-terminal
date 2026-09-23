import './test-graham-historical-value-estimates.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {evaluateWeeklyEvidence,loadWeeklyEvidence,gitBlob,boundJson,verifyWeeklyGameEvidence} from './graham-weekly-evidence.mjs';
const read=p=>JSON.parse(fs.readFileSync(p));
const calibration=read('data/walters/nfl/personnel-calibration-v1.json');
const registry=read('data/walters/nfl/player-values/player-values-2026-v1.json');
const gameKey='2026-W01-DAL-NYG',sourceIds=['official'];
const c={caseKey:'smith',player:'Tyler Smith',resolution:'ONE_FOR_ONE',availabilityStatus:'OUT',rationale:'Synthetic final inactive fixture',sourceIds,baselineDoubleCountReviewed:true,roleRationale:'Synthetic exclusive replacement fixture',roleSourceIds:sourceIds,replacements:[{player:'T.J. Bass'}]};
// Resolve exact frozen spelling; fixture identity remains explicit.
c.replacements[0].player=registry.players.find(p=>p.player.replace(/[^a-z]/gi,'').toLowerCase()==='tjbass').player;
const team=(team,cases)=>({team,coverage:'FINAL_GAME_DAY',allAbsencesReviewed:true,coverageRationale:'Synthetic complete final availability review',sourceIds,qbAvailability:{state:'NO_GAME_DAY_LOSS',rationale:'Synthetic full availability',sourceIds},cases});
const fixture={calibration,registry,production:{state:'OPERATIONAL',productionAuthority:true},matchupProduction:{state:'OPERATIONAL_SCOPED',productionAuthority:true},prior:{season:2026,week:1,games:[{gameKey,away:'DAL',home:'NYG',startTimePacific:'2026-09-13T13:00:00-07:00'}]},personnel:{season:2026,week:1,calibrationId:calibration.calibrationId,currentCases:{smith:{caseKey:'smith',gameKey,team:'DAL',player:'Tyler Smith'}}},bundle:{schema:1,season:2026,sourceWeek:1,marketViewed:false,recordedAt:'2026-09-21T04:00:00Z',sources:[{id:'official',kind:'OFFICIAL',url:'https://example.com/synthetic-fixture',finding:'Synthetic game-day report',checkedAt:'2026-09-21T03:00:00Z',gameKeys:[gameKey]}],games:[{gameKey,away:'DAL',home:'NYG',state:'READY',teams:[team('DAL',[c]),team('NYG',[])]}]}};
let count=0;
function check(name,fn){fn();count++;console.log('PASS '+name);}
function blocked(change,pattern){const f=structuredClone(fixture);change(f);const g=evaluateWeeklyEvidence(f).games[0];assert.equal(g.state,'BLOCKED');assert.ok(g.blockers.some(b=>pattern.test(b.code)),JSON.stringify(g.blockers));}
check('locked one-for-one loss is recomputed for paired teams',()=>{const g=evaluateWeeklyEvidence(fixture).games[0];assert.equal(g.state,'READY');assert.equal(g.teams[0].injuryLoss,1.2);assert.equal(g.teams[1].injuryLoss,0);});
check('omitted prior case blocks game',()=>blocked(f=>f.bundle.games[0].teams[0].cases=[],/PRIOR_CASE/));
check('unsupported zero coverage blocks game',()=>blocked(f=>f.bundle.games[0].teams[1].allAbsencesReviewed=false,/COVERAGE/));
check('missing player cannot become zero',()=>blocked(f=>f.bundle.games[0].teams[0].cases[0].replacements=[{player:'Unknown player'}],/LOCKED_PLAYER/));
check('missing locked OVR rejected',()=>blocked(f=>f.registry.players.find(p=>p.player==='Tyler Smith').maddenOvr=null,/LOCKED_PLAYER_VALUE/));
check('unresolved impairment rejected',()=>blocked(f=>f.bundle.games[0].teams[0].cases[0].availabilityStatus='PLAYING_LIMITED',/AVAILABILITY/));
check('unequal committee rejected',()=>blocked(f=>Object.assign(f.bundle.games[0].teams[0].cases[0],{resolution:'VALUE_INVARIANT_COMMITTEE',replacements:[{player:c.replacements[0].player},{player:'Tyler Smith'}],clusterGuardStatus:'PASS',matchupReview:{status:'REVIEWED_ZERO',increment:0}}),/COMMITTEE/));
check('missing baseline review rejected',()=>blocked(f=>f.bundle.games[0].teams[0].cases[0].baselineDoubleCountReviewed=false,/ROLE_REVIEW/));
check('unrelated source cannot prove game',()=>{const f=structuredClone(fixture);f.bundle.sources[0].gameKeys=['other'];assert.equal(evaluateWeeklyEvidence(f).games[0].state,'BLOCKED');});
check('reversed game identity rejected',()=>{const f=structuredClone(fixture);f.bundle.games[0].away='NYG';assert.throws(()=>evaluateWeeklyEvidence(f),/GAME_IDENTITY/);});
check('forged governed total without binding rejected',()=>assert.throws(()=>verifyWeeklyGameEvidence(process.cwd(),{season:2026,sourceWeek:1,effectiveAt:'2026-09-21T04:00:00Z'},{gameKey,teams:[],gameDayEvidence:{teams:[{team:'DAL',state:'GOVERNED',injuryLoss:0}]}}),/EVIDENCE_PATH/));
check('exact archived audit replays and keeps ten explicit blockers',()=>{
 const path='data/walters/nfl/2026/week-01-weekly-evidence/2026-09-21-recovery-audit.json';const bytes=fs.readFileSync(path);const b=JSON.parse(bytes);
 const out=loadWeeklyEvidence(process.cwd(),{path,blobSha:gitBlob(bytes)},{season:2026,sourceWeek:1,effectiveAt:b.recordedAt});assert.equal(out.readyGames,0);assert.equal(out.blockedGames,10);
 assert.ok(out.games.every(g=>g.teams.length===0&&g.blockers.every(b=>b.nextAction)));
 assert.throws(()=>boundJson(process.cwd(),path,'0'.repeat(40)),/BLOB_MISMATCH/);
});
check('approved primary model passes the full paired evidence evaluator',()=>{
 const f=structuredClone(fixture),c=f.bundle.games[0].teams[0].cases[0];
 Object.assign(c,{resolution:'PRIMARY_REPLACEMENT',modelId:'graham-replacement-role-estimate-v1',estimateAcknowledged:true,assumptionRationale:'Synthetic documented primary assumption',primaryEvidence:'NAMED_STARTER',baselineTreatment:'ADDITIONAL_DUTIES_ONLY',baselineDutiesDisplaced:false,baselineRationale:'Synthetic retained baseline duties',baselineSourceIds:sourceIds});
 const g=evaluateWeeklyEvidence(f).games[0];assert.equal(g.state,'READY');assert.equal(g.teams[0].injuryLoss,1.2);assert.equal(g.teams[0].valueBasis,'INCLUDES_GRAHAM_MODEL_ESTIMATE');assert.equal(g.teams[0].cases[0].modelEstimate.method,'PRIMARY_REPLACEMENT');
});
check('unequal committee estimate can reach a fully covered paired game',()=>{
 const f=structuredClone(fixture),c=f.bundle.games[0].teams[0].cases[0];
 Object.assign(c,{resolution:'EQUAL_SHARE_COMMITTEE',modelId:'graham-replacement-role-estimate-v1',estimateAcknowledged:true,assumptionRationale:'Synthetic equal incremental role allocation',baselineTreatment:'ADDITIONAL_DUTIES_ONLY',baselineDutiesDisplaced:false,baselineRationale:'Synthetic baseline retained',baselineSourceIds:sourceIds,replacements:[{player:c.replacements[0].player},{player:'Brandon Coleman'}]});
 const g=evaluateWeeklyEvidence(f).games[0];assert.equal(g.state,'READY');assert.equal(g.teams[0].cases[0].modelEstimate.method,'EQUAL_SHARE_COMMITTEE');assert.equal(g.teams[0].cases[0].modelEstimate.weights.length,2);
});
check('new real case reviews are retained without releasing blocked pairs',()=>{
 const path='data/walters/nfl/2026/week-01-weekly-evidence/2026-09-21-replacement-model-review.json',bytes=fs.readFileSync(path),b=JSON.parse(bytes);
 const out=loadWeeklyEvidence(process.cwd(),{path,blobSha:gitBlob(bytes)},{season:2026,sourceWeek:1,effectiveAt:b.recordedAt});
 assert.equal(out.readyGames,0);assert.equal(out.blockedGames,10);
 const cases=out.games.flatMap(g=>g.caseReviews||[]);assert.equal(cases.length,2);assert.ok(cases.every(c=>c.state==='CASE_ESTIMATE_ONLY'));
 assert.equal(cases.find(c=>c.team==='GB').estimate.injuryLoss,1.567);assert.equal(cases.find(c=>c.team==='DEN').estimate.injuryLoss,0.7);
 assert.ok(out.games.every(g=>g.teams.length===0));
});
function estimatedZeroFixture(position='WR'){
 const f=structuredClone(fixture);f.bundle.estimationPolicy='graham-historical-value-estimates-v1';
 f.bundle.valueEstimates=[{player:'Synthetic Missing',identity:'estimate:test',position,method:'POSITION_GROUP_MEDIAN',estimateAcknowledged:true,rationale:'Synthetic missing value',gameKeys:[gameKey],sourceIds,roleSourceIds:sourceIds,officialAndIndependentSearchCompleted:true,searchFinding:'Synthetic exhausted search'}];
 f.personnel.currentCases={};f.bundle.games[0].teams[0].cases=[{caseKey:'missing',player:'Synthetic Missing',eaPlayerId:'estimate:test',newlyIdentified:true,resolution:'ZERO_IMPUTED_BASELINE_ESTIMATE',availabilityStatus:'IR',rationale:'Synthetic reserve absence',sourceIds,estimateAcknowledged:true,assumptionRationale:'Explicit estimated zero; retain sensitivity.'}];return f;
}
check('imputed zero retains cohort sensitivity and is never calibrated proof',()=>{
 const g=evaluateWeeklyEvidence(estimatedZeroFixture()).games[0];assert.equal(g.state,'READY');
 const c=g.teams[0].cases[0];assert.equal(c.modelEstimate.classification,'GRAHAM_MODEL_ESTIMATE');assert.deepEqual(c.valueProvenance.valueRange,[0,.9]);assert.equal(c.rawTeamContributionDelta,0);
});
check('imputed zero rejects positive baseline and missing acknowledgment',()=>{
 const positive=evaluateWeeklyEvidence(estimatedZeroFixture('RB')).games[0];assert.ok(positive.blockers.some(b=>b.code==='ZERO_IMPUTED_BASELINE_REQUIRED'));
 const f=estimatedZeroFixture();delete f.bundle.games[0].teams[0].cases[0].estimateAcknowledged;assert.equal(evaluateWeeklyEvidence(f).games[0].state,'BLOCKED');
});
function receiverFixture(){
 const f=structuredClone(fixture);f.personnel.currentCases={};f.bundle.estimationPolicy='graham-historical-value-estimates-v1';const t=f.bundle.games[0].teams[0];
 t.cases=[['CeeDee Lamb','Jalen Tolbert'],['George Pickens','Jonathan Mingo']].map(([player,replacement],i)=>({...structuredClone(c),caseKey:'receiver'+i,newlyIdentified:true,player,replacements:[{player:replacement}]}));t.topReceiverClusterReviewed=true;
 t.receiverClusterReview={eligible:false,estimateAcknowledged:true,rationale:'Synthetic higher-value healthy receiving options remain available',sourceIds};return f;
}
check('receiver multiplier requires actual top-two eligibility',()=>{
 const f=receiverFixture(),g=evaluateWeeklyEvidence(f).games[0];assert.equal(g.state,'READY');assert.equal(g.teams[0].groups[0].multiplier,1);
 delete f.bundle.games[0].teams[0].receiverClusterReview;assert.ok(evaluateWeeklyEvidence(f).games[0].blockers.some(b=>b.code==='RECEIVER_CLUSTER_ELIGIBILITY_REQUIRED'));
});
check('eligible top-two receiver review preserves governed multiplier',()=>{
 const f=receiverFixture();Object.assign(f.bundle.games[0].teams[0].receiverClusterReview,{eligible:true,topExpectedReceivers:['CeeDee Lamb','George Pickens'],simultaneousAbsence:true});
 const g=evaluateWeeklyEvidence(f).games[0];assert.equal(g.state,'READY');assert.equal(g.teams[0].groups[0].multiplier,1.5);
 f.bundle.games[0].teams[0].receiverClusterReview.topExpectedReceivers=['CeeDee Lamb','CeeDee Lamb'];assert.equal(evaluateWeeklyEvidence(f).games[0].state,'BLOCKED');
});
check('new policy cannot assign an unavailable player as a replacement',()=>{
 const f=structuredClone(fixture);f.bundle.estimationPolicy='graham-historical-value-estimates-v1';f.bundle.games[0].teams[0].cases.push({caseKey:'bass',player:c.replacements[0].player,newlyIdentified:true,resolution:'ZERO_CALIBRATED_LOSS',availabilityStatus:'IR',rationale:'Synthetic unavailable relief',sourceIds,estimateAcknowledged:true,assumptionRationale:'Frozen zero'});
 assert.ok(evaluateWeeklyEvidence(f).games[0].blockers.some(b=>b.code==='CHAIN_OCCUPANT_UNAVAILABLE_IN_OTHER_CASE'));
});
check('specialist estimate must disclose replacement and uncertainty',()=>{
 const f=structuredClone(fixture),t=f.bundle.games[0].teams[0];t.specialistCases=[{player:'Synthetic specialist',position:'P',replacementPlayer:'Synthetic relief',method:'NEUTRAL_SPECIALIST_REPLACEMENT_ESTIMATE',estimateAcknowledged:true,availableProfessionalReplacement:true,materialRoleDisruption:false,rationale:'Synthetic professional relief',sourceIds,replacementSourceIds:sourceIds}];
 const g=evaluateWeeklyEvidence(f).games[0];assert.equal(g.state,'READY');assert.equal(g.teams[0].specialistEstimates[0].uncertainty,'UNQUANTIFIED');
 t.specialistCases[0].materialRoleDisruption=true;assert.equal(evaluateWeeklyEvidence(f).games[0].state,'BLOCKED');
});
check('historical quarterback difference is weighted and explicitly limited',()=>{
 const f=structuredClone(fixture),q={state:'HISTORICAL_REPLACEMENT_ESTIMATE',estimateAcknowledged:true,lossCause:'INJURY_UNAVAILABILITY',rationale:'Synthetic injury',sourceIds,healthyCandidates:[{player:'Dak Prescott'}],replacement:{player:'Jameis Winston'},baselineRationale:'One QB duty',baselineSourceIds:sourceIds,replacementRationale:'Synthetic documented relief',replacementSourceIds:sourceIds,exposure:{modelId:'graham-historical-time-exposure-v1',estimateAcknowledged:true,assumptionRationale:'Synthetic half game',activeEffectivenessConvention:'NORMAL_WHILE_ACTIVE_ESTIMATE',gameDurationSeconds:3600,durationSourceIds:sourceIds,unavailableIntervals:[{startEarliest:1800,startLatest:1800,endEarliest:3600,endLatest:3600,rationale:'Second half',sourceIds}]}};
 f.bundle.games[0].teams[0].qbAvailability=q;const g=evaluateWeeklyEvidence(f).games[0];assert.equal(g.state,'READY');assert.equal(g.teams[0].qbEstimate.injuryLoss,.875);assert.ok(g.teams[0].qbEstimate.scaleLimitation.includes('not a performance-validated'));
 q.lossCause='PERFORMANCE_BENCHING';assert.equal(evaluateWeeklyEvidence(f).games[0].state,'BLOCKED');
});
check('full recovery binds fifteen distinct game pairs and all thirty remaining teams',()=>{
 const path='data/walters/nfl/2026/week-02-weekly-evidence/2026-09-22-full-slate-approved-estimates.json',bytes=fs.readFileSync(path),bundle=JSON.parse(bytes);
 const r=loadWeeklyEvidence(process.cwd(),{path,blobSha:gitBlob(bytes)},{season:2026,sourceWeek:2,effectiveAt:bundle.recordedAt});
 assert.equal(r.readyGames,15);assert.equal(r.blockedGames,0);assert.equal(new Set(r.games.flatMap(g=>g.teams.map(t=>t.team))).size,30);assert.ok(r.games.every(g=>g.gameKey!=='2026-W02-CLE-TB'));
});
console.log(`WEEKLY HISTORICAL EVIDENCE: ${count} PASS`);

// Current-week routing and additive Week 2 evidence share this existing CI entrypoint.
await import('./test-graham-weekly-recovery-context.mjs');
await import('./test-graham-role-chain.mjs');

await import("./test-graham-historical-completion.mjs");

await import("./test-graham-rating-base-refresh.mjs");

await import('./test-graham-historical-exposure.mjs');

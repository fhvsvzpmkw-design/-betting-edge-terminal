import test from 'node:test';
import assert from 'node:assert/strict';
import {currentPersonnelEstimate,assertDistinctPersonnelReplacements,synchronizePersonnelInputStatus} from '../tools/graham-current-personnel-estimates.mjs';

const policy={currentWeekReplacementEstimates:{state:'OPERATIONAL',modelId:'graham-replacement-role-estimate-v1',allowedMethods:['PRIMARY_REPLACEMENT','WEIGHTED_COMMITTEE','EQUAL_SHARE_COMMITTEE']},productionRules:{resolvedStatuses:['OUT','IR']}};
const player=(id,value,position='WR')=>({eaPlayerId:id,player:id,waltersPoints:value,position,valueStatus:'CALIBRATED'});
function setup(){
  const values={a:player('a',0),b:player('b',0.5)};
  return {c:{availabilityStatus:'OUT',sourceRefs:['official'],availabilitySourceRefs:['official'],roleSourceRefs:['official'],reopenOn:'New role or availability evidence',replacementModel:{modelId:'graham-replacement-role-estimate-v1',resolution:'EQUAL_SHARE_COMMITTEE',estimateAcknowledged:true,assumptionRationale:'Assume equal extra duty',baselineTreatment:'ADDITIONAL_DUTIES_ONLY',baselineDutiesDisplaced:false,baselineRationale:'Retain independent duties',baselineSourceIds:['official'],replacements:['a','b'].map(id=>({player:id,eaPlayerId:id,availabilityStatus:'ACTIVE',roleRationale:'Available role reserve',sourceRefs:['official']}))}},p:player('absent',0.9),options:{production:structuredClone(policy),lookup:(_,id)=>values[id]},values};
}
test('unequal committee preserves assumption, sensitivity and nonnegative loss',()=>{
 const {c,p,options}=setup();const r=currentPersonnelEstimate(c,p,options);
 assert.equal(r.injuryLoss,0.65);assert.equal(r.replacementValue,0.25);
 assert.deepEqual(r.injuryLossRange,{min:0.4,max:0.9});assert.equal(r.classification,'GRAHAM_MODEL_ESTIMATE');
 p.waltersPoints=0;const zero=currentPersonnelEstimate(c,p,options);assert.equal(zero.injuryLoss,0);assert.equal(zero.upgradeExcluded,true);
});
test('current adapter rejects unavailable/unsupported/unguarded inputs',()=>{
 const mutations=[
  x=>x.options.production.currentWeekReplacementEstimates.state='SHADOW',
  x=>x.c.availabilityStatus='QUESTIONABLE',x=>x.p.position='QB',
  x=>x.c.replacementModel.baselineDutiesDisplaced=true,
  x=>x.c.replacementModel.replacements[0].availabilityStatus='QUESTIONABLE',
  x=>x.c.replacementModel.replacements[0].sourceRefs=['unbound'],
  x=>x.c.availabilitySourceRefs=[],x=>x.c.reopenOn='',
  x=>x.values.a.waltersPoints=null,x=>x.values.a.position='RT',
  x=>x.c.replacementModel.replacements[1].eaPlayerId='a',
 ];
 for(const mutate of mutations){const x=setup();mutate(x);assert.throws(()=>currentPersonnelEstimate(x.c,x.p,x.options));}
});
test('confirmed primary and weighted added duties use existing model math',()=>{
 const {c,p,options}=setup();c.replacementModel.resolution='PRIMARY_REPLACEMENT';c.replacementModel.primaryEvidence='REPORTED_PRIMARY';c.replacementModel.replacements.splice(1);
 assert.equal(currentPersonnelEstimate(c,p,options).injuryLoss,0.9);
 const x=setup();x.c.replacementModel.resolution='WEIGHTED_COMMITTEE';x.c.replacementModel.roleUnitType='DOCUMENTED_ROLE_SHARES';
 x.c.replacementModel.replacements.forEach((r,i)=>Object.assign(r,{observedRoleUnits:i?4:2,baselineRoleUnits:1,unitsSourceIds:['official']}));
 assert.equal(currentPersonnelEstimate(x.c,x.p,x.options).injuryLoss,0.525);
});
test('simultaneous cases cannot reuse an absent player or double count a replacement',()=>{
 const c={gameKey:'g',team:'t',caseKey:'c',playerEaId:'absent',availabilityStatus:'OUT',valueStatus:'NUMERIC_ELIGIBLE',replacementEstimate:{weights:[{eaPlayerId:'a'}]}};
 assertDistinctPersonnelReplacements([c]);
 assert.throws(()=>assertDistinctPersonnelReplacements([c,{...c,caseKey:'other'}]),/DOUBLE_COUNT/);
 assert.throws(()=>assertDistinctPersonnelReplacements([c,{...c,caseKey:'other',playerEaId:'a',valueStatus:'FAIL_CLOSED_NO_NUMERIC_MOVE'}]),/UNAVAILABLE/);
});
test('readiness retains unresolved and unrelated gates and exposes estimates',()=>{
 const game={numberStatus:'READY_WITH_UNRESOLVED_PERSONNEL_OR_QB_INPUTS',personnelEstimateCases:[{}],personnelUnresolvedCases:[],qbPerformanceFailClosedTeams:[]};
 synchronizePersonnelInputStatus(game);assert.equal(game.numberStatus,'READY_WITH_PERSONNEL_MODEL_ESTIMATES');
 game.qbPerformanceFailClosedTeams=['SEA'];synchronizePersonnelInputStatus(game);assert.equal(game.numberStatus,'READY_WITH_UNRESOLVED_PERSONNEL_OR_QB_INPUTS');
 game.numberStatus='READY_PARTIAL_BLOCKED_WEEKLY_RATING_INPUT';synchronizePersonnelInputStatus(game);assert.equal(game.numberStatus,'READY_PARTIAL_BLOCKED_WEEKLY_RATING_INPUT');
});

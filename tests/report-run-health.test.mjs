import assert from 'node:assert/strict';
import {reportRunHealth,reportEventFeedback} from '../tools/report-run-health.mjs';
const receipt=(sport,state)=>({selectionId:`${sport}|test|full_game_moneyline|home`,state,
  ...(state==='BLOCKED'?{blocker:{reason:'RESEARCH_INCOMPLETE',missing:'QB_CURRENT_TARGETED_RESEARCH_REQUIRED'}}:{})});
const state={phase:'DRAFT',sidecar:{primaryAnalysis:{receipts:[receipt('NCAAF','BLOCKED'),receipt('NHL','EVALUATED')]}}};
const before=JSON.stringify(state),health=reportRunHealth(state);
assert.equal(health.analysisState,'PARTIAL_ANALYSIS');
assert.equal(health.validationState,'NOT_VALIDATED');
assert.equal(health.publicationState,'NOT_ISSUED');
assert.deepEqual(health.sports.NCAAF,{available:1,evaluated:0,blocked:1});
assert.equal(health.gaps[0].missing,'QB_CURRENT_TARGETED_RESEARCH_REQUIRED');
assert.equal(reportRunHealth({...state,validation:{state:'PASS'}}).validationState,'NOT_VALIDATED','a changed unfrozen draft cannot advertise final validation');
assert.equal(reportRunHealth({...state,phase:'STAGED',validation:{state:'PASS'}}).publicationState,'PUBLICATION_PENDING');
assert.equal(reportRunHealth({...state,phase:'PUBLISHED',validation:{state:'PASS'},publication:{verified:true}}).analysisState,'PARTIAL_ANALYSIS','publication never completes blockers');
assert.equal(reportRunHealth({...state,phase:'PUBLISHED'}).publicationState,'NOT_ISSUED','phase alone is not durable readback');
assert.equal(reportRunHealth({sidecar:{primaryAnalysis:{receipts:[]}}}).analysisState,'EMPTY_SLATE');
assert.equal(reportRunHealth({}).analysisState,'NOT_ESTABLISHED');
assert.equal(reportRunHealth({sidecar:{primaryAnalysis:{receipts:[receipt('NCAAF','BLOCKED')]}}}).analysisState,'ANALYSIS_INCOMPLETE');
assert.equal(JSON.stringify(state),before);
const draft={report:{ts:'2026-10-24T09:30:00-07:00',feedGeneratedAt:'2026-10-24T16:00:00Z'},sidecar:{primaryAnalysis:{receipts:[{
  selectionId:'NCAAF|A|full_game_moneyline|home',state:'EVALUATED',quote:{eventId:'A'},decision:{feed:{selectionKey:'A|ml|home||'},personnelEvidence:{personnelState:'PARTIAL',dependencyTarget:'Quarterback',unresolved:['Starting quarterback unresolved']}}
}]}}};
const feedback=reportEventFeedback(draft,'A');
assert.equal(feedback.state,'FOLLOW_UP_REQUIRED');
assert.ok(feedback.selections[0].missingResearch.includes('CARD_EVIDENCE_MISSING'));
assert.ok(feedback.selections[0].missingResearch.includes('QB_CURRENT_TARGETED_RESEARCH_REQUIRED'));
assert.equal(draft.sidecar.primaryAnalysis.receipts[0].state,'EVALUATED','feedback never changes status or receipt state');
assert.deepEqual(reportEventFeedback(draft,'another-event').selections,[]);
console.log('Run health: draft counts, final validation, durable publication and incomplete research stay distinct.');

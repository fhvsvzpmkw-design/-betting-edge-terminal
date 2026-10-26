import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reportRunHealth,reportEventFeedback} from '../tools/report-run-health.mjs';
import {parseReportDocument} from '../tools/report-document-transport.mjs';
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

// October 25 failure shape: only SF-Atlanta received decisions, while every
// other event retained generic current-review placeholders despite saved leads.
const sundayReceipts=[];
for(const [sport,eventCount] of [['NFL',11],['NHL',5],['NBA_WNBA',7]])for(let event=0;event<eventCount;event++)for(let side=0;side<6;side++){
  const completed=sport==='NFL'&&event===0&&side<4;
  sundayReceipts.push({selectionId:`${sport}|${event}|market${side}|home`,quote:{eventId:String(event)},state:completed?'EVALUATED':'BLOCKED',
    ...(completed?{}:{blocker:{reason:'RESEARCH_INCOMPLETE',missing:sport==='NFL'&&event===0?'GRAHAM_FAIR_DISPOSITION_REQUIRED':'CURRENT_CANDIDATE_REVIEW_REQUIRED',
      impact:'The current selection review is unfinished.',attempts:[{eventId:String(event),checkedAt:'2026-10-25T15:02:44Z',url:'https://www.espn.com/nfl/game/_/gameId/example',finding:'Venue observed in pinned event dossier.'}]}})});
}
const sunday={phase:'PUBLISHED',validation:{state:'PASS'},publication:{verified:true},sidecar:{primaryAnalysis:{receipts:sundayReceipts}}};
const sundayBefore=JSON.stringify(sunday),sundayHealth=reportRunHealth(sunday);
assert.equal(sundayHealth.publicationState,'DURABLY_VERIFIED');
assert.equal(sundayHealth.continuationRequired,true,'publication must not end unfinished producer work');
assert.deepEqual(sundayHealth.remainingWork,{selections:134,events:23,producerUnfinished:134,documentedShortfalls:0,blockerReviewRequired:0,sports:{
  NFL:{selections:62,producerUnfinished:62,documentedShortfalls:0,blockerReviewRequired:0},
  NHL:{selections:30,producerUnfinished:30,documentedShortfalls:0,blockerReviewRequired:0},
  NBA_WNBA:{selections:42,producerUnfinished:42,documentedShortfalls:0,blockerReviewRequired:0}
}});
assert.match(sundayHealth.nextAction,/Start a current-time continuation without editing issued History/);
assert.match(sundayHealth.nextAction,/Do not relabel unfinished work as a source shortfall/);
assert.equal(JSON.stringify(sunday),sundayBefore,'diagnostics preserve every issued byte and decision');

const sourceGap={selectionId:'NFL|A|full_game_primary_spread|home',quote:{eventId:'A'},state:'BLOCKED',blocker:{reason:'SOURCE_UNAVAILABLE',
  missing:'NO_EXACT_REFERENCE_OR_SUPPORTED_FAIR',impact:'The exact spread reference was not returned after the recorded lookup.',
  attempts:[{eventId:'A',checkedAt:'2026-10-25T15:20:00Z',url:'https://example.com/reference',finding:'Exact event matched; the selected spread line was absent.'}]}};
const sourceHealth=reportRunHealth({phase:'PUBLISHED',publication:{verified:true},sidecar:{primaryAnalysis:{receipts:[sourceGap]}}});
assert.equal(sourceHealth.remainingWork.documentedShortfalls,1,'an actually recorded source shortfall stays separate');
assert.equal(sourceHealth.remainingWork.producerUnfinished,0);
assert.equal(sourceHealth.continuationRequired,false,'a documented terminal gap does not demand an unchanged research loop');
const unrecorded=structuredClone(sourceGap);unrecorded.blocker.attempts=[];
const unrecordedHealth=reportRunHealth({sidecar:{primaryAnalysis:{receipts:[unrecorded]}}});
assert.equal(unrecordedHealth.remainingWork.blockerReviewRequired,1,'a reason label without a source check is not a documented shortfall');
assert.equal(unrecordedHealth.continuationRequired,true);
const wrongEvent=structuredClone(sourceGap);wrongEvent.blocker.attempts[0].eventId='B';
assert.equal(reportRunHealth({sidecar:{primaryAnalysis:{receipts:[wrongEvent]}}}).remainingWork.blockerReviewRequired,1,'another event source cannot document this gap');
const generic=structuredClone(sourceGap);generic.blocker.missing='CURRENT_CANDIDATE_REVIEW_REQUIRED';
assert.equal(reportRunHealth({sidecar:{primaryAnalysis:{receipts:[generic]}}}).remainingWork.producerUnfinished,1,'generic current-review work cannot be relabeled SOURCE_UNAVAILABLE');
assert.equal(reportRunHealth({}).continuationRequired,false);
assert.equal(reportRunHealth({sidecar:{primaryAnalysis:{receipts:[]}}}).remainingWork.selections,0);

// A real source shortfall cannot hide an independently missing final-time
// applicability review. Diagnose it without clearing evidence or forcing a
// repeated collection/continuation against the same unavailable source.
const retimed={phase:'DRAFT',report:{ts:'2026-10-25T18:28:01-07:00'},sidecar:{primaryAnalysis:{receipts:[sourceGap]},
  forecastEvidence:{records:[{recordId:'point',eventId:'A',sourceId:'moneypuck',observedAt:'2026-10-25T22:25:11Z'}],
    revalidations:[{recordId:'point',forReportAt:'2026-10-25T18:26:03-07:00',checkedAt:'2026-10-25T18:26:03-07:00'}]}}};
const retimedBefore=JSON.stringify(retimed),retimedHealth=reportRunHealth(retimed);
assert.equal(retimedHealth.forecastReviewHandoff.pending,1);
assert.equal(retimedHealth.forecastReviewHandoff.state,'CURRENT_REPORT_REVIEW_REQUIRED');
assert.equal(retimedHealth.remainingWork.documentedShortfalls,1);
assert.equal(retimedHealth.continuationRequired,false,'binding diagnostics cannot force an unchanged-source retry');
assert.match(retimedHealth.forecastReviewNotice,/perform the current applicability checks/);
assert.match(retimedHealth.forecastReviewNotice,/do not merely restamp forReportAt/);
assert.equal(JSON.stringify(retimed),retimedBefore,'diagnostics never reapprove or retime source evidence');
const bound=structuredClone(retimed);
bound.sidecar.forecastEvidence.revalidations.push({recordId:'point',forReportAt:'2026-10-26T01:28:01Z'});
assert.equal(reportRunHealth(bound).forecastReviewHandoff.pending,0,'equivalent ISO instants bind; this does not certify review contents');
const inline=structuredClone(retimed);inline.sidecar.forecastEvidence.records[0].applicability={forReportAt:inline.report.ts};
assert.equal(reportRunHealth(inline).forecastReviewHandoff.pending,0,'legacy inline applicability keeps its existing binding semantics');
bound.sidecar.forecastEvidence.records.push({recordId:'unretained',eventId:'B'});
assert.equal(reportRunHealth(bound).forecastReviewHandoff.records,1,'removed events must not manufacture current review work');
assert.match(reportRunHealth({...retimed,phase:'FROZEN'}).forecastReviewNotice,/preserve sealed\/issued bytes/);

// Replay the issued October 25 failure shapes without changing either saved
// checkpoint, model observations, receipts, status or validation semantics.
for(const [file,expected]of [
  ['data/report-production/checkpoints/2026-10-25-evening-152421.json',23],
  ['data/report-production/checkpoints/20261025-late-1815-182446.json',2]
]){
  const bytes=fs.readFileSync(file),saved=parseReportDocument(bytes,'REPORT_CHECKPOINT');
  const bundle=parseReportDocument(saved.frozen.serializedBundle,'STAGED_REPORT');
  const current=reportRunHealth({...saved,report:bundle.report,sidecar:bundle.sidecar});
  assert.equal(current.forecastReviewHandoff.pending,expected);
  assert.equal(current.validationState,'PASS','diagnostics add no gate or retroactive validation failure');
  assert.match(current.forecastReviewNotice,/Disclose that unfinished review/);
  assert.deepEqual(fs.readFileSync(file),bytes);
}
console.log('Run health: final validation, publication, unfinished producer work and documented source shortfalls stay distinct.');

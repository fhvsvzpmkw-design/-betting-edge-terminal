import assert from 'node:assert/strict';
import {buildEventResearchPlan} from '../tools/event-research-plan.mjs';
const report = {ts:'2026-09-20T18:25:00-07:00'};
const source = {id:'official-A', eventId:'A', sport:'MLB', kind:'OFFICIAL',
  url:'https://example.org/event/A', finding:'Synthetic pitcher and lineup check.', checkedAt:'2026-09-20T18:20:00-07:00'};
const make = (side='home', detail='full_game_moneyline', eventId='A') => ({
  selectionId:`MLB|${eventId}|${detail}|${side}`, sport:'MLB', eventId, eventDate:'2026-09-21T02:00:00Z',
  marketDetail:detail, side, state:'BLOCKED', status:null, promising:false, reviewState:'NOT_REQUIRED',
  marketComparison:{edgeProbabilityPoints:-2, direction:'UNFAVORABLE'}, options:[], blocker:{reason:'RESEARCH_INCOMPLETE'}
});
const rows = [make(),make('away'),make('over','full_game_primary_total'),make('under','full_game_primary_total'),make('home','full_game_primary_run_line'),make('away','full_game_primary_run_line')];
const receipts = rows.map(row => ({selectionId:row.selectionId,state:'BLOCKED',blocker:{reason:'RESEARCH_INCOMPLETE',attempts:[source]}}));
const input = {report,sidecar:{primaryAnalysis:{receipts}},candidateAssessment:{selections:rows}};
const before = JSON.stringify(input), plan = buildEventResearchPlan(input);
assert.equal(plan.counts.events,1); assert.equal(plan.counts.pending,6); assert.equal(plan.counts.completed,0);
assert.equal(plan.counts.routes.MARKET_PASS_REVIEW,6); assert.equal(plan.events[0].researchPackage.sources.length,1);
assert.equal(JSON.stringify(input),before,'planner must not change grades, source times or receipts');
assert.equal(plan.events[0].researchPackage.sources[0].requiresCurrentApplicabilityReview,true);
assert.equal(plan.events[0].researchPackage.sources[0].source.checkedAt,source.checkedAt);
assert.equal(plan.events[0].personnelFollowUp.state,'CURRENT_OFFICIAL_CHECK_REQUIRED');
assert.equal(plan.events[0].personnelFollowUp.required,true);
assert.equal(plan.decisionAuthority,false);
const personnelInput=structuredClone(input);
personnelInput.report.feedGeneratedAt='2026-09-20T18:15:00-07:00';
personnelInput.sidecar.primaryAnalysis.receipts[0].decision={personnelEvidence:{officialSources:[{
  url:'https://example.org/official/A',origin:'Official league board',asOf:'2026-09-20T18:21:00-07:00',
  fact:'Current official pitcher and lineup board checked for event A.',finalRecheck:true
}]}};
const personnelPlan=buildEventResearchPlan(personnelInput);
assert.equal(personnelPlan.events[0].personnelFollowUp.state,'CURRENT_OFFICIAL_CHECK_RECORDED');
assert.equal(personnelPlan.events[0].personnelFollowUp.required,false);
assert.equal(personnelPlan.events[0].personnelFollowUp.sources.length,1);
const stalePersonnelInput=structuredClone(personnelInput);
stalePersonnelInput.sidecar.primaryAnalysis.receipts[0].decision.personnelEvidence.officialSources[0].asOf='2026-09-20T18:10:00-07:00';
assert.equal(buildEventResearchPlan(stalePersonnelInput).events[0].personnelFollowUp.state,'CURRENT_OFFICIAL_CHECK_RECORDED','a recent event check survives a later odds snapshot');
stalePersonnelInput.sidecar.primaryAnalysis.receipts[0].decision.personnelEvidence.officialSources[0].asOf='2026-09-20T15:00:00-07:00';
assert.equal(buildEventResearchPlan(stalePersonnelInput).events[0].personnelFollowUp.state,'CURRENT_OFFICIAL_CHECK_REQUIRED','stale event facts still require a new check');
const priorPersonnel=new Map([[rows[0].selectionId,{reportPath:'earlier-lane.json',row:{decision:{feed:{eventDate:rows[0].eventDate},personnelEvidence:personnelInput.sidecar.primaryAnalysis.receipts[0].decision.personnelEvidence}}}]]);
const reusedPersonnel=buildEventResearchPlan({report:personnelInput.report,candidateAssessment:{selections:[rows[0]]},priorReceipts:priorPersonnel});
assert.equal(reusedPersonnel.events[0].personnelFollowUp.state,'CURRENT_OFFICIAL_CHECK_RECORDED');
assert.equal(reusedPersonnel.events[0].personnelFollowUp.sources[0].priorReportPath,'earlier-lane.json');
assert.equal(reusedPersonnel.events[0].personnelFollowUp.sources[0].requiresCurrentApplicabilityReview,true);
assert.equal(reusedPersonnel.counts.completed,0);
priorPersonnel.get(rows[0].selectionId).row.decision.feed.eventDate='2026-09-22T02:00:00Z';
assert.equal(buildEventResearchPlan({report:personnelInput.report,candidateAssessment:{selections:[rows[0]]},priorReceipts:priorPersonnel}).events[0].personnelFollowUp.state,'CURRENT_OFFICIAL_CHECK_REQUIRED');
const dossier={...input,sidecar:{gameIntelligenceInputs:{facts:[{kind:'OFFICIAL_PERSONNEL',sourceKind:'OFFICIAL',sport:'MLB',eventId:'A',startTime:rows[0].eventDate,url:source.url,observedAt:source.checkedAt,details:{unresolved:['FINAL_LINEUP_NOT_PUBLISHED']}}]}}};
assert.equal(buildEventResearchPlan(dossier).events[0].personnelFollowUp.sources[0].fromPinnedDossier,true);
dossier.sidecar.gameIntelligenceInputs.facts[0].eventId='B';
assert.equal(buildEventResearchPlan(dossier).events[0].personnelFollowUp.state,'CURRENT_OFFICIAL_CHECK_REQUIRED');
const fallbackInput={...input,forecastCoverage:{selections:rows.slice(0,2).map(row=>({
  ...row,startTime:row.eventDate,eligibleExactRecordIds:[],attempts:[{sourceId:'fangraphs',outcome:'INACCESSIBLE'}],
  nextRoutes:[{sourceId:'dratings',role:'EXACT_CANDIDATE',urls:['https://www.dratings.com/predictor/mlb-baseball-predictions/']}]
}))}};
const fallback=buildEventResearchPlan(fallbackInput).events[0].forecastRetrieval;
assert.equal(fallback.state,'RETRIEVAL_QUEUE_NOT_EXECUTED');
assert.equal(fallback.nextSources.length,1,'share retrieval across both sides');
assert.equal(fallback.nextSources[0].selectionIds.length,2);
assert.equal(fallback.attempts.length,2);
const basketball=structuredClone(fallbackInput);
basketball.candidateAssessment.selections=basketball.candidateAssessment.selections.slice(0,2).map(row=>({...row,sport:'NBA_WNBA'}));
basketball.forecastCoverage.selections=basketball.forecastCoverage.selections.map(row=>({...row,sport:'WNBA'}));
assert.equal(buildEventResearchPlan(basketball).events[0].forecastRetrieval.nextSources.length,1,'retain actual feed-resolved WNBA routes under the shared inventory family');
basketball.forecastCoverage.selections=basketball.forecastCoverage.selections.map(row=>({...row,sport:'MLB'}));
assert.equal(buildEventResearchPlan(basketball).events[0].forecastRetrieval.nextSources.length,0,'do not share another sport');
assert.equal(buildEventResearchPlan({...fallbackInput,forecastCoverage:{selections:[]}}).events[0].forecastRetrieval.nextSources.length,0);
const route = (row,receipt={}) => buildEventResearchPlan({report,candidateAssessment:{selections:[row]},sidecar:{primaryAnalysis:{receipts:[{selectionId:row.selectionId,...receipt}]}}}).events[0].selections[0].route;
assert.equal(route({...make(),promising:true}),'DEEP_REVIEW');
assert.equal(route({...make(),marketComparison:null}),'REFERENCE_OR_FORECAST_RESEARCH');
assert.equal(route({...make(),marketComparison:{edgeProbabilityPoints:0,direction:'NEUTRAL'}}),'REFERENCE_OR_FORECAST_RESEARCH');
assert.equal(route(make(),{researchRouting:{requiresDeepReview:true,rationale:'Producer identified a close call.'}}),'DEEP_REVIEW');
assert.equal(route({...make(),options:[{forecastComparisons:[{direction:'SUPPORTS_PRICE'}]}]}),'DEEP_REVIEW');
assert.equal(route({...make(),options:[{marketComparison:{edgeProbabilityPoints:0.1,direction:'FAVORABLE'}}]}),'DEEP_REVIEW');
assert.equal(route({...make(),state:'EVALUATED',status:'LEAN'}),'COMPLETED');
assert.equal(route({...make(),state:'EVALUATED',status:'PASS',promising:true,reviewState:'UNFINISHED'}),'DEEP_REVIEW');
assert.equal(route(make(),{cardEvidenceDetachment:{reason:'WRONG_SELECTION'}}),'REPAIR_EXACT_EVIDENCE');
assert.equal(route({...make(),eventDate:null}),'IDENTITY_REVIEW');
const mutated = structuredClone(input);
mutated.sidecar.primaryAnalysis.receipts[0].blocker.attempts.push({...source,id:'foreign',eventId:'B'},
  {...source,id:'future',checkedAt:'2030-01-01T00:00:00Z'}, {...source,id:'wrong-sport',sport:'NHL'},
  {...source,id:'wrong-date',eventDate:'2026-09-22T02:00:00Z'}, {...source,id:'bad-url',url:'file:///tmp/source'},
  {...source,id:'market-only',kind:'MARKET'}, {...source,id:'model-probability',kind:'MODEL'});
assert.equal(buildEventResearchPlan(mutated).events[0].researchPackage.sources.length,1,'no cross-event, future, model or market copying');
mutated.sidecar.primaryAnalysis.receipts[1].blocker.attempts.push({...source,finding:'Conflicting synthetic fact.'});
const conflict = buildEventResearchPlan(mutated);
assert.equal(conflict.events[0].researchPackage.sources.length,0); assert.ok(conflict.warnings.length);
const priorSource = {...source,checkedAt:'2026-09-20T08:10:00-07:00'};
const priorReceipts = new Map([[rows[0].selectionId,{reportPath:'earlier.json',row:{decision:{feed:{eventDate:rows[0].eventDate},sourceEvidence:[priorSource]}}}]]);
const reused = buildEventResearchPlan({report,candidateAssessment:{selections:[rows[0]]},priorReceipts});
assert.equal(reused.events[0].researchPackage.sources[0].source.checkedAt,priorSource.checkedAt);
assert.equal(reused.events[0].researchPackage.sources[0].requiresCurrentApplicabilityReview,true);
assert.equal(reused.counts.completed,0,'earlier research never proves current completion');
const isolated = buildEventResearchPlan({report,candidateAssessment:{selections:[make(),make('home','full_game_moneyline','B')]}});
assert.equal(isolated.counts.events,2);
const duplicates = buildEventResearchPlan({...input,sidecar:{primaryAnalysis:{receipts:[receipts[0],receipts[0]]}}});
assert.equal(duplicates.events[0].selections[0].route,'IDENTITY_REVIEW');
console.log('Event-first planner: unit checks passed; all unfinished sides retained, sources grouped without transferring decisions, exact-identity and timestamp boundaries preserved.');

// Integration and immutable replay run in the repository, not the standalone unit sandbox.
if (process.argv.includes('--integration')) {
  const fs = await import('node:fs');
  const {buildEvidenceAudit} = await import('../tools/report-evidence-repair.mjs');
  const reportPath = 'data/history/runs/2026-09-20/evening-151713.json';
  const sidecarPath = 'data/history/research-fit/2026-09-20/evening-151713.json';
  const rawReport = fs.readFileSync(reportPath,'utf8'), rawSidecar = fs.readFileSync(sidecarPath,'utf8');
  const r = JSON.parse(rawReport), s = JSON.parse(rawSidecar), snapshot = JSON.stringify({r,s});
  const audit = buildEvidenceAudit({root:process.cwd(),report:r,sidecar:s});
  assert.equal(audit.eventResearchPlan.counts.available,42);
  assert.equal(audit.eventResearchPlan.counts.events,7);
  assert.equal(audit.eventResearchPlan.counts.completed,4);
  assert.equal(audit.eventResearchPlan.counts.pending,38);
  assert.equal(JSON.stringify({r,s}),snapshot);
  assert.equal(fs.readFileSync(reportPath,'utf8'),rawReport);
  assert.equal(fs.readFileSync(sidecarPath,'utf8'),rawSidecar);
  console.log('September 20 15:15 development replay (not a new report):',JSON.stringify(audit.eventResearchPlan.counts));
}

// An empty later receipt must not erase a useful earlier source package.
const history = new Map([[rows[0].selectionId, {reportPath:'later-empty.json',row:{state:'BLOCKED'},
  researchHistory:[{reportPath:'earlier.json',row:{decision:{feed:{eventDate:rows[0].eventDate},sourceEvidence:[priorSource]}}}]}]]);
const resumed=buildEventResearchPlan({report,candidateAssessment:{selections:[rows[0]]},priorReceipts:history});
assert.equal(resumed.events[0].researchPackage.sources.length,1);
assert.equal(resumed.events[0].researchPackage.sources[0].source.checkedAt,priorSource.checkedAt);
assert.equal(resumed.counts.completed,0);
const {buildResearchWorkPlan}=await import('../tools/event-research-plan.mjs');
const work=buildResearchWorkPlan(resumed,{eventId:'A'});
assert.equal(work.completionState,'NO_COMPLETED_DECISIONS');
assert.equal(work.decisionAuthority,false);
assert.equal(work.events[0].sourceLeads[0].priorReportPath,'earlier.json');
assert.equal(work.events[0].selections[0].route,'MARKET_PASS_REVIEW');
assert.equal(work.events[0].personnelFollowUp.state,'CURRENT_OFFICIAL_CHECK_REQUIRED');
assert.match(work.events[0].nextAction,/authoritative league\/team personnel check/);
assert.equal(buildResearchWorkPlan(resumed).events[0].sourceLeadCount,1);
assert.equal(buildResearchWorkPlan(resumed).events[0].personnelFollowUpState,'CURRENT_OFFICIAL_CHECK_REQUIRED');
assert.equal(buildResearchWorkPlan(resumed).events[0].selections,undefined,'overview must not dump every quote and repeated source question');
assert.throws(()=>buildResearchWorkPlan(resumed,{eventId:'missing'}),/No pending event/);
assert.equal(buildResearchWorkPlan({counts:{available:2,completed:1,pending:1},events:[]}).completionState,'PARTIAL');

// Completed market cards must not remove actual captured points from the
// producer's compact queue. Old captures remain immutable review leads.
const forecast={recordId:'latest-point',sourceId:'espn',modelFamily:'ESPN_MATCHUP_PREDICTOR',kind:'OUTCOME_PROBABILITY',
  url:'https://www.espn.com/mlb/game/_/gameId/synthetic',marketDetail:'full_game_moneyline',period:'FULL_GAME',side:'home',line:null,
  probability:.55,probabilityBasis:'UNCONDITIONAL',observedAt:'2026-09-20T18:20:00-07:00',forecastAt:null,
  reasons:['CURRENT_REVALIDATION_REQUIRED','FORECAST_TIME_UNKNOWN','SETTLEMENT_UNRESOLVED']};
const completedRows=rows.map(row=>({...row,state:'EVALUATED',status:'PASS'}));
const capturedInput={report,candidateAssessment:{selections:completedRows},forecastCoverage:{selections:completedRows.map(row=>({
  ...row,startTime:row.eventDate,eligibleExactRecordIds:[],records:[{...forecast,recordId:'older-point',observedAt:'2026-09-20T17:00:00-07:00'},forecast]
}))}};
const capturedBefore=JSON.stringify(capturedInput),capturedPlan=buildEventResearchPlan(capturedInput);
assert.deepEqual(capturedPlan.forecastReviewCounts,{events:1,records:1});
assert.equal(capturedPlan.counts.pending,0,'forecast review is separate from decision completion');
assert.equal(capturedPlan.events[0].forecastReviews[0].recordId,'latest-point');
assert.deepEqual(capturedPlan.events[0].forecastReviews[0].selectionIds,[rows[0].selectionId]);
assert.equal(buildResearchWorkPlan(capturedPlan).events[0].capturedForecastsAwaitingReview,1);
assert.equal(buildResearchWorkPlan(capturedPlan,{eventId:'A'}).events[0].forecastReviews[0].probability,.55);
assert.equal(buildResearchWorkPlan(capturedPlan).completionState,'COMPLETE','advisory review cannot veto completed cards');
assert.equal(buildResearchWorkPlan(capturedPlan).reviewCompletionState,'CAPTURED_FORECAST_REVIEW_PENDING','completed decisions cannot imply captured forecasts were reviewed');
assert.equal(buildResearchWorkPlan(capturedPlan).capturedForecastReviewsPending,1);
assert.equal(JSON.stringify(capturedInput),capturedBefore);
const reviewed=structuredClone(capturedInput);
reviewed.forecastCoverage.selections.forEach(row=>row.records.forEach(record=>{record.reasons=record.recordId==='latest-point'?['PERSONNEL_APPLICABILITY_UNRESOLVED']:record.reasons;}));
assert.equal(buildEventResearchPlan(reviewed).forecastReviewCounts.records,0,'a current applicability shortfall is not an unperformed review');
assert.equal(buildResearchWorkPlan(buildEventResearchPlan(reviewed)).reviewCompletionState,'COMPLETE');
assert.equal(buildResearchWorkPlan(plan).reviewCompletionState,'DECISIONS_PENDING');
const foreign=structuredClone(capturedInput);
foreign.forecastCoverage.selections.forEach(row=>row.records.forEach(record=>record.reasons.push('EVENT_MISMATCH')));
assert.equal(buildEventResearchPlan(foreign).forecastReviewCounts.records,0);

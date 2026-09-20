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
assert.equal(plan.decisionAuthority,false);
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

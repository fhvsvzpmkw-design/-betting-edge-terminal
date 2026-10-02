import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {FORECAST_ROUTING_FROM,routeForecastCaptures,collectForecastLeads,inspectForecastLeadReview} from '../tools/forecast-lead-routing.mjs';
import {buildForecastCoverage} from '../tools/forecast-evidence.mjs';
import {buildCandidateAssessment,finalizeCandidateAssessmentDraft} from '../tools/candidate-assessment.mjs';
import {derivePrimarySelectionInventory} from '../tools/major-sport-market-coverage-gate.mjs';
import {buildEventResearchPlan,buildResearchWorkPlan} from '../tools/event-research-plan.mjs';
import {prepareEvidenceDraft,captureForecastEvidenceDraft} from '../tools/report-evidence-repair.mjs';
import {runCommand} from '../tools/report-run.mjs';

function fixture() {
  // Synthetic observation and applicability; never a live recommendation.
  const ts='2026-10-01T18:50:00-07:00', observedAt='2026-10-01T18:25:17-07:00', eventDate='2026-10-02T02:00:00Z';
  const quote={book:'Bet365',eventId:'test',marketKey:'ml',side:'away',line:null,selectionKey:'test|ml|away||',priceDecimal:1.47,
    quoteUpdatedAt:observedAt,quoteObservedAt:observedAt};
  const selection={selectionId:'NHL|test|full_game_moneyline|away',sport:'NHL',eventId:'test',eventDate,
    marketClass:'moneyline',marketDetail:'full_game_moneyline',side:'away',quotes:[quote]};
  const source={id:'model',kind:'MODEL',sport:'NHL',eventId:'test',checkedAt:observedAt,
    url:'https://www.dratings.com/predictor/nhl-hockey-predictions/synthetic',title:'Synthetic DRatings fixture',
    finding:'DRatings showed Edmonton 69.4%, Vancouver 30.6%, with projected goals 4.00-2.63. For Edmonton Oilers, that is 1.37 probability points favorable to the executable price, but the model calculation time, goalie incorporation and uncertainty were not disclosed.'};
  const info={id:'info',kind:'OFFICIAL',sport:'NHL',eventId:'test',checkedAt:observedAt,url:'https://example.org/synthetic/lineup',
    finding:'Synthetic source review: the forecast goalie assumption differs from the projected starter.'};
  const rec={title:'Edmonton Oilers',status:'PASS',stake:'$0',book:quote.book,price:'-213',playTo:'NO BET',feed:{...quote,eventDate},
    sourceEvidence:[source,info],fairValueEvidence:null};
  const report={ts,feedGeneratedAt:'2026-10-02T01:09:02.615Z',recs:[rec],counts:{bet:0,lean:0,wait:0,pass:1},risk:0};
  const receipt={selectionId:selection.selectionId,quote,state:'EVALUATED',checkedAt:observedAt,decision:structuredClone(rec),evidence:structuredClone(rec)};
  const sidecar={recommendations:[structuredClone(rec)],primaryAnalysis:{receipts:[receipt]},forecastEvidence:{schema:1,records:[],attempts:[],revalidations:[]}};
  const raw={recordId:'synthetic-dratings-point',sourceId:'dratings',url:source.url,excerpt:source.finding,sport:'NHL',eventId:'test',startTime:eventDate,
    state:'PRE_GAME',kind:'OUTCOME_PROBABILITY',marketDetail:'full_game_moneyline',period:'FULL_GAME',side:'away',line:null,
    probability:.694,probabilityBasis:'UNCONDITIONAL',forecastAt:null,observedAt,timingBasis:'OBSERVED_PREGAME_SNAPSHOT',
    settlement:{includesOvertime:true,pushRule:'NO_PUSH'},limitation:'Synthetic observation; model calculation time and calibrated uncertainty unknown.',
    capture:{observedAt,sourceUrl:source.url,eventLabel:'Edmonton Oilers at Vancouver Canucks',probabilityField:'Away win probability',
      publishedProbability:.694,pageState:'PRE_GAME',evidenceRef:'synthetic-test-only'}};
  const revalidation={recordId:raw.recordId,forReportAt:ts,checkedAt:ts,eventMatch:true,freshnessStatus:'CURRENT',freshnessRationale:'Synthetic same-event pregame capture reviewed.',
    personnelStatus:'SUITABLE_PROJECTION',personnelRationale:'Synthetic projected goalies checked for applicability to an opinion; final starters unresolved.',
    settlementMatch:true,settlementRationale:'Synthetic full-game NHL winner including overtime and shootout, no draw.',
    observedSnapshotReviewed:true,modelTimeLimitation:'Original calculation age unknown; synthetic assumptions explicitly reviewed.'};
  const capture={schema:1,records:[raw],revalidations:[revalidation],attempts:[]};
  return {report,sidecar,selection,receipt,universe:{selections:[selection]},capture};
}
const coverage=f=>buildForecastCoverage({...f});
const review=f=>inspectForecastLeadReview({...f,forecast:coverage(f).selections[0]});

test('a positive prose-only point requires capture and remains a producer research lead',()=>{
  const f=fixture(),before=JSON.stringify(f),r=review(f);
  assert.equal(r.required,true);assert.equal(r.complete,false);assert.equal(r.leads[0].probability,.694);
  assert.equal(r.leads[0].authority,'UNVERIFIED_SOURCE_FIELD_REQUIRES_CAPTURE_REVIEW');
  const a=buildCandidateAssessment({...f,forecastCoverage:coverage(f)});
  assert.equal(a.selections[0].reviewRequired,true);assert.equal(a.selections[0].reviewState,'UNFINISHED');
  const plan=buildEventResearchPlan({...f,candidateAssessment:a,forecastCoverage:coverage(f)});
  assert.equal(plan.events[0].selections[0].route,'FORECAST_CAPTURE_REVIEW');
  const work=buildResearchWorkPlan(plan,{eventId:'test'});
  assert.equal(work.events[0].selections[0].forecastCaptureReviews[0].probability,.694);
  assert.equal(JSON.stringify(f),before);assert.equal(f.sidecar.forecastEvidence.records.length,0);
});
test('real typed capture is routed from MODEL evidence and eligibility uses original observation',()=>{
  const f=fixture();f.receipt.decision.sourceEvidence[0].forecastCapture=f.capture;
  f.receipt.evidence.sourceEvidence[0].forecastCapture=structuredClone(f.capture);
  const before=JSON.stringify(f),result=routeForecastCaptures(f);
  assert.equal(JSON.stringify(f),before);assert.equal(result.imported.length,1);
  assert.equal(result.imported[0].eligibility,'ELIGIBLE_EXACT');
  assert.equal(result.sidecar.forecastEvidence.records[0].forecastAt,null);
  assert.equal(result.sidecar.forecastEvidence.records[0].observedAt,f.capture.records[0].observedAt);
  f.sidecar=result.sidecar;f.receipt=f.sidecar.primaryAnalysis.receipts[0];
  assert.equal(review(f).complete,true);assert.equal(review(f).leads[0].state,'CAPTURED');
  assert.equal(f.report.recs[0].status,'PASS');assert.equal(f.report.risk,0);assert.equal(f.report.recs[0].fairValueEvidence,null);
  f.receipt.candidateAssessment={decision:{status:'PASS',rationale:'Synthetic source review only.'}};
  const a=buildCandidateAssessment({...f,forecastCoverage:coverage(f)});
  assert.equal(a.selections[0].promising,true);
  assert.ok(a.selections[0].missingResearch.includes('FORECAST_SUPPORTED_PASS_REQUIRES_DIRECTIONAL_REVIEW'));
  assert.equal(routeForecastCaptures(f).sidecar.forecastEvidence.records.length,1);
});
test('event-wide and attempt captures share the same immutable import checks',()=>{
  for (const location of ['pending','attempt']) {
    const f=fixture();
    if(location==='pending')f.sidecar.forecastEvidence.pendingCaptures=[f.capture];
    else f.sidecar.forecastEvidence.attempts=[{attemptId:'synthetic',selectionId:f.selection.selectionId,sourceId:'dratings',
      url:f.capture.records[0].url,checkedAt:f.report.ts,outcome:'FOUND',finding:'Synthetic source field captured.',forecastCapture:f.capture}];
    const r=routeForecastCaptures(f);assert.equal(r.imported[0].eligibility,'ELIGIBLE_EXACT');
    assert.equal(r.sidecar.forecastEvidence.pendingCaptures,undefined);
  }
});
test('invalid, conflicting, future or wrong-source captures cannot partially mutate the draft',()=>{
  for(const mutate of [c=>c.records[0].url='https://example.org/wrong',c=>c.records[0].eventId='other',
    c=>c.records[0].observedAt='2026-10-02T03:00:00Z',c=>c.records[0].probability=69.4]) {
    const f=fixture();f.receipt.decision.sourceEvidence[0].forecastCapture=f.capture;mutate(f.capture);
    const before=JSON.stringify(f);assert.throws(()=>routeForecastCaptures(f));assert.equal(JSON.stringify(f),before);
  }
  const f=fixture();f.sidecar.forecastEvidence.pendingCaptures=[f.capture,structuredClone(f.capture)];
  f.sidecar.forecastEvidence.pendingCaptures[1].records[0].excerpt='Conflicting immutable provenance';
  assert.throws(()=>routeForecastCaptures(f),/Conflicting immutable/);
});
test('unreviewed captures and BET-only objections do not clear a positive prose lead',()=>{
  const f=fixture(),lead=review(f).leads[0];
  f.sidecar.forecastEvidence.records=[f.capture.records[0]];
  assert.equal(review(f).complete,false);
  f.receipt.candidateAssessment={forecastLeadDispositions:[{leadId:lead.leadId,state:'REJECTED',checkedAt:f.report.ts,
    sourceIds:['model'],objectionKind:'NOT_BET_GRADE',rationale:'Missing published interval and Pinnacle disagrees.',
    directionalReview:{state:'REJECTED',rationale:'Not BET grade.'}}]};
  assert.equal(review(f).complete,false);
  const rejection=f.receipt.candidateAssessment.forecastLeadDispositions[0];
  rejection.objectionKind='PERSONNEL_CONFLICT';rejection.sourceIds=['model','info'];
  rejection.rationale='Synthetic official review identifies a goalie assumption conflicting with the model.';
  rejection.directionalReview.rationale='The synthetic starter conflict can reverse this small point advantage; no credible directional preference remains.';
  assert.equal(review(f).complete,true);
  rejection.directionalReview=null;assert.equal(review(f).complete,false);
  rejection.sourceIds=['info'];assert.equal(review(f).complete,false);
});
test('score projections, generic percentages, wrong teams and negative prices never fabricate a candidate',()=>{
  for(const finding of ['Projected goals 4.00-2.63.', 'Bet Value 69.4%.', 'DRatings showed Toronto 69.4%, Boston 30.6%.']) {
    const f=fixture();f.receipt.decision.sourceEvidence[0].finding=finding;f.receipt.evidence.sourceEvidence[0].finding=finding;
    assert.equal(collectForecastLeads(f).length,0);assert.equal(review(f).required,false);
  }
  const f=fixture();f.selection.marketDetail='full_game_primary_puck_line';f.selection.marketClass='spread';
  assert.equal(collectForecastLeads(f).length,0);
  const negative=fixture();negative.receipt.quote.priceDecimal=1.4;
  const r=review(negative);assert.equal(r.leads[0].supportsPrice,false);assert.equal(r.required,false);assert.equal(r.complete,true);
});
test('routing is forward-only and frozen/issued inputs reject new captures',()=>{
  const old=fixture();old.report.ts='2026-10-01T18:47:43-07:00';
  assert.equal(routeForecastCaptures(old).applied,false);assert.equal(review(old).required,false);
  assert.ok(Date.parse(FORECAST_ROUTING_FROM)>Date.parse(old.report.ts));
  for(const flag of ['frozen','issued','immutable'])for(const key of ['report','sidecar']) {
    const f=fixture();f[key][flag]=true;assert.throws(()=>routeForecastCaptures(f),/unfrozen draft/);
  }
});
test('October 1 18:15 saved input replay exposes Edmonton and Chicago without changing issuance',()=>{
  const paths=['data/history/runs/2026-10-01/late-182544.json','data/history/research-fit/2026-10-01/late-182544.json'];
  const bytes=paths.map(p=>fs.readFileSync(p)),[report,sidecar]=bytes.map(b=>JSON.parse(b));
  const read=p=>JSON.parse(fs.readFileSync(p));
  // Resolve the immutable blobs when the repository has moved to a new feed.
  // Use the source-bound inputs, never whatever quotes happen to be live later.
  const blob=sha=>JSON.parse(execFileSync('git',['cat-file','blob',sha],{maxBuffer:32*1024*1024}));
  const feed=blob(sidecar.provenance.feedBlobSha),observer=blob(sidecar.provenance.pinnacleObserverBlobSha);
  assert.equal(feed.generatedAt,report.feedGeneratedAt);
  const universe=derivePrimarySelectionInventory(report,feed,read('data/major-sport-market-coverage-v1.json'));
  const args={report,sidecar,feed,observer,universe,developmentReplay:true};
  const forecastCoverage=buildForecastCoverage(args),a=buildCandidateAssessment({...args,forecastCoverage});
  const edmonton=a.selections.find(row=>row.recordedTitle==='Edmonton Oilers');
  assert.equal(edmonton.reviewRequired,true);assert.equal(edmonton.reviewState,'UNFINISHED');
  assert.equal(edmonton.forecastLeadReview.leads[0].probability,.694);
  assert.equal(edmonton.forecastLeadReview.leads[0].supportsPrice,true);
  const chicago=a.selections.find(row=>row.eventId==='72886428'&&row.side==='away'&&row.marketDetail==='full_game_moneyline');
  assert.equal(chicago.forecastLeadReview.leads[0].probability,.35);assert.equal(chicago.reviewRequired,true);
  assert.equal(a.selections.find(row=>row.recordedTitle==='Florida Panthers').reviewRequired,false);
  const inputBefore=JSON.stringify({report,sidecar});
  finalizeCandidateAssessmentDraft({...args,forecastCoverage,draft:true});
  assert.equal(sidecar.primaryAnalysis.receipts.find(row=>row.selectionId===edmonton.selectionId).state,'BLOCKED');
  assert.equal(sidecar.primaryAnalysis.receipts.find(row=>row.selectionId===chicago.selectionId).state,'BLOCKED');
  assert.notEqual(JSON.stringify({report,sidecar}),inputBefore);
  paths.forEach((p,i)=>assert.deepEqual(fs.readFileSync(p),bytes[i]));
});

test('shared checkpoint intake exposes a captured point before preparation finalizes producer work',()=>{
  const read=p=>JSON.parse(fs.readFileSync(p));
  const report=read('data/history/runs/2026-10-01/late-182544.json'),sidecar=read('data/history/research-fit/2026-10-01/late-182544.json');
  // Simulated forward draft/applicability, solely to exercise controller intake.
  // No new actual source review, betting decision or issued bytes are claimed.
  report.ts='2026-10-01T18:50:00-07:00';
  const receipt=sidecar.primaryAnalysis.receipts.find(row=>row.decision?.title==='Edmonton Oilers');
  const source=receipt.decision.sourceEvidence.find(row=>row.kind==='MODEL');
  const capture=fixture().capture,raw=capture.records[0],revalidation=capture.revalidations[0];
  Object.assign(raw,{recordId:'synthetic-intake-replay',eventId:receipt.quote.eventId,startTime:receipt.decision.feed.eventDate,
    url:source.url,excerpt:source.finding,observedAt:source.checkedAt});
  Object.assign(raw.capture,{observedAt:source.checkedAt,sourceUrl:source.url,evidenceRef:'synthetic-intake-replay-only'});
  Object.assign(revalidation,{recordId:raw.recordId,forReportAt:report.ts,checkedAt:report.ts});
  source.forecastCapture=capture;
  const before=JSON.stringify({report,sidecar});
  const captured=captureForecastEvidenceDraft({root:process.cwd(),report,sidecar});
  assert.equal(JSON.stringify({report,sidecar}),before);
  assert.equal(captured.routing.imported[0].eligibility,'ELIGIBLE_EXACT');
  const rec=captured.report.recs.find(row=>row.title==='Edmonton Oilers');
  assert.equal(rec.forecastReview.records.find(row=>row.recordId===raw.recordId).comparison.direction,'SUPPORTS_PRICE');
  assert.equal(rec.status,'PASS');assert.equal(rec.stake,'$0');
  const prepared=prepareEvidenceDraft({root:process.cwd(),report:captured.report,sidecar:captured.sidecar});
  assert.equal(prepared.audit.forecastRouting.applied,true);
  assert.ok(prepared.audit.candidateDeferrals.selectionIds.includes(receipt.selectionId));
  assert.equal(prepared.sidecar.primaryAnalysis.receipts.find(row=>row.selectionId===receipt.selectionId).state,'BLOCKED');
  assert.equal(prepared.report.risk,0);
  // Exercise actual checkpoint start/update/read-only planning, not just intake.
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forecast-routing-controller-'));
  const checkpoint=`data/report-production/checkpoints/forecast-routing-test-${process.pid}.json`;
  Object.assign(sidecar.reportReference,{ts:report.ts});
  sidecar.provenance.reportTimestamp=report.ts;
  const rfile=path.join(dir,'report.json'),sfile=path.join(dir,'sidecar.json');
  fs.writeFileSync(rfile,JSON.stringify(report));fs.writeFileSync(sfile,JSON.stringify(sidecar));
  const base={root:process.cwd(),checkpoint};
  try {
    let state=runCommand({...base,command:'start',report:rfile,sidecar:sfile});
    const stored=JSON.parse(fs.readFileSync(path.resolve(checkpoint)));
    assert.equal(stored.sidecar.forecastEvidence.records[0].recordId,raw.recordId);
    const next=runCommand({...base,command:'next',eventId:receipt.quote.eventId});
    assert.ok(next.workPlan.events[0].selections.some(row=>row.selectionId===receipt.selectionId));
    state=runCommand({...base,command:'checkpoint',report:rfile,sidecar:sfile,expectedRevision:state.revision});
    assert.equal(JSON.parse(fs.readFileSync(path.resolve(checkpoint))).sidecar.forecastEvidence.records.length,1);
  } finally {fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(path.resolve(checkpoint),{force:true});}
});

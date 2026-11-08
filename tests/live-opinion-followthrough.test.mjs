import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {parseReportDocument} from '../tools/report-document-transport.mjs';
import {buildForecastCoverage} from '../tools/forecast-evidence.mjs';
import {collectForecastLeads,inspectForecastLeadReview,CAPTURED_POINT_REVIEW_FROM} from '../tools/forecast-lead-routing.mjs';
import {buildCandidateAssessment} from '../tools/candidate-assessment.mjs';
import {unfinishedCandidateReviews} from '../tools/research-completion.mjs';
import {describeResearchCompletion} from '../tools/major-sport-market-coverage-gate.mjs';
import {reportRunHealth} from '../tools/report-run-health.mjs';

const file='data/report-production/checkpoints/20261107-evening-1515.json',sha='f81e64ff67aa06c38e5c93d92a4a5990f356c838';
const blobSha=b=>createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
const current=fs.existsSync(file)?fs.readFileSync(file):null;
const bytes=current && blobSha(current)===sha?current:execFileSync('git',['cat-file','blob',sha],{maxBuffer:4*1024*1024});
assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),sha);
const saved=parseReportDocument(bytes,'REPORT_CHECKPOINT'),bundle=parseReportDocument(saved.frozen.serializedBundle,'STAGED_REPORT');
const report=saved.report||bundle.report,sidecar=saved.sidecar||bundle.sidecar;
const receipts=new Map(sidecar.primaryAnalysis.receipts.map(row=>[row.selectionId,row]));
// Only event metadata is reconstructed from the actual saved fields. Prices,
// observations, source records and reviews remain the original issued inputs.
const events=new Map(sidecar.forecastEvidence.records.map(r=>[String(r.eventId),{eventId:String(r.eventId),date:r.startTime,
  home:r.home,away:r.away,league:{name:r.sport},sport:{slug:{NBA:'basketball',NHL:'ice-hockey',NCAAF:'american-football'}[r.sport]}}]));
const feed={generatedAt:report.feedGeneratedAt,events:[...events.values()]};
const universe={selections:sidecar.candidateAssessment.selections.map(row=>({...row,
  marketClass:row.marketDetail.includes('moneyline')?'moneyline':row.marketDetail.includes('total')?'total':'spread',
  quotes:row.options.map(option=>option.quote)}))};
const forecastCoverage=buildForecastCoverage({report,sidecar,universe,feed});

test('the actual 15:15 issue cannot hide 20 favorable captured fields behind context-only reviews',()=>{
  const before=JSON.stringify([report.counts,sidecar.primaryAnalysis,sidecar.forecastEvidence]);
  let pending=0,captured=0;
  for(const selection of universe.selections){
    const receipt=receipts.get(selection.selectionId),forecast=forecastCoverage.selections.find(row=>row.selectionId===selection.selectionId);
    const review=inspectForecastLeadReview({report,sidecar,selection,receipt,forecast,feed,developmentReplay:true});
    for(const lead of review.leads.filter(l=>l.fromCapturedRecord && l.supportsPrice)){
      if(lead.state==='REVIEW_REQUIRED')pending++;
      if(lead.state==='CAPTURED')captured++;
    }
  }
  assert.equal(pending,20);assert.equal(captured,3,'the three genuinely reviewed opinions keep their existing eligibility');
  assert.equal(forecastCoverage.totals.exactEligible,3,'research routing never approves the other points');
  assert.equal(JSON.stringify([report.counts,sidecar.primaryAnalysis,sidecar.forecastEvidence]),before);
});

test('completed PASS paperwork in an unissued draft is still a missing decision handoff',()=>{
  const gaps=unfinishedCandidateReviews(report,sidecar);
  assert.equal(gaps.length,4);
  assert.ok(gaps.every(row=>row.missingResearch.includes('FINAL_DECISION_HANDOFF_REQUIRED')));
  assert.equal(reportRunHealth({...saved,report,sidecar}).remainingWork.producerUnfinished,4);
  assert.equal(describeResearchCompletion(report,sidecar).unfinished,0,'original issued completion remains reproducible before the new cutoff');
  const review=buildCandidateAssessment({report,sidecar,universe,feed,forecastCoverage,developmentReplay:true});
  assert.equal(review.counts.unfinished,24,'20 applicability reviews and four decision handoffs remain separate work');
  assert.deepEqual(report.counts,{bet:0,lean:3,wait:0,pass:0});
  assert.equal(review.selections.filter(row=>row.state==='EVALUATED' && row.reviewState==='COMPLETE').length,3);
});

function onePoint(){
  const selection=universe.selections.find(row=>row.selectionId==='NCAAF|70899036|full_game_moneyline|home');
  const receipt=structuredClone(receipts.get(selection.selectionId));delete receipt.candidateDraft;
  receipt.blocker.attempts=[];
  const raw=structuredClone(sidecar.forecastEvidence.records.find(r=>r.recordId==='83d286e28654a6ae1f38db90e9cd77dcfc7434ae8bb771884950fa268c6b0a84'));
  return {report,selection,receipt,feed,sidecar:{forecastEvidence:{records:[raw],revalidations:[]}},raw,developmentReplay:true};
}

test('raw leads retain exact identity and clocks and cannot create a forecast or automatic grade',()=>{
  const f=onePoint();assert.equal(collectForecastLeads(f).length,1);
  for(const change of [r=>r.eventId='other',r=>r.sport='NBA',r=>r.side='away',r=>r.line=1,r=>r.probability='0.789',
    r=>r.observedAt='2026-11-08T04:00:00Z',r=>r.modelFamily='OTHER',r=>r.url='https://user:secret@example.org/field']){
    const x=onePoint();change(x.raw);assert.equal(collectForecastLeads(x).length,0);
  }
  const original=onePoint();delete original.developmentReplay;
  assert.equal(collectForecastLeads(original).length,0,'historical publication behavior remains unchanged');
  original.report={...report,ts:CAPTURED_POINT_REVIEW_FROM};
  assert.equal(collectForecastLeads(original).length,1,'the forward producer receives the same original observation without replay mode');
  assert.ok(Date.parse(report.ts)<Date.parse(CAPTURED_POINT_REVIEW_FROM));
});

test('a source-linked directional objection closes a lead; no fair adoption is not a settlement mismatch',()=>{
  const f=onePoint(),lead=collectForecastLeads(f)[0];
  const source={id:'synthetic-current-team',kind:'OFFICIAL',eventId:'70899036',checkedAt:report.ts,url:'https://example.org/synthetic/team/quarterback',
    finding:'SYNTHETIC TEST ONLY: Starter B replaces Starter A, materially invalidating the recorded point assumption.'};
  f.receipt.evidence={sourceEvidence:[source]};
  f.receipt.candidateAssessment={forecastLeadDispositions:[{leadId:lead.leadId,state:'REJECTED',checkedAt:report.ts,
    sourceIds:[source.id],objectionKind:'PERSONNEL_CONFLICT',rationale:source.finding,
    directionalReview:{state:'REJECTED',rationale:'SYNTHETIC: the point assumes Starter A; the named replacement makes a provisional opinion unsupported.'}}]};
  assert.equal(inspectForecastLeadReview(f).complete,true,'a genuine specific rejection never forces LEAN');
  const objection=f.receipt.candidateAssessment.forecastLeadDispositions[0];
  objection.objectionKind='SETTLEMENT_UNRESOLVED';objection.rationale='No independently calibrated fair or interval was adopted for an issued decision.';
  objection.directionalReview.rationale='No exact contract probability and settlement match was adopted as a fair.';
  assert.equal(inspectForecastLeadReview(f).complete,false,'adoption language does not identify different grading rules');
  objection.rationale='SYNTHETIC: the captured field is regulation-only but this contract includes overtime.';
  objection.directionalReview.rationale='SYNTHETIC: a regulation-only point does not support this overtime-inclusive contract.';
  assert.equal(inspectForecastLeadReview(f).complete,true,'a documented actual settlement mismatch closes the research lead');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {researchCompletion,unfinishedCandidateReviews,RESEARCH_COMPLETION_FROM} from '../tools/research-completion.mjs';
import {describeResearchCompletion,derivePrimarySelectionInventory} from '../tools/major-sport-market-coverage-gate.mjs';
import {reportRunHealth} from '../tools/report-run-health.mjs';
import {majorSportKey,PROFESSIONAL_LEAGUE_IDENTITY_FROM} from '../tools/primary-sport-identity.mjs';
import {buildEventResearchPlan,buildResearchWorkPlan} from '../tools/event-research-plan.mjs';

function fixture() {
  const report={ts:RESEARCH_COMPLETION_FROM,feedGeneratedAt:'2026-11-07T20:05:00Z'};
  const quote={eventId:'game',marketKey:'ml',side:'home',line:null,selectionKey:'game|ml|home||',book:'FanDuel',priceDecimal:2.1,
    quoteUpdatedAt:'2026-11-07T19:00:00Z',quoteObservedAt:report.feedGeneratedAt};
  const receipt={selectionId:'NBA_WNBA|game|full_game_moneyline|home',quote,state:'BLOCKED',blocker:{reason:'PERSONNEL_UNRESOLVED',
    missing:'Current personnel confirmation is absent.',impact:'No decision issued.',attempts:[{eventId:'game',checkedAt:report.feedGeneratedAt,
      url:'https://example.org/game/injuries',finding:'The captured injury board lists a projected participant.'}]}};
  const assessment={schema:1,version:'candidate-assessment-v1',asOf:report.ts,selections:[{selectionId:receipt.selectionId,
    state:receipt.state,assessedQuote:structuredClone(quote),quote:structuredClone(quote),promising:true,reviewRequired:true,
    reviewState:'UNFINISHED',missingResearch:['CURRENT_CANDIDATE_REVIEW_REQUIRED']}]};
  const sidecar={primaryAnalysis:{feedGeneratedAt:report.feedGeneratedAt,receipts:[receipt]},candidateAssessment:assessment};
  report.candidateAssessment=structuredClone(assessment);
  return {report,sidecar};
}

test('a source-gap label cannot hide the same quote\'s unfinished candidate review',()=>{
  const state=fixture(),before=JSON.stringify(state);
  assert.equal(unfinishedCandidateReviews(state.report,state.sidecar).length,1);
  assert.deepEqual(describeResearchCompletion(state.report,state.sidecar),{state:'INCOMPLETE',evaluated:0,unfinished:1,
    notice:'ANALYSIS INCOMPLETE: 0 evaluated; 1 unfinished.'});
  const health=reportRunHealth({...state,phase:'PUBLISHED',publication:{verified:true}});
  assert.equal(health.continuationRequired,true);
  assert.equal(health.remainingWork.producerUnfinished,1);
  assert.equal(health.remainingWork.documentedShortfalls,0);
  assert.equal(health.candidateReviewHandoff.unfinished,1);
  assert.equal(JSON.stringify(state),before,'diagnostics never relabel receipts or assign decisions');
  state.sidecar.primaryAnalysis.receipts[0].blocker.reason='RESEARCH_INCOMPLETE';
  assert.equal(researchCompletion(state.report,state.sidecar).unfinished,1,'receipt and both candidate copies count once');
});

test('only a current assessment of the exact retained quote supplies candidate work',()=>{
  const mutations=[
    x=>{x.sidecar.primaryAnalysis.feedGeneratedAt='2026-11-07T19:05:00Z';},
    x=>{for(const a of [x.report.candidateAssessment,x.sidecar.candidateAssessment])a.asOf='2026-11-07T20:09:00Z';},
    ...['eventId','marketKey','side','selectionKey','book','priceDecimal','line','quoteObservedAt','quoteUpdatedAt'].map(key=>x=>{
      for(const a of [x.report.candidateAssessment,x.sidecar.candidateAssessment])a.selections[0].assessedQuote[key]=
        key==='priceDecimal'?2.2:key==='line'?1:'different';
    }),
    x=>{x.sidecar.primaryAnalysis.receipts.push(structuredClone(x.sidecar.primaryAnalysis.receipts[0]));},
    x=>{for(const a of [x.report.candidateAssessment,x.sidecar.candidateAssessment])a.selections[0].state='EVALUATED';}
  ];
  for(const mutate of mutations){const state=fixture();mutate(state);assert.equal(unfinishedCandidateReviews(state.report,state.sidecar).length,0);}
  const cleared=fixture();for(const a of [cleared.report.candidateAssessment,cleared.sidecar.candidateAssessment])a.selections[0].reviewState='COMPLETE';
  assert.equal(reportRunHealth(cleared).continuationRequired,false,'a documented terminal gap does not trigger an unchanged-source retry');
  assert.equal(researchCompletion({},{}).unfinished,0);
});

test('new league identity separates G League while preserving issued inventory semantics',()=>{
  const g={sport:{slug:'basketball'},league:{slug:'usa-nba-g-league-tip-off-tournament',name:'USA - NBA G League Tip-Off Tournament'}};
  assert.equal(majorSportKey(g),null);
  assert.equal(majorSportKey(g,{at:PROFESSIONAL_LEAGUE_IDENTITY_FROM}),null);
  assert.equal(majorSportKey(g,{at:'2026-11-07T17:12:06Z'}),'NBA_WNBA');
  for(const slug of ['usa-nba','usa-nba-preseason','usa-wnba'])assert.equal(majorSportKey({sport:{slug:'basketball'},league:{slug}}),'NBA_WNBA');
  assert.equal(majorSportKey({sport:{slug:'american-football'},league:{slug:'usa-college'}}),'NCAAF','college coverage is retained');
});

test('replay the actual November 7 gap without modifying its issued research',()=>{
  const file='data/history/research-fit/2026-11-07/final_morning-101206.json';
  const bytes=fs.existsSync(file)?fs.readFileSync(file):execFileSync('git',['show',`HEAD:${file}`],{maxBuffer:128*1024*1024});
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),'55b2fe0c18a0d141ce287f4ca00c3ecff7c43620');
  const sidecar=JSON.parse(bytes),report={ts:sidecar.reportReference.ts,feedGeneratedAt:sidecar.reportReference.feedGeneratedAt};
  const before=JSON.stringify([sidecar.primaryAnalysis,sidecar.candidateAssessment]);
  assert.equal(sidecar.candidateAssessment.counts.unfinished,46);
  assert.deepEqual(describeResearchCompletion(report,sidecar),{state:'COMPLETE',evaluated:4,unfinished:0,notice:null},'historical publisher metadata remains reproducible');
  assert.deepEqual(researchCompletion(report,sidecar),{state:'PARTIAL',evaluated:4,unfinished:46,notice:'PARTIAL REPORT: 4 evaluated; 46 unfinished.'});
  const health=reportRunHealth({report,sidecar,phase:'PUBLISHED',validation:{state:'PASS'},publication:{verified:true}});
  assert.equal(health.continuationRequired,true);assert.equal(health.remainingWork.producerUnfinished,46);
  assert.equal(health.remainingWork.documentedShortfalls,610);assert.equal(health.validationState,'PASS');
  assert.deepEqual(Object.fromEntries(Object.entries(health.remainingWork.sports).map(([k,v])=>[k,v.producerUnfinished])),{CFL:0,NBA_WNBA:5,NCAAF:36,NHL:5});
  const feed=JSON.parse(execFileSync('git',['cat-file','blob',sidecar.provenance.feedBlobSha],{maxBuffer:128*1024*1024}));
  const policy=JSON.parse(fs.readFileSync('data/major-sport-market-coverage-v1.json'));
  const universe=derivePrimarySelectionInventory(report,feed,policy);
  assert.equal(universe.selections.length,660);assert.equal(Object.values(universe.sports).reduce((n,s)=>n+s.primary.unavailable,0),1008);
  assert.ok(universe.selections.every(row=>row.eventLabel && !/^Event /.test(row.eventLabel)),'bound names reach unassessed games too');
  const byId=new Map(universe.selections.map(row=>[row.selectionId,row]));
  const candidateAssessment={...sidecar.candidateAssessment,selections:sidecar.candidateAssessment.selections.map(row=>({...row,eventLabel:byId.get(row.selectionId)?.eventLabel}))};
  const plan=buildEventResearchPlan({report,sidecar,candidateAssessment});
  assert.equal(plan.events.reduce((n,e)=>n+e.producerReviewPending,0),46);
  assert.ok(plan.events[0].producerReviewPending>0,'finish known candidate work before revisiting terminal shortfalls');
  assert.equal(buildResearchWorkPlan(plan).nextEventId,plan.events[0].eventId);
  const futureReport={...report,ts:RESEARCH_COMPLETION_FROM};
  const futureSidecar={...sidecar,candidateAssessment:{...sidecar.candidateAssessment,asOf:futureReport.ts}};
  assert.equal(describeResearchCompletion(futureReport,futureSidecar).unfinished,46,'synthetic future display uses candidate work; it issues no decision');
  assert.equal(JSON.stringify([sidecar.primaryAnalysis,sidecar.candidateAssessment]),before);
});

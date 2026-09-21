import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {compareGrahamFair,reviewGrahamHandoff,loadGrahamHandoffInputs,GRAHAM_HANDOFF_FROM} from '../tools/graham-fair-handoff.mjs';
import {buildEvidenceAudit,prepareEvidenceDraft,validateCandidateCompletion} from '../tools/report-evidence-repair.mjs';
import {buildCandidateAssessment,finalizeCandidateAssessmentDraft} from '../tools/candidate-assessment.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const baseline='f8e7a1d2df044c0990a99dbbd2ca73acabb7b915';
const activePath='data/walters/nfl/active-week.json',authorityPath='core/walters-authority-v1.4.json',boardPath='data/walters/nfl/2026/week-02-current-numbers.json';
const saved=new Map([activePath,authorityPath,boardPath].map(file=>[file,execFileSync('git',['show',`${baseline}:${file}`],{cwd:root})]));
const savedInputs=report=>({state:'BOUND',active:JSON.parse(saved.get(activePath)),authority:JSON.parse(saved.get(authorityPath)),board:JSON.parse(saved.get(boardPath)),boardPath,binding:{schema:1,reportTs:report.ts,blobs:Object.fromEntries([...saved].map(([file,bytes])=>[file,execFileSync('git',['hash-object','--stdin'],{cwd:root,input:bytes,encoding:'utf8'}).trim()]))}});
function fixture(side='home') {
  // Explicit synthetic clock/game: no research or live recommendation implied.
  const report={ts:GRAHAM_HANDOFF_FROM,feedGeneratedAt:'2026-09-21T05:55:00-07:00',recs:[]};
  const eventDate='2026-09-21T17:15:00-07:00';
  const quote={eventId:'fixture',book:'Bet365',marketKey:'spread',side,line:-3,priceDecimal:1.91,selectionKey:`fixture|spread|${side}||-3`,quoteUpdatedAt:report.feedGeneratedAt};
  const selection={selectionId:`NFL|fixture|full_game_primary_spread|${side}`,sport:'NFL',eventId:'fixture',eventDate,marketClass:'spread',marketDetail:'full_game_primary_spread',side,quotes:[quote]};
  const feed={events:[{id:'fixture',home:'Chicago Bears',away:'Minnesota Vikings',date:eventDate,league:{slug:'usa-nfl'}}]};
  const inputs=savedInputs(report);
  assert.equal(inputs.state,'BOUND');
  // Use production field shape with synthetic fixture identity and declared fair.
  const game=structuredClone(inputs.board.games.find(g=>g.home==='CHI'));
  Object.assign(game,{gameKey:'SYNTHETIC_MIN_CHI',numberStatus:'READY_PARTIAL_BLOCKED_WEEKLY_RATING_INPUT',startTimePacific:eventDate,grahamExactFairHome:-6,grahamFairHome:-6});
  Object.assign(game.fairDecomposition,{neutralTeamBaseHome:-3,homeFieldPointsToHomeSpread:-3,otherGovernedPointsToHomeSpread:0,personnelPointsToHomeSpread:0,matchupPointsToHomeSpread:0,exactFairHome:-6,displayedFairHome:-6});
  inputs.board.games=[game];
  return {report,selection,quote,feed,inputs};
}
function reviewed(args,disposition='CONTEXT') {
  const handoff=compareGrahamFair(args),source={id:'current',eventId:'fixture',kind:'OFFICIAL',url:'https://example.org/synthetic/game',checkedAt:args.report.feedGeneratedAt,finding:'Synthetic current personnel check; fixture only.'};
  const review={recordId:handoff.recordId,selectionKey:args.quote.selectionKey,disposition,checkedAt:args.report.ts,status:'PASS',rationale:'Synthetic assessment retains the independent market route.',decisionImpact:'PASS retained after checking the fair and unresolved assumptions.',currentSourceIds:['current'],limitationsAddressed:handoff.limitations.map(code=>({code,explanation:'Synthetic limitation considered in the retained PASS.'}))};
  const receipt={selectionId:args.selection.selectionId,state:'EVALUATED',quote:args.quote,checkedAt:args.report.ts,candidateAssessment:{grahamFairReview:review},decision:{status:'PASS',stake:'$0',feed:{...args.quote,eventDate:args.selection.eventDate},sourceEvidence:[source],grahamFairReview:structuredClone(review)}};
  return {handoff,receipt,report:args.report};
}
test('native selected-side signs, exact decimals, timing and limitations; no probability or grade',()=>{
  const home=fixture(),h=compareGrahamFair(home),a=compareGrahamFair(fixture('away'));
  assert.equal(h.state,'EXACT_FAIR_REQUIRES_REVIEW',h.reason);assert.equal(h.selectedFairPoints,-6);assert.equal(h.selectedLinePoints,-3);assert.equal(h.pointMargin,3);
  assert.equal(a.selectedFairPoints,6);assert.equal(a.selectedLinePoints,3);assert.equal(a.pointMargin,-3);
  assert.equal(h.sourceAsOf,home.inputs.board.games[0].grahamAsOf);assert.ok(h.sourceAgeHours>0);
  assert.ok(h.limitations.includes('WEEKLY_RATING_INPUT_NOT_COMPLETE'));
  assert.equal(h.decisionAuthority,false);assert.equal(h.statusEffect,'NONE');
  assert.equal(h.range,undefined);assert.equal(h.coverProbability,undefined);
  assert.notEqual(h.recordId,a.recordId);
});
test('exact identity fails closed for reused teams, duplicates, swapped venues, wrong side and started games',()=>{
  for(const mutate of [x=>x.inputs.board.games[0].startTimePacific='2026-09-22T17:15:00-07:00',x=>x.inputs.board.games.push(structuredClone(x.inputs.board.games[0])),x=>x.feed.events[0].home='Minnesota Vikings',x=>x.quote.side='away',x=>x.selection.eventDate=x.report.ts,x=>x.feed.events[0].league.slug='usa-ncaaf']){
    const x=fixture();mutate(x);assert.equal(compareGrahamFair(x).state,'UNAVAILABLE');
  }
});
test('readiness, arithmetic, source lineage, authority and future fair are enforced',()=>{
  for(const mutate of [x=>x.inputs.board.games[0].fairDecomposition.exactFairHome=9,x=>x.inputs.board.games[0].sourceRefs=[],x=>x.inputs.board.games[0].qbPerformanceStatus='BLOCKED',x=>x.inputs.board.games[0].numberStatus='BLOCKED',x=>x.inputs.authority.mode='OFF',x=>x.inputs.board.games[0].grahamAsOf='2026-09-22T06:00:00-07:00']){
    const x=fixture();mutate(x);assert.equal(compareGrahamFair(x).state,'UNAVAILABLE');
  }
});
test('Graham handoff scope and cutover leave previous reports and other markets untouched',()=>{
  for(const mutate of [x=>x.report.ts='2026-09-20T18:15:00-07:00',x=>x.selection.sport='NCAAF',x=>x.selection.marketDetail='first_half_spread',x=>x.selection.marketClass='total']){const x=fixture();mutate(x);assert.equal(compareGrahamFair(x),null);}
});
test('card disposition requires exact record, matching status, current sources and every limitation',()=>{
  const base=reviewed(fixture('away'));assert.equal(reviewGrahamHandoff(base).complete,true);
  for(const mutate of [x=>x.receipt.candidateAssessment.grahamFairReview.recordId='wrong',x=>x.receipt.decision.status='LEAN',x=>x.receipt.decision.sourceEvidence[0].eventId='other',x=>x.receipt.decision.sourceEvidence[0].checkedAt='2026-09-20T06:00:00-07:00',x=>x.receipt.candidateAssessment.grahamFairReview.limitationsAddressed=[]]){const x=structuredClone(base);mutate(x);assert.equal(reviewGrahamHandoff(x).complete,false);}
  const x=fixture();const old=compareGrahamFair(x);x.quote.line=-4;assert.notEqual(old.recordId,compareGrahamFair(x).recordId);x.quote.priceDecimal=2;assert.notEqual(old.recordId,compareGrahamFair(x).recordId);
});
test('adoption binds exact fair and source; advisory mode cannot adopt; no automatic BET',()=>{
  const x=reviewed(fixture(),'ADOPTED_FAIR');assert.equal(reviewGrahamHandoff(x).complete,false);
  x.receipt.decision.fairValueEvidence={unit:'selection_spread_points',estimate:-6,selectionKey:x.handoff.selectionKey,grahamHandoffRecordId:x.handoff.recordId,inputs:[{sourceIds:['graham']} ]};
  x.receipt.decision.sourceEvidence.push({id:'graham',kind:'MODEL',eventId:'fixture',url:x.handoff.sourceUrl,asOf:x.handoff.sourceAsOf,finding:'Synthetic native fair input.'});
  x.receipt.decision.waltersEvidence={availability:'AVAILABLE',contribution:'CORE_FAIR_INPUT'};
  assert.equal(reviewGrahamHandoff(x).complete,true);assert.equal(x.receipt.decision.status,'PASS');
  x.handoff.mode='ADVISORY';assert.equal(reviewGrahamHandoff(x).complete,false);
});
test('candidate discovery requires no pre-attached fair; incomplete positive and contrary sides defer independently',()=>{
  for(const side of ['home','away']) {
    const x=fixture(side),r=reviewed(x).receipt;
    delete r.candidateAssessment;delete r.decision.grahamFairReview;r.evidence=structuredClone(r.decision);
    const other={status:'PASS',stake:'$0',feed:{selectionKey:'other'},analysis:'Unaffected completed card'};
    const args={report:{...x.report,recs:[r.decision,other]},sidecar:{recommendations:[r.evidence,structuredClone(other)],primaryAnalysis:{receipts:[r]}},universe:{selections:[x.selection]},feed:x.feed,grahamInputs:x.inputs,forecastCoverage:{selections:[]}};
    const original=JSON.stringify(args),row=buildCandidateAssessment(args).selections[0];
    assert.equal(row.promising,side==='home');assert.equal(row.reviewRequired,true);assert.equal(row.reviewState,'UNFINISHED');assert.equal(JSON.stringify(args),original);
    const done=finalizeCandidateAssessmentDraft({...args,draft:true});assert.deepEqual(done.deferredSelectionIds,[x.selection.selectionId]);assert.deepEqual(args.report.recs,[other]);assert.equal(r.candidateDraft.decision.status,'PASS');
  }
});
test('complete contrary-side context remains publishable without inventing an interval',()=>{
  const x=fixture('away'),r=reviewed(x).receipt;
  const args={report:x.report,sidecar:{primaryAnalysis:{receipts:[r]}},universe:{selections:[x.selection]},feed:x.feed,grahamInputs:x.inputs};
  const row=buildCandidateAssessment(args).selections[0];assert.equal(row.grahamReview.complete,true);assert.notEqual(row.reviewState,'UNFINISHED');assert.equal(row.status,'PASS');
});
test('pinned blobs survive live board change; missing/future input snapshots remain reproducible',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'graham-handoff-'));
  try {
    execFileSync('git',['init','-q',tmp]);
    const report=fixture().report,inputs=savedInputs(report);
    for(const relative of Object.keys(inputs.binding.blobs)){
      fs.mkdirSync(path.dirname(path.join(tmp,relative)),{recursive:true});const raw=saved.get(relative);fs.writeFileSync(path.join(tmp,relative),raw);execFileSync('git',['hash-object','-w','--stdin'],{cwd:tmp,input:raw});
    }
    const pinned=loadGrahamHandoffInputs(tmp,report);fs.writeFileSync(path.join(tmp,pinned.boardPath),'{}');
    assert.deepEqual(loadGrahamHandoffInputs(tmp,report,{grahamFairHandoffInputs:pinned.binding}),pinned);
    const unavailable=loadGrahamHandoffInputs(tmp,report);assert.equal(unavailable.state,'UNAVAILABLE');
    fs.writeFileSync(path.join(tmp,pinned.boardPath),saved.get(pinned.boardPath));
    assert.deepEqual(loadGrahamHandoffInputs(tmp,report,{grahamFairHandoffInputs:unavailable.binding}),unavailable);
    const future=JSON.parse(fs.readFileSync(path.join(tmp,pinned.boardPath)));future.updatedAt='2026-09-22T06:00:00-07:00';fs.writeFileSync(path.join(tmp,pinned.boardPath),JSON.stringify(future));assert.equal(loadGrahamHandoffInputs(tmp,report).state,'UNAVAILABLE');
    assert.throws(()=>loadGrahamHandoffInputs(tmp,{ts:'2026-09-22T06:00:00-07:00'},{grahamFairHandoffInputs:pinned.binding}),/mismatch/);
  } finally{fs.rmSync(tmp,{recursive:true,force:true});}
});

test('unavailable review cannot masquerade as adoption and is not a report-wide decision veto',()=>{
  const x=fixture('away');x.inputs.state='UNAVAILABLE';x.inputs.reason='Synthetic source missing';
  const r=reviewed(x,'UNAVAILABLE');assert.equal(reviewGrahamHandoff(r).complete,true);
  r.receipt.candidateAssessment.grahamFairReview.disposition='ADOPTED_FAIR';assert.equal(reviewGrahamHandoff(r).complete,false);
});

test('completed positive Graham context has an explicit producer PASS with no invented fair interval',()=>{
  const x=fixture(),r=reviewed(x).receipt;
  r.decision.personnelEvidence={personnelState:'CONFIRMED',unresolved:[]};
  Object.assign(r.candidateAssessment,{schema:1,selectionId:x.selection.selectionId,checkedAt:x.report.ts,quote:structuredClone(x.quote),forecastDispositions:[],personnel:{state:'RESOLVED',sourceIds:['current'],rationale:'Synthetic personnel check resolves material assumptions.'},decision:{status:'PASS',rationale:'Synthetic native fair rejected after current source review.',betEligibility:{state:'NOT_APPLICABLE',rationale:'No adopted fair; point margin alone does not establish an executable edge.'}},priceCondition:{state:'NO_PRICE_ONLY_CHANGE',rationale:'Resolve model assumptions before any change based on price.'}});
  const row=buildCandidateAssessment({report:x.report,sidecar:{primaryAnalysis:{receipts:[r]}},universe:{selections:[x.selection]},feed:x.feed,grahamInputs:x.inputs}).selections[0];
  assert.equal(row.reviewState,'COMPLETE',row.missingResearch.join(', '));assert.equal(row.grahamReview.complete,true);assert.equal(row.status,'PASS');assert.equal(r.decision.fairValueEvidence,undefined);
});

test('shared preparation pins Graham inputs; publication review rejects an unprepared snapshot and replays the pinned board',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'graham-preparation-'));
  const write=(name,value)=>{const file=path.join(tmp,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.isBuffer(value)?value:JSON.stringify(value));};
  try {
    execFileSync('git',['init','-q',tmp]);const x=fixture();
    for(const [file,bytes] of saved){write(file,bytes);execFileSync('git',['hash-object','-w','--stdin'],{cwd:tmp,input:bytes});}
    for(const file of ['data/major-sport-market-coverage-v1.json','core/core-handicap-framework-v1.4.json','research/forecast-source-registry.json','research/research-library.json'])write(file,fs.readFileSync(path.join(root,file)));
    const event=x.feed.events[0];event.sport={slug:'american-football'};
    event.bookmakers={Bet365:[{marketKey:'spread',name:'Spread',updatedAt:x.report.feedGeneratedAt,odds:[{hdp:-3,home:1.91,away:1.91,primary:true,selectionKeys:{home:'fixture|spread|home||-3',away:'fixture|spread|away||-3'}}]}]};
    x.feed.generatedAt=x.report.feedGeneratedAt;
    const feedBytes=Buffer.from(JSON.stringify(x.feed));write('data/live-odds.json',feedBytes);
    const sha=execFileSync('git',['hash-object','-w','--stdin'],{cwd:tmp,input:feedBytes,encoding:'utf8'}).trim();
    const sidecar={provenance:{feedBlobSha:sha},recommendations:[],primaryAnalysis:{receipts:[]}};
    const report={...x.report,counts:{bet:0,lean:0,wait:0,pass:0},risk:0};
    const before=buildEvidenceAudit({root:tmp,report,sidecar});assert.equal(before.candidateAssessment.selections.length,2,JSON.stringify(before.warnings));
    assert.throws(()=>validateCandidateCompletion({root:tmp,report,sidecar}),/must be pinned/);
    const prepared=prepareEvidenceDraft({root:tmp,report,sidecar});assert.ok(prepared.sidecar.grahamFairHandoffInputs);
    const first=validateCandidateCompletion({root:tmp,report:prepared.report,sidecar:prepared.sidecar});
    write(boardPath,{updatedAt:'2026-09-22T00:00:00Z'});
    const replay=validateCandidateCompletion({root:tmp,report:prepared.report,sidecar:prepared.sidecar});assert.deepEqual(replay,first);
    assert.equal(first.selections.every(row=>row.state==='UNASSESSED'),true,'candidate validation does not fabricate completed receipts; normal coverage gate still applies');
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});

test('a native point opportunity at another exact book/line is retained even without probability scores',()=>{
  const x=fixture();x.quote.line=-7;x.quote.selectionKey='fixture|spread|home||-7';
  const alternative={...x.quote,book:'DraftKings',line:-3,priceDecimal:1.8,selectionKey:'fixture|spread|home||-3'};x.selection.quotes.push(alternative);
  const row=buildCandidateAssessment({report:x.report,sidecar:{primaryAnalysis:{receipts:[]}},universe:{selections:[x.selection]},feed:x.feed,grahamInputs:x.inputs}).selections[0];
  assert.equal(row.quote.book,'DraftKings');assert.equal(row.promising,true);assert.equal(row.options.length,2);assert.equal(row.grahamFairHandoff.pointMargin,3);
});

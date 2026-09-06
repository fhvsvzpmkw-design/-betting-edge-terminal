import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {derivePrimarySelectionInventory} from '../tools/major-sport-market-coverage-gate.mjs';

for(const observedMode of [false,true]) {
const root=fs.mkdtempSync(path.join(os.tmpdir(),`primary-report-publication-${observedMode ? 'observed' : 'legacy'}-`));
const tool=path.resolve('tools/report-publication.mjs');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const policy=read('data/major-sport-market-coverage-v1.json');
const write=(file,value)=>{const dest=path.join(root,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');};
const hash=raw=>execFileSync('git',['hash-object','-w','--stdin'],{cwd:root,input:raw,encoding:'utf8'}).trim();
const call=command=>spawnSync(process.execPath,[tool,command,'--root',root,'--report',path.join(root,'input-report.json'),'--sidecar',path.join(root,'input-sidecar.json')],{cwd:root,encoding:'utf8'});
try{
  execFileSync('git',['init','-q',root]);
  const policyRaw=fs.readFileSync('data/major-sport-market-coverage-v1.json','utf8');
  write('data/major-sport-market-coverage-v1.json',policyRaw);
  const authoritySha=hash(policyRaw);
  const report={ts:'2026-09-06T18:21:30-07:00',feedGeneratedAt:'2026-09-07T01:08:00Z',slot:'late',label:'Synthetic publication fixture',bankroll:100,risk:0,counts:{bet:0,lean:0,wait:0,pass:0},recs:[],summary:'Primary selections: 6 available; 0 evaluated; 6 evidence-blocked; 0 unavailable. Player-prop analysis paused.'};
  const makeFeed=(ts,home=2.2)=>({generatedAt:ts,...(observedMode ? {quoteObservationVersion:1} : {}),events:[{id:'fixture',home:'Fixture Home',away:'Fixture Away',date:'2026-09-07T02:00:00Z',sport:{slug:'baseball'},league:{slug:'usa-mlb'},bookmakers:Object.fromEntries(['Bet365','DraftKings'].map(book=>[book,['ml','spread','totals'].map(marketKey=>{
    const sides=marketKey==='totals'?['over','under']:['home','away'];const line=marketKey==='ml'?null:marketKey==='spread'?-1.5:8.5;
    return {marketKey,updatedAt:observedMode ? new Date(Date.parse(ts)-3*60*60*1000).toISOString() : ts,...(observedMode ? {observedAt:ts} : {}),odds:[{...(line===null?{}:{hdp:line}),[sides[0]]:marketKey==='ml'?home:1.91,[sides[1]]:1.91,selectionKeys:Object.fromEntries(sides.map(side=>[side,`fixture|${marketKey}|${side}||${line??''}`]))}]};
  })]))}]});
  const feed=makeFeed(report.feedGeneratedAt),baseline=makeFeed('2026-09-07T00:08:00Z',2.0);
  const feedRaw=JSON.stringify(feed,null,2)+'\n',feedSha=hash(feedRaw),baselineSha=hash(JSON.stringify(baseline));
  write('data/live-odds.json',feedRaw);
  const oddsIndex={entries:[{generatedAt:baseline.generatedAt,snapshotBlobSha:baselineSha,indexedAtUtc:'2026-09-07T00:09:00Z'}]};
  const oddsRaw=JSON.stringify(oddsIndex,null,2)+'\n';write('data/history/odds-index.json',oddsRaw);hash(oddsRaw);
  write('run-history.json',{schema_version:2,runs:[],updated_at:''});
  const inventory=derivePrimarySelectionInventory(report,feed,policy);
  assert.equal(inventory.selections.length,6,'all six exact sides reach publication in both clock modes');
  const sidecar=read('data/history/research-fit/2026-09-05/late-182130.json');
  sidecar.reportReference={slot:report.slot,label:report.label,ts:report.ts,feedGeneratedAt:report.feedGeneratedAt,reportPath:'data/history/runs/2026-09-06/late-182130.json'};
  sidecar.provenance.feedBlobSha=feedSha;
  sidecar.primaryAnalysis={schema:1,feedGeneratedAt:feed.generatedAt,receipts:inventory.selections.map(selection=>({selectionId:selection.selectionId,quote:selection.quotes[0],state:'BLOCKED',blocker:{reason:'FAIR_MODEL_UNAVAILABLE',checkedAt:report.ts,missing:`Synthetic fixture ${selection.selectionId} has no model.`,impact:'No value assessment or wager.',attempts:[{eventId:'fixture',checkedAt:report.ts,url:'https://example.org/models/fixture',finding:`Synthetic ${selection.side} ${selection.marketDetail} model is absent.`}]}}))};
  const audit=sidecar.coverageAudit;audit.feedGeneratedAt=feed.generatedAt;audit.authorityBlobSha=authoritySha;
  audit.sports=Object.fromEntries(Object.entries(inventory.sports).map(([sport,row])=>[sport,{gamesInScope:row.gamesInScope,gamesEvaluated:row.gamesInScope,primary:{...row.primary,evaluated:0,blocked:row.primary.available},props:{state:'PAUSED_BY_SCOPE',returned:0,screened:0,seriousDeepReviewed:0,excludedByScope:0}}]));
  audit.availabilityLimitations=[];audit.totals={gamesInScope:1,gamesEvaluated:1,primaryRequired:6,primaryAvailable:6,primaryEvaluated:0,primaryBlocked:6,primaryUnavailable:0,propsReturned:0,propsScreened:0,seriousPropsDeepReviewed:0,propsExcludedByScope:0};
  audit.presentation={mode:'UNBOUNDED_ANALYSIS_OUTPUT',allEvaluatedPublished:true,fillerAdded:0};
  const save=()=>{write('input-report.json',report);write('input-sidecar.json',sidecar);};save();
  const inputBefore=fs.readFileSync(path.join(root,'input-report.json'),'utf8');
  assert.deepEqual(read(path.join(root,'input-sidecar.json')).primaryAnalysis.receipts,sidecar.primaryAnalysis.receipts,'candidate JSON staging preserves both quote clocks and receipt identities');
  let result=call('validate');assert.equal(result.status,0,result.stderr);assert.equal(fs.readFileSync(path.join(root,'input-report.json'),'utf8'),inputBefore);
  if(observedMode){
    const observedBefore=sidecar.primaryAnalysis.receipts[0].quote.quoteObservedAt;
    sidecar.primaryAnalysis.receipts[0].quote.quoteObservedAt=sidecar.primaryAnalysis.receipts[0].quote.quoteUpdatedAt;save();
    for(const command of ['validate','publish']){result=call(command);assert.notEqual(result.status,0);assert.match(result.stderr,/quote identity\/book\/line\/price\/time differs/,'candidate cannot substitute provider change time for observation provenance');}
    sidecar.primaryAnalysis.receipts[0].quote.quoteObservedAt=observedBefore;save();
  }
  const receipts=sidecar.primaryAnalysis.receipts;sidecar.primaryAnalysis.receipts=[];save();
  for(const command of ['validate','publish']){result=call(command);assert.notEqual(result.status,0);assert.match(result.stderr,/missing 6 required receipt/);}
  assert.ok(!fs.existsSync(path.join(root,'data/history/runs')),'rejected report cannot write history');
  sidecar.primaryAnalysis.receipts=receipts;report.coverageSummary={schema:1,selections:{evaluated:6}};save();
  result=call('publish');assert.notEqual(result.status,0);assert.match(result.stderr,/coverage summary does not reproduce/);
  delete report.coverageSummary;save();result=call('publish');assert.equal(result.status,0,result.stderr);
  const storedPath=path.join(root,sidecar.reportReference.reportPath),stored=read(storedPath),storedBefore=fs.readFileSync(storedPath,'utf8');
  assert.deepEqual(stored.coverageSummary.selections,{required:6,available:6,evaluated:0,blocked:6,unavailable:0});
  assert.equal(stored.coverageSummary.source.feedBlobSha,feedSha);
  assert.equal(stored.coverageSummary.source.feedGeneratedAt,feed.generatedAt);
  if(observedMode){
    assert.equal(stored.coverageSummary.source.quoteObservationVersion,1);
    assert.equal(stored.coverageSummary.source.quoteFreshnessClock,'observedAt');
    assert.equal(stored.coverageSummary.source.quoteMaxAgeMinutes,30);
    assert.equal(stored.coverageSummary.source.maxMarketAgeMinutes,90);
  }else{
    assert.ok(!Object.hasOwn(stored.coverageSummary.source,'quoteObservationVersion'));
    assert.ok(!Object.hasOwn(stored.coverageSummary.source,'quoteFreshnessClock'));
  }
  const persistedReceipts=read(path.join(root,'data/history/research-fit/2026-09-06/late-182130.json')).primaryAnalysis.receipts;
  assert.deepEqual(persistedReceipts,receipts,'published JSON keeps exact bound quote and observation provenance');
  for(const receipt of persistedReceipts){
    assert.equal(receipt.quote.quoteUpdatedAt,feed.events[0].bookmakers.Bet365[0].updatedAt);
    if(observedMode){
      assert.equal(receipt.quote.quoteObservedAt,feed.generatedAt);
      assert.ok(Date.parse(receipt.quote.quoteUpdatedAt)<Date.parse(receipt.quote.quoteObservedAt)-90*60000,'old change time remains preserved and does not invalidate a current observation');
    }else assert.ok(!Object.hasOwn(receipt.quote,'quoteObservedAt'));
  }
  assert.deepEqual(stored.counts,{bet:0,lean:0,wait:0,pass:0});assert.equal(stored.instrumentTelemetry.calculationVersion,3);
  assert.equal(stored.instrumentTelemetry.movement.comparableSelections,6);assert.equal(stored.instrumentTelemetry.pressure.reason,'NO_DIRECTIONAL_REFERENCE');
  result=call('publish');assert.equal(result.status,0,result.stderr);assert.equal(fs.readFileSync(storedPath,'utf8'),storedBefore,'repeat publication keeps original report');
  const legacyTarget=structuredClone(sidecar);legacyTarget.coverageAudit.presentation={target:12,targetIsSoft:true,overflowProtection:true,actionableSuppressedByTarget:0};write('input-sidecar.json',legacyTarget);
  result=call('publish');assert.notEqual(result.status,0);assert.match(result.stderr,/UNBOUNDED_ANALYSIS_OUTPUT|retired/,'new publication rejects retired target presentation receipts');
  save();
  result=call('verify');assert.equal(result.status,0,result.stderr);
  assert.equal(fs.readFileSync(storedPath,'utf8'),storedBefore,'issued unbounded report remains immutable under read-back verification');
  const laterPolicy=structuredClone(policy);laterPolicy.principles.evaluationOrder='SYNTHETIC_FUTURE_POLICY';
  write('data/major-sport-market-coverage-v1.json',laterPolicy);
  result=call('verify');assert.equal(result.status,0,result.stderr);
  assert.equal(fs.readFileSync(storedPath,'utf8'),storedBefore,'historical verification uses the original pinned policy content');
  result=call('publish');assert.notEqual(result.status,0);assert.match(result.stderr,/authorityBlobSha does not match current operational authority/,'new publication cannot substitute its old authority');
  const storedSidecarPath=path.join(root,'data/history/research-fit/2026-09-06/late-182130.json');
  const storedSidecar=read(storedSidecarPath),unresolvable=structuredClone(storedSidecar);
  if(observedMode){
    const wrongObservation=structuredClone(storedSidecar);
    wrongObservation.primaryAnalysis.receipts[0].quote.quoteObservedAt=wrongObservation.primaryAnalysis.receipts[0].quote.quoteUpdatedAt;
    write(path.relative(root,storedSidecarPath),wrongObservation);result=call('verify');
    assert.notEqual(result.status,0);assert.match(result.stderr,/quote identity\/book\/line\/price\/time differs/,'read-back rejects tampered observation provenance');
    write(path.relative(root,storedSidecarPath),storedSidecar);
  }
  unresolvable.coverageAudit.authorityBlobSha='f'.repeat(40);write(path.relative(root,storedSidecarPath),unresolvable);
  result=call('verify');assert.notEqual(result.status,0);assert.match(result.stderr,/Resolved coverage authority does not match pinned blob/,'missing policy object cannot silently use current policy');
  write(path.relative(root,storedSidecarPath),storedSidecar);
  stored.coverageSummary.selections.evaluated=6;write(sidecar.reportReference.reportPath,stored);
  result=call('verify');assert.notEqual(result.status,0);assert.match(result.stderr,/coverage summary does not reproduce/,'read-back catches misleading evaluated count');
  if(process.env.PRIMARY_REPORT_PREVIEW){write(sidecar.reportReference.reportPath,JSON.parse(storedBefore));fs.copyFileSync(storedPath,process.env.PRIMARY_REPORT_PREVIEW);}
  console.log(`PRIMARY REPORT PUBLICATION (${observedMode ? 'observation v1' : 'legacy'}): staged JSON and quote provenance verified; preflight/publish bypass rejected; six current selections, truthful coverage and meters; immutable retry, pinned policy replay, and read-back tamper checks pass.`);
}finally{fs.rmSync(root,{recursive:true,force:true});}

}

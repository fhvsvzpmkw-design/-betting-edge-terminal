import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {runCommand} from '../tools/report-run.mjs';
import {validateStagedBundle} from '../tools/extract-staged-report.mjs';
import {parseReportDocument} from '../tools/report-document-transport.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'producer-review-trace-'));
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');};
const receipt=(id,state)=>({selectionId:`MLB|${id}|full_game_moneyline|home`,quote:{eventId:id},state,
  ...(state==='EVALUATED'?{decision:{feed:{eventId:id},status:'PASS'}}:{blocker:{reason:'RESEARCH_INCOMPLETE',missing:'A real selection review remains pending in this synthetic fixture.'}})});
try{
  fs.mkdirSync(path.join(root,'data'),{recursive:true});fs.copyFileSync('data/main-schedule.json',path.join(root,'data/main-schedule.json'));
  const report={ts:new Date(Date.now()+60000).toISOString(),slot:'evening',feedGeneratedAt:new Date(Date.now()-60000).toISOString(),recs:[],counts:{bet:0,lean:0,wait:0,pass:0},risk:0,bankroll:100};
  const sidecar={schema:3,provenance:{canonicalSlot:4,feedBlobSha:'a'.repeat(40)},reportReference:{ts:report.ts,slot:report.slot,feedGeneratedAt:report.feedGeneratedAt},primaryAnalysis:{receipts:[receipt('reviewed','EVALUATED'),receipt('unfinished','BLOCKED')]}};
  const reportFile=path.join(root,'report.json'),sidecarFile=path.join(root,'sidecar.json');write(reportFile,report);write(sidecarFile,sidecar);
  const checkpoint='data/report-production/checkpoints/trace-test.json',file=path.join(root,checkpoint),base={root,checkpoint};
  let status=runCommand({...base,command:'start',report:reportFile,sidecar:sidecarFile});
  const prepareFixture=()=>{const state=parseReportDocument(fs.readFileSync(file),'REPORT_CHECKPOINT');state.phase='PREPARED';write(file,state);};
  prepareFixture();
  const passing=()=>({state:'PASS',receipts:[{gate:'synthetic producer execution fixture',state:'PASS'}]});
  assert.throws(()=>runCommand({...base,command:'freeze',expectedRevision:status.revision,pipeline:passing}),/Save an actual event review/,'an initial draft cannot skip straight to freeze');
  assert.equal(runCommand({...base,command:'status'}).phase,'PREPARED','failed freeze preserves the draft');
  assert.throws(()=>runCommand({...base,command:'checkpoint',report:reportFile,sidecar:sidecarFile,eventId:'wrong-event',expectedRevision:status.revision}),/not in the bound/);
  status=runCommand({...base,command:'checkpoint',report:reportFile,sidecar:sidecarFile,eventId:'unfinished',expectedRevision:status.revision});
  prepareFixture();
  assert.throws(()=>runCommand({...base,command:'freeze',expectedRevision:status.revision,pipeline:passing}),/Issued decision events lack saved reviews/,'reviewing a different event cannot clear issued decisions');
  status=runCommand({...base,command:'checkpoint',report:reportFile,sidecar:sidecarFile,eventId:'reviewed',expectedRevision:status.revision});
  assert.deepEqual(status.savedEventReviews,['unfinished','reviewed']);
  prepareFixture();
  status=runCommand({...base,command:'freeze',expectedRevision:status.revision,pipeline:passing});
  status=runCommand({...base,command:'stage',expectedRevision:status.revision,pipeline:passing});
  const bundle=parseReportDocument(fs.readFileSync(path.join(root,'data/history/staging/report-bundle.json')),'STAGED_REPORT');
  validateStagedBundle(bundle,{root});
  assert.equal(bundle.sidecar.primaryAnalysis.receipts[1].state,'BLOCKED','unfinished work stays separate from reviewed decisions');
  assert.throws(()=>validateStagedBundle({...bundle,producerExecution:undefined},{root}),/Save an actual event review/,'direct staging cannot bypass the producer check');
  const partial=structuredClone(bundle);partial.producerExecution.eventReviews=partial.producerExecution.eventReviews.filter(x=>x.eventId==='reviewed');
  validateStagedBundle(partial,{root}); // An unreviewed blocker never vetoes a reviewed decision.
  const allBlocked=structuredClone(partial);allBlocked.sidecar.primaryAnalysis.receipts[0].state='BLOCKED';
  validateStagedBundle(allBlocked,{root}); // Completed searches may genuinely yield no decisions.
  const empty=structuredClone(bundle);empty.sidecar.primaryAnalysis.receipts=[];delete empty.producerExecution;
  validateStagedBundle(empty,{root});
  const corrupt=structuredClone(partial);corrupt.producerExecution.eventReviews[0].eventId='wrong-event';
  assert.throws(()=>validateStagedBundle(corrupt,{root}),/Invalid saved/);
  console.log('PRODUCER EXECUTION: initial-draft skip and missing/wrong-event reviews rejected; reviewed partial, source-blocked and empty slates retained.');
}finally{fs.rmSync(root,{recursive:true,force:true});}

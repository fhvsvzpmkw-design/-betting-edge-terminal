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
  const sidecar={schema:3,provenance:{canonicalSlot:4,feedBlobSha:'a'.repeat(40)},reportReference:{ts:report.ts,slot:report.slot,feedGeneratedAt:report.feedGeneratedAt},primaryAnalysis:{receipts:[receipt('reviewed','EVALUATED'),receipt('unfinished','BLOCKED'),receipt('departed','EVALUATED')]}};
  const departedStart=new Date(Date.parse(report.ts)+30000).toISOString();
  sidecar.primaryAnalysis.receipts[2].decision.feed.eventDate=departedStart;
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
  status=runCommand({...base,command:'checkpoint',report:reportFile,sidecar:sidecarFile,eventId:'departed',expectedRevision:status.revision});
  const recoveredAt=new Date(Date.parse(report.ts)+60000).toISOString();
  assert.ok(Date.parse(departedStart)<Date.parse(recoveredAt),'the formerly reviewed event starts before recovery issuance');
  status=runCommand({...base,command:'retime',at:recoveredAt,expectedRevision:status.revision});
  const exported=runCommand({...base,command:'export',outputDir:path.join(os.tmpdir(),`producer-retime-${path.basename(root)}`)});
  const recoveredReportFile=path.join(exported.outputDir,'report.json'),recoveredSidecarFile=path.join(exported.outputDir,'sidecar.json');
  try{
    const recoveredSidecar=JSON.parse(fs.readFileSync(recoveredSidecarFile));
    recoveredSidecar.primaryAnalysis.receipts=recoveredSidecar.primaryAnalysis.receipts.filter(row=>row.quote.eventId!=='departed');
    write(recoveredSidecarFile,recoveredSidecar);
    status=runCommand({...base,command:'checkpoint',report:recoveredReportFile,sidecar:recoveredSidecarFile,eventId:'reviewed',expectedRevision:status.revision});
  }finally{fs.rmSync(exported.outputDir,{recursive:true,force:true});}
  assert.ok(parseReportDocument(fs.readFileSync(file),'REPORT_CHECKPOINT').events.some(event=>event.eventId==='departed'),'retiming preserves the original saved event review in checkpoint history');
  prepareFixture();
  status=runCommand({...base,command:'freeze',expectedRevision:status.revision,pipeline:passing});
  status=runCommand({...base,command:'stage',expectedRevision:status.revision,pipeline:passing});
  const bundle=parseReportDocument(fs.readFileSync(path.join(root,'data/history/staging/report-bundle.json')),'STAGED_REPORT');
  validateStagedBundle(bundle,{root});
  assert.deepEqual([...new Set(bundle.producerExecution.eventReviews.map(event=>event.eventId))],['unfinished','reviewed'],'the recovered candidate projects only real reviews for its remaining receipt events');
  assert.equal(bundle.sidecar.primaryAnalysis.receipts[1].state,'BLOCKED','unfinished work stays separate from reviewed decisions');
  assert.throws(()=>validateStagedBundle({...bundle,producerExecution:undefined},{root}),/Save an actual event review/,'direct staging cannot bypass the producer check');
  const partial=structuredClone(bundle);partial.producerExecution.eventReviews=partial.producerExecution.eventReviews.filter(x=>x.eventId==='reviewed');
  validateStagedBundle(partial,{root}); // An unreviewed blocker never vetoes a reviewed decision.
  const allBlocked=structuredClone(partial);allBlocked.sidecar.primaryAnalysis.receipts[0].state='BLOCKED';
  validateStagedBundle(allBlocked,{root}); // Completed searches may genuinely yield no decisions.
  const empty=structuredClone(bundle);empty.sidecar.primaryAnalysis.receipts=[];
  validateStagedBundle(empty,{root}); // A bound empty slate still retains its actual snapshot acceptance.
  delete empty.producerExecution;delete empty.report.oddsSnapshot;delete empty.sidecar.oddsSnapshot;
  validateStagedBundle(empty,{root});
  const corrupt=structuredClone(partial);corrupt.producerExecution.eventReviews[0].eventId='wrong-event';
  assert.throws(()=>validateStagedBundle(corrupt,{root}),/Invalid saved/);
  const future=structuredClone(partial);future.producerExecution.eventReviews[0].at=new Date(Date.parse(future.report.ts)+1).toISOString();
  assert.throws(()=>validateStagedBundle(future,{root}),/Invalid saved/,'a future review remains invalid after recovery trace projection');
  console.log('PRODUCER EXECUTION: retimed inventories preserve historical reviews and bind only remaining events; initial-draft skips and missing/wrong/future reviews rejected; reviewed partial, source-blocked and empty slates retained.');
}finally{fs.rmSync(root,{recursive:true,force:true});}

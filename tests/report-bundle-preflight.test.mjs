import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'report-bundle-preflight-'));
const tool=path.resolve('tools/report-publication.mjs');
const reportFile=path.join(root,'report.json'),sidecarFile=path.join(root,'sidecar.json');
const run=(command='validate')=>spawnSync(process.execPath,[tool,command,'--report',reportFile,'--sidecar',sidecarFile],{cwd:root,encoding:'utf8'});
const report={slot:'final_morning',label:'09:30 FINAL MORNING',ts:'2026-09-05T09:36:53.000-07:00',feedGeneratedAt:'2026-09-05T16:23:47.934Z',bankroll:100,risk:0,counts:{bet:0,lean:0,wait:0,pass:2},recs:[1,2].map(n=>({title:`Selection ${n}`,status:'PASS',hist:'No applicable historical prior.',contrary:'The quoted price does not reach the recorded threshold.'}))};
const sidecar={schema:3,reportReference:{slot:report.slot,label:report.label,ts:report.ts,feedGeneratedAt:report.feedGeneratedAt,reportPath:'data/history/runs/2026-09-05/final_morning-093653.json'},provenance:{productionContractVersion:'1.0',productionContractOperational:true,productionContractPath:'BETTING_EDGE_CONTRACT.md',productionContractBlobSha:'a'.repeat(40),feedBlobSha:'b'.repeat(40),researchLibraryVersion:'1.8',personnelSweepPath:'BETTING_EDGE_PERSONNEL_SWEEP.md',personnelSweepBlobSha:'c'.repeat(40)},recommendations:report.recs.map((r,i)=>({ordinal:i+1,title:r.title,status:r.status,displayText:r.hist,priorIds:[],synthesisIds:[],clusterIds:[],personnelRequired:false,personnelEvidence:null,waitQualification:null}))};
const write=()=>{fs.writeFileSync(reportFile,JSON.stringify(report));fs.writeFileSync(sidecarFile,JSON.stringify(sidecar));};
const snapshot=()=>Object.fromEntries(fs.readdirSync(root).sort().map(name=>[name,fs.readFileSync(path.join(root,name),'utf8')]));
try{
  write();
  const validBefore=snapshot();
  const valid=run();
  assert.equal(valid.status,0,valid.stderr);
  assert.match(valid.stdout,/READ ONLY; NOT ISSUED/);
  assert.deepEqual(snapshot(),validBefore,'preflight must not change either input or create an index/history');

  for(const r of report.recs)r.contrary='Normal pregame personnel, role and outcome variance prevents narrowing the distribution enough to justify the current price.';
  write();
  const invalidBefore=snapshot();
  const invalid=run();
  assert.notEqual(invalid.status,0);
  assert.match(invalid.stderr,/2 recommendation defect\(s\)/);
  assert.match(invalid.stderr,/recommendation 1 Selection 1/);
  assert.match(invalid.stderr,/recommendation 2 Selection 2/);
  assert.deepEqual(snapshot(),invalidBefore,'failed validation must preserve diagnostic inputs');
  const publisher=run('publish');
  assert.notEqual(publisher.status,0);
  assert.match(publisher.stderr,/cannot mark personnelRequired=false/,'publisher must retain the same hard check');
  assert.deepEqual(snapshot(),invalidBefore,'rejected publication must not write History');

  sidecar.recommendations[0].personnelRequired=true;
  write();
  const missingEvidence=run();
  assert.notEqual(missingEvidence.status,0);
  assert.match(missingEvidence.stderr,/requires personnelEvidence/,'turning the flag on cannot substitute for actual evidence');
  console.log('REPORT BUNDLE PREFLIGHT: PASS // READ ONLY + ALL DEFECTS + PUBLISHER PARITY + REQUIRED EVIDENCE');
}finally{fs.rmSync(root,{recursive:true,force:true});}

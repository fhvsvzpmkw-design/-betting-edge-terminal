import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {verifyIndex} from '../tools/report-publication.mjs';
import {runPipeline,CANDIDATE_GATE_TIMEOUT_MS,HISTORY_GATE_TIMEOUT_MS} from '../tools/report-pipeline.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'history-verification-'));
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value));};
try{
  const report={slot:'main',label:'08:00 MAIN',ts:'2026-08-12T08:00:00-07:00',feedGeneratedAt:'2026-08-12T14:55:00Z',bankroll:100,risk:0,counts:{bet:0,lean:0,wait:0,pass:0},recs:[]};
  const reportPath='data/history/runs/2026-08-12/main-080000.json';
  const sidecarPath='data/history/research-fit/2026-08-12/main-080000.json';
  const sidecar={schema:2,reportReference:{slot:report.slot,label:report.label,ts:report.ts,reportPath,feedGeneratedAt:report.feedGeneratedAt},recommendations:[]};
  const entry={id:`${report.ts}|${report.slot}`,date:'2026-08-12',slot:report.slot,label:report.label,ts:report.ts,feedGeneratedAt:report.feedGeneratedAt,path:reportPath,researchFitPath:sidecarPath,bankroll:100,risk:0,counts:report.counts,recCount:0};
  const index={updated_at:report.ts,runs:[entry]};
  write(path.join(root,'run-history.json'),index);write(path.join(root,reportPath),report);write(path.join(root,sidecarPath),sidecar);
  const originalRead=fs.readFileSync,reads=new Map();
  fs.readFileSync=function(file,...args){const key=String(file);reads.set(key,(reads.get(key)||0)+1);return originalRead.call(this,file,...args);};
  try{verifyIndex(root,{targetTs:report.ts});}finally{fs.readFileSync=originalRead;}
  assert.equal(reads.get(path.join(root,reportPath)),1,'valid indexed payload parsed once per complete verification');
  assert.equal(reads.get(path.join(root,sidecarPath)),1,'valid indexed sidecar parsed once per complete verification');
  const orphan=path.join(root,'data/history/runs/2026-08-12/main-080001.json');
  write(orphan,{...report,ts:'2026-08-12T08:00:01-07:00'});
  assert.throws(()=>verifyIndex(root),/Stored issued report is not indexed/);fs.unlinkSync(orphan);
  const orphanSidecar=path.join(root,'data/history/research-fit/2026-08-12/main-080001.json');
  write(orphanSidecar,{...sidecar,reportReference:{...sidecar.reportReference,ts:'2026-08-12T08:00:01-07:00'}});
  assert.throws(()=>verifyIndex(root),/Sidecar has no indexed report/);fs.unlinkSync(orphanSidecar);
  write(path.join(root,sidecarPath),{...sidecar,reportReference:{...sidecar.reportReference,label:'changed'}});
  assert.throws(()=>verifyIndex(root),/Sidecar label does not match report/);
  write(path.join(root,sidecarPath),sidecar);
  write(path.join(root,'run-history.json'),{...index,runs:[entry,{...entry}]});
  assert.throws(()=>verifyIndex(root),/Duplicate index ID/);
  write(path.join(root,'run-history.json'),index);
  assert.throws(()=>verifyIndex(root,{targetTs:'2026-08-12T09:00:00-07:00'}),/Target report is not indexed/);
  for(const mode of ['history','validate','readback']){
    const options=[];
    runPipeline({root,mode,report:path.join(root,reportPath),sidecar:path.join(root,sidecarPath),execute:(_file,_args,opts)=>{options.push(opts);return {status:0};}});
    assert.ok(options.every(opts=>opts.timeout===(mode==='history'?HISTORY_GATE_TIMEOUT_MS:CANDIDATE_GATE_TIMEOUT_MS)));
  }
  assert.throws(()=>runPipeline({root,mode:'history',execute:()=>({status:null,error:Object.assign(new Error('history deadline exceeded'),{code:'ETIMEDOUT'})})}),/history deadline exceeded/,'timeouts remain fail closed');
  console.log('History verification: one parse, orphan/tamper/duplicate detection and bounded gate deadlines PASS');
}finally{fs.rmSync(root,{recursive:true,force:true});}

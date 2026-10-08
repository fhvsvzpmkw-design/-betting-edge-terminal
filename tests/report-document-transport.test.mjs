import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {serializeReportDocument,parseReportDocument,TRANSPORT_FORMAT,MAX_DOCUMENT_BYTES} from '../tools/report-document-transport.mjs';
import {runCommand} from '../tools/report-run.mjs';
import {extractStagedReport,blobSha} from '../tools/extract-staged-report.mjs';

const small={schema:1,counts:{lean:1},recs:[{status:'LEAN',stake:'$0'}]};
assert.deepEqual(parseReportDocument(serializeReportDocument(small,'STAGED_REPORT'),'STAGED_REPORT'),small);
assert.equal(JSON.parse(serializeReportDocument(small,'STAGED_REPORT')).format,undefined,'small legacy JSON stays compatible');

// Use the actual 22-game morning checkpoint, including every source and blocker.
const original=JSON.parse(fs.readFileSync('data/report-production/checkpoints/20261008-final-morning-094758.json'));
const before=JSON.stringify(original),packed=serializeReportDocument(original,'REPORT_CHECKPOINT');
assert.equal(JSON.parse(packed).format,TRANSPORT_FORMAT);
assert.ok(Buffer.byteLength(packed)<1024*1024,'the actual full checkpoint must fit a sub-1 MiB transfer');
assert.deepEqual(parseReportDocument(packed,'REPORT_CHECKPOINT'),original);
assert.equal(JSON.stringify(original),before,'packing cannot change analytical content');
const envelope=JSON.parse(packed);
for(const change of [
  {sha256:'0'.repeat(64)}, {decodedBytes:envelope.decodedBytes+1},
  {decodedBytes:MAX_DOCUMENT_BYTES+1}, {data:envelope.data.slice(0,-8)},
  {data:'invalid-base64!'}, {encoding:'unknown'}, {format:'BETTING_EDGE_GZIP_JSON_V2'}
])assert.throws(()=>parseReportDocument(JSON.stringify({...envelope,...change}),'REPORT_CHECKPOINT'),/transport/);
assert.throws(()=>parseReportDocument(packed,'STAGED_REPORT'),/transport/);

const root=fs.mkdtempSync(path.join(os.tmpdir(),'large-report-transport-'));
const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const checkpoint='data/report-production/checkpoints/transport-test.json';
const file=path.join(root,checkpoint);
const passing=()=>({state:'PASS',receipts:[{gate:'transport-only fixture',state:'PASS'}]});
try{
  fs.mkdirSync(path.join(root,'data'),{recursive:true});
  fs.copyFileSync('data/main-schedule.json',path.join(root,'data/main-schedule.json'));
  fs.mkdirSync(path.dirname(file),{recursive:true});
  // Existing uncompressed, already frozen checkpoints must remain resumable.
  fs.writeFileSync(file,JSON.stringify(original,null,2)+'\n');
  assert.equal(runCommand({root,checkpoint,command:'status'}).phase,original.phase);
  fs.writeFileSync(file,packed);
  const resumed=runCommand({root,checkpoint,command:'status'});
  assert.deepEqual(resumed.counts,original.report.counts);
  assert.equal(resumed.research.available,132);
  assert.equal(resumed.research.evaluated,22);
  assert.equal(resumed.research.unfinished,44);

  // Isolate transfer/retry behavior; this test grants no analytical clearance.
  const draft=structuredClone(original);
  draft.phase='PREPARED';delete draft.frozen;delete draft.publication;
  fs.writeFileSync(file,serializeReportDocument(draft,'REPORT_CHECKPOINT'));
  let status=runCommand({root,checkpoint,command:'freeze',expectedRevision:draft.revision,pipeline:passing});
  status=runCommand({root,checkpoint,command:'stage',expectedRevision:status.revision,pipeline:passing});
  const stage=path.join(root,'data/history/staging/report-bundle.json');
  const frozen=fs.readFileSync(stage);
  assert.ok(frozen.length<1024*1024,'the full staging candidate must fit a sub-1 MiB transfer');
  assert.ok(fs.statSync(file).size<1024*1024,'a frozen checkpoint must keep a single full candidate copy and fit the same transfer limit');
  const bundle=parseReportDocument(frozen,'STAGED_REPORT');
  assert.deepEqual(bundle.report,original.report);
  assert.deepEqual(bundle.sidecar,original.sidecar);
  const revision=status.revision;
  assert.throws(()=>runCommand({root,checkpoint,command:'stage',expectedRevision:revision,pipeline:()=>{throw Error('temporary publication failure');}}),/temporary publication failure/);
  assert.equal(runCommand({root,checkpoint,command:'status'}).revision,revision,'failed stage preserves saved revision');
  assert.deepEqual(fs.readFileSync(stage),frozen,'failed retry cannot replace staging bytes');
  status=runCommand({root,checkpoint,command:'stage',expectedRevision:revision,pipeline:passing});
  assert.deepEqual(fs.readFileSync(stage),frozen,'successful retry keeps the exact original compressed bytes');
  assert.equal(blobSha(frozen),status.frozen.blobSha);

  git(['init','-q']);git(['config','user.name','Transport Test']);git(['config','user.email','transport@example.invalid']);
  git(['add','.']);git(['commit','-qm','candidate A']);const first=git(['rev-parse','HEAD']);
  const newer=structuredClone(bundle);newer.report.bankroll+=1;
  fs.writeFileSync(stage,serializeReportDocument(newer,'STAGED_REPORT'));
  git(['add','.']);git(['commit','-qm','candidate B']);
  const outputDir=path.join(root,'extracted');
  assert.equal(extractStagedReport({root,commit:first,outputDir}).blobSha,blobSha(frozen));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outputDir,'report.json'))),original.report,'queued publication must extract the exact triggering candidate');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(outputDir,'sidecar.json'))),original.sidecar,'all research receipts and sources survive extraction');
  const tampered=parseReportDocument(fs.readFileSync(file),'REPORT_CHECKPOINT');
  tampered.report.recs=[];
  fs.writeFileSync(file,serializeReportDocument(tampered,'REPORT_CHECKPOINT'));
  assert.throws(()=>runCommand({root,checkpoint,command:'stage',expectedRevision:status.revision,pipeline:passing}),/Frozen candidate bytes changed/);
  console.log(JSON.stringify({state:'PASS',checkpointDecodedBytes:Buffer.byteLength(before),checkpointTransferBytes:Buffer.byteLength(packed),stagingTransferBytes:frozen.length,selectionsPreserved:132,decisionsPreserved:22,exactRetry:true,exactTriggerExtraction:true}));
}finally{fs.rmSync(root,{recursive:true,force:true});}

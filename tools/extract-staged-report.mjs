#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {scheduleMetadataForReport} from './main-schedule.mjs';
import {parseReportDocument} from './report-document-transport.mjs';
export const blobSha=bytes=>createHash('sha1').update(`blob ${Buffer.byteLength(bytes)}\0`).update(bytes).digest('hex');
export function validateStagedBundle(bundle,{root=process.cwd()}={}){
  if(bundle?.schema!==1||bundle.state!=='READY'||!bundle.report||bundle.sidecar?.schema!==3)throw new Error('Invalid staged report envelope');
  const {report,sidecar}=bundle;
  const {canonicalSlot}=scheduleMetadataForReport(report,root);
  if(!Number.isFinite(Date.parse(report.ts))||sidecar.provenance?.canonicalSlot!==canonicalSlot)throw new Error('Invalid staged report identity');
  if(bundle.candidateId!==`${report.ts}|${canonicalSlot}`||![String(canonicalSlot),'FROZEN'].includes(String(bundle.phase)))throw new Error('Staged candidateId/phase differ from report identity');
  if(sidecar.reportReference?.ts!==report.ts||sidecar.reportReference?.feedGeneratedAt!==report.feedGeneratedAt)throw new Error('Staged report/sidecar identity mismatch');
  return bundle;
}
export function extractStagedReport({root=process.cwd(),commit,outputDir}){
  if(!/^[a-f0-9]{40}$/i.test(commit||''))throw new Error('Exact triggering commit SHA required');
  const bytes=execFileSync('git',['show',`${commit}:data/history/staging/report-bundle.json`],{cwd:root,maxBuffer:64*1024*1024});
  const bundle=validateStagedBundle(parseReportDocument(bytes,'STAGED_REPORT'),{root});
  fs.mkdirSync(outputDir,{recursive:true});
  for(const key of ['report','sidecar'])fs.writeFileSync(path.join(outputDir,`${key}.json`),JSON.stringify(bundle[key],null,2)+'\n');
  return {commit,candidateId:bundle.candidateId,blobSha:blobSha(bytes),bytes:bytes.length};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{console.log(JSON.stringify(extractStagedReport({commit:process.env.CANDIDATE_COMMIT,outputDir:process.env.CANDIDATE_DIR||'/tmp'})));}
  catch(error){console.error(error.message);process.exitCode=1;}
}

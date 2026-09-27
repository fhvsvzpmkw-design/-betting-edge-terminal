#!/usr/bin/env node
// One validation sequence for the producer, publisher, retries and read-back.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export const NORMALIZERS = Object.freeze([
  ['report-sidecar-contract.mjs','normalize'],
  ['pinnacle-benchmark-publication-gate.mjs','normalize']
]);
export const CANDIDATE_GATES = Object.freeze([
  ['personnel-semantic-gate.mjs','validate'],
  ['major-sport-market-coverage-gate.mjs','validate'],
  ['report-evidence-gate.mjs','validate'],
  ['report-event-eligibility.mjs','validate'],
  ['report-sidecar-contract.mjs','check'],
  ['core-assessment-trace-gate.mjs','validate'],
  ['core-v14-publication-gate.mjs','validate'],
  ['pinnacle-benchmark-publication-gate.mjs','validate'],
  ['selection-continuity.mjs','audit'],
  ['moneyline-lineage.mjs','audit'],
  ['selection-availability.mjs','audit'],
  ['spread-lineage.mjs','audit'],
  ['total-lineage.mjs','audit'],
  ['report-publication.mjs','validate']
]);
export function runPipeline({root=process.cwd(), report, sidecar, mode='validate', execute=spawnSync}={}) {
  root=path.resolve(root);
  if (!['normalize','validate','readback','history'].includes(mode)) throw new Error('Unknown pipeline mode');
  const history=[['report-publication.mjs','verify'],['core-v14-publication-gate.mjs','verify-history'],['pinnacle-benchmark-publication-gate.mjs','validate-runtime']];
  const gates=mode==='history'?history:mode==='normalize'?NORMALIZERS:mode==='readback'?[...CANDIDATE_GATES,['vigscope-meter-telemetry-gate.mjs','validate']]:CANDIDATE_GATES;
  if (mode!=='history' && (!report || !sidecar)) throw new Error('Pipeline requires report and sidecar files');
  const files=mode==='history'?[]:[path.resolve(report),path.resolve(sidecar)];
  if(mode==='normalize')for(const file of files){
    const relative=path.relative(root,fs.realpathSync(file)).split(path.sep).join('/');
    if(/^(data\/history\/(runs|research-fit|staging)\/|run-history\.json$)/.test(relative))throw new Error('Normalize accepts draft files only');
  }
  const before=files.map(file=>fs.readFileSync(file));
  const receipts=[];
  for (const [tool,command] of gates) {
    const started=Date.now();
    const args=[path.join(root,'tools',tool),command];
    if (mode!=='history') args.push('--report',files[0],'--sidecar',files[1]);
    const result=execute(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024,timeout:120000});
    const receipt={gate:tool,command,state:result.status===0?'PASS':'FAIL',durationMs:Date.now()-started};
    receipts.push(receipt);
    if (result.status!==0) {
      const error=new Error(`${tool}: ${String(result.stderr||result.stdout||result.error||'failed').slice(-6000)}`);
      error.receipts=receipts; throw error;
    }
  }
  if (mode!=='normalize') for (let i=0;i<files.length;i++) if (!before[i].equals(fs.readFileSync(files[i]))) throw new Error('Read-only validation mutated candidate bytes');
  return {schema:1,mode,state:'PASS',receipts};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    const [mode,...args]=process.argv.slice(2), options={mode};
    for(let i=0;i<args.length;i+=2){
      if(!['--root','--report','--sidecar'].includes(args[i])||!args[i+1])throw new Error('Invalid pipeline arguments');
      options[args[i].slice(2)]=args[i+1];
    }
    console.log(JSON.stringify(runPipeline(options),null,2));
  }catch(error){console.error(JSON.stringify({state:'FAIL',error:error.message,receipts:error.receipts||[]}));process.exitCode=1;}
}

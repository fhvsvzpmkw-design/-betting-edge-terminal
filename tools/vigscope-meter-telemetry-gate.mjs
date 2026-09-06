#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {
  attachPublisherInstrumentTelemetry,
  latestPriorSameDay,
  usesResilientMeterTelemetry,
  usesPrimaryMarketTelemetry,
  VIG_METER_TELEMETRY_AUTHORITY,
  VIG_METER_TELEMETRY_SCHEMA
} from './vigscope-meter-telemetry.mjs';

export const VIG_METER_TELEMETRY_CUTOVER='2026-09-02T08:43:00-07:00';
const CUTOVER_MS=Date.parse(VIG_METER_TELEMETRY_CUTOVER);

function die(message){throw new Error(message);}
function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function writeJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n','utf8');}
function sameJson(left,right){return JSON.stringify(left)===JSON.stringify(right);}
function parseArgs(argv){
  const [command,...rest]=argv;
  const args={command};
  for(let i=0;i<rest.length;i++){
    const token=rest[i];
    if(!token.startsWith('--')) die(`Unexpected argument: ${token}`);
    const key=token.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
    const next=rest[i+1];
    if(next&&!next.startsWith('--')){args[key]=next;i++;}
    else args[key]=true;
  }
  return args;
}
function requireTimestamp(value,label){
  const ms=Date.parse(value);
  if(!Number.isFinite(ms)) die(`${label} must be a valid timestamp`);
  return ms;
}
function loadIndex(root){
  const index=readJson(path.join(root,'run-history.json'));
  if(!index||!Array.isArray(index.runs)) die('run-history.json must contain a runs array');
  return index;
}

export function validateStoredInstrumentTelemetry({root,report,sidecar,index=null}={}){
  if(!root||!report||!sidecar) die('validateStoredInstrumentTelemetry requires root, report and sidecar');
  const reportMs=requireTimestamp(report.ts,'report.ts');
  if(reportMs<CUTOVER_MS){
    return {state:'HISTORICAL_EXEMPT',cutover:VIG_METER_TELEMETRY_CUTOVER,reportTs:report.ts};
  }

  if(!report.instrumentTelemetry||typeof report.instrumentTelemetry!=='object'||Array.isArray(report.instrumentTelemetry)){
    die(`Post-cutover report ${report.ts} is missing instrumentTelemetry`);
  }
  if(report.instrumentTelemetry.authority!==VIG_METER_TELEMETRY_AUTHORITY){
    die(`Post-cutover report ${report.ts} has invalid instrumentTelemetry authority`);
  }
  if(report.instrumentTelemetry.schema!==VIG_METER_TELEMETRY_SCHEMA){
    die(`Post-cutover report ${report.ts} has invalid instrumentTelemetry schema`);
  }
  const feedBlobSha=sidecar?.provenance?.feedBlobSha;
  if(!/^[0-9a-f]{40}$/i.test(String(feedBlobSha||''))){
    die(`Post-cutover report ${report.ts} sidecar is missing a valid feedBlobSha`);
  }

  const historyIndex=index||loadIndex(root);
  const prior=latestPriorSameDay(historyIndex,report,root);
  const expectedReport=structuredClone(report);
  delete expectedReport.instrumentTelemetry;
  const resilient=usesResilientMeterTelemetry(report);
  const primaryMarket=usesPrimaryMarketTelemetry(report);
  const calculationVersion=primaryMarket?3:2;
  if(resilient&&report.instrumentTelemetry.calculationVersion!==calculationVersion)die(`Future report requires meter calculation version ${calculationVersion}`);
  const expected=attachPublisherInstrumentTelemetry({root,index:historyIndex,report:expectedReport,sidecar,replaySource:resilient?report.instrumentTelemetry.source:null});

  if((prior||resilient)&&expected?.source?.state!=='PINNED'){
    die(`Post-cutover report ${report.ts} has a prior same-day run but pinned meter telemetry could not be reconstructed (${expected?.source?.reason||'UNKNOWN'})`);
  }
  if(!resilient&&!prior&&expected?.source?.reason!=='NO_PRIOR_SAME_DAY_RUN'){
    die(`First same-day post-cutover report ${report.ts} must be explicitly unmeasured for NO_PRIOR_SAME_DAY_RUN`);
  }
  if(!sameJson(report.instrumentTelemetry,expectedReport.instrumentTelemetry)){
    die(`Post-cutover report ${report.ts} instrumentTelemetry does not reproduce from its pinned sources`);
  }

  return {
    state:'VALID',
    cutover:VIG_METER_TELEMETRY_CUTOVER,
    reportTs:report.ts,
    priorRunTs:prior?.report?.ts||null,
    sourceState:expected.source.state,
    movementState:expected.movement.state,
    heatState:expected.heat.state,
    pressureState:expected.pressure.state,
    agreementState:expected.agreement.state
  };
}

function validateFiles({root=process.cwd(),reportFile,sidecarFile}={}){
  if(!reportFile||!sidecarFile) die('validate requires --report FILE and --sidecar FILE');
  const report=readJson(path.resolve(root,reportFile));
  const sidecar=readJson(path.resolve(root,sidecarFile));
  return validateStoredInstrumentTelemetry({root:path.resolve(root),report,sidecar});
}

function selfTest(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'vigscope-meter-gate-'));
  try{
    const index={schema_version:2,runs:[]};
    writeJson(path.join(root,'run-history.json'),index);
    const sidecar={provenance:{feedBlobSha:'1111111111111111111111111111111111111111'}};

    const historical={ts:'2026-09-02T08:07:00-07:00',recs:[],feedGeneratedAt:'2026-09-02T15:00:00.000Z'};
    const historicalResult=validateStoredInstrumentTelemetry({root,report:historical,sidecar,index});
    assert.equal(historicalResult.state,'HISTORICAL_EXEMPT');

    const current={ts:'2026-09-02T09:30:00-07:00',recs:[],feedGeneratedAt:'2026-09-02T16:25:00.000Z'};
    assert.throws(()=>validateStoredInstrumentTelemetry({root,report:current,sidecar,index}),/missing instrumentTelemetry/i);

    const withTelemetry=structuredClone(current);
    attachPublisherInstrumentTelemetry({root,index,report:withTelemetry,sidecar});
    const valid=validateStoredInstrumentTelemetry({root,report:withTelemetry,sidecar,index});
    assert.equal(valid.state,'VALID');
    assert.equal(valid.sourceState,'UNAVAILABLE');

    const tampered=structuredClone(withTelemetry);
    tampered.instrumentTelemetry.pressure.rawValue=99;
    assert.throws(()=>validateStoredInstrumentTelemetry({root,report:tampered,sidecar,index}),/does not reproduce/i);

    console.log('VIGSCOPE METER TELEMETRY GATE SELF-TEST OK');
  }finally{
    fs.rmSync(root,{recursive:true,force:true});
  }
}

function main(){
  const args=parseArgs(process.argv.slice(2));
  if(args.command==='self-test'){selfTest();return;}
  if(args.command==='validate'){
    const result=validateFiles({root:args.root||process.cwd(),reportFile:args.report,sidecarFile:args.sidecar});
    console.log(`VIGSCOPE METER TELEMETRY GATE ${result.state} ${result.reportTs} prior=${result.priorRunTs||'NONE'} source=${result.sourceState||'EXEMPT'}`);
    return;
  }
  die('Usage: vigscope-meter-telemetry-gate.mjs self-test | validate --report FILE --sidecar FILE [--root DIR]');
}

try{main();}
catch(error){console.error(`VIGSCOPE METER TELEMETRY GATE ERROR: ${error.message}`);process.exit(1);}

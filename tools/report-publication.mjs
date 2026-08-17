#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const STRICT_BUNDLE_FROM = Date.parse('2026-08-17T15:15:00-07:00');
const SLOT_CODES = Object.freeze({open:'o', main:'m', final_morning:'f', evening:'e', late:'l'});
const STATUS_KEYS = Object.freeze(['bet','lean','wait','pass']);
const SHA40 = /^[0-9a-f]{40}$/i;

function die(message){
  throw new Error(message);
}
function assert(condition, message){
  if(!condition) die(message);
}
function parseArgs(argv){
  const [command, ...rest] = argv;
  const args = {command};
  for(let i=0;i<rest.length;i++){
    const token = rest[i];
    if(!token.startsWith('--')) die(`Unexpected argument: ${token}`);
    const key = token.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
    const next = rest[i+1];
    if(next && !next.startsWith('--')){args[key]=next;i++;}
    else args[key]=true;
  }
  return args;
}
function readJson(file){
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}
  catch(error){die(`Cannot parse JSON ${file}: ${error.message}`);}
}
function jsonText(value){return JSON.stringify(value,null,2)+'\n';}
function normalizedJson(value){return JSON.stringify(value);}
function ensureDir(file){fs.mkdirSync(path.dirname(file),{recursive:true});}
function writeAtomic(file,text){
  ensureDir(file);
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp,text,'utf8');
  fs.renameSync(temp,file);
}
function writeImmutableJson(file,value,label){
  if(fs.existsSync(file)){
    const existing = readJson(file);
    assert(normalizedJson(existing)===normalizedJson(value),`${label} already exists with different content: ${file}`);
    return false;
  }
  writeAtomic(file,jsonText(value));
  return true;
}
function validTimestamp(value,label){
  assert(typeof value==='string' && value.length>=20,`${label} must be an ISO timestamp`);
  assert(Number.isFinite(Date.parse(value)),`${label} is not parseable: ${value}`);
}
function reportDate(ts){return ts.slice(0,10);}
function reportClock(ts){
  const match = ts.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2}):(\d{2})/);
  assert(match,`run.ts must include HH:MM:SS: ${ts}`);
  return `${match[1]}${match[2]}${match[3]}`;
}
function expectedPaths(report){
  const date = reportDate(report.ts);
  const stem = `${report.slot}-${reportClock(report.ts)}`;
  return {
    reportPath:`data/history/runs/${date}/${stem}.json`,
    sidecarPath:`data/history/research-fit/${date}/${stem}.json`
  };
}
function shortId(report){
  const match = report.ts.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  assert(match,`Cannot derive short ID from ${report.ts}`);
  return `${match[1].slice(2)}${match[2]}${match[3]}${SLOT_CODES[report.slot]}${match[4]}${match[5]}${match[6]}`;
}
function actualCounts(recs){
  const counts = {bet:0,lean:0,wait:0,pass:0};
  for(const [index,rec] of recs.entries()){
    const status = String(rec?.status||'').toLowerCase();
    assert(STATUS_KEYS.includes(status),`Recommendation ${index+1} has invalid status: ${rec?.status}`);
    counts[status]++;
  }
  return counts;
}
function validateReport(report){
  assert(report && typeof report==='object' && !Array.isArray(report),'Report must be a JSON object');
  assert(Object.hasOwn(SLOT_CODES,report.slot),`Invalid report slot: ${report.slot}`);
  assert(typeof report.label==='string' && report.label.trim(), 'Report label is required');
  validTimestamp(report.ts,'run.ts');
  validTimestamp(report.feedGeneratedAt,'feedGeneratedAt');
  assert(reportDate(report.ts)===report.ts.slice(0,10),'Report date derivation failed');
  assert(Number.isFinite(report.bankroll),'Report bankroll must be numeric');
  assert(Number.isFinite(report.risk) && report.risk>=0,'Report risk must be a non-negative number');
  assert(report.counts && typeof report.counts==='object','Report counts are required');
  assert(Array.isArray(report.recs),'Report recs must be an array');
  const calculated = actualCounts(report.recs);
  for(const key of STATUS_KEYS){
    assert(Number.isInteger(report.counts[key]) && report.counts[key]>=0,`Report counts.${key} must be a non-negative integer`);
    assert(report.counts[key]===calculated[key],`Report counts.${key}=${report.counts[key]} does not match recommendations=${calculated[key]}`);
  }
  return report;
}
function validateSidecar(sidecar,report,reportPath,{strict=false}={}){
  assert(sidecar && typeof sidecar==='object' && !Array.isArray(sidecar),'Sidecar must be a JSON object');
  assert(sidecar.schema===2 || sidecar.schema===3,`Unsupported sidecar schema: ${sidecar.schema}`);
  const ref = sidecar.reportReference;
  assert(ref && typeof ref==='object','Sidecar reportReference is required');
  assert(ref.slot===report.slot,'Sidecar slot does not match report');
  assert(ref.label===report.label,'Sidecar label does not match report');
  assert(ref.ts===report.ts,'Sidecar ts does not match report');
  assert(ref.reportPath===reportPath,'Sidecar reportPath does not match report path');
  assert(ref.feedGeneratedAt===report.feedGeneratedAt,'Sidecar feedGeneratedAt does not match report');
  assert(Array.isArray(sidecar.recommendations),'Sidecar recommendations must be an array');

  if(sidecar.schema===3 || strict){
    assert(sidecar.schema===3,'Strict bundle publication requires schema 3');
    const provenance = sidecar.provenance;
    assert(provenance && typeof provenance==='object','Schema-3 provenance is required');
    assert(provenance.productionContractVersion==='0.9','Schema-3 productionContractVersion must be 0.9');
    assert(provenance.productionContractOperational===true,'Schema-3 production contract must be operational');
    assert(provenance.productionContractPath==='BETTING_EDGE_CONTRACT.md','Schema-3 production contract path is invalid');
    assert(SHA40.test(String(provenance.productionContractBlobSha||'')),'Schema-3 productionContractBlobSha must be a Git SHA');
    assert(SHA40.test(String(provenance.feedBlobSha||'')),'Schema-3 feedBlobSha must be a Git SHA');
    assert(typeof provenance.researchLibraryVersion==='string' && provenance.researchLibraryVersion,'Schema-3 researchLibraryVersion is required');
    assert(sidecar.recommendations.length===report.recs.length,'Sidecar recommendation count does not match report');
    for(let i=0;i<report.recs.length;i++){
      const item = sidecar.recommendations[i];
      const rec = report.recs[i];
      assert(item && typeof item==='object',`Sidecar recommendation ${i+1} is invalid`);
      assert(item.ordinal===i+1,`Sidecar recommendation ${i+1} has invalid ordinal`);
      assert(item.title===rec.title,`Sidecar recommendation ${i+1} title does not match report`);
      assert(item.status===rec.status,`Sidecar recommendation ${i+1} status does not match report`);
      assert(item.displayText===rec.hist,`Sidecar recommendation ${i+1} displayText does not match report hist`);
      assert(Array.isArray(item.priorIds),`Sidecar recommendation ${i+1} priorIds must be an array`);
      assert(Array.isArray(item.synthesisIds),`Sidecar recommendation ${i+1} synthesisIds must be an array`);
      assert(Array.isArray(item.clusterIds),`Sidecar recommendation ${i+1} clusterIds must be an array`);
    }
  }
  return sidecar;
}
function buildIndexEntry(report,sidecar,paths){
  return {
    id:`${report.ts}|${report.slot}`,
    date:reportDate(report.ts),
    slot:report.slot,
    label:report.label,
    ts:report.ts,
    feedGeneratedAt:report.feedGeneratedAt,
    path:paths.reportPath,
    bankroll:report.bankroll,
    risk:report.risk,
    counts:report.counts,
    recCount:report.recs.length,
    researchFitPath:paths.sidecarPath,
    feedBlobSha:sidecar.provenance.feedBlobSha,
    researchLibraryVersion:sidecar.provenance.researchLibraryVersion
  };
}
function entryMatches(existing,expected){
  for(const key of Object.keys(expected)){
    if(normalizedJson(existing[key])!==normalizedJson(expected[key])) return false;
  }
  return true;
}
function loadIndex(root){
  const file = path.join(root,'run-history.json');
  const index = readJson(file);
  assert(index && typeof index==='object' && Array.isArray(index.runs),'run-history.json must contain a runs array');
  return {file,index};
}
function publish(root,reportFile,sidecarFile){
  const report = validateReport(readJson(reportFile));
  const paths = expectedPaths(report);
  const sidecar = validateSidecar(readJson(sidecarFile),report,paths.reportPath,{strict:true});
  const reportAbs = path.join(root,paths.reportPath);
  const sidecarAbs = path.join(root,paths.sidecarPath);
  const reportCreated = writeImmutableJson(reportAbs,report,'Issued report');
  const sidecarCreated = writeImmutableJson(sidecarAbs,sidecar,'Research Fit sidecar');

  const {file:indexFile,index} = loadIndex(root);
  const expected = buildIndexEntry(report,sidecar,paths);
  const sameId = index.runs.filter(entry=>entry.id===expected.id);
  assert(sameId.length<=1,`run-history.json contains duplicate ID ${expected.id}`);
  const samePath = index.runs.filter(entry=>entry.path===expected.path && entry.id!==expected.id);
  assert(samePath.length===0,`Report path is already indexed to another run: ${expected.path}`);
  let indexChanged = false;
  if(sameId.length===1){
    assert(entryMatches(sameId[0],expected),`Existing index entry conflicts with report bundle: ${expected.id}`);
  }else{
    index.runs.push(expected);
    index.runs.sort((a,b)=>String(a.ts).localeCompare(String(b.ts)));
    indexChanged = true;
  }
  const newest = index.runs.reduce((max,entry)=>String(entry.ts)>max?String(entry.ts):max,'');
  if(index.updated_at!==newest){index.updated_at=newest;indexChanged=true;}
  if(indexChanged) writeAtomic(indexFile,jsonText(index));

  verifyIndex(root,{targetTs:report.ts});
  emitOutputs({
    report_ts:report.ts,
    report_path:paths.reportPath,
    sidecar_path:paths.sidecarPath,
    short_id:shortId(report),
    changed:String(reportCreated||sidecarCreated||indexChanged)
  });
  console.log(`REPORT BUNDLE OK ${shortId(report)} ${paths.reportPath}`);
}
function walkJson(dir){
  if(!fs.existsSync(dir)) return [];
  const found=[];
  for(const item of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,item.name);
    if(item.isDirectory()) found.push(...walkJson(full));
    else if(item.isFile() && item.name.endsWith('.json')) found.push(full);
  }
  return found;
}
function rel(root,file){return path.relative(root,file).split(path.sep).join('/');}
function verifyIndex(root,{targetTs}={}){
  const {index} = loadIndex(root);
  const ids = new Set(), paths = new Set(), shortIds = new Set();
  let targetFound = !targetTs;
  for(const entry of index.runs){
    assert(entry && typeof entry==='object','Index entry must be an object');
    assert(!ids.has(entry.id),`Duplicate index ID: ${entry.id}`); ids.add(entry.id);
    assert(!paths.has(entry.path),`Duplicate report path in index: ${entry.path}`); paths.add(entry.path);
    const reportAbs = path.join(root,entry.path);
    assert(fs.existsSync(reportAbs),`Indexed report is missing: ${entry.path}`);
    const report = validateReport(readJson(reportAbs));
    const expected = expectedPaths(report);
    assert(entry.path===expected.reportPath,`Indexed path does not match report timestamp/slot: ${entry.path}`);
    assert(entry.id===`${report.ts}|${report.slot}`,`Index ID does not match report: ${entry.id}`);
    assert(entry.date===reportDate(report.ts),`Index date does not match report: ${entry.id}`);
    assert(entry.slot===report.slot,`Index slot does not match report: ${entry.id}`);
    assert(entry.label===report.label,`Index label does not match report: ${entry.id}`);
    assert(entry.ts===report.ts,`Index ts does not match report: ${entry.id}`);
    assert(entry.feedGeneratedAt===report.feedGeneratedAt,`Index feedGeneratedAt does not match report: ${entry.id}`);
    assert(entry.bankroll===report.bankroll,`Index bankroll does not match report: ${entry.id}`);
    assert(entry.risk===report.risk,`Index risk does not match report: ${entry.id}`);
    assert(normalizedJson(entry.counts)===normalizedJson(report.counts),`Index counts do not match report: ${entry.id}`);
    assert(entry.recCount===report.recs.length,`Index recCount does not match report: ${entry.id}`);
    const sid=shortId(report);
    assert(!shortIds.has(sid),`Duplicate deterministic short ID: ${sid}`); shortIds.add(sid);

    const strict = Date.parse(report.ts)>=STRICT_BUNDLE_FROM;
    if(strict) assert(entry.researchFitPath===expected.sidecarPath,`Post-cutover run is missing exact researchFitPath: ${entry.id}`);
    if(entry.researchFitPath){
      assert(entry.researchFitPath===expected.sidecarPath,`Sidecar path does not match report timestamp/slot: ${entry.id}`);
      const sidecarAbs=path.join(root,entry.researchFitPath);
      assert(fs.existsSync(sidecarAbs),`Indexed sidecar is missing: ${entry.researchFitPath}`);
      const sidecar=validateSidecar(readJson(sidecarAbs),report,entry.path,{strict});
      if(sidecar.provenance?.feedBlobSha && entry.feedBlobSha){
        assert(entry.feedBlobSha===sidecar.provenance.feedBlobSha,`Index feedBlobSha does not match sidecar: ${entry.id}`);
      }
      if(sidecar.provenance?.researchLibraryVersion && entry.researchLibraryVersion){
        assert(entry.researchLibraryVersion===sidecar.provenance.researchLibraryVersion,`Index researchLibraryVersion does not match sidecar: ${entry.id}`);
      }
    }
    if(report.ts===targetTs) targetFound=true;
  }
  assert(targetFound,`Target report is not indexed: ${targetTs}`);

  const payloadFiles=walkJson(path.join(root,'data/history/runs'));
  for(const file of payloadFiles){
    const report=validateReport(readJson(file));
    const reportPath=rel(root,file);
    const entry=index.runs.find(item=>item.id===`${report.ts}|${report.slot}`);
    assert(entry,`Stored issued report is not indexed: ${reportPath}`);
    assert(entry.path===reportPath,`Stored issued report index path mismatch: ${reportPath}`);
  }
  const sidecarFiles=walkJson(path.join(root,'data/history/research-fit'));
  for(const file of sidecarFiles){
    const sidecar=readJson(file);
    const ref=sidecar.reportReference;
    assert(ref && typeof ref.ts==='string' && typeof ref.slot==='string',`Sidecar has invalid reportReference: ${rel(root,file)}`);
    const entry=index.runs.find(item=>item.id===`${ref.ts}|${ref.slot}`);
    assert(entry,`Sidecar has no indexed report: ${rel(root,file)}`);
    assert(entry.researchFitPath===rel(root,file),`Sidecar is not linked by the matching index entry: ${rel(root,file)}`);
  }
  const newest=index.runs.reduce((max,entry)=>String(entry.ts)>max?String(entry.ts):max,'');
  assert(index.updated_at===newest,`run-history.json updated_at=${index.updated_at} does not match newest run=${newest}`);
  console.log(`REPORT HISTORY VERIFY OK ${index.runs.length} runs${targetTs?` target=${targetTs}`:''}`);
}

function selfTest(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'betting-edge-report-publication-'));
  try{
    writeAtomic(path.join(root,'run-history.json'),jsonText({
      schema_version:2,
      terminal_version:'1.3',
      timezone:'America/Vancouver',
      updated_at:'',
      storage:{},
      schedule:[],
      runs:[]
    }));
    const report={
      slot:'evening',
      label:'15:15 EVENING',
      ts:'2026-08-17T15:15:01-07:00',
      bankroll:450.1,
      risk:0,
      counts:{bet:0,lean:0,wait:1,pass:1},
      feedGeneratedAt:'2026-08-17T21:55:00.000Z',
      recs:[
        {status:'WAIT',title:'Alpha ML',hist:'B — direct fit'},
        {status:'PASS',title:'Beta ML',hist:'C — limited fit'}
      ]
    };
    const sidecar={
      schema:3,
      reportReference:{
        slot:report.slot,
        label:report.label,
        ts:report.ts,
        reportPath:'data/history/runs/2026-08-17/evening-151501.json',
        feedGeneratedAt:report.feedGeneratedAt
      },
      provenance:{
        productionContractVersion:'0.9',
        productionContractOperational:true,
        productionContractPath:'BETTING_EDGE_CONTRACT.md',
        productionContractBlobSha:'27e485c3974fb6ef78e3fbf8036d81281c440a0b',
        feedBlobSha:'1111111111111111111111111111111111111111',
        researchLibraryVersion:'1.7'
      },
      recommendations:[
        {ordinal:1,title:'Alpha ML',status:'WAIT',grade:'B',priorIds:[],synthesisIds:[],clusterIds:[],directness:'direct',transportability:'high',mechanism:'x',limitation:'y',displayText:'B — direct fit'},
        {ordinal:2,title:'Beta ML',status:'PASS',grade:'C',priorIds:[],synthesisIds:[],clusterIds:[],directness:'related',transportability:'medium',mechanism:'x',limitation:'y',displayText:'C — limited fit'}
      ],
      boundaries:{}
    };
    const reportFile=path.join(root,'input-report.json');
    const sidecarFile=path.join(root,'input-sidecar.json');
    writeAtomic(reportFile,jsonText(report));
    writeAtomic(sidecarFile,jsonText(sidecar));
    publish(root,reportFile,sidecarFile);
    publish(root,reportFile,sidecarFile);
    verifyIndex(root,{targetTs:report.ts});
    console.log('REPORT HISTORY SELF-TEST OK');
  }finally{
    fs.rmSync(root,{recursive:true,force:true});
  }
}

function emitOutputs(values){
  if(!process.env.GITHUB_OUTPUT) return;
  const lines=Object.entries(values).map(([key,value])=>`${key}=${value}`).join('\n')+'\n';
  fs.appendFileSync(process.env.GITHUB_OUTPUT,lines,'utf8');
}
function main(){
  const args=parseArgs(process.argv.slice(2));
  const root=path.resolve(args.root||process.cwd());
  if(args.command==='publish'){
    assert(typeof args.report==='string','publish requires --report <file>');
    assert(typeof args.sidecar==='string','publish requires --sidecar <file>');
    publish(root,path.resolve(args.report),path.resolve(args.sidecar));
  }else if(args.command==='verify'){
    verifyIndex(root,{targetTs:typeof args.ts==='string'?args.ts:undefined});
  }else if(args.command==='self-test'){
    selfTest();
  }else{
    die('Usage: report-publication.mjs publish --report FILE --sidecar FILE [--root DIR] | verify [--ts ISO] [--root DIR] | self-test');
  }
}
try{main();}
catch(error){console.error(`REPORT HISTORY ERROR: ${error.message}`);process.exit(1);}

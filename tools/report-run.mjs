#!/usr/bin/env node
// Resumable producer. It never writes issued History or performs source research.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareEvidenceDraft,buildEvidenceAudit,captureForecastEvidenceDraft} from './report-evidence-repair.mjs';
import {buildResearchWorkPlan} from './event-research-plan.mjs';
import {scheduleMetadataForReport} from './main-schedule.mjs';
import {runPipeline} from './report-pipeline.mjs';
import {blobSha,validateStagedBundle} from './extract-staged-report.mjs';
import {bindIntelligence,projectGameIntelligence} from './game-intelligence.mjs';
import {derivePrimarySelectionInventory} from './major-sport-market-coverage-gate.mjs';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {serializeReportDocument,parseReportDocument} from './report-document-transport.mjs';
import {producerExecutionFor} from './report-producer-progress.mjs';

const json=value=>JSON.stringify(value,null,2)+'\n';
const read=file=>JSON.parse(fs.readFileSync(file));
function atomic(file,bytes){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const temporary=`${file}.tmp-${process.pid}`;
  try{fs.writeFileSync(temporary,bytes,{flag:'wx'});fs.renameSync(temporary,file);}
  finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
function within(root,file){return path.relative(root,file).split(path.sep).join('/');}
function safeCheckpoint(root,file){
  const relative=within(root,file);
  if(!/^data\/report-production\/checkpoints\/[a-zA-Z0-9_-]+\.json$/.test(relative))throw new Error('Checkpoint must be data/report-production/checkpoints/<run-id>.json');
  // Reject symlink escapes, including a symlink on a parent directory.
  for(let part=path.dirname(file);part!==path.dirname(part);part=path.dirname(part))
    if(fs.existsSync(part)&&fs.realpathSync(part)!==part)throw new Error('Checkpoint path must not contain symlinks');
  if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw new Error('Checkpoint must not be a symlink');
}
function identity(report,sidecar,root){
  const schedule=scheduleMetadataForReport(report,root);
  if(!Number.isFinite(Date.parse(report.ts))||!/(Z|[+-]\d\d:\d\d)$/.test(report.ts))throw new Error('Actual timestamp with timezone required');
  if(sidecar.schema!==3||sidecar.reportReference?.ts!==report.ts||sidecar.reportReference?.slot!==report.slot||sidecar.reportReference?.feedGeneratedAt!==report.feedGeneratedAt)throw new Error('Draft identity mismatch');
  if(sidecar.provenance?.canonicalSlot!==schedule.canonicalSlot)throw new Error('Draft schedule provenance mismatch');
  if(!/^[a-f0-9]{40}$/i.test(sidecar.provenance?.feedBlobSha||''))throw new Error('Exact feed binding required');
  return {candidateId:`${report.ts}|${schedule.canonicalSlot}`,slot:report.slot,ts:report.ts,canonicalSlot:schedule.canonicalSlot,feedBlobSha:sidecar.provenance.feedBlobSha};
}
function temporaryDraft(state,callback){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'betting-edge-run-'));
  const report=path.join(dir,'report.json'),sidecar=path.join(dir,'sidecar.json');
  fs.writeFileSync(report,json(state.report));fs.writeFileSync(sidecar,json(state.sidecar));
  try{return callback({report,sidecar});}finally{fs.rmSync(dir,{recursive:true,force:true});}
}
function summary(state){
  return {schema:1,run:state.identity,phase:state.phase,revision:state.revision,
    counts:state.report.counts,research:{available:state.sidecar.primaryAnalysis?.receipts?.length??null,evaluated:state.sidecar.primaryAnalysis?.receipts?.filter(row=>row.state==='EVALUATED').length??null,blocked:state.sidecar.primaryAnalysis?.receipts?.filter(row=>row.state==='BLOCKED').length??null,
      unfinished:state.sidecar.primaryAnalysis?.receipts?.filter(row=>row.state==='BLOCKED'&&row.blocker?.reason==='RESEARCH_INCOMPLETE').length??null},
    checkpointBytes:Buffer.byteLength(serializeReportDocument(state,'REPORT_CHECKPOINT')),checkpointDecodedBytes:Buffer.byteLength(json(state)),
    validation:state.validation?{state:state.validation.state,gates:state.validation.receipts?.length}:null,
    frozen:state.frozen?{blobSha:state.frozen.blobSha,bytes:state.frozen.bytes}:null,
    savedEventReviews:[...new Set(state.events.filter(event=>event.command==='checkpoint'&&event.eventId).map(event=>event.eventId))],
    preparation:state.preparation||null,lastEvent:state.events.at(-1)||null,
    publication:state.publication||null};
}
function bundleFor(state){
  const producerExecution=producerExecutionFor(state);
  return {schema:1,state:'READY',phase:String(state.identity.canonicalSlot),candidateId:state.identity.candidateId,report:state.report,sidecar:state.sidecar,
    ...(producerExecution?{producerExecution}:{})};
}
function bindGameInputs(root,report,sidecar){
  if(sidecar.gameIntelligenceInputs)return;
  let bytes;
  try{bytes=execFileSync('git',['cat-file','blob',sidecar.provenance?.feedBlobSha],{cwd:root,maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']});}
  catch{
    const file=path.join(root,'data/live-odds.json');
    // Starting a resumable draft does not require completed acquisition. The
    // established preflight/freeze gates still reject a missing bound feed.
    if(!fs.existsSync(file))return;
    bytes=fs.readFileSync(file);
  }
  if(blobSha(bytes)!==sidecar.provenance?.feedBlobSha)throw Error('Game dossier feed does not match the draft');
  const feed=JSON.parse(bytes),policy=read(path.join(root,'data/major-sport-market-coverage-v1.json'));
  bindIntelligence({root,report,sidecar,feed,universe:derivePrimarySelectionInventory(report,feed,policy)});
}
function sealedBytes(state){
  if(!['FROZEN','STAGED','PUBLISHED'].includes(state.phase)||!state.frozen)throw new Error('Run is not frozen');
  // Keep the original serialized bytes, including compression, across retries
  // and runtimes. Older checkpoints retain their original plain-JSON seal.
  const bytes=state.frozen.serializedBundle??json(bundleFor(state));
  if(blobSha(bytes)!==state.frozen.blobSha||Buffer.byteLength(bytes)!==state.frozen.bytes)throw new Error('Frozen candidate bytes changed');
  if(!isDeepStrictEqual(parseReportDocument(bytes,'STAGED_REPORT'),bundleFor(state)))throw new Error('Frozen candidate bytes changed');
  return bytes;
}
export function runCommand({command,root=process.cwd(),checkpoint,report,sidecar,expectedRevision,eventId,outputDir,at,pipeline=runPipeline}){
  const commandStarted=Date.now();
  root=fs.realpathSync(root);
  if(!checkpoint)throw new Error('--checkpoint is required');
  const file=path.resolve(root,checkpoint);safeCheckpoint(root,file);
  const readonly=['status','next','export','diagnose'].includes(command);
  const mutating=['start','checkpoint','retime','prepare','freeze','stage','readback'].includes(command);
  if(!readonly&&!mutating)throw new Error('Unknown run command');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  let lock;
  if(mutating)lock=fs.openSync(`${file}.lock`,'wx');
  try{
    let state=fs.existsSync(file)?parseReportDocument(fs.readFileSync(file),'REPORT_CHECKPOINT'):null;
    if(command==='start'){
      if(state)throw new Error('Run already exists; resume it with status/next');
      if(!report||!sidecar)throw new Error('start requires complete local draft files');
      let r=read(path.resolve(report)),s=read(path.resolve(sidecar));
      bindGameInputs(root,r,s);
      ({report:r,sidecar:s}=captureForecastEvidenceDraft({root,report:r,sidecar:s}));
      state={schema:1,identity:identity(r,s,root),phase:'DRAFT',revision:0,report:r,sidecar:s,events:[]};
    }else{
      if(state?.schema!==1||!Array.isArray(state.events))throw new Error('Run checkpoint is missing or invalid');
      if(JSON.stringify(identity(state.report,state.sidecar,root))!==JSON.stringify(state.identity))throw new Error('Checkpoint identity changed');
      if(state.frozen)sealedBytes(state);
      if(mutating&&Number(expectedRevision)!==state.revision)throw new Error(`Revision conflict: current revision is ${state.revision}`);
    }
    if(command==='status')return summary(state);
    if(command==='diagnose')return {...summary(state),diagnostics:temporaryDraft(state,files=>pipeline({root,...files,mode:'diagnose'}))};
    if(command==='export'){
      if(!outputDir)throw new Error('export requires --output-dir outside the repository');
      const requested=path.resolve(outputDir);
      fs.mkdirSync(requested,{recursive:true});
      const dir=fs.realpathSync(requested),relative=path.relative(root,dir);
      if(!relative.startsWith(`..${path.sep}`)&&!path.isAbsolute(relative))throw new Error('Export drafts outside the repository to protect History');
      fs.mkdirSync(dir,{recursive:true});
      for(const key of ['report','sidecar'])atomic(path.join(dir,`${key}.json`),json(state[key]));
      return {...summary(state),outputDir:dir};
    }
    if(command==='next'){
      const audit=buildEvidenceAudit({root,report:state.report,sidecar:state.sidecar});
      const intelligence=audit.gameIntelligence;
      return {...summary(state),workPlan:buildResearchWorkPlan(audit.eventResearchPlan,{eventId:eventId||null}),
        gameIntelligence:intelligence?(eventId?projectGameIntelligence(intelligence,eventId):
          {asOf:intelligence.asOf,collectedAt:intelligence.collectedAt,counts:intelligence.counts,sources:intelligence.sources,
            games:intelligence.games.map(g=>({eventId:g.eventId,label:g.label,...g.summary}))}):null,warnings:audit.warnings};
    }
    if(['checkpoint','retime','prepare'].includes(command)&&!['DRAFT','PREPARED'].includes(state.phase))throw new Error('Frozen runs cannot be edited; start a new actual-time run');
    if(command==='checkpoint'){
      if(!report||!sidecar)throw new Error('checkpoint requires updated draft files');
      let r=read(path.resolve(report)),s=read(path.resolve(sidecar));
      if(state.sidecar.gameIntelligenceInputs&&!isDeepStrictEqual(s.gameIntelligenceInputs,state.sidecar.gameIntelligenceInputs))throw Error('Pinned game inputs changed; export the saved draft or start a newly bound actual-time run');
      if(JSON.stringify(identity(r,s,root))!==JSON.stringify(state.identity))throw new Error('Cannot change run identity or feed binding; start a new run');
      if(eventId&&!s.primaryAnalysis?.receipts?.some(row=>String(row.quote?.eventId??row.decision?.feed?.eventId??row.selectionId?.split('|')[1])===String(eventId)))throw Error('Checkpoint event is not in the bound selection receipts');
      ({report:r,sidecar:s}=captureForecastEvidenceDraft({root,report:r,sidecar:s}));
      state.report=r;state.sidecar=s;state.phase='DRAFT';delete state.validation;delete state.preparation;
    }
    if(command==='retime'){
      const old=state.report.ts;
      const localDate=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
      if(!at||!/(Z|[+-]\d\d:\d\d)$/.test(at)||!Number.isFinite(Date.parse(at))||Date.parse(at)<Date.parse(old)||localDate(at)!==localDate(old))throw new Error('Retime must advance within the same Vancouver operating date');
      // Issued paths use the established local ISO representation; preserve its offset/date.
      if(at.slice(0,10)!==old.slice(0,10)||at.match(/(Z|[+-]\d\d:\d\d)$/)[1]!==old.match(/(Z|[+-]\d\d:\d\d)$/)[1])throw new Error('Retime must preserve the local ISO date and timezone representation');
      state.report.ts=at;
      const stem=`${state.report.slot}-${at.slice(11,19).replaceAll(':','')}`;
      Object.assign(state.sidecar.reportReference,{ts:at,reportPath:`data/history/runs/${at.slice(0,10)}/${stem}.json`,researchFitPath:`data/history/research-fit/${at.slice(0,10)}/${stem}.json`});
      state.sidecar.provenance.reportTimestamp=at;
      if(state.sidecar.grahamFairHandoffInputs)state.sidecar.grahamFairHandoffInputs.reportTs=at;
      state.identity=identity(state.report,state.sidecar,root);state.phase='DRAFT';delete state.validation;delete state.preparation;
    }
    if(command==='prepare'){
      const prepared=prepareEvidenceDraft({root,report:state.report,sidecar:state.sidecar});
      const work={report:prepared.report,sidecar:prepared.sidecar};
      temporaryDraft(work,files=>{
        pipeline({root,...files,mode:'normalize'});
        state.report=read(files.report);state.sidecar=read(files.sidecar);
      });
      state.preparation={candidateDeferrals:prepared.audit.candidateDeferrals,cardEvidenceDeferrals:prepared.audit.cardEvidenceDeferrals,warnings:prepared.audit.warnings};
      state.preparation.forecastRouting=prepared.audit.forecastRouting;
      state.preparation.diagnostics=temporaryDraft(state,files=>pipeline({root,...files,mode:'diagnose'}));
      state.phase='PREPARED';delete state.validation;
    }
    if(command==='freeze'){
      if(state.phase!=='PREPARED')throw new Error('Prepare and review deferrals before freeze');
      validateStagedBundle(bundleFor(state),{root});
      state.validation=temporaryDraft(state,files=>pipeline({root,...files,mode:'validate'}));
      const bytes=serializeReportDocument(bundleFor(state),'STAGED_REPORT');state.frozen={blobSha:blobSha(bytes),bytes:Buffer.byteLength(bytes),serializedBundle:bytes};state.phase='FROZEN';
    }
    if(command==='stage'){
      if(!['FROZEN','STAGED'].includes(state.phase))throw new Error('Only a frozen candidate may be staged');
      const bytes=sealedBytes(state);
      // Recheck against current history/policies before every submission/retry.
      temporaryDraft(state,files=>pipeline({root,...files,mode:'validate'}));
      atomic(path.join(root,'data/history/staging/report-bundle.json'),bytes);state.phase='STAGED';
    }
    if(command==='readback'){
      if(!['FROZEN','STAGED','PUBLISHED'].includes(state.phase))throw new Error('Read-back requires a frozen candidate');
      const index=read(path.join(root,'run-history.json'));
      const entries=(index.runs||[]).filter(row=>row.ts===state.report.ts&&row.slot===state.report.slot);
      if(entries.length!==1)throw new Error('Exact issued run is not indexed once; publication remains pending');
      const entry=entries[0];
      if(!/^data\/history\/runs\/\d{4}-\d{2}-\d{2}\/[a-z_]+-\d{6}\.json$/.test(entry.path)||!/^data\/history\/research-fit\/\d{4}-\d{2}-\d{2}\/[a-z_]+-\d{6}\.json$/.test(entry.researchFitPath))throw new Error('Invalid indexed paths');
      const rfile=path.join(root,entry.path),sfile=path.join(root,entry.researchFitPath),issued=read(rfile),research=read(sfile);
      for(const key of ['ts','slot','label','feedGeneratedAt','bankroll','risk','counts','recs'])
        if(JSON.stringify(issued[key])!==JSON.stringify(state.report[key]))throw new Error(`Published ${key} differs from frozen candidate`);
      for(const key of ['recommendations','primaryAnalysis','forecastEvidence','gameIntelligenceInputs'])
        if(JSON.stringify(research[key])!==JSON.stringify(state.sidecar[key]))throw new Error(`Published evidence ${key} differs from frozen candidate`);
      if(research.provenance?.feedBlobSha!==state.identity.feedBlobSha)throw new Error('Published feed binding changed');
      pipeline({root,report:rfile,sidecar:sfile,mode:'readback'});
      state.publication={reportPath:entry.path,sidecarPath:entry.researchFitPath,
        reportBlobSha:blobSha(fs.readFileSync(rfile)),sidecarBlobSha:blobSha(fs.readFileSync(sfile)),
        readbackAt:new Date().toISOString()};state.phase='PUBLISHED';
    }
    state.revision++;
    state.events.push({command,at:new Date().toISOString(),revision:state.revision,phase:state.phase,durationMs:Date.now()-commandStarted,
      ...(command==='checkpoint'&&eventId?{eventId:String(eventId)}:{})});
    atomic(file,serializeReportDocument(state,'REPORT_CHECKPOINT'));
    return {...summary(state),checkpoint:within(root,file),...(command==='stage'?{stagingPath:'data/history/staging/report-bundle.json',requiresRemoteCommitAndWorkflowSuccess:true}:{})};
  }finally{if(lock!==undefined){fs.closeSync(lock);fs.unlinkSync(`${file}.lock`);}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    const [command,...args]=process.argv.slice(2),options={command};
    const flags={'--root':'root','--checkpoint':'checkpoint','--report':'report','--sidecar':'sidecar','--expected-revision':'expectedRevision','--event-id':'eventId','--output-dir':'outputDir','--at':'at'};
    for(let i=0;i<args.length;i+=2){if(!flags[args[i]]||!args[i+1]||flags[args[i]] in options)throw new Error('Invalid controller arguments');options[flags[args[i]]]=args[i+1];}
    console.log(json(runCommand(options)));
  }catch(error){console.error(json({state:'FAILED',error:error.message,receipts:error.receipts||[]}));process.exitCode=1;}
}

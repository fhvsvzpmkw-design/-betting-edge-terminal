import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const source=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'full-controller-replay-'));
const {parseReportDocument}=await import('../tools/report-document-transport.mjs');
const git=(args,cwd=source)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']});
try{
 git(['worktree','add','--detach',temp,'HEAD']);
 const changed=git(['ls-files','--modified','--others','--exclude-standard']).trim().split('\n').filter(Boolean);
 for(const file of changed){fs.mkdirSync(path.dirname(path.join(temp,file)),{recursive:true});fs.copyFileSync(path.join(source,file),path.join(temp,file));}
 const {runCommand}=await import(pathToFileURL(path.join(temp,'tools/report-run.mjs')));
 const reportPath='data/history/runs/2026-09-27/main-081200.json',sidecarPath='data/history/research-fit/2026-09-27/main-081200.json';
 const r=JSON.parse(fs.readFileSync(path.join(temp,reportPath))),s=JSON.parse(fs.readFileSync(path.join(temp,sidecarPath)));
 // Exercise the new report fields through every real publisher gate while
 // replaying the historical decision fixture. No historical source is altered.
 const {bindIntelligence}=await import(pathToFileURL(path.join(temp,'tools/game-intelligence.mjs')));
 const {derivePrimarySelectionInventory}=await import(pathToFileURL(path.join(temp,'tools/major-sport-market-coverage-gate.mjs')));
 const feed=JSON.parse(execFileSync('git',['cat-file','blob',s.provenance.feedBlobSha],{cwd:temp,maxBuffer:64*1024*1024}));
 const policy=JSON.parse(fs.readFileSync(path.join(temp,'data/major-sport-market-coverage-v1.json')));
 bindIntelligence({root:temp,report:r,sidecar:s,feed,universe:derivePrimarySelectionInventory(r,feed,policy),liveBoard:true});
 // Reconstruct a prepublication checkout in isolation. Real History remains untouched.
 const index=JSON.parse(fs.readFileSync(path.join(temp,'run-history.json')));
 for(const entry of index.runs.filter(x=>Date.parse(x.ts)>=Date.parse(r.ts)))for(const file of [entry.path,entry.researchFitPath])fs.rmSync(path.join(temp,file),{force:true});
 index.runs=index.runs.filter(x=>Date.parse(x.ts)<Date.parse(r.ts));fs.writeFileSync(path.join(temp,'run-history.json'),JSON.stringify(index));
 const exportDir=fs.mkdtempSync(path.join(os.tmpdir(),'replay-draft-'));
 const report=path.join(exportDir,'report.json'),sidecar=path.join(exportDir,'sidecar.json');
 for(const [p,v]of [[report,r],[sidecar,s]])fs.writeFileSync(p,JSON.stringify(v));
 const base={root:temp,checkpoint:'data/report-production/checkpoints/replay.json'};
 let a=runCommand({...base,command:'start',report,sidecar});
 a=runCommand({...base,command:'prepare',expectedRevision:a.revision});
 a=runCommand({...base,command:'freeze',expectedRevision:a.revision});
 a=runCommand({...base,command:'stage',expectedRevision:a.revision});
 const bundle=parseReportDocument(fs.readFileSync(path.join(temp,'data/history/staging/report-bundle.json')),'STAGED_REPORT');
 if(!bundle.report.gameIntelligence||!bundle.sidecar.gameIntelligenceInputs)throw Error('Game dossier was lost before publication');
 for(const[p,v]of [[report,bundle.report],[sidecar,bundle.sidecar]])fs.writeFileSync(p,JSON.stringify(v));
 execFileSync(process.execPath,['tools/report-publication.mjs','publish','--report',report,'--sidecar',sidecar],{cwd:temp,stdio:'pipe'});
 a=runCommand({...base,command:'readback',expectedRevision:a.revision});
 if(a.phase!=='PUBLISHED'||a.counts.lean!==2||a.counts.pass!==6)throw new Error('Replay did not preserve all eight issued decisions');
 console.log(JSON.stringify({phase:a.phase,counts:a.counts,readback:a.publication,isolatedReplay:true}));
 fs.rmSync(exportDir,{recursive:true,force:true});
}finally{try{git(['worktree','remove','--force',temp]);}catch{fs.rmSync(temp,{recursive:true,force:true});}}

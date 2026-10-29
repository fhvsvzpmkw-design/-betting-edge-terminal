#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const PRIMARY='data/live-odds.json';
const OBSERVER='data/oddspapi-observer.json';
const SIDECARS=['data/oddspapi-budget-state.json','data/oddspapi-market-cache.json'];
const epoch=value=>Number.isFinite(Date.parse(value))?Date.parse(value):0;

function candidate(root,file,{sidecar=false,required=false}={}){
  const full=path.join(root,file);
  if(!fs.existsSync(full)){
    if(required)throw new Error(`Missing validated snapshot: ${file}`);
    return null;
  }
  const bytes=fs.readFileSync(full),document=JSON.parse(bytes);
  const stamp=epoch(sidecar?document.updatedAt:document.generatedAt);
  if(!stamp||(sidecar&&document.schema!==1))throw new Error(`Invalid publication candidate: ${file}`);
  return {file,bytes,document,stamp};
}

// Capture all local bytes before the first reset. A collision retries publication
// of these exact observations and accounting records, never provider collection.
export function publishOddsSnapshot({root=process.cwd(),validated=process.env.ODDS_SNAPSHOTS_VALIDATED==='true',beforePush=null,log=console.log}={}){
  const git=(args,{optional=false}={})=>{
    try{return execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});}
    catch(error){if(optional)return null;throw error;}
  };
  const errors=[];
  let primary=null,observer=null;
  if(validated){
    try{primary=candidate(root,PRIMARY,{required:true});observer=candidate(root,OBSERVER);}
    catch(error){errors.push(error.message);primary=null;observer=null;}
  }
  const sidecars=SIDECARS.flatMap(file=>{
    try{const item=candidate(root,file,{sidecar:true});return item?[item]:[];}
    catch(error){errors.push(error.message);return [];}
  });
  if(!primary&&!sidecars.length){
    if(errors.length)throw new Error(errors.join('; '));
    return {published:false,snapshotsPublished:false,reason:'NO_PUBLICATION_CANDIDATES'};
  }
  git(['config','user.name','betting-edge-bot']);
  git(['config','user.email','actions@users.noreply.github.com']);
  const remoteFile=file=>{
    const bytes=git(['show',`origin/main:${file}`],{optional:true});
    if(bytes===null)return null;
    let document=null;try{document=JSON.parse(bytes);}catch{}
    return {bytes,document};
  };
  const write=item=>{const full=path.join(root,item.file);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,item.bytes);};
  for(let attempt=1;attempt<=4;attempt++){
    git(['fetch','origin','main']);
    const remotePrimary=remoteFile(PRIMARY);
    const newerPrimary=Boolean(primary&&primary.stamp>epoch(remotePrimary?.document?.generatedAt));
    const chosen=sidecars.filter(item=>item.stamp>epoch(remoteFile(item.file)?.document?.updatedAt));
    git(['reset','--hard','origin/main']);
    let snapshotsPublished=false;
    if(newerPrimary){
      write(primary);
      try{
        execFileSync(process.execPath,['tools/odds-slot-state.mjs','record'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
        snapshotsPublished=true;
      }catch(error){
        const detail=String(error.stderr||error.message).trim();
        errors.push(`Odds slot receipt failed: ${detail}`);
        if(remotePrimary)fs.writeFileSync(path.join(root,PRIMARY),remotePrimary.bytes);
        else fs.rmSync(path.join(root,PRIMARY),{force:true});
      }
      if(snapshotsPublished&&observer&&observer.stamp>epoch(remoteFile(OBSERVER)?.document?.generatedAt))write(observer);
    }
    for(const item of chosen)write(item);
    const staged=chosen.map(item=>item.file);
    if(snapshotsPublished){
      staged.push(PRIMARY);
      if(observer&&fs.existsSync(path.join(root,OBSERVER)))staged.push(OBSERVER);
      if(fs.existsSync(path.join(root,'data/odds-pull-receipts')))staged.push('data/odds-pull-receipts');
    }
    if(staged.length)git(['add','--',...staged]);
    const changed=git(['diff','--cached','--name-only']).trim();
    if(!changed){
      if(errors.length)throw new Error(errors.join('; '));
      log('Remote odds/accounting are already equal or newer; nothing to publish.');
      return {published:false,snapshotsPublished:false,reason:'REMOTE_ALREADY_CURRENT'};
    }
    git(['commit','-m',snapshotsPublished?'Refresh Betting Edge live odds and OddsPapi accounting':'Preserve OddsPapi quota accounting and catalogue cache']);
    beforePush?.({attempt,root});
    const pushed=git(['push','origin','HEAD:main'],{optional:true});
    if(pushed!==null){
      log(`Validated odds/accounting published on attempt ${attempt}${snapshotsPublished?'':' (accounting only)'}.`);
      if(errors.length)throw new Error(errors.join('; '));
      return {published:true,snapshotsPublished,attempt,paths:changed.split('\n')};
    }
    log(`Publish collision on attempt ${attempt}; retrying saved bytes without another odds pull.`);
  }
  throw new Error('Validated odds/accounting could not be published after four attempts; provider collection was not repeated.');
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{console.log(JSON.stringify(publishOddsSnapshot()));}
  catch(error){console.error(error.message);process.exitCode=1;}
}

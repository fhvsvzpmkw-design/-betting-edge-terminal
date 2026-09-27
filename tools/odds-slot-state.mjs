#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {resolveWorkflowSchedule} from './main-schedule.mjs';
import {blobSha} from './extract-staged-report.mjs';
const read=file=>JSON.parse(fs.readFileSync(file));
const receiptPath=date=>`data/odds-pull-receipts/${date}.json`;
export function slotForFeed(feed,root=process.cwd()){
  const meta=feed?.scheduleMeta;
  if(!Number.isFinite(Date.parse(feed?.generatedAt)))return null;
  const slot=resolveWorkflowSchedule({now:new Date(feed.generatedAt),eventName:'schedule'},root);
  if(!slot.shouldRun)return null;
  if(meta?.triggerSource!=='manual' && (meta?.operatingDate!==slot.operatingDate||meta?.canonicalSlot!==slot.canonicalSlot))return null;
  return slot;
}
export function shouldCollect({root=process.cwd(),slot,feed=null}){
  if(!slot.shouldRun)return {execute:false,reason:'not-due'};
  if(slot.manual)return {execute:true,reason:'manual'};
  const file=path.join(root,receiptPath(slot.operatingDate));
  if(fs.existsSync(file)){
    const receipt=read(file);
    if(receipt.schema!==1||receipt.operatingDate!==slot.operatingDate||!receipt.slots)throw new Error('Invalid odds slot receipt');
    if(receipt.slots[String(slot.canonicalSlot)])return {execute:false,reason:'slot-already-receipted'};
  }
  const existing=slotForFeed(feed,root);
  if(existing?.operatingDate===slot.operatingDate&&existing?.canonicalSlot===slot.canonicalSlot)return {execute:false,reason:'slot-already-published'};
  return {execute:true,reason:'main-slot-due'};
}
export function recordOddsSlot({root=process.cwd(),feedFile='data/live-odds.json'}){
  const bytes=fs.readFileSync(path.resolve(root,feedFile)),feed=JSON.parse(bytes),slot=slotForFeed(feed,root);
  if(!slot)return {recorded:false,reason:'outside-main-pulse-window'};
  const relative=receiptPath(slot.operatingDate),file=path.join(root,relative);
  const receipt=fs.existsSync(file)?read(file):{schema:1,operatingDate:slot.operatingDate,slots:{}};
  if(receipt.schema!==1||receipt.operatingDate!==slot.operatingDate||!receipt.slots)throw new Error('Invalid odds slot receipt');
  // First successful collection fulfills the slot; later manual refreshes do not erase it.
  receipt.slots[String(slot.canonicalSlot)]??={slot:slot.slotName,generatedAt:feed.generatedAt,feedBlobSha:blobSha(bytes),triggerSource:feed.scheduleMeta?.triggerSource??'unknown',workflowRunId:process.env.GITHUB_RUN_ID||null};
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(receipt,null,2)+'\n');
  return {recorded:true,path:relative};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    if(process.argv[2]==='record')console.log(JSON.stringify(recordOddsSlot({})));
    else if(process.argv[2]==='check'){
      const scheduled=process.env.TRIGGER_MODE==='cloudflare_scheduled';
      const now=scheduled?new Date(process.env.SCHEDULED_AT):new Date();
      const slot=resolveWorkflowSchedule({now,eventName:scheduled?'schedule':process.env.GITHUB_EVENT_NAME});
      const feed=fs.existsSync('data/live-odds.json')?read('data/live-odds.json'):null;
      const result=shouldCollect({slot,feed});console.log(`execute=${result.execute}\nreason=${result.reason}`);
    }else throw new Error('Use odds-slot-state.mjs check|record');
  }catch(error){console.error(error.message);process.exitCode=1;}
}

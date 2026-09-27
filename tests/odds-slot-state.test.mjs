import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {resolveWorkflowSchedule} from '../tools/main-schedule.mjs';
import {shouldCollect,recordOddsSlot} from '../tools/odds-slot-state.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'odds-slots-'));
try{
 fs.mkdirSync(path.join(root,'data'));fs.copyFileSync('data/main-schedule.json',path.join(root,'data/main-schedule.json'));
 for(const [date,hours] of [['2026-09-27',[12,14,16,22,1]],['2025-12-06',[13,15,17,23,2]]]){
   for(let i=0;i<5;i++){
     const minute=i<2?'55':i===2?'25':'10';
     const slot=resolveWorkflowSchedule({now:new Date(`${date}T${String(hours[i]).padStart(2,'0')}:${minute}:00Z`),eventName:'schedule'},root);
     assert.equal(slot.canonicalSlot,i+1,'fallback matches Vancouver lane in both seasons');
   }
 }
 const slot=resolveWorkflowSchedule({now:new Date('2026-09-27T22:10:00Z'),eventName:'schedule'},root);
 assert.equal(shouldCollect({root,slot}).execute,true);
 const feed={generatedAt:'2026-09-27T22:09:00Z',scheduleMeta:{triggerSource:'cloudflare-cron',operatingDate:'2026-09-27',canonicalSlot:4}};
 assert.equal(shouldCollect({root,slot,feed}).execute,false,'Cloudflare success suppresses fallback');
 const file=path.join(root,'data/live-odds.json');fs.writeFileSync(file,JSON.stringify(feed));
 const recorded=recordOddsSlot({root});assert.equal(recorded.recorded,true);
 assert.equal(shouldCollect({root,slot,feed:{generatedAt:'2026-09-27T22:40:00Z',scheduleMeta:{triggerSource:'manual'}}}).execute,false,'later manual snapshot cannot erase completed slot');
 const manual=resolveWorkflowSchedule({now:new Date('2026-09-27T22:10:00Z'),eventName:'workflow_dispatch'},root);
 assert.equal(shouldCollect({root,slot:manual,feed}).execute,true,'intentional manual refresh remains available');
 const nextDay=resolveWorkflowSchedule({now:new Date('2026-09-28T22:10:00Z'),eventName:'schedule'},root);
 assert.equal(shouldCollect({root,slot:nextDay,feed}).execute,true,'previous date cannot suppress next day');
 assert.equal(shouldCollect({root,slot:{shouldRun:false}}).execute,false);
 const receiptBefore=fs.readFileSync(path.join(root,recorded.path));recordOddsSlot({root});assert.deepEqual(fs.readFileSync(path.join(root,recorded.path)),receiptBefore);
 console.log('ODDS RECOVERY: PST/PDT lanes, Cloudflare/fallback dedup, durable slot receipt, manual override, dates PASS');
}finally{fs.rmSync(root,{recursive:true,force:true});}

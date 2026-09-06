#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadMainSchedule, resolveWorkflowSchedule, scheduleMetadataForReport, validateMainSchedule } from '../tools/main-schedule.mjs';

const schedule=loadMainSchedule();
assert.equal(validateMainSchedule(schedule),true);
assert.equal(schedule.id,'main');
assert.equal(schedule.name,'MAIN BETTING EDGE');
assert.equal(schedule.timezone,'America/Vancouver');
assert.equal(schedule.maxDailyPrimaryPulls,5);
assert.deepEqual(schedule.slots.map(slot=>slot.slot),['open','main','final_morning','evening','late']);
assert.deepEqual(schedule.slots.map(slot=>slot.pulseTime),['05:50','07:50','09:20','15:05','18:05']);
assert.deepEqual(schedule.slots.map(slot=>slot.reportTime),['06:00','08:00','09:30','15:15','18:15']);
assert.deepEqual(schedule.slots.map(slot=>slot.canonicalSlot),[1,2,3,4,5]);
assert.equal(schedule.slots.filter(slot=>slot.featuredVigScope).length,3);

for(const [iso,slot,reportTime] of [
  ['2026-09-06T12:50:00Z','open','06:00'],
  ['2026-09-06T14:50:00Z','main','08:00'],
  ['2026-09-06T16:20:00Z','final_morning','09:30'],
  ['2026-09-06T22:05:00Z','evening','15:15'],
  ['2026-09-07T01:05:00Z','late','18:15']
]){
  const result=resolveWorkflowSchedule({now:new Date(iso),eventName:'schedule'});
  assert.equal(result.shouldRun,true,`${slot} should run`);
  assert.equal(result.scheduleId,'main');
  assert.equal(result.slotName,slot);
  assert.equal(result.plannedReportTime,reportTime);
}

const winter=resolveWorkflowSchedule({now:new Date('2025-12-06T13:50:00Z'),eventName:'schedule'});
assert.equal(winter.slotName,'open','Vancouver-local 05:50 must survive the historical PST offset');
assert.equal(winter.plannedReportTime,'06:00');
assert.equal(resolveWorkflowSchedule({now:new Date('2026-09-06T18:00:00Z'),eventName:'schedule'}).shouldRun,false);

const manual=resolveWorkflowSchedule({now:new Date('2026-09-06T18:00:00Z'),eventName:'workflow_dispatch'});
assert.equal(manual.shouldRun,true);
assert.equal(manual.manual,true);
assert.equal(manual.scheduleId,'main');

const metadata=scheduleMetadataForReport({slot:'evening',ts:'2026-09-06T15:15:00-07:00'});
assert.equal(metadata.scheduleProfileId,'main');
assert.equal(metadata.scheduleProfileLabel,'MAIN BETTING EDGE');
assert.equal(metadata.canonicalSlot,4);
assert.equal(metadata.scheduledPulseTime,'15:05');
assert.equal(metadata.scheduledReportTime,'15:15');
assert.equal(metadata.featuredVigScope,true);

assert.equal(fs.existsSync('data/schedule-profiles.json'),false,'seasonal profile definitions must remain removed');
assert.equal(fs.existsSync('data/schedule-state.json'),false,'seasonal profile state must remain removed');
assert.equal(fs.existsSync('.github/workflows/set-schedule-profile.yml'),false,'profile selector workflow must remain removed');

const worker=fs.readFileSync('cloudflare-worker/src/index.js','utf8');
const wrangler=fs.readFileSync('cloudflare-worker/wrangler.jsonc','utf8');
const oddsWorkflow=fs.readFileSync('.github/workflows/odds-refresh.yml','utf8');
for(const source of [worker,oddsWorkflow]){
  assert(!source.includes('schedule-profiles.json'),'runtime schedulers must not read seasonal profiles');
  assert(!source.includes('schedule-state.json'),'runtime schedulers must not read retired selection state');
}
assert(worker.includes('data/main-schedule.json'),'Worker must read the permanent Main schedule');
assert(worker.includes('const SCHEDULER_CRON = "5,20,50 * * * *";'),'Worker scheduler cadence must remain unchanged');
assert(wrangler.includes('"crons": ["5,20,50 * * * *"]'),'deployed Worker cron must remain unchanged');
assert(oddsWorkflow.includes('node tools/main-schedule.mjs resolve-workflow'),'odds workflow must use the Main schedule resolver');

console.log('MAIN BETTING EDGE SCHEDULE TESTS PASS');

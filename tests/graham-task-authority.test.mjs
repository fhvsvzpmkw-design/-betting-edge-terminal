import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadTaskAuthority,buildGrahamTaskPrompt,validateLiveGrahamTasks} from '../tools/graham-task-authority.mjs';
import {validateGrahamScheduleAuthority,buildResearchCadenceProjection,buildResearchLedgerCadenceProjection} from '../tools/graham-schedule-authority.mjs';
const authority=loadTaskAuthority(),copy=structuredClone;
const binding=authority.registry.executionBinding;
assert.equal(binding.mode,'CONSOLIDATED');
const live=[{id:binding.automationId,title:binding.title,is_enabled:true,default_timezone:authority.schedule.timezone,timing_mode:authority.schedule.timingMode,schedule:binding.schedule,prompt:binding.prompt}];
assert.equal(validateLiveGrahamTasks(live,authority).length,5);
for(const mutate of [
 t=>t[0].is_enabled=false,
 t=>t[0].default_timezone='UTC',
 t=>t[0].schedule=t[0].schedule.replace('7,11,16','7,11,17'),
 t=>t[0].prompt+=' stale instruction',
 t=>t.push(copy(t[0])),
 t=>t[0].id='wrong',
 t=>t.push({id:authority.registry.tasks[0].automationId,is_enabled:true})
]) {const bad=copy(live);mutate(bad);assert.throws(()=>validateLiveGrahamTasks(bad,authority));}
assert.deepEqual(authority.schedule.tasks.find(t=>t.taskKey==='DELTA_1645').days,['MO','TU','WE','TH','FR','SA','SU']);
assert.equal(authority.schedule.tasks.find(t=>t.taskKey==='WEEK_ROLLOVER').time,'07:00');
assert.equal(authority.schedule.tasks.find(t=>t.taskKey==='DAILY_REVIEW').time,'11:00');
for(const mutate of [a=>a.tasks[0].time='24:99',a=>a.tasks[0].days=['XX'],a=>a.tasks[0].days=['TU','TU'],a=>a.tasks[0].rrule=a.tasks[0].rrule.replace('BYHOUR=7','BYHOUR=5'),a=>a.executionAuthority='GITHUB_CRON']) {
 const bad=copy(authority.schedule);mutate(bad);assert.throws(()=>validateGrahamScheduleAuthority(bad));
}
const varied=copy(authority.schedule),delta=varied.tasks.find(t=>t.taskKey==='DELTA_1645');
delta.days=['WE','FR'];delta.time='16:45';delta.rrule='FREQ=WEEKLY;BYDAY=WE,FR;BYHOUR=16;BYMINUTE=45;BYSECOND=0';
assert.equal(validateGrahamScheduleAuthority(varied),true);
assert.ok(buildResearchCadenceProjection(varied).pre315Delta.includes('Wednesday/Friday'));
assert.equal(buildResearchLedgerCadenceProjection(varied).find(t=>t.type==='LATE_DAY_DELTA').day,'WEDNESDAY/FRIDAY');
const noSaturday=copy(authority.schedule);
noSaturday.tasks.find(t=>t.taskKey==='DAILY_REVIEW').days=['MO'];
assert.ok(!buildResearchLedgerCadenceProjection(noSaturday).some(t=>t.type==='MAIN_WEEKEND_SWEEP'));
const runtime=authority.registry.tasks.filter(t=>t.researchRuntimeRequired).map(t=>t.taskKey);
assert.deepEqual(runtime.sort(),['DAILY_REVIEW','DELTA_1645','SUNDAY_PREGAME','TUESDAY_BASELINE']);
assert.equal(authority.registry.tasks.find(t=>t.taskKey==='WEEK_ROLLOVER').researchRuntimeRequired,false);
console.log('GRAHAM STAGE 3: live schedule/identity/state/prompt drift rejected; repository clock consistency and dynamic weekday projections verified; rollover distinct from research.');

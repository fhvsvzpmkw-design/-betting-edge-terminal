import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadTaskAuthority,buildGrahamTaskPrompt,validateLiveGrahamTasks} from '../tools/graham-task-authority.mjs';
import {validateGrahamScheduleAuthority,buildResearchCadenceProjection,buildResearchLedgerCadenceProjection} from '../tools/graham-schedule-authority.mjs';
const authority=loadTaskAuthority(),copy=structuredClone;
const before=JSON.parse(fs.readFileSync('docs/releases/graham-stage3-tasks-before.json','utf8'));
assert.throws(()=>validateLiveGrahamTasks(before,authority),/prompt drift/,'the real pre-build snapshot reproduces the instruction mismatch');
for(const task of before.filter(t=>t.title!=='Graham 16:45 Delta')) {
  const binding=authority.registry.tasks.find(t=>t.automationId===task.id);
  assert.ok(fs.readFileSync(binding.authorityPath,'utf8').includes(task.prompt),'preserve all prior task-specific instructions during migration');
}
const aligned=before.map(t=>({...t,prompt:buildGrahamTaskPrompt(authority.registry.tasks.find(x=>x.automationId===t.id),authority.registry)}));
assert.equal(validateLiveGrahamTasks(aligned,authority).length,5);
for(const mutate of [
 t=>t[0].is_enabled=false,
 t=>t[0].default_timezone='UTC',
 t=>t[0].schedule=t[0].schedule.replace('BYHOUR=16','BYHOUR=15'),
 t=>t[0].schedule=t[0].schedule.replace('TU,WE,TH,FR,SA','MO,TU,WE,TH,FR,SA'),
 t=>t[0].prompt+=' Stale duplicate instruction.',
 t=>t.push(copy(t[0])),
 t=>t[0].id='wrong',
 t=>t[0].schedule=t[0].schedule.replace('T164500','T154500')
]) {const bad=copy(aligned);mutate(bad);assert.throws(()=>validateLiveGrahamTasks(bad,authority));}
for(const mutate of [a=>a.tasks[0].time='24:99',a=>a.tasks[0].days=['XX'],a=>a.tasks[0].days=['TU','TU'],a=>a.tasks[0].rrule=a.tasks[0].rrule.replace('BYHOUR=4','BYHOUR=5'),a=>a.executionAuthority='GITHUB_CRON']) {
 const bad=copy(authority.schedule);mutate(bad);assert.throws(()=>validateGrahamScheduleAuthority(bad));
}
const varied=copy(authority.schedule),delta=varied.tasks.find(t=>t.taskKey==='DELTA_1645');
delta.days=['WE','FR'];delta.rrule='FREQ=WEEKLY;BYDAY=WE,FR;BYHOUR=16;BYMINUTE=45;BYSECOND=0';
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

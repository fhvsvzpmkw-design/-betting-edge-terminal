import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadGrahamScheduleAuthority} from './graham-schedule-authority.mjs';
const read = file => JSON.parse(fs.readFileSync(file,'utf8'));
export function loadTaskAuthority(root=process.cwd()) {
  const registry=read(path.join(root,'data/walters/nfl/graham-task-authority-v1.json'));
  const schedule=loadGrahamScheduleAuthority({root});
  if(registry.schema!==1 || registry.state!=='OPERATIONAL' || registry.authorityId!=='graham-task-authority-v1' || registry.scheduleAuthorityPath!=='data/walters/nfl/graham-schedule-authority-v1.json') throw Error('Graham task authority invalid');
  if(registry.sharedAuthorityPath!=='GRAHAM_SCHEDULED_TASK_AUTHORITY.md' || registry.sharedAuthorityVersion!=='1.0') throw Error('Graham shared authority binding invalid');
  const shared=fs.readFileSync(path.join(root,registry.sharedAuthorityPath),'utf8');
  if(!shared.includes('- Status: OPERATIONAL') || !shared.includes(`- Authority version: ${registry.sharedAuthorityVersion}`)) throw Error('Graham shared authority not operational');
  const runtime=read(path.join(root,'data/walters/nfl/graham-research-runtime-policy-v1.json'));
  const completion=read(path.join(root,'data/walters/nfl/graham-research-completion-policy-v1.json'));
  if(runtime.state!=='OPERATIONAL' || completion.state!=='OPERATIONAL') throw Error('Graham lifecycle policy not operational');
  if(!Array.isArray(registry.tasks) || registry.tasks.length!==schedule.tasks.length) throw Error('Graham task binding count mismatch');
  const ids=new Set(),keys=new Set();
  for(const task of registry.tasks) {
    const expected=schedule.tasks.find(t=>t.taskKey===task.taskKey);
    if(!expected || task.title!==expected.title || !task.automationId || ids.has(task.automationId) || keys.has(task.taskKey) || task.enabled!==true) throw Error('Graham task identity conflict');
    ids.add(task.automationId);keys.add(task.taskKey);
    if(task.researchRuntimeRequired!==(task.taskKey!=='WEEK_ROLLOVER') || task.researchRuntimeRequired!==runtime.appliesToTaskKeys.includes(task.taskKey) || task.researchRuntimeRequired!==completion.appliesToTaskKeys.includes(task.taskKey)) throw Error('Graham task runtime scope mismatch');
    if(!/^GRAHAM_[A-Z0-9_]+_AUTHORITY\.md$/.test(task.authorityPath)) throw Error('Graham authority path invalid');
    const text=fs.readFileSync(path.join(root,task.authorityPath),'utf8');
    for(const marker of ['- Status: OPERATIONAL',`- Authority version: ${task.authorityVersion}`,`- Task key: \`${task.taskKey}\``]) if(!text.includes(marker)) throw Error(`Graham task authority marker missing: ${task.taskKey} ${marker}`);
  }
  return {registry,schedule};
}
export function buildGrahamTaskPrompt(task,registry) {
  return `TASK_KEY = ${task.taskKey}. Use connected GitHub repo fhvsvzpmkw-design/-betting-edge-terminal on authoritative branch main. Before broad source loading, research, number changes or user notification, read ${registry.sharedAuthorityPath} and require Authority version: ${registry.sharedAuthorityVersion} / Status: OPERATIONAL. Resolve this exact task through data/walters/nfl/graham-task-authority-v1.json and the schedule through data/walters/nfl/graham-schedule-authority-v1.json. Read ${task.authorityPath} and require Authority version: ${task.authorityVersion} / Status: OPERATIONAL / Task key: ${task.taskKey}. Execute the common lifecycle/source-access clarifications and the complete task-specific authority; do not substitute copied prompts or remembered instructions. Preserve the current active-week resolver, market isolation, production-calculator ownership and exact remote read-back. ${task.researchRuntimeRequired?'Create and verify one durable RUN_STARTED before expensive work; reuse that runEventId through the scheduled sweep, VERIFIED receipt and terminal runtime read-back. A blocked receipt does not mean completed research.':'This is mechanical WEEK_ROLLOVER, not a research-runtime task: apply the active-week completion gate, verify new-week files before manifest activation, and verify the QB workflow and reconciled board before declaring completion.'} If authority is missing, non-operational, conflicted or unreadable, preserve governed state and report GRAHAM AUTHORITY PREFLIGHT FAILED — ANALYSIS NOT STARTED. Never claim success from scheduler timing or a maintenance workflow alone.`;
}
function ruleParts(rule) {
  const parts=rule.split(';').map(part=>part.split('='));
  if(parts.some(pair=>pair.length!==2) || new Set(parts.map(p=>p[0])).size!==parts.length) throw Error('Malformed or duplicate RRULE fields');
  return JSON.stringify(Object.fromEntries(parts.map(([k,v])=>[k,k==='BYDAY'?v.split(',').sort().join(','):v]).sort((a,b)=>a[0].localeCompare(b[0]))));
}
export function validateLiveGrahamTasks(tasks,{registry,schedule}) {
  if(!Array.isArray(tasks)) throw Error('Live task snapshot missing');
  const result=[];
  for(const expected of registry.tasks) {
    const matches=tasks.filter(t=>t.id===expected.automationId || t.title===expected.title);
    if(matches.length!==1 || matches[0].id!==expected.automationId || matches[0].title!==expected.title) throw Error(`Live task identity/duplicate mismatch: ${expected.taskKey}`);
    const task=matches[0],clock=schedule.tasks.find(t=>t.taskKey===expected.taskKey);
    if(task.is_enabled!==true || task.default_timezone!==schedule.timezone || task.timing_mode!==schedule.timingMode) throw Error(`Live task state/timezone mismatch: ${expected.taskKey}`);
    const lines=task.schedule?.split(/\r?\n/)||[],rules=lines.filter(s=>s.startsWith('RRULE:'));
    if(rules.length!==1 || ruleParts(rules[0].slice(6))!==ruleParts(clock.rrule)) throw Error(`Live task schedule mismatch: ${expected.taskKey}`);
    const starts=lines.filter(s=>s.startsWith('DTSTART'));
    const match=starts.length===1 && starts[0].match(/^DTSTART;TZID=America\/Vancouver:(\d{8})T(\d{2})(\d{2})(\d{2})$/);
    if(!match || `${match[2]}:${match[3]}`!==clock.time || match[4]!=='00') throw Error(`Live task DTSTART mismatch: ${expected.taskKey}`);
    if(task.prompt!==buildGrahamTaskPrompt(expected,registry)) throw Error(`Live task prompt drift: ${expected.taskKey}`);
    result.push({taskKey:expected.taskKey,automationId:task.id,time:clock.time,days:clock.days,state:'VERIFIED'});
  }
  return result;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const authority=loadTaskAuthority();
    if(process.argv[2]==='--snapshot') {
      const snapshot=read(process.argv[3]);
      if(snapshot.schema!==1 || !Number.isFinite(Date.parse(snapshot.capturedAt))) throw Error('Dated live snapshot required');
      console.log(JSON.stringify({capturedAt:snapshot.capturedAt,tasks:validateLiveGrahamTasks(snapshot.tasks,authority)},null,2));
    } else if(process.argv[2]==='--prompts') console.log(JSON.stringify(authority.registry.tasks.map(t=>({id:t.automationId,prompt:buildGrahamTaskPrompt(t,authority.registry)})),null,2));
    else if(process.argv.length===2) console.log('GRAHAM TASK AUTHORITY: PASS // five task bindings and lifecycle scope');
    else throw Error('Usage: graham-task-authority.mjs [--snapshot FILE | --prompts]');
  } catch(error) {console.error(error.message);process.exitCode=1;}
}

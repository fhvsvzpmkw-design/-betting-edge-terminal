#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_ROOT = process.cwd();
const SCHEDULE_PATH = 'data/main-schedule.json';
const MAX_SCHEDULE_LATENESS_MINUTES = 25;
const EARLY_TOLERANCE_MINUTES = 2;

function fail(message){ throw new Error(message); }
function assert(condition,message){ if(!condition) fail(message); }
function readJson(file){ return JSON.parse(fs.readFileSync(file,'utf8')); }
function hhmmToMinutes(value){
  const match=String(value||'').match(/^(\d{2}):(\d{2})$/);
  assert(match,`Invalid HH:MM value: ${value}`);
  const minutes=Number(match[1])*60+Number(match[2]);
  assert(minutes>=0&&minutes<1440,`Invalid clock value: ${value}`);
  return minutes;
}
function vancouverParts(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/Vancouver',hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'
  }).formatToParts(date);
  const obj=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  const hour=Number(obj.hour==='24'?'0':obj.hour);
  const minute=Number(obj.minute);
  const second=Number(obj.second);
  return {
    date:`${obj.year}-${obj.month}-${obj.day}`,
    hour,minute,second,
    minutes:hour*60+minute,
    time:`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`,
    label:`${obj.year}-${obj.month}-${obj.day} ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:${String(second).padStart(2,'0')} America/Vancouver`
  };
}

export function loadMainSchedule(root=DEFAULT_ROOT){
  const schedule=readJson(path.join(root,SCHEDULE_PATH));
  validateMainSchedule(schedule);
  return schedule;
}

export function validateMainSchedule(schedule){
  assert(schedule?.schema===1,'main schedule schema must be 1');
  assert(schedule.id==='main','main schedule id must be main');
  assert(schedule.name==='MAIN BETTING EDGE','main schedule name must be MAIN BETTING EDGE');
  assert(schedule.timezone==='America/Vancouver','schedule timezone must be America/Vancouver');
  assert(schedule.maxDailyPrimaryPulls===5,'primary odds pull cap must remain 5');
  assert(Array.isArray(schedule.slots)&&schedule.slots.length===5,'main schedule must define five slots');

  const canonicalSlots=new Set();
  const slotNames=new Set();
  const pulseTimes=new Set();
  const reportTimes=new Set();
  let featured=0;
  for(const slot of schedule.slots){
    assert(Number.isInteger(slot.canonicalSlot)&&slot.canonicalSlot>=1&&slot.canonicalSlot<=5,'invalid canonicalSlot');
    assert(!canonicalSlots.has(slot.canonicalSlot),`duplicate canonicalSlot ${slot.canonicalSlot}`);canonicalSlots.add(slot.canonicalSlot);
    assert(typeof slot.slot==='string'&&slot.slot&&!slotNames.has(slot.slot),`duplicate/invalid slot ${slot.slot}`);slotNames.add(slot.slot);
    const pulse=hhmmToMinutes(slot.pulseTime),report=hhmmToMinutes(slot.reportTime);
    assert(!pulseTimes.has(slot.pulseTime),`duplicate pulse time ${slot.pulseTime}`);pulseTimes.add(slot.pulseTime);
    assert(!reportTimes.has(slot.reportTime),`duplicate report time ${slot.reportTime}`);reportTimes.add(slot.reportTime);
    assert(report-pulse===10,`${slot.slot} pulse must remain 10 minutes before report`);
    if(slot.featuredVigScope===true)featured++;
  }
  assert([...canonicalSlots].sort((a,b)=>a-b).join(',')==='1,2,3,4,5','canonical slots must remain 1-5');
  assert(featured===3,'main schedule must feature exactly three Vig Scope checkpoints');
  return true;
}

export function scheduleMetadataForReport(report,root=DEFAULT_ROOT){
  const schedule=loadMainSchedule(root);
  const slot=schedule.slots.find(candidate=>candidate.slot===report?.slot);
  assert(slot,`Main schedule has no mapping for report slot ${report?.slot}`);
  return {
    // Preserve the established report/history field names for forward compatibility.
    scheduleProfileId:schedule.id,
    scheduleProfileLabel:schedule.name,
    scheduleProfileSchema:schedule.schema,
    canonicalSlot:slot.canonicalSlot,
    scheduledPulseTime:slot.pulseTime,
    scheduledReportTime:slot.reportTime,
    scheduledLabel:slot.label,
    featuredVigScope:slot.featuredVigScope===true
  };
}

export function resolveWorkflowSchedule({now=new Date(),eventName=process.env.EVENT_NAME||process.env.GITHUB_EVENT_NAME||''}={},root=DEFAULT_ROOT){
  const schedule=loadMainSchedule(root);
  const clock=vancouverParts(now);
  if(eventName==='workflow_dispatch'){
    return {
      shouldRun:true,manual:true,operatingDate:clock.date,scheduleId:schedule.id,scheduleLabel:schedule.name,
      canonicalSlot:null,slotName:'manual',slotId:'MANUAL',plannedPulseTime:'MANUAL',plannedReportTime:null,targetMinutes:null,featuredVigScope:false
    };
  }

  const matches=[];
  for(const slot of schedule.slots){
    const target=hhmmToMinutes(slot.pulseTime);
    let delta=clock.minutes-target;
    if(delta<-720)delta+=1440;
    if(delta>720)delta-=1440;
    if(delta>=-EARLY_TOLERANCE_MINUTES&&delta<=MAX_SCHEDULE_LATENESS_MINUTES)matches.push({slot,target,delta});
  }
  matches.sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta)||a.slot.canonicalSlot-b.slot.canonicalSlot);
  if(!matches.length){
    return {shouldRun:false,manual:false,operatingDate:clock.date,scheduleId:schedule.id,scheduleLabel:schedule.name,clock:clock.time};
  }
  const {slot,target}=matches[0];
  return {
    shouldRun:true,manual:false,operatingDate:clock.date,scheduleId:schedule.id,scheduleLabel:schedule.name,
    canonicalSlot:slot.canonicalSlot,slotName:slot.slot,slotId:slot.pulseTime,plannedPulseTime:slot.pulseTime,
    plannedReportTime:slot.reportTime,targetMinutes:target,featuredVigScope:slot.featuredVigScope===true
  };
}

function outputLines(result){
  const values={
    should_run:result.shouldRun?'true':'false',
    manual:result.manual?'true':'false',
    operating_date:result.operatingDate||'',
    schedule_id:result.scheduleId||'',
    schedule_label:result.scheduleLabel||'',
    canonical_slot:result.canonicalSlot??'',
    slot_name:result.slotName||'',
    slot_id:result.slotId||'',
    planned_pulse_time:result.plannedPulseTime||'',
    planned_report_time:result.plannedReportTime||'',
    target_minutes:result.targetMinutes??'',
    featured_vig_scope:result.featuredVigScope?'true':'false'
  };
  return Object.entries(values).map(([key,value])=>`${key}=${String(value).replace(/\r?\n/g,' ')}`).join('\n');
}
function parseCli(argv){
  const [command,...rest]=argv;
  const args={command};
  for(let index=0;index<rest.length;index++){
    const item=rest[index];
    if(item.startsWith('--')){
      const key=item.slice(2),next=rest[index+1];
      if(next&&!next.startsWith('--')){args[key]=next;index++;}else args[key]=true;
    }
  }
  return args;
}
async function main(){
  const args=parseCli(process.argv.slice(2));
  if(args.command==='validate'||args.command==='self-test'){
    validateMainSchedule(loadMainSchedule());
    console.log('MAIN BETTING EDGE SCHEDULE OK // 5 FIXED SLOTS // 3 FEATURED VIG SCOPE CHECKPOINTS');
    return;
  }
  if(args.command==='resolve-workflow'){
    console.log(outputLines(resolveWorkflowSchedule()));
    return;
  }
  if(args.command==='describe'){
    console.log(JSON.stringify(loadMainSchedule(),null,2));
    return;
  }
  fail('Usage: main-schedule.mjs validate | resolve-workflow | describe');
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(invoked)main().catch(error=>{console.error(error.stack||error.message||String(error));process.exit(1);});

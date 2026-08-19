#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_ROOT = process.cwd();
const PROFILE_PATH = 'data/schedule-profiles.json';
const STATE_PATH = 'data/schedule-state.json';
const MAX_SCHEDULE_LATENESS_MINUTES = 25;
const EARLY_TOLERANCE_MINUTES = 2;

function fail(message){ throw new Error(message); }
function assert(condition,message){ if(!condition) fail(message); }
function readJson(file){ return JSON.parse(fs.readFileSync(file,'utf8')); }
function writeJson(file,value){ fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n','utf8'); }
function hhmmToMinutes(value){
  const m=String(value||'').match(/^(\d{2}):(\d{2})$/);
  assert(m,`Invalid HH:MM value: ${value}`);
  const minutes=Number(m[1])*60+Number(m[2]);
  assert(minutes>=0&&minutes<1440,`Invalid clock value: ${value}`);
  return minutes;
}
function addDays(dateText,days){
  const d=new Date(`${dateText}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate()+days);
  return d.toISOString().slice(0,10);
}
function vancouverParts(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone:'America/Vancouver',hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'
  }).formatToParts(date);
  const obj=Object.fromEntries(parts.map(p=>[p.type,p.value]));
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

export function loadScheduleConfig(root=DEFAULT_ROOT){
  const config=readJson(path.join(root,PROFILE_PATH));
  validateScheduleConfig(config);
  return config;
}
export function loadScheduleState(root=DEFAULT_ROOT){
  const state=readJson(path.join(root,STATE_PATH));
  assert(state?.schema===1,'schedule-state schema must be 1');
  assert(typeof state.defaultProfileId==='string','schedule-state defaultProfileId is required');
  if(!Array.isArray(state.selections)) state.selections=[];
  if(!Array.isArray(state.changes)) state.changes=[];
  return state;
}
export function validateScheduleConfig(config){
  assert(config?.schema===1,'schedule profile schema must be 1');
  assert(config.timezone==='America/Vancouver','schedule timezone must be America/Vancouver');
  assert(config.maxDailyPrimaryPulls===5,'primary odds pull cap must remain 5');
  assert(config.profiles&&typeof config.profiles==='object','profiles object is required');
  const ids=Object.keys(config.profiles);
  assert(ids.length===3,'exactly three seasonal schedule profiles are required');
  for(const id of ids){
    const profile=config.profiles[id];
    assert(profile.id===id,`profile id mismatch: ${id}`);
    assert(Array.isArray(profile.slots)&&profile.slots.length===5,`${id} must define five slots`);
    const canon=new Set();
    const slotNames=new Set();
    let featured=0;
    for(const slot of profile.slots){
      assert(Number.isInteger(slot.canonicalSlot)&&slot.canonicalSlot>=1&&slot.canonicalSlot<=5,`${id} has invalid canonicalSlot`);
      assert(!canon.has(slot.canonicalSlot),`${id} duplicates canonicalSlot ${slot.canonicalSlot}`);canon.add(slot.canonicalSlot);
      assert(typeof slot.slot==='string'&&!slotNames.has(slot.slot),`${id} has duplicate/invalid slot ${slot.slot}`);slotNames.add(slot.slot);
      hhmmToMinutes(slot.pulseTime);hhmmToMinutes(slot.reportTime);
      if(slot.featuredVigScope===true) featured++;
    }
    assert(featured===3,`${id} must feature exactly three Vig Scope checkpoints`);
  }
  return true;
}

export function resolveProfileForDate(dateText,config,state){
  assert(/^\d{4}-\d{2}-\d{2}$/.test(String(dateText||'')),`Invalid operating date: ${dateText}`);
  let profileId=state.defaultProfileId||config.legacyProfileId;
  let source='default';
  const selections=(state.selections||[])
    .filter(x=>x&&typeof x.effectiveOperatingDate==='string'&&typeof x.profileId==='string')
    .slice()
    .sort((a,b)=>String(a.effectiveOperatingDate).localeCompare(String(b.effectiveOperatingDate))||String(a.selectedAt||'').localeCompare(String(b.selectedAt||'')));
  for(const selection of selections){
    if(selection.effectiveOperatingDate<=dateText){profileId=selection.profileId;source='selection';}
  }
  const profile=config.profiles[profileId];
  assert(profile,`Unknown resolved schedule profile: ${profileId}`);
  return {profileId,profile,source,operatingDate:dateText};
}

export function scheduleMetadataForReport(report,root=DEFAULT_ROOT){
  const config=loadScheduleConfig(root);
  const state=loadScheduleState(root);
  const date=String(report?.ts||'').slice(0,10);
  const resolved=resolveProfileForDate(date,config,state);
  const slot=resolved.profile.slots.find(x=>x.slot===report.slot);
  assert(slot,`Profile ${resolved.profileId} has no mapping for report slot ${report.slot}`);
  return {
    scheduleProfileId:resolved.profileId,
    scheduleProfileLabel:resolved.profile.name,
    scheduleProfileSchema:config.schema,
    canonicalSlot:slot.canonicalSlot,
    scheduledPulseTime:slot.pulseTime,
    scheduledReportTime:slot.reportTime,
    scheduledLabel:slot.label,
    featuredVigScope:slot.featuredVigScope===true
  };
}

export function resolveWorkflowSchedule({now=new Date(),eventName=process.env.EVENT_NAME||process.env.GITHUB_EVENT_NAME||''}={},root=DEFAULT_ROOT){
  const config=loadScheduleConfig(root);
  const state=loadScheduleState(root);
  const clock=vancouverParts(now);
  const resolved=resolveProfileForDate(clock.date,config,state);
  if(eventName==='workflow_dispatch'){
    return {
      shouldRun:true,manual:true,operatingDate:clock.date,profileId:resolved.profileId,profileLabel:resolved.profile.name,
      canonicalSlot:null,slotName:'manual',slotId:'MANUAL',plannedPulseTime:'MANUAL',plannedReportTime:null,targetMinutes:null,featuredVigScope:false
    };
  }
  const matches=[];
  for(const slot of resolved.profile.slots){
    const target=hhmmToMinutes(slot.pulseTime);
    let delta=clock.minutes-target;
    if(delta<-720) delta+=1440;
    if(delta>720) delta-=1440;
    if(delta>=-EARLY_TOLERANCE_MINUTES&&delta<=MAX_SCHEDULE_LATENESS_MINUTES){matches.push({slot,target,delta});}
  }
  matches.sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta)||a.slot.canonicalSlot-b.slot.canonicalSlot);
  if(!matches.length){
    return {shouldRun:false,manual:false,operatingDate:clock.date,profileId:resolved.profileId,profileLabel:resolved.profile.name,clock:clock.time};
  }
  const {slot,target}=matches[0];
  return {
    shouldRun:true,manual:false,operatingDate:clock.date,profileId:resolved.profileId,profileLabel:resolved.profile.name,
    canonicalSlot:slot.canonicalSlot,slotName:slot.slot,slotId:slot.pulseTime,plannedPulseTime:slot.pulseTime,
    plannedReportTime:slot.reportTime,targetMinutes:target,featuredVigScope:slot.featuredVigScope===true
  };
}

export function queueProfile(profileId,{now=new Date(),root=DEFAULT_ROOT}={}){
  const config=loadScheduleConfig(root);
  const state=loadScheduleState(root);
  assert(config.profiles[profileId],`Unknown profile: ${profileId}`);
  const clock=vancouverParts(now);
  const cutoff=hhmmToMinutes(config.selectionCutoff||'05:30');
  const effectiveOperatingDate=clock.minutes<cutoff?clock.date:addDays(clock.date,1);
  const resolved=resolveProfileForDate(effectiveOperatingDate,config,state);
  if(resolved.profileId===profileId){
    return {changed:false,profileId,effectiveOperatingDate,selectedLocalDate:clock.date,message:`${config.profiles[profileId].name} already resolves for ${effectiveOperatingDate}`};
  }
  const priorChange=(state.changes||[]).find(x=>x?.selectedLocalDate===clock.date&&x?.changed!==false);
  assert(!priorChange,`A schedule profile change has already been made on ${clock.date}; one change per local day is allowed.`);
  const existing=(state.selections||[]).find(x=>x?.effectiveOperatingDate===effectiveOperatingDate);
  assert(!existing,`The ${effectiveOperatingDate} operating profile is already queued as ${existing?.profileId}.`);
  const selection={
    effectiveOperatingDate,
    profileId,
    selectedAt:now.toISOString(),
    selectedAtVancouver:clock.label,
    selectedLocalDate:clock.date
  };
  state.selections.push(selection);
  state.selections.sort((a,b)=>String(a.effectiveOperatingDate).localeCompare(String(b.effectiveOperatingDate))||String(a.selectedAt).localeCompare(String(b.selectedAt)));
  state.changes.push({...selection,changed:true});
  state.updatedAt=now.toISOString();
  writeJson(path.join(root,STATE_PATH),state);
  return {changed:true,profileId,effectiveOperatingDate,selectedLocalDate:clock.date,message:`Queued ${config.profiles[profileId].name} for ${effectiveOperatingDate} 06:00 Vancouver operating day`};
}

function outputLines(result){
  const values={
    should_run:result.shouldRun?'true':'false',
    manual:result.manual?'true':'false',
    operating_date:result.operatingDate||'',
    profile_id:result.profileId||'',
    profile_label:result.profileLabel||'',
    canonical_slot:result.canonicalSlot??'',
    slot_name:result.slotName||'',
    slot_id:result.slotId||'',
    planned_pulse_time:result.plannedPulseTime||'',
    planned_report_time:result.plannedReportTime||'',
    target_minutes:result.targetMinutes??'',
    featured_vig_scope:result.featuredVigScope?'true':'false'
  };
  return Object.entries(values).map(([k,v])=>`${k}=${String(v).replace(/\r?\n/g,' ')}`).join('\n');
}
function parseCli(argv){
  const [command,...rest]=argv;
  const args={command};
  for(let i=0;i<rest.length;i++){
    const item=rest[i];
    if(item.startsWith('--')){const key=item.slice(2);const next=rest[i+1];if(next&&!next.startsWith('--')){args[key]=next;i++;}else args[key]=true;}
  }
  return args;
}
async function main(){
  const args=parseCli(process.argv.slice(2));
  if(args.command==='validate'||args.command==='self-test'){
    const config=loadScheduleConfig();
    const state=loadScheduleState();
    for(const id of Object.keys(config.profiles)) resolveProfileForDate('2026-08-20',config,{...state,defaultProfileId:id,selections:[]});
    console.log('SCHEDULE PROFILE OK // 3 PROFILES // 5 SLOTS EACH // 3 FEATURED VIG CHECKPOINTS EACH');
    return;
  }
  if(args.command==='resolve-workflow'){
    console.log(outputLines(resolveWorkflowSchedule()));
    return;
  }
  if(args.command==='queue'){
    assert(args.profile,'queue requires --profile');
    const result=queueProfile(String(args.profile));
    console.log(`changed=${result.changed?'true':'false'}`);
    console.log(`profile_id=${result.profileId}`);
    console.log(`effective_operating_date=${result.effectiveOperatingDate}`);
    console.log(`message=${result.message}`);
    return;
  }
  if(args.command==='describe'){
    const config=loadScheduleConfig();const state=loadScheduleState();const date=args.date||vancouverParts().date;
    const resolved=resolveProfileForDate(date,config,state);
    console.log(JSON.stringify({date,profileId:resolved.profileId,profile:resolved.profile},null,2));
    return;
  }
  fail('Usage: schedule-profile.mjs validate | resolve-workflow | queue --profile <mlb|nfl|nba_nhl> | describe [--date YYYY-MM-DD]');
}

const invoked=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(invoked){main().catch(error=>{console.error(error.stack||error.message||String(error));process.exit(1);});}

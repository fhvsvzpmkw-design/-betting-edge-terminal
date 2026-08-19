#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadScheduleConfig, loadScheduleState, scheduleMetadataForReport } from './schedule-profile.mjs';

const root=process.cwd();
function file(p){return path.join(root,p)}
function read(p){return fs.readFileSync(file(p),'utf8')}
function writeIfChanged(p,before,after){if(before!==after){fs.writeFileSync(file(p),after,'utf8');console.log(`UPDATED ${p}`);return true}console.log(`UNCHANGED ${p}`);return false}
function requireAnchor(text,anchor,label){if(!text.includes(anchor))throw new Error(`Missing ${label} anchor`)}
function replaceOnce(text,anchor,replacement,label){requireAnchor(text,anchor,label);const first=text.indexOf(anchor),second=text.indexOf(anchor,first+anchor.length);if(second>=0)throw new Error(`Ambiguous ${label} anchor`);return text.slice(0,first)+replacement+text.slice(first+anchor.length)}

function patchRunner(){
  const p='runner.html',before=read(p);let text=before;
  if(!text.includes('schedule-profile-ui.js')){
    text=replaceOnce(text,'<script src="./assets/report-dashboard-vigscope.js"></script>','<script src="./assets/schedule-profile-ui.js?v=1"></script>\n<script src="./assets/report-dashboard-vigscope.js"></script>','runner dashboard script');
  }
  writeIfChanged(p,before,text);
}

function patchScheduleUi(){
  const p='assets/schedule-profile-ui.js',before=read(p);let text=before;
  text=text.replace('#${BUTTON_ID}{border-color:','#${BUTTON_ID}{grid-column:1/-1!important;border-color:');
  const anchor="    const now=vancouverParts(),today=now.date,tomorrow=addDays(today,1),current=resolveProfile(today),next=resolveProfile(tomorrow);\n    const locked=now.minutes>=360;\n    panel.innerHTML=`";
  if(text.includes(anchor)){
    const replacement="    const now=vancouverParts(),today=now.date,tomorrow=addDays(today,1),current=resolveProfile(today),next=resolveProfile(tomorrow);\n    const renderKey=[today,current?.id,next?.id,state?.updatedAt||''].join('|');\n    if(panel.dataset.renderKey===renderKey&&panel.innerHTML)return;\n    panel.dataset.renderKey=renderKey;\n    const locked=now.minutes>=360;\n    panel.innerHTML=`";
    text=replaceOnce(text,anchor,replacement,'schedule preferences render guard');
  }
  writeIfChanged(p,before,text);
}

function patchOddsRefresh(){
  const p='.github/workflows/odds-refresh.yml',before=read(p);let text=before;
  const scheduleStart=text.indexOf('  schedule:\n');
  const scheduleEnd=text.indexOf('\nconcurrency:',scheduleStart);
  if(scheduleStart<0||scheduleEnd<0)throw new Error('Could not locate odds-refresh schedule block');
  const block=`  schedule:\n    # UTC trigger coverage for every seasonal-profile pulse in both PDT and PST.\n    # The resolver converts current time to America/Vancouver and exits before\n    # any Odds-API request unless this trigger matches the active profile.\n    - cron: '45 0 * * *'\n    - cron: '55 0 * * *'\n    - cron: '45 1 * * *'\n    - cron: '55 1 * * *'\n    - cron: '45 12 * * *'\n    - cron: '45 13 * * *'\n    - cron: '45 14 * * *'\n    - cron: '45 15 * * *'\n    - cron: '15 16 * * *'\n    - cron: '45 16 * * *'\n    - cron: '15 17 * * *'\n    - cron: '45 17 * * *'\n    - cron: '45 18 * * *'\n    - cron: '0 19 * * *'\n    - cron: '0 20 * * *'\n    - cron: '45 20 * * *'\n    - cron: '45 21 * * *'\n    - cron: '55 21 * * *'\n    - cron: '45 22 * * *'\n    - cron: '55 22 * * *'\n    - cron: '45 23 * * *'\n`;
  text=text.slice(0,scheduleStart)+block+text.slice(scheduleEnd);

  if(!text.includes('Resolve active Vancouver schedule profile')){
    const checkout='      - uses: actions/checkout@v4\n';
    text=replaceOnce(text,checkout,checkout+`\n      - name: Resolve active Vancouver schedule profile\n        id: schedule\n        run: node tools/schedule-profile.mjs resolve-workflow >> "$GITHUB_OUTPUT"\n`,'odds checkout');
  }
  const pull='      - name: Pull separate quota-balanced Bet365 + DraftKings odds\n        env:\n';
  if(text.includes(pull))text=replaceOnce(text,pull,'      - name: Pull separate quota-balanced Bet365 + DraftKings odds\n        if: ${{ steps.schedule.outputs.should_run == \'true\' }}\n        env:\n','odds pull step');

  const eventEnv='          EVENT_NAME: ${{ github.event_name }}\n          EVENT_SCHEDULE: ${{ github.event.schedule }}\n';
  if(!text.includes('SCHEDULE_PROFILE_ID:')){
    const profileEnv=eventEnv+
      '          SCHEDULE_PROFILE_ID: ${{ steps.schedule.outputs.profile_id }}\n'+
      '          SCHEDULE_PROFILE_LABEL: ${{ steps.schedule.outputs.profile_label }}\n'+
      '          SCHEDULE_CANONICAL_SLOT: ${{ steps.schedule.outputs.canonical_slot }}\n'+
      '          SCHEDULE_SLOT_NAME: ${{ steps.schedule.outputs.slot_name }}\n'+
      '          SCHEDULE_SLOT_ID: ${{ steps.schedule.outputs.slot_id }}\n'+
      '          SCHEDULE_PLANNED_PULSE_TIME: ${{ steps.schedule.outputs.planned_pulse_time }}\n'+
      '          SCHEDULE_PLANNED_REPORT_TIME: ${{ steps.schedule.outputs.planned_report_time }}\n'+
      '          SCHEDULE_TARGET_MINUTES: ${{ steps.schedule.outputs.target_minutes }}\n'+
      '          SCHEDULE_OPERATING_DATE: ${{ steps.schedule.outputs.operating_date }}\n'+
      '          SCHEDULE_FEATURED_VIG_SCOPE: ${{ steps.schedule.outputs.featured_vig_scope }}\n';
    text=replaceOnce(text,eventEnv,profileEnv,'odds event env');
  }

  const mapStart=text.indexOf('          const SCHEDULE_SLOTS = {');
  if(mapStart>=0){
    const mapEnd=text.indexOf('\n\n          // Reject zombie scheduled jobs',mapStart);
    if(mapEnd<0)throw new Error('Could not close legacy SCHEDULE_SLOTS block');
    text=text.slice(0,mapStart)+'          // Slot timing now comes from data/schedule-profiles.json via the preflight resolver.'+text.slice(mapEnd);
  }

  const fnStart=text.indexOf('          function scheduledSlot() {');
  const fnEnd=text.indexOf('\n\n          function scheduledTriggerIsTooLate',fnStart);
  if(fnStart<0||fnEnd<0)throw new Error('Could not locate scheduledSlot function');
  const scheduledSlot=`          function scheduledSlot() {\n            const profileId = String(process.env.SCHEDULE_PROFILE_ID || '').trim();\n            const profileLabel = String(process.env.SCHEDULE_PROFILE_LABEL || '').trim();\n            const operatingDate = String(process.env.SCHEDULE_OPERATING_DATE || '').trim();\n            if (process.env.EVENT_NAME === 'workflow_dispatch') {\n              return { id: 'MANUAL', targetMinutes: null, manual: true, profileId, profileLabel, operatingDate, canonicalSlot: null, slotName: 'manual', plannedPulseTime: 'MANUAL', plannedReportTime: null, featuredVigScope: false };\n            }\n            const targetRaw = String(process.env.SCHEDULE_TARGET_MINUTES || '').trim();\n            if (!targetRaw) return null;\n            const targetMinutes = Number(targetRaw);\n            if (!Number.isFinite(targetMinutes)) return null;\n            const canonicalRaw = String(process.env.SCHEDULE_CANONICAL_SLOT || '').trim();\n            return {\n              id: String(process.env.SCHEDULE_SLOT_ID || process.env.SCHEDULE_PLANNED_PULSE_TIME || '').trim(),\n              targetMinutes,\n              manual: false,\n              profileId,\n              profileLabel,\n              operatingDate,\n              canonicalSlot: canonicalRaw ? Number(canonicalRaw) : null,\n              slotName: String(process.env.SCHEDULE_SLOT_NAME || '').trim(),\n              plannedPulseTime: String(process.env.SCHEDULE_PLANNED_PULSE_TIME || '').trim(),\n              plannedReportTime: String(process.env.SCHEDULE_PLANNED_REPORT_TIME || '').trim() || null,\n              featuredVigScope: String(process.env.SCHEDULE_FEATURED_VIG_SCOPE || '').toLowerCase() === 'true'\n            };\n          }`;
  text=text.slice(0,fnStart)+scheduledSlot+text.slice(fnEnd);

  if(!text.includes('scheduleMeta: {')){
    const snap="              generatedAtVancouver: clock.label,\n              source: 'Odds-API.io v3',";
    const replacement="              generatedAtVancouver: clock.label,\n              scheduleMeta: {\n                operatingDate: slot.operatingDate || clock.date,\n                profileId: slot.profileId || null,\n                profileLabel: slot.profileLabel || null,\n                canonicalSlot: slot.canonicalSlot,\n                slot: slot.slotName || null,\n                plannedPulseTime: slot.plannedPulseTime || slot.id,\n                plannedReportTime: slot.plannedReportTime || null,\n                featuredVigScope: slot.featuredVigScope === true\n              },\n              source: 'Odds-API.io v3',";
    text=replaceOnce(text,snap,replacement,'odds snapshot metadata');
  }
  writeIfChanged(p,before,text);
}

function patchOddsIndex(){
  const p='.github/workflows/odds-history-index.yml',before=read(p);let text=before;
  if(!text.includes("entry['scheduleMeta']")){
    const anchor="              for key in ('selectedSports', 'requestUsage', 'requestCounts', 'requestCount', 'requestsUsed'):\n";
    const replacement="              if feed.get('scheduleMeta'):\n                  entry['scheduleMeta'] = feed['scheduleMeta']\n\n"+anchor;
    text=replaceOnce(text,anchor,replacement,'odds history schedule metadata');
  }
  writeIfChanged(p,before,text);
}

function patchReportPublisher(){
  const p='tools/report-publication.mjs',before=read(p);let text=before;
  if(!text.includes("from './schedule-profile.mjs'")){
    text=replaceOnce(text,"import os from 'node:os';\n","import os from 'node:os';\nimport { scheduleMetadataForReport } from './schedule-profile.mjs';\n",'publisher imports');
  }
  text=text.replace('function buildIndexEntry(report,sidecar,paths){\n  return {','function buildIndexEntry(report,sidecar,paths,root){\n  const scheduleMetadata=scheduleMetadataForReport(report,root);\n  return {');
  if(!text.includes('...scheduleMetadata')){
    text=replaceOnce(text,'    researchLibraryVersion:sidecar.provenance.researchLibraryVersion\n  };','    researchLibraryVersion:sidecar.provenance.researchLibraryVersion,\n    ...scheduleMetadata\n  };','publisher index schedule metadata');
  }
  text=text.replace('const expected = buildIndexEntry(report,sidecar,paths);','const expected = buildIndexEntry(report,sidecar,paths,root);');
  if(!text.includes('Index schedule metadata does not match')){
    const anchor='    assert(entry.recCount===report.recs.length,`Index recCount does not match report: ${entry.id}`);\n';
    const replacement=anchor+"    if(entry.scheduleProfileId){\n      const scheduleExpected=scheduleMetadataForReport(report,root);\n      for(const [key,value] of Object.entries(scheduleExpected)){\n        assert(normalizedJson(entry[key])===normalizedJson(value),`Index schedule metadata does not match ${key}: ${entry.id}`);\n      }\n    }\n";
    text=replaceOnce(text,anchor,replacement,'publisher schedule verification');
  }
  writeIfChanged(p,before,text);
}

function patchRunHistory(){
  const p='run-history.json',before=read(p);const index=JSON.parse(before);const config=loadScheduleConfig(root);loadScheduleState(root);
  index.schedule_profile_schema=1;
  index.schedule_mode='profiled';
  index.schedule_profile_source='data/schedule-profiles.json';
  index.schedule_state_source='data/schedule-state.json';
  index.schedule_translation='canonical_slot';
  index.operating_day_boundary='06:00 America/Vancouver';
  index.schedule=index.schedule||config.profiles[config.legacyProfileId].slots.map(s=>({slot:s.slot,time:s.reportTime,label:s.label}));
  for(const run of index.runs||[]){
    if(!run?.slot||!run?.ts)continue;
    const meta=scheduleMetadataForReport({slot:run.slot,ts:run.ts},root);
    for(const [key,value] of Object.entries(meta)) if(run[key]===undefined) run[key]=value;
  }
  const after=JSON.stringify(index,null,2)+'\n';writeIfChanged(p,before,after);
}

function patchRegression(){
  const p='.github/workflows/runner-history-regression.yml',before=read(p);let text=before;
  if(!text.includes('tests/schedule-profile.test.mjs')){
    text=text.replaceAll('      - runner.html\n','      - runner.html\n      - assets/schedule-profile-ui.js\n      - data/schedule-profiles.json\n      - data/schedule-state.json\n      - tools/schedule-profile.mjs\n      - tests/schedule-profile.test.mjs\n');
    text += '';
    const anchor='      - name: Run runner session strip regression\n        run: node tests/runner-session-strip-applicability.test.js\n';
    text=replaceOnce(text,anchor,anchor+'      - name: Run schedule profile regression\n        run: node tests/schedule-profile.test.mjs\n','runner regression step');
  }
  writeIfChanged(p,before,text);
}

function main(){
  patchScheduleUi();
  patchRunner();
  patchOddsRefresh();
  patchOddsIndex();
  patchReportPublisher();
  patchRunHistory();
  patchRegression();
  console.log('SCHEDULE PROFILE ARCHITECTURE INSTALL COMPLETE');
}
main();

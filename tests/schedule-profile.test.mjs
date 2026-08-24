#!/usr/bin/env node
import assert from 'node:assert/strict';
import { loadScheduleConfig, loadScheduleState, resolveProfileForDate, scheduleMetadataForReport, validateScheduleConfig } from '../tools/schedule-profile.mjs';

const config=loadScheduleConfig();
const state=loadScheduleState();
assert.equal(validateScheduleConfig(config),true);
assert.deepEqual(Object.keys(config.profiles).sort(),['mlb','nba_nhl','nfl']);
const hhmm=value=>{const [h,m]=String(value).split(':').map(Number);return h*60+m;};
for(const profile of Object.values(config.profiles)){
  assert.equal(profile.slots.length,5,`${profile.id} slot count`);
  assert.deepEqual(profile.slots.map(s=>s.canonicalSlot),[1,2,3,4,5],`${profile.id} canonical order`);
  assert.equal(profile.slots.filter(s=>s.featuredVigScope).length,3,`${profile.id} featured Vig Scope count`);
  assert.equal(new Set(profile.slots.map(s=>s.pulseTime)).size,5,`${profile.id} unique pulse times`);
  assert.equal(new Set(profile.slots.map(s=>s.reportTime)).size,5,`${profile.id} unique report times`);
  for(const slot of profile.slots){
    assert.equal(hhmm(slot.reportTime)-hhmm(slot.pulseTime),10,`${profile.id} ${slot.slot} pulse must be 10 minutes before report`);
  }
}
assert.equal(resolveProfileForDate('2026-08-19',config,state).profileId,'mlb','legacy/current baseline remains MLB');
const translated={
  mlb:config.profiles.mlb.slots.find(s=>s.canonicalSlot===4),
  nfl:config.profiles.nfl.slots.find(s=>s.canonicalSlot===4),
  winter:config.profiles.nba_nhl.slots.find(s=>s.canonicalSlot===4)
};
assert.equal(translated.mlb.slot,'evening');
assert.equal(translated.nfl.slot,'evening');
assert.equal(translated.winter.slot,'evening');
assert.notEqual(translated.mlb.reportTime,translated.nfl.reportTime,'canonical slot translates across different clocks');
const meta=scheduleMetadataForReport({slot:'evening',ts:'2026-08-19T15:24:27-07:00'});
assert.equal(meta.scheduleProfileId,'mlb');
assert.equal(meta.canonicalSlot,4);
assert.equal(meta.scheduledPulseTime,'15:05');
assert.equal(meta.scheduledReportTime,'15:15');
assert.equal(meta.featuredVigScope,true);
console.log('SCHEDULE PROFILE TESTS PASS');

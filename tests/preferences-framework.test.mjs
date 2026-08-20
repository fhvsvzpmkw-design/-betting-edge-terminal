#!/usr/bin/env node
import fs from 'node:fs';

function assert(condition,message){if(!condition)throw new Error(message)}
const prefs=JSON.parse(fs.readFileSync('data/preferences.json','utf8'));
assert(prefs.schema===1,'preferences schema must be 1');
assert(prefs.states&&typeof prefs.states==='object','preferences states are required');
for(const id of ['active','display_only','reserved'])assert(prefs.states[id],`missing preference state ${id}`);
assert(Array.isArray(prefs.modules)&&prefs.modules.length>=4,'preferences must define at least four modules');
const ids=new Set();
for(const module of prefs.modules){
  assert(module&&typeof module==='object','invalid preference module');
  assert(typeof module.id==='string'&&module.id,'preference module id required');
  assert(!ids.has(module.id),`duplicate preference module ${module.id}`);ids.add(module.id);
  assert(typeof module.title==='string'&&module.title,'preference module title required');
  assert(['active','display_only','reserved'].includes(module.state),`invalid state for ${module.id}`);
  assert(typeof module.summary==='string'&&module.summary,'preference module summary required');
  assert(typeof module.controlPolicy==='string'&&module.controlPolicy,'preference module control policy required');
}
const byId=Object.fromEntries(prefs.modules.map(m=>[m.id,m]));
assert(byId.schedule_profile?.state==='display_only','schedule profile must remain display-only');
assert(byId.history_translation?.state==='active','history translation must remain active');
assert(byId.meter_presentation?.state==='reserved','meter presentation must remain reserved until activated');
assert(byId.terminal_interface?.state==='reserved','terminal interface must remain reserved until activated');
console.log('PREFERENCES FRAMEWORK OK // ACTIVE + DISPLAY ONLY + RESERVED MODULE STATES');

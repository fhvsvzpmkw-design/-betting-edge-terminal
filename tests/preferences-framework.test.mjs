#!/usr/bin/env node
import fs from 'node:fs';

function assert(condition,message){if(!condition)throw new Error(message)}
const prefs=JSON.parse(fs.readFileSync('data/preferences.json','utf8'));
const framework=fs.readFileSync('assets/preferences-framework.js','utf8');
const bootstrap=fs.readFileSync('assets/report-dashboard-vigscope.js','utf8');
const contract=fs.readFileSync('BETTING_EDGE_CONTRACT.md','utf8');

assert(prefs.schema===1,'preferences schema must be 1');
assert(prefs.states&&typeof prefs.states==='object','preferences states are required');
for(const id of ['active','display_only','reserved'])assert(prefs.states[id],`missing preference state ${id}`);
assert(Array.isArray(prefs.modules)&&prefs.modules.length>=8,'preferences must define the wave-one modules');

const ids=new Set();
for(const module of prefs.modules){
  assert(module&&typeof module==='object','invalid preference module');
  assert(typeof module.id==='string'&&module.id,'preference module id required');
  assert(!ids.has(module.id),`duplicate preference module ${module.id}`);ids.add(module.id);
  assert(typeof module.title==='string'&&module.title,'preference module title required');
  assert(['active','display_only','reserved'].includes(module.state),`invalid state for ${module.id}`);
  assert(typeof module.summary==='string'&&module.summary,'preference module summary required');
  assert(typeof module.controlPolicy==='string'&&module.controlPolicy,'preference module control policy required');
  if(module.kind==='choice'&&module.state==='active'){
    assert(typeof module.storageKey==='string'&&module.storageKey,`${module.id} storageKey required`);
    assert(Array.isArray(module.options)&&module.options.length>=2,`${module.id} options required`);
    assert(module.options.some(o=>o.value===module.default),`${module.id} default must be an option`);
  }
}

const byId=Object.fromEntries(prefs.modules.map(m=>[m.id,m]));
assert(byId.schedule_profile?.state==='display_only','schedule profile must remain display-only');
assert(byId.history_translation?.state==='active','history translation must remain active');
assert(byId.history_translation?.editable===false,'history translation must not expose an edit control');
for(const id of ['meter_presentation','syndicate_load','startup_screen','history_landing','recommendation_detail']){
  assert(byId[id]?.state==='active',`${id} must be active`);
  assert(byId[id]?.editable===true,`${id} must be editable`);
}
assert(byId.report_card_target?.state==='display_only','report card target must remain display-only for now');
assert(byId.report_card_target?.current===9,'report card target current status must be 9');
assert(byId.report_card_target?.profiles?.join(',')==='7,9,12','report card target profiles must be 7/9/12');
assert(byId.report_card_target?.overflowProtection===true,'report card target overflow protection must remain on');
assert(contract.includes('data/preferences.json'),'production contract must resolve repository preferences for report card target');
assert(contract.includes('id: "report_card_target"'),'production contract must bind the report_card_target module');
assert(contract.includes('current repository setting is **9 cards**'),'production contract must state the current 9-card operational profile');
assert(contract.includes('Fewer than the target is valid'),'production contract must keep the card target soft rather than a quota');
assert(byId.terminal_interface?.state==='reserved','terminal interface must remain reserved');

assert(byId.meter_presentation.options.map(x=>x.value).join(',')==='blocks,rails','meter presentation options drifted');
assert(byId.startup_screen.options.some(x=>x.value==='last_used'),'startup screen must support last used');
assert(byId.history_landing.options.some(x=>x.value==='ledger'),'history landing must support full ledger');
assert(byId.recommendation_detail.options.some(x=>x.value==='remember'),'recommendation detail must support remember last');
assert(byId.syndicate_load.storageKey==='bettingEdge.syndicateSlots.v4','syndicate preference must reuse the existing slot storage');

for(const token of [
  'bettingEdge.syndicateSlots.v4',
  'data-pref-choice',
  'data-pref-syndicate-slot',
  'applyHistoryLanding',
  'applyDetailDefaults',
  'setMeterPresentation'
]) assert(framework.includes(token),`preferences runtime missing ${token}`);

assert(bootstrap.includes('bettingEdge.preferences.meterPresentation'),'VigScope bootstrap must honor saved meter preference before renderer load');
assert(bootstrap.includes('preferences-framework.js?v=3'),'preferences framework cache version must be v3');

console.log('F6 ACTIVE PREFERENCES OK // METER + SYNDICATE + STARTUP + HISTORY LANDING + RECOMMENDATION DETAIL + REPORT CARD TARGET 9');

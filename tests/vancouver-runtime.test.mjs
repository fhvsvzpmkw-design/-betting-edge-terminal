import assert from 'node:assert/strict';
import fs from 'node:fs';
import {plannedMainPulse,validateVancouverRuntime} from '../tools/main-schedule.mjs';
import {buildScheduledOddsRunRequest,resolveOddsRunRequest} from '../tools/odds-run-request.mjs';

assert.equal(validateVancouverRuntime(),true);
class RetiredWinterTimezone {
  constructor(locale,options){this.formatter=new Intl.DateTimeFormat(locale,options);}
  formatToParts(date){
    const wrong=date>=new Date('2026-11-01T09:00:00Z')?new Date(date.getTime()-3600000):date;
    return this.formatter.formatToParts(wrong);
  }
}
assert.throws(()=>validateVancouverRuntime(RetiredWinterTimezone),/VANCOUVER_TIMEZONE_DATA_OUTDATED/,
  'the obsolete winter fallback is identified before any provider calls');

for(const date of ['2026-11-01','2026-12-06','2027-01-15']){
  for(const [canonicalSlot,pulseTime,reportTime] of [
    [1,'05:50','06:00'],[2,'07:50','08:00'],[3,'09:20','09:30'],[4,'15:05','15:15'],[5,'18:05','18:15']
  ]){
    const now=new Date(`${date}T${reportTime}:00-07:00`);
    const request=buildScheduledOddsRunRequest({now,reportTime,requestId:`${date}-${canonicalSlot}`});
    assert.equal(request.requestedAt,now.toISOString());
    assert.equal(request.scheduledAt,new Date(`${date}T${pulseTime}:00-07:00`).toISOString());
    assert.equal(request.operatingDate,date);
    assert.equal(request.canonicalSlot,canonicalSlot);
    assert.equal(resolveOddsRunRequest(JSON.parse(JSON.stringify(request)),{now}).slot.canonicalSlot,canonicalSlot);
  }
}
const history=plannedMainPulse({now:new Date('2025-12-06T14:00:00Z'),reportTime:'06:00'});
assert.equal(history.scheduledAt,'2025-12-06T13:50:00.000Z','historical PST pulses are preserved');
const late=new Date('2026-11-01T15:30:00Z');
const recovered=buildScheduledOddsRunRequest({now:late,reportTime:'08:00'});
assert.equal(recovered.scheduledAt,'2026-11-01T14:50:00.000Z','a delayed task uses the actual same-day pulse');
assert.throws(()=>resolveOddsRunRequest({...recovered,scheduledAt:'2026-11-01T07:50:00-08:00'},{now:late}),/75 minutes/,
  'the wrong-offset Nov. 1 request remains rejected');
assert.throws(()=>buildScheduledOddsRunRequest({now:late,reportTime:'06:00'}),/75 minutes/,
  'repair cannot relabel an expired earlier slot');
assert.throws(()=>buildScheduledOddsRunRequest({now:new Date('2026-11-01T15:30:00Z'),reportTime:'09:30'}),/75 minutes/,
  'repair cannot spend a future slot');
assert.throws(()=>resolveOddsRunRequest(recovered,{now:new Date(late.getTime()+600001)}),/10-minute/,
  'request expiry is unchanged');

const workflow=fs.readFileSync('.github/workflows/odds-refresh.yml','utf8');
assert(workflow.indexOf('uses: actions/setup-node@v4')<workflow.indexOf('node tools/odds-run-request.mjs resolve'));
assert(workflow.indexOf('node tools/main-schedule.mjs validate')<workflow.indexOf('node /tmp/betting-edge-odds-worker.js'));
console.log('VANCOUVER RUNTIME: old-host rejection, all five winter pulses, request roundtrip and unchanged timing safeguards PASS');

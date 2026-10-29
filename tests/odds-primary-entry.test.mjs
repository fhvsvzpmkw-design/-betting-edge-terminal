import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const workflow=fs.readFileSync('.github/workflows/odds-refresh.yml','utf8');
function step(name){
  const marker=`      - name: ${name}\n`;
  const start=workflow.indexOf(marker);
  assert.notEqual(start,-1,`missing workflow step: ${name}`);
  const end=workflow.indexOf('\n      - name:',start+marker.length);
  return workflow.slice(start,end===-1?undefined:end);
}
function shell(name){
  const source=step(name);
  const marker='        run: |\n';
  const start=source.indexOf(marker);
  assert.notEqual(start,-1,`missing shell body: ${name}`);
  return source.slice(start+marker.length).split('\n').map(line=>line.replace(/^ {10}/,'')).join('\n');
}

assert.match(workflow,/push:\n\s+branches: \[main\]\n\s+paths:\n\s+- data\/odds-run-request\.json/);
assert.doesNotMatch(workflow,/^  schedule:/m,'GitHub cron must not compete with report-task requests');
assert.match(workflow,/^  workflow_dispatch:/m,'explicit manual workflow runs remain available');
const entryName='Accept report requests or explicit manual pulls only';
assert(workflow.indexOf(`- name: ${entryName}`)<workflow.indexOf('- name: Checkout main'),
  'retired dispatch must fail before checkout or any network operation');
assert.doesNotMatch(step('Checkout main'),/if:.*always\(/,'checkout cannot bypass a rejected entry');

const entry=shell(entryName);
const sentinel='COLLECTOR_WOULD_RUN';
function enter(event,mode='',scheduledAt=''){
  return spawnSync('bash',['--noprofile','--norc','-e','-o','pipefail','-c',
    `${entry}\nprintf '%s\\n' '${sentinel}'`],{encoding:'utf8',env:{...process.env,
      GITHUB_EVENT_NAME:event,TRIGGER_MODE:mode,SCHEDULED_AT:scheduledAt}});
}
for(const [event,mode,scheduledAt] of [
  ['schedule'],
  ['workflow_dispatch','cloudflare_scheduled','2026-10-19T12:50:00Z'],
  ['workflow_dispatch','cloudflare_scheduled'],
  ['workflow_dispatch','manual','2026-10-19T12:50:00Z'],
  ['workflow_dispatch','unknown'],
  ['repository_dispatch'],
]){
  const result=enter(event,mode,scheduledAt);
  assert.notEqual(result.status,0,`retired/unsupported entry must fail: ${event}/${mode}`);
  assert.match(result.stderr,/Retired .*rejected/);
  assert(!result.stdout.includes(sentinel),'rejected entry cannot proceed to collection');
}
for(const [event,mode] of [['push'],['workflow_dispatch','manual'],['workflow_dispatch']]){
  const result=enter(event,mode);
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,new RegExp(sentinel),'supported entry remains executable');
}

const resolveName='Resolve permanent Main Betting Edge schedule';
const resolver=shell(resolveName);
assert.equal((resolver.match(/node tools\/odds-run-request\.mjs resolve/g)||[]).length,1,
  'push requests resolve their frozen request once');
assert.doesNotMatch(step(resolveName),/cloudflare_scheduled|SCHEDULED_AT|TRIGGER_MODE/,
  'the resolver cannot reinterpret a manual dispatch as an automatic legacy pulse');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'odds-primary-entry-'));
try{
  const output=path.join(temp,'outputs');
  const manual=spawnSync('bash',['--noprofile','--norc','-e','-o','pipefail','-c',resolver],{
    encoding:'utf8',env:{...process.env,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_OUTPUT:output,
      TRIGGER_MODE:'',SCHEDULED_AT:'',EVENT_NAME:'schedule'},
  });
  assert.equal(manual.status,0,manual.stderr);
  const result=fs.readFileSync(output,'utf8');
  assert.match(result,/^should_run=true$/m);
  assert.match(result,/^manual=true$/m,'explicit manual dispatch always uses the shared manual resolver');
  assert.match(result,/^slot_name=manual$/m);
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}

const collector=step('Pull quota-balanced FanDuel + DraftKings odds');
assert.match(collector,/if: steps\.schedule\.outputs\.should_run == 'true' && steps\.gate\.outputs\.execute == 'true'/,
  'accepted entries still require schedule and durable duplicate gates before spending quota');
assert.match(workflow,/group: betting-edge-odds-refresh\n  cancel-in-progress: false/,
  'all supported entries remain serialized');
assert.doesNotMatch(workflow,/Scheduled clock: Cloudflare primary/);
console.log('ODDS PRIMARY ENTRY: report-request/manual acceptance, retired timers fail before network, manual resolver and quota gates PASS');

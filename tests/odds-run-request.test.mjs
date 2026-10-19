import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {readFrozenOddsRunRequest,requestOutputLines,resolveOddsRunRequest} from '../tools/odds-run-request.mjs';
import {recordOddsSlot,shouldCollect,slotForFeed} from '../tools/odds-slot-state.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'odds-request-'));
const tool=path.resolve('tools/odds-run-request.mjs');
const gateTool=path.resolve('tools/odds-slot-state.mjs');
const pulse='2026-10-18T12:50:00.000Z';
const now=new Date('2026-10-18T13:30:00.000Z'); // Report +30m; normal 25m pulse window has closed.
const request={schema:1,mode:'scheduled_recovery',requestId:'recovery-1',requestedAt:now.toISOString(),
  scheduledAt:pulse,operatingDate:'2026-10-18',canonicalSlot:1};
try{
  fs.mkdirSync(path.join(root,'data'));
  fs.copyFileSync('data/main-schedule.json',path.join(root,'data/main-schedule.json'));
  const resolved=resolveOddsRunRequest(request,{now,root});
  assert.equal(resolved.slot.canonicalSlot,1);
  assert.equal(resolved.slot.plannedPulseTime,'05:50');
  assert.equal(resolved.slot.plannedReportTime,'06:00');
  assert.equal(resolved.effectiveEventName,'schedule');
  assert.equal(resolved.requestTriggerSource,'report-task-recovery');
  assert.equal(resolved.requestScheduledAt,pulse);
  assert.equal(shouldCollect({root,slot:resolved.slot}).execute,true,'late report request collects an unfulfilled lane');
  const gateEnv={...process.env,GITHUB_EVENT_NAME:resolved.effectiveEventName,
    REQUEST_TRIGGER_SOURCE:resolved.requestTriggerSource,REQUEST_SCHEDULED_AT:resolved.requestScheduledAt};
  const gate=()=>spawnSync(process.execPath,[gateTool,'check'],{cwd:root,encoding:'utf8',env:gateEnv});
  const dueGate=gate();
  assert.equal(dueGate.status,0,dueGate.stderr);
  assert.match(dueGate.stdout,/execute=true\nreason=main-slot-due/,'workflow gate uses the validated pulse despite the closed normal window');

  const generatedAt=new Date(now.getTime()+120000).toISOString();
  const feed={generatedAt,scheduleMeta:{triggerSource:'report-task-recovery',triggerScheduledAt:pulse,
    operatingDate:'2026-10-18',canonicalSlot:1,slot:'open',plannedPulseTime:'05:50',plannedReportTime:'06:00'}};
  assert.equal(slotForFeed(feed,root).canonicalSlot,1,'late recovery feed remains bound to its controlled pulse');
  fs.writeFileSync(path.join(root,'data/live-odds.json'),JSON.stringify(feed));
  assert.equal(recordOddsSlot({root}).recorded,true,'late recovery writes a durable receipt');
  assert.equal(shouldCollect({root,slot:resolved.slot}).execute,false,'second recovery is suppressed by the same slot receipt');
  assert.match(gate().stdout,/execute=false\nreason=slot-already-receipted/,'CLI gate suppresses duplicate recovery');
  assert.equal(slotForFeed({...feed,scheduleMeta:{...feed.scheduleMeta,plannedPulseTime:'05:51'}},root),null);
  assert.equal(slotForFeed({...feed,generatedAt:'2026-10-18T14:06:00.000Z'},root),null,'recovery feeds cannot extend past 75 minutes');
  fs.writeFileSync(path.join(root,'data/live-odds.json'),JSON.stringify({...feed,generatedAt:'2026-10-18T14:06:00.000Z'}));
  assert.throws(()=>recordOddsSlot({root}),/cannot be receipted/,'an unreceiptable recovery must fail publication rather than finish green');
  fs.writeFileSync(path.join(root,'data/live-odds.json'),JSON.stringify(feed));

  for(const changed of [
    {schema:2},{mode:'push'},{requestId:''},{requestedAt:'invalid'},
    {requestedAt:new Date(now.getTime()-600001).toISOString()},
    {requestedAt:new Date(now.getTime()+120001).toISOString()},
    {canonicalSlot:2},{canonicalSlot:'1'},{operatingDate:'2026-10-17'},
    {scheduledAt:'2026-10-18T12:51:00.000Z'},{scheduledAt:'2026-10-18T12:50:01.000Z'},
    {scheduledAt:'2026-10-17T12:50:00.000Z'},
  ])assert.throws(()=>resolveOddsRunRequest({...request,...changed},{now,root}));
  assert.throws(()=>resolveOddsRunRequest({...request,requestedAt:'2026-10-18T14:06:00Z'},
    {now:new Date('2026-10-18T14:06:00Z'),root}),/75 minutes/);
  assert.throws(()=>resolveOddsRunRequest({...request,scheduledAt:'2026-10-18T14:50:00Z',canonicalSlot:2},
    {now,root}),/75 minutes/,'early recovery must not spend a later slot');

  const outside=new Date('2026-10-18T19:00:00Z');
  const manual=resolveOddsRunRequest({schema:1,mode:'manual',requestId:'manual-1',requestedAt:outside.toISOString()},
    {now:outside,root});
  assert.equal(manual.slot.manual,true);
  assert.equal(manual.slot.canonicalSlot,null);
  assert.equal(manual.effectiveEventName,'workflow_dispatch');
  assert.equal(manual.requestTriggerSource,'manual','established manual feed provenance remains compatible');
  assert.equal(shouldCollect({root,slot:manual.slot}).execute,true,'intentional manual request works outside the schedule');

  const output=Object.fromEntries(requestOutputLines(resolved).split('\n').map(line=>line.split(/=(.*)/s).slice(0,2)));
  assert.equal(output.should_run,'true');
  assert.equal(output.canonical_slot,'1');
  assert.equal(output.effective_event_name,'schedule');
  assert.equal(output.request_scheduled_at,pulse);

  // Request payload comes from the triggering commit, even if main has advanced.
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init');git('config','user.name','odds-request-test');git('config','user.email','test@example.invalid');
  const frozen={schema:1,mode:'manual',requestId:'$(touch should-never-exist)\nexecute=false',requestedAt:new Date().toISOString()};
  fs.writeFileSync(path.join(root,'data/odds-run-request.json'),JSON.stringify(frozen));
  git('add','data');git('commit','-m','Original request');const sha=git('rev-parse','HEAD');
  fs.writeFileSync(path.join(root,'data/odds-run-request.json'),JSON.stringify({schema:999}));
  git('add','data/odds-run-request.json');git('commit','-m','Later request');
  assert.deepEqual(readFrozenOddsRunRequest({root,sha}),frozen);
  assert.throws(()=>readFrozenOddsRunRequest({root,sha:'HEAD; touch should-never-exist'}),/GITHUB_SHA/);
  const cli=spawnSync(process.execPath,[tool,'resolve'],{cwd:root,encoding:'utf8',env:{...process.env,GITHUB_SHA:sha}});
  assert.equal(cli.status,0,cli.stderr);
  assert.match(cli.stdout,/effective_event_name=workflow_dispatch/);
  assert(!cli.stdout.includes(frozen.requestId),'untrusted requestId never becomes workflow output');
  assert(!fs.existsSync(path.join(root,'should-never-exist')),'payload must never execute shell code');
  const invalidCli=spawnSync(process.execPath,[tool,'resolve'],{cwd:root,encoding:'utf8',env:{...process.env,GITHUB_SHA:git('rev-parse','HEAD')}});
  assert.notEqual(invalidCli.status,0,'invalid frozen request fails instead of returning a successful skip');
  assert.match(invalidCli.stderr,/schema must be 1/);

  const workflow=fs.readFileSync('.github/workflows/odds-refresh.yml','utf8');
  assert.match(workflow,/push:\n\s+branches: \[main\]\n\s+paths:\n\s+- data\/odds-run-request\.json/);
  assert.match(workflow,/GITHUB_EVENT_NAME: \$\{\{ steps\.schedule\.outputs\.effective_event_name \|\| github\.event_name \}\}/);
  assert.equal((workflow.match(/node tools\/odds-run-request\.mjs resolve/g)||[]).length,1,'request is resolved once');
  console.log('ODDS RUN REQUEST: frozen commit, validation, delayed recovery, durable dedup, manual override, safe outputs PASS');
}finally{fs.rmSync(root,{recursive:true,force:true});}

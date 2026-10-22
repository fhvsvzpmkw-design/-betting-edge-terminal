import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {publishGrahamValue} from '../tools/publish-graham-value.mjs';

const sourceRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUTPUT='data/history/graham-pinnacle-value.json';
const LEDGER='data/walters/nfl/2026/week-07-daily-market-ledger.json';
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
function write(root,file,data){fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),typeof data==='string'?data:JSON.stringify(data,null,2)+'\n');}
function snapshot(){return {sequence:1,type:'DAILY',pinnacleStatus:'AVAILABLE',pinnacleObservedAt:'2026-10-21T12:00:00Z',grahamAsOf:'2026-10-21T11:00:00Z',grahamFairHome:-4,pinnacleSpreadHome:-3};}
function fixture(t){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'graham-value-publish-'));t.after(()=>fs.rmSync(tmp,{recursive:true,force:true}));
  const remote=path.join(tmp,'origin.git'),work=path.join(tmp,'work');
  git(tmp,'init','--bare','--initial-branch=main',remote);git(tmp,'clone',remote,work);git(work,'config','user.name','test');git(work,'config','user.email','test@example.invalid');
  for(const file of ['tools/build-graham-pinnacle-value.mjs','assets/value-analytics.js'])write(work,file,fs.readFileSync(path.join(sourceRoot,file),'utf8'));
  const settled={gameKey:'2026-W06-A-H',away:'A',home:'H',startTimePacific:'2026-10-18T20:00:00Z',dailySnapshots:[{...snapshot(),pinnacleObservedAt:'2026-10-18T12:00:00Z',grahamAsOf:'2026-10-18T11:00:00Z'}]};
  write(work,'data/walters/nfl/2026/week-06-daily-market-ledger.json',{season:2026,week:6,games:[settled]});
  write(work,'data/walters/nfl/2026/week-06-final-facts-test.json',{verifiedAt:'2026-10-19T12:00:00Z',weeks:[{games:[{...settled,state:'FINAL',homeScore:17,awayScore:10,sourceUrl:'https://example.invalid/final'}]}]});
  write(work,LEDGER,{season:2026,week:7,games:[{gameKey:'2026-W07-N-C',away:'N',home:'C',startTimePacific:'2026-10-25T20:00:00Z',dailySnapshots:[]}]});
  execFileSync(process.execPath,['tools/build-graham-pinnacle-value.mjs'],{cwd:work});
  const initial=JSON.parse(fs.readFileSync(path.join(work,OUTPUT)));
  initial.sourceBlobs=Object.fromEntries(['assets/value-analytics.js','data/walters/nfl/2026/week-06-daily-market-ledger.json','data/walters/nfl/2026/week-06-final-facts-test.json',LEDGER,'tools/build-graham-pinnacle-value.mjs'].map(file=>[file,git(work,'hash-object',file)]));write(work,OUTPUT,initial);
  git(work,'add','.');git(work,'commit','-m','Initial sources and comparison');git(work,'push','origin','main');
  return {tmp,remote,work};
}
function lateSnapshot(work){const data=JSON.parse(fs.readFileSync(path.join(work,LEDGER)));data.games[0].dailySnapshots.push(snapshot());write(work,LEDGER,data);git(work,'add',LEDGER);git(work,'commit','-m','Capture Week 7 pregame pair');git(work,'push','origin','main');}

test('latest captured Week 7 pair becomes pending and preserves historical grades and sources',t=>{
  const {work}=fixture(t),before=JSON.parse(fs.readFileSync(path.join(work,OUTPUT))),sourceBefore=git(work,'rev-parse','HEAD:data/walters/nfl/2026/week-06-final-facts-test.json');
  lateSnapshot(work);const result=publishGrahamValue({root:work});
  const after=JSON.parse(fs.readFileSync(path.join(work,OUTPUT)));
  assert.equal(result.state,'PUBLISHED');assert.equal(result.coverage.settled,1);assert.equal(result.coverage.pending,1);assert.equal(result.coverage.excluded,0);
  assert.deepEqual(after.strategies,before.strategies);assert.deepEqual(after.rows.filter(r=>r.resultState==='FINAL'),before.rows);
  assert.equal(git(work,'rev-parse','HEAD:data/walters/nfl/2026/week-06-final-facts-test.json'),sourceBefore);
  assert.deepEqual(git(work,'diff-tree','--no-commit-id','--name-only','-r',result.publishedCommit).split('\n'),[OUTPUT]);
  assert.equal(git(work,'status','--porcelain'),'');
  assert.deepEqual(after.sourceBlobs,result.sourceBlobs);
});

test('unchanged record skips a timestamp-only publication',t=>{
  const {work}=fixture(t),before=git(work,'rev-parse','HEAD'),body=fs.readFileSync(path.join(work,OUTPUT),'utf8');
  const result=publishGrahamValue({root:work});
  assert.equal(result.state,'CURRENT');assert.equal(git(work,'rev-parse','HEAD'),before);assert.equal(fs.readFileSync(path.join(work,OUTPUT),'utf8'),body);assert.equal(git(work,'status','--porcelain'),'');
});

test('a concurrent source push forces a fresh build instead of rebasing stale output',t=>{
  const {tmp,remote,work}=fixture(t),rival=path.join(tmp,'rival');git(tmp,'clone',remote,rival);git(rival,'config','user.name','rival');git(rival,'config','user.email','rival@example.invalid');
  // Make this publication need to push, then have a second source writer win
  // the branch race immediately before that push is accepted.
  const ledger=JSON.parse(fs.readFileSync(path.join(work,LEDGER)));ledger.games[0].dailySnapshots.push({...snapshot(),pinnacleSpreadHome:-2.5});write(work,LEDGER,ledger);git(work,'add',LEDGER);git(work,'commit','-m','First Week 7 capture');git(work,'push','origin','main');
  git(rival,'pull','--ff-only','origin','main');
  const script=path.join(tmp,'race.mjs'),marker=path.join(tmp,'race.done');
  fs.writeFileSync(script,`import fs from 'node:fs';import {execFileSync} from 'node:child_process';\nconst env={...process.env};for(const k of Object.keys(env))if(k.startsWith('GIT_'))delete env[k];\nconst git=(...args)=>execFileSync('git',args,{cwd:${JSON.stringify(rival)},env,stdio:'pipe'});\nconst f=${JSON.stringify(path.join(rival,LEDGER))};const d=JSON.parse(fs.readFileSync(f));d.games[0].dailySnapshots.push({...d.games[0].dailySnapshots[0],sequence:2,pinnacleObservedAt:'2026-10-22T12:00:00Z',pinnacleSpreadHome:-3.5});fs.writeFileSync(f,JSON.stringify(d,null,2)+'\\n');git('add',${JSON.stringify(LEDGER)});git('commit','-m','Racing newer source');git('push','origin','main');\n`);
  const hook=path.join(work,'.git/hooks/pre-push');fs.writeFileSync(hook,`#!/bin/sh\nif [ ! -f '${marker}' ]; then\n touch '${marker}'\n '${process.execPath}' '${script}'\nfi\n`);fs.chmodSync(hook,0o755);
  const result=publishGrahamValue({root:work});const after=JSON.parse(fs.readFileSync(path.join(work,OUTPUT)));
  assert.equal(result.attempts,2);assert.equal(after.rows.find(r=>r.week===7).snapshotSequence,2);assert.equal(after.rows.find(r=>r.week===7).pinnacleHomeLine,-3.5);
  assert.equal(result.sourceBlobs[LEDGER],git(work,'rev-parse',`origin/main:${LEDGER}`));assert.equal(git(work,'status','--porcelain'),'');
});

test('dirty or non-main user checkouts are refused before fetch or reset',t=>{
  const {work}=fixture(t),before=git(work,'rev-parse','HEAD');write(work,'uncommitted.txt','keep this');
  assert.throws(()=>publishGrahamValue({root:work}),/clean workflow checkout/);assert.equal(fs.readFileSync(path.join(work,'uncommitted.txt'),'utf8'),'keep this');assert.equal(git(work,'rev-parse','HEAD'),before);
  fs.unlinkSync(path.join(work,'uncommitted.txt'));git(work,'switch','-c','user-work');assert.throws(()=>publishGrahamValue({root:work}),/main workflow branch/);assert.equal(git(work,'branch','--show-current'),'user-work');
});

test('source-only changes update the durable freshness proof without changing grades',t=>{
  const {work}=fixture(t),before=JSON.parse(fs.readFileSync(path.join(work,OUTPUT)));
  const ledger=JSON.parse(fs.readFileSync(path.join(work,LEDGER)));ledger.updatedAt='2026-10-22T13:00:00Z';write(work,LEDGER,ledger);git(work,'add',LEDGER);git(work,'commit','-m','Refresh source timestamp');git(work,'push','origin','main');
  const result=publishGrahamValue({root:work}),after=JSON.parse(fs.readFileSync(path.join(work,OUTPUT)));
  assert.equal(result.state,'PUBLISHED');assert.deepEqual(after.rows,before.rows);assert.deepEqual(after.strategies,before.strategies);assert.notEqual(after.sourceBlobs[LEDGER],before.sourceBlobs[LEDGER]);assert.equal(after.sourceBlobs[LEDGER],git(work,'hash-object',LEDGER));
});

test('source advancement after an accepted push is detected during remote readback',t=>{
  const {tmp,remote,work}=fixture(t);lateSnapshot(work);
  const rival=path.join(tmp,'rival');git(tmp,'clone',remote,rival);git(rival,'config','user.name','rival');git(rival,'config','user.email','rival@example.invalid');
  const script=path.join(tmp,'after-push.mjs'),marker=path.join(tmp,'after-push.done');
  fs.writeFileSync(script,`import fs from 'node:fs';import {execFileSync} from 'node:child_process';\nconst env={...process.env};for(const k of Object.keys(env))if(k.startsWith('GIT_'))delete env[k];\nconst git=(...args)=>execFileSync('git',args,{cwd:${JSON.stringify(rival)},env,stdio:'pipe'});git('fetch','origin','main');git('reset','--hard','origin/main');\nconst f=${JSON.stringify(path.join(rival,LEDGER))};const d=JSON.parse(fs.readFileSync(f));d.games[0].dailySnapshots.push({...d.games[0].dailySnapshots[0],sequence:2,pinnacleObservedAt:'2026-10-22T12:00:00Z',pinnacleSpreadHome:-4.5});fs.writeFileSync(f,JSON.stringify(d,null,2)+'\\n');git('add',${JSON.stringify(LEDGER)});git('commit','-m','Source changed during readback');git('push','origin','main');\n`);
  const hook=path.join(remote,'hooks/post-receive');fs.writeFileSync(hook,`#!/bin/sh\nif [ ! -f '${marker}' ]; then\n touch '${marker}'\n '${process.execPath}' '${script}'\nfi\n`);fs.chmodSync(hook,0o755);
  const result=publishGrahamValue({root:work}),after=JSON.parse(fs.readFileSync(path.join(work,OUTPUT)));
  assert.equal(result.attempts,2);assert.equal(after.rows.find(r=>r.week===7).pinnacleHomeLine,-4.5);assert.equal(after.sourceBlobs[LEDGER],git(work,'rev-parse',`origin/main:${LEDGER}`));
});

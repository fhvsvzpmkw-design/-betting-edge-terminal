import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyGrahamIndependentPreflight} from '../tools/graham-independent-preflight.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'graham-independent-preflight-'));
const script=fileURLToPath(new URL('../tools/graham-independent-preflight.mjs',import.meta.url));
const canary='DO_NOT_RENDER_SPORTSBOOK_MARKET_CANARY';
const manifestPath='data/walters/nfl/active-week.json';
const paths={currentNumbers:'data/walters/nfl/2026/week-07-current-numbers.json',
  researchLedger:'data/walters/nfl/2026/week-07-research-ledger.json',
  dailyMarketLedger:'data/walters/nfl/2026/week-07-daily-market-ledger.json',
  personnelLedger:'data/walters/nfl/2026/week-07-personnel-ledger.json',
  researchEventsDir:'data/walters/nfl/2026/week-07-research-events'};
const manifest={schema:1,state:'ACTIVE',authority:'GRAHAM_WEEK_ROLLOVER',season:2026,week:7,
  note:canary,untrustedFutureField:{sportsbook:canary,price:-123}};
const file={season:2026,week:7,freeText:canary,games:[{sportsbook:canary,market:{price:-123,spread:3.5}}]};
const write=(relative,value)=>{const target=path.join(root,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(value));};
const cli=(args=[])=>spawnSync(process.execPath,[script,...args],{encoding:'utf8'});
try{
  write(manifestPath,manifest);
  for(const name of ['currentNumbers','researchLedger','dailyMarketLedger','personnelLedger'])write(paths[name],file);
  const expected={schema:1,state:'VERIFIED_ACTIVE_WEEK',season:2026,week:7,manifestPath,paths,marketViewed:false};
  const result=verifyGrahamIndependentPreflight({root});
  assert.deepEqual(result,expected,'preflight emits only deliberately constructed identity and path fields');
  assert.ok(!JSON.stringify(result).includes(canary),'nested current, market and manifest fields stay inside code');
  const good=cli(['--root',root]);
  assert.equal(good.status,0);assert.equal(good.stderr,'');assert.deepEqual(JSON.parse(good.stdout),expected);
  assert.ok(!good.stdout.includes(canary));
  const defaultRoot=spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8'});
  assert.equal(defaultRoot.status,0);assert.deepEqual(JSON.parse(defaultRoot.stdout),expected,'CLI defaults to its checkout directory');
  for(const name of ['currentNumbers','researchLedger','dailyMarketLedger','personnelLedger']){
    write(paths[name],{...file,week:8});
    assert.throws(()=>verifyGrahamIndependentPreflight({root}),/^Error: GRAHAM_INDEPENDENT_PREFLIGHT_FAILED$/,
      `${name} mismatches still fail without returning source contents`);
    const failed=cli(['--root',root]);
    assert.notEqual(failed.status,0);assert.equal(failed.stdout,'');
    assert.deepEqual(JSON.parse(failed.stderr),{state:'FAIL',code:'GRAHAM_INDEPENDENT_PREFLIGHT_FAILED'});
    assert.ok(!failed.stderr.includes(canary));
    write(paths[name],file);
  }
  fs.unlinkSync(path.join(root,paths.dailyMarketLedger));
  assert.throws(()=>verifyGrahamIndependentPreflight({root}),/GRAHAM_INDEPENDENT_PREFLIGHT_FAILED/,'required ledger presence is still checked');
  write(paths.dailyMarketLedger,file);
  write(manifestPath,{...manifest,state:canary});
  const invalidManifest=cli(['--root',root]);
  assert.notEqual(invalidManifest.status,0);assert.equal(invalidManifest.stdout,'');
  assert.ok(!invalidManifest.stderr.includes(canary),'resolver errors cannot render a malicious manifest value');
  write(manifestPath,manifest);
  const invalidArgs=cli(['--root',root,'--root',root]);
  assert.notEqual(invalidArgs.status,0);assert.equal(invalidArgs.stdout,'');
  assert.equal(JSON.parse(invalidArgs.stderr).code,'GRAHAM_INDEPENDENT_PREFLIGHT_FAILED');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,paths.dailyMarketLedger))),file,'preflight never mutates the market ledger');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,paths.currentNumbers))),file,'preflight never mutates independent numbers');
}finally{fs.rmSync(root,{recursive:true,force:true});}
console.log('Graham independent preflight: active files verified in code; market/source contents and failure values never rendered.');

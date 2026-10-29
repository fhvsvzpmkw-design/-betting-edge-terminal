import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {publishOddsSnapshot} from '../tools/publish-odds-snapshot.mjs';

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'odds-publish-'));
const feed='data/live-odds.json',observer='data/oddspapi-observer.json';
const budget='data/oddspapi-budget-state.json',cache='data/oddspapi-market-cache.json';
const stamp=n=>`2026-11-01T0${n}:00:00.000Z`;
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const write=(root,file,value)=>{
  const bytes=typeof value==='string'?value:JSON.stringify(value,null,3)+'\n';
  const full=path.join(root,file);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,bytes);return bytes;
};
const readRemote=(root,file)=>git(root,'show',`origin/main:${file}`);
function fixture(name){
  const base=path.join(temp,name);fs.mkdirSync(base);
  const bare=path.join(base,'remote.git'),root=path.join(base,'worker'),rival=path.join(base,'rival');
  git(base,'init','--bare','--initial-branch=main',bare);
  git(base,'clone',bare,root);
  git(root,'config','user.name','fixture');git(root,'config','user.email','fixture@example.invalid');
  write(root,feed,{generatedAt:stamp(1),events:[]});
  write(root,observer,{generatedAt:stamp(1),status:'ok'});
  write(root,budget,{schema:1,updatedAt:stamp(1),dayKey:'2026-11-01',monthKey:'2026-11',spent:1});
  write(root,cache,{schema:1,updatedAt:stamp(1),marketDefinitions:[{id:'old'}]});
  write(root,'tools/odds-slot-state.mjs',"import fs from 'node:fs';\nfs.mkdirSync('data/odds-pull-receipts',{recursive:true});\nfs.writeFileSync('data/odds-pull-receipts/test.json',JSON.stringify({recorded:true})+'\\n');\n");
  git(root,'add','.');git(root,'commit','-m','Initial fixture');git(root,'push','origin','HEAD:main');
  git(base,'clone',bare,rival);git(rival,'config','user.name','rival');git(rival,'config','user.email','rival@example.invalid');
  return {root,rival};
}
try{
  // A real rejected non-fast-forward push must preserve the first candidate
  // bytes while rebasing over unrelated work, without a collector available.
  {
    const {root,rival}=fixture('collision');
    const primaryBytes=write(root,feed,{generatedAt:stamp(3),events:[{id:'exact'}]});
    const observerBytes=write(root,observer,{generatedAt:stamp(3),status:'ok',fixtures:[{id:'observed'}]});
    const budgetBytes=write(root,budget,{schema:1,updatedAt:stamp(3),monthKey:'2026-11',dayKey:'2026-11-01',spent:3});
    const cacheBytes=write(root,cache,{schema:1,updatedAt:stamp(3),marketDefinitions:[{id:'cached'}]});
    const result=publishOddsSnapshot({root,validated:true,log(){},beforePush({attempt}){
      if(attempt!==1)return;
      write(rival,'unrelated.json',{preserved:true});
      git(rival,'add','.');git(rival,'commit','-m','Concurrent unrelated work');git(rival,'push','origin','HEAD:main');
    }});
    assert.equal(result.attempt,2);assert.equal(result.snapshotsPublished,true);
    git(root,'fetch','origin','main');
    for(const [file,bytes]of [[feed,primaryBytes],[observer,observerBytes],[budget,budgetBytes],[cache,cacheBytes]])assert.equal(readRemote(root,file)+'\n',bytes,'validated bytes survive a publish collision');
    assert.deepEqual(JSON.parse(readRemote(root,'unrelated.json')),{preserved:true});
    assert.deepEqual(JSON.parse(readRemote(root,'data/odds-pull-receipts/test.json')),{recorded:true});
  }
  // A newer live feed must not discard accounting written after real spending.
  {
    const {root,rival}=fixture('superseded');
    write(root,feed,{generatedAt:stamp(2),events:[{id:'older'}]});
    write(root,observer,{generatedAt:stamp(2),status:'ok'});
    const budgetBytes=write(root,budget,{schema:1,updatedAt:stamp(4),spent:4});
    const cacheBytes=write(root,cache,{schema:1,updatedAt:stamp(4),marketDefinitions:[{id:'kept'}]});
    write(rival,feed,{generatedAt:stamp(3),events:[{id:'newer'}]});
    write(rival,observer,{generatedAt:stamp(3),status:'ok'});
    git(rival,'add','.');git(rival,'commit','-m','Newer odds');git(rival,'push','origin','HEAD:main');
    const result=publishOddsSnapshot({root,validated:true,log(){}});
    assert.equal(result.published,true);assert.equal(result.snapshotsPublished,false);
    git(root,'fetch','origin','main');
    assert.equal(JSON.parse(readRemote(root,feed)).events[0].id,'newer');
    assert.equal(readRemote(root,budget)+'\n',budgetBytes);assert.equal(readRemote(root,cache)+'\n',cacheBytes);
    assert.equal(fs.existsSync(path.join(root,'data/odds-pull-receipts/test.json')),false,'superseded primary is never receipted');
  }
  // The always-run workflow path can persist spent quota after collector or
  // validation failure, while refusing to publish the invalid live candidate.
  {
    const {root}=fixture('failure-state-only');
    write(root,feed,'{invalid JSON after validation failure');
    const budgetBytes=write(root,budget,{schema:1,updatedAt:stamp(3),spent:3});
    const result=publishOddsSnapshot({root,validated:false,log(){}});
    assert.equal(result.snapshotsPublished,false);assert.equal(result.published,true);
    git(root,'fetch','origin','main');
    assert.equal(JSON.parse(readRemote(root,feed)).generatedAt,stamp(1));
    assert.equal(readRemote(root,budget)+'\n',budgetBytes);
    assert.equal(fs.existsSync(path.join(root,'data/odds-pull-receipts/test.json')),false);
  }
  // A stale local accounting file cannot undo a later reconciliation/cache.
  {
    const {root,rival}=fixture('newer-state');
    write(root,budget,{schema:1,updatedAt:stamp(2),spent:2});
    write(root,cache,{schema:1,updatedAt:stamp(2),marketDefinitions:[{id:'stale'}]});
    const budgetBytes=write(rival,budget,{schema:1,updatedAt:stamp(4),spent:4});
    const cacheBytes=write(rival,cache,{schema:1,updatedAt:stamp(4),marketDefinitions:[{id:'newer'}]});
    git(rival,'add','.');git(rival,'commit','-m','Newer accounting');git(rival,'push','origin','HEAD:main');
    const result=publishOddsSnapshot({root,validated:false,log(){}});
    assert.equal(result.published,false);
    git(root,'fetch','origin','main');
    assert.equal(readRemote(root,budget)+'\n',budgetBytes);assert.equal(readRemote(root,cache)+'\n',cacheBytes);
  }
  console.log('ODDS SNAPSHOT PUBLICATION: collision retries, exact bytes, superseded snapshots, failed-stage accounting and newer state PASS; no live API calls.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}

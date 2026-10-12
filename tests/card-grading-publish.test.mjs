import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {publishHistoricalOutputs} from '../tools/publish-card-grading.mjs';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'grading-publish-test-'));
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const write=(root,p,x)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),typeof x==='string'?x:JSON.stringify(x,null,2)+'\n');};
const config=root=>{git(root,'config','user.name','test');git(root,'config','user.email','test@example.invalid');};
const indexPath='data/history/results-index.json',obsPath='data/history/observations/2026-10-11/main.json',receiptPath='data/history/grading/receipts/test.json';
try {
 const origin=path.join(temp,'origin.git'),work=path.join(temp,'work'),other=path.join(temp,'other');
 git(temp,'init','--bare','--initial-branch=main',origin);git(temp,'clone',origin,work);config(work);
 write(work,obsPath,{state:'unresolved'});write(work,indexPath,{generatedAt:'base',cards:[]});
 write(work,'build.mjs',`import fs from 'node:fs';const o=JSON.parse(fs.readFileSync('${obsPath}'));const today=fs.existsSync('today.json');const cards=[{date:'2026-10-11',completionState:o.state},...(today?[{date:'2026-10-12',completionState:'unresolved'}]:[])];fs.writeFileSync('${indexPath}',JSON.stringify({generatedAt:'rebuilt',cards,coverage:{cards:cards.length,completeCards:1},byDate:[{name:'2026-10-11',issued:1,complete:1,unresolved:0,grades:{WIN:1}}]},null,2)+'\\n');`);
 git(work,'add','.');git(work,'commit','-m','base');git(work,'push','origin','HEAD:main');
 git(temp,'clone',origin,other);config(other);write(other,indexPath,{generatedAt:'other-refresh',cards:[]});write(other,'today.json',{issued:true});git(other,'add','.');git(other,'commit','-m','concurrent index refresh and new publication');git(other,'push','origin','HEAD:main');
 write(work,obsPath,{state:'complete',grade:'WIN'});write(work,indexPath,{generatedAt:'graded',cards:[{date:'2026-10-11',completionState:'complete'}]});
 const receipt={targetDate:'2026-10-11',target:{issued:1,complete:1,unresolved:0,grades:{WIN:1}},historicalCoverage:{cards:1,unresolvedCards:0},outputBlobs:{[obsPath]:git(work,'hash-object',obsPath),[indexPath]:git(work,'hash-object',indexPath)}};
 write(work,receiptPath,receipt);const messagePath=path.join(temp,'message.txt');fs.writeFileSync(messagePath,'grade verified history\n');
 const published=publishHistoricalOutputs({root:work,paths:[obsPath,indexPath,receiptPath],receiptPath,messagePath,buildCommands:[['node','build.mjs']]});
 assert.equal(git(work,'rev-parse','origin/main'),published);assert.ok(fs.existsSync(path.join(work,'today.json')));
 const saved=JSON.parse(git(work,'show',`origin/main:${receiptPath}`));assert.equal(saved.outputBlobs[indexPath],git(work,'rev-parse',`origin/main:${indexPath}`));assert.equal(saved.outputBlobs[obsPath],git(work,'rev-parse',`origin/main:${obsPath}`));
 const idx=JSON.parse(git(work,'show',`origin/main:${indexPath}`));assert.equal(idx.cards.length,2);assert.equal(idx.cards[0].completionState,'complete');assert.equal(idx.cards[1].date,'2026-10-12');
 // A concurrent source/observation correction must fail closed rather than choosing a side.
 const conflicting=path.join(temp,'conflicting');git(temp,'clone',origin,conflicting);config(conflicting);
 git(other,'pull','--ff-only','origin','main');write(other,obsPath,{state:'complete',grade:'LOSS'});git(other,'add',obsPath);git(other,'commit','-m','independent observation correction');git(other,'push','origin','HEAD:main');
 write(conflicting,obsPath,{state:'complete',grade:'VOID'});const rejectedReceipt='data/history/grading/receipts/rejected.json';write(conflicting,rejectedReceipt,saved);
 assert.throws(()=>publishHistoricalOutputs({root:conflicting,paths:[obsPath,rejectedReceipt],receiptPath:rejectedReceipt,messagePath,buildCommands:[['node','build.mjs']]}),/refused non-index conflict/);
 assert.equal(JSON.parse(git(conflicting,'show',`origin/main:${obsPath}`)).grade,'LOSS');assert.throws(()=>git(conflicting,'show',`origin/main:${rejectedReceipt}`));
 console.log('Historical publish regressions passed: concurrent index refresh, new current-day publication preserved, receipt hashes reconciled, source conflict refused.');
} finally {fs.rmSync(temp,{recursive:true,force:true});}

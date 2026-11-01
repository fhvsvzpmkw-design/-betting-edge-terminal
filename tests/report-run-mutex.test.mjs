import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const repo=process.cwd();
const controller=pathToFileURL(path.resolve(repo,'tools/report-run.mjs')).href;
const {runCommand,checkpointLockPath}=await import(controller);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'930-lock-test-'));
const rootA=path.join(temp,'a'),rootB=path.join(temp,'b');
const checkpoint='data/report-production/checkpoints/test.json';
const second='data/report-production/checkpoints/other.json';
const fixture=(root,cp=checkpoint)=>{
 fs.mkdirSync(path.join(root,'data'),{recursive:true});
 fs.copyFileSync(path.join(repo,'data/main-schedule.json'),path.join(root,'data/main-schedule.json'));
 const ts='2026-09-01T08:00:00-07:00',feedGeneratedAt='2026-09-01T14:50:00Z',feedBlobSha='1'.repeat(40);
 const state={schema:1,identity:{candidateId:`${ts}|2`,slot:'main',ts,canonicalSlot:2,feedBlobSha},phase:'DRAFT',revision:1,
 report:{ts,slot:'main',label:'test',feedGeneratedAt,bankroll:100,risk:0,counts:{bet:0,lean:0,wait:0,pass:0},recs:[]},
 sidecar:{schema:3,reportReference:{ts,slot:'main',feedGeneratedAt},provenance:{canonicalSlot:2,feedBlobSha},recommendations:[],primaryAnalysis:{receipts:[]}},
 events:[{command:'start',at:'2026-09-01T15:00:00Z',revision:1,phase:'DRAFT'}]};
 fs.mkdirSync(path.dirname(path.join(root,cp)),{recursive:true});fs.writeFileSync(path.join(root,cp),JSON.stringify(state));
};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const signal=path.join(temp,'holding'),release=path.join(temp,'release');
let child;
try{
 fixture(rootA);fixture(rootA,second);fixture(rootB);
 const fileA=path.join(rootA,checkpoint),fileB=path.join(rootB,checkpoint),otherA=path.join(rootA,second);
 const lockA=checkpointLockPath(fileA);
 assert(lockA.startsWith(os.tmpdir()+path.sep));assert(!lockA.startsWith(rootA));
 assert.equal(lockA,checkpointLockPath(path.join(rootA,'data/report-production/checkpoints/../checkpoints/test.json')));
 assert.notEqual(lockA,checkpointLockPath(fileB));assert.notEqual(lockA,checkpointLockPath(otherA));
 const worker=path.join(temp,'worker.mjs');
 fs.writeFileSync(worker,`import fs from 'node:fs';\nimport {runCommand} from '${controller}';\nconst original=fs.writeFileSync;\nfs.writeFileSync=function(file,bytes,...rest){const result=original.call(this,file,bytes,...rest);if(typeof file==='number'){original('${signal}','holding');const deadline=Date.now()+5000;while(!fs.existsSync('${release}')){if(Date.now()>deadline)throw Error('release timeout');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);}}return result;};\nconsole.log(JSON.stringify(runCommand({command:'retime',root:'${rootA}',checkpoint:'${checkpoint}',expectedRevision:1,at:'2026-09-01T08:01:00-07:00'})));\n`);
 child=spawn(process.execPath,[worker],{stdio:['ignore','pipe','pipe']});
 let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);
 const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});
 const deadline=Date.now()+5000;while(!fs.existsSync(signal)){assert(Date.now()<deadline,'first producer did not acquire lock');await delay(10);}
 const metadata=JSON.parse(fs.readFileSync(lockA));assert.equal(metadata.pid,child.pid);assert.equal(metadata.checkpoint,fileA);
 assert.throws(()=>runCommand({command:'retime',root:rootA,checkpoint,expectedRevision:1,at:'2026-09-01T08:01:00-07:00'}),e=>e.code==='EEXIST');
 assert(fs.existsSync(lockA),'collision must not remove the live lock');
 assert.equal(runCommand({command:'retime',root:rootB,checkpoint,expectedRevision:1,at:'2026-09-01T08:01:00-07:00'}).revision,2);
 assert.equal(runCommand({command:'retime',root:rootA,checkpoint:second,expectedRevision:1,at:'2026-09-01T08:01:00-07:00'}).revision,2);
 fs.writeFileSync(release,'go');
 const completed=await exited;assert.equal(completed.code,0,stderr);
 assert.equal(JSON.parse(stdout).revision,2);assert(!fs.existsSync(lockA));
 const again=runCommand({command:'retime',root:rootA,checkpoint,expectedRevision:2,at:'2026-09-01T08:02:00-07:00'});
 assert.equal(again.revision,3);assert.equal(JSON.parse(fs.readFileSync(fileA)).report.ts,'2026-09-01T08:02:00-07:00');assert(!fs.existsSync(lockA));
 const missing='data/report-production/checkpoints/missing.json',missingFile=path.join(rootA,missing);
 assert.throws(()=>runCommand({command:'start',root:rootA,checkpoint:missing}),/complete local draft/);
 assert(!fs.existsSync(checkpointLockPath(missingFile)),'thrown action releases its acquired lock');
 assert(!fs.existsSync(fileA+'.lock'),'no synchronized adjacent lock is created');
 const ghost=fileA+'.lock';fs.writeFileSync(ghost,'');
 assert.equal(runCommand({command:'retime',root:rootA,checkpoint,expectedRevision:3,at:'2026-09-01T08:03:00-07:00'}).revision,4);
 assert(fs.existsSync(ghost),'existing adjacent lock is not auto-deleted');
 console.log(JSON.stringify({sameCheckpointLiveCollisionRejected:true,liveLockPreserved:true,differentRootsIsolated:true,differentCheckpointsIsolated:true,releaseAndReacquire:true,retimeRoundtripRevisions:[2,3,4],thrownActionCleanedUp:true,noAdjacentLockCreated:true,existingAdjacentLockNotDeleted:true}));
}finally{
 if(child&&!child.killed&&child.exitCode===null){try{fs.writeFileSync(release,'go');}catch{} child.kill();}
 fs.rmSync(temp,{recursive:true,force:true});
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verify} from '../tools/grade-issued-card-history.mjs';
const repo=fileURLToPath(new URL('../',import.meta.url)), previous=process.cwd();
const root=fs.mkdtempSync(path.join(os.tmpdir(),'grading-identity-'));
const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value));};
try {
  process.chdir(root);execFileSync('git',['init','-q']);
  const id='70898886', start='2026-10-28T00:00:00Z', generatedAt='2026-10-27T22:19:55.045Z';
  const source='data/history/runs/2026-10-27/evening.json';
  const recs=['away','home'].map(side=>({status:'PASS',title:`Incorrect baseball ${side}`,
    meta:side==='away'?'NCAAF | Sam Houston State Bearkats @ Missouri State Bears':'MLB | Milwaukee Brewers @ Tampa Bay Rays',coreAssessment:{context:{sport:'NCAAF'}},
    feed:{eventId:id,eventDate:start,book:'DraftKings',marketKey:'spread',side,line:-6,
      selectionKey:`${id}|spread|${side}||-6`,priceDecimal:1.9}}));
  write(source,{ts:'2026-10-27T15:43:15-07:00',feedGeneratedAt:generatedAt,recs});
  const original=fs.readFileSync(source,'utf8');
  const snapshot={generatedAt,events:[{id,away:'Sam Houston State Bearkats',home:'Missouri State Bears',date:start,
    sport:{slug:'american-football'},bookmakers:{DraftKings:[{marketKey:'spread',odds:[{hdp:-6,away:'1.90',home:'1.90',
      selectionKeys:{away:recs[0].feed.selectionKey,home:recs[1].feed.selectionKey}}]}]}}]};
  const snapshotBlobSha=execFileSync('git',['hash-object','-w','--stdin'],{input:JSON.stringify(snapshot),encoding:'utf8'}).trim();
  const blobSha=execFileSync('git',['hash-object',source],{encoding:'utf8'}).trim();
  const audit='data/history/grading/corrections/event-70898886-20261027-v1.json';
  const correction={schema:1,kind:'reviewed-historical-event-identity',correctionId:'test-pinned-identity',eventId:id,
    expectedCards:2,identity:{away:'Sam Houston State Bearkats',home:'Missouri State Bears',start,sport:'NCAAF',date:'2026-10-27'},
    issuedRuns:[{path:source,blobSha,feedGeneratedAt:generatedAt,snapshotBlobSha,indices:[0,1]}]};
  write(audit,correction);write('data/history/odds-index.json',{entries:[{generatedAt,snapshotBlobSha}]});
  const rows=recs.map((rec,index)=>({rec,index,sourceRun:source,date:'2026-10-27',feedGeneratedAt:generatedAt}));
  const group=()=>({id,rows:structuredClone(rows),identityRows:structuredClone(rows),firstDate:'2026-10-27'});
  const resultJson=(date=start)=>({events:[{id:'verified-football',competitions:[{id:'game',date,
    status:{type:{completed:true,description:'Final'}},competitors:[
      {homeAway:'away',team:{displayName:'Sam Houston Bearkats'},score:'3'},
      {homeAway:'home',team:{displayName:'Missouri State Bears'},score:'24'}]}]}]});
  const final=await verify(group(),async()=>resultJson());
  assert.equal(final.status,'final');assert.equal(final.homeScore,24);assert.equal(final.identityCorrection.correctionId,correction.correctionId);
  write('verification.json',{events:[final]});
  execFileSync(process.execPath,[path.join(repo,'tools/verify-issued-results.mjs'),source,'verification.json','--output','observations.json']);
  const grades=JSON.parse(fs.readFileSync('observations.json')).recommendations.map(row=>row.completion);
  assert.deepEqual(grades.map(row=>row.grade),['LOSS','WIN']);
  assert.ok(grades.every(row=>row.hypothetical&&!row.official&&row.identityCorrection.blobSha));
  assert.equal(fs.readFileSync(source,'utf8'),original,'Repair must never rewrite issued labels or selections');
  assert.equal((await verify(group(),async()=>({events:[]}))).unresolvedReason,'result_not_verified');
  assert.equal((await verify(group(),async()=>resultJson('2026-10-28T01:00:00Z'))).unresolvedReason,'identity_conflict');
  let calls=0;const never=async()=>{calls++;return resultJson();};
  const extra=group();extra.identityRows.push({...structuredClone(rows[0]),index:9});
  assert.equal((await verify(extra,never)).unresolvedReason,'identity_conflict');
  const changed=group();changed.rows[0].rec.feed.line=-7;
  assert.equal((await verify(changed,never)).unresolvedReason,'identity_conflict');
  fs.appendFileSync(source,' ');
  assert.equal((await verify(group(),never)).unresolvedReason,'identity_conflict');
  fs.writeFileSync(source,original);
  correction.issuedRuns[0].snapshotBlobSha='0'.repeat(40);write(audit,correction);
  assert.equal((await verify(group(),never)).unresolvedReason,'identity_conflict');
  assert.equal(calls,0,'Changed or unreviewed bindings must fail before provider calls');
} finally {process.chdir(previous);fs.rmSync(root,{recursive:true,force:true});}
console.log('Pinned identity recovery passed: independent provider, spread signs, immutable issuance, audit, changed-source/row/snapshot and start-time rejection.');

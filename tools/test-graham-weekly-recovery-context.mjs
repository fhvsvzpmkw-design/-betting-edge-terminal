import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {weeklyRecoveryContext,grahamWeekPaths} from './graham-active-week.mjs';
import {evaluateWeeklyEvidence,loadWeeklyEvidence,gitBlob} from './graham-weekly-evidence.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const root=fs.mkdtempSync(path.join(os.tmpdir(),'graham-recovery-context-'));
const put=(p,v)=>{const a=path.join(root,p);fs.mkdirSync(path.dirname(a),{recursive:true});fs.writeFileSync(a,JSON.stringify(v));};
const active='data/walters/nfl/active-week.json',power='data/walters/nfl-power-ratings-ledger.json';
const manifest=week=>({schema:1,season:2026,week,state:'ACTIVE',authority:'GRAHAM_WEEK_ROLLOVER'});
const bundle=(sourceWeek,recordedAt)=>({schema:1,season:2026,sourceWeek,marketViewed:false,recordedAt,games:[]});
const ev=(week,name)=>`data/walters/nfl/2026/week-${String(week).padStart(2,'0')}-weekly-evidence/${name}.json`;
const fixture=()=>{
 put(active,manifest(3));
 for(const week of [1,2,3,4])for(const p of Object.values(grahamWeekPaths(2026,week).relative).filter(p=>p.endsWith('.json')))put(p,{season:2026,week});
 put(power,{season:2026,teams:[],weekly90_10:{schema:1,season:2026,sourceWeek:2,targetWeek:3,state:'PARTIAL_BLOCKED',gamesUpdated:0,teamsUpdated:0,blockedGames:[{gameKey:'w2'}],previousReceipts:[{sourceWeek:1,targetWeek:2,state:'PARTIAL_BLOCKED',gamesUpdated:6,teamsUpdated:12,blockedGames:[{gameKey:'w1'}]}]}});
 put(ev(1,'newer-old-week'),bundle(1,'2026-09-25T00:00:00Z'));
 put(ev(2,'first'),bundle(2,'2026-09-22T17:00:00Z'));put(ev(2,'second'),bundle(2,'2026-09-22T18:00:00Z'));
 put(ev(2,'source-capture'),{schema:1,players:[]});put(ev(3,'next-week'),bundle(3,'2026-09-29T17:00:00Z'));
};
let n=0;const test=(name,fn)=>{fn();n++;console.log('PASS '+name);};
try{
 fixture();
 test('active Week 3 selects Week 2, not a newer Week 1 audit',()=>{const c=weeklyRecoveryContext({root});assert.equal(c.sourceWeek,2);assert.equal(c.targetWeek,3);assert.deepEqual(c.evidencePathsNewestFirst,[ev(2,'second'),ev(2,'first')]);assert.equal(c.olderUnresolvedReceipts[0].gamesUpdated,6);});
 test('context discovery is idempotent and never writes ratings or manifest',()=>{const before=[active,power].map(p=>fs.readFileSync(path.join(root,p),'utf8'));assert.deepEqual(weeklyRecoveryContext({root}),weeklyRecoveryContext({root}));assert.deepEqual([active,power].map(p=>fs.readFileSync(path.join(root,p),'utf8')),before);});
 test('zero changes does not cancel initial baseline responsibility',()=>{const c=weeklyRecoveryContext({root});assert.equal(c.currentReceipt.gamesUpdated,0);assert.equal(c.initialBaselineOwner,'TUESDAY_BASELINE');assert.match(c.baselineRule,/initial.*independently/i);});
 test('counts are read dynamically rather than fixed at six or sixteen',()=>{const p=read(path.join(root,power));p.weekly90_10.gamesUpdated=3;p.weekly90_10.teamsUpdated=6;put(power,p);assert.equal(weeklyRecoveryContext({root}).currentReceipt.gamesUpdated,3);fixture();});
 test('malformed current-week evidence is visible and not silently discarded',()=>{fs.writeFileSync(path.join(root,ev(2,'broken')),'{');const c=weeklyRecoveryContext({root});assert.equal(c.state,'EVIDENCE_DISCOVERY_BLOCKED');assert.equal(c.discoveryErrors[0].path,ev(2,'broken'));fs.unlinkSync(path.join(root,ev(2,'broken')));});
 test('wrong-week bundle in current folder cannot become current evidence',()=>{put(ev(2,'wrong'),bundle(1,'2026-09-26T00:00:00Z'));const c=weeklyRecoveryContext({root});assert.equal(c.state,'EVIDENCE_DISCOVERY_BLOCKED');assert.ok(!c.evidencePathsNewestFirst.includes(ev(2,'wrong')));fs.unlinkSync(path.join(root,ev(2,'wrong')));});
 test('unresolved active authority fails before dated recovery selection',()=>{put(active,{...manifest(3),state:'PENDING'});assert.throws(()=>weeklyRecoveryContext({root}),/not ACTIVE/);put(active,manifest(3));});
 test('next rollover selects source Week 3 and preserves older unresolved receipts',()=>{put(active,manifest(4));const c=weeklyRecoveryContext({root});assert.equal(c.sourceWeek,3);assert.equal(c.receiptState,'MISSING_MATCHING_RECEIPT');assert.deepEqual(c.evidencePathsNewestFirst,[ev(3,'next-week')]);assert.deepEqual(c.olderUnresolvedReceipts.map(r=>r.sourceWeek),[2,1]);put(active,manifest(3));});
 test('initial Week 1 is explicitly not applicable to completed-game learning',()=>{put(active,manifest(1));assert.equal(weeklyRecoveryContext({root}).state,'NOT_APPLICABLE');put(active,manifest(3));});
 test('prior schedule identity is verified',()=>{put(grahamWeekPaths(2026,2).relative.currentNumbers,{season:2026,week:1});assert.throws(()=>weeklyRecoveryContext({root}),/PRIOR_WEEK_IDENTITY/);fixture();});
 const file='data/walters/nfl/2026/week-02-weekly-evidence/2026-09-22-targeted-final-coverage-review.json';
 const b=read(file),inputs={personnel:read('data/walters/nfl/2026/week-02-personnel-ledger.json'),prior:read('data/walters/nfl/2026/week-02-current-numbers.json'),registry:read('data/walters/nfl/player-values/player-values-2026-v1.json'),calibration:read('data/walters/nfl/personnel-calibration-v1.json'),production:read('data/walters/nfl/personnel-production-current.json'),matchupProduction:read('data/walters/nfl/matchup-production-current.json')};
 test('three actual role reviews retain exact locked values without releasing pairs',()=>{const x=evaluateWeeklyEvidence({bundle:b,...inputs});assert.equal(x.readyGames,0);assert.equal(x.blockedGames,3);assert.deepEqual(x.games.flatMap(g=>g.caseReviews.map(c=>[c.team,c.state,c.estimate?.injuryLoss])),[['TB','CASE_ESTIMATE_ONLY',0.3],['HOU','CASE_ESTIMATE_ONLY',0.4],['BAL','CASE_ESTIMATE_ONLY',0.7]]);});
 // Local Pages artifacts cannot prove Git ancestry; only CI can pass this check.
 if(!fs.existsSync('.git')){
  console.log('NOT_EXERCISED locally: pinned Git ancestry; required in CI');
  if(process.env.GITHUB_ACTIONS==='true')throw Error('Git checkout required');
 }else test('new bundle passes pinned historical input binding on GitHub',()=>{
  const bytes=fs.readFileSync(file);const x=loadWeeklyEvidence(process.cwd(),{path:file,blobSha:gitBlob(bytes)},{season:2026,sourceWeek:2,effectiveAt:b.recordedAt});assert.equal(x.readyGames,0);assert.equal(x.blockedGames,3);
 });
}finally{fs.rmSync(root,{recursive:true,force:true});}
console.log(`WEEKLY RECOVERY CONTEXT: ${n} checks; actual Git binding must be verified in CI.`);

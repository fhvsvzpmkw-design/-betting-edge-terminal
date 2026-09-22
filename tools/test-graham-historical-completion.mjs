import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {evaluateWeeklyEvidence,loadWeeklyEvidence,gitBlob} from './graham-weekly-evidence.mjs';
const file='data/walters/nfl/2026/week-02-weekly-evidence/2026-09-22-cle-tb-complete-role-estimates.json';
const bytes=fs.readFileSync(file),bundle=JSON.parse(bytes),expected={season:2026,sourceWeek:2,effectiveAt:bundle.recordedAt};
execFileSync('git',['hash-object','-w','--stdin'],{input:bytes});
const inputs={bundle};
for(const [k,p] of Object.entries({personnel:'data/walters/nfl/2026/week-02-personnel-ledger.json',prior:'data/walters/nfl/2026/week-02-current-numbers.json',registry:'data/walters/nfl/player-values/player-values-2026-v1.json',calibration:'data/walters/nfl/personnel-calibration-v1.json',production:'data/walters/nfl/personnel-production-current.json',matchupProduction:'data/walters/nfl/matchup-production-current.json'}))inputs[k]=JSON.parse(execFileSync('git',['cat-file','blob',bundle.inputBlobs[p]],{maxBuffer:16*1024*1024}));
inputs.supplementalPlayers=[{player:'Derek Barnett',eaPlayerId:'12530',position:'EDGE',maddenOvr:73,waltersPoints:.2,valueStatus:'CALIBRATED'}];
let n=0;function test(name,fn){fn();n++;console.log('PASS '+name);}
function blocked(edit,pattern){const f=structuredClone(inputs);edit(f);const g=evaluateWeeklyEvidence(f).games[0];assert.equal(g.state,'BLOCKED');assert.ok(g.blockers.some(b=>pattern.test(b.code)),JSON.stringify(g.blockers));}
test('complete real pair binds supplemental source and returns CLE .900 TB .300',()=>{const r=loadWeeklyEvidence(process.cwd(),{path:file,blobSha:gitBlob(bytes)},expected);assert.equal(r.readyGames,1);assert.deepEqual(r.games[0].teams.map(t=>[t.team,t.injuryLoss]),[['CLE',.9],['TB',.3]]);assert.ok(r.games[0].teams.every(t=>t.valueBasis==='INCLUDES_GRAHAM_MODEL_ESTIMATE'));});
test('zero proof cannot hide a positive healthy value',()=>blocked(f=>f.bundle.games[0].teams[0].cases[0].resolution='ZERO_CALIBRATED_LOSS',/ZERO_LOSS_PROOF/));
test('missing healthy identity cannot use zero proof',()=>blocked(f=>{const c=f.bundle.games[0].teams[0].cases.find(c=>c.resolution==='ZERO_CALIBRATED_LOSS');c.player='Unknown';c.eaPlayerId='missing';},/LOCKED_PLAYER/));
test('partial exposure requires equal relief values',()=>blocked(f=>{f.bundle.games[0].teams[1].cases.find(c=>c.resolution==='PARTIAL_VALUE_INVARIANT').replacements=[{player:'Alex Anzalone',eaPlayerId:'12613'}];},/PARTIAL_VALUE/));
test('partial exposure cannot silently assume normal active effectiveness',()=>blocked(f=>delete f.bundle.games[0].teams[1].cases.find(c=>c.resolution==='PARTIAL_VALUE_INVARIANT').activeEffectivenessConvention,/PARTIAL_VALUE/));
test('archived injury cannot be hidden in roster exclusions',()=>blocked(f=>f.bundle.games[0].teams[0].coverageExclusions.push({player:'Teven Jenkins',category:'CAMP_ROSTER_ONLY',rationale:'Synthetic invalid exclusion',sourceIds:['cle-roster-final'],estimateAcknowledged:true,establishedRegularSeasonRole:false,assumptionRationale:'invalid'}),/EXCLUSION/));
test('camp-role exclusion must disclose assumption',()=>blocked(f=>delete f.bundle.games[0].teams[1].coverageExclusions.find(c=>c.category==='CAMP_ROSTER_ONLY').estimateAcknowledged,/CAMP_ROLE/));
test('absent supplemental identity stays missing',()=>blocked(f=>f.supplementalPlayers=[],/LOCKED_PLAYER/));
test('supplement binding rejects source bytes from a different path',()=>{const b=structuredClone(bundle);b.valueSupplements[0].blobSha='0'.repeat(40);const data=Buffer.from(JSON.stringify(b));execFileSync('git',['hash-object','-w','--stdin'],{input:data});assert.throws(()=>loadWeeklyEvidence(process.cwd(),{path:file,blobSha:gitBlob(data)},expected),/SUPPLEMENT_PATH_BINDING/);});
console.log(`HISTORICAL COMPLETION: ${n} PASS`);

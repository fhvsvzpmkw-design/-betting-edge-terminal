import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {sameGrahamPublication,writeGrahamPublication} from '../tools/graham-publication.mjs';

const publication=()=>({season:2026,week:7,generatedAt:'2026-10-20T23:00:00Z',baselineStatus:'CURRENT_BASELINE_COMPLETE',
  lastResearchAt:'2026-10-20T22:59:00Z',weeklyReadiness:{generatedAt:'2026-10-20T23:00:00Z',counts:{historicalApplied:14},stalled:false},
  games:[{gameKey:'2026-W07-A-B',grahamFairHome:-3,grahamAsOf:'2026-10-20T22:59:00Z',personnelUnresolvedCases:['case'],pinnacleSpreadHome:-2,pinnacleObservedAt:'2026-10-20T22:58:00Z'}]});

test('overlapping unchanged checks preserve bytes and the actual publication timestamp',()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'graham-publication-'));
  try{
    const file=path.join(directory,'terminal.json'),first=publication();
    assert.equal(writeGrahamPublication(file,first,{terminal:true}),true);
    const bytes=fs.readFileSync(file,'utf8'),again=structuredClone(first);
    again.generatedAt=again.weeklyReadiness.generatedAt='2026-10-20T23:02:00Z';
    assert.equal(writeGrahamPublication(file,again,{terminal:true}),false);
    assert.equal(fs.readFileSync(file,'utf8'),bytes);
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

for(const [name,change] of [
  ['a changed fair',p=>p.games[0].grahamFairHome=-3.5],
  ['a newly resolved personnel input',p=>p.games[0].personnelUnresolvedCases=[]],
  ['new completed research',p=>p.lastResearchAt='2026-10-20T23:01:00Z'],
  ['a new fair observation time',p=>p.games[0].grahamAsOf='2026-10-20T23:01:00Z'],
  ['a new market observation',p=>p.games[0].pinnacleObservedAt='2026-10-20T23:01:00Z'],
  ['a newly stalled recovery',p=>p.weeklyReadiness.stalled=true],
  ['a different active week',p=>p.week=8],
  ['a changed bound input',p=>p.inputBlobs={power:'b'.repeat(40)}],
])test(name+' still requires publication',()=>{
  const before=publication(),after=structuredClone(before);change(after);
  assert.equal(sameGrahamPublication(before,after,{terminal:true}),false);
});

test('readiness ignores only its own generated clock',()=>{
  const first={generatedAt:'2026-10-20T23:00:00Z',state:'BLOCKED',historicalGames:[{stalled:false}]};
  assert.equal(sameGrahamPublication(first,{...first,generatedAt:'2026-10-20T23:02:00Z'}),true);
  assert.equal(sameGrahamPublication(first,{...first,historicalGames:[{stalled:true}]}),false);
});

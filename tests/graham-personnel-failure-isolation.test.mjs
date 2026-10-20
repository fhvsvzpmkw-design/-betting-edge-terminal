import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
test('an unrated identity remains visible without starving a calibrated zero case in the same game',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'graham-personnel-isolation-'));
 try{
  const files=['personnel-production-current.json','player-values/stage2-current.json','stage3/stage3-current.json','player-values/player-values-2026-v1.json','personnel-calibration-v1.json'];
  for(const rel of files){const src='data/walters/nfl/'+rel,dest=path.join(root,src);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(src,dest);}
  const registry=JSON.parse(fs.readFileSync('data/walters/nfl/player-values/player-values-2026-v1.json'));
  const p=registry.players.find(p=>p.valueStatus==='CALIBRATED'&&p.waltersPoints===0&&p.position==='DT');
  const sourceRefs=['https://example.invalid/official-fixture'];
  const common={gameKey:'2026-W07-NE-CHI',team:'NE',side:'AWAY',availabilityStatus:'UNRESOLVED',reason:'Explicit test fixture for isolation',sourceRefs,availabilitySourceRefs:sourceRefs,roleSourceRefs:sourceRefs,reopenOn:'New verified availability or identity evidence'};
  const input={schema:1,state:'READY',season:2026,week:7,batchId:'isolation-fixture',effectiveAt:'2026-10-20T23:00:00Z',marketViewed:false,cases:[{...common,personnelEventId:'zero',caseKey:'zero',player:p.player,playerEaId:p.eaPlayerId,resolutionStatus:'RESOLVED_MODEL_ESTIMATE',replacementModel:{modelId:'graham-replacement-role-estimate-v1',resolution:'ZERO_CALIBRATED_LOSS',estimateAcknowledged:true,assumptionRationale:'Calibrated zero is invariant to unavailable duty; no availability claim or replacement value invented.',replacements:[]}},{...common,personnelEventId:'unrated',caseKey:'unrated',player:'Unrated fixture identity',availabilityStatus:'IR',resolutionStatus:'FAIL_CLOSED_UNRESOLVED',failClosedCode:'LOCKED_IDENTITY_UNAVAILABLE'}]};
  const write=(p,j)=>{const dest=path.join(root,'data/walters/nfl/'+p);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(j));};
  write('personnel-staging.json',input);write('2026/week-07-current-numbers.json',{season:2026,week:7,games:[{gameKey:common.gameKey,grahamExactFairHome:0,grahamFairHome:0,numberStatus:'READY',adjustments:[]}]});write('2026/week-07-research-ledger.json',{season:2026,week:7,sweeps:[]});
  execFileSync(process.execPath,[path.resolve('tools/apply-graham-personnel-staging.mjs')],{cwd:root,stdio:'pipe'});
  const ledger=JSON.parse(fs.readFileSync(path.join(root,'data/walters/nfl/2026/week-07-personnel-ledger.json'))),board=JSON.parse(fs.readFileSync(path.join(root,'data/walters/nfl/2026/week-07-current-numbers.json')));
  assert.equal(ledger.currentCases.zero.valueStatus,'NUMERIC_ELIGIBLE');assert.equal(ledger.currentCases.zero.availabilityStatus,'UNRESOLVED');assert.equal(ledger.currentCases.zero.rawTeamContributionDelta,0);assert.equal(ledger.currentCases.unrated.valueStatus,'FAIL_CLOSED_NO_NUMERIC_MOVE');assert.equal(ledger.events.length,2);assert.equal(board.games[0].grahamExactFairHome,0);assert.equal(board.games[0].personnelUnresolvedCases.length,1);assert.equal(board.games[0].personnelNonmaterialAvailabilityCases.length,1);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

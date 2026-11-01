import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {DEFAULT_POLICY as policy,buildShortlist,validateResearch,updateCallsLedger,newCallsLedger,callsSummary,gitBlobSha,americanPriceLimit} from '../tools/guy-daily-selection.mjs';

const at='2026-11-01T15:30:00Z',observed='2026-11-01T15:20:00Z',researched='2026-11-01T15:25:00Z';
const source=()=>[{url:'https://club.test/official-preview',observedAt:observed}];
function fixture(){
 const games=Array.from({length:4},(_,i)=>{
  const g={sport:'NHL',eventId:'g'+i,home:'Home '+i,away:'Away '+i,startTime:`2026-11-${i===3?'02':'01'}T${i===3?'01':22+i}:00:00Z`};
  g.markets=['home','away'].map(side=>({marketDetail:'full_game_moneyline',side,quotes:[{book:'DraftKings',side,line:null,priceDecimal:side==='home'?2:2.2,
   selectionKey:g.eventId+'|ml|'+side,observedAt:observed,benchmark:{edgeProbabilityPoints:-1,observedAt:observed}}]}));
  g.externalModels=['home','away'].map(side=>({...g,markets:undefined,sourceId:'moneypuck',sourceGameId:'source-'+i,recordId:'record-'+i+'-'+side,kind:'OUTCOME_PROBABILITY',
   marketDetail:'full_game_moneyline',period:'FULL_GAME',state:'PRE_GAME',line:null,side,probabilityBasis:'UNCONDITIONAL',pushProbability:0,
   settlement:{includesOvertime:true,pushRule:'NO_PUSH'},probability:side==='home'?.6-i*.01:.4+i*.01,observedAt:observed,url:'https://moneypuck.test/'+i,
   marketBlendObservation:{modelHomeProbability:.61-i*.01,observedEqualWeightBlend:true}}));
  g.facts=[];return g;
 });
 const board={schema:1,asOf:observed,feedGeneratedAt:observed,games};
 const shortlist=buildShortlist(board,{at}),sourceBoardBytes=Buffer.from(JSON.stringify(board));
 const candidates=shortlist.rows.map(row=>({eventId:row.eventId,home:row.home,away:row.away,startTime:row.startTime,preferredSide:row.side,modelRecordIds:row.modelRecordIds,
  supportReason:'The current hockey matchup supports this side at the saved price.',contraryReason:'The opponent can erase the advantage with its special teams.',
  assessment:{goalies:[row.home,row.away].map(team=>({team,name:team+' goalie',status:'CONFIRMED',observedAt:observed,sourceRefs:source()})),
   ...Object.fromEntries(['lineup','restTravel','fiveOnFive'].map(key=>[key,{summary:'Current source-backed '+key+' assessment.',observedAt:observed,sourceRefs:source()}]))}}));
 const chosen={eventId:candidates[1].eventId,side:'home',minDecimalPrice:1.9,reason:'I prefer the second game after considering the goalie and hockey matchup.',
  pinnacleAssessment:{status:'DISAGREES',reason:'Pinnacle disagrees on price, but the documented goalie and matchup evidence supports the independent call.'}};
 const staging={schema:1,state:'READY',policyId:policy.id,researchId:'research-1',date:'2026-11-01',researchedAt:researched,boardAsOf:observed,
  sourceBoardBlobSha:gitBlobSha(sourceBoardBytes),candidates,chosen};
 return {board,staging,sourceBoardBytes};
}
const publish=f=>updateCallsLedger(null,f.board,{staging:f.staging,sourceBoardBytes:f.sourceBoardBytes,at});

test('Guy researches all three candidates and can independently choose the runner-up; benchmark stays untouched',()=>{
 const f=fixture(),before=JSON.stringify(f),ledger=publish(f),call=ledger.entries[0].call;
 assert.equal(call.eventId,'g1');assert.equal(call.priceDecimal,2);assert.equal(call.playToAmerican,'-111');assert.equal(call.marketEdge,-1);
 assert.equal(call.research.goalies.length,2);assert.equal(ledger.entries[0].state,'WATCHING');assert.equal(JSON.stringify(f),before);
 const benchmark=fs.readFileSync('data/characters/guy-laflame/value-ledger.json');publish(f);assert.deepEqual(fs.readFileSync('data/characters/guy-laflame/value-ledger.json'),benchmark);
});

test('activation starts November 1 without retrospectively inventing an October pick',()=>{
 const f=fixture(),ledger=updateCallsLedger(null,f.board,{staging:f.staging,at:'2026-11-01T06:59:00Z'});
 assert.equal(ledger.entries.length,0);
 const later=updateCallsLedger(ledger,f.board,{at:'2026-11-01T06:59:30Z'});assert.deepEqual(later,ledger);
 const prep=fixture(),clock='2026-11-01T06:45:00Z';prep.board.asOf=clock;
 for(const game of prep.board.games){for(const m of game.externalModels)m.observedAt=clock;for(const m of game.markets)for(const q of m.quotes){q.observedAt=clock;q.benchmark.observedAt=clock;}}
 prep.staging.researchedAt='2026-11-01T06:50:00Z';prep.staging.boardAsOf=clock;
 for(const c of prep.staging.candidates){for(const g of c.assessment.goalies){g.observedAt=clock;g.sourceRefs=[{url:'https://club.test/official-preview',observedAt:clock}];}
  for(const key of ['lineup','restTravel','fiveOnFive']){c.assessment[key].observedAt=clock;c.assessment[key].sourceRefs=[{url:'https://club.test/official-preview',observedAt:clock}];}}
 prep.sourceBoardBytes=Buffer.from(JSON.stringify(prep.board));prep.staging.sourceBoardBlobSha=gitBlobSha(prep.sourceBoardBytes);
 const released=updateCallsLedger(null,prep.board,{staging:prep.staging,sourceBoardBytes:prep.sourceBoardBytes,at:'2026-11-01T07:10:00Z'});
 assert.equal(released.entries[0].date,'2026-11-01','fresh prelaunch research can publish after activation without creating an October call');
});

test('the same saved evidence remains a byte-identical no-op as the clock advances; expiry is visible',()=>{
 const f=fixture(),ledger=publish(f),again=updateCallsLedger(ledger,f.board,{staging:f.staging,sourceBoardBytes:f.sourceBoardBytes,at:'2026-11-01T15:35:00Z'});
 assert.deepEqual(again,ledger);
 const expired=updateCallsLedger(again,f.board,{at:'2026-11-01T16:36:00Z'});assert.equal(expired.entries[0].liveStatus.state,'PRICE_EXPIRED');
 assert.deepEqual(expired.entries[0].call,ledger.entries[0].call);
});

test('new prices are shown separately and never silently rewrite the published price or worse-price limit',()=>{
 const f=fixture(),ledger=publish(f),board=structuredClone(f.board);board.asOf='2026-11-01T15:40:00Z';
 const quotes=board.games.find(g=>g.eventId==='g1').markets.find(m=>m.side==='home').quotes;quotes[0].priceDecimal=1.85;quotes[0].observedAt=board.asOf;
 const next=updateCallsLedger(ledger,board,{at:'2026-11-01T15:45:00Z'});
 assert.equal(next.entries[0].liveStatus.state,'PRICE_OUTSIDE_LIMIT');assert.equal(next.entries[0].liveStatus.currentQuote.priceDecimal,1.85);
 assert.equal(next.entries[0].call.priceDecimal,2);assert.equal(next.entries[0].publications.length,1);
});

test('a refreshed board and reordered shortlist do not erase pinned independent research when actual model values agree',()=>{
 const f=fixture(),board=structuredClone(f.board);board.asOf='2026-11-01T15:28:00Z';
 for(const game of board.games)for(const model of game.externalModels){model.observedAt=board.asOf;model.recordId+='-recapture';}
 board.games[3].markets[0].quotes[0].priceDecimal=3;
 const call=validateResearch(f.staging,{board,at,sourceBoardBytes:f.sourceBoardBytes}).call;assert.equal(call.eventId,'g1');
 assert.equal(call.modelRecordIds[0],'record-1-home-recapture');
 const bad=structuredClone(board);bad.games[1].externalModels[0].probability+=.01;bad.games[1].externalModels[1].probability-=.01;
 assert.throws(()=>validateResearch(f.staging,{board:bad,at,sourceBoardBytes:f.sourceBoardBytes}),/MODEL_CHANGED/);
});

test('missing review coverage, source facts, proper goalies, Pinnacle explanation, identity or price bounds cannot publish',()=>{
 for(const mutate of [
  f=>f.staging.candidates.pop(),f=>f.staging.candidates[0].assessment.goalies.pop(),
  f=>f.staging.candidates[0].assessment.fiveOnFive.sourceRefs=[],f=>f.staging.chosen.pinnacleAssessment.reason='',
  f=>f.staging.chosen.minDecimalPrice=2.1,f=>f.staging.candidates[0].home='Other team',f=>f.staging.chosen.side='sideways',
  f=>f.staging.sourceBoardBlobSha='a'.repeat(40),f=>delete f.staging.sourceBoardBlobSha,f=>f.staging.candidates[0].modelRecordIds=['wrong']
 ]){const f=fixture();mutate(f);assert.throws(()=>publish(f),/GUY_DAILY_SELECTION/);}
});

test('an independently researched opposite side is allowed with an explicit MoneyPuck disagreement reason',()=>{
 const f=fixture();f.staging.chosen.side=f.staging.candidates[1].preferredSide='away';
 assert.throws(()=>publish(f),/MONEYPUCK_DISAGREEMENT/);
 f.staging.chosen.modelDisagreementReason='Guy values the confirmed away goalie and current matchup more highly than the MoneyPuck side.';
 const ledger=publish(f);assert.equal(ledger.entries[0].call.team,'Away 1');assert.ok(Math.abs(ledger.entries[0].call.probability-.41)<1e-12);
 assert.ok(ledger.entries[0].call.edge<0);
});

test('newer goalie change or a projected-goalie recheck deadline blocks actionability without withdrawing the published call',()=>{
 const f=fixture(),ledger=publish(f),board=structuredClone(f.board),game=board.games[1];
 game.facts.push({kind:'STARTING_GOALIE',observedAt:'2026-11-01T15:40:00Z',details:{team:game.home,name:'Different goalie',status:'CONFIRMED'}});
 const changed=updateCallsLedger(ledger,board,{at:'2026-11-01T15:45:00Z'});assert.equal(changed.entries[0].liveStatus.state,'GOALIE_RECHECK_REQUIRED');
 assert.deepEqual(changed.entries[0].call,ledger.entries[0].call);
 const removed=updateCallsLedger(changed,f.board,{at:'2026-11-01T15:50:00Z'});assert.equal(removed.entries[0].liveStatus.state,'GOALIE_RECHECK_REQUIRED','later disappearance of the changed fact cannot erase the required review');
 const projected=fixture();projected.staging.candidates[1].assessment.goalies[0].status='PROJECTED';projected.staging.candidates[1].assessment.goalies[0].recheckAt='2026-11-01T16:00:00Z';
 const l=publish(projected),due=updateCallsLedger(l,projected.board,{at:'2026-11-01T16:00:00Z'});assert.equal(due.entries[0].liveStatus.state,'GOALIE_RECHECK_REQUIRED');
});

test('advertised American limits are conservative and enforced at their exact representable prices',()=>{
 assert.equal(americanPriceLimit(2.111),'+112');assert.equal(americanPriceLimit(1.912),'-109');assert.equal(americanPriceLimit(1+100/115),'-115');
 const f=fixture();f.staging.chosen.minDecimalPrice=1.912;
 const call=validateResearch(f.staging,{...f,at}).call;assert.equal(call.playToAmerican,'-109');assert.equal(call.minDecimalPrice,1+100/109);
 const bad=fixture();bad.staging.chosen.minDecimalPrice=1.912;bad.board.games[1].markets[0].quotes[0].priceDecimal=1.915;
 assert.throws(()=>validateResearch(bad.staging,{...bad,at}),/PRICE_OUTSIDE_LIMIT/);
});

test('new Pinnacle disagreement needs a fresh explicit review while an already explained negative comparison remains valid',()=>{
 const f=fixture();f.board.games[1].markets[0].quotes[0].benchmark.edgeProbabilityPoints=1;
 f.sourceBoardBytes=Buffer.from(JSON.stringify(f.board));f.staging.sourceBoardBlobSha=gitBlobSha(f.sourceBoardBytes);f.staging.chosen.pinnacleAssessment.status='AGREES';
 const ledger=publish(f),board=structuredClone(f.board);board.games[1].markets[0].quotes[0].benchmark.edgeProbabilityPoints=-1;
 const changed=updateCallsLedger(ledger,board,{at:'2026-11-01T15:35:00Z'});assert.equal(changed.entries[0].liveStatus.state,'RESEARCH_REQUIRED');
 assert.deepEqual(changed.entries[0].call,ledger.entries[0].call);
 const negative=fixture(),n=publish(negative);negative.board.games[1].markets[0].quotes[0].benchmark.edgeProbabilityPoints=-2;
 assert.equal(updateCallsLedger(n,negative.board,{at:'2026-11-01T15:35:00Z'}).entries[0].liveStatus.state,'CURRENT');
 const absent=fixture();delete absent.board.games[1].markets[0].quotes[0].benchmark;absent.sourceBoardBytes=Buffer.from(JSON.stringify(absent.board));
 absent.staging.sourceBoardBlobSha=gitBlobSha(absent.sourceBoardBytes);absent.staging.chosen.pinnacleAssessment.status='UNAVAILABLE';
 const a=publish(absent);absent.board.games[1].markets[0].quotes[0].benchmark={edgeProbabilityPoints:-1,observedAt:observed};
 assert.equal(updateCallsLedger(a,absent.board,{at:'2026-11-01T15:35:00Z'}).entries[0].liveStatus.state,'RESEARCH_REQUIRED');
});

test('material named personnel changes require a targeted lineup review; timestamp/order-only recaptures are no-ops',()=>{
 const f=fixture(),game=f.board.games[1];game.facts=[{kind:'INJURIES',observedAt:observed,details:{team:game.home,players:[{name:'First skater',status:'OUT'},{name:'Other skater',status:'DAY-TO-DAY'}]}}];
 f.sourceBoardBytes=Buffer.from(JSON.stringify(f.board));f.staging.sourceBoardBlobSha=gitBlobSha(f.sourceBoardBytes);
 const ledger=publish(f),sameBoard=structuredClone(f.board);sameBoard.games[1].facts[0].observedAt='2026-11-01T15:40:00Z';sameBoard.games[1].facts[0].details.players.reverse();
 assert.deepEqual(updateCallsLedger(ledger,sameBoard,{at:'2026-11-01T15:45:00Z'}),ledger);
 const changed=structuredClone(sameBoard);changed.games[1].facts[0].details.players.find(p=>p.name==='Other skater').status='OUT';
 const next=updateCallsLedger(ledger,changed,{at:'2026-11-01T15:45:00Z'});assert.equal(next.entries[0].liveStatus.state,'RESEARCH_REQUIRED');
 assert.match(next.entries[0].liveStatus.reason,/Other skater/);assert.deepEqual(next.entries[0].call,ledger.entries[0].call);
 assert.equal(next.entries[0].reviewRequired.reviewType,'LINEUP');
});

test('a targeted review completed after the changed fact but before publication clears goalie and lineup alerts',()=>{
 for(const kind of ['LINEUP','GOALIE']){
  const f=fixture(),ledger=publish(f),board=structuredClone(f.board),game=board.games[1],factAt='2026-11-01T15:35:00Z',reviewAt='2026-11-01T15:40:00Z';
  board.asOf=board.feedGeneratedAt=reviewAt;
  game.facts.push(kind==='LINEUP'?{kind:'INJURIES',observedAt:factAt,details:{team:game.home,players:[{name:'Newly injured skater',status:'OUT'}]}}:
   {kind:'STARTING_GOALIE',observedAt:factAt,details:{team:game.home,name:'Rechecked new goalie',status:'CONFIRMED'}});
  const stage=structuredClone(f.staging);stage.researchId='targeted-'+kind;stage.researchedAt='2026-11-01T15:42:00Z';stage.revisionReason='Reviewed the newly reported '+kind.toLowerCase()+' information.';
  if(kind==='LINEUP'){stage.candidates[1].assessment.lineup.observedAt=reviewAt;stage.candidates[1].assessment.lineup.sourceRefs[0].observedAt=reviewAt;}
  else{const goalie=stage.candidates[1].assessment.goalies.find(g=>g.team===game.home);goalie.name='Rechecked new goalie';goalie.observedAt=reviewAt;goalie.sourceRefs[0].observedAt=reviewAt;}
  const result=updateCallsLedger(ledger,board,{staging:stage,sourceBoardBytes:f.sourceBoardBytes,at:'2026-11-01T15:45:00Z'});
  assert.equal(result.entries[0].call.researchId,stage.researchId);assert.equal(result.entries[0].liveStatus.state,'CURRENT');assert.equal(result.entries[0].reviewRequired,undefined);
  assert.equal(result.entries[0].publications.length,2);
  const alerted=updateCallsLedger(ledger,board,{at:'2026-11-01T15:45:00Z'});assert.equal(alerted.entries[0].reviewRequired.requirementAt,factAt);
  assert.deepEqual(updateCallsLedger(alerted,board,{at:'2026-11-01T15:46:00Z'}),alerted,'repeating an unchanged sticky review is a no-op');
  const older=structuredClone(stage);older.researchId='older-'+kind;
  if(kind==='LINEUP')older.candidates[1].assessment.lineup.observedAt='2026-11-01T15:34:00Z';
  else older.candidates[1].assessment.goalies.find(g=>g.team===game.home).observedAt='2026-11-01T15:34:00Z';
  assert.throws(()=>updateCallsLedger(alerted,f.board,{staging:older,sourceBoardBytes:f.sourceBoardBytes,at:'2026-11-01T15:47:00Z'}),kind==='LINEUP'?/NEW_LINEUP_REVIEW_REQUIRED/:/NEW_GOALIE_REVIEW_REQUIRED/);
 }
});

test('a projected starter rechecked after its scheduled deadline can publish before the later workflow detection time',()=>{
 const f=fixture();f.staging.candidates[1].assessment.goalies[0].status='PROJECTED';f.staging.candidates[1].assessment.goalies[0].recheckAt='2026-11-01T16:00:00Z';
 const ledger=publish(f),stage=structuredClone(f.staging);stage.researchId='goalie-deadline-rechecked';stage.researchedAt='2026-11-01T16:02:00Z';stage.revisionReason='Official goalie follow-up after the scheduled recheck.';
 const goalie=stage.candidates[1].assessment.goalies[0];goalie.status='CONFIRMED';goalie.observedAt='2026-11-01T16:01:00Z';goalie.sourceRefs[0].observedAt=goalie.observedAt;delete goalie.recheckAt;
 const revised=updateCallsLedger(ledger,f.board,{staging:stage,sourceBoardBytes:f.sourceBoardBytes,at:'2026-11-01T16:05:00Z'});
 assert.equal(revised.entries[0].call.researchId,stage.researchId);assert.equal(revised.entries[0].liveStatus.state,'CURRENT');
});

test('a pre-cutoff revision needs new research and a revision reason; the selected game then locks permanently',()=>{
 const f=fixture(),ledger=publish(f),newStage=structuredClone(f.staging);newStage.researchId='research-2';newStage.researchedAt='2026-11-01T15:40:00Z';
 newStage.chosen.eventId='g0';newStage.chosen.reason='New hockey evidence makes the earlier game my stronger play.';
 assert.throws(()=>updateCallsLedger(ledger,f.board,{staging:newStage,sourceBoardBytes:f.sourceBoardBytes,at:'2026-11-01T15:45:00Z'}),/REVISION_REASON/);
 newStage.revisionReason='The new confirmed goalie information changes my preferred game.';
 const revised=updateCallsLedger(ledger,f.board,{staging:newStage,sourceBoardBytes:f.sourceBoardBytes,at:'2026-11-01T15:45:00Z'});
 assert.equal(revised.entries[0].publications.length,2);assert.equal(revised.entries[0].call.eventId,'g0');
 const locked=updateCallsLedger(revised,f.board,{at:'2026-11-01T21:59:00Z'});assert.equal(locked.entries[0].state,'LOCKED');
 assert.equal(locked.entries[0].liveStatus.state,'PRICE_EXPIRED');
 const ignored=updateCallsLedger(locked,f.board,{staging:{...newStage,researchId:'later-game'},at:'2026-11-01T22:00:00Z'});
 assert.deepEqual(ignored.entries[0].call,locked.entries[0].call);assert.equal(ignored.entries[0].publications.length,2);
});

test('actual published prices settle once at flat one-unit risk; bad finals cannot fabricate a profit',()=>{
 const f=fixture(),ledger=publish(f),results=[{eventId:'g1',startTime:f.board.games[1].startTime,state:'FINAL',homeScore:4,awayScore:3,verifiedAt:'2026-11-02T03:00:00Z',url:'https://nhl.test/final'}];
 const settled=updateCallsLedger(ledger,f.board,{at:'2026-11-02T03:05:00Z',results});assert.equal(settled.entries[0].result.grade,'WIN');
 assert.equal(settled.entries[0].result.netUnits,1);assert.equal(callsSummary(settled).roiPct,100);
 const again=updateCallsLedger(settled,f.board,{at:'2026-11-02T03:10:00Z',results});assert.deepEqual(again,settled);
 const unresolved=updateCallsLedger(ledger,f.board,{at:'2026-11-02T03:05:00Z',results:[{...results[0],special:true}]});assert.equal(unresolved.entries[0].result.grade,'UNRESOLVED');
});

test('CLI publishes the exact supplied staging snapshot and rejects bad candidates without overwriting the saved call',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'guy-call-cli-')),f=fixture(),tool=path.resolve('tools/guy-daily-selection.mjs');
 const write=(p,x)=>{const file=path.join(dir,p);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof x==='string'?x:JSON.stringify(x));};
 const run=args=>spawnSync(process.execPath,[tool,'--root',dir,'--at',at,...args],{encoding:'utf8'});
 try{
  execFileSync('git',['init','-q',dir]);write('data/game-intelligence/board.json',f.sourceBoardBytes.toString());
  execFileSync('git',['hash-object','-w','data/game-intelligence/board.json'],{cwd:dir});
  write('data/characters/guy-laflame/selection-policy.json',policy);write('data/characters/guy-laflame/calls-ledger.json',newCallsLedger(at));
  const canonical=structuredClone(f.staging);canonical.researchId='canonical-newer';canonical.chosen.eventId='g0';
  write('data/characters/guy-laflame/call-staging.json',canonical);write('trigger-staging.json',f.staging);
  const applied=run(['--staging',path.join(dir,'trigger-staging.json')]);assert.equal(applied.status,0,applied.stderr);
  const output=JSON.parse(applied.stdout);assert.equal(output.researchId,'research-1');assert.ok(output.publicationId);
  const file=path.join(dir,'data/characters/guy-laflame/calls-ledger.json'),before=fs.readFileSync(file);
  const bad=structuredClone(f.staging);bad.researchId='bad-next';bad.chosen.minDecimalPrice=4;write('bad-staging.json',bad);
  assert.notEqual(run(['--staging','bad-staging.json']).status,0);assert.deepEqual(fs.readFileSync(file),before);
  write('data/characters/guy-laflame/call-staging.json','not json and must not be read');
  const refreshed=run(['--refresh-only','--staging','/does/not/exist']);assert.equal(refreshed.status,0,refreshed.stderr);
  assert.deepEqual(fs.readFileSync(file),before);
  assert.notEqual(run(['--unknown-option']).status,0);assert.notEqual(run(['--staging']).status,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

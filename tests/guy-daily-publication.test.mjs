import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {DEFAULT_POLICY,buildShortlist,gitBlobSha,newCallsLedger,assertPublicationWindow} from '../tools/guy-daily-selection.mjs';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ledgerPath='data/characters/guy-laflame/calls-ledger.json';
const stagingPath='data/characters/guy-laflame/call-staging.json';
const boardPath='data/game-intelligence/board.json';
const observed='2026-11-01T15:20:00Z';
const initialAt='2026-11-01T15:35:00Z';

function researchFixture(){
  const games=Array.from({length:4},(_,i)=>{
    const game={sport:'NHL',eventId:'g'+i,home:'Home '+i,away:'Away '+i,startTime:new Date(Date.UTC(2026,10,1,22+i)).toISOString()};
    game.markets=['home','away'].map(side=>({marketDetail:'full_game_moneyline',side,quotes:[{
      book:'DraftKings',side,line:null,priceDecimal:side==='home'?2:2.2,selectionKey:game.eventId+'|ml|'+side,
      observedAt:observed,benchmark:{edgeProbabilityPoints:-1,observedAt:observed}
    }]}));
    game.externalModels=['home','away'].map(side=>({...game,markets:undefined,sourceId:'moneypuck',sourceGameId:'source-'+i,recordId:'record-'+i+'-'+side,
      kind:'OUTCOME_PROBABILITY',marketDetail:'full_game_moneyline',period:'FULL_GAME',state:'PRE_GAME',line:null,side,
      probabilityBasis:'UNCONDITIONAL',pushProbability:0,settlement:{includesOvertime:true,pushRule:'NO_PUSH'},
      probability:side==='home'?.6-i*.01:.4+i*.01,observedAt:observed,url:'https://moneypuck.test/'+i,
      marketBlendObservation:{modelHomeProbability:.61-i*.01,observedEqualWeightBlend:true}}));
    game.facts=[];return game;
  });
  const board={schema:1,asOf:observed,feedGeneratedAt:observed,games};
  const bytes=Buffer.from(JSON.stringify(board));
  const evidence=summary=>({summary,observedAt:observed,sourceRefs:[{url:'https://club.test/official-preview',observedAt:observed}]});
  const candidates=buildShortlist(board,{at:initialAt}).rows.map(row=>({eventId:row.eventId,home:row.home,away:row.away,startTime:row.startTime,
    preferredSide:row.side,modelRecordIds:row.modelRecordIds,supportReason:'Documented goalie and even-strength matchup support this side.',
    contraryReason:'The opponent’s power play is the strongest contrary factor.',assessment:{
      goalies:[row.home,row.away].map(team=>({...evidence(team+' starting goalie'),team,name:team+' goalie',status:'CONFIRMED'})),
      lineup:evidence('Source-backed lineup review.'),restTravel:evidence('Source-backed rest and travel review.'),fiveOnFive:evidence('Source-backed five-on-five review.')
    }}));
  const staging={schema:1,state:'READY',policyId:DEFAULT_POLICY.id,researchId:'trigger-a',date:'2026-11-01',researchedAt:'2026-11-01T15:25:00Z',
    boardAsOf:observed,sourceBoardBlobSha:gitBlobSha(bytes),candidates,chosen:{eventId:'g1',side:'home',minDecimalPrice:1.9,
      reason:'First queued review independently selects the runner-up game.',pinnacleAssessment:{status:'DISAGREES',reason:'The documented goalie and matchup evidence supports this call despite Pinnacle’s unfavorable comparison.'}}};
  return {board,bytes,staging};
}

function sandbox(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'guy-publication-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const write=(file,value)=>{const target=path.join(root,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n');};
  const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  const bytes=file=>fs.readFileSync(path.join(root,file));
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
  const commit=()=>{git('add','.');git('-c','user.name=Guy publication test','-c','user.email=guy-test@example.test','commit','-qm','saved research trigger');return git('rev-parse','HEAD');};
  const run=(at,args=[])=>spawnSync(process.execPath,[path.join(repo,'tools/guy-daily-selection.mjs'),'--root',root,'--at',at,...args],{cwd:root,encoding:'utf8'});
  const publish=(at,args=[])=>{const result=run(at,args);assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);};
  const build=()=>{const result=spawnSync(process.execPath,[path.join(repo,'tools/build-guy-hotline.mjs')],{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);};
  const snapshot=()=>{
    const rows={};const walk=dir=>{for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){if(entry.name==='.git')continue;const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else rows[file]=bytes(file).toString('base64');}};
    walk('');return rows;
  };
  git('init','-q');
  write('run-history.json',{runs:[]});write('data/characters/guy-laflame.json',{id:'guy-laflame',continuity:{}});
  write('data/characters/guy-laflame/selection-policy.json',DEFAULT_POLICY);write(ledgerPath,newCallsLedger(initialAt));
  for(const file of ['data/characters/guy-laflame/value-ledger.json','syndicates/generated/guy-laflame/shell.html'])write(file,fs.readFileSync(path.join(repo,file)));
  return {root,write,read,bytes,git,commit,run,publish,build,snapshot};
}

test('queued publications consume their own committed research and Git board snapshot; pages and benchmark remain stable',t=>{
  const s=sandbox(t),f=researchFixture(),benchmark=s.bytes('data/characters/guy-laflame/value-ledger.json');
  s.write(boardPath,f.bytes);s.write(stagingPath,f.staging);const commitA=s.commit();

  // A later board pulse changes ranking and capture IDs while preserving the
  // reviewed probabilities. Research must stay bound to its original top three.
  const current=structuredClone(f.board),currentTime='2026-11-01T15:34:00Z';current.asOf=current.feedGeneratedAt=currentTime;
  for(const game of current.games){
    for(const model of game.externalModels){model.observedAt=currentTime;model.recordId+='-recaptured';}
    for(const market of game.markets)for(const quote of market.quotes){quote.observedAt=currentTime;quote.benchmark.observedAt=currentTime;}
  }
  current.games[1].markets[0].quotes.push({...current.games[1].markets[0].quotes[0],book:'FanDuel',priceDecimal:2.1});
  current.games[2].markets[0].quotes[0].priceDecimal=1.3;
  current.games[3].markets[0].quotes[0].priceDecimal=2.8;
  assert.notDeepEqual(buildShortlist(current,{at:initialAt}).rows.map(r=>r.eventId),f.staging.candidates.map(c=>c.eventId));
  const stageB=structuredClone(f.staging);stageB.researchId='trigger-b';stageB.researchedAt='2026-11-01T15:31:00Z';stageB.chosen.eventId='g0';
  stageB.chosen.reason='Second queued review independently chooses the earlier game.';stageB.revisionReason='New hockey review changed the daily preference.';
  s.write(boardPath,current);s.write(stagingPath,stageB);const commitB=s.commit();
  const newer=structuredClone(stageB);newer.researchId='canonical-c-must-not-leak';newer.researchedAt='2026-11-01T15:33:00Z';
  s.write(stagingPath,newer);s.commit();
  const triggerA='queued-trigger-a.json',triggerB='queued-trigger-b.json';
  s.write(triggerA,s.git('show',commitA+':'+stagingPath));s.write(triggerB,s.git('show',commitB+':'+stagingPath));
  assert.equal(s.git('hash-object',boardPath),gitBlobSha(Buffer.from(JSON.stringify(current,null,2)+'\n')));
  assert.equal(s.git('cat-file','-t',f.staging.sourceBoardBlobSha),'blob');

  const first=s.publish(initialAt,['--staging',triggerA]);assert.equal(first.researchId,'trigger-a');
  const firstLedger=s.read(ledgerPath),firstCall=firstLedger.entries[0].call;
  assert.equal(firstCall.eventId,'g1');assert.equal(firstCall.sourceBoardBlobSha,f.staging.sourceBoardBlobSha);
  assert.equal(firstCall.book,'FanDuel');assert.equal(firstCall.priceDecimal,2.1);assert.equal(firstCall.quoteObservedAt,currentTime);
  assert.equal(firstLedger.entries[0].liveStatus.currentQuote.modelObservedAt,currentTime);
  assert.equal(firstCall.sourceBoardAsOf,observed);assert.notDeepEqual(firstCall.modelRecordIds,f.staging.candidates[1].modelRecordIds);
  assert.equal(firstLedger.processedResearchIds.some(r=>r.researchId===newer.researchId),false);

  s.build();const pointer=s.read('data/characters/guy-laflame/current-edition.json'),edition=s.read(pointer.path);
  assert.equal(edition.callsLedger.entries[0].call.researchId,'trigger-a');assert.deepEqual(edition.valueLedger,JSON.parse(benchmark));
  const html=s.bytes('syndicates/generated/guy-laflame/hotline.html').toString();
  assert.match(html,/GUY’S PLAY \/\/ DAILY NHL MONEYLINE/);assert.ok(html.includes(firstCall.reason));assert.match(html,/Home 1 <strong>\+110<\/strong>/);
  assert.ok(html.indexOf('id="guyActualCall"')<html.indexOf('MONEYPUCK BENCHMARK // HISTORICAL TOP-EDGE TRACKING'));
  const built=s.snapshot();s.build();assert.deepEqual(s.snapshot(),built,'same saved inputs must not create a new edition or change any bytes');
  assert.deepEqual(s.bytes('data/characters/guy-laflame/value-ledger.json'),benchmark);

  // The publication guard uses wall time after building, not the earlier
  // selector time. A slow build cannot first publish a call at its cutoff.
  assert.equal(assertPublicationWindow(newCallsLedger(initialAt),firstLedger,{at:'2026-11-01T22:58:59Z'}),true);
  assert.throws(()=>assertPublicationWindow(newCallsLedger(initialAt),firstLedger,{at:'2026-11-01T22:59:00Z'}),/PUBLICATION_WINDOW_CLOSED/);
  assert.equal(assertPublicationWindow(firstLedger,firstLedger,{at:'2026-11-02T03:00:00Z'}),true);

  const second=s.publish('2026-11-01T15:40:00Z',['--staging',triggerB]);assert.equal(second.researchId,'trigger-b');
  const revised=s.read(ledgerPath);assert.equal(revised.entries.length,1);assert.equal(revised.entries[0].call.eventId,'g0');
  assert.deepEqual(revised.entries[0].publications.map(p=>p.researchId),['trigger-a','trigger-b']);
  assert.equal(revised.entries[0].publications[1].previousPublicationId,firstCall.publicationId);
  assert.equal(revised.processedResearchIds.some(r=>r.researchId===newer.researchId),false);
  assert.throws(()=>assertPublicationWindow(firstLedger,revised,{at:'2026-11-01T21:59:00Z'}),/PUBLICATION_WINDOW_CLOSED/);
  s.build();assert.equal(s.read(s.read('data/characters/guy-laflame/current-edition.json').path).callsLedger.entries[0].call.researchId,'trigger-b');
  assert.deepEqual(s.read(pointer.path),edition,'later editions must not rewrite a prior publication archive');
  assert.deepEqual(s.bytes('data/characters/guy-laflame/value-ledger.json'),benchmark);

  // A malformed queued candidate cannot prevent the independent refresher
  // from retaining the prior fresh call and its exact status/price.
  const before=s.bytes(ledgerPath);s.write(stagingPath,{state:'READY',sourceBoardBlobSha:'bad-hash'});s.write('bad-json.json','{not json');
  assert.equal(s.publish('2026-11-01T15:41:00Z',['--refresh-only','--staging','bad-json.json']).state,'CURRENT');
  assert.deepEqual(s.bytes(ledgerPath),before);
  const bad=structuredClone(stageB);bad.researchId='invalid-next';bad.researchedAt='2026-11-01T15:39:00Z';bad.chosen.minDecimalPrice=10;s.write('invalid-next.json',bad);
  assert.notEqual(s.run('2026-11-01T15:42:00Z',['--staging','invalid-next.json']).status,0);assert.deepEqual(s.bytes(ledgerPath),before);

  const expired=s.publish('2026-11-01T16:50:00Z',['--refresh-only']);assert.equal(expired.state,'PRICE_EXPIRED');
  const expiredBytes=s.bytes(ledgerPath);s.publish('2026-11-01T16:51:00Z',['--refresh-only']);assert.deepEqual(s.bytes(ledgerPath),expiredBytes);
  const published=revised.entries[0].call;
  s.publish('2026-11-01T21:59:00Z',['--refresh-only']);const locked=s.read(ledgerPath);
  assert.equal(locked.entries[0].state,'LOCKED');assert.equal(locked.entries[0].lockedPublicationId,published.publicationId);
  assert.equal(locked.entries[0].liveStatus.state,'PRICE_EXPIRED');assert.deepEqual(locked.entries[0].call,published);
  const late=structuredClone(stageB);late.researchId='late-game-replacement';late.researchedAt='2026-11-01T21:59:00Z';late.chosen.eventId='g2';s.write('late.json',late);
  s.publish('2026-11-01T22:00:00Z',['--staging','late.json']);assert.deepEqual(s.read(ledgerPath),locked,'a locked call cannot be replaced with a later game');
  s.write('data/game-intelligence/performance.json',{results:[{eventId:'g0',startTime:published.startTime,state:'FINAL',homeScore:2,awayScore:3,verifiedAt:'2026-11-02T02:59:00Z',url:'https://nhl.test/final'}]});
  s.publish('2026-11-02T03:00:00Z',['--refresh-only']);const settled=s.read(ledgerPath);
  assert.equal(settled.entries[0].result.grade,'LOSS');assert.equal(settled.entries[0].result.netUnits,-1);assert.equal(settled.summary.losses,1);assert.equal(settled.summary.roiPct,-100);
  assert.deepEqual(settled.entries[0].call,published);assert.equal(assertPublicationWindow(locked,settled,{at:'2026-11-02T03:00:00Z'}),true);
  const settledBytes=s.bytes(ledgerPath);s.publish('2026-11-02T03:05:00Z',['--refresh-only']);assert.deepEqual(s.bytes(ledgerPath),settledBytes);
  s.build();const finalSnapshot=s.snapshot();s.build();assert.deepEqual(s.snapshot(),finalSnapshot);
  assert.deepEqual(s.bytes('data/characters/guy-laflame/value-ledger.json'),benchmark,'actual-pick publication, expiry, lock and loss never mutate the historical MoneyPuck benchmark');
});

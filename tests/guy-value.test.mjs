import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {newLedger,updateLedger,track} from '../tools/track-guy-value.mjs';
const require=createRequire(import.meta.url),value=require('../assets/guy-value.js');
const started='2026-10-06T12:00:00Z',at='2026-10-06T22:00:00Z',start='2026-10-06T23:00:00Z';
function board({asOf=at,probability=.55,price=2,eventId='nhl-1',startTime=start}={}){
  const home='Home',away='Away',observedAt=asOf;
  return {asOf,games:[{eventId,sport:'NHL',home,away,startTime,markets:[{marketDetail:'full_game_moneyline',side:'home',quotes:[{side:'home',line:null,book:'Book',priceDecimal:price,observedAt}]}],externalModels:['home','away'].map(side=>({sourceId:'moneypuck',sourceGameId:eventId,recordId:eventId+'-'+side,kind:'OUTCOME_PROBABILITY',marketDetail:'full_game_moneyline',period:'FULL_GAME',state:'PRE_GAME',line:null,probabilityBasis:'UNCONDITIONAL',pushProbability:0,settlement:{includesOvertime:true,pushRule:'NO_PUSH'},side,probability:side==='home'?probability:1-probability,eventId,home,away,startTime,observedAt}))}]};
}
const first=()=>updateLedger(newLedger(started),board(),{at});
const earlyStart='2026-10-06T17:00:00Z',lateStart='2026-10-07T02:00:00Z',morning='2026-10-06T16:00:00Z';
function slate(asOf,{early=.55,late=.6,latePrice=2}={}){
  return {asOf,games:[...board({asOf,eventId:'early',probability:early,startTime:earlyStart}).games,...board({asOf,eventId:'late',probability:late,price:latePrice,startTime:lateStart}).games]};
}
test('retain the single highest captured daily edge and associated odds; exact ties keep the earlier capture',()=>{
  let ledger=first();assert.equal(ledger.entries[0].state,'WATCHING');assert.equal(ledger.entries[0].pick.priceDecimal,2);
  const higher='2026-10-06T22:10:00Z';ledger=updateLedger(ledger,board({asOf:higher,price:2.2}),{at:higher});
  const lower='2026-10-06T22:20:00Z';ledger=updateLedger(ledger,board({asOf:lower,price:1.9}),{at:lower});
  const tie='2026-10-06T22:30:00Z';ledger=updateLedger(ledger,board({asOf:tie,price:2.2}),{at:tie});
  assert.equal(ledger.entries[0].pick.priceDecimal,2.2);assert.equal(ledger.entries[0].pick.recordedAt,higher);assert.equal(ledger.entries[0].observations.length,4);assert.equal(value.summary(ledger,tie).picks,0);
  const again=updateLedger(ledger,board({asOf:tie,price:2.2}),{at:tie});assert.deepEqual(again,ledger,'same capture is idempotent');
});
test('daily lock occurs before the selected game; larger later-game edges cannot rewrite the frozen pick',()=>{
  const ledger=first(),before=JSON.stringify(ledger.entries[0].pick),late='2026-10-06T23:10:00Z';
  const future=board({asOf:late,price:9,eventId:'later',startTime:'2026-10-07T02:00:00Z'});
  const next=updateLedger(ledger,future,{at:late});assert.equal(next.entries[0].state,'LOCKED');assert.equal(JSON.stringify(next.entries[0].pick),before);assert.equal(next.entries[0].observations.length,1);
  assert.equal(value.status(ledger.entries[0],'2026-10-06T22:59:00Z'),'LOCKED','UI freezes on time even before the next collection');
});
test('never backfill a pick when installation or first collection misses the cutoff',()=>{
  const late='2026-10-06T23:10:00Z';
  for(const installedAt of [started,late]){const ledger=updateLedger(newLedger(installedAt),board(),{at:late});assert.equal(ledger.entries[0].state,'SKIPPED');assert.equal(ledger.entries[0].pick,null);assert.equal(ledger.summary.picks,0);}
});
test('exclude stale, future, started, unpaired, non-NHL, regulation and nonpositive opportunities',()=>{
  const cases=[b=>b.asOf='2026-10-06T20:00:00Z',b=>b.asOf='2026-10-06T22:01:00Z',b=>b.games[0].externalModels.pop(),b=>b.games[0].sport='NBA',b=>b.games[0].markets[0].marketDetail='regulation_moneyline',b=>b.games[0].markets[0].quotes[0].observedAt='2026-10-06T20:00:00Z',b=>b.games[0].markets[0].quotes[0].observedAt='2026-10-06T22:01:00Z'];
  for(const mutate of cases){const b=board();mutate(b);const ledger=updateLedger(newLedger(started),b,{at});assert.ok(ledger.entries.every(e=>!e.pick));}
  assert.equal(updateLedger(newLedger(started),board({probability:.4}),{at}).entries[0].pick,null);
  assert.equal(updateLedger(newLedger(started),board({startTime:at}),{at}).entries[0].state,'SKIPPED');
  assert.equal(updateLedger(newLedger(at),board({asOf:'2026-10-06T21:59:00Z'}),{at}).entries[0].pick,null,'older boards cannot become new prospective captures');
  const b=board();b.games[0].markets[0].quotes.push({...b.games[0].markets[0].quotes[0],priceDecimal:9,observedAt:'2026-10-06T20:00:00Z'});assert.equal(updateLedger(newLedger(started),b,{at}).entries[0].pick.priceDecimal,2,'rank after filtering stale quotes');
});
test('grade exact verified finals including OT/shootout margins at flat one-unit risk; exclude pending and special settlements from ROI',()=>{
  const later='2026-10-07T06:00:00Z',final={eventId:'nhl-1',startTime:start,state:'FINAL',homeScore:4,awayScore:3,verifiedAt:later,url:'https://example.org/final'};
  for(const [homeScore,grade,units] of [[4,'WIN',1],[2,'LOSS',-1]]){const ledger=updateLedger(first(),null,{at:later,results:[{...final,homeScore}]});assert.equal(ledger.entries[0].result.grade,grade);assert.equal(ledger.summary.netUnits,units);assert.equal(ledger.summary.roiPct,units*100);assert.equal(ledger.summary.settled,1);}
  for(const changed of [{eventId:'wrong'},{startTime:'2026-10-06T23:01:00Z'},{state:'LIVE'},{verifiedAt:'2026-10-07T07:00:00Z'},{special:true},{homeScore:3}]){const ledger=updateLedger(first(),null,{at:later,results:[{...final,...changed}]});assert.equal(ledger.summary.settled,0);assert.equal(ledger.summary.roiPct,null);assert.equal(ledger.summary.netUnits,0);assert.equal(ledger.summary.pending,1);}
  const favourite=updateLedger(newLedger(started),board({probability:.8,price:1.5}),{at});const graded=updateLedger(favourite,null,{at:later,results:[final]});assert.equal(graded.summary.netUnits,.5);assert.equal(graded.summary.roiPct,50);
  const away=board({probability:.45});away.games[0].markets[0].side='away';away.games[0].markets[0].quotes[0].side='away';const a=updateLedger(newLedger(started),away,{at});assert.equal(updateLedger(a,null,{at:later,results:[final]}).entries[0].result.grade,'LOSS');
});
test('Pacific days roll over without losing history or replacing earlier results',()=>{
  const locked=updateLedger(first(),null,{at:'2026-10-07T06:00:00Z'}),tomorrow='2026-10-07T22:00:00Z';
  const next=updateLedger(locked,board({asOf:tomorrow,startTime:'2026-10-08T02:00:00Z',eventId:'day2'}),{at:tomorrow});assert.equal(next.entries.length,2);assert.equal(next.entries[1].date,'2026-10-07');assert.deepEqual(next.entries[0],locked.entries[0]);assert.equal(next.entries[1].lockAt,'2026-10-08T01:59:00.000Z');
});
test('a 10am game does not close a 7pm leader; afternoon observations can still increase its saved edge',()=>{
  const initial=updateLedger(newLedger(started),slate(morning),{at:morning});
  assert.equal(initial.entries[0].pick.eventId,'late');assert.equal(initial.entries[0].lockAt,'2026-10-07T01:59:00.000Z');
  assert.equal(value.status(initial.entries[0],'2026-10-06T17:00:00Z'),'WATCHING');
  const afternoon='2026-10-06T22:00:00Z',next=updateLedger(initial,slate(afternoon,{early:.99,latePrice:2.2}),{at:afternoon});
  assert.equal(next.entries[0].state,'WATCHING');assert.equal(next.entries[0].pick.eventId,'late');assert.equal(next.entries[0].pick.priceDecimal,2.2);assert.equal(next.entries[0].pick.recordedAt,afternoon);assert.equal(next.summary.picks,0);
  const html=value.render(next,{now:afternoon});assert.match(html,/DAILY LEADER · STILL COLLECTING/);assert.match(html,/Freezes Oct 6, 6:59 PM PT/);assert.match(html,/one minute before its own game starts/);assert.doesNotMatch(html,/The day freezes one minute before the first NHL game/);
});
test('a higher late-game edge can replace an early leader before its cutoff and move the lock later',()=>{
  const initial=updateLedger(newLedger(started),slate(morning,{early:.7}),{at:morning});assert.equal(initial.entries[0].pick.eventId,'early');assert.equal(initial.entries[0].lockAt,'2026-10-06T16:59:00.000Z');
  const nextAt='2026-10-06T16:58:00Z',next=updateLedger(initial,slate(nextAt,{early:.7,late:.75}),{at:nextAt});
  assert.equal(next.entries[0].pick.eventId,'late');assert.equal(next.entries[0].lockAt,'2026-10-07T01:59:00.000Z');assert.equal(value.status(next.entries[0],'2026-10-06T17:01:00Z'),'WATCHING');assert.equal(next.entries[0].observations.length,2);
});
test('a higher upcoming early-game edge can replace a late leader and move its cutoff earlier',()=>{
  const initial=updateLedger(newLedger(started),slate(morning),{at:morning});
  const nextAt='2026-10-06T16:30:00Z',next=updateLedger(initial,slate(nextAt,{early:.8}),{at:nextAt});
  assert.equal(next.entries[0].pick.eventId,'early');assert.equal(next.entries[0].lockAt,'2026-10-06T16:59:00.000Z');
  const boundary='2026-10-06T16:59:00Z',closed=updateLedger(next,slate(boundary,{late:.99}),{at:boundary});assert.equal(closed.entries[0].state,'LOCKED');assert.equal(closed.entries[0].pick.eventId,'early');assert.equal(closed.entries[0].observations.length,2);
});
test('with no leader, a positive late-game edge can be captured after an early game starts',()=>{
  const initial=updateLedger(newLedger(started),slate(morning,{early:.4,late:.4}),{at:morning});assert.equal(initial.entries[0].pick,null);assert.equal(initial.entries[0].lockAt,null);assert.equal(value.status(initial.entries[0],'2026-10-06T17:01:00Z'),'WATCHING');
  const nextAt='2026-10-06T18:00:00Z',next=updateLedger(initial,slate(nextAt),{at:nextAt});assert.equal(next.entries[0].pick.eventId,'late');assert.equal(next.entries[0].state,'WATCHING');
  const fresh=updateLedger(newLedger(nextAt),slate(nextAt),{at:nextAt});assert.equal(fresh.entries[0].pick.eventId,'late','installation after an early game can still record a future game');
  const closed=updateLedger(initial,null,{at:'2026-10-07T01:59:00Z'});assert.equal(closed.entries[0].state,'SKIPPED');assert.equal(closed.entries[0].pick,null);assert.equal(closed.summary.picks,0);
});
test('new candidates cannot enter during their final minute or after starting, even with saved pregame quotes',()=>{
  const boundary='2026-10-06T16:59:00Z',b=slate(boundary,{early:.99});b.games[0].externalModels.forEach(r=>r.observedAt='2026-10-06T16:58:00Z');b.games[0].markets[0].quotes[0].observedAt='2026-10-06T16:58:00Z';
  const next=updateLedger(newLedger(started),b,{at:boundary});assert.equal(next.entries[0].pick.eventId,'late');
});
test('migration preserves closed legacy entries and does not reopen an effectively locked leader',()=>{
  const legacy=first();legacy.policy={...legacy.policy,id:'daily-peak-before-first-puck-v1'};legacy.entries[0].lockAt='2026-10-06T22:30:00Z';
  const preserved=structuredClone(legacy.entries[0].pick),next=updateLedger(legacy,board({asOf:'2026-10-06T22:40:00Z',price:9}),{at:'2026-10-06T22:40:00Z'});
  assert.equal(next.policy.id,'daily-peak-before-selected-puck-v2');assert.equal(next.entries[0].state,'LOCKED');assert.equal(next.entries[0].lockAt,'2026-10-06T22:30:00Z');assert.deepEqual(next.entries[0].pick,preserved);assert.deepEqual(next.entries[0].observations,legacy.entries[0].observations);assert.equal(next.entries[0].policyId,'daily-peak-before-first-puck-v1');assert.equal(next.policyHistory.length,1);
  for(const state of ['LOCKED','SKIPPED']){const old=structuredClone(legacy);old.entries[0].state=state;if(state==='SKIPPED'){old.entries[0].pick=null;old.entries[0].skipReason='STARTED_BEFORE_TRACKING';}else old.entries[0].result={grade:'WIN',netUnits:1};const migrated=updateLedger(old,null,{at:'2026-10-06T22:40:00Z'});assert.equal(migrated.entries[0].state,state);assert.deepEqual(migrated.entries[0].pick,old.entries[0].pick);assert.deepEqual(migrated.entries[0].result,old.entries[0].result);}
});
test('an unclosed legacy leader moves to its own start; a repeat update does not migrate twice',()=>{
  const old=updateLedger(newLedger(started),slate(morning),{at:morning});old.policy={...old.policy,id:'daily-peak-before-first-puck-v1'};old.entries[0].lockAt='2026-10-06T16:59:00Z';
  const migrated=updateLedger(old,null,{at:'2026-10-06T16:30:00Z'});assert.equal(migrated.entries[0].state,'WATCHING');assert.equal(migrated.entries[0].lockAt,'2026-10-07T01:59:00.000Z');assert.equal(migrated.entries[0].policyId,migrated.policy.id);assert.deepEqual(migrated.entries[0].pick,old.entries[0].pick);
  const again=updateLedger(migrated,null,{at:'2026-10-06T16:30:00Z'});assert.deepEqual(again,migrated);
});
test('display American odds, honest empty ROI, daily history, pending record and immutable inputs',()=>{
  const ledger=first(),before=JSON.stringify(ledger),html=value.render(ledger,{now:'2026-10-06T23:00:00Z'});
  assert.match(html,/New record — collecting results/);assert.match(html,/\+100/);assert.match(html,/DAILY PICK · LOCKED/);assert.match(html,/Full daily pick history/);assert.match(html,/Flat 1u risk/);assert.match(html,/1 awaiting settlement/);assert.doesNotMatch(html,/>2\.00</);assert.equal(JSON.stringify(ledger),before);assert.equal(value.summary(ledger).roiPct,null);
  assert.match(value.render(null),/unavailable/);assert.match(value.render({...ledger,entries:[{...ledger.entries[0],state:'SKIPPED',pick:null,skipReason:'STARTED_BEFORE_TRACKING'}]},{now:at}),/No retrospective pick/);
});
test('CLI integration retains the existing ledger and grades from saved shared source results',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'guy-value-'));
  try{fs.mkdirSync(path.join(root,'data/game-intelligence'),{recursive:true});fs.writeFileSync(path.join(root,'data/game-intelligence/board.json'),JSON.stringify(board()));const ledger=track({root,at});assert.equal(ledger.entries[0].pick.team,'Home');const later='2026-10-07T06:00:00Z';fs.writeFileSync(path.join(root,'data/game-intelligence/performance.json'),JSON.stringify({results:[{eventId:'nhl-1',startTime:start,state:'FINAL',homeScore:2,awayScore:3,verifiedAt:later}]}));const next=track({root,at:later});assert.equal(next.startedAt,at);assert.equal(next.summary.losses,1);}finally{fs.rmSync(root,{recursive:true,force:true});}
});

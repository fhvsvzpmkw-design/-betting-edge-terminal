import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {eventInfo,buckets,verify} from '../tools/grade-issued-card-history.mjs';
const rec = (meta,title='Away',side='away',marketKey='ml',line=null) => ({title,meta,feed:{eventId:'123',selectionKey:`123|${marketKey}|${side}||${line??''}`,eventDate:'2026-10-10T18:00:00Z',marketKey,side,line},coreAssessment:{context:{sport:'NCAAF'}}});
const group = recs => ({id:'123',firstDate:'2026-10-10',rows:recs.map(rec=>({rec,date:'2026-10-10'}))});
assert.equal(eventInfo(group([rec('NCAAF | Fordham Rams @ Lehigh Mountain Hawks | 2026-10-10T18:00:00Z','Over 44.5','over','totals',44.5)])).away,'Fordham Rams');
assert.equal(eventInfo(group([rec('NCAAF | Away @ Home | 2026-10-10T18:00:00Z'),rec('NCAAF | Fordham Rams at Lehigh Mountain Hawks | 2026-10-10T18:00:00Z')])).home,'Lehigh Mountain Hawks');
assert.equal(eventInfo(group([rec('NCAAF | Fordham Rams @ Lehigh Mountain Hawks'),rec('NCAAF | Brown Bears @ Lehigh Mountain Hawks')])),null);
const placeholder=group([rec('NCAAF | Away @ Home')]);
assert.equal(eventInfo(placeholder),null);
placeholder.historicalIdentity={away:'Fordham Rams',home:'Lehigh Mountain Hawks',start:'2026-10-10T18:00:00Z'};
assert.equal(eventInfo(placeholder).away,'Fordham Rams');
const leagueRec = (league, away, home, suffix=league) => ({...rec(`${league} | ${away} @ ${home} · ${suffix}`),coreAssessment:{context:{sport:league}}});
for (const [league,away,home] of [['NFL','Chicago Bears','Atlanta Falcons'],['NHL','Carolina Hurricanes','Calgary Flames']]) {
 const legacy=leagueRec(league,away,home);
 legacy.feed.away=away;legacy.feed.home=home;
 const original=JSON.stringify(legacy);
 assert.equal(eventInfo(group([legacy])).home,home,'Display suffix and explicit feed must identify the same team');
 const result=await verify(group([legacy]),async()=>({events:[{id:'legacy-fixture',competitions:[{id:'legacy-fixture-game',date:legacy.feed.eventDate,status:{type:{completed:true,description:'Final'}},competitors:[{homeAway:'away',team:{displayName:away},score:'3'},{homeAway:'home',team:{displayName:home},score:'2'}]}]}]}));
 assert.equal(result.status,'final');assert.equal(result.home,home);
 assert.equal(JSON.stringify(legacy),original,'Identity parsing must not rewrite issued cards');
 const wrong=await verify(group([legacy]),async()=>({events:[{id:'wrong-fixture',competitions:[{id:'wrong-fixture-game',status:{type:{completed:true}},competitors:[{homeAway:'away',team:{displayName:'Unrelated Team'},score:'3'},{homeAway:'home',team:{displayName:home},score:'2'}]}]}]}));
 assert.equal(wrong.unresolvedReason,'result_not_verified','A suffix repair must not permit a different opponent');
 const conflict=structuredClone(legacy);conflict.feed.home='Different Home Team';
 assert.equal(eventInfo(group([conflict])),null,'A real metadata/feed conflict must remain blocked');
}
const wrongLeague=leagueRec('NFL','Chicago Bears','Atlanta Falcons','NHL');wrongLeague.feed.home='Atlanta Falcons';
assert.equal(eventInfo(group([wrongLeague])),null,'A different league suffix must not be stripped');
const unknownLabel=leagueRec('NFL','Chicago Bears','Atlanta Falcons','playoff');unknownLabel.feed.home='Atlanta Falcons';
assert.equal(eventInfo(group([unknownLabel])),null,'Unknown decorations must not be stripped');
const mtsu=rec('NCAAF | Middle Tennessee State Blue Raiders @ FIU Panthers','Middle Tennessee State Blue Raiders');
mtsu.feed.away='Middle Tennessee Blue Raiders';mtsu.feed.home='FIU Panthers';
assert.ok(eventInfo(group([mtsu])),'The exact supported Middle Tennessee alias must agree with the feed');
const mtsuVerified=await verify(group([mtsu]),async()=>({events:[{id:'mtsu-fixture',competitions:[{id:'mtsu-fixture-game',date:mtsu.feed.eventDate,status:{type:{completed:true,description:'Final'}},competitors:[{homeAway:'away',team:{displayName:'Middle Tennessee Blue Raiders'},score:'26'},{homeAway:'home',team:{displayName:'FIU Panthers'},score:'23'}]}]}]}));
assert.equal(mtsuVerified.status,'final');assert.equal(mtsuVerified.awayScore,26);
const wide=new Map(Array.from({length:160},(_,i)=>[String(i),{id:String(i),firstDate:'2026-10-10',current:i<70}]));
const batches=buckets(wide);assert.equal(batches.previous.length,70);assert.equal(batches.backlog.length,90);assert.equal(batches.deferred.length,0);
const fcs=group([rec('NCAAF | Fordham Rams @ Lehigh Mountain Hawks')]);
const calls=[];
const scoreEvent={id:'espn-123',competitions:[{id:'competition-123',date:'2026-10-10T18:00:00Z',status:{type:{completed:true,description:'Final'}},competitors:[{homeAway:'away',team:{displayName:'Fordham Rams'},score:'10'},{homeAway:'home',team:{displayName:'Lehigh Mountain Hawks'},score:'35'}]}]};
const verified=await verify(fcs,async url=>{calls.push(url);return {events:url.includes('groups=81')?[scoreEvent]:[]};});
assert.equal(verified.status,'final');assert.equal(verified.homeScore,35);assert.ok(verified.source.url.includes('groups=81'));assert.equal(calls.length,2);
const ml=rec('MLB | Baltimore Orioles @ New York Yankees','Baltimore Orioles');ml.coreAssessment.context.sport='MLB';
const cancelled=await verify(group([ml]),async()=>({dates:[{games:[{gamePk:8491,gameDate:'2026-10-10T18:00:00Z',status:{abstractGameState:'Final',detailedState:'Cancelled'},teams:{away:{team:{name:'Baltimore Orioles'}},home:{team:{name:'New York Yankees'}}}}]}]}));
assert.equal(cancelled.status,'settled');assert.equal(cancelled.selectionOutcomes[0].grade,'VOID');assert.equal(cancelled.homeScore,undefined);
const postponedRec = (book,marketKey='ml',side='away',line=null) => ({...rec('MLB | Baltimore Orioles @ New York Yankees','Baltimore Orioles',side,marketKey,line),status:'PASS',coreAssessment:{context:{sport:'MLB'}},feed:{...rec('', '', side, marketKey,line).feed,book}});
const postponedGame = () => ({gamePk:8492,gameDate:'2026-10-10T18:00:00Z',status:{abstractGameState:'Final',detailedState:'Postponed'},venue:{timeZone:{id:'America/New_York'}},teams:{away:{team:{name:'Baltimore Orioles'}},home:{team:{name:'New York Yankees'}}}});
const postponeJson = game => async()=>({dates:[{games:[game]}]});
const afterStadiumDate=new Date('2026-10-11T05:00:00Z');
const specialPostponed=postponedRec('Bet365','totals','over',4.5);specialPostponed.feed.marketName='First five innings total';
const postponedRecs=[postponedRec('Bet365'),postponedRec('DraftKings'),postponedRec('Unknown'),specialPostponed,postponedRec('Bet365','spread','home',-1.5),postponedRec('DraftKings','totals','under',8.5)];
const postponed=await verify(group(postponedRecs),postponeJson(postponedGame()),afterStadiumDate);
assert.equal(postponed.status,'settled');assert.equal(postponed.selectionOutcomes.length,4);
assert.ok(postponed.selectionOutcomes.every(x=>x.grade==='VOID'&&x.ruleSource&&['bet365','draftkings'].includes(x.book)));
assert.equal(postponed.selectionOutcomes.filter(x=>x.selectionKey===postponedRecs[0].feed.selectionKey).length,2,'The same selection at two books retains both rule bindings');
assert.ok(!postponed.selectionOutcomes.some(x=>x.selectionKey===specialPostponed.feed.selectionKey),'Special market scope is excluded');
assert.equal(postponed.homeScore,undefined);assert.equal(postponed.awayScore,undefined);
const sameStadiumDate=await verify(group([postponedRec('Bet365')]),postponeJson(postponedGame()),new Date('2026-10-11T03:00:00Z'));
assert.equal(sameStadiumDate.unresolvedReason,'settlement_ambiguity','UTC midnight is not the stadium-local day boundary');
for (const change of [g=>{delete g.venue;},g=>{g.gameDate='2026-10-10T19:00:00Z';}]) {
 const game=postponedGame();change(game);
 assert.equal((await verify(group([postponedRec('Bet365')]),postponeJson(game),afterStadiumDate)).unresolvedReason,'settlement_ambiguity');
}
const noIssuedStart=postponedRec('Bet365');delete noIssuedStart.feed.eventDate;
assert.equal((await verify(group([noIssuedStart]),postponeJson(postponedGame()),afterStadiumDate)).unresolvedReason,'settlement_ambiguity');
assert.equal((await verify(group([postponedRec('Unknown')]),postponeJson(postponedGame()),afterStadiumDate)).unresolvedReason,'postponement_rule_not_verified');
for (const change of [g=>{g.linescore={currentInning:1,innings:[{num:1}]};},g=>{g.teams.away.score=0;},g=>{g.status.detailedState='Suspended';g.linescore={currentInning:4,innings:[{num:1}]};}]) {
 const game=postponedGame();change(game);
 assert.equal((await verify(group([postponedRec('Bet365')]),postponeJson(game),afterStadiumDate)).status,'unresolved','A started, scored or suspended game must not receive an unplayed VOID');
}
const cflRec=rec('CFL | British Columbia Lions @ Toronto Argonauts');cflRec.coreAssessment.context.sport='CFL';
const cfl=await verify(group([cflRec]),async()=>[{tournaments:[{cflId:6600,date:'2026-10-10T18:00:00Z',status:'complete',awaySquad:{name:'BC Lions',score:24},homeSquad:{name:'Toronto Argonauts',score:17}}]}]);
assert.equal(cfl.status,'final');assert.equal(cfl.awayScore,24);assert.ok(cfl.source.url.includes('cflscoreboard.cfl.ca'));
const tieRec=book=>({...rec('NFL | New York Giants @ Washington Commanders','New York Giants'),status:'PASS',feed:{...rec('').feed,book},coreAssessment:{context:{sport:'NFL'}}});
const tied=await verify(group([tieRec('Bet365'),tieRec('DraftKings'),tieRec('Unknown')]),async()=>({events:[{id:'nfl-123',competitions:[{id:'c-123',date:'2026-10-10T18:00:00Z',status:{type:{completed:true,description:'Final'}},competitors:[{homeAway:'away',team:{displayName:'New York Giants'},score:'27'},{homeAway:'home',team:{displayName:'Washington Commanders'},score:'27'}]}]}]}));
assert.equal(tied.status,'final');assert.equal(tied.selectionOutcomes.find(x=>x.book==='draftkings').grade,'PUSH');assert.equal(tied.selectionOutcomes.find(x=>x.book==='bet365').grade,'VOID');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'grading-recovery-test-'));
try{
 const source=path.join(temp,'run.json'),verification=path.join(temp,'verified.json'),output=path.join(temp,'observations.json');
 fs.writeFileSync(source,JSON.stringify({ts:'2026-10-10T11:00:00-07:00',recs:[{...ml,status:'PASS'}]}));
 fs.writeFileSync(verification,JSON.stringify({verifiedAt:'2026-10-12T16:00:00Z',events:[cancelled]}));
 execFileSync('node',['tools/verify-issued-results.mjs',source,verification,'--output',output],{stdio:'pipe'});
 const closed=JSON.parse(fs.readFileSync(output)).recommendations[0];assert.equal(closed.completion.grade,'VOID');assert.equal(closed.completion.finalScore,null);assert.equal(closed.completion.hypothetical,true);assert.equal(closed.completion.official,false);
 fs.writeFileSync(verification,JSON.stringify({events:[]}));
 execFileSync('node',['tools/verify-issued-results.mjs',source,verification,'--output',output],{stdio:'pipe'});
 assert.deepEqual(JSON.parse(fs.readFileSync(output)).recommendations[0].completion,closed.completion);
 fs.rmSync(output);
 fs.writeFileSync(source,JSON.stringify({ts:'2026-10-10T11:00:00-07:00',recs:[tieRec('Bet365'),tieRec('DraftKings'),tieRec('Unknown')]}));
 fs.writeFileSync(verification,JSON.stringify({events:[tied]}));
 execFileSync('node',['tools/verify-issued-results.mjs',source,verification,'--output',output],{stdio:'pipe'});
 const ties=JSON.parse(fs.readFileSync(output)).recommendations.map(x=>x.completion);
 assert.equal(ties[0].grade,'VOID');assert.equal(ties[1].grade,'PUSH');assert.equal(ties[2].state,'unresolved');assert.equal(ties[2].reason,'moneyline_tie_rule_not_verified');assert.ok(ties[0].settlementRuleSource.includes('bet365'));
 fs.rmSync(output);
 fs.writeFileSync(source,JSON.stringify({ts:'2026-10-10T11:00:00-07:00',recs:postponedRecs}));
 fs.writeFileSync(verification,JSON.stringify({verifiedAt:afterStadiumDate.toISOString(),events:[postponed]}));
 execFileSync('node',['tools/verify-issued-results.mjs',source,verification,'--output',output],{stdio:'pipe'});
 const postponedCompletions=JSON.parse(fs.readFileSync(output)).recommendations.map(x=>x.completion);
 for (const index of [0,1,4,5]) {
  const c=postponedCompletions[index];assert.equal(c.grade,'VOID');assert.equal(c.finalScore,null);assert.equal(c.settlementMethod,'exact_selection_verification');
  assert.equal(c.settlementRuleSource,postponed.selectionOutcomes.find(x=>x.book===postponedRecs[index].feed.book.toLowerCase()&&x.selectionKey===postponedRecs[index].feed.selectionKey).ruleSource);
  assert.equal(c.hypothetical,true);assert.equal(c.official,false);assert.ok(c.source.name.includes('postponement'));
 }
 assert.equal(postponedCompletions[2].state,'unresolved','An unknown book cannot inherit another book’s exact selection VOID');
 assert.equal(postponedCompletions[3].state,'unresolved','A special market cannot inherit a full-game VOID');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log('Card recovery regressions passed: @ identities, placeholders, true conflicts, full coverage, FCS provider, verified cancellation, immutable complete results.');
const {scheduledRequest}=await import('../tools/prepare-card-grading-request.mjs');
assert.equal(scheduledRequest('schedule',new Date('2026-10-13T10:08:00Z')).request.targetDate,'2026-10-12');
assert.equal(scheduledRequest('schedule',new Date('2026-10-13T11:00:00Z')).active,false);
assert.equal(scheduledRequest('schedule',new Date('2026-01-13T11:08:00Z')).request.targetDate,'2026-01-12');
assert.equal(scheduledRequest('schedule',new Date('2026-01-13T10:00:00Z')).active,false);
assert.equal(scheduledRequest('schedule',new Date('2026-10-13T10:08:00Z'),()=>true).active,false);
assert.equal(scheduledRequest('push').active,true);assert.equal(scheduledRequest('push').request,null);
console.log('Native grading schedule regressions passed: Vancouver date, PST/PDT, delayed starts, duplicate receipts and manual requests.');


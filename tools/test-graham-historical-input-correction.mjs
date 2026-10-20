import assert from 'node:assert/strict';
import fs from 'node:fs';
import {historicalInputCorrection,correctionDigest,HISTORICAL_CORRECTION,verifiedCorrectionPublication} from './graham-historical-input-correction.mjs';
import {weeklyCalculation} from './apply-graham-carried-rating-audit.mjs';
import {refreshRatingBases} from './graham-refresh-rating-bases.mjs';
const sum=(...xs)=>Number(xs.reduce((s,x)=>s+x,0).toFixed(12));
const fixture=()=>{
 const active={season:2026,week:7},teams=['A','B','C','D',...Array.from({length:28},(_,i)=>'BYE'+i)].map(abbr=>({abbr,currentRating:10,seedRating:10,history:[{type:'SEED',sequence:0,toRating:10,effectiveAt:'2026-09-01T00:00:00Z'}]}));
 const by=new Map(teams.map(t=>[t.abbr,t])),evidence=new Map(),weeks=[];
 for(const week of [5,6]){
  const games=(week===5?[['A','B'],['C','D']]:[['A','C'],['B','D']]).map(([away,home])=>({gameKey:`2026-W0${week}-${away}-${home}`,away,home,awayScore:27,homeScore:20,startTimePacific:`2026-10-${week===5?'11':'18'}T13:00:00-07:00`,homeFieldVenueClass:'DOMESTIC_HOME',homeFieldAdvantagePoints:2.082}));
  for(const g of games){
   const binding={path:`original-${g.gameKey}.json`,blobSha:'a'.repeat(40)},old=[by.get(g.away).currentRating,by.get(g.home).currentRating],rows=[];
   [g.away,g.home].forEach((abbr,i)=>{
    const t=by.get(abbr),inputs={oldRating:old[i],opponentOldRating:old[1-i],scoreMargin:i?-7:7,teamInjuryLoss:.2,opponentInjuryLoss:.2,teamLocationAdvantage:i?2.082:-2.082},c=weeklyCalculation(inputs);
    const e={type:'WALTERS_WEEKLY_90_10',sequence:week-4,season:2026,sourceWeek:week,targetWeek:week+1,gameKey:g.gameKey,opponent:i?g.away:g.home,auditId:'weekly-'+week,effectiveAt:`2026-10-${week===5?'13':'20'}T13:00:00Z`,kickoff:g.startTimePacific,fromRating:old[i],toRating:c.newRating,tgpl:c.tgpl,delta:c.delta,tgplInputs:{...inputs},gameDayEvidenceBinding:binding,formulaIds:['BW-R016','BW-R017','BW-R018'],sourceRefs:['official-gamebook'],marketViewed:false};delete e.tgplInputs.oldRating;t.history.push(e);t.currentRating=e.toRating;rows.push({team:abbr,injuryLoss:.2});
   });evidence.set(binding.path,{bundle:{},game:{gameKey:g.gameKey,state:'READY',teams:rows}});
  }weeks.push({sourceWeek:week,games,sourceRefs:['official-finals']});
 }
 const key=weeks[0].games[0].gameKey,old=by.get('A').history[1].gameDayEvidenceBinding;
 evidence.set('corrected.json',{bundle:{correctionIntent:{state:'PENDING_GOVERNED_APPEND_ONLY_CORRECTION',sourceWeek:5,targetWeek:6,gameKey:key,originalHistoricalEventsPreserved:true,originalEvidencePath:old.path}},game:{gameKey:key,state:'READY',teams:[{team:'A',injuryLoss:.7},{team:'B',injuryLoss:.2}]}});
 const receipt=w=>({season:2026,sourceWeek:w,targetWeek:w+1,state:'COMPLETE',gamesProcessed:2,gamesUpdated:2,teamsUpdated:4,blockedGames:[],marketViewed:false});
 const power={season:2026,teams,weekly90_10:{...receipt(6),previousReceipts:[receipt(5)]}};
 const input={schema:1,state:'READY',auditType:HISTORICAL_CORRECTION,season:2026,sourceWeek:5,targetWeek:7,auditId:'correction-test',effectiveAt:'2026-10-20T23:00:00Z',marketViewed:false,sourceRefs:['corrected.json'],corrections:[{gameKey:key,evidenceBinding:{path:'corrected.json',blobSha:'a'.repeat(40)}}],expectedRatings:Object.fromEntries(teams.map(t=>[t.abbr,t.currentRating])),historySha256:Object.fromEntries(teams.map(t=>[t.abbr,correctionDigest(t.history)])),priorWeekCompletion:{finals:weeks[1].games}};
 return {active,power,input,facts:{season:2026,sourceWeek:5,targetWeek:7,marketViewed:false,weeks,sourceRefs:['verified-facts']},loadEvidence:b=>{if(b.blobSha!=='a'.repeat(40)||!evidence.has(b.path))throw Error('BINDING');return structuredClone(evidence.get(b.path));},calculate:weeklyCalculation,sum};
};
let n=0;const test=(name,f)=>{f();n++;console.log('PASS '+name);};
const apply=x=>{const result=historicalInputCorrection(x);Object.assign(x.input,{state:'APPLIED',appliedAt:x.input.effectiveAt,result});return result;};
test('crossed next-week opponents receive exact propagated correction',()=>{const x=fixture(),r=apply(x);assert.deepEqual(r.ratingChanges.map(c=>[c.team,c.delta]),[['A',.045],['B',-.045],['C',.005],['D',-.005]]);assert.equal(sum(...r.ratingChanges.map(c=>c.delta)),0);assert.ok(verifiedCorrectionPublication(x.power,x.input));});
test('original history and prior completion receipts remain unchanged',()=>{const x=fixture(),before=structuredClone(x.power);apply(x);for(const t of before.teams){const now=x.power.teams.find(a=>a.abbr===t.abbr);assert.deepEqual(now.history.slice(0,t.history.length),t.history);if(t.abbr.startsWith('BYE'))assert.deepEqual(now,t);}assert.deepEqual(x.power.weekly90_10.previousReceipts,before.weekly90_10.previousReceipts);});
const blocked=(name,edit,pattern)=>test(name,()=>{const x=fixture();edit(x);const before=JSON.stringify(x.power);assert.throws(()=>apply(x),pattern);assert.equal(JSON.stringify(x.power),before);});
blocked('partial next-week slate blocks all correction writes',x=>x.power.weekly90_10.state='PARTIAL_BLOCKED',/COMPLETE_PRIOR_WEEK/);
blocked('incomplete source-week receipt blocks',x=>x.power.weekly90_10.previousReceipts[0].gamesUpdated=1,/SOURCE_WEEK_COMPLETION/);
blocked('current rating drift blocks',x=>x.power.teams[0].currentRating+=.1,/CURRENT_OR_HISTORY/);
blocked('history drift blocks',x=>x.power.teams[0].history[1].reason='changed',/CURRENT_OR_HISTORY/);
blocked('final score mismatch blocks',x=>x.facts.weeks[1].games[0].awayScore=28,/SCORE_OR_LOCATION/);
blocked('preserved location mismatch blocks',x=>x.facts.weeks[1].games[0].homeFieldAdvantagePoints=1.5,/SCORE_OR_LOCATION/);
blocked('one-sided pair cannot replay',x=>{x.power.teams[1].history.pop();x.input.historySha256.B=correctionDigest(x.power.teams[1].history);},/PAIRED_EVENT/);
blocked('changed original arithmetic cannot replay',x=>{x.power.teams[0].history[1].tgpl+=.1;x.input.historySha256.A=correctionDigest(x.power.teams[0].history);},/EVENT_ARITHMETIC/);
blocked('unbound corrected evidence rejected',x=>x.input.corrections[0].evidenceBinding.blobSha='b'.repeat(40),/BINDING/);
blocked('original injury totals must match bound evidence',x=>{const load=x.loadEvidence;x.loadEvidence=(...args)=>{const j=load(...args);if(args[0].path.startsWith('original-'))j.game.teams[0].injuryLoss=.3;return j;};},/ORIGINAL_EVIDENCE_TOTAL/);
blocked('intervening durable transaction cannot be overwritten',x=>{const t=x.power.teams[0];t.history.push({type:'DURABLE',sequence:3,toRating:t.currentRating,effectiveAt:'2026-10-20T14:00:00Z'});x.input.historySha256.A=correctionDigest(t.history);},/INTERVENING_TRANSACTION/);
blocked('wrong original evidence intent blocks',x=>{const load=x.loadEvidence;x.loadEvidence=(...a)=>{const j=load(...a);if(a[0].path==='corrected.json')j.bundle.correctionIntent.originalEvidencePath='wrong.json';return j;};},/CORRECTION_EVIDENCE_INTENT/);
test('duplicate audit appends no second event',()=>{const x=fixture();apply(x);const before=JSON.stringify(x.power);assert.throws(()=>apply(x),/AUDIT_ALREADY_APPLIED/);assert.equal(JSON.stringify(x.power),before);});
test('tampered correction proof cannot certify publication',()=>{const x=fixture();apply(x);x.power.historicalInputCorrections[0].replayProof[0].teams[0].correctedToRating+=1;assert.equal(verifiedCorrectionPublication(x.power,x.input),false);});
test('neutral refresh accepts source-week or next-week stored bases and preserves orthogonal layers',()=>{
 for(const useNext of [false,true]){
  const x=fixture(),policy=JSON.parse(fs.readFileSync('data/walters/nfl/graham-fair-decomposition-policy-v1.json'));
  const stored=a=>x.power.teams.find(t=>t.abbr===a).history[useNext?2:1].toRating;
  const neutral=sum(stored('A'),-stored('C'));
  const g={gameKey:'2026-W07-A-C',away:'A',home:'C',startTimePacific:'2026-10-25T13:00:00-07:00',neutralBaseHome:neutral,grahamExactFairHome:Number((neutral-2.082+.25+.125).toFixed(3)),grahamFairHome:0,homeFieldPointsToHomeSpread:-2.082,personnelOverlayPointsToHomeSpread:.25,matchupOverlayPointsToHomeSpread:.125,personnelBaselineExactFairHome:neutral-2.082+.125,homeFieldNonLocationExactFairHome:neutral+.25+.125,sourceRefs:[],adjustments:[],ratingCarryForward:{awayRating:stored('A'),homeRating:stored('C')}};g.grahamFairHome=Math.round(g.grahamExactFairHome*2)/2;
  const board={season:2026,week:7,baselineStatus:'PENDING_TUESDAY_GRAHAM_BASELINE',games:[g]};apply(x);
  const r=refreshRatingBases({board,power:x.power,staging:x.input,active:x.active,policy,effectiveAt:'2026-10-20T23:01:00Z',powerBlobSha:'a'.repeat(40)});
  assert.equal(r.games.length,1);assert.equal(r.board.games[0].personnelOverlayPointsToHomeSpread,.25);assert.equal(r.board.games[0].matchupOverlayPointsToHomeSpread,.125);assert.equal(r.board.games[0].homeFieldPointsToHomeSpread,-2.082);assert.equal(r.board.baselineStatus,board.baselineStatus);assert.deepEqual(g,board.games[0]);
  assert.equal(refreshRatingBases({board:r.board,power:x.power,staging:x.input,active:x.active,policy,effectiveAt:'2026-10-20T23:02:00Z',powerBlobSha:'a'.repeat(40)}).games.length,0);
 }
});
console.log(`HISTORICAL INPUT CORRECTION: ${n} PASS`);

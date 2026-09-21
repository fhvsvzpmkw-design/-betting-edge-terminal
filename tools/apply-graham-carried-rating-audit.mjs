#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {verifyWeeklyGameEvidence,WEEKLY_EVIDENCE_FROM} from './graham-weekly-evidence.mjs';
import {resolveGrahamActiveWeek,grahamWeekPaths} from './graham-active-week.mjs';
import {roundHalf, synchronizeGrahamFairBoard} from './graham-fair-decomposition.mjs';

const ROOT=process.cwd();
const INPUT=path.resolve(ROOT,process.argv[2]||'data/walters/nfl/carried-rating-audit-staging.json');
const POWER=path.join(ROOT,'data/walters/nfl-power-ratings-ledger.json');
const H4_PROD=path.join(ROOT,'data/walters/nfl/home-field/home-field-production-current.json');
const H4_CURRENT=path.join(ROOT,'data/walters/nfl/home-field/h4-current.json');
const PERSONNEL_PROD=path.join(ROOT,'data/walters/nfl/personnel-production-current.json');
const MATCHUP_PROD=path.join(ROOT,'data/walters/nfl/matchup-production-current.json');
const QB_PROD=path.join(ROOT,'data/walters/nfl/qb-production-current.json');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,j)=>fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');
const round=(n,d=3)=>Number(Number(n).toFixed(d));
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const close=(a,b,tol=0.0005)=>Math.abs(Number(a)-Number(b))<=tol;
const unique=a=>[...new Set((a||[]).filter(Boolean))];
const fail=m=>{throw new Error(`GRAHAM_CARRIED_RATING_AUDIT:${m}`);};

// Exact finite-decimal arithmetic: no TGPL or rating quantization.
function dec(v){
  if(!finite(v)||typeof v==='boolean')fail('INVALID_DECIMAL');
  const m=String(v).match(/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
  if(!m)fail('INVALID_DECIMAL');
  let n=BigInt((m[1]||'')+m[2]+(m[3]||'')),s=(m[3]||'').length-Number(m[4]||0);
  if(s<0){n*=10n**BigInt(-s);s=0;}
  while(s>0&&n%10n===0n){n/=10n;s--;}
  return {n,s};
}
function decimalText(d){const neg=d.n<0n;let x=(neg?-d.n:d.n).toString().padStart(d.s+1,'0');return (neg?'-':'')+(d.s?x.slice(0,-d.s)+'.'+x.slice(-d.s):x);}
function exactNumber(d){const n=Number(decimalText(d)),r=dec(n);if(!Number.isFinite(n)||r.n*10n**BigInt(d.s)!==d.n*10n**BigInt(r.s))fail('EXACT_DECIMAL_NOT_REPRESENTABLE_IN_LEDGER');return n;}
function exactSum(...vs){const ds=vs.map(dec),s=Math.max(...ds.map(x=>x.s));return exactNumber({n:ds.reduce((n,d)=>n+d.n*10n**BigInt(s-d.s),0n),s});}
function exactProduct(a,b){const x=dec(a),y=dec(b);return exactNumber({n:x.n*y.n,s:x.s+y.s});}
function weeklyCalculation(t){
  for(const k of ['oldRating','opponentOldRating','scoreMargin','teamInjuryLoss','opponentInjuryLoss','teamLocationAdvantage'])if(!finite(t[k])||typeof t[k]==='boolean')fail(`INPUT_MISSING:${t.team}:${k}`);
  if(Number(t.teamInjuryLoss)<0||Number(t.opponentInjuryLoss)<0)fail(`NEGATIVE_INJURY_LOSS:${t.team}`);
  const tgpl=exactSum(t.scoreMargin,t.opponentOldRating,t.teamInjuryLoss,-Number(t.opponentInjuryLoss),-Number(t.teamLocationAdvantage));
  const newRating=exactSum(exactProduct('0.9',t.oldRating),exactProduct('0.1',tgpl));
  return {tgpl,newRating,delta:exactSum(newRating,-Number(t.oldRating))};
}
function weeklyUpdate(input,power,active,prior){
  const formulas=['BW-R016','BW-R017','BW-R018'];
  if(input.season!==active.season||input.targetWeek!==active.week||input.sourceWeek!==active.week-1||active.week<2)fail('WEEKLY_WEEK_MISMATCH');
  if(!formulas.every(x=>input.formulaIds?.includes(x)))fail('FORMULA_IDS_INVALID');
  if(prior.season!==active.season||prior.week!==input.sourceWeek||!Array.isArray(prior.games)||!prior.games.length)fail('PRIOR_WEEK_SCHEDULE_INVALID');
  if(power.season!==active.season||!Array.isArray(power.teams)||power.teams.length!==32||new Set(power.teams.map(t=>t.abbr)).size!==32)fail('POWER_LEDGER_INVALID');
  const schedule=new Map(prior.games.map(g=>[g.gameKey,g]));
  if(schedule.size!==prior.games.length||new Set(prior.games.flatMap(g=>[g.away,g.home])).size!==2*prior.games.length)fail('PRIOR_GAME_IDENTITY_CONFLICT');
  const completion=input.priorWeekCompletion;
  if(completion?.state!=='COMPLETE'||completion.season!==active.season||completion.week!==input.sourceWeek||!completion.sourceRefs?.length||!Array.isArray(completion.finals)||completion.finals.length!==schedule.size)fail('PRIOR_WEEK_COMPLETION_UNVERIFIED');
  const finals=new Map(completion.finals.map(g=>[g.gameKey,g]));
  if(finals.size!==schedule.size)fail('DUPLICATE_FINAL_GAME');
  for(const g of prior.games){const f=finals.get(g.gameKey);if(!f||f.away!==g.away||f.home!==g.home||f.state!=='FINAL'||![f.awayScore,f.homeScore].every(x=>Number.isInteger(x)&&x>=0))fail(`FINAL_IDENTITY_UNVERIFIED:${g.gameKey}`);}
  if(!Array.isArray(input.games))fail('GAMES_MISSING');
  const supplied=new Map();
  for(const g of input.games){const p=schedule.get(g.gameKey);if(!p||p.away!==g.away||p.home!==g.home||supplied.has(g.gameKey)||!['READY','BLOCKED'].includes(g.status))fail(`INVALID_OR_DUPLICATE_GAME:${g.gameKey}`);supplied.set(g.gameKey,g);}
  const previous=power.weekly90_10;
  const matching=previous?.sourceWeek===input.sourceWeek&&previous?.targetWeek===input.targetWeek;
  if(matching&&(previous.schema!==1||previous.marketViewed!==false||!['COMPLETE','PARTIAL_BLOCKED'].includes(previous.state)||!formulas.every(x=>previous.formulaIds?.includes(x))))fail('EXISTING_RECEIPT_INVALID');
  if(previous&&!matching&&previous.targetWeek>=input.targetWeek)fail('RECEIPT_WEEK_CONFLICT');
  if(matching&&input.resume!==true)fail('EXPLICIT_RESUME_REQUIRED');
  if(matching&&previous.attempts?.some(a=>a.auditId===input.auditId))fail('AUDIT_ID_ALREADY_RECORDED');
  const oldBlocked=new Map((matching?previous.blockedGames:[]).map(g=>[g.gameKey,g]));
  const originalTeams=JSON.stringify(power.teams),ratingChanges=[],successfulGames=[],alreadyAppliedGames=[],blockedGames=[];
  const byTeam=new Map(power.teams.map(t=>[t.abbr,t]));
  const eventsFor=(team,g)=>(team.history||[]).filter(e=>e.type==='WALTERS_WEEKLY_90_10'&&e.sourceWeek===input.sourceWeek&&e.targetWeek===input.targetWeek&&e.gameKey===g.gameKey);
  const frozen=(team,kickoff)=>{
    const hs=(team.history||[]).filter(e=>Number.isFinite(Date.parse(e.effectiveAt))&&Date.parse(e.effectiveAt)<=kickoff&&finite(e.toRating)).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)||(Number(a.sequence)||0)-(Number(b.sequence)||0));
    if(!hs.length)fail(`PREGAME_RATING_UNVERIFIED:${team.abbr}`);return Number(hs.at(-1).toRating);
  };
  const verifyPair=(g,es)=>{
    const ts=[g.away,g.home].map((abbr,i)=>{const e=es[i];if(e.marketViewed!==false||!formulas.every(x=>e.formulaIds?.includes(x))||!e.sourceRefs?.length)fail(`EXISTING_EVENT_AUTHORITY:${abbr}`);const t={team:abbr,oldRating:e.fromRating,...e.tgplInputs},c=weeklyCalculation(t);if(e.tgpl!==c.tgpl||e.toRating!==c.newRating||e.delta!==c.delta||e.opponent!==[g.home,g.away][i])fail(`EXISTING_EVENT_ARITHMETIC:${abbr}`);return t;});
    const [a,b]=ts;
    if(a.oldRating!==b.opponentOldRating||b.oldRating!==a.opponentOldRating||a.scoreMargin!==-b.scoreMargin||a.teamInjuryLoss!==b.opponentInjuryLoss||b.teamInjuryLoss!==a.opponentInjuryLoss||a.teamLocationAdvantage!==-b.teamLocationAdvantage)fail(`EXISTING_PAIR_SNAPSHOT_CONFLICT:${g.gameKey}`);
    const f=finals.get(g.gameKey);if(a.scoreMargin!==f.awayScore-f.homeScore)fail(`EXISTING_EVENT_SCORE_CONFLICT:${g.gameKey}`);
  };
  for(const p of prior.games){
    const g=supplied.get(p.gameKey),ledgerTeams=[byTeam.get(p.away),byTeam.get(p.home)];
    try{
      if(ledgerTeams.some(t=>!t))fail('TEAM_NOT_FOUND');
      const existing=ledgerTeams.map(t=>eventsFor(t,p));
      if(existing.some(es=>es.length)){
        if(existing.some(es=>es.length!==1))fail('ONE_SIDED_OR_DUPLICATE_WEEKLY_HISTORY');
        verifyPair(p,existing.map(es=>es[0]));
        // Never reset lastDelta/currentRating: a later legitimate transaction may exist.
        successfulGames.push(p.gameKey);alreadyAppliedGames.push(p.gameKey);continue;
      }
      if(!g||g.status==='BLOCKED'){
        const b=g||oldBlocked.get(p.gameKey);
        blockedGames.push({gameKey:p.gameKey,away:p.away,home:p.home,reasons:b?.reasons?.length?b.reasons:['REQUIRED_GAME_DAY_INPUTS_NOT_SUBMITTED'],sourceRefs:unique(b?.sourceRefs||[])});continue;
      }
      if(Date.parse(input.effectiveAt)>=Date.parse(WEEKLY_EVIDENCE_FROM))verifyWeeklyGameEvidence(ROOT,input,g);
      const kickoff=Date.parse(p.startTimePacific);
      if(!Number.isFinite(kickoff)||kickoff>=Date.parse(input.effectiveAt))fail('PREGAME_KICKOFF_UNVERIFIED');
      const old=ledgerTeams.map(t=>frozen(t,kickoff));
      if(ledgerTeams.some((t,i)=>Number(t.currentRating)!==old[i]||(t.history||[]).some(e=>Date.parse(e.effectiveAt)>kickoff)))fail('INTERVENING_CARRIED_RATING_UPDATE_REQUIRES_RECONCILIATION');
      if(!Array.isArray(g.teams)||g.teams.length!==2||new Set(g.teams.map(t=>t.team)).size!==2)fail('READY_TEAMS_INVALID');
      const evidence=g.gameDayEvidence;
      if(evidence?.season!==active.season||evidence.sourceWeek!==input.sourceWeek||evidence.gameKey!==p.gameKey||evidence.coverage!=='FINAL_GAME_DAY'||evidence.marketViewed!==false||!evidence.sourceRefs?.length)fail('GOVERNED_GAME_DAY_EVIDENCE_REQUIRED');
      const venue=p.homeFieldVenueClass,h=Number(p.homeFieldAdvantagePoints);
      if(!['DOMESTIC_HOME','NEUTRAL','INTERNATIONAL_NEUTRAL'].includes(venue)||!finite(p.homeFieldAdvantagePoints)||(venue!=='DOMESTIC_HOME'&&h!==0)||h<0)fail('PRESERVED_H4_LOCATION_UNVERIFIED');
      const f=finals.get(p.gameKey),updates=[];
      for(let i=0;i<2;i++){
        const abbr=[p.away,p.home][i],opp=[p.home,p.away][i],t=g.teams.find(t=>t.team===abbr),ev=evidence.teams?.find(t=>t.team===abbr);
        if(!t||t.opponent!==opp||t.oldRating!==old[i]||t.opponentOldRating!==old[1-i])fail(`FROZEN_RATING_MISMATCH:${abbr}`);
        if(!ev||ev.state!=='GOVERNED'||ev.injuryLoss!==t.teamInjuryLoss||!ev.sourceRefs?.length||!ev.sourceRefs.some(r=>String(r).includes(`/week-${String(input.sourceWeek).padStart(2,'0')}-`)))fail(`GOVERNED_INJURY_VALUE_MISSING:${abbr}`);
        if(t.scoreMargin!==(i===0?f.awayScore-f.homeScore:f.homeScore-f.awayScore)||t.teamLocationAdvantage!==(i===0?-h:h))fail(`SCORE_OR_PRESERVED_LOCATION_MISMATCH:${abbr}`);
        updates.push({t,ledgerTeam:ledgerTeams[i],...weeklyCalculation(t)});
      }
      const [a,b]=updates;
      if(a.t.teamInjuryLoss!==b.t.opponentInjuryLoss||b.t.teamInjuryLoss!==a.t.opponentInjuryLoss)fail('INJURY_SNAPSHOT_ASYMMETRY');
      // Both results and all evidence pass before either team is changed.
      for(const u of updates){
        const team=u.ledgerTeam,t=u.t,sourceRefs=unique([...(t.sourceRefs||[]),...(g.sourceRefs||[]),...evidence.sourceRefs,...evidence.teams.find(e=>e.team===t.team).sourceRefs,...completion.sourceRefs]);
        const e={sequence:(team.history||[]).length?Math.max(...team.history.map(e=>Number(e.sequence)||0))+1:0,type:'WALTERS_WEEKLY_90_10',auditId:input.auditId,fromRating:t.oldRating,priorRating:t.oldRating,delta:u.delta,toRating:u.newRating,currentRating:u.newRating,effectiveAt:input.effectiveAt,reason:`Source-exact Walters weekly update from ${p.gameKey}: TGPL ${u.tgpl}; 90% frozen pregame rating plus 10% TGPL.`,season:active.season,sourceWeek:input.sourceWeek,targetWeek:input.targetWeek,gameKey:p.gameKey,opponent:t.opponent,kickoff:p.startTimePacific,tgplInputs:{scoreMargin:t.scoreMargin,opponentOldRating:t.opponentOldRating,teamInjuryLoss:t.teamInjuryLoss,opponentInjuryLoss:t.opponentInjuryLoss,teamLocationAdvantage:t.teamLocationAdvantage},tgpl:u.tgpl,formulaIds:formulas,sourceRefs,marketViewed:false};
        if(evidence.evidenceBinding)e.gameDayEvidenceBinding=structuredClone(evidence.evidenceBinding);
        team.priorRating=t.oldRating;team.currentRating=u.newRating;team.lastDelta=u.delta;team.lastUpdatedAt=input.effectiveAt;team.lastUpdateType='WALTERS_WEEKLY_90_10';team.sourceRefs=unique([...(team.sourceRefs||[]),...sourceRefs]);team.history=[...(team.history||[]),e];
        ratingChanges.push({team:t.team,gameKey:p.gameKey,priorRating:t.oldRating,tgpl:u.tgpl,delta:u.delta,currentRating:u.newRating,tgplInputs:e.tgplInputs,sourceRefs});
      }
      successfulGames.push(p.gameKey);
    }catch(err){blockedGames.push({gameKey:p.gameKey,away:p.away,home:p.home,reasons:[String(err.message)],sourceRefs:unique(g?.sourceRefs||oldBlocked.get(p.gameKey)?.sourceRefs||[])});}
  }
  const state=blockedGames.length?'PARTIAL_BLOCKED':'COMPLETE';
  const attempt={auditId:input.auditId,appliedAt:input.effectiveAt,newGamesUpdated:ratingChanges.length/2,newTeamsUpdated:ratingChanges.length,alreadyAppliedGames,blockedGames,sourceRefs:unique(input.sourceRefs||[]),marketViewed:false};
  const receipt={...(matching?previous:{}),schema:1,season:active.season,sourceWeek:input.sourceWeek,targetWeek:input.targetWeek,state,appliedAt:input.effectiveAt,formulaIds:formulas,marketViewed:false,gamesProcessed:prior.games.length,gamesUpdated:successfulGames.length,teamsUpdated:successfulGames.length*2,blockedGames,attempts:[...(matching?previous.attempts||[]:[]),attempt]};
  if(previous&&!matching)receipt.previousReceipts=[previous];
  power.weekly90_10=receipt;power.updatedAt=input.effectiveAt;
  // Cumulative success must be supported by two exact persisted events per game.
  for(const key of successfulGames){const g=schedule.get(key);verifyPair(g,[pAway(g),pHome(g)]);}
  function pAway(g){return eventsFor(byTeam.get(g.away),g)[0];}
  function pHome(g){return eventsFor(byTeam.get(g.home),g)[0];}
  if(!ratingChanges.length&&JSON.stringify(power.teams)!==originalTeams)fail('NOOP_MUTATED_TEAM_LEDGER');
  return {state,ratingChanges,successfulGames,alreadyAppliedGames,blockedGames,receipt,marketViewed:false};
}

if(process.argv[2]==='--self-test'){
  const assert=(await import('node:assert/strict')).default;
  let tests=0;const test=(name,f)=>{f();tests++;console.log(`PASS ${name}`);};
  const inputFor=(old,opp,margin,inj,oppInj,h)=>({oldRating:old,opponentOldRating:opp,scoreMargin:margin,teamInjuryLoss:inj,opponentInjuryLoss:oppInj,teamLocationAdvantage:h});
  test('book neutral Bears',()=>assert.equal(weeklyCalculation(inputFor(10,4,7,3.5,1.7,0)).newRating,10.28));
  test('book neutral Vikings',()=>assert.equal(weeklyCalculation(inputFor(4,10,-7,1.7,3.5,0)).newRating,3.72));
  test('book home Bears',()=>assert.equal(weeklyCalculation(inputFor(10,4,7,3.5,1.7,2)).newRating,10.08));
  test('book visiting Vikings',()=>assert.equal(weeklyCalculation(inputFor(4,10,-7,1.7,3.5,0-2)).newRating,3.92));
  test('unrounded four-decimal old ratings',()=>assert.deepEqual(weeklyCalculation(inputFor(28.0082,19.5382,7,0.25,0.125,-2.082)),{tgpl:28.7452,newRating:28.0819,delta:0.0737}));
  test('missing injury is not zero',()=>assert.throws(()=>weeklyCalculation(inputFor(10,4,7,null,0,0))));
  test('negative injury rejected',()=>assert.throws(()=>weeklyCalculation(inputFor(10,4,7,-0.1,0,0))));
  const fixture=()=>{
    const active={season:2026,week:2};
    const prior={season:2026,week:1,games:[{gameKey:'2026-W01-A-B',away:'A',home:'B',startTimePacific:'2026-09-13T10:00:00-07:00',homeFieldVenueClass:'DOMESTIC_HOME',homeFieldAdvantagePoints:2.082},{gameKey:'2026-W01-C-D',away:'C',home:'D',startTimePacific:'2026-09-13T10:00:00-07:00',homeFieldVenueClass:'NEUTRAL',homeFieldAdvantagePoints:0}]};
    const power={season:2026,teams:['A','B','C','D',...Array.from({length:28},(_,i)=>'BYE'+i)].map(abbr=>({abbr,currentRating:10,seedRating:10,lastDelta:0,history:[{type:'SEED',sequence:0,toRating:10,effectiveAt:'2026-09-01T00:00:00Z'}]}))};
    const source='data/walters/nfl/2026/week-01-personnel-ledger.json';
    const games=prior.games.map(p=>({gameKey:p.gameKey,away:p.away,home:p.home,status:'READY',sourceRefs:[source],teams:[p.away,p.home].map((team,i)=>({team,opponent:i?p.away:p.home,...inputFor(10,10,i?-7:7,0,0,i?p.homeFieldAdvantagePoints:-p.homeFieldAdvantagePoints)})),gameDayEvidence:{season:2026,sourceWeek:1,gameKey:p.gameKey,coverage:'FINAL_GAME_DAY',marketViewed:false,sourceRefs:[source],teams:[p.away,p.home].map(team=>({team,state:'GOVERNED',injuryLoss:0,sourceRefs:[source]}))}}));
    const input={schema:1,state:'READY',auditId:'test-1',season:2026,sourceWeek:1,targetWeek:2,marketViewed:false,effectiveAt:'2026-09-15T10:00:00-07:00',formulaIds:['BW-R016','BW-R017','BW-R018'],games,priorWeekCompletion:{season:2026,week:1,state:'COMPLETE',sourceRefs:['official-final-test-fixture'],finals:prior.games.map(g=>({gameKey:g.gameKey,away:g.away,home:g.home,state:'FINAL',awayScore:27,homeScore:20}))}};
    return {active,prior,power,input};
  };
  const run=x=>weeklyUpdate(x.input,x.power,x.active,x.prior);
  test('both teams use frozen snapshot and exact H4',()=>{const x=fixture(),r=run(x);assert.equal(r.receipt.teamsUpdated,4);assert.equal(x.power.teams[0].currentRating,10.9082);assert.equal(x.power.teams[1].currentRating,9.0918);});
  test('partial then subset recovery is cumulative',()=>{const x=fixture(),g=x.input.games[1];x.input.games[1]={...g,status:'BLOCKED',reasons:['missing injury']};assert.equal(run(x).receipt.teamsUpdated,2);const before=JSON.stringify(x.power.teams.slice(0,2));x.input={...x.input,auditId:'test-2',resume:true,games:[g]};const r=run(x);assert.equal(r.ratingChanges.length,2);assert.equal(r.receipt.teamsUpdated,4);assert.equal(JSON.stringify(x.power.teams.slice(0,2)),before);});
  test('complete replay preserves all team fields',()=>{const x=fixture();run(x);const before=JSON.stringify(x.power.teams);x.input={...x.input,auditId:'test-2',resume:true,games:[]};assert.equal(run(x).ratingChanges.length,0);assert.equal(JSON.stringify(x.power.teams),before);});
  test('prior history survives recovery receipt',()=>{const x=fixture();run(x);x.input={...x.input,auditId:'test-2',resume:true,games:[]};run(x);assert.equal(x.power.weekly90_10.attempts.length,2);});
  test('intervening carried rating fails only affected game',()=>{const x=fixture();x.power.teams[0].currentRating=11;x.power.teams[0].history.push({type:'DURABLE',sequence:1,toRating:11,effectiveAt:'2026-09-15T08:00:00-07:00'});const r=run(x);assert.equal(r.ratingChanges.length,2);assert.match(r.blockedGames[0].reasons[0],/INTERVENING/);assert.equal(x.power.teams[0].currentRating,11);});
  test('one-sided history never double-updates opponent',()=>{const x=fixture();run(x);x.power.teams[0].history.pop();const before=JSON.stringify(x.power.teams);x.input={...x.input,auditId:'test-2',resume:true,games:[]};const r=run(x);assert.match(r.blockedGames[0].reasons[0],/ONE_SIDED/);assert.equal(JSON.stringify(x.power.teams),before);});
  test('invalid game identity rejected',()=>{const x=fixture();x.input.games[0].away='Z';assert.throws(()=>run(x),/INVALID_OR_DUPLICATE_GAME/);});
  test('incomplete prior week rejected',()=>{const x=fixture();x.input.priorWeekCompletion.finals[0].state='PENDING';assert.throws(()=>run(x),/FINAL_IDENTITY_UNVERIFIED/);});
  test('wrong active week rejected',()=>{const x=fixture();x.active.week=3;assert.throws(()=>run(x),/WEEKLY_WEEK_MISMATCH/);});
  test('unsupported injury evidence blocks paired teams',()=>{const x=fixture();delete x.input.games[0].gameDayEvidence;const r=run(x);assert.equal(r.ratingChanges.length,2);assert.equal(x.power.teams[0].history.length,1);assert.equal(x.power.teams[1].history.length,1);});
  test('unresolved venue blocks paired teams',()=>{const x=fixture();x.prior.games[0].homeFieldVenueClass='UNRESOLVED';assert.equal(run(x).ratingChanges.length,2);});
  test('score mismatch blocks paired teams',()=>{const x=fixture();x.input.games[0].teams[0].scoreMargin=6;assert.equal(run(x).ratingChanges.length,2);});
  test('already-applied later durable delta preserved',()=>{const x=fixture();run(x);x.power.teams[0].currentRating=11;x.power.teams[0].lastDelta=0.0918;x.power.teams[0].history.push({type:'DURABLE',sequence:2,toRating:11,effectiveAt:'2026-09-15T11:00:00-07:00'});const before=JSON.stringify(x.power.teams);x.input={...x.input,auditId:'test-2',resume:true,games:[]};run(x);assert.equal(JSON.stringify(x.power.teams),before);});
  console.log(`WALTERS WEEKLY RECOVERY SELF-TEST: ${tests} PASS`);process.exit(0);
}

const input=read(INPUT);
if(input.schema!==1||input.state!=='READY'||input.marketViewed!==false)fail('INVALID_STAGING');
if(!input.auditId||!input.effectiveAt||Number.isNaN(Date.parse(input.effectiveAt)))fail('INVALID_AUDIT_ID_OR_TIME');
if(/\b(Pinnacle|Bet365|DraftKings|sportsbook consensus|line movement|market-implied rating)\b/i.test(JSON.stringify(input)))fail('MARKET_CONTAMINATION');

if(input.auditType==='WALTERS_WEEKLY_90_10'){
  if(Date.parse(input.effectiveAt)<Date.parse(WEEKLY_EVIDENCE_FROM))fail('NEW_WEEKLY_ATTEMPT_CANNOT_PREDATE_EVIDENCE_AUTHORITY');
  const active=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});
  const priorPaths=grahamWeekPaths(active.season,active.week-1,{root:ROOT});
  const power=read(POWER),before=JSON.stringify(power),prior=read(priorPaths.absolute.currentNumbers);
  const result=weeklyUpdate(input,power,active,prior);
  const after=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});
  if(JSON.stringify(after.manifest)!==JSON.stringify(active.manifest))fail('ACTIVE_WEEK_CHANGED_DURING_AUDIT');
  if(JSON.stringify(read(POWER))!==before)fail('POWER_LEDGER_CHANGED_DURING_AUDIT');
  input.state='APPLIED';input.appliedAt=input.effectiveAt;input.result=result;
  write(POWER,power);write(INPUT,input);
  if(JSON.stringify(read(POWER))!==JSON.stringify(power)||JSON.stringify(read(INPUT))!==JSON.stringify(input))fail('EXACT_READBACK_FAILED');
  console.log(`WALTERS WEEKLY 90/10 ${result.state} // ${result.successfulGames.length} CUMULATIVE GAMES // ${result.ratingChanges.length} NEW TEAMS // ${result.alreadyAppliedGames.length} ALREADY APPLIED // ${result.blockedGames.length} BLOCKED // MARKET VIEWED FALSE`);
  process.exit(0);
}

if(!Array.isArray(input.cases)||input.cases.length!==5)fail('EXPECTED_FIVE_CASES');
const active=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});
if(active.manifest?.schema!==1||active.manifest?.state!=='ACTIVE'||active.manifest?.authority!=='GRAHAM_WEEK_ROLLOVER')fail('ACTIVE_WEEK_INVALID');
if(Number(input.season)!==Number(active.season)||Number(input.week)!==Number(active.week))fail('ACTIVE_WEEK_MISMATCH');

const h4prod=read(H4_PROD),h4=read(H4_CURRENT),personnelProd=read(PERSONNEL_PROD),matchupProd=read(MATCHUP_PROD),qbProd=read(QB_PROD);
if(h4prod.state!=='OPERATIONAL_SCOPED'||h4prod.productionAuthority!==true||h4prod.marketViewed!==false)fail('H4_PRODUCTION_INVALID');
if(h4.state!=='OPERATIONAL_SCOPED'||h4.productionAuthority!==true||h4.productionAuthority!==true||h4.marketViewed!==false)fail('H4_CURRENT_INVALID');
if(!close(h4prod?.productionScope?.domesticLeagueBaseline?.homeLocationAdvantagePoints,2.082)||!close(h4prod?.productionScope?.domesticLeagueBaseline?.pointsToHomeSpread,-2.082))fail('H4_LEAGUE_VALUE_REGRESSION');
if(personnelProd.state!=='OPERATIONAL'||personnelProd.productionAuthority!==true||personnelProd.productionRules?.marketIsolationRequired!==true)fail('PERSONNEL_PRODUCTION_INVALID');
if(matchupProd.state!=='OPERATIONAL_SCOPED'||matchupProd.productionAuthority!==true||matchupProd.marketViewed!==false)fail('MATCHUP_PRODUCTION_INVALID');
if(qbProd.state!=='OPERATIONAL_SCOPED'||qbProd.authorityToken!=='APPROVED_WALTERS_QB_PERFORMANCE'||qbProd.productionAuthority!==true||qbProd.grahamWritesAllowed!==true||qbProd.marketViewed!==false)fail('QB_PRODUCTION_INVALID');

const numbersPath=path.join(ROOT,active.paths.currentNumbers);
const researchPath=path.join(ROOT,active.paths.researchLedger);
const personnelPath=path.join(ROOT,active.paths.personnelLedger);
const numbers=read(numbersPath),research=read(researchPath),personnel=read(personnelPath),power=read(POWER);
if(Number(numbers.season)!==Number(active.season)||Number(numbers.week)!==Number(active.week))fail('NUMBERS_WEEK_MISMATCH');
if(Number(research.season)!==Number(active.season)||Number(research.week)!==Number(active.week))fail('RESEARCH_WEEK_MISMATCH');
if(Number(personnel.season)!==Number(active.season)||Number(personnel.week)!==Number(active.week)||personnel.marketViewed!==false)fail('PERSONNEL_LEDGER_INVALID');
if(Number(power.season)!==Number(active.season)||!Array.isArray(power.teams)||power.teams.length!==32)fail('POWER_LEDGER_INVALID');

const h4Fields=['homeFieldProductionId','homeFieldCalibrationId','homeFieldVenueClass','homeFieldAdvantagePoints','homeFieldPointsToHomeSpread','homeFieldLastAppliedAt'];
const beforeGameState=new Map(numbers.games.map(g=>[g.gameKey,{exact:Number(g.grahamExactFairHome),display:Number(g.grahamFairHome),neutral:Number(g.neutralBaseHome),personnel:finite(g.personnelOverlayPointsToHomeSpread)?Number(g.personnelOverlayPointsToHomeSpread):0,qb:finite(g.qbPerformancePointsToHomeSpread)?Number(g.qbPerformancePointsToHomeSpread):0,h4:Object.fromEntries(h4Fields.map(k=>[k,g[k]]))}]));
const correctionAbbrs=new Set();
const ratingChanges=[];

for(const c of input.cases){
  if(!c.team||!finite(c.expectedCurrentRating)||!finite(c.correctionDelta)||!finite(c.expectedPostRating)||!c.reason||!Array.isArray(c.sourceRefs)||!c.sourceRefs.length)fail(`INVALID_CASE:${c.team||'UNKNOWN'}`);
  if(c.disposition!=='REMOVE_TEMPORARY_PERSONNEL_FROM_CARRIED_RATING')fail(`INVALID_DISPOSITION:${c.team}`);
  const team=power.teams.find(t=>t.abbr===c.team);if(!team)fail(`TEAM_NOT_FOUND:${c.team}`);
  if((team.history||[]).some(e=>e.auditId===input.auditId))fail(`AUDIT_ALREADY_APPLIED:${c.team}`);
  if(!close(team.currentRating,c.expectedCurrentRating))fail(`CURRENT_RATING_DRIFT:${c.team}:${team.currentRating}:${c.expectedCurrentRating}`);
  const legacy=(team.history||[]).find(e=>e.type==='INITIAL_RESEARCH_DELTA'&&close(e.delta,c.legacyDelta)&&close(e.toRating,c.expectedCurrentRating));
  if(!legacy)fail(`LEGACY_EVENT_NOT_FOUND:${c.team}`);
  const prior=Number(team.currentRating),next=round(prior+Number(c.correctionDelta),3);
  if(!close(next,c.expectedPostRating))fail(`POST_RATING_MISMATCH:${c.team}:${next}:${c.expectedPostRating}`);
  const seq=(team.history||[]).length?Math.max(...team.history.map(e=>Number(e.sequence)||0))+1:0;
  const historyEvent={sequence:seq,type:'CARRIED_RATING_PERSONNEL_LAYER_AUDIT',fromRating:prior,delta:Number(c.correctionDelta),toRating:next,effectiveAt:input.effectiveAt,reason:c.reason,sourceRefs:c.sourceRefs,auditId:input.auditId,marketViewed:false};
  team.priorRating=prior;team.currentRating=next;team.lastDelta=Number(c.correctionDelta);team.lastUpdatedAt=input.effectiveAt;team.lastUpdateType='CARRIED_RATING_PERSONNEL_LAYER_AUDIT';team.confidence='CURRENT_RESEARCH_GOVERNED_LAYER_CLEAN';team.sourceRefs=unique([...(team.sourceRefs||[]),...c.sourceRefs]);team.history=[...(team.history||[]),historyEvent];team.lastCarriedRatingAuditId=input.auditId;
  correctionAbbrs.add(c.team);ratingChanges.push({team:c.team,priorRating:prior,delta:Number(c.correctionDelta),currentRating:next,disposition:c.disposition,reason:c.reason,sourceRefs:c.sourceRefs});
}

const ratingByAbbr=new Map(power.teams.map(t=>[t.abbr,Number(t.currentRating)]));
const matchupChanges=[];
for(const game of numbers.games){
  if(!ratingByAbbr.has(game.away)||!ratingByAbbr.has(game.home))fail(`GAME_TEAM_RATING_MISSING:${game.gameKey}`);
  const old=beforeGameState.get(game.gameKey);const newNeutral=round(ratingByAbbr.get(game.away)-ratingByAbbr.get(game.home),3);const neutralDelta=round(newNeutral-old.neutral,3);if(!neutralDelta)continue;
  if(!correctionAbbrs.has(game.away)&&!correctionAbbrs.has(game.home))fail(`UNEXPECTED_NEUTRAL_MOVE:${game.gameKey}`);
  const priorExact=Number(game.grahamExactFairHome),priorDisplay=Number(game.grahamFairHome);const newExact=round(priorExact+neutralDelta,3),newDisplay=roundHalf(newExact);
  game.priorGrahamFairHome=priorDisplay;game.neutralBaseHome=newNeutral;game.grahamExactFairHome=newExact;game.grahamFairHome=newDisplay;game.grahamAsOf=input.effectiveAt;
  if(finite(game.personnelBaselineExactFairHome))game.personnelBaselineExactFairHome=round(Number(game.personnelBaselineExactFairHome)+neutralDelta,3);
  if(finite(game.qbPerformanceBaseExactFairHome))game.qbPerformanceBaseExactFairHome=round(Number(game.qbPerformanceBaseExactFairHome)+neutralDelta,3);
  if(finite(game.homeFieldNonLocationExactFairHome))game.homeFieldNonLocationExactFairHome=round(Number(game.homeFieldNonLocationExactFairHome)+neutralDelta,3);
  game.informationStatus='CARRIED_RATING_LAYER_AUDIT_APPLIED';const relevant=input.cases.filter(c=>c.team===game.away||c.team===game.home);game.sourceRefs=unique([...(game.sourceRefs||[]),...relevant.flatMap(c=>c.sourceRefs||[]),'data/walters/nfl/carried-rating-audit-staging.json']);
  game.carriedRatingAudit={schema:1,auditId:input.auditId,effectiveAt:input.effectiveAt,priorNeutralBaseHome:old.neutral,neutralBaseDelta:neutralDelta,currentNeutralBaseHome:newNeutral,priorExactFairHome:priorExact,currentExactFairHome:newExact,priorDisplayedFairHome:priorDisplay,currentDisplayedFairHome:newDisplay,personnelOverlayPreserved:old.personnel,qbPerformancePointsPreserved:old.qb,marketViewed:false};
  matchupChanges.push({gameKey:game.gameKey,away:game.away,home:game.home,priorNeutralBaseHome:old.neutral,newNeutralBaseHome:newNeutral,neutralBaseDelta:neutralDelta,priorExactFairHome:priorExact,newExactFairHome:newExact,priorDisplayedFairHome:priorDisplay,newDisplayedFairHome:newDisplay,personnelOverlayPointsToHomeSpread:old.personnel,qbPerformancePointsToHomeSpread:old.qb});
}
if(matchupChanges.length!==5)fail(`EXPECTED_FIVE_GAME_REBUILDS:${matchupChanges.length}`);
synchronizeGrahamFairBoard(numbers,{write:true});
for(const game of numbers.games){const old=beforeGameState.get(game.gameKey);for(const key of h4Fields){if(JSON.stringify(game[key])!==JSON.stringify(old.h4[key]))fail(`H4_FIELD_CHANGED:${game.gameKey}:${key}`);}const p=finite(game.personnelOverlayPointsToHomeSpread)?Number(game.personnelOverlayPointsToHomeSpread):0;const q=finite(game.qbPerformancePointsToHomeSpread)?Number(game.qbPerformancePointsToHomeSpread):0;if(!close(p,old.personnel))fail(`PERSONNEL_OVERLAY_CHANGED:${game.gameKey}`);if(!close(q,old.qb))fail(`QB_POINTS_CHANGED:${game.gameKey}`);}
const seq=(research.sweeps||[]).length?Math.max(...research.sweeps.map(s=>Number(s.sequence)||0))+1:0;const sourceRefs=unique(input.cases.flatMap(c=>c.sourceRefs||[]));
const sweep={sequence:seq,type:'CARRIED_RATING_PERSONNEL_LAYER_AUDIT',auditId:input.auditId,startedAt:input.startedAt||input.effectiveAt,completedAt:input.effectiveAt,scope:'Narrow audit of the five August 30 INITIAL_RESEARCH_DELTA carried-rating deductions. Temporary named-player availability is removed from carried team strength and left exclusively to governed personnel/QB/matchup production. No market prices viewed.',sourcesChecked:sourceRefs.map(ref=>({source:'Carried-rating audit evidence',url:ref,checkedAt:input.effectiveAt,purpose:'Verify the original personnel premise, current status and governed layer ownership.'})),teamFindings:input.cases.map(c=>({team:c.team,disposition:c.disposition,priorRating:c.expectedCurrentRating,correctionDelta:c.correctionDelta,currentRating:c.expectedPostRating,reason:c.reason,sourceRefs:c.sourceRefs})),ratingChanges,matchupChanges,espnFpiCapture:{status:'NOT_REFRESHED_SCOPED_LAYER_AUDIT',role:'INDEPENDENT_COMPARISON_ONLY'},summary:{teamsAudited:5,legacyPersonnelDeductionsRemovedFromCarriedRatings:5,carriedRatingMoves:5,gamesRebuilt:5,personnelLayerPreserved:true,qbLayerPreserved:true,h4Preserved:true,marketViewed:false,betCreated:false}};
research.sweeps=[...(research.sweeps||[]),sweep];research.updatedAt=input.effectiveAt;power.updatedAt=input.effectiveAt;numbers.updatedAt=input.effectiveAt;numbers.lastResearchAt=input.effectiveAt;numbers.carriedRatingAudit={schema:1,auditId:input.auditId,state:'APPLIED_PENDING_QB_RECONCILIATION',effectiveAt:input.effectiveAt,teams:[...correctionAbbrs],marketViewed:false};input.state='APPLIED';input.appliedAt=input.effectiveAt;input.result={ratingChanges,matchupChanges,marketViewed:false};
write(POWER,power);write(researchPath,research);write(numbersPath,numbers);write(INPUT,input);
const activeAfter=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});if(Number(activeAfter.season)!==Number(active.season)||Number(activeAfter.week)!==Number(active.week)||activeAfter.manifest.authority!=='GRAHAM_WEEK_ROLLOVER')fail('ACTIVE_WEEK_CHANGED_DURING_AUDIT');
const vp=read(POWER),vr=read(researchPath),vn=read(numbersPath),vi=read(INPUT);if(vi.state!=='APPLIED'||vi.auditId!==input.auditId)fail('STAGING_READBACK_FAILED');for(const c of input.cases){const t=vp.teams.find(x=>x.abbr===c.team);if(!t||!close(t.currentRating,c.expectedPostRating)||t.history.at(-1)?.auditId!==input.auditId)fail(`POWER_READBACK_FAILED:${c.team}`);}if(vr.sweeps.at(-1)?.auditId!==input.auditId||vr.sweeps.at(-1)?.summary?.marketViewed!==false)fail('RESEARCH_READBACK_FAILED');if(vn.carriedRatingAudit?.auditId!==input.auditId||vn.carriedRatingAudit?.marketViewed!==false)fail('NUMBERS_READBACK_FAILED');for(const change of matchupChanges){const g=vn.games.find(x=>x.gameKey===change.gameKey);if(!g||!close(g.grahamExactFairHome,change.newExactFairHome)||!close(g.grahamFairHome,change.newDisplayedFairHome))fail(`GAME_READBACK_FAILED:${change.gameKey}`);}console.log(`GRAHAM CARRIED-RATING AUDIT APPLIED // ${input.auditId} // ${ratingChanges.length} RATINGS // ${matchupChanges.length} GAMES // ACTIVE ${active.season} W${String(active.week).padStart(2,'0')} // MARKET VIEWED FALSE`);

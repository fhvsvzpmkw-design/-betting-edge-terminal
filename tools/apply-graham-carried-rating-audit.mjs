#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';
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
const close=(a,b)=>Math.abs(Number(a)-Number(b))<=0.0005;
const unique=a=>[...new Set((a||[]).filter(Boolean))];
const fail=m=>{throw new Error(`GRAHAM_CARRIED_RATING_AUDIT:${m}`);};

const input=read(INPUT);
if(input.schema!==1||input.state!=='READY'||input.marketViewed!==false)fail('INVALID_STAGING');
if(!input.auditId||!input.effectiveAt||Number.isNaN(Date.parse(input.effectiveAt)))fail('INVALID_AUDIT_ID_OR_TIME');
if(!Array.isArray(input.cases)||input.cases.length!==5)fail('EXPECTED_FIVE_CASES');
if(/\b(Pinnacle|Bet365|DraftKings|sportsbook consensus|line movement|market-implied rating)\b/i.test(JSON.stringify(input)))fail('MARKET_CONTAMINATION');

const active=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});
if(active.manifest?.schema!==1||active.manifest?.state!=='ACTIVE'||active.manifest?.authority!=='GRAHAM_WEEK_ROLLOVER')fail('ACTIVE_WEEK_INVALID');
if(Number(input.season)!==Number(active.season)||Number(input.week)!==Number(active.week))fail('ACTIVE_WEEK_MISMATCH');

const h4prod=read(H4_PROD),h4=read(H4_CURRENT),personnelProd=read(PERSONNEL_PROD),matchupProd=read(MATCHUP_PROD),qbProd=read(QB_PROD);
if(h4prod.state!=='OPERATIONAL_SCOPED'||h4prod.productionAuthority!==true||h4prod.marketViewed!==false)fail('H4_PRODUCTION_INVALID');
if(h4.state!=='OPERATIONAL_SCOPED'||h4.productionAuthority!==true||h4.marketViewed!==false)fail('H4_CURRENT_INVALID');
if(!close(h4prod?.productionRules?.leagueHomeFieldAdvantagePoints,2.082)||!close(h4prod?.productionRules?.pointsToHomeSpread,-2.082))fail('H4_LEAGUE_VALUE_REGRESSION');
if(personnelProd.state!=='OPERATIONAL'||personnelProd.productionAuthority!==true||personnelProd.marketViewed!==false)fail('PERSONNEL_PRODUCTION_INVALID');
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
const beforeGameState=new Map(numbers.games.map(g=>[g.gameKey,{
  exact:Number(g.grahamExactFairHome),display:Number(g.grahamFairHome),neutral:Number(g.neutralBaseHome),
  personnel:finite(g.personnelOverlayPointsToHomeSpread)?Number(g.personnelOverlayPointsToHomeSpread):0,
  qb:finite(g.qbPerformancePointsToHomeSpread)?Number(g.qbPerformancePointsToHomeSpread):0,
  h4:Object.fromEntries(h4Fields.map(k=>[k,g[k]]))
}]));
const beforeRatings=new Map(power.teams.map(t=>[t.abbr,Number(t.currentRating)]));
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
  team.priorRating=prior;
  team.currentRating=next;
  team.lastDelta=Number(c.correctionDelta);
  team.lastUpdatedAt=input.effectiveAt;
  team.lastUpdateType='CARRIED_RATING_PERSONNEL_LAYER_AUDIT';
  team.confidence='CURRENT_RESEARCH_GOVERNED_LAYER_CLEAN';
  team.sourceRefs=unique([...(team.sourceRefs||[]),...c.sourceRefs]);
  team.history=[...(team.history||[]),historyEvent];
  team.lastCarriedRatingAuditId=input.auditId;
  correctionAbbrs.add(c.team);
  ratingChanges.push({team:c.team,priorRating:prior,delta:Number(c.correctionDelta),currentRating:next,disposition:c.disposition,reason:c.reason,sourceRefs:c.sourceRefs});
}

const ratingByAbbr=new Map(power.teams.map(t=>[t.abbr,Number(t.currentRating)]));
const matchupChanges=[];
for(const game of numbers.games){
  if(!ratingByAbbr.has(game.away)||!ratingByAbbr.has(game.home))fail(`GAME_TEAM_RATING_MISSING:${game.gameKey}`);
  const old=beforeGameState.get(game.gameKey);
  const newNeutral=round(ratingByAbbr.get(game.away)-ratingByAbbr.get(game.home),3);
  const neutralDelta=round(newNeutral-old.neutral,3);
  if(!neutralDelta)continue;
  if(!correctionAbbrs.has(game.away)&&!correctionAbbrs.has(game.home))fail(`UNEXPECTED_NEUTRAL_MOVE:${game.gameKey}`);
  const priorExact=Number(game.grahamExactFairHome),priorDisplay=Number(game.grahamFairHome);
  const newExact=round(priorExact+neutralDelta,3),newDisplay=roundHalf(newExact);
  game.priorGrahamFairHome=priorDisplay;
  game.neutralBaseHome=newNeutral;
  game.grahamExactFairHome=newExact;
  game.grahamFairHome=newDisplay;
  game.grahamAsOf=input.effectiveAt;
  if(finite(game.personnelBaselineExactFairHome))game.personnelBaselineExactFairHome=round(Number(game.personnelBaselineExactFairHome)+neutralDelta,3);
  if(finite(game.qbPerformanceBaseExactFairHome))game.qbPerformanceBaseExactFairHome=round(Number(game.qbPerformanceBaseExactFairHome)+neutralDelta,3);
  if(finite(game.homeFieldNonLocationExactFairHome))game.homeFieldNonLocationExactFairHome=round(Number(game.homeFieldNonLocationExactFairHome)+neutralDelta,3);
  game.informationStatus='CARRIED_RATING_LAYER_AUDIT_APPLIED';
  const relevant=input.cases.filter(c=>c.team===game.away||c.team===game.home);
  game.sourceRefs=unique([...(game.sourceRefs||[]),...relevant.flatMap(c=>c.sourceRefs||[]),'data/walters/nfl/carried-rating-audit-staging.json']);
  game.carriedRatingAudit={schema:1,auditId:input.auditId,effectiveAt:input.effectiveAt,priorNeutralBaseHome:old.neutral,neutralBaseDelta:neutralDelta,currentNeutralBaseHome:newNeutral,priorExactFairHome:priorExact,currentExactFairHome:newExact,priorDisplayedFairHome:priorDisplay,currentDisplayedFairHome:newDisplay,personnelOverlayPreserved:old.personnel,qbPerformancePointsPreserved:old.qb,marketViewed:false};
  matchupChanges.push({gameKey:game.gameKey,away:game.away,home:game.home,priorNeutralBaseHome:old.neutral,newNeutralBaseHome:newNeutral,neutralBaseDelta:neutralDelta,priorExactFairHome:priorExact,newExactFairHome:newExact,priorDisplayedFairHome:priorDisplay,newDisplayedFairHome:newDisplay,personnelOverlayPointsToHomeSpread:old.personnel,qbPerformancePointsToHomeSpread:old.qb});
}

if(matchupChanges.length!==5)fail(`EXPECTED_FIVE_GAME_REBUILDS:${matchupChanges.length}`);
synchronizeGrahamFairBoard(numbers,{write:true});

for(const game of numbers.games){
  const old=beforeGameState.get(game.gameKey);
  for(const key of h4Fields){if(JSON.stringify(game[key])!==JSON.stringify(old.h4[key]))fail(`H4_FIELD_CHANGED:${game.gameKey}:${key}`);}
  const p=finite(game.personnelOverlayPointsToHomeSpread)?Number(game.personnelOverlayPointsToHomeSpread):0;
  const q=finite(game.qbPerformancePointsToHomeSpread)?Number(game.qbPerformancePointsToHomeSpread):0;
  if(!close(p,old.personnel))fail(`PERSONNEL_OVERLAY_CHANGED:${game.gameKey}`);
  if(!close(q,old.qb))fail(`QB_POINTS_CHANGED:${game.gameKey}`);
}

const seq=(research.sweeps||[]).length?Math.max(...research.sweeps.map(s=>Number(s.sequence)||0))+1:0;
const sourceRefs=unique(input.cases.flatMap(c=>c.sourceRefs||[]));
const sweep={sequence:seq,type:'CARRIED_RATING_PERSONNEL_LAYER_AUDIT',auditId:input.auditId,startedAt:input.startedAt||input.effectiveAt,completedAt:input.effectiveAt,scope:'Narrow audit of the five August 30 INITIAL_RESEARCH_DELTA carried-rating deductions. Temporary named-player availability is removed from carried team strength and left exclusively to governed personnel/QB/matchup production. No market prices viewed.',sourcesChecked:sourceRefs.map(ref=>({source:'Carried-rating audit evidence',url:ref,checkedAt:input.effectiveAt,purpose:'Verify the original personnel premise, current status and governed layer ownership.'})),teamFindings:input.cases.map(c=>({team:c.team,disposition:c.disposition,priorRating:c.expectedCurrentRating,correctionDelta:c.correctionDelta,currentRating:c.expectedPostRating,reason:c.reason,sourceRefs:c.sourceRefs})),ratingChanges,matchupChanges,espnFpiCapture:{status:'NOT_REFRESHED_SCOPED_LAYER_AUDIT',role:'INDEPENDENT_COMPARISON_ONLY'},summary:{teamsAudited:5,legacyPersonnelDeductionsRemovedFromCarriedRatings:5,carriedRatingMoves:5,gamesRebuilt:5,personnelLayerPreserved:true,qbLayerPreserved:true,h4Preserved:true,marketViewed:false,betCreated:false}};
research.sweeps=[...(research.sweeps||[]),sweep];
research.updatedAt=input.effectiveAt;
power.updatedAt=input.effectiveAt;
numbers.updatedAt=input.effectiveAt;
numbers.lastResearchAt=input.effectiveAt;
numbers.carriedRatingAudit={schema:1,auditId:input.auditId,state:'APPLIED_PENDING_QB_RECONCILIATION',effectiveAt:input.effectiveAt,teams:[...correctionAbbrs],marketViewed:false};
input.state='APPLIED';
input.appliedAt=input.effectiveAt;
input.result={ratingChanges,matchupChanges,marketViewed:false};

write(POWER,power);write(researchPath,research);write(numbersPath,numbers);write(INPUT,input);

const activeAfter=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});
if(Number(activeAfter.season)!==Number(active.season)||Number(activeAfter.week)!==Number(active.week)||activeAfter.manifest.authority!=='GRAHAM_WEEK_ROLLOVER')fail('ACTIVE_WEEK_CHANGED_DURING_AUDIT');
const vp=read(POWER),vr=read(researchPath),vn=read(numbersPath),vi=read(INPUT);
if(vi.state!=='APPLIED'||vi.auditId!==input.auditId)fail('STAGING_READBACK_FAILED');
for(const c of input.cases){const t=vp.teams.find(x=>x.abbr===c.team);if(!t||!close(t.currentRating,c.expectedPostRating)||t.history.at(-1)?.auditId!==input.auditId)fail(`POWER_READBACK_FAILED:${c.team}`);}
if(vr.sweeps.at(-1)?.auditId!==input.auditId||vr.sweeps.at(-1)?.summary?.marketViewed!==false)fail('RESEARCH_READBACK_FAILED');
if(vn.carriedRatingAudit?.auditId!==input.auditId||vn.carriedRatingAudit?.marketViewed!==false)fail('NUMBERS_READBACK_FAILED');
for(const change of matchupChanges){const g=vn.games.find(x=>x.gameKey===change.gameKey);if(!g||!close(g.grahamExactFairHome,change.newExactFairHome)||!close(g.grahamFairHome,change.newDisplayedFairHome))fail(`GAME_READBACK_FAILED:${change.gameKey}`);}
console.log(`GRAHAM CARRIED-RATING AUDIT APPLIED // ${input.auditId} // ${ratingChanges.length} RATINGS // ${matchupChanges.length} GAMES // ACTIVE ${active.season} W${String(active.week).padStart(2,'0')} // MARKET VIEWED FALSE`);

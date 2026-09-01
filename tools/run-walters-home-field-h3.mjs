#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

const ROOT=process.cwd();
const CONTRACT=path.join(ROOT,'data/walters/nfl/home-field/h3-shadow-contract-v1.json');
const H2_CURRENT=path.join(ROOT,'data/walters/nfl/home-field/h2-current.json');
const H2_RELEASE=path.join(ROOT,'data/walters/nfl/home-field/home-field-release-2026-v1.json');
const H2_AUDIT=path.join(ROOT,'data/walters/nfl/home-field/h2-validation-audit-v1.json');
const POWER=path.join(ROOT,'data/walters/nfl-power-ratings-ledger.json');
const REGISTRY=path.join(ROOT,'data/walters/nfl/player-values/player-values-2026-v1.json');
const ACTIVE=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});
const NUMBERS=ACTIVE.absolutePaths.currentNumbers;
const PERSONNEL=ACTIVE.absolutePaths.personnelLedger;
const OUT=path.join(ROOT,`data/walters/nfl/home-field/h3-week-${String(ACTIVE.week).padStart(2,'0')}-shadow-result.json`);
const CURRENT=path.join(ROOT,'data/walters/nfl/home-field/h3-current.json');

const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,j)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');};
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const round=(n,d=3)=>Number(Number(n).toFixed(d));
const roundHalf=n=>Math.round((Number(n)+Number.EPSILON)*2)/2;
const finite=v=>Number.isFinite(Number(v));
const fail=msg=>{throw new Error(`WALTERS HOME FIELD H3 FAILED // ${msg}`);};
const snapshotTeam=t=>t==='LAR'?'LA':t;

function parseCsv(text){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch==='"'&&text[i+1]==='"'){field+='"';i++;continue;}
      if(ch==='"'){quoted=false;continue;}
      field+=ch;continue;
    }
    if(ch==='"'){quoted=true;continue;}
    if(ch===','){row.push(field);field='';continue;}
    if(ch==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';continue;}
    field+=ch;
  }
  if(field.length||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}
  if(!rows.length)return [];
  const header=rows[0];
  return rows.slice(1).filter(r=>r.some(v=>v!=='')).map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]??''])));
}

for(const p of [CONTRACT,H2_CURRENT,H2_RELEASE,H2_AUDIT,POWER,REGISTRY,NUMBERS])if(!fs.existsSync(p))fail(`missing ${path.relative(ROOT,p)}`);
const contract=readJson(CONTRACT),h2Current=readJson(H2_CURRENT),release=readJson(H2_RELEASE),audit=readJson(H2_AUDIT),numbers=readJson(NUMBERS);
const snapshotPath=path.join(ROOT,release.sourceSnapshot?.filteredSnapshotPath||'');
if(!release.sourceSnapshot?.filteredSnapshotPath||!fs.existsSync(snapshotPath))fail('H2 filtered snapshot missing');

if(contract.stage!=='H3'||contract.state!=='READY_FOR_ACTIVE_WEEK_SHADOW'||contract.productionAuthority!==false||contract.liveBoardMutationAllowed!==false||contract.marketViewed!==false)fail('H3 contract boundary invalid');
if(h2Current.state!=='PASS_CURRENT_CALIBRATION_SHADOW_RELEASE'||h2Current.validationPass!==true||h2Current.productionAuthority!==false||h2Current.marketViewed!==false)fail('FAIL_CLOSED_H3_H2_NOT_ACCEPTED');
if(release.state!=='PASS_CURRENT_CALIBRATION_SHADOW_RELEASE'||release.productionAuthority!==false||release.marketViewed!==false)fail('H2 release boundary invalid');
if(audit.validation?.pass!==true||audit.marketViewed!==false)fail('H2 validation audit not accepted');
if(Number(numbers.season)!==ACTIVE.season||Number(numbers.week)!==ACTIVE.week)fail('FAIL_CLOSED_H3_SCHEDULE_IDENTITY');
if(Number(release.season)!==ACTIVE.season)fail('H2 release season mismatch');

const protectedBefore={
  currentNumbers:hash(NUMBERS),
  personnelLedger:fs.existsSync(PERSONNEL)?hash(PERSONNEL):null,
  powerRatings:hash(POWER),
  playerValueRegistry:hash(REGISTRY)
};

const snapshotRows=parseCsv(fs.readFileSync(snapshotPath,'utf8'));
const schedules=snapshotRows.filter(r=>Number(r.season)===ACTIVE.season&&r.game_type==='REG');
const estimates=new Map((release.teamVenueEstimates||[]).map(x=>[x.team,x]));
const games=Array.isArray(numbers.games)?numbers.games:[];
if(games.length!==16)fail(`expected 16 active Week games, found ${games.length}`);

const leagueHfa=Number(release.leagueBaselineHomeAdvantagePoints);
if(!Number.isFinite(leagueHfa)||leagueHfa<=0)fail('invalid H2 league baseline');

function scheduleMatch(g){
  const home=snapshotTeam(g.home),away=snapshotTeam(g.away);
  const hits=schedules.filter(r=>r.home_team===home&&r.away_team===away);
  if(hits.length!==1)fail(`FAIL_CLOSED_H3_SCHEDULE_IDENTITY:${g.gameKey}:${hits.length}`);
  return hits[0];
}
function classify(g,s){
  const loc=String(s.location||'').trim();
  const stadium=String(s.stadium||'').trim();
  const stadiumId=String(s.stadium_id||'').trim();
  if(loc==='Neutral'){
    if(/melbourne|london|wembley|tottenham|frankfurt|munich|madrid|dublin|sao paulo|são paulo|mexico|toronto/i.test(stadium))return 'INTERNATIONAL_NEUTRAL';
    return 'NEUTRAL';
  }
  if(loc!=='Home')return 'UNRESOLVED';
  const homeEst=estimates.get(g.home),awayEst=estimates.get(g.away);
  if(!homeEst)return 'UNRESOLVED';
  if(homeEst.stadiumId&&awayEst?.stadiumId&&homeEst.stadiumId===awayEst.stadiumId)return 'SHARED_VENUE_OR_METRO';
  if(homeEst.stadiumId&&stadiumId&&homeEst.stadiumId!==stadiumId)return 'RELOCATED_HOME';
  return 'DOMESTIC_HOME';
}
function currentLocationAdjustment(g){
  const loc=(g.adjustments||[]).filter(a=>a.type==='HOME_FIELD'||a.type==='VENUE');
  if(loc.length!==1)fail(`FAIL_CLOSED_H3_LIVE_LOCATION_TERM_UNRESOLVED:${g.gameKey}:${loc.length}`);
  if(!finite(loc[0].pointsToHomeSpread))fail(`FAIL_CLOSED_H3_LIVE_LOCATION_TERM_UNRESOLVED:${g.gameKey}:nonfinite`);
  return loc[0];
}

const resultGames=[];let unresolved=0,leagueDisplayMoves=0,teamDisplayMoves=0,teamVsLeagueDisplayDifferences=0;
const classCounts={};
for(const g of games){
  const s=scheduleMatch(g),venueClass=classify(g,s);
  classCounts[venueClass]=(classCounts[venueClass]||0)+1;
  if(['UNRESOLVED','SHARED_VENUE_OR_METRO','RELOCATED_HOME'].includes(venueClass)){
    unresolved++;
    resultGames.push({gameKey:g.gameKey,away:g.away,home:g.home,venueClass,screeningStatus:'FAIL_CLOSED',failClosedCode:venueClass==='SHARED_VENUE_OR_METRO'?'FAIL_CLOSED_H3_SHARED_VENUE_UNRESOLVED':venueClass==='RELOCATED_HOME'?'FAIL_CLOSED_H3_RELOCATED_HOME_UNRESOLVED':'FAIL_CLOSED_H3_VENUE_UNRESOLVED',snapshot:{location:s.location,stadium:s.stadium,stadiumId:s.stadium_id}});
    continue;
  }
  const locAdj=currentLocationAdjustment(g);
  const currentExact=finite(g.grahamExactFairHome)?Number(g.grahamExactFairHome):Number(g.grahamFairHome);
  const currentDisplay=Number(g.grahamFairHome);
  if(!Number.isFinite(currentExact)||!Number.isFinite(currentDisplay))fail(`FAIL_CLOSED_H3_ARITHMETIC:${g.gameKey}:current fair`);
  const currentLoc=Number(locAdj.pointsToHomeSpread);
  if(venueClass==='DOMESTIC_HOME'&&Math.abs(currentLoc+1.5)>0.0001)fail(`FAIL_CLOSED_H3_LIVE_LOCATION_TERM_UNRESOLVED:${g.gameKey}:expected -1.5 got ${currentLoc}`);
  if(['NEUTRAL','INTERNATIONAL_NEUTRAL'].includes(venueClass)&&Math.abs(currentLoc)>0.0001)fail(`FAIL_CLOSED_H3_LIVE_LOCATION_TERM_UNRESOLVED:${g.gameKey}:neutral current loc ${currentLoc}`);
  const nonLocationExact=round(currentExact-currentLoc,3);
  let teamEst=null,leagueLoc=0,teamLoc=0;
  if(venueClass==='DOMESTIC_HOME'){
    teamEst=estimates.get(g.home);
    if(!teamEst||!finite(teamEst.homeLocationAdvantagePoints))fail(`FAIL_CLOSED_H3_HOME_ESTIMATE_MISSING:${g.gameKey}:${g.home}`);
    leagueLoc=round(-leagueHfa,3);
    teamLoc=round(-Number(teamEst.homeLocationAdvantagePoints),3);
  }
  const leagueExact=round(nonLocationExact+leagueLoc,3),teamExact=round(nonLocationExact+teamLoc,3);
  const leagueDisplay=roundHalf(leagueExact),teamDisplay=roundHalf(teamExact);
  const leagueMove=round(leagueDisplay-currentDisplay,3),teamMove=round(teamDisplay-currentDisplay,3);
  if(Math.abs(leagueMove)>0.0001)leagueDisplayMoves++;
  if(Math.abs(teamMove)>0.0001)teamDisplayMoves++;
  if(Math.abs(teamDisplay-leagueDisplay)>0.0001)teamVsLeagueDisplayDifferences++;
  const personnelOverlay=finite(g.personnelOverlayPointsToHomeSpread)?Number(g.personnelOverlayPointsToHomeSpread):0;
  resultGames.push({
    gameKey:g.gameKey,away:g.away,home:g.home,startTimePacific:g.startTimePacific||null,
    venueClass,screeningStatus:'PASS',snapshot:{location:s.location,stadium:s.stadium,stadiumId:s.stadium_id},
    current:{locationAdjustmentType:locAdj.type,locationPointsToHomeSpread:currentLoc,grahamExactFairHome:currentExact,grahamDisplayFairHome:currentDisplay,personnelOverlayPointsToHomeSpread:personnelOverlay},
    preservedNonLocationExactFairHome:nonLocationExact,
    leagueBaselineShadow:{homeLocationAdvantagePoints:venueClass==='DOMESTIC_HOME'?leagueHfa:0,pointsToHomeSpread:leagueLoc,grahamExactFairHome:leagueExact,grahamDisplayFairHome:leagueDisplay,displayMove:leagueMove},
    teamVenueShadow:{homeLocationAdvantagePoints:venueClass==='DOMESTIC_HOME'?Number(teamEst.homeLocationAdvantagePoints):0,teamVenueDeviationPoints:venueClass==='DOMESTIC_HOME'?Number(teamEst.teamVenueDeviationPoints):0,uncertaintyPoints:venueClass==='DOMESTIC_HOME'?Number(teamEst.uncertaintyPoints):0,sampleGames:venueClass==='DOMESTIC_HOME'?Number(teamEst.sampleGames):0,pointsToHomeSpread:teamLoc,grahamExactFairHome:teamExact,grahamDisplayFairHome:teamDisplay,displayMove:teamMove},
    teamVsLeague:{exactFairDifference:round(teamExact-leagueExact,3),displayFairDifference:round(teamDisplay-leagueDisplay,3)},
    liveBoardChanged:false
  });
}

if(unresolved>0)fail(`H3 venue acceptance has ${unresolved} unresolved games`);
const leagueVal=audit.validation?.leagueOnly?.domestic;
const teamVal=audit.validation?.candidateTeamVenue?.domestic;
if(!leagueVal||!teamVal)fail('H2 validation metrics missing');
const teamVenueOutperformsOrTies=Number(teamVal.mae)<=Number(leagueVal.mae)&&Number(teamVal.rmse)<=Number(leagueVal.rmse);
const leagueBaselineH4Candidate=audit.validation.pass===true;
const teamVenueH4Candidate=leagueBaselineH4Candidate&&teamVenueOutperformsOrTies;
const state=teamVenueH4Candidate?'PASS_SHADOW_ACCEPTANCE_FULL_H4_CANDIDATE':'PASS_SHADOW_ACCEPTANCE_LEAGUE_BASELINE_H4_CANDIDATE_TEAM_VENUE_DIAGNOSTIC';

const protectedAfter={
  currentNumbers:hash(NUMBERS),
  personnelLedger:fs.existsSync(PERSONNEL)?hash(PERSONNEL):null,
  powerRatings:hash(POWER),
  playerValueRegistry:hash(REGISTRY)
};
if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter))fail('FAIL_CLOSED_H3_LIVE_ARTIFACT_MUTATION');

const now=new Date().toISOString();
const result={
  schema:1,resultId:`walters-nfl-home-field-h3-${ACTIVE.season}-week-${String(ACTIVE.week).padStart(2,'0')}-v1`,acceptanceId:contract.acceptanceId,calibrationId:contract.calibrationId,
  stage:'H3',state,season:ACTIVE.season,week:ACTIVE.week,generatedAt:now,productionAuthority:false,liveBoardMutationAllowed:false,marketViewed:false,
  sourceRelease:'data/walters/nfl/home-field/home-field-release-2026-v1.json',leagueBaselineHomeAdvantagePoints:leagueHfa,
  summary:{gamesReviewed:games.length,venueClasses:classCounts,unresolvedGames:unresolved,leagueBaselineDisplayMoves:leagueDisplayMoves,teamVenueDisplayMoves:teamDisplayMoves,teamVsLeagueDisplayDifferences,liveMoves:0},
  h2HeldOutComparison:{leagueOnly:{mae:Number(leagueVal.mae),rmse:Number(leagueVal.rmse),meanError:Number(leagueVal.meanError)},teamVenue:{mae:Number(teamVal.mae),rmse:Number(teamVal.rmse),meanError:Number(teamVal.meanError)},teamVenueOutperformsOrTiesBothMaeAndRmse:teamVenueOutperformsOrTies},
  h4ScopeCandidate:{leagueBaseline:leagueBaselineH4Candidate,teamVenue:teamVenueH4Candidate,neutralZeroBase:true,reason:teamVenueH4Candidate?'H2 team/venue model is no worse than league-only on both held-out MAE and RMSE.':'H2 team/venue model did not equal or beat league-only on both held-out MAE and RMSE; keep team-specific deviations shadow/diagnostic and advance only the independently validated league baseline plus resolved neutral-zero policy for H4 consideration.'},
  games:resultGames,
  protectedArtifactSha256:protectedAfter,
  conclusion:teamVenueH4Candidate?'H3 accepts the full H2 home-field release as an H4 candidate without live mutation.':'H3 accepts the current league-level home-field calibration and neutral-zero policy as scoped H4 candidates, while team/stadium deviations remain shadow diagnostics because they did not outperform the league-only model on both held-out error metrics.'
};
write(OUT,result);
const current={schema:1,stage:'H3',state,season:ACTIVE.season,week:ACTIVE.week,updatedAt:now,productionAuthority:false,liveBoardMutationAllowed:false,marketViewed:false,leagueBaselineHomeAdvantagePoints:leagueHfa,h4ScopeCandidate:result.h4ScopeCandidate,resultPath:path.relative(ROOT,OUT),summary:result.summary,nextGate:[
  'Review the H3 shadow board and build H4 production activation only for the accepted scope.',
  teamVenueH4Candidate?'Team/venue deviations may be included in the H4 contract subject to explicit activation.':'Keep team/venue deviations shadow-only; do not activate them merely because individual game values look plausible.',
  'Preserve zero base HFA for explicitly resolved neutral/international-neutral games.',
  'H4 activation must recompute location terms without altering personnel overlays, QB/game-factor adjustments or carried power ratings.'
]};
write(CURRENT,current);

const verify=readJson(OUT);
if(verify.state!==state||verify.summary.liveMoves!==0||verify.productionAuthority!==false)fail('H3 read-back failed');
console.log(`WALTERS HOME FIELD H3: PASS // ${games.length} GAMES // LEAGUE HFA ${leagueHfa.toFixed(3)} // LEAGUE DISPLAY MOVES ${leagueDisplayMoves} // TEAM DISPLAY MOVES ${teamDisplayMoves} // TEAM H4 ${teamVenueH4Candidate?'CANDIDATE':'DIAGNOSTIC ONLY'} // 0 LIVE MOVES`);

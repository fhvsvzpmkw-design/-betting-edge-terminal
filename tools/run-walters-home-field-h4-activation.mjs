#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';

const ROOT=process.cwd();
const CONTRACT=path.join(ROOT,'data/walters/nfl/home-field/h4-production-contract-v1.json');
const H2_CURRENT=path.join(ROOT,'data/walters/nfl/home-field/h2-current.json');
const H2_RELEASE=path.join(ROOT,'data/walters/nfl/home-field/home-field-release-2026-v1.json');
const H3_CURRENT=path.join(ROOT,'data/walters/nfl/home-field/h3-current.json');
const H3_RESULT=path.join(ROOT,'data/walters/nfl/home-field/h3-week-01-shadow-result.json');
const H3V_CURRENT=path.join(ROOT,'data/walters/nfl/home-field/h3v-current.json');
const H3V_RESULT=path.join(ROOT,'data/walters/nfl/home-field/h3v-selective-venue-result-v1.json');
const POWER=path.join(ROOT,'data/walters/nfl-power-ratings-ledger.json');
const REGISTRY=path.join(ROOT,'data/walters/nfl/player-values/player-values-2026-v1.json');
const OUT=path.join(ROOT,'data/walters/nfl/home-field/home-field-production-current.json');
const CURRENT=path.join(ROOT,'data/walters/nfl/home-field/h4-current.json');

const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,j)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');};
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const hashObj=o=>crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
const finite=v=>Number.isFinite(Number(v));
const round=(n,d=3)=>Number(Number(n).toFixed(d));
const roundHalf=n=>Math.round((Number(n)+Number.EPSILON)*2)/2;
const unique=a=>[...new Set(a)];
const fail=msg=>{throw new Error(`WALTERS HOME FIELD H4 FAILED // ${msg}`);};

const ACTIVE=resolveGrahamActiveWeek({root:ROOT,requireFiles:true});
const NUMBERS=ACTIVE.absolutePaths.currentNumbers;
const RESEARCH=ACTIVE.absolutePaths.researchLedger;
const PERSONNEL=ACTIVE.absolutePaths.personnelLedger;
for(const p of [CONTRACT,H2_CURRENT,H2_RELEASE,H3_CURRENT,H3_RESULT,H3V_CURRENT,H3V_RESULT,POWER,REGISTRY,NUMBERS,RESEARCH,PERSONNEL])if(!fs.existsSync(p))fail(`MISSING:${path.relative(ROOT,p)}`);

const contract=read(CONTRACT),h2=read(H2_CURRENT),release=read(H2_RELEASE),h3c=read(H3_CURRENT),h3=read(H3_RESULT),h3vc=read(H3V_CURRENT),h3v=read(H3V_RESULT);
let numbers=read(NUMBERS),research=read(RESEARCH);

if(contract.stage!=='H4'||contract.state!=='READY_FOR_SCOPED_ACTIVATION'||contract.productionAuthority!==false||contract.liveBoardMutationAllowed!==false||contract.marketViewed!==false)fail('CONTRACT_BOUNDARY');
if(h2.state!=='PASS_CURRENT_CALIBRATION_SHADOW_RELEASE'||h2.validationPass!==true||h2.productionAuthority!==false||h2.marketViewed!==false)fail('FAIL_CLOSED_H4_H2_NOT_ACCEPTED');
if(h3c.state!=='PASS_SHADOW_ACCEPTANCE_LEAGUE_BASELINE_H4_CANDIDATE_TEAM_VENUE_DIAGNOSTIC'||h3c.productionAuthority!==false||h3c.marketViewed!==false)fail('FAIL_CLOSED_H4_H3_NOT_ACCEPTED');
if(h3.state!==h3c.state||h3.h4ScopeCandidate?.leagueBaseline!==true||h3.h4ScopeCandidate?.teamVenue!==false||h3.h4ScopeCandidate?.neutralZeroBase!==true||h3.summary?.unresolvedGames!==0)fail('FAIL_CLOSED_H4_H3_NOT_ACCEPTED');
if(h3vc.state!=='PASS_NO_SELECTIVE_VENUES_H4_LEAGUE_ONLY'||h3vc.productionAuthority!==false||h3vc.marketViewed!==false)fail('FAIL_CLOSED_H4_H3V_NOT_ACCEPTED');
if(h3v.state!==h3vc.state||h3v.h4ScopeCandidate?.leagueBaseline!==true||h3v.h4ScopeCandidate?.neutralZeroBase!==true||h3v.h4ScopeCandidate?.selectiveVenueAdjustments!==false||h3v.h4ScopeCandidate?.teamVenueBlanket!==false||Number(h3v.h4ScopeCandidate?.qualifiedVenueCount)!==0)fail('FAIL_CLOSED_H4_H3V_NOT_ACCEPTED');
if(Number(h3v.h4ScopeCandidate?.survivalCoefficientK)!==0.034)fail('H3V_SURVIVAL_COEFFICIENT_CHANGED');
if(ACTIVE.manifest?.authority!=='GRAHAM_WEEK_ROLLOVER'||ACTIVE.manifest?.state!=='ACTIVE')fail('FAIL_CLOSED_H4_ACTIVE_WEEK_IDENTITY');
if(Number(contract.season)!==ACTIVE.season||Number(numbers.season)!==ACTIVE.season||Number(numbers.week)!==ACTIVE.week||Number(research.season)!==ACTIVE.season||Number(research.week)!==ACTIVE.week)fail('FAIL_CLOSED_H4_ACTIVE_WEEK_IDENTITY');
if(Number(h3.season)!==ACTIVE.season||Number(h3.week)!==ACTIVE.week||Number(h3v.season)!==ACTIVE.season||Number(h3v.week)!==ACTIVE.week)fail('FAIL_CLOSED_H4_ACTIVE_WEEK_IDENTITY');
if(h3.marketViewed!==false||h3v.marketViewed!==false||release.marketViewed!==false)fail('FAIL_CLOSED_H4_MARKET_CONTAMINATION');

const leagueHfa=Number(contract.acceptedProductionScope?.DOMESTIC_LEAGUE_BASELINE?.homeLocationAdvantagePoints);
if(!finite(leagueHfa)||Math.abs(leagueHfa-2.082)>1e-9||Math.abs(Number(release.leagueBaselineHomeAdvantagePoints)-leagueHfa)>1e-9)fail('LEAGUE_HFA_IDENTITY');
if(contract.blockedProductionScope?.TEAM_VENUE_BLANKET?.enabled!==false||contract.blockedProductionScope?.SELECTIVE_VENUE_ADJUSTMENTS?.enabled!==false)fail('BLOCKED_SCOPE_ENABLED');

const protectedBefore={
  personnelLedger:hash(PERSONNEL),
  powerRatings:hash(POWER),
  playerValueRegistry:hash(REGISTRY)
};
const currentNumbersShaBefore=hash(NUMBERS);
const researchShaBefore=hash(RESEARCH);
const beforeOverlay=new Map((numbers.games||[]).map(g=>[g.gameKey,finite(g.personnelOverlayPointsToHomeSpread)?Number(g.personnelOverlayPointsToHomeSpread):0]));
const beforeNonLocationAdjustmentHash=new Map((numbers.games||[]).map(g=>[g.gameKey,hashObj((g.adjustments||[]).filter(a=>!['HOME_FIELD','VENUE'].includes(a.type)))]));

const h3ByGame=new Map((h3.games||[]).map(g=>[g.gameKey,g]));
const games=Array.isArray(numbers.games)?numbers.games:[];
if(games.length!==16||h3ByGame.size!==16)fail(`FAIL_CLOSED_H4_GAME_IDENTITY:active=${games.length}:h3=${h3ByGame.size}`);

const now=new Date().toISOString();
const sourceRefs=[
  'data/walters/nfl/home-field/home-field-release-2026-v1.json',
  'data/walters/nfl/home-field/h3-week-01-shadow-result.json',
  'data/walters/nfl/home-field/h3v-selective-venue-result-v1.json'
];
let domesticGames=0,neutralGames=0,displayMoves=0,exactMoves=0,idempotentGames=0;
const changes=[];

for(const g of games){
  const shadow=h3ByGame.get(g.gameKey);
  if(!shadow||shadow.home!==g.home||shadow.away!==g.away||shadow.screeningStatus!=='PASS')fail(`FAIL_CLOSED_H4_GAME_IDENTITY:${g.gameKey}`);
  const venueClass=shadow.venueClass;
  if(!['DOMESTIC_HOME','NEUTRAL','INTERNATIONAL_NEUTRAL'].includes(venueClass))fail(`FAIL_CLOSED_H4_VENUE_CLASS_UNRESOLVED:${g.gameKey}:${venueClass}`);
  const adjustments=Array.isArray(g.adjustments)?g.adjustments:[];
  const locIndexes=adjustments.map((a,i)=>['HOME_FIELD','VENUE'].includes(a.type)?i:-1).filter(i=>i>=0);
  if(locIndexes.length!==1)fail(`FAIL_CLOSED_H4_LIVE_LOCATION_TERM_UNEXPECTED:${g.gameKey}:count=${locIndexes.length}`);
  const li=locIndexes[0],loc={...adjustments[li]};
  if(!finite(loc.pointsToHomeSpread))fail(`FAIL_CLOSED_H4_LIVE_LOCATION_TERM_UNEXPECTED:${g.gameKey}:nonfinite`);
  const currentLoc=Number(loc.pointsToHomeSpread);
  const currentExact=finite(g.grahamExactFairHome)?Number(g.grahamExactFairHome):Number(g.grahamFairHome);
  const currentDisplay=Number(g.grahamFairHome);
  if(!finite(currentExact)||!finite(currentDisplay))fail(`FAIL_CLOSED_H4_GAME_IDENTITY:${g.gameKey}:fair`);
  const personnelOverlay=beforeOverlay.get(g.gameKey)||0;

  let newLoc;
  if(venueClass==='DOMESTIC_HOME'){
    domesticGames++;
    newLoc=round(-leagueHfa,3);
    const already=loc.homeFieldProductionId===contract.productionId&&Math.abs(currentLoc-newLoc)<1e-9;
    if(already)idempotentGames++;
    else if(Math.abs(currentLoc+1.5)>1e-9)fail(`FAIL_CLOSED_H4_LIVE_LOCATION_TERM_UNEXPECTED:${g.gameKey}:expected=-1.5:got=${currentLoc}`);
    loc.type='HOME_FIELD';
    loc.homeLocationAdvantagePoints=leagueHfa;
    loc.pointsToHomeSpread=newLoc;
    loc.homeFieldProductionId=contract.productionId;
    loc.calibrationId=contract.calibrationId;
    loc.venueClass=venueClass;
    loc.effectiveAt=now;
    loc.reason='Walters H4 production home-field calibration: the independently validated 2.082-point 2026 league domestic HFA replaces the provisional 1.5-point allowance. H3V qualified no team/stadium deviation for production.';
    loc.sourceRefs=unique([...(loc.sourceRefs||[]),...sourceRefs]);
  }else{
    neutralGames++;
    newLoc=0;
    if(Math.abs(currentLoc)>1e-9)fail(`FAIL_CLOSED_H4_LIVE_LOCATION_TERM_UNEXPECTED:${g.gameKey}:neutral=${currentLoc}`);
    const already=loc.homeFieldProductionId===contract.productionId&&Math.abs(currentLoc)<1e-9;
    if(already)idempotentGames++;
    loc.homeLocationAdvantagePoints=0;
    loc.pointsToHomeSpread=0;
    loc.homeFieldProductionId=contract.productionId;
    loc.calibrationId=contract.calibrationId;
    loc.venueClass=venueClass;
    loc.effectiveAt=now;
    loc.homeFieldCalibrationNote='H4 confirms zero base HFA for this resolved neutral/international-neutral game. Travel, time-zone, weather and other game factors remain separate.';
    loc.sourceRefs=unique([...(loc.sourceRefs||[]),...sourceRefs]);
  }

  const nonLocationExact=round(currentExact-currentLoc,3);
  const newExact=round(nonLocationExact+newLoc,3);
  const newDisplay=roundHalf(newExact);
  const exactMove=round(newExact-currentExact,3);
  const displayMove=round(newDisplay-currentDisplay,3);
  if(Math.abs(exactMove)>1e-9)exactMoves++;
  if(Math.abs(displayMove)>1e-9)displayMoves++;

  const newAdjustments=[...adjustments];newAdjustments[li]=loc;g.adjustments=newAdjustments;
  if(Math.abs(displayMove)>1e-9)g.priorGrahamFairHome=currentDisplay;
  g.grahamExactFairHome=newExact;
  g.grahamFairHome=newDisplay;
  if(Math.abs(exactMove)>1e-9)g.grahamAsOf=now;
  if(Object.prototype.hasOwnProperty.call(g,'personnelBaselineExactFairHome'))g.personnelBaselineExactFairHome=round(newExact-personnelOverlay,3);
  g.homeFieldNonLocationExactFairHome=nonLocationExact;
  g.homeFieldProductionId=contract.productionId;
  g.homeFieldCalibrationId=contract.calibrationId;
  g.homeFieldVenueClass=venueClass;
  g.homeFieldAdvantagePoints=venueClass==='DOMESTIC_HOME'?leagueHfa:0;
  g.homeFieldPointsToHomeSpread=newLoc;
  g.homeFieldLastAppliedAt=now;
  if(Math.abs(exactMove)>1e-9){
    if(!Object.prototype.hasOwnProperty.call(g,'researchSummaryBeforeHomeFieldH4'))g.researchSummaryBeforeHomeFieldH4=g.researchSummary||null;
    g.researchSummary=`H4 home-field production recalibration: preserved non-location exact fair ${nonLocationExact>=0?'+':''}${nonLocationExact.toFixed(3)}; governed ${venueClass} location term ${newLoc>=0?'+':''}${newLoc.toFixed(3)}; exact Graham home fair ${newExact>=0?'+':''}${newExact.toFixed(3)}, displayed ${newDisplay>=0?'+':''}${newDisplay.toFixed(1)}. Personnel and all other governed game adjustments are preserved.`;
    g.informationStatus='HOME_FIELD_PRODUCTION_RECALIBRATED';
  }
  g.sourceRefs=unique([...(g.sourceRefs||[]),...sourceRefs]);

  if(Math.abs((finite(g.personnelOverlayPointsToHomeSpread)?Number(g.personnelOverlayPointsToHomeSpread):0)-personnelOverlay)>1e-9)fail(`FAIL_CLOSED_H4_PERSONNEL_OVERLAY_CHANGED:${g.gameKey}`);
  if(hashObj((g.adjustments||[]).filter(a=>!['HOME_FIELD','VENUE'].includes(a.type)))!==beforeNonLocationAdjustmentHash.get(g.gameKey))fail(`NON_LOCATION_ADJUSTMENT_CHANGED:${g.gameKey}`);

  changes.push({
    gameKey:g.gameKey,away:g.away,home:g.home,venueClass,
    priorLocationPointsToHomeSpread:currentLoc,newLocationPointsToHomeSpread:newLoc,
    priorExactFairHome:currentExact,newExactFairHome:newExact,exactMove,
    priorDisplayFairHome:currentDisplay,newDisplayFairHome:newDisplay,displayMove,
    personnelOverlayPointsToHomeSpread:personnelOverlay
  });
}

if(domesticGames!==15||neutralGames!==1)fail(`FAIL_CLOSED_H4_VENUE_CLASS_UNRESOLVED:domestic=${domesticGames}:neutral=${neutralGames}`);

numbers.updatedAt=now;
numbers.homeFieldProduction={
  state:'OPERATIONAL_SCOPED',productionId:contract.productionId,calibrationId:contract.calibrationId,activatedAt:now,marketViewed:false,
  domesticLeagueBaselineHomeAdvantagePoints:leagueHfa,neutralBaseHomeAdvantagePoints:0,
  selectiveVenueAdjustments:false,teamVenueBlanket:false,h3vSurvivalCoefficientK:Number(h3v.h4ScopeCandidate.survivalCoefficientK),qualifiedVenueCount:0
};

const nextSequence=(research.sweeps||[]).length?Math.max(...research.sweeps.map(s=>Number(s.sequence)||0))+1:0;
const moved=changes.filter(c=>Math.abs(c.exactMove)>1e-9);
research.sweeps=[...(research.sweeps||[]),{
  sequence:nextSequence,
  type:'HOME_FIELD_PRODUCTION_ACTIVATION',
  startedAt:now,
  completedAt:now,
  scope:'Activate the H3/H3V-accepted Walters H4 home-field scope for the active week: 2.082 domestic league HFA and zero base HFA for resolved neutral/international-neutral games. No team/stadium deviation, market input, S-factor or W-factor is activated.',
  sourcesChecked:sourceRefs.map(url=>({source:'Walters governed home-field calibration artifact',url,checkedAt:now,purpose:'H4 production authority and active-week arithmetic'})),
  teamFindings:[],
  ratingChanges:[],
  matchupChanges:changes,
  espnFpiCapture:null,
  summary:{gamesReviewed:changes.length,domesticGames,neutralGames,exactFairMoves:exactMoves,displayMoves,carriedRatingMoves:0,personnelOverlayMoves:0,teamVenueAdjustmentsActivated:0,marketViewed:false,productionId:contract.productionId}
}];
research.updatedAt=now;

write(NUMBERS,numbers);write(RESEARCH,research);

const protectedAfter={
  personnelLedger:hash(PERSONNEL),
  powerRatings:hash(POWER),
  playerValueRegistry:hash(REGISTRY)
};
if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter))fail('FAIL_CLOSED_H4_PROTECTED_ARTIFACT_CHANGED');
const currentNumbersShaAfter=hash(NUMBERS),researchShaAfter=hash(RESEARCH);

const manifest={
  schema:1,productionId:contract.productionId,calibrationId:contract.calibrationId,stage:'H4',state:'OPERATIONAL_SCOPED',season:ACTIVE.season,
  activatedAt:now,productionAuthority:true,liveBoardMutationAllowed:true,marketViewed:false,
  activeWeekAtActivation:{season:ACTIVE.season,week:ACTIVE.week,authority:ACTIVE.manifest.authority},
  sourceAuthority:{
    h2Release:'data/walters/nfl/home-field/home-field-release-2026-v1.json',h2ReleaseSha256:hash(H2_RELEASE),
    h3Result:'data/walters/nfl/home-field/h3-week-01-shadow-result.json',h3ResultSha256:hash(H3_RESULT),
    h3vResult:'data/walters/nfl/home-field/h3v-selective-venue-result-v1.json',h3vResultSha256:hash(H3V_RESULT)
  },
  productionScope:{
    domesticLeagueBaseline:{enabled:true,homeLocationAdvantagePoints:leagueHfa,pointsToHomeSpread:round(-leagueHfa,3)},
    neutralZeroBase:{enabled:true,homeLocationAdvantagePoints:0,eligibleVenueClasses:['NEUTRAL','INTERNATIONAL_NEUTRAL']},
    selectiveVenueAdjustments:{enabled:false,survivalCoefficientK:Number(h3v.h4ScopeCandidate.survivalCoefficientK),qualifiedVenueCount:0},
    teamVenueBlanket:{enabled:false}
  },
  preservation:{personnelOverlay:true,personnelLedger:true,carriedPowerRatings:true,playerValueRegistry:true,nonLocationAdjustments:true,marketIsolation:true},
  activationSummary:{gamesReviewed:changes.length,domesticGames,neutralGames,exactFairMoves:exactMoves,displayMoves,idempotentGames,teamVenueAdjustmentsActivated:0,carriedRatingMoves:0,personnelOverlayMoves:0},
  activationArtifacts:{currentNumbers:ACTIVE.paths.currentNumbers,researchLedger:ACTIVE.paths.researchLedger,currentNumbersShaBefore,currentNumbersShaAfter,researchShaBefore,researchShaAfter,protectedArtifactSha256:protectedAfter},
  gameChanges:changes
};
const h4Current={
  schema:1,stage:'H4',state:'OPERATIONAL_SCOPED',season:ACTIVE.season,week:ACTIVE.week,updatedAt:now,
  productionId:contract.productionId,productionAuthority:true,liveBoardMutationAllowed:true,marketViewed:false,
  leagueBaselineHomeAdvantagePoints:leagueHfa,neutralBaseHomeAdvantagePoints:0,
  selectiveVenueAdjustments:false,teamVenueBlanket:false,h3vSurvivalCoefficientK:Number(h3v.h4ScopeCandidate.survivalCoefficientK),qualifiedVenueCount:0,
  activationSummary:manifest.activationSummary,productionManifest:path.relative(ROOT,OUT).replaceAll(path.sep,'/'),
  nextGate:[
    'Recurring Graham builds must use the H4 production manifest for base location terms rather than restoring the provisional 1.5-point domestic allowance.',
    'Keep team/stadium deviations off unless a future governed recalibration qualifies them.',
    'Model altitude, travel/time-zone, weather, surface and other specific venue mechanisms only in their proper future S/W-factor layers.',
    'Preserve exact 2.082 arithmetic internally and ordinary half-point display rounding.'
  ]
};
write(OUT,manifest);write(CURRENT,h4Current);

const v=read(OUT),vn=read(NUMBERS),vr=read(RESEARCH);
if(v.state!=='OPERATIONAL_SCOPED'||v.productionAuthority!==true||v.productionScope.domesticLeagueBaseline.homeLocationAdvantagePoints!==2.082||v.productionScope.selectiveVenueAdjustments.enabled!==false||v.productionScope.teamVenueBlanket.enabled!==false)fail('H4_MANIFEST_READBACK');
if(vn.homeFieldProduction?.productionId!==contract.productionId||vn.homeFieldProduction?.domesticLeagueBaselineHomeAdvantagePoints!==2.082)fail('H4_NUMBERS_READBACK');
if(vr.sweeps?.at(-1)?.type!=='HOME_FIELD_PRODUCTION_ACTIVATION'||vr.sweeps.at(-1)?.summary?.marketViewed!==false)fail('H4_RESEARCH_READBACK');
for(const g of vn.games||[]){
  if(Math.abs((finite(g.personnelOverlayPointsToHomeSpread)?Number(g.personnelOverlayPointsToHomeSpread):0)-(beforeOverlay.get(g.gameKey)||0))>1e-9)fail(`FAIL_CLOSED_H4_PERSONNEL_OVERLAY_CHANGED:${g.gameKey}:readback`);
}
console.log(`WALTERS HOME FIELD H4: PASS // OPERATIONAL SCOPED // DOMESTIC HFA ${leagueHfa.toFixed(3)} // NEUTRAL 0 // TEAM VENUE OFF // ${displayMoves} DISPLAY MOVES // 0 RATING MOVES`);

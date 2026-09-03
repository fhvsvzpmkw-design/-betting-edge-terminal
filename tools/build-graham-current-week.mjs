#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {matchNflFixture,extractPinnacleHomeSpread,extractPinnacleMoneyline} from './graham-market-utils.mjs';
import {resolveGrahamActiveWeek} from './graham-active-week.mjs';
import {loadGrahamScheduleAuthority,validateGrahamBoardScheduleMetadata} from './graham-schedule-authority.mjs';

const ROOT=process.cwd();
const ACTIVE=resolveGrahamActiveWeek({root:ROOT});
const NUMBERS=ACTIVE.absolutePaths.currentNumbers;
const RATINGS=path.join(ROOT,'data/walters/nfl-power-ratings-ledger.json');
const MARKET=ACTIVE.absolutePaths.dailyMarketLedger;
const OBSERVER=path.join(ROOT,'data/oddspapi-observer.json');
const LIVE=path.join(ROOT,'data/live-odds.json');
const OUT=path.join(ROOT,'data/walters/nfl/current-week-terminal.json');

function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'))}
function numeric(v){if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
function roundHalf(v){return Number.isFinite(v)?Math.round(v*2)/2:null}
function latestSnapshot(game){const rows=Array.isArray(game?.dailySnapshots)?game.dailySnapshots:[];return rows.slice().sort((a,b)=>Number(a.sequence||0)-Number(b.sequence||0)).at(-1)||null}

const numbers=readJson(NUMBERS);
const scheduleAuthority=loadGrahamScheduleAuthority({root:ROOT});
validateGrahamBoardScheduleMetadata(numbers,scheduleAuthority);
const ratings=readJson(RATINGS);
const market=readJson(MARKET);
const observer=fs.existsSync(OBSERVER)?readJson(OBSERVER):null;
const live=fs.existsSync(LIVE)?readJson(LIVE):null;
const ratingByAbbr=new Map((ratings.teams||[]).map(t=>[t.abbr,t]));
const marketByKey=new Map((market.games||[]).map(g=>[g.gameKey,g]));
const marketStatus=String(observer?.status||'unavailable');
const fixtures=marketStatus==='ok'&&Array.isArray(observer.fixtures)?observer.fixtures:[];

const games=(numbers.games||[]).map(game=>{
  const awayRating=ratingByAbbr.get(game.away)||null;
  const homeRating=ratingByAbbr.get(game.home)||null;
  const awayCurrent=numeric(awayRating?.currentRating);
  const homeCurrent=numeric(homeRating?.currentRating);
  const neutralBaseHome=awayCurrent!==null&&homeCurrent!==null?roundHalf(awayCurrent-homeCurrent):null;
  const awayFpi=numeric(awayRating?.externalComparisons?.espnFpi?.rating);
  const homeFpi=numeric(homeRating?.externalComparisons?.espnFpi?.rating);
  const espnNeutralHome=awayFpi!==null&&homeFpi!==null?roundHalf(awayFpi-homeFpi):null;
  const official=latestSnapshot(marketByKey.get(game.gameKey));
  const matched=matchNflFixture(game,fixtures);
  const livePinnacle=matched?extractPinnacleHomeSpread(matched.fixture,observer?.generatedAt):null;
  const liveMoneyline=matched?extractPinnacleMoneyline(matched.fixture,observer?.generatedAt):null;
  const officialPinnacle=numeric(official?.pinnacleSpreadHome);
  const pinnacleSpreadHome=numeric(livePinnacle?.homeSpread??officialPinnacle);
  const pinnacleObservedAt=livePinnacle?.observedAt??official?.pinnacleObservedAt??null;
  const pinnacleStatus=pinnacleSpreadHome!==null?'AVAILABLE':official?.pinnacleStatus||'PENDING';
  const pinnacleHomeMoneylineAmerican=numeric(liveMoneyline?.homeMoneylineAmerican);
  const pinnacleAwayMoneylineAmerican=numeric(liveMoneyline?.awayMoneylineAmerican);
  const pinnacleMoneylineStatus=pinnacleHomeMoneylineAmerican!==null&&pinnacleAwayMoneylineAmerican!==null?'AVAILABLE':'PENDING';
  const grahamFairHome=numeric(game.grahamFairHome);
  const priorGraham=numeric(game.priorGrahamFairHome);
  const gap=grahamFairHome!==null&&pinnacleSpreadHome!==null?roundHalf(pinnacleSpreadHome-grahamFairHome):null;
  const grahamMove=grahamFairHome!==null&&priorGraham!==null?roundHalf(grahamFairHome-priorGraham):null;
  const pinnacleMove=pinnacleSpreadHome!==null&&officialPinnacle!==null?roundHalf(pinnacleSpreadHome-officialPinnacle):null;
  const moneylineSelectorStatus=grahamFairHome===null?'FAIR_LINE_PENDING':pinnacleMoneylineStatus!=='AVAILABLE'?'MARKET_PENDING':'MARKET_READY_AWAITING_SPREAD_QUALIFICATION';
  return {
    gameKey:game.gameKey,away:game.away,home:game.home,startTimePacific:game.startTimePacific,
    awayRating:awayCurrent,homeRating:homeCurrent,neutralBaseHome,
    espnNeutralHome,
    grahamFairHome,grahamAsOf:game.grahamAsOf||null,numberStatus:game.numberStatus||'PENDING',grahamMove,
    informationStatus:game.informationStatus||'PENDING',researchSummary:game.researchSummary||null,adjustments:Array.isArray(game.adjustments)?game.adjustments:[],
    proposedWager:game.proposedWager&&typeof game.proposedWager==='object'?game.proposedWager:null,
    spreadVsMoneyline:game.spreadVsMoneyline&&typeof game.spreadVsMoneyline==='object'?game.spreadVsMoneyline:null,
    waltersVerdict:game.waltersVerdict||null,
    pinnacleSpreadHome,
    pinnacleObservedAt,pinnacleStatus,pinnacleHomePriceAmerican:livePinnacle?.homePriceAmerican??null,pinnacleAwayPriceAmerican:livePinnacle?.awayPriceAmerican??null,
    pinnacleSelectionMethod:livePinnacle?.selectionMethod??(officialPinnacle!==null?'OFFICIAL_DAILY_SNAPSHOT':null),
    pinnacleFixtureId:matched?.fixture?.fixtureId||null,pinnacleMatchMethod:matched?.matchedBy||null,pinnacleMove,
    pinnacleHomeMoneylineAmerican,pinnacleAwayMoneylineAmerican,
    pinnacleMoneylineObservedAt:liveMoneyline?.observedAt??null,pinnacleMoneylineStatus,
    pinnacleMoneylineMarketId:liveMoneyline?.marketId??null,pinnacleMoneylineBookmakerMarketId:liveMoneyline?.bookmakerMarketId??null,
    pinnacleMoneylineHomeLimit:liveMoneyline?.homeLimit??null,pinnacleMoneylineAwayLimit:liveMoneyline?.awayLimit??null,
    pinnacleMoneylineSelectionMethod:liveMoneyline?.selectionMethod??null,
    moneylineSelectorStatus,
    grahamHomeStrengthGap:gap,
    officialDailySequence:official?.sequence??null,officialDailyCapturedAt:official?.capturedAt??null
  };
});

const out={
  schema:1,feedId:'graham-mercer-nfl-current-week-terminal-v1',publication:'THE NINETEENTH HOLE',season:numbers.season,week:numbers.week,
  generatedAt:new Date().toISOString(),timezone:'America/Vancouver',state:numbers.state,
  activeWeek:{authority:ACTIVE.manifest.authority,manifestPath:ACTIVE.manifestPath,season:ACTIVE.season,week:ACTIVE.week},
  lastResearchAt:numbers.lastResearchAt||null,marketStatus,marketObservedAt:marketStatus==='ok'?observer?.generatedAt||null:null,
  scheduleAuthority:numbers.scheduleAuthority,
  sourceScheduleMeta:live?.scheduleMeta||null,
  displayPolicy:{mode:'CURRENT_WEEK_TERMINAL',marketIsolation:true,pinnacleRole:'SHARP_MARKET_BENCHMARK_ONLY',bettingAuthority:false,rawOutput:true},
  moneylinePolicy:{method:'WALTERS_PAGES_270_272_WAGER_FORM_SELECTOR',standaloneGrahamFairMoneyline:false,role:'EXECUTION_FORM_COMPARISON_AFTER_SPREAD_QUALIFICATION',bookExactSpreadPriceAmerican:-110,marketCanChangeGrahamFair:false,autoCreatesBet:false},
  valueDisplayPolicy:{watchGapPoints:1.5,watchIsDisplayOnly:true,qualifiedRequiresGovernedProposedWager:true,bettingAuthority:false},
  signConvention:{spreadHome:'Negative = home favorite; positive = home underdog.',gap:'Pinnacle home spread minus Graham home fair. Positive = Graham stronger on home; negative = Graham stronger on away.',moneylinePair:'Displayed as away / home American prices.'},
  games,
  ratings:(ratings.teams||[]).map(t=>({abbr:t.abbr,team:t.team,currentRating:t.currentRating,priorRating:t.priorRating,lastDelta:t.lastDelta,lastUpdatedAt:t.lastUpdatedAt,espnFpi:t.externalComparisons?.espnFpi||null}))
};
fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
const verify=JSON.parse(fs.readFileSync(OUT,'utf8'));
if(Number(verify.season)!==ACTIVE.season||Number(verify.week)!==ACTIVE.week)throw new Error('Graham terminal active-week verification failed');
if(verify.scheduleAuthority?.authorityId!==scheduleAuthority.authorityId||verify.scheduleAuthority?.state!=='SYNCHRONIZED')throw new Error('Graham terminal schedule authority verification failed');
console.log(`GRAHAM TERMINAL BUILT // ${ACTIVE.season} WEEK ${ACTIVE.week} // ${games.length} GAMES // ${games.filter(g=>g.grahamFairHome!==null).length} GRAHAM NUMBERS // ${games.filter(g=>g.pinnacleSpreadHome!==null).length} PINNACLE LINES // ${games.filter(g=>g.pinnacleMoneylineStatus==='AVAILABLE').length} PINNACLE MONEYLINES // SCHEDULE ${scheduleAuthority.authorityId}`);

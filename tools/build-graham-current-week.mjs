#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {matchNflFixture,extractPinnacleHomeSpread} from './graham-market-utils.mjs';

const ROOT=process.cwd();
const NUMBERS=path.join(ROOT,'data/walters/nfl/2026/week-01-current-numbers.json');
const RATINGS=path.join(ROOT,'data/walters/nfl-power-ratings-ledger.json');
const MARKET=path.join(ROOT,'data/walters/nfl/2026/week-01-daily-market-ledger.json');
const OBSERVER=path.join(ROOT,'data/oddspapi-observer.json');
const LIVE=path.join(ROOT,'data/live-odds.json');
const OUT=path.join(ROOT,'data/walters/nfl/current-week-terminal.json');

function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'))}
function roundHalf(v){return Number.isFinite(v)?Math.round(v*2)/2:null}
function latestSnapshot(game){const rows=Array.isArray(game?.dailySnapshots)?game.dailySnapshots:[];return rows.slice().sort((a,b)=>Number(a.sequence||0)-Number(b.sequence||0)).at(-1)||null}

const numbers=readJson(NUMBERS);
const ratings=readJson(RATINGS);
const market=readJson(MARKET);
const observer=fs.existsSync(OBSERVER)?readJson(OBSERVER):null;
const live=fs.existsSync(LIVE)?readJson(LIVE):null;
const ratingByAbbr=new Map((ratings.teams||[]).map(t=>[t.abbr,t]));
const marketByKey=new Map((market.games||[]).map(g=>[g.gameKey,g]));
const fixtures=observer?.status==='ok'&&Array.isArray(observer.fixtures)?observer.fixtures:[];

const games=(numbers.games||[]).map(game=>{
  const awayRating=ratingByAbbr.get(game.away)||null;
  const homeRating=ratingByAbbr.get(game.home)||null;
  const awayCurrent=Number(awayRating?.currentRating);
  const homeCurrent=Number(homeRating?.currentRating);
  const neutralBaseHome=Number.isFinite(awayCurrent)&&Number.isFinite(homeCurrent)?roundHalf(awayCurrent-homeCurrent):null;
  const awayFpi=Number(awayRating?.externalComparisons?.espnFpi?.rating);
  const homeFpi=Number(homeRating?.externalComparisons?.espnFpi?.rating);
  const espnNeutralHome=Number.isFinite(awayFpi)&&Number.isFinite(homeFpi)?roundHalf(awayFpi-homeFpi):null;
  const official=latestSnapshot(marketByKey.get(game.gameKey));
  const matched=matchNflFixture(game,fixtures);
  const livePinnacle=matched?extractPinnacleHomeSpread(matched.fixture,observer?.generatedAt):null;
  const officialPinnacle=Number.isFinite(Number(official?.pinnacleSpreadHome))?Number(official.pinnacleSpreadHome):null;
  const pinnacleSpreadHome=livePinnacle?.homeSpread??officialPinnacle;
  const pinnacleObservedAt=livePinnacle?.observedAt??official?.pinnacleObservedAt??null;
  const pinnacleStatus=Number.isFinite(Number(pinnacleSpreadHome))?'AVAILABLE':official?.pinnacleStatus||'PENDING';
  const graham=Number(game.grahamFairHome);
  const priorGraham=Number(game.priorGrahamFairHome);
  const grahamFairHome=Number.isFinite(graham)?graham:null;
  const gap=grahamFairHome!==null&&Number.isFinite(Number(pinnacleSpreadHome))?roundHalf(Number(pinnacleSpreadHome)-grahamFairHome):null;
  const grahamMove=grahamFairHome!==null&&Number.isFinite(priorGraham)?roundHalf(grahamFairHome-priorGraham):null;
  const pinnacleMove=Number.isFinite(Number(pinnacleSpreadHome))&&Number.isFinite(Number(officialPinnacle))?roundHalf(Number(pinnacleSpreadHome)-officialPinnacle):null;
  return {
    gameKey:game.gameKey,away:game.away,home:game.home,startTimePacific:game.startTimePacific,
    awayRating:Number.isFinite(awayCurrent)?awayCurrent:null,homeRating:Number.isFinite(homeCurrent)?homeCurrent:null,neutralBaseHome,
    espnNeutralHome,
    grahamFairHome,grahamAsOf:game.grahamAsOf||null,numberStatus:game.numberStatus||'PENDING',grahamMove,
    informationStatus:game.informationStatus||'PENDING',researchSummary:game.researchSummary||null,adjustments:Array.isArray(game.adjustments)?game.adjustments:[],
    pinnacleSpreadHome:Number.isFinite(Number(pinnacleSpreadHome))?Number(pinnacleSpreadHome):null,
    pinnacleObservedAt,pinnacleStatus,pinnacleHomePriceAmerican:livePinnacle?.homePriceAmerican??null,pinnacleAwayPriceAmerican:livePinnacle?.awayPriceAmerican??null,
    pinnacleSelectionMethod:livePinnacle?.selectionMethod??(officialPinnacle!==null?'OFFICIAL_DAILY_SNAPSHOT':null),
    pinnacleFixtureId:matched?.fixture?.fixtureId||null,pinnacleMatchMethod:matched?.matchedBy||null,pinnacleMove,
    grahamHomeStrengthGap:gap,
    officialDailySequence:official?.sequence??null,officialDailyCapturedAt:official?.capturedAt??null
  };
});

const out={
  schema:1,feedId:'graham-mercer-nfl-current-week-terminal-v1',publication:'THE NINETEENTH HOLE',season:numbers.season,week:numbers.week,
  generatedAt:new Date().toISOString(),timezone:'America/Vancouver',state:numbers.state,
  lastResearchAt:numbers.lastResearchAt||null,marketObservedAt:observer?.generatedAt||null,
  sourceScheduleMeta:live?.scheduleMeta||null,
  displayPolicy:{mode:'CURRENT_WEEK_TERMINAL',marketIsolation:true,pinnacleRole:'SHARP_MARKET_BENCHMARK_ONLY',bettingAuthority:false,rawOutput:true},
  signConvention:{spreadHome:'Negative = home favorite; positive = home underdog.',gap:'Pinnacle home spread minus Graham home fair. Positive = Graham stronger on home; negative = Graham stronger on away.'},
  games,
  ratings:(ratings.teams||[]).map(t=>({abbr:t.abbr,team:t.team,currentRating:t.currentRating,priorRating:t.priorRating,lastDelta:t.lastDelta,lastUpdatedAt:t.lastUpdatedAt,espnFpi:t.externalComparisons?.espnFpi||null}))
};
fs.mkdirSync(path.dirname(OUT),{recursive:true});
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
JSON.parse(fs.readFileSync(OUT,'utf8'));
console.log(`GRAHAM TERMINAL BUILT // WEEK ${out.week} // ${games.length} GAMES // ${games.filter(g=>g.grahamFairHome!==null).length} GRAHAM NUMBERS // ${games.filter(g=>g.pinnacleSpreadHome!==null).length} PINNACLE LINES`);

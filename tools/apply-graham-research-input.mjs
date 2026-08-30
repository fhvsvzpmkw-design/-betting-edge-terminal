#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const inputPath=process.argv[2]||'data/walters/nfl/current-research-input.json';
const input=JSON.parse(fs.readFileSync(inputPath,'utf8'));
if(input?.schema!==1)throw new Error('Unsupported Graham research input schema');
if(input?.marketViewed!==false)throw new Error('Market-isolation failure: research input must certify marketViewed=false');
if(!input?.effectiveAt||Number.isNaN(Date.parse(input.effectiveAt)))throw new Error('Missing/invalid effectiveAt');
if(!Array.isArray(input.teamFindings)||input.teamFindings.length!==32)throw new Error('Initial sweep must contain 32 team findings');
if(!Array.isArray(input.games)||input.games.length!==16)throw new Error('Week 1 input must contain 16 games');
if(!Array.isArray(input.teamRatingUpdates))throw new Error('Missing teamRatingUpdates');
if(!input.espnFpi||Object.keys(input.espnFpi).length!==32)throw new Error('ESPN FPI capture must contain 32 teams');

const ROOT=process.cwd();
const POWER=path.join(ROOT,'data/walters/nfl-power-ratings-ledger.json');
const RESEARCH=path.join(ROOT,'data/walters/nfl/2026/week-01-research-ledger.json');
const NUMBERS=path.join(ROOT,'data/walters/nfl/2026/week-01-current-numbers.json');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,j)=>fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');
const power=read(POWER),research=read(RESEARCH),numbers=read(NUMBERS);
const fpiUrl=String(input.espnFpiSource?.url||'');
const fpiAsOf=String(input.espnFpiSource?.asOf||'');

const updateByAbbr=new Map(input.teamRatingUpdates.map(u=>[u.abbr,u]));
for(const team of power.teams||[]){
  const f=input.espnFpi[team.abbr];
  if(!f)throw new Error(`Missing FPI for ${team.abbr}`);
  team.externalComparisons=team.externalComparisons||{};
  team.externalComparisons.espnFpi={
    status:'CAPTURED_STALE_SOURCE_DATE',rating:f.rating,rank:f.rank,offense:f.offense,defense:f.defense,specialTeams:f.specialTeams,
    asOf:fpiAsOf,capturedAt:input.effectiveAt,sourceUrl:fpiUrl,role:'INDEPENDENT_COMPARISON_ONLY',
    note:`ESPN's 2026 FPI page was captured during this sweep but identifies its own last update as ${fpiAsOf}. Use matchup differentials/disagreement only; do not mechanically average raw FPI with Graham ratings.`
  };
  const u=updateByAbbr.get(team.abbr);
  if(!u)continue;
  if(!Number.isFinite(Number(team.seedRating))||!Number.isFinite(Number(team.currentRating)))throw new Error(`Invalid rating record for ${team.abbr}`);
  const prior=Number(team.currentRating),delta=Number(u.delta),next=Number((prior+delta).toFixed(3));
  if(!Number.isFinite(delta))throw new Error(`Invalid delta for ${team.abbr}`);
  const history=Array.isArray(team.history)?team.history:[];
  const sequence=history.length?Math.max(...history.map(h=>Number(h.sequence)||0))+1:1;
  const event={sequence,type:'INITIAL_RESEARCH_DELTA',fromRating:prior,delta,toRating:next,effectiveAt:input.effectiveAt,reason:u.reason,sourceRefs:u.sourceRefs};
  team.priorRating=prior;team.currentRating=next;team.lastDelta=delta;team.lastUpdatedAt=input.effectiveAt;team.lastUpdateType='INITIAL_RESEARCH_DELTA';team.confidence='CURRENT_RESEARCH_ADJUSTED';
  team.sourceRefs=[...new Set([...(team.sourceRefs||[]),...(u.sourceRefs||[])])];
  team.history=[...history,event];
}
power.updatedAt=input.effectiveAt;

const sweep={
  sequence:(research.sweeps||[]).length?Math.max(...research.sweeps.map(s=>Number(s.sequence)||0))+1:0,
  type:'INITIAL_WEEK_1_BASELINE',startedAt:input.startedAt||input.effectiveAt,completedAt:input.effectiveAt,
  scope:'All 32 NFL teams and all 16 2026 Week 1 matchups: quarterback status, injuries, roster/personnel, offensive line, pass rush, secondary, playmakers, coaching and material schedule/rest/travel context. Market prices were not consulted.',
  sourcesChecked:input.sourcesChecked,teamFindings:input.teamFindings,
  ratingChanges:input.teamRatingUpdates.map(u=>{const t=power.teams.find(x=>x.abbr===u.abbr);return{team:t.team,abbr:u.abbr,priorRating:t.priorRating,delta:u.delta,currentRating:t.currentRating,reason:u.reason,sourceRefs:u.sourceRefs,effectiveAt:input.effectiveAt}}),
  matchupChanges:input.games.map(g=>({gameKey:g.gameKey,away:g.away,home:g.home,neutralBaseHome:g.neutralBaseHome,grahamFairHome:g.grahamFairHome,espnFpiNeutralHome:g.espnFpiNeutralHome,adjustments:g.adjustments})),
  espnFpiCapture:{status:'CAPTURED_STALE_SOURCE_DATE',sourceUrl:fpiUrl,sourceAsOf:fpiAsOf,capturedAt:input.effectiveAt,teamCount:32,rule:'Independent comparison only. Raw FPI is on a different scale and is not mechanically averaged into Graham ratings.',note:'The live ESPN 2026 FPI page explicitly identifies a June 2, 2026 update date, so this layer is retained as a dated cross-check rather than current personnel authority.'},
  summary:{teamsReviewed:32,gamesBuilt:16,carriedRatingMoves:input.teamRatingUpdates.length,marketViewed:false,readiness:'PROVISIONAL_NUMBERS_COMPLETE_PRE_CUTDOWN_DELTA_REQUIRED',note:'All 16 independent Graham Week 1 numbers are built. The NFL 53-man roster cutdown was still in progress at sweep time, so a post-deadline change-only check is required before treating the 15:15 comparison as the day’s finalized information state.'}
};
research.sweeps=[...(research.sweeps||[]),sweep];research.updatedAt=input.effectiveAt;

const inputGames=new Map(input.games.map(g=>[g.gameKey,g]));
for(const game of numbers.games||[]){
  const g=inputGames.get(game.gameKey);if(!g)throw new Error(`Missing game input for ${game.gameKey}`);
  game.priorGrahamFairHome=game.grahamFairHome;
  game.grahamFairHome=g.grahamFairHome;game.grahamAsOf=input.effectiveAt;game.neutralBaseHome=g.neutralBaseHome;game.espnFpiNeutralHome=g.espnFpiNeutralHome;
  game.numberStatus='READY_PROVISIONAL_CUTDOWN_DELTA_REQUIRED';game.informationStatus='INITIAL_SWEEP_COMPLETE_ROSTER_CUTDOWN_IN_PROGRESS';game.adjustments=g.adjustments;
  game.researchSummary=g.researchSummary;game.sourceRefs=g.sourceRefs;
}
numbers.state='INITIAL_NUMBERS_READY_CUTDOWN_DELTA_REQUIRED';numbers.updatedAt=input.effectiveAt;numbers.lastResearchAt=input.effectiveAt;
numbers.initialBuildPolicy=input.initialBuildPolicy;

write(POWER,power);write(RESEARCH,research);write(NUMBERS,numbers);
const vp=read(POWER),vr=read(RESEARCH),vn=read(NUMBERS);
if(vp.teams.length!==32||Object.values(vp.teams).some(t=>!Number.isFinite(Number(t.externalComparisons?.espnFpi?.rating))))throw new Error('Power/FPI read-back failed');
if(vr.sweeps.at(-1)?.teamFindings?.length!==32)throw new Error('Research read-back failed');
if(vn.games.length!==16||vn.games.some(g=>!Number.isFinite(Number(g.grahamFairHome))))throw new Error('Current-number read-back failed');
for(const u of input.teamRatingUpdates){const t=vp.teams.find(x=>x.abbr===u.abbr);if(!t||t.lastUpdateType!=='INITIAL_RESEARCH_DELTA')throw new Error(`Rating update verification failed for ${u.abbr}`)}
console.log(`GRAHAM INITIAL RESEARCH APPLIED // 32 TEAMS // 16 GAMES // ${input.teamRatingUpdates.length} RATING MOVES // MARKET VIEWED FALSE`);

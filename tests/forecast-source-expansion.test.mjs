import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseBetBetter,parseCsv,collect,saveCapture,betBetterUrl} from '../tools/collect-game-intelligence.mjs';
import {validateCapture} from '../tools/game-intelligence.mjs';
import {aggregateForecastComparisons,summarizeProjectionContext} from '../tools/forecast-aggregation.mjs';
import {forecastRoutes} from '../tools/forecast-evidence.mjs';
import {buildEventResearchPlan,buildResearchWorkPlan} from '../tools/event-research-plan.mjs';

const registry=JSON.parse(fs.readFileSync('research/forecast-source-registry.json'));
const at='2026-10-06T17:20:00Z',start='2026-10-06T20:00:00Z';
const event={eventId:'fixture',sport:'NFL',home:'Denver Broncos',away:'Los Angeles Rams',startTime:start};
const fields=['date_utc','time_utc','away_team','home_team','pred_away_score','pred_home_score','home_margin','total','home_win_prob'];
const row={date_utc:'2026-10-06',time_utc:'20:00:00',away_team:event.away,home_team:event.home,
  pred_away_score:'20.5',pred_home_score:'24.5',home_margin:'4',total:'45',home_win_prob:'0.61'};
const csv=fields.join(',')+'\n'+fields.map(key=>row[key]).join(',')+'\n';

test('published score export retains exact identity, source bytes, attribution and units without inventing a betting probability',()=>{
  const records=parseBetBetter(parseCsv('\uFEFF'+csv),event,at,registry);
  assert.equal(records.length,3);
  assert.equal(records[0].projection.homeSpread,-4);
  assert.equal(records[1].projection.total,45);
  assert.equal(records[2].probability,.61);
  assert.equal(records[2].probabilityBasis,'UNKNOWN');
  assert.equal(records[2].settlement,null);
  assert.equal(records[2].forecastAt,null);
  assert.ok(records.every(r=>r.observedAt===at&&r.licence==='CC BY 4.0'&&r.attribution.includes('Bet Better')));
  assert.deepEqual(records[0].sourceValues,row);
  assert.equal(records[0].inputUrl,betBetterUrl('NFL'));
  assert.equal(records.filter(r=>r.side==='away').length,0,'no inferred complement');
  assert.ok(records.slice(0,2).every(r=>r.kind==='SCORE_CONTEXT'&&r.probability===undefined));
  validateCapture({schema:1,collectedAt:at,records},registry);
});

test('missing, locked, duplicated or inconsistent score rows cannot masquerade as model coverage',()=>{
  for(const change of [{locked:'true'},{home_margin:''},{total:''},{home_margin:'-4'},
    {pred_home_score:'99'},{time_utc:'19:00:00'},{home_team:row.away_team,away_team:row.home_team}])
    assert.deepEqual(parseBetBetter([{...row,...change}],event,at,registry),[]);
  assert.deepEqual(parseBetBetter([row,row],event,at,registry),[]);
  assert.deepEqual(parseBetBetter([row],event,start,registry),[]);
  assert.deepEqual(parseBetBetter([row],{...event,sport:'CFL'},at,registry),[]);
  for(const p of ['', '61','NaN','-0.1']){
    const records=parseBetBetter([{...row,home_win_prob:p}],event,at,registry);
    assert.equal(records.length,2);
    assert.equal(records.some(r=>r.kind==='OUTCOME_PROBABILITY'),false);
  }
});

test('sport-specific point context maps to run line and puck line rather than football spread',()=>{
  const baseball={...event,sport:'MLB',home:'New York Yankees',away:'Toronto Blue Jays'};
  const hockey={...event,sport:'NHL',home:'Montréal Canadiens',away:'Toronto Maple Leafs'};
  for(const [e,detail] of [[baseball,'full_game_primary_run_line'],[hockey,'full_game_primary_puck_line']]){
    const records=parseBetBetter([{...row,home_team:e.home.normalize('NFD').replace(/[\u0300-\u036f]/g,''),away_team:e.away}],e,at,registry);
    assert.equal(records[0].marketDetail,detail);
    assert.equal(records[0].line,null);
  }
});

test('shared collector fetches only the licensed score feed, caches successes, and preserves original records after a failure',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'forecast-expansion-')),urls=[];
  try{
    fs.mkdirSync(path.join(root,'research'),{recursive:true});fs.writeFileSync(path.join(root,'research/forecast-source-registry.json'),JSON.stringify(registry));
    fs.mkdirSync(path.join(root,'data'),{recursive:true});fs.writeFileSync(path.join(root,'data/live-odds.json'),JSON.stringify({generatedAt:at,
      events:[{id:event.eventId,home:event.home,away:event.away,date:start,sport:{slug:'american-football'},league:{slug:'usa-nfl'}}]}));
    const competitors=[{id:'7',homeAway:'home',team:{abbreviation:'DEN',displayName:event.home}},
      {id:'14',homeAway:'away',team:{abbreviation:'LAR',displayName:event.away}}];
    const competition={id:'123',date:start,status:{type:{state:'pre'}},competitors};
    const espn={id:'123',season:{year:2026},week:{number:5},competitions:[competition]};
    const fetchImpl=async url=>{urls.push(url);const body=url.includes('scoreboard')?JSON.stringify({events:[espn]}):
      url.includes('summary')?JSON.stringify({header:{id:'123',competitions:[competition]}}):url.includes('betbetter')?csv:'game_id\n';
      return {ok:true,status:200,text:async()=>body};};
    const first=await collect({root,at,fetchImpl});saveCapture(root,first);
    const original=first.records.filter(r=>r.sourceId==='bet_better');
    assert.equal(original.length,3);
    assert.equal(urls.filter(u=>u===betBetterUrl('NFL')).length,1);
    const cached=await collect({root,at:'2026-10-06T17:25:00Z',fetchImpl});
    assert.deepEqual(cached.records.filter(r=>r.sourceId==='bet_better'),original);
    assert.equal(urls.filter(u=>u===betBetterUrl('NFL')).length,1);
    const failed=await collect({root,at:'2026-10-06T17:40:00Z',fetchImpl:async url=>url.includes('betbetter')?{ok:false,status:403}:fetchImpl(url)});
    assert.deepEqual(failed.records.filter(r=>r.sourceId==='bet_better'),original);
    assert.ok(failed.sources.some(s=>s.sourceId==='bet_better'&&s.state==='UNAVAILABLE'&&s.reason));
    assert.ok(first.sources.some(s=>s.sourceId==='the_margin'&&s.state==='RESEARCH_OR_LICENSED_IMPORT'));
    assert.equal(urls.some(u=>/playerwon|podiumoracle|covers\.com|dimers|oddsapi/.test(u)),false);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

const comparison=(recordId,modelFamily,p=.6)=>({recordId,modelFamily,sourceId:recordId,probability:p,
  eventId:event.eventId,sport:event.sport,startTime:start,period:'FULL_GAME',marketDetail:'full_game_moneyline',side:'home',line:null,
  priceDecimal:2,probabilityBasis:'UNCONDITIONAL',pushProbability:0,settlement:{includesOvertime:true,pushRule:'NO_PUSH'},
  marketDependence:'MARKET_INFLUENCE_DISCLOSED',edgeProbabilityPoints:(p-.5)*100,direction:p>.5?'SUPPORTS_PRICE':p<.5?'OPPOSES_PRICE':'NEUTRAL'});

test('syndicated versions share one family while contrary forecasts and BET review remain visible without creating a decision',()=>{
  const rows=[comparison('original','SHARED',.6),comparison('syndicated','SHARED',.4),comparison('other','OTHER',.7)];
  const before=JSON.stringify(rows),result=aggregateForecastComparisons([...rows,rows[0]]);
  assert.equal(result.records,3);assert.equal(result.sources,3);assert.equal(result.modelFamilies,2);
  assert.equal(result.groups[0].mixedFamilies,1);assert.equal(result.groups[0].supportingFamilies,1);
  assert.ok(Math.abs(result.groups[0].descriptiveMedian-.6)<1e-12);
  assert.equal(result.groups[0].families.find(f=>f.modelFamily==='SHARED').direction,'RELATED_MODEL_DISAGREEMENT');
  assert.equal(result.betReviewRequired,true);assert.deepEqual(result.reviewOrder,['BET','LEAN','WAIT','PASS']);
  assert.equal(result.decisionAuthority,false);assert.equal(result.status,undefined);assert.equal(result.stake,undefined);
  assert.equal(JSON.stringify(rows),before);
});

test('different event, price, line, period, settlement or probability basis never share an aggregate',()=>{
  const changes=[{eventId:'other'},{sport:'CFL'},{startTime:'2026-10-06T21:00:00Z'},{period:'FIRST_HALF'},
    {marketDetail:'full_game_primary_total'},{side:'away'},{line:3.5},{priceDecimal:1.9},
    {probabilityBasis:'CONDITIONAL_ON_NO_PUSH'},{pushProbability:.02},{settlement:{includesOvertime:false,pushRule:'NO_PUSH'}},
    {settlement:{includesOvertime:true,pushRule:'REFUND'}}];
  for(const change of changes){const result=aggregateForecastComparisons([comparison('a','A'),{...comparison('b','B'),...change}]);
    assert.equal(result.groups.length,2,JSON.stringify(change));}
  const opposed=aggregateForecastComparisons([comparison('a','A',.4)]);
  assert.equal(opposed.betReviewRequired,false);assert.equal(opposed.groups[0].opposingFamilies,1);
  assert.equal(aggregateForecastComparisons([{...comparison('bad','A'),edgeProbabilityPoints:null}]).records,0);
});

test('score context stays in native units and model families rather than becoming fair probabilities',()=>{
  const rows=parseBetBetter([row],event,at,registry),context=summarizeProjectionContext(rows);
  assert.equal(context.length,2);
  assert.equal(context.find(r=>r.unit==='home_spread_points').min,-4);
  assert.equal(context.find(r=>r.unit==='total_points').max,45);
  assert.ok(context.every(r=>r.families===1&&r.probability===undefined&&r.status===undefined));
});

test('all six sources have explicit applicable routes and commercial collection limits',()=>{
  const routed=new Set(Object.keys(registry.markets).flatMap(key=>{const [sport,market]=key.split(':');
    return forecastRoutes(sport,market==='moneyline'?'full_game_moneyline':market==='total'?'full_game_primary_total':
      sport==='MLB'?'full_game_primary_run_line':sport==='NHL'?'full_game_primary_puck_line':'full_game_primary_spread',registry).sources.map(s=>s.sourceId);}));
  for(const sourceId of registry.aggregationPolicy.researchSources)assert.ok(routed.has(sourceId),sourceId);
  assert.equal(registry.sources.bet_better.automatedReuse,'CC_BY_4_0_WITH_ATTRIBUTION');
  assert.equal(registry.sources.podium_oracle.automatedReuse,'WRITTEN_PERMISSION_REQUIRED_FOR_COMMERCIAL_USE');
  assert.equal(forecastRoutes('NHL','full_game_moneyline',registry).sources.find(s=>s.sourceId==='playerwon').collectionMode,'PERMITTED_IMPORT_REQUIRED');
});

test('forward work plans keep additional model routes visible when ESPN and completed cards already exist',()=>{
  const selection={selectionId:'NFL|fixture|full_game_moneyline|home',sport:'NFL',eventId:event.eventId,eventDate:start,
    marketDetail:'full_game_moneyline',side:'home',state:'EVALUATED',status:'PASS',reviewState:'COMPLETE'};
  const input={report:{ts:at},candidateAssessment:{selections:[selection]},forecastCoverage:{selections:[{...selection,startTime:start,
    eligibleExactRecordIds:['espn-point'],nextRoutes:[{sourceId:'bet_better',role:'PROVISIONAL_CANDIDATE',urls:[betBetterUrl('NFL')],
      collectionMode:'PUBLIC_LICENSED_MODEL_OUTPUT',automatedReuse:'CC_BY_4_0_WITH_ATTRIBUTION'}]}]}};
  const before=JSON.stringify(input),plan=buildEventResearchPlan(input),work=buildResearchWorkPlan(plan,{eventId:event.eventId});
  assert.equal(plan.counts.pending,0);assert.equal(work.completionState,'COMPLETE');
  assert.equal(plan.sourceCoverageReviewCounts.sourceEventRoutes,1);
  assert.equal(work.events[0].sourceReviewPending,true);
  assert.equal(work.events[0].forecastSources[0].sourceId,'bet_better');
  assert.match(work.events[0].nextAction,/Assess BET first/);
  assert.equal(JSON.stringify(input),before);
  const historical=structuredClone(input);historical.report.ts='2026-10-06T17:05:05Z';
  assert.equal(buildResearchWorkPlan(buildEventResearchPlan(historical)).events.length,0,'do not retroactively add this queue to historical decisions');
});

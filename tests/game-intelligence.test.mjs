import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {summarizeModels,loadCapture,validateCapture,bindIntelligence,buildGameIntelligence} from '../tools/game-intelligence.mjs';
import {parseCsv,parseNfelo,parseEspn,matchEspnEvent,collect,saveCapture,mergeCapture} from '../tools/collect-game-intelligence.mjs';
import {latestForecasts,scoreForecast} from '../tools/grade-game-intelligence.mjs';
const registry=JSON.parse(fs.readFileSync('research/forecast-source-registry.json'));
const at='2026-09-27T20:00:00Z',start='2026-09-28T00:20:00Z';
const event={eventId:'fixture',sport:'NFL',home:'Denver Broncos',away:'Los Angeles Rams',startTime:start};
const competitors=[{id:'7',homeAway:'home',team:{abbreviation:'DEN',displayName:event.home}},{id:'14',homeAway:'away',team:{abbreviation:'LAR',displayName:event.away}}];
const competition={id:'123',date:start,status:{type:{state:'pre'}},competitors};
const espn={id:'123',season:{year:2026},week:{number:3},competitions:[competition]};
const summary={header:{id:'123',competitions:[competition]},predictor:{homeTeam:{id:'7',gameProjection:'35.5'},awayTeam:{id:'14',gameProjection:'64.2'}}};
const csv='game_id,nfelo_home_probability_close,nfelo_home_line_close,home_line_close,nfelo_home_cover_prob_close,nfelo_home_push_prob_close,nfelo_home_loss_prob_close,nfelo_away_cover_prob_close,nfelo_away_push_prob_close,nfelo_away_loss_prob_close\n2026_03_LAR_DEN,0.40,3,3.5,0.55,0,0.45,0.45,0,0.55\n';
const fixture=()=>parseNfelo(parseCsv(csv),event,espn,at,registry);
test('exact schedule matching rejects reversed teams, different kickoffs and duplicates',()=>{
  assert.equal(matchEspnEvent(event,[espn]),espn);
  assert.equal(matchEspnEvent({...event,home:event.away,away:event.home},[espn]),null);
  assert.equal(matchEspnEvent({...event,startTime:'2026-09-28T01:00:00Z'},[espn]),null);
  assert.equal(matchEspnEvent(event,[espn,espn]),null);
  assert.equal(parseNfelo(parseCsv(csv),event,{...espn,week:{number:4}},at,registry).length,0);
});
test('published fields retain units, selected-side spread orientation and missing tie semantics',()=>{
  const rows=fixture();assert.equal(rows.length,4);
  assert.equal(rows.find(r=>r.side==='away').line,-3.5);
  assert.equal(rows.find(r=>r.kind==='PROJECTED_SPREAD').projection.homeSpread,3);
  const ml=rows.find(r=>r.marketDetail==='full_game_moneyline');assert.equal(ml.probabilityBasis,'UNKNOWN');
  assert.equal(ml.forecastAt,null);assert.equal(ml.observedAt,at);
  const p=parseEspn(summary,event,at,registry).records;
  assert.equal(p[0].probability,.355);assert.equal(p[1].probability,.642);
  assert.notEqual(p[0].probability+p[1].probability,1,'never normalize away the unexplained tie mass');
  const live=structuredClone(summary);live.header.competitions[0].status.type.state='in';
  assert.equal(parseEspn(live,event,at,registry).records.length,0);
});
test('descriptive ranges deduplicate model families and exclude stale observations',()=>{
  const base=fixture()[0],rows=[base,{...base,sourceId:'copy',probability:.7},{...base,sourceId:'other',modelFamily:'OTHER',probability:.5}];
  const result=summarizeModels(rows,at);assert.equal(result.consensus[0].families,2);
  assert.equal(result.consensus[0].median,.45);
  assert.equal(summarizeModels(rows,'2026-09-27T21:01:00Z').consensus.length,0);
});
test('invalid captures and future snapshots cannot enter a historical report',()=>{
  const capture={schema:1,collectedAt:at,records:fixture()};assert.equal(validateCapture(capture,registry),capture);
  assert.throws(()=>validateCapture({...capture,records:[{...capture.records[0],observedAt:start}]},registry),/Invalid/);
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'gi-snapshot-'));
  try{fs.mkdirSync(path.join(root,'data/game-intelligence'),{recursive:true});fs.writeFileSync(path.join(root,'data/game-intelligence/current.json'),JSON.stringify(capture));
    assert.equal(loadCapture(root,'2026-09-27T19:59:00Z'),null);assert.equal(loadCapture(root,at).collectedAt,at);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('shared collection reuses successful summaries without repeated model or odds calls',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'gi-collector-')),urls=[];
  try{
    fs.mkdirSync(path.join(root,'research'),{recursive:true});fs.writeFileSync(path.join(root,'research/forecast-source-registry.json'),JSON.stringify(registry));
    fs.mkdirSync(path.join(root,'data'),{recursive:true});fs.writeFileSync(path.join(root,'data/live-odds.json'),JSON.stringify({generatedAt:at,events:[{id:event.eventId,home:event.home,away:event.away,date:start,sport:{slug:'american-football'},league:{slug:'usa-nfl'}}]}));
    const fetchImpl=async url=>{urls.push(url);const text=url.includes('scoreboard')?JSON.stringify({events:[espn]}):url.includes('summary')?JSON.stringify(summary):csv;return {ok:true,status:200,text:async()=>text};};
    const first=await collect({root,at,fetchImpl});assert.equal(first.records.length,6);assert.equal(first.acquisition.requests,3);saveCapture(root,first);
    const second=await collect({root,at:'2026-09-27T20:05:00Z',fetchImpl});assert.equal(second.acquisition.requests,1);assert.deepEqual(second.records,first.records);
    assert.equal(urls.filter(u=>u.includes('oddsapi')).length,0);assert.equal(urls.filter(u=>u.includes('dimers')).length,0);
    const failure=async url=>url.includes('scoreboard')?fetchImpl(url):{ok:false,status:403};
    const third=await collect({root,at:'2026-09-27T21:10:00Z',fetchImpl:failure});assert.deepEqual(third.records,first.records);
    assert.ok(third.sources.some(s=>s.state==='UNAVAILABLE'));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('source scoring counts a game-market once and uses the last observed actual line',()=>{
  const first=fixture(),later=first.map(r=>({...r,observedAt:'2026-09-27T21:00:00Z',recordId:r.recordId+'-later'}));
  const rows=latestForecasts([{collectedAt:at,records:first},{collectedAt:'2026-09-27T21:00:00Z',records:later}],start);
  assert.equal(rows.length,2);assert.ok(rows.every(r=>r.recordId.endsWith('later')));
  const spread=rows.find(r=>r.marketDetail.includes('spread'));
  const result={eventId:event.eventId,startTime:start,state:'FINAL',homeScore:20,awayScore:23};
  const score=scoreForecast(spread,result);assert.equal(score.outcome,1);assert.ok(Math.abs(score.brier-.45**2)<1e-10);
  assert.equal(scoreForecast(rows.find(r=>r.marketDetail.includes('moneyline')),result).brier,null);
  assert.equal(scoreForecast(spread,{...result,startTime:at}).state,'PENDING');
});
test('source imports preserve unrelated observations and reject conflicting immutable identities',()=>{
  const first={schema:1,collectedAt:at,records:fixture(),facts:[],sources:[]};
  const extra=parseEspn(summary,event,at,registry).records;
  const merged=mergeCapture(first,{schema:1,collectedAt:at,records:extra},registry);
  assert.equal(merged.records.length,6);assert.equal(first.records.length,4);
  assert.throws(()=>mergeCapture(first,{schema:1,collectedAt:at,records:[{...first.records[0],probability:.99}]},registry),/Conflicting/);
  assert.throws(()=>mergeCapture(first,{schema:1,collectedAt:'2026-09-27T19:00:00Z',records:[]},registry),/older/);
});
test('game dossier separates native points, model observations, quotes and research guidance',()=>{
  const feed={events:[{id:event.eventId,home:event.home,away:event.away,date:start,sport:{slug:'american-football'},league:{slug:'usa-nfl'}}]};
  const selection={selectionId:'NFL|fixture|full_game_primary_spread|away',eventId:event.eventId,eventDate:start,sport:'NFL',marketDetail:'full_game_primary_spread',side:'away',quotes:[{bookmaker:'Bet365',marketKey:'spread',eventId:event.eventId,side:'away',line:3.5,priceDecimal:1.91,selectionKey:'fixture|spread|away|3.5|'}]};
  const sidecar={gameIntelligenceInputs:{records:fixture(),facts:[],internalModels:[],knowledge:[],sources:[]}};
  const result=buildGameIntelligence({report:{ts:at},sidecar,feed,universe:{selections:[selection]}});
  assert.equal(result.games[0].markets[0].quotes[0].line,-3.5);
  assert.equal(result.games[0].markets[0].quotes[0].forecasts[0].comparison,null,'unreviewed forecast creates no EV');
  assert.equal(result.counts.withExternalModels,1);assert.equal(result.decisionAuthority,false);
});

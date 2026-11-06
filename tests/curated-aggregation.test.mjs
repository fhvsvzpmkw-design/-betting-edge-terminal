import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parsePredictionTracker,parseBettingProsPublic,collectCuratedSources,TRACKER_ROUTES,BETTINGPROS_PUBLIC_PAGE} from '../tools/curated-sources.mjs';
import {aggregateCuratedOpinions,gradeCuratedSources,validCuratedRecord} from '../tools/curated-aggregation.mjs';
import {buildEventResearchPlan,buildResearchWorkPlan} from '../tools/event-research-plan.mjs';
import {bindIntelligence,buildGameIntelligence} from '../tools/game-intelligence.mjs';
const registry=JSON.parse(fs.readFileSync('research/forecast-source-registry.json'));
const at='2026-11-06T01:00:00Z',start='2026-11-06T03:00:00Z';
const event={eventId:'curation-fixture',sport:'NBA',home:'Golden State Warriors',away:'Miami Heat',startTime:start,
  sourceAliases:{home:['Golden State','GSW'],away:['Miami','MIA']}};
const csv='line,road,home,linesag,linesage,linemassey,linedunkel,linemoore,linedonc,lineespn,lineavg\n4,Miami,Golden State,3.96,88,6.8,1.155,6.98,4.2,1.77,42\n';
const html='<p>Games of 11/05/2026 Updated 3:10:39 PM</p>';
const projections=(extra={})=>parsePredictionTracker({csv,html,sport:'NBA',events:[event],observedAt:at,registry,...extra});
const markets=[{selectionId:'NBA|curation-fixture|full_game_primary_spread|home',marketDetail:'full_game_primary_spread',side:'home',
  quotes:[{book:'DraftKings',line:-3,priceDecimal:1.91,observedAt:at}]}];
function publicPick({side='GSW',line=-3,cost=-110,...extra}={}){
  const pick={id:42,sport:'NBA',status:'active',player_id:null,parlay:[],market_id:3,team_id:side,
    user:{name:'Sample Analyst',username:'sample-analyst'},line:{type:'spread',line,cost},label:'Fixture pick',sub_label:'Spread',
    event:{status:'created',scheduled:'2026-11-06 03:00:00',home:'GSW',visitor:'MIA',participants:[
      {id:'GSW',name:'Warriors',team:{city:'Golden State',abbreviation:'GSW'}},{id:'MIA',name:'Heat',team:{city:'Miami',abbreviation:'MIA'}}]},...extra};
  return `<script type="application/json" class="island-props">${JSON.stringify({showPickOfTheDay:true,pickOfTheDayPick:pick})}</script>`;
}
const expert=(extra={})=>parseBettingProsPublic({html:publicPick(extra),events:[event],observedAt:at})[0];

test('publisher CSV keeps six original systems, home-spread sign and original date without average or duplicate Sagarin votes',()=>{
  const rows=projections();assert.equal(rows.length,6);
  assert.equal(rows.find(r=>r.originName==='Sagarin').projection.homeSpread,-3.96);
  assert.equal(rows.filter(r=>r.originName==='Sagarin').length,1);
  assert.ok(rows.every(r=>r.sourceId==='prediction_tracker'&&r.publishedAt===null&&r.priceAmerican===undefined));
  assert.equal(rows.find(r=>r.originName==='DRatings').originId,registry.sources.dratings.modelFamily);
  assert.ok(rows.every(r=>r.sourceReferenceLine===-4&&r.publisherDate==='2026-11-05'));
});
test('tracker rejects old boards and duplicate matches and never loosely matches a similar school name',()=>{
  assert.throws(()=>projections({html:'Games of 10/20/2026 Updated 3 PM'}),/older/);
  assert.equal(projections({events:[{...event,startTime:'2026-11-07T03:00:00Z'}]}).length,0);
  assert.equal(projections({events:[event,{...event,eventId:'ambiguous'}]}).length,0);
  assert.throws(()=>projections({csv:csv+csv.split('\n')[1]+'\n'}),/Duplicate/);
  const college={...event,sport:'NCAAF',home:'Ohio State Buckeyes',away:'Akron Zips',sourceAliases:{home:['Ohio State'],away:['Akron']}};
  const result=parsePredictionTracker({csv:'line,home,road,linesag\n3,Ohio,Akron,-4\n',
    html:'Updated: Thursday, November 5, 2026 4:18:44 PM',sport:'NCAAF',events:[college],observedAt:at,registry});
  assert.equal(result.length,0);
});
test('public featured expert pick preserves author and quoted line/odds; offers, props, paid and started picks never enter',()=>{
  const row=expert();assert.ok(row);assert.equal(row.originName,'Sample Analyst');assert.equal(row.priceAmerican,-110);assert.equal(row.line,-3);
  assert.equal(row.publishedAt,null);assert.equal(row.probability,undefined);
  for(const change of [{is_premium:true},{is_locked:true},{player_id:'prop'},{parlay:[{}]},{event:{status:'inprogress'}},{status:'settled'},{sub_label:'First half spread'}])assert.equal(expert(change),undefined);
  assert.equal(parseBettingProsPublic({html:publicPick(),events:[{...event,startTime:'2026-11-06T03:05:00Z'}],observedAt:at}).length,0);
  assert.equal(parseBettingProsPublic({html:publicPick(),events:[event],observedAt:start}).length,0);
});
test('origin agreement groups syndicated sources once and retains conflicting opinions inside that origin',()=>{
  const rows=projections(),model={schema:1,...event,recordId:'direct-dratings',sourceId:'dratings',modelFamily:registry.sources.dratings.modelFamily,
    period:'FULL_GAME',marketDetail:'full_game_primary_spread',side:'home',line:-3,kind:'OUTCOME_PROBABILITY',probability:.4,
    probabilityBasis:'UNCONDITIONAL',pushProbability:0,settlement:{pushRule:'NO_PUSH',includesOvertime:true},
    observedAt:at,url:'https://www.dratings.com/',freshness:'RECENT_CAPTURE',limitation:'Fixture current applicability pending.'};
  const before=JSON.stringify({rows,model,markets});
  const result=aggregateCuratedOpinions({event,records:rows,models:[model],markets,asOf:at});
  assert.equal(result.groups[0].origins.length,6);
  assert.equal(result.groups[0].mixed,1);
  assert.equal(result.groups[0].origins.find(o=>o.originId===model.modelFamily).entries.length,2);
  assert.equal(result.decisionAuthority,false);assert.equal(result.groups[0].fair,undefined);
  assert.equal(JSON.stringify({rows,model,markets}),before);
});
test('expert agreement distinguishes original price, changed line, opposing pick and stale execution quote',()=>{
  const group=row=>aggregateCuratedOpinions({event,records:[row],markets,asOf:at}).groups[0];
  assert.equal(group(expert()).supporting,1);
  assert.equal(group(expert({line:-4})).context,1);
  assert.equal(group(expert({cost:100})).context,1);
  assert.equal(group(expert({cost:null})).context,1);
  assert.equal(group(expert({side:'MIA',line:3})).opposing,1);
  const stale=aggregateCuratedOpinions({event,records:[expert()],markets:[{...markets[0],quotes:[{...markets[0].quotes[0],observedAt:'2026-11-05T22:00:00Z'}]}],asOf:at});
  assert.equal(stale.groups[0].supporting,0);assert.equal(stale.groups[0].origins[0].entries[0].reason,'CURRENT_PRICE_REFRESH_REQUIRED');
});
test('source collection caches successful shared pulls and failure preserves original clocks',async()=>{
  const currentRegistry={...registry,curatedAggregation:{enabled:true,effectiveFrom:'2026-11-01T00:00:00Z'}};
  const urls=[],get=async url=>{urls.push(url);return url===TRACKER_ROUTES.NBA.csv?csv:url===BETTINGPROS_PUBLIC_PAGE?publicPick():html;};
  const first=await collectCuratedSources({events:[event],get,registry:currentRegistry,at});
  assert.equal(urls.length,3);assert.equal(first.picks.length,7);
  const prior={curatedPicks:first.picks,requestCache:first.cache};
  const second=await collectCuratedSources({events:[event],get,registry:currentRegistry,at:'2026-11-06T01:30:00Z',prior});
  assert.equal(urls.length,3);assert.deepEqual(second.picks,first.picks);
  const failed=await collectCuratedSources({events:[event],get:async()=>{throw Error('HTTP 503');},registry:currentRegistry,
    at:'2026-11-06T02:01:00Z',prior});
  assert.deepEqual(failed.picks,first.picks);assert.ok(failed.sources.every(s=>s.state==='UNAVAILABLE'));
});
test('source feedback freezes first saved pregame view, retains losing picks and separates point error from source-price ROI',()=>{
  const row=expert(),projection=projections()[0],later={...row,recordId:'later-pick',observedAt:'2026-11-06T01:30:00Z',line:7};
  const captures=[{collectedAt:at,curatedPicks:[row,projection]},{collectedAt:'2026-11-06T01:31:00Z',curatedPicks:[later,row]}];
  const results=[{eventId:event.eventId,startTime:start,state:'FINAL',homeScore:20,awayScore:24,verifiedAt:'2026-11-06T06:00:00Z'}];
  const tracked=gradeCuratedSources(captures,results,'2026-11-07T00:00:00Z');
  assert.equal(tracked.counts.observations,2);assert.equal(tracked.counts.graded,2);
  const pick=tracked.byOrigin.find(r=>r.kind==='EXPERT_PICK'),model=tracked.byOrigin.find(r=>r.kind==='MODEL_PROJECTION');
  assert.equal(pick.losses,1);assert.equal(pick.hypotheticalRoi,-1);assert.equal(model.hypotheticalRoi,null);
  assert.ok(Math.abs(model.meanAbsolutePointError-7.96)<1e-8);
  assert.equal(gradeCuratedSources([{collectedAt:'2026-11-06T05:00:00Z',curatedPicks:[row]}],results,'2026-11-07T00:00:00Z').counts.observations,0);
});
test('curation is in the shared dossier and work plan without creating a numerical forecast or a new completion gate',()=>{
  const rows=projections(),feed={generatedAt:at,events:[{id:event.eventId,home:event.home,away:event.away,date:start,
    sport:{slug:'basketball'},league:{slug:'usa-nba'}}]};
  const selection={selectionId:markets[0].selectionId,eventId:event.eventId,eventDate:start,sport:'NBA',marketDetail:'full_game_primary_spread',side:'home',
    quotes:[{book:'DraftKings',eventId:event.eventId,marketKey:'spread',side:'home',line:-3,priceDecimal:1.91,selectionKey:'curation-fixture|spread|home||-3'}]};
  const sidecar={gameIntelligenceInputs:{asOf:at,records:[],facts:[],curatedPicks:rows,internalModels:[],knowledge:[],sources:[]}};
  const candidates={selections:[{...selection,quotes:selection.quotes,reviewState:'UNFINISHED',missingResearch:['CURRENT_CANDIDATE_REVIEW_REQUIRED']}],shortlist:[]};
  const plan=buildEventResearchPlan({report:{ts:at},sidecar,universe:{selections:[selection]},candidateAssessment:candidates,forecastCoverage:{selections:[]}});
  assert.equal(plan.events[0].curatedResearch.originCount,6);
  const work=buildResearchWorkPlan(plan,{eventId:event.eventId});assert.equal(work.events[0].curatedResearch.records.length,6);
  const intelligence=buildGameIntelligence({report:{ts:at},sidecar,feed,universe:{selections:[selection]},eventResearchPlan:plan});
  assert.equal(intelligence.games[0].curatedAggregation.originCount,6);assert.equal(intelligence.decisionAuthority,false);
  assert.equal(sidecar.forecastEvidence,undefined,'curated picks did not become numerical forecast records');
});
test('current Market shows upcoming source views without quotes while report inventory stays unchanged',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'curated-board-'));
  try{
    fs.mkdirSync(path.join(root,'data/game-intelligence'),{recursive:true});
    fs.writeFileSync(path.join(root,'data/game-intelligence/current.json'),JSON.stringify({schema:1,collectedAt:at,
      records:[],curatedPicks:projections(),facts:[],sources:[]}));
    const feed={generatedAt:at,events:[{id:event.eventId,home:event.home,away:event.away,date:start,
      sport:{slug:'basketball'},league:{slug:'usa-nba'}}]},universe={selections:[]},report={ts:at};
    const issued={};bindIntelligence({root,report,sidecar:issued,feed,universe});
    assert.equal(issued.gameIntelligenceInputs.curatedPicks.length,0);
    assert.equal(buildGameIntelligence({report,sidecar:issued,feed,universe}).games.length,0);
    const current={};bindIntelligence({root,report,sidecar:current,feed,universe,liveBoard:true});
    const board=buildGameIntelligence({report,sidecar:current,feed,universe});
    assert.equal(board.games.length,1);assert.equal(board.games[0].sourceOnly,true);
    assert.equal(board.games[0].curatedAggregation.originCount,6);assert.deepEqual(board.games[0].markets,[]);
    assert.deepEqual(universe,{selections:[]});
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

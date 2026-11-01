import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseEspnGoalieContext,replaceEspnGoalieFacts} from '../tools/guy-goalie-context.mjs';
import {collect,saveCapture} from '../tools/collect-game-intelligence.mjs';

const event={eventId:'nhl-fixture',sport:'NHL',home:'Carolina Hurricanes',away:'Winnipeg Jets',startTime:'2026-11-01T18:00:00Z'};
const at='2026-11-01T17:00:00Z',url='https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=20261101&limit=300';
const probable=(id,name,status='expected',team='7')=>({name:'probableStartingGoalie',playerId:Number(id),
  athlete:{id,displayName:name,position:'G',team:{id:team}},
  status:{type:status,name:status==='confirmed'?'Confirmed':status==='out'?'Out':'Expected'}});
const competition=()=>({id:'401892624',date:event.startTime,status:{type:{state:'pre'}},competitors:[
  {id:'7',homeAway:'home',team:{id:'7',displayName:event.home},probables:[probable('100','Home Goalie','confirmed')]},
  {id:'28',homeAway:'away',team:{id:'28',displayName:event.away},probables:[probable('200','Away Goalie','expected','28')]}
]});
const parse=(value=competition(),extra={})=>parseEspnGoalieContext({competition:value,event,observedAt:at,url,...extra});

test('structured explicit confirmation and expected status retain their distinct source meaning',()=>{
  const facts=parse();assert.equal(facts.length,2);
  assert.equal(facts[0].details.status,'CONFIRMED');assert.equal(facts[1].details.status,'PROJECTED');
  assert.equal(facts[0].details.name,'Home Goalie');assert.equal(facts[0].details.team,event.home);
  assert.equal(facts[0].observedAt,at);assert.equal(facts[0].eventId,event.eventId);
  assert.equal(facts[0].sourceId,'espn');assert.match(facts[0].sourceField,/competitors\[0\]\.probables\[0\]/);
  assert.ok(facts.every(f=>f.details.forecastRepricedForGoalie===false));
});
test('a probable label or arbitrary starter flag never invents confirmation',()=>{
  const c=competition();delete c.competitors[0].probables[0].status;
  c.competitors[0].probables[0].starter=true;
  assert.equal(parse(c)[0].details.status,'PROJECTED');
});
test('contradictory confirmation labels become an explicit recheck instead of confirmation or clearance',()=>{
  for(const status of [{type:'confirmed',name:'Expected'},{type:'expected',name:'Confirmed'}]){
    const c=competition();c.competitors[0].probables[0].status=status;
    const fact=parse(c)[0];assert.equal(fact.details.status,'UNKNOWN');assert.equal(fact.details.name,null);
  }
});
test('exact teams, event clock and pregame boundaries prevent wrong-event goalie facts',()=>{
  for(const change of [
    c=>c.date='2026-11-01T19:00:00Z',
    c=>c.status.type.state='in',
    c=>c.competitors[0].team.displayName=event.away,
    c=>c.competitors[1].homeAway='home'
  ]){const c=competition();change(c);assert.deepEqual(parse(c),[]);}
  assert.deepEqual(parse(competition(),{observedAt:event.startTime}),[]);
  assert.deepEqual(parse(competition(),{observedAt:'invalid'}),[]);
  assert.deepEqual(parse(competition(),{event:{...event,sport:'NBA'}}),[]);
});
test('conflicting or unavailable source-listed starters require a recheck without a guessed name',()=>{
  const conflict=competition();conflict.competitors[0].probables.push(probable('101','Other Goalie'));
  assert.equal(parse(conflict)[0].details.status,'UNKNOWN');assert.equal(parse(conflict)[0].details.name,null);
  const out=competition();out.competitors[0].probables[0].status={type:'out',name:'Out'};
  assert.equal(parse(out)[0].details.status,'UNKNOWN');
});
test('wrong player-team/position data and missing fields never become named starters',()=>{
  const c=competition();c.competitors[0].probables[0].athlete.team.id='28';
  c.competitors[1].probables[0].athlete.position='C';
  assert.deepEqual(parse(c),[]);
  const absent=competition();absent.competitors.forEach(c=>delete c.probables);
  assert.deepEqual(parse(absent),[]);
});
test('a newer named goalie replaces that event-side only; missing observations do not refresh old clocks',()=>{
  const old=parse(),changed=competition();changed.competitors[0].probables[0]=probable('101','New Home Goalie');
  const next=parse(changed,{observedAt:'2026-11-01T17:05:00Z'});
  const updated=replaceEspnGoalieFacts([...old,{...old[0],eventId:'other'}],event,next);
  assert.equal(updated.length,3);assert.equal(updated.find(f=>f.eventId===event.eventId&&f.details.side==='home').details.name,'New Home Goalie');
  assert.deepEqual(replaceEspnGoalieFacts(old,event,[]),old);
  assert.deepEqual(replaceEspnGoalieFacts(next,event,old),next,'older source data cannot replace a newer named starter');
});

function rootFixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'guy-goalie-collection-'));
  const source=JSON.parse(fs.readFileSync('research/forecast-source-registry.json'));
  fs.mkdirSync(path.join(root,'research'),{recursive:true});
  fs.writeFileSync(path.join(root,'research/forecast-source-registry.json'),JSON.stringify({schema:1,sources:{espn:source.sources.espn}}));
  fs.mkdirSync(path.join(root,'data'),{recursive:true});
  fs.writeFileSync(path.join(root,'data/live-odds.json'),JSON.stringify({generatedAt:at,events:[{id:event.eventId,
    home:event.home,away:event.away,date:event.startTime,sport:{slug:'ice-hockey'},league:{slug:'usa-nhl'}}]}));
  return root;
}
function fetchFixture({changed=false,summaryFailure=false}={}){
  const urls=[],c=competition();if(changed)c.competitors[0].probables[0]=probable('101','New Home Goalie');
  return {urls,fetchImpl:async url=>{
    urls.push(url);
    if(url.includes('/scoreboard?'))return {ok:true,status:200,text:async()=>JSON.stringify({events:[{id:c.id,competitions:[c]}]})};
    if(url.includes('/summary?'))return summaryFailure?{ok:false,status:503}:{ok:true,status:200,text:async()=>JSON.stringify({header:{id:c.id,competitions:[{...c,competitors:c.competitors.map(({probables,...team})=>team)}]}})};
    throw Error('Unexpected request '+url);
  }};
}
test('cached summaries still receive fresh scoreboard goalie facts with no extra requests',async()=>{
  const root=rootFixture();try{
    const firstFetch=fetchFixture(),first=await collect({root,at,fetchImpl:firstFetch.fetchImpl});saveCapture(root,first);
    assert.equal(first.acquisition.requests,2);assert.equal(first.facts.filter(f=>f.kind==='STARTING_GOALIE').length,2);
    const secondFetch=fetchFixture({changed:true}),second=await collect({root,at:'2026-11-01T17:05:00Z',fetchImpl:secondFetch.fetchImpl});
    assert.equal(second.acquisition.requests,1);assert.equal(second.acquisition.oddsApiRequests,0);
    assert.ok(secondFetch.urls.every(u=>u.includes('/scoreboard?')));
    const facts=second.facts.filter(f=>f.kind==='STARTING_GOALIE');assert.equal(facts.length,2);
    assert.equal(facts.find(f=>f.details.side==='home').details.name,'New Home Goalie');
    assert.ok(Date.parse(facts[0].observedAt)>Date.parse(first.facts.find(f=>f.kind==='STARTING_GOALIE').observedAt));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('a failed summary does not discard independently captured exact scoreboard goalie context',async()=>{
  const root=rootFixture();try{
    const f=fetchFixture({summaryFailure:true}),capture=await collect({root,at,fetchImpl:f.fetchImpl});
    assert.equal(capture.facts.filter(f=>f.kind==='STARTING_GOALIE').length,2);
    assert.ok(capture.sources.some(s=>s.state==='UNAVAILABLE'&&s.reason==='HTTP 503'));
    assert.equal(capture.acquisition.requests,2);assert.equal(capture.acquisition.oddsApiRequests,0);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

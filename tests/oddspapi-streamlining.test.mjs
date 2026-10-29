import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {reconcileBudgetState,recordBudgetSpend} from '../tools/oddspapi-budget.mjs';
import {selectRelevantTournaments,categoryKey} from '../tools/oddspapi-observer.mjs';
import {exactMarketReference} from '../tools/market-price-assessment.mjs';
import {validateObserver} from '../tools/pinnacle-sharp-benchmark.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'oddspapi-streamline-'));
const stamp='2026-10-31T18:15:00-07:00';
const definitions=[['151','Winner (incl. overtime and penalties)',0],['15228','Handicap (incl. overtime and penalties)',-1.5],['15178','Total (incl. overtime and penalties)',6.5]].map(([marketId,marketName,handicap])=>({marketId,marketName,handicap,sportId:15,playerProp:false,period:'result',marketLength:2}));
const ids={NBA:132,NFL:31,NFL_PRESEASON:233,CFL:790,NCAAF:27653,BOXING:24327,MLB:109,WNBA:486,NHL:234};
const sports={NBA:'basketball',NFL:'american-football',NFL_PRESEASON:'american-football',CFL:'american-football',NCAAF:'american-football',BOXING:'boxing',MLB:'baseball',WNBA:'basketball',NHL:'ice-hockey'};
function primary(now=stamp,keys=['NHL','NBA','NFL','NCAAF','MLB','CFL','WNBA','BOXING']){
  return {quoteObservationVersion:1,generatedAt:now,bookmakers:['FanDuel','DraftKings'],events:keys.map(key=>({id:String(ids[key]),home:'Home '+ids[key],away:'Away '+ids[key],date:new Date(Date.parse(now)+3600000).toISOString(),sport:{slug:sports[key]},league:{name:key==='NFL_PRESEASON'?'NFL Preseason':key},bookmakers:{FanDuel:[{name:'ML',observedAt:now,odds:[{home:2,away:1.9}]}]}}))};
}
const write=(dir,file,value)=>{const target=path.join(dir,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(value,null,2)+'\n');};
const read=(dir,file)=>JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
function known(count,now=stamp){const state=reconcileBudgetState({requestLimit:250,requestCount:0,now,subscriptionId:'active'});state.providerObservedCount=count;state.estimatedRequestCount=count;return state;}
function warm(now=stamp){return {schema:1,updatedAt:now,marketDefinitionsObservedAt:now,marketDefinitions:definitions};}
function scenario(name,{now=stamp,count=0,cache=true,state=known(count,now),keys,mode='ok'}={}){
  const dir=path.join(temp,name);fs.mkdirSync(dir);write(dir,'data/live-odds.json',primary(now,keys));
  if(cache)write(dir,'data/oddspapi-market-cache.json',warm(now));
  if(state)write(dir,'data/oddspapi-budget-state.json',state);
  return {dir,now,count,mode};
}
function run(config,{now=config.now,count=config.count,mode=config.mode,slot='5'}={}){
  execFileSync(process.execPath,['--import',hook,path.join(root,'tools/oddspapi-observer.mjs')],{cwd:config.dir,env:{...process.env,ODDSPAPI_API_KEY:'FAKE_TEST_KEY',ODDSPAPI_CANONICAL_SLOT:slot,TEST_NOW:now,TEST_COUNT:String(count),TEST_MODE:mode},stdio:'pipe'});
  return {observer:read(config.dir,'data/oddspapi-observer.json'),state:read(config.dir,'data/oddspapi-budget-state.json'),calls:read(config.dir,'calls.json')};
}
const hook=path.join(temp,'transport.mjs');
try{
  fs.writeFileSync(hook,`
    import fs from 'node:fs';
    const NativeDate=Date,base=NativeDate.parse(process.env.TEST_NOW);let elapsed=0;
    globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[base+elapsed]))}static now(){return base+elapsed}};
    const nativeTimeout=setTimeout;globalThis.setTimeout=(fn,ms,...args)=>nativeTimeout(fn,0,...args);
    const definitions=${JSON.stringify(definitions)},calls=[];
    const primary=JSON.parse(fs.readFileSync('data/live-odds.json','utf8'));
    const changed=new NativeDate(base-2*3600000).toISOString();
    function book(){const market=(suffix,sides,line=null)=>({marketActive:true,bookmakerMarketId:'line/2/0/1/2/0/'+suffix,outcomes:Object.fromEntries(sides.map((side,i)=>[String(i+1),{players:{'0':{price:i?2.2:1.8,priceAmerican:i?'+120':'-125',active:true,mainLine:true,bookmakerOutcomeId:line===null?side:line+'/'+side,bookmakerChangedAt:changed}}}]))});return {bookmakerIsActive:true,suspended:false,markets:{151:market('moneyline',['home','away']),15228:market('spreads',['home','away'],-1.5),15178:market('totals',['over','under'],6.5)}};}
    globalThis.fetch=async input=>{
      const u=new URL(input),endpoint=u.pathname.split('/').at(-1),ids=(u.searchParams.get('tournamentIds')||'').split(',').filter(Boolean).map(Number);
      calls.push({endpoint,ids});fs.writeFileSync('calls.json',JSON.stringify(calls));elapsed+=1000;
      if(endpoint==='account')return {ok:true,text:async()=>JSON.stringify({current_subscription_id:'active',subscriptions:[{subscription_id:'active',request_limit:250,request_count:Number(process.env.TEST_COUNT)}]})};
      if(endpoint==='markets')return process.env.TEST_MODE==='catalogue-error'?{ok:false,status:503,text:async()=>'catalogue offline'}:{ok:true,text:async()=>JSON.stringify(definitions)};
      if(endpoint==='odds-by-tournaments'){
        if(process.env.TEST_MODE==='odds-error')return {ok:false,status:503,text:async()=>'odds offline'};
        const fixtures=ids.map(id=>{const event=primary.events.find(e=>Number(e.id)===id);return {fixtureId:'fixture-'+id,tournamentId:id,sportId:id===234?15:3,startTime:event?.date||new NativeDate(base+3600000).toISOString(),participant1Name:'Home '+id,participant2Name:'Away '+id,bookmakerOdds:{pinnacle:book()}}});
        return {ok:true,text:async()=>JSON.stringify(fixtures)};
      }
      throw Error('Unexpected endpoint '+endpoint);
    };
  `);
  const selection=selectRelevantTournaments(primary(),Date.parse(stamp));
  assert.deepEqual(selection.selected.slice(0,2).map(t=>t.key),['NHL','NBA']);
  assert.equal(selection.selected.some(t=>t.key==='NFL_PRESEASON'),false);
  assert.equal(selection.selected.length,8);
  const extras=primary(stamp,['NFL_PRESEASON']);
  assert.equal(categoryKey(extras.events[0]),'NFL_PRESEASON');
  assert.ok(selectRelevantTournaments(extras,Date.parse(stamp)).selected.some(t=>t.key==='NFL_PRESEASON'));
  const excluded=primary(stamp,['NHL','NBA','MLB','WNBA']);
  excluded.events[0].date=new Date(Date.parse(stamp)-60000).toISOString();
  excluded.events[1].bookmakers={};
  excluded.events[2].bookmakers.FanDuel[0].observedAt=new Date(Date.parse(stamp)-31*60000).toISOString();
  excluded.events[3].bookmakers.FanDuel[0].suspended=true;
  assert.deepEqual(selectRelevantTournaments(excluded,Date.parse(stamp)).selected.map(t=>t.key),['NFL'],'completed, unpriced, stale and suspended competitions do not cost requests');
  for(const mutate of [event=>event.bookmakers.FanDuel[0].status='suspended',event=>delete event.bookmakers.FanDuel[0].odds[0].away,event=>event.bookmakers.FanDuel[0].odds[0].state='closed']){
    const unusable=primary(stamp,['NHL']);mutate(unusable.events[0]);
    assert.deepEqual(selectRelevantTournaments(unusable,Date.parse(stamp)).selected.map(t=>t.key),['NFL'],'one-sided and explicitly unavailable primary markets cannot activate a tournament');
  }


  // A seven-call day allows one remaining fresh base batch, not a stale reuse.
  const limited=recordBudgetSpend(known(20),{requests:6,oddsRequests:6,extraBatches:2,now:stamp});
  const partial=scenario('partial',{count:26,state:limited});
  write(partial.dir,'data/oddspapi-observer.json',{generatedAt:'2026-10-01T00:00:00Z',fixtures:[{fixtureId:'old-price'}]});
  const result=run(partial),o=result.observer;
  assert.equal(o.status,'ok');assert.equal(o.coverageStatus,'PARTIAL_BUDGET');assert.equal(o.acquisitionComplete,false);
  assert.equal(result.calls.filter(c=>c.endpoint==='odds-by-tournaments').length,1);
  assert.deepEqual(result.calls.find(c=>c.endpoint==='odds-by-tournaments').ids.slice(0,2),[234,132]);
  assert.equal(o.diagnostics.deferredTournaments.length,3);
  assert.deepEqual(o.tournaments.map(t=>t.id),result.calls.find(c=>c.endpoint==='odds-by-tournaments').ids,'declared acquisition scope only includes actually requested tournaments');
  assert.ok(o.fixtures.every(f=>f.fixtureId!=='old-price'));
  assert.equal(o.budget.todayUsed,7);assert.equal(o.budget.usedThisMonth,27);
  assert.equal(validateObserver(o,{asOf:o.generatedAt}).ok,true,'fresh permitted subset retains exact benchmark validation');
  const feed=read(partial.dir,'data/live-odds.json'),report={ts:o.generatedAt};
  assert.ok(exactMarketReference(report,{eventId:'234',eventDate:feed.events.find(e=>e.id==='234').date,marketKey:'ml',side:'home',line:null},o));
  const deferred=o.diagnostics.deferredTournaments[0];
  assert.throws(()=>exactMarketReference(report,{eventId:String(deferred.id),eventDate:feed.events.find(e=>Number(e.id)===deferred.id).date,marketKey:'ml',side:'home',line:null},o),'deferred competitions never gain an invented fresh reference');

  const failedCatalogue=scenario('catalogue-failure',{cache:false});
  const failure=run(failedCatalogue,{mode:'catalogue-error'});
  assert.equal(failure.observer.diagnostics.discoveryRequests,1);
  assert.equal(failure.observer.diagnostics.billableRequestsThisRun,3,'failed metadata plus two odds calls are all charged');
  assert.equal(failure.state.estimatedRequestCount,3);assert.equal(failure.state.todayUsed,3);
  assert.equal(failure.observer.coverageStatus,'PARTIAL_SOURCE');
  assert.ok(failure.observer.diagnostics.skippedCategories.some(r=>r.category==='NHL'));
  assert.ok(failure.observer.fixtures.every(f=>f.sportId!==15),'unverified settlement definitions cannot qualify NHL');

  const failedOdds=scenario('odds-failure');
  const oddsFailure=run(failedOdds,{mode:'odds-error'});
  assert.equal(oddsFailure.observer.status,'odds-error');assert.equal(oddsFailure.state.estimatedRequestCount,1);
  assert.equal(oddsFailure.observer.diagnostics.billableRequestsThisRun,1);
  assert.deepEqual(oddsFailure.observer.fixtures,[]);

  // Catalogue lives independently of blocked/error observers and survives reset.
  const resetCase=scenario('cache-reset',{count:245});
  const before=fs.readFileSync(path.join(resetCase.dir,'data/oddspapi-market-cache.json'),'utf8');
  const blocked=run(resetCase);
  assert.equal(blocked.observer.status,'quota-reserve-protected');assert.equal(blocked.calls.length,1);
  assert.equal(fs.readFileSync(path.join(resetCase.dir,'data/oddspapi-market-cache.json'),'utf8'),before);
  const resetNow='2026-11-01T06:00:00-08:00';write(resetCase.dir,'data/live-odds.json',primary(resetNow));
  const resumed=run(resetCase,{now:resetNow,count:0,slot:'1'});
  assert.equal(resumed.observer.status,'ok');assert.equal(resumed.observer.budget.providerCounterReset,true);
  assert.equal(resumed.calls.filter(c=>c.endpoint==='markets').length,0,'November reset uses surviving valid catalogue');
  assert.equal(resumed.state.estimatedRequestCount,2);assert.equal(resumed.state.todayUsed,2);
  assert.ok(resumed.observer.fixtures.length>0);
  console.log('ODDSPAPI STREAMLINING: active slate and core priority, partial fresh references, all charged errors, durable catalogue and November reset PASS; no live requests.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {AUTHORITY,QUALIFIED,qualifyMarket,annotatePinnacle,validateObserver} from '../tools/pinnacle-sharp-benchmark.mjs';
import {summarizePinnacle} from '../tools/oddspapi-observer.mjs';
import {exactMarketReference,validateBoundMarketAssessment} from '../tools/market-price-assessment.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const changed='2026-09-08T21:20:00.000Z',observed='2026-09-08T22:08:30.000Z',generated='2026-09-08T22:08:35.000Z';
function rawBook(){return {bookmakerIsActive:true,suspended:false,markets:{131:{marketActive:true,bookmakerMarketId:'line/1/2/3/4/0/moneyline',outcomes:{home:{players:{0:{bookmakerOutcomeId:'home',bookmakerChangedAt:changed,changedAt:changed,price:2,priceAmerican:'+100',active:true,mainLine:true,limit:9000}}},away:{players:{0:{bookmakerOutcomeId:'away',bookmakerChangedAt:changed,changedAt:changed,price:1.92,priceAmerican:'-109',active:true,mainLine:true,limit:9000}}}}}}};}
const match={eventId:'1'},book=summarizePinnacle(rawBook(),observed),market=book.markets[0];
const args={market,generatedAt:generated,primaryMatch:match,quoteObservationVersion:1};
const qualified=qualifyMarket(args);
assert.equal(qualified.state,QUALIFIED,'fresh observations qualify unchanged prices older than 30 minutes');
assert.equal(qualified.freshnessClock,'observedAt');
assert.equal(qualified.maxQuoteAgeMinutes,0.08);
for(const row of qualified.pairedOutcomes){assert.equal(row.quoteChangedAt,changed);assert.equal(row.quoteObservedAt,observed);}
assert.equal(qualifyMarket({...args,quoteObservationVersion:undefined}).reason,'QUOTE_STALE','unmarked historical snapshots keep change-time semantics');
const currentLegacy=structuredClone(market);
currentLegacy.outcomes.forEach(o=>o.players.forEach(q=>{q.bookmakerChangedAt=observed;delete q.observedAt;}));
const legacy=qualifyMarket({...args,market:currentLegacy,quoteObservationVersion:undefined});
assert.equal(legacy.state,QUALIFIED);
assert.equal(legacy.quoteObservationVersion,undefined);
assert.equal(legacy.pairedOutcomes[0].quoteObservedAt,undefined,'legacy benchmark shape is unchanged');
for(const [stamp,reason] of [[undefined,'QUOTE_OBSERVATION_INVALID'],['bad','QUOTE_OBSERVATION_INVALID'],['2026-09-08','QUOTE_OBSERVATION_INVALID'],[123,'QUOTE_OBSERVATION_INVALID'],['2026-09-08T22:08:35.001Z','QUOTE_OBSERVATION_FUTURE'],['2026-09-08T21:38:34.999Z','QUOTE_STALE']]){
  const copy=structuredClone(market);copy.outcomes[0].players[0].observedAt=stamp;
  copy.outcomes[0].players[0].bookmakerChangedAt=observed;
  assert.equal(qualifyMarket({...args,market:copy}).reason,reason,'invalid observation cannot fall back to a recent change');
}
const boundary=structuredClone(market);boundary.outcomes[0].players[0].observedAt='2026-09-08T21:38:35.000Z';
assert.equal(qualifyMarket({...args,market:boundary}).state,QUALIFIED,'exactly 30 minutes still qualifies');
for(const version of [0,2,null,'1'])assert.equal(qualifyMarket({...args,quoteObservationVersion:version}).reason,'QUOTE_OBSERVATION_VERSION_UNSUPPORTED');
for(const [extra,reason] of [[{primaryMatch:null},'PRIMARY_EVENT_MATCH_REQUIRED'],[{bookmakerIsActive:false},'BOOKMAKER_INACTIVE'],[{suspended:true},'BOOKMAKER_SUSPENDED']])assert.equal(qualifyMarket({...args,...extra}).reason,reason);
for(const [mutate,reason] of [[m=>m.marketActive=false,'MARKET_INACTIVE'],[m=>m.outcomes[0].players[0].active=false,'QUOTE_INACTIVE'],[m=>m.outcomes.pop(),'COMPLETE_TWO_WAY_MAIN_LINE_REQUIRED'],[m=>m.outcomes[0].players[0].mainLine=false,'COMPLETE_TWO_WAY_MAIN_LINE_REQUIRED']]){
  const copy=structuredClone(market);mutate(copy);assert.equal(qualifyMarket({...args,market:copy}).reason,reason);
}
const laterBook=summarizePinnacle(rawBook(),'2026-09-08T22:08:34.000Z');
const later=qualifyMarket({...args,market:laterBook.markets[0]});
assert.deepEqual(later.pairedOutcomes.map(({quoteObservedAt,...r})=>r),qualified.pairedOutcomes.map(({quoteObservedAt,...r})=>r),'reobservation preserves price, reference and movement timestamps');

const observer={schema:3,quoteObservationVersion:1,collectionStartedAt:'2026-09-08T22:08:00.000Z',generatedAt:generated,mode:'official-sharp-benchmark',status:'ok',authoritative:true,authorityScope:'sharp-market-benchmark-only',benchmarkAuthority:AUTHORITY,executionAuthority:false,fixtures:[{fixtureId:'fixture1',startTime:'2026-09-08T23:10:00Z',primaryMatch:match,pinnacle:structuredClone(book)}]};
function annotate(o){for(const f of o.fixtures)annotatePinnacle(f.pinnacle,{generatedAt:o.generatedAt,primaryMatch:f.primaryMatch,quoteObservationVersion:o.quoteObservationVersion});}
annotate(observer);
assert.equal(validateObserver(observer,{asOf:'2026-09-08T22:24:00Z'}).ok,true);
assert.equal(validateObserver(observer,{asOf:'2026-09-08T23:24:00Z'}).ok,false,'75-minute observer limit remains');
const outOfCollection=structuredClone(observer);outOfCollection.fixtures[0].pinnacle.markets[0].outcomes[0].players[0].observedAt='2026-09-08T22:07:59Z';annotate(outOfCollection);
assert.equal(validateObserver(outOfCollection,{asOf:generated}).ok,false,'an earlier copied quote cannot be restamped by collection completion');
const report={ts:'2026-09-08T15:24:00-07:00',recs:[]};
const quote={eventId:'1',eventDate:'2026-09-08T23:10:00Z',marketKey:'ml',side:'home',line:null};
const reference=exactMarketReference(report,quote,observer);
assert.equal(reference.selected.quoteObservedAt,observed,'report resolver uses observer version');
const rec={feed:quote,pinnacleBenchmark:{...reference.selected,price:reference.selected.priceAmerican,pairedPrice:reference.opposite.priceAmerican},marketAssessment:{referenceGeneratedAt:generated}};
validateBoundMarketAssessment(report,rec,observer);
assert.throws(()=>validateBoundMarketAssessment(report,{...rec,pinnacleBenchmark:{...rec.pinnacleBenchmark,quoteObservedAt:changed}},observer),/quoteObservedAt/);
const unmarked=structuredClone(observer);delete unmarked.quoteObservationVersion;annotate(unmarked);
assert.equal(validateObserver(unmarked,{asOf:generated}).ok,true,'historical rejected-pair annotation still reproduces');
assert.throws(()=>exactMarketReference(report,quote,unmarked),/qualified exact/);

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pinnacle-observation-'));
try{
  // Exercise the actual collector with a fake HTTP transport; no API requests.
  const hook=path.join(temp,'mock-http.mjs');
  fs.writeFileSync(hook,`
    import fs from 'node:fs';
    const NativeDate=Date,base=NativeDate.parse('${generated}');let elapsed=0;
    globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[base+elapsed]))}static now(){return base+elapsed}};
    const nativeTimeout=setTimeout;globalThis.setTimeout=(fn,ms,...args)=>nativeTimeout(fn,0,...args);
    const rawBook=${rawBook.toString()};const changed='${changed}';let calls=[];
    globalThis.fetch=async input=>{
      const u=new URL(input),ids=String(u.searchParams.get('tournamentIds')||'').split(',').filter(Boolean).map(Number);
      calls.push({path:u.pathname,ids});fs.writeFileSync('calls.json',JSON.stringify(calls));elapsed+=5000;
      if(u.pathname.endsWith('/account'))return {ok:true,text:async()=>JSON.stringify({current_subscription_id:'1',subscriptions:[{subscription_id:'1',request_limit:1000,request_count:10}]})};
      if(!u.pathname.endsWith('/odds-by-tournaments'))throw Error('unexpected network request');
      const scenario=process.env.PINNACLE_TEST_SCENARIO;
      if(scenario==='failed')return {ok:false,status:503,text:async()=>'unavailable'};
      if(scenario==='malformed')return {ok:true,text:async()=>'{broken'};
      if(scenario==='shape')return {ok:true,text:async()=>JSON.stringify({error:'not fixtures'})};
      let fixtures=ids.map(id=>({fixtureId:'id-'+id,tournamentId:id,sportId:3,startTime:'2026-09-08T23:10:00Z',participant1Name:'Home '+id,participant2Name:'Away '+id,bookmakerOdds:{pinnacle:rawBook()}}));
      if(scenario==='mismatch')fixtures[0].tournamentId=999999;
      if(scenario==='missing-side')delete fixtures[0].bookmakerOdds.pinnacle.markets[131].outcomes.away;
      if(scenario==='suspended')fixtures[0].bookmakerOdds.pinnacle.suspended=true;
      if(scenario==='empty-book')fixtures[0].bookmakerOdds={};
      if(scenario==='replacement')fixtures.push({...fixtures[0],bookmakerOdds:{}});
      if(scenario==='empty')fixtures=[];
      return {ok:true,text:async()=>JSON.stringify(fixtures)};
    };
  `);
  const categories=[['NBA',132],['NFL',31],['NFL_PRESEASON',233],['CFL',790],['NCAAF',27653],['BOXING',24327],['MLB',109],['WNBA',486]];
  const primary={events:categories.map(([key,id])=>({id:String(id),home:'Home '+id,away:'Away '+id,date:'2026-09-08T23:10:00Z',sport:{slug:key==='BOXING'?'boxing':key==='NCAAF'?'american-football':'baseball'},league:{name:key==='NFL_PRESEASON'?'NFL':key}}))};
  fs.mkdirSync(path.join(temp,'data'));fs.writeFileSync(path.join(temp,'data/live-odds.json'),JSON.stringify(primary));
  let collected;
  for(const scenario of ['success','failed','malformed','shape','mismatch','missing-side','suspended','empty-book','replacement','empty']){
    fs.writeFileSync(path.join(temp,'data/oddspapi-observer.json'),JSON.stringify({status:'ok',fixtures:[{fixtureId:'old-cache'}]}));
    execFileSync(process.execPath,['--import',hook,path.join(root,'tools/oddspapi-observer.mjs')],{cwd:temp,env:{...process.env,ODDSPAPI_API_KEY:'TEST-NOT-A-REAL-KEY',PINNACLE_TEST_SCENARIO:scenario},stdio:'pipe'});
    const o=JSON.parse(fs.readFileSync(path.join(temp,'data/oddspapi-observer.json')));
    assert.ok(!o.fixtures.some(f=>f.fixtureId==='old-cache'),'saved snapshots are never relabeled as observed');
    if(['failed','malformed','shape','mismatch'].includes(scenario)){assert.equal(o.status,'odds-error');assert.equal(o.fixtures.length,0);continue;}
    assert.equal(o.status,'ok');assert.equal(o.quoteObservationVersion,1);
    assert.equal(validateObserver(o,{asOf:o.generatedAt}).ok,true,scenario+' observer verifies');
    const calls=JSON.parse(fs.readFileSync(path.join(temp,'calls.json'))).filter(c=>c.ids.length);
    assert.equal(calls.length,2);assert.ok(calls.every(c=>c.ids.length<=5));
    assert.equal(o.diagnostics.oddsRequests,2);assert.equal(o.quota.protectedReserve,25);
    if(scenario==='success'){
      collected=o;assert.equal(o.fixtures.length,8);
      const times=new Set(o.fixtures.flatMap(f=>f.pinnacle.markets.flatMap(m=>m.outcomes.flatMap(v=>v.players.map(q=>q.observedAt)))));
      assert.equal(times.size,2,'each HTTP batch keeps its own receipt timestamp');
      assert.ok([...times].every(t=>t>o.collectionStartedAt&&t<=o.generatedAt));
      assert.ok(o.fixtures.every(f=>f.pinnacle.markets[0].benchmark.state===QUALIFIED));
    }else if(['empty-book','replacement'].includes(scenario))assert.equal(o.fixtures.length,6,'missing latest book cannot revive an older copy');
    else if(scenario==='empty')assert.equal(o.fixtures.length,0);
    else assert.equal(o.fixtures[0].pinnacle.markets[0].benchmark.reason,scenario==='suspended'?'BOOKMAKER_SUSPENDED':'COMPLETE_TWO_WAY_MAIN_LINE_REQUIRED');
  }
  // Publication validates the isolated bound observer, never today's live file.
  fs.mkdirSync(path.join(temp,'core'));
  for(const file of ['core/core-v1.4-production.json','core/pinnacle-sharp-benchmark-v1.4.json'])fs.copyFileSync(path.join(root,file),path.join(temp,file));
  const raw=Buffer.from(JSON.stringify(collected));fs.writeFileSync(path.join(temp,'data/oddspapi-observer.json'),raw);
  const sha=crypto.createHash('sha1').update(Buffer.from('blob '+raw.length+'\0')).update(raw).digest('hex');
  const policy=JSON.parse(fs.readFileSync(path.join(temp,'core/core-v1.4-production.json'))).sharpMarketBenchmark;
  const provenance={pinnacleStatus:'ok',pinnacleObserverBlobSha:sha,pinnacleBenchmarkPolicyPath:policy.policyPath,pinnacleBenchmarkPolicyBlobSha:policy.policyBlobSha,pinnacleBenchmarkPolicyId:policy.policyId,pinnacleBenchmarkAuthority:AUTHORITY,pinnacleBenchmarkExecutionAuthority:false};
  fs.writeFileSync(path.join(temp,'report.json'),JSON.stringify(report));fs.writeFileSync(path.join(temp,'sidecar.json'),JSON.stringify({provenance}));
  const gateArgs=[path.join(root,'tools/pinnacle-benchmark-publication-gate.mjs'),'validate','--root',temp,'--report',path.join(temp,'report.json'),'--sidecar',path.join(temp,'sidecar.json')];
  execFileSync(process.execPath,gateArgs,{cwd:root,stdio:'pipe'});
  fs.appendFileSync(path.join(temp,'data/oddspapi-observer.json'),' ');
  assert.throws(()=>execFileSync(process.execPath,gateArgs,{cwd:root,stdio:'pipe'}),/Pinnacle observer SHA mismatch/,'hash binding remains enforced');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log('PINNACLE OBSERVATION: PASS // exact response times, old unchanged prices, invalid/stale observations, inactive/missing pairs, batch scope, failures, legacy replay and bound publication');

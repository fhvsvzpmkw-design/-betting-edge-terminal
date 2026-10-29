import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {reconcileBudgetState} from '../tools/oddspapi-budget.mjs';

// Exercise the production collector with a frozen month-end clock and fake HTTP.
// A warm catalogue makes the exact reserve boundary independent of metadata cost.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'oddspapi-quota-'));
const now='2026-10-31T18:15:00-07:00';
const definitions=[{marketId:'151',sportId:15,playerProp:false,period:'result',marketLength:2,marketName:'Winner (incl. overtime and penalties)'}];
try{
  fs.mkdirSync(path.join(temp,'data'));
  const sports={NBA:'basketball',NHL:'ice-hockey',NFL:'american-football',NCAAF:'american-football',CFL:'american-football',MLB:'baseball'};
  fs.writeFileSync(path.join(temp,'data/live-odds.json'),JSON.stringify({quoteObservationVersion:1,generatedAt:now,bookmakers:['FanDuel','DraftKings'],events:Object.entries(sports).map(([name,sport],i)=>({id:String(i),league:{name},sport:{slug:sport},date:'2026-11-01T04:00:00Z',bookmakers:{DraftKings:[{name:'ML',observedAt:now,odds:[{home:2,away:1.9}]}]}}))}));
  fs.writeFileSync(path.join(temp,'data/oddspapi-market-cache.json'),JSON.stringify({schema:1,updatedAt:now,marketDefinitionsObservedAt:now,marketDefinitions:definitions}));
  const hook=path.join(temp,'transport.mjs');
  fs.writeFileSync(hook,`
    import fs from 'node:fs';
    const NativeDate=Date,base=NativeDate.parse('${now}');let elapsed=0;
    globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[base+elapsed]))}static now(){return base+elapsed}};
    const nativeTimeout=setTimeout;globalThis.setTimeout=(fn,ms,...args)=>nativeTimeout(fn,0,...args);
    const calls=[];
    globalThis.fetch=async input=>{
      const u=new URL(input),endpoint=u.pathname.split('/').at(-1);
      calls.push({endpoint,ids:u.searchParams.get('tournamentIds')});fs.writeFileSync('calls.json',JSON.stringify(calls));elapsed+=1000;
      if(endpoint==='account'){
        if(process.env.CASE==='account-error')return {ok:false,status:503,text:async()=>'unavailable'};
        return {ok:true,text:async()=>JSON.stringify({current_subscription_id:'active',subscriptions:[{subscription_id:'active',request_limit:250,request_count:Number(process.env.COUNT)}]})};
      }
      if(endpoint==='odds-by-tournaments')return {ok:true,text:async()=>'[]'};
      throw Error('Unexpected endpoint '+endpoint);
    };
  `);
  for(const [name,count,status,requests]of [
    ['known-224',224,'ok',2],
    ['exact-five-reserve',243,'ok',2],
    ['last-affordable-base',244,'ok',1],
    ['at-reserve',245,'quota-reserve-protected',0],
    ['exhausted',250,'quota-reserve-protected',0],
    ['provider-over-limit',251,'quota-reserve-protected',0],
    ['bootstrap-unknown',244,'daily-budget-protected',0],
    ['account-error',224,'account-error',0]
  ]){
    for(const file of ['data/oddspapi-observer.json','data/oddspapi-budget-state.json'])fs.rmSync(path.join(temp,file),{force:true});
    if(name!=='bootstrap-unknown'){
      const known=reconcileBudgetState({requestLimit:250,requestCount:0,now,subscriptionId:'active'});
      known.providerObservedCount=count;known.estimatedRequestCount=count;
      fs.writeFileSync(path.join(temp,'data/oddspapi-budget-state.json'),JSON.stringify(known));
    }
    execFileSync(process.execPath,['--import',hook,path.join(root,'tools/oddspapi-observer.mjs')],{cwd:temp,env:{...process.env,ODDSPAPI_API_KEY:'FAKE_TEST_KEY',ODDSPAPI_CANONICAL_SLOT:'5',CASE:name,COUNT:String(count)},stdio:'pipe'});
    const result=JSON.parse(fs.readFileSync(path.join(temp,'data/oddspapi-observer.json'))),calls=JSON.parse(fs.readFileSync(path.join(temp,'calls.json')));
    assert.equal(result.status,status,name);
    assert.equal(result.diagnostics.plannedOddsRequests,2,name);
    assert.equal(result.diagnostics.billableRequestsThisRun,requests,name);
    assert.equal(calls.filter(x=>x.endpoint==='odds-by-tournaments').length,requests,name);
    assert.equal(result.diagnostics.oddsRequests,requests,name);
    assert.equal(calls.filter(x=>x.endpoint==='markets').length,0,'warm metadata never spends another call');
    if(status!=='account-error'){
      assert.equal(result.quota.protectedReserve,5,name);
      assert.equal(result.quota.remainingBefore,Math.max(0,250-count),name);
      assert.equal(result.budget.usedThisMonth,count+requests,name);
      assert.equal(result.budget.todayUsed,name==='bootstrap-unknown'?7:requests,name);
    }
    if(requests)assert.ok(result.quota.estimatedRemainingAfter>=5,name);
    if(name==='last-affordable-base'){
      assert.equal(result.coverageStatus,'PARTIAL_BUDGET');assert.equal(result.acquisitionComplete,false);
      assert.ok(result.diagnostics.deferredTournaments.length>0);
    }
    for(const call of calls.filter(x=>x.ids))assert.ok(call.ids.split(',').length<=5,name);
  }
  console.log('ODDSPAPI QUOTA: exact five-request boundary, affordable partial base, conservative bootstrap and exhausted/account-error protection PASS; no live requests.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
